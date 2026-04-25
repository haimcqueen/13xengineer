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
    CompanyOut,
    CompanyResolveRequest,
    CompanyResolveResponse,
    TopicOut,
)
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

    return CompanyOut(
        id=company.id,
        name=company.name,
        own_domain=company.own_domain,
        own_brand=own_brand,
        topics=topics,
        prompt_count=len((snap.prompts or {}).get("data", [])),
        last_refreshed_at=fetched_at,
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
