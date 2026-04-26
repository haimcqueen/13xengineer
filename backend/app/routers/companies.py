import asyncio
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.db import SessionLocal, get_db
from app.models import Action, Company, Job, PeecSnapshot
from app.schemas import (
    ActionOut,
    BrandOut,
    BrandStat,
    CompanyOut,
    CompanyResolveRequest,
    CompanyResolveResponse,
    MarketStat,
    TopicOut,
)


# ISO-3166-1 alpha-2 → display name + centroid (lat, lng).
# Only the markets we track actively need to land here.
_COUNTRIES: dict[str, tuple[str, float, float]] = {
    "US": ("United States",  39.8, -98.6),
    "GB": ("United Kingdom", 54.0,  -2.0),
    "DE": ("Germany",        51.2,  10.5),
    "AT": ("Austria",        47.5,  14.0),
    "CH": ("Switzerland",    46.8,   8.2),
    "SE": ("Sweden",         60.1,  18.6),
    "NO": ("Norway",         60.5,   8.5),
    "DK": ("Denmark",        56.0,  10.0),
    "FI": ("Finland",        64.0,  26.0),
    "FR": ("France",         46.6,   2.2),
    "ES": ("Spain",          40.5,  -3.7),
    "PL": ("Poland",         51.9,  19.1),
    "CA": ("Canada",         56.1, -106.3),
    "AU": ("Australia",     -25.3, 133.8),
    "IN": ("India",          20.6,  79.0),
    "NL": ("Netherlands",    52.1,   5.3),
    "BE": ("Belgium",        50.5,   4.5),
    "IT": ("Italy",          41.9,  12.5),
    "PT": ("Portugal",       39.4,  -8.2),
    "IE": ("Ireland",        53.1,  -7.7),
    "BR": ("Brazil",        -14.2, -51.9),
    "MX": ("Mexico",         23.6, -102.5),
    "JP": ("Japan",          36.2, 138.3),
    "SG": ("Singapore",       1.4, 103.8),
}


def _build_brand_stats(snap_brands: dict, brand_report: dict | None) -> list[BrandStat]:
    """Merge `/brands` (which has is_own) with `/reports/brands` (which has metrics)."""
    if not brand_report:
        return []
    own_lookup = {
        b.get("id"): bool(b.get("is_own"))
        for b in (snap_brands or {}).get("data", [])
    }
    out: list[BrandStat] = []
    for row in brand_report.get("data", []):
        brand = row.get("brand") or {}
        bid = brand.get("id")
        if not bid:
            continue
        out.append(
            BrandStat(
                brand_id=bid,
                brand_name=brand.get("name") or "",
                visibility=float(row.get("visibility") or 0),
                share_of_voice=float(row.get("share_of_voice") or 0),
                sentiment=float(row.get("sentiment") or 0),
                position=float(row.get("position") or 0),
                mention_count=int(row.get("mention_count") or 0),
                is_own=own_lookup.get(bid, False),
            )
        )
    out.sort(key=lambda b: -b.visibility)
    return out


def _build_market_stats(
    market_report: dict | None, prompts: dict
) -> list[MarketStat]:
    """Per-country stats for the OWN brand. Joins market_report rows
    with country metadata + per-country prompt counts."""
    if not market_report:
        return []

    # Count prompts per user_location.country
    prompt_counts: dict[str, int] = {}
    for p in (prompts or {}).get("data", []):
        loc = p.get("user_location") or {}
        cc = loc.get("country")
        if cc:
            prompt_counts[cc] = prompt_counts.get(cc, 0) + 1

    out: list[MarketStat] = []
    for row in market_report.get("data", []):
        cc = row.get("country_code")
        if not cc or cc not in _COUNTRIES:
            continue
        name, lat, lng = _COUNTRIES[cc]
        out.append(
            MarketStat(
                country_code=cc,
                country_name=name,
                lat=lat,
                lng=lng,
                prompt_count=prompt_counts.get(cc, 0),
                visibility=float(row.get("visibility") or 0),
                position=float(row.get("position") or 0),
            )
        )
    out.sort(key=lambda m: -m.visibility)
    return out


def _total_chats(brand_report: dict | None) -> int:
    """visibility_total is project-wide and identical across rows — pick any."""
    if not brand_report:
        return 0
    rows = brand_report.get("data") or []
    if not rows:
        return 0
    return int(rows[0].get("visibility_total") or 0)
from app.services import jobs as jobs_svc
from app.services import resolve as resolve_svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/companies/resolve",
    response_model=CompanyResolveResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def resolve_company(
    body: CompanyResolveRequest, db: Session = Depends(get_db)
) -> CompanyResolveResponse:
    cached = resolve_svc.find_fresh_company(db, body.input)
    if cached is not None:
        job = jobs_svc.create_job(
            db, kind="resolve_company", company_id=cached.id, initial_status="pending"
        )
        resolve_svc.hydrate_cache_hit_job(db, job.id, cached)
        return CompanyResolveResponse(job_id=job.id, company_id=cached.id)

    job = jobs_svc.create_job(db, kind="resolve_company")
    job_id = job.id
    user_input = body.input

    async def factory(session: Session) -> None:
        await resolve_svc.resolve_pipeline(session, job_id, user_input)

    jobs_svc.run_in_background(factory, job_id)
    return CompanyResolveResponse(job_id=job_id, company_id=None)


@router.get("/companies/resolve/stream")
async def stream_resolve(job_id: str = Query(...)) -> EventSourceResponse:
    """SSE stream that polls the Job.progress column and emits new events.

    Reading from the job row (instead of subscribing to the coroutine) keeps
    the stream replayable and reconnect-safe.
    """

    async def event_iter():
        sent = 0
        # Cap total wait: 60s for cold path, generous given Peec is slow.
        deadline = asyncio.get_event_loop().time() + 60.0
        while True:
            db = SessionLocal()
            try:
                job = db.get(Job, job_id)
                if not job:
                    yield {"event": "error", "data": '{"code":"unknown_job"}'}
                    return
                events = (job.progress or {}).get("events", [])
                for evt in events[sent:]:
                    yield {
                        "event": evt.get("type", "message"),
                        "data": _json(evt.get("data") or {}),
                    }
                sent = len(events)
                terminal = job.status in ("done", "failed")
            finally:
                db.close()
            if terminal:
                return
            if asyncio.get_event_loop().time() > deadline:
                yield {"event": "error", "data": '{"code":"timeout"}'}
                return
            await asyncio.sleep(0.25)

    return EventSourceResponse(event_iter())


def _json(d: dict) -> str:
    import json

    return json.dumps(d, default=str, separators=(",", ":"))


@router.get("/companies/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)) -> CompanyOut:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    snap = (
        db.query(PeecSnapshot)
        .filter(PeecSnapshot.company_id == company.id)
        .order_by(PeecSnapshot.fetched_at.desc())
        .first()
    )
    if snap is None:
        raise HTTPException(status_code=404, detail="no snapshot for company")

    own_brand = None
    for b in (snap.brands or {}).get("data", []):
        if b.get("is_own"):
            own_brand = BrandOut(
                id=b.get("id", ""),
                name=b.get("name", ""),
                domains=b.get("domains") or [],
                is_own=True,
            )
            break

    topics = [
        TopicOut(id=t.get("id", ""), name=t.get("name", ""))
        for t in (snap.topics or {}).get("data", [])
    ]

    fetched_at = snap.fetched_at
    if fetched_at.tzinfo is None:
        fetched_at = fetched_at.replace(tzinfo=timezone.utc)

    brand_stats = _build_brand_stats(snap.brands or {}, snap.brand_report)
    market_stats = _build_market_stats(snap.market_report, snap.prompts or {})
    total_chats = _total_chats(snap.brand_report)

    return CompanyOut(
        id=company.id,
        name=company.name,
        own_domain=company.own_domain,
        own_brand=own_brand,
        topics=topics,
        prompt_count=len((snap.prompts or {}).get("data", [])),
        last_refreshed_at=fetched_at,
        brand_stats=brand_stats,
        market_stats=market_stats,
        total_chats=total_chats,
    )


@router.get("/companies/{company_id}/actions", response_model=list[ActionOut])
def get_actions(company_id: str, db: Session = Depends(get_db)) -> list[ActionOut]:
    company = db.get(Company, company_id)
    if company is None:
        raise HTTPException(status_code=404, detail="company not found")
    snap = (
        db.query(PeecSnapshot)
        .filter(PeecSnapshot.company_id == company.id)
        .order_by(PeecSnapshot.fetched_at.desc())
        .first()
    )
    if snap is None:
        return []
    rows = db.query(Action).filter(Action.snapshot_id == snap.id).all()
    rank = {"high": 0, "medium": 1, "low": 2}
    rows.sort(key=lambda a: (rank.get(a.opportunity, 99), a.title))
    return [
        ActionOut(
            id=a.id,
            category=a.category,  # type: ignore[arg-type]
            kind=a.kind,
            title=a.title,
            rationale=a.rationale,
            opportunity=a.opportunity,  # type: ignore[arg-type]
            target=a.target or {},
            suggested_agent=a.suggested_agent,  # type: ignore[arg-type]
        )
        for a in rows
    ]
