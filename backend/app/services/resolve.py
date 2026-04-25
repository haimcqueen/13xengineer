import asyncio
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.config import settings
from app.models import Company, Job, PeecSnapshot
from app.services import jobs as jobs_svc
from app.services import peec_actions
from app.services.company_match import MatchedProject, MatchFailure, resolve as match_resolve
from app.services.peec_mcp import get_mcp_client
from app.services.peec_rest import PeecError, PeecRestClient

logger = logging.getLogger(__name__)


def find_fresh_company(db: Session, user_input: str) -> Company | None:
    """Return a Company whose latest snapshot is within TTL, if any.

    Match by user_input domain or name first, fall back to None.
    """
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
    age = (datetime.now(timezone.utc) - snap.fetched_at.replace(tzinfo=timezone.utc)).total_seconds()
    if age > settings.snapshot_ttl_seconds:
        return None
    return company


async def resolve_pipeline(db: Session, job_id: str, user_input: str) -> None:
    """The cold-path resolve flow. Emits progress events into the job row.

    Steps: match → fetch (parallel REST) → mcp actions → snapshot + actions.
    Errors bubble up to run_in_background which marks the job failed.
    """
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
        {"company_id": company.id, "name": company.name, "own_domain": company.own_domain},
    )

    job_row = db.get(Job, job_id)
    if job_row is not None:
        job_row.company_id = company.id
        db.commit()

    async with PeecRestClient() as client:

        async def fetch_prompts():
            data = await client.get_prompts(match.project_id)
            jobs_svc.append_event(db, job_id, "prompts_loaded", {"count": len(data.get("data", []))})
            return data

        async def fetch_brands():
            data = await client.get_brands(match.project_id)
            own = next((b for b in data.get("data", []) if b.get("is_own")), None)
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
            jobs_svc.append_event(db, job_id, "topics_loaded", {"count": len(data.get("data", []))})
            return data

        async def fetch_tags():
            return await client.get_tags(match.project_id)

        async def fetch_models():
            return await client.get_models(match.project_id)

        prompts, brands, topics, tags, models_payload = await asyncio.gather(
            fetch_prompts(), fetch_brands(), fetch_topics(), fetch_tags(), fetch_models()
        )

    mcp = get_mcp_client()
    try:
        mcp_actions = await mcp.get_actions(match.project_id)
    except Exception as e:  # noqa: BLE001 — MCP failure must not break resolve
        logger.warning("mcp.get_actions failed: %s", e)
        mcp_actions = []
    jobs_svc.append_event(db, job_id, "actions_loaded", {"count": len(mcp_actions)})

    snapshot = PeecSnapshot(
        id=f"s_{uuid.uuid4()}",
        company_id=company.id,
        prompts=prompts,
        brands=brands,
        topics=topics,
        tags=tags,
        models=models_payload,
        mcp_actions_raw={"actions": list(mcp_actions)} if mcp_actions else None,
    )
    db.add(snapshot)
    db.flush()  # need snapshot.id for actions

    actions = peec_actions.derive(snapshot)
    for a in actions:
        db.add(a)

    db.commit()

    jobs_svc.append_event(db, job_id, "done", {"company_id": company.id})
    jobs_svc.mark_done(db, job_id, {"company_id": company.id})


def hydrate_cache_hit_job(
    db: Session, job_id: str, company: Company
) -> None:
    """Populate a job for a cache-hit resolve so the SSE stream replays
    the same event sequence the cold path produces."""
    snap = (
        db.query(PeecSnapshot)
        .filter(PeecSnapshot.company_id == company.id)
        .order_by(PeecSnapshot.fetched_at.desc())
        .first()
    )
    own = None
    if snap is not None:
        own = next((b for b in (snap.brands or {}).get("data", []) if b.get("is_own")), None)

    events: list[tuple[str, dict]] = [
        (
            "project_matched",
            {"company_id": company.id, "name": company.name, "own_domain": company.own_domain},
        ),
        ("prompts_loaded", {"count": len((snap.prompts or {}).get("data", []) if snap else [])}),
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
        ("topics_loaded", {"count": len((snap.topics or {}).get("data", []) if snap else [])}),
        (
            "actions_loaded",
            {"count": len(((snap.mcp_actions_raw or {}).get("actions") or []) if snap else [])},
        ),
        ("done", {"company_id": company.id}),
    ]
    for etype, data in events:
        jobs_svc.append_event(db, job_id, etype, data)
    jobs_svc.mark_done(db, job_id, {"company_id": company.id})
