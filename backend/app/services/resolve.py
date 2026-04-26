"""Trimmed resolve pipeline.

Hackathon scope: only fetches the Peec data the frontend actually consumes
(prompts count, /brands for own_brand + is_own lookup, /topics for the
topic list). Everything else (`/tags`, `/models`, `/reports/*`, the live
MCP loop, the Exa crawl) is dropped or mocked because the frontend never
displays it and the real calls add 30-90s of cold-start latency.

If you need the full pipeline back, the dropped paths are still in
`app.services.peec_rest`, `app.services.peec_mcp.RealMCPClient`, and
`app.services.site_intel.crawl_with_exa` — they just aren't wired here.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Company, Job, PeecSnapshot
from app.services import jobs as jobs_svc
from app.services import peec_actions
from app.services.company_match import (
    MatchedProject,
    MatchFailure,
    resolve as match_resolve,
)
from app.services.mock_reports import (
    synthesize_brand_report,
    synthesize_market_report,
)
from app.services.peec_mcp import FixtureMCPClient
from app.services.peec_rest import PeecRestClient

logger = logging.getLogger(__name__)


def find_fresh_company(db: Session, user_input: str) -> Company | None:
    """Return a Company whose latest snapshot is within TTL, if any."""
    from app.services.company_match import _normalize_domain

    domain = _normalize_domain(user_input)
    company: Company | None = None
    if domain:
        company = (
            db.query(Company)
            .filter(Company.own_domain == domain)
            .order_by(Company.created_at.desc())
            .first()
        )
    if not company:
        company = (
            db.query(Company)
            .filter(Company.user_input == user_input)
            .order_by(Company.created_at.desc())
            .first()
        )
    if not company:
        return None

    snap = (
        db.query(PeecSnapshot)
        .filter(PeecSnapshot.company_id == company.id)
        .order_by(PeecSnapshot.fetched_at.desc())
        .first()
    )
    if not snap:
        return None
    age = (
        datetime.now(timezone.utc) - snap.fetched_at.replace(tzinfo=timezone.utc)
    ).total_seconds()
    if age > settings.snapshot_ttl_seconds:
        return None
    return company


async def resolve_pipeline(db: Session, job_id: str, user_input: str) -> None:
    """Cold-path resolve. Emits progress events into the job row.

    Steps: match → fetch (3 cheap REST calls in parallel) → mock reports →
    fixture actions → snapshot + actions.
    """

    # 1. Match against Peec (real). This is the only outbound call we can't
    #    skip — the rest of the system keys off the resolved project_id.
    match = await match_resolve(user_input)
    if isinstance(match, MatchFailure):
        jobs_svc.append_event(
            db,
            job_id,
            "error",
            {"code": "no_match", "tracked_names": match.tracked_names},
        )
        jobs_svc.mark_failed(
            db,
            job_id,
            error="No tracked Peec project matched that input",
            error_code="no_match",
        )
        return

    assert isinstance(match, MatchedProject)

    # 2. Persist Company.
    company = (
        db.query(Company).filter(Company.peec_project_id == match.project_id).first()
    )
    if company is None:
        company = Company(
            id=f"c_{uuid.uuid4()}",
            peec_project_id=match.project_id,
            name=match.name,
            own_domain=match.own_domain,
            user_input=user_input,
        )
        db.add(company)
    else:
        company.user_input = user_input
        if match.own_domain and not company.own_domain:
            company.own_domain = match.own_domain
        if match.name and company.name != match.name:
            company.name = match.name
    db.commit()
    db.refresh(company)

    jobs_svc.append_event(
        db,
        job_id,
        "project_matched",
        {
            "company_id": company.id,
            "name": company.name,
            "own_domain": company.own_domain,
        },
    )

    job_row = db.get(Job, job_id)
    if job_row is not None:
        job_row.company_id = company.id
        db.commit()

    # 3. Three cheap parallel REST calls — only what the frontend reads.
    async with PeecRestClient() as client:

        async def fetch_prompts():
            data = await client.get_prompts(match.project_id)
            jobs_svc.append_event(
                db, job_id, "prompts_loaded", {"count": len(data.get("data", []))}
            )
            return data

        async def fetch_brands():
            data = await client.get_brands(match.project_id)
            own = next(
                (b for b in data.get("data", []) if b.get("is_own")), None
            )
            jobs_svc.append_event(
                db,
                job_id,
                "brands_loaded",
                {
                    "count": len(data.get("data", [])),
                    "own_brand": (
                        {"name": own.get("name"), "domains": own.get("domains") or []}
                        if own
                        else None
                    ),
                },
            )
            return data

        async def fetch_topics():
            data = await client.get_topics(match.project_id)
            jobs_svc.append_event(
                db, job_id, "topics_loaded", {"count": len(data.get("data", []))}
            )
            return data

        prompts, brands, topics = await asyncio.gather(
            fetch_prompts(), fetch_brands(), fetch_topics()
        )

    # 4. Mock the analytics reports (frontend-visible: brand_stats, market_stats).
    brand_report = synthesize_brand_report(brands)
    market_report = synthesize_market_report(brands, match.project_id)
    jobs_svc.append_event(db, job_id, "reports_loaded", {})

    # 5. Mock the actions via the fixture client (instant — no Anthropic call).
    jobs_svc.append_event(db, job_id, "actions_pending", {})
    fixture = FixtureMCPClient()
    try:
        mcp_actions = await fixture.get_actions(match.project_id)
    except Exception as e:  # noqa: BLE001 — non-fatal
        logger.warning("fixture actions failed: %s", e)
        mcp_actions = []
    jobs_svc.append_event(db, job_id, "actions_loaded", {"count": len(mcp_actions)})

    # 6. Persist snapshot + derived actions.
    snapshot = PeecSnapshot(
        id=f"s_{uuid.uuid4()}",
        company_id=company.id,
        prompts=prompts,
        brands=brands,
        topics=topics,
        # tags / models are required by the schema but never read; pass empty.
        tags={"data": []},
        models={"data": []},
        mcp_actions_raw={"actions": list(mcp_actions)} if mcp_actions else None,
        brand_report=brand_report,
        market_report=market_report,
        domain_report=None,
    )
    db.add(snapshot)
    db.flush()  # need snapshot.id for actions

    actions = peec_actions.derive(snapshot)
    for a in actions:
        db.add(a)

    db.commit()

    jobs_svc.append_event(db, job_id, "done", {"company_id": company.id})
    jobs_svc.mark_done(db, job_id, {"company_id": company.id})


def hydrate_cache_hit_job(db: Session, job_id: str, company: Company) -> None:
    """Replay the same event sequence on a cache hit so the SSE stream
    looks identical to the cold path."""
    snap = (
        db.query(PeecSnapshot)
        .filter(PeecSnapshot.company_id == company.id)
        .order_by(PeecSnapshot.fetched_at.desc())
        .first()
    )
    own = None
    if snap is not None:
        own = next(
            (b for b in (snap.brands or {}).get("data", []) if b.get("is_own")),
            None,
        )

    events: list[tuple[str, dict]] = [
        (
            "project_matched",
            {
                "company_id": company.id,
                "name": company.name,
                "own_domain": company.own_domain,
            },
        ),
        (
            "prompts_loaded",
            {"count": len((snap.prompts or {}).get("data", []) if snap else [])},
        ),
        (
            "brands_loaded",
            {
                "count": len((snap.brands or {}).get("data", []) if snap else []),
                "own_brand": (
                    {"name": own.get("name"), "domains": own.get("domains") or []}
                    if own
                    else None
                ),
            },
        ),
        (
            "topics_loaded",
            {"count": len((snap.topics or {}).get("data", []) if snap else [])},
        ),
        ("reports_loaded", {}),
        (
            "actions_loaded",
            {
                "count": len(
                    ((snap.mcp_actions_raw or {}).get("actions") or [])
                    if snap
                    else []
                )
            },
        ),
        ("done", {"company_id": company.id}),
    ]
    for etype, data in events:
        jobs_svc.append_event(db, job_id, etype, data)
    jobs_svc.mark_done(db, job_id, {"company_id": company.id})
