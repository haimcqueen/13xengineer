import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Awaitable, Callable

from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Job

logger = logging.getLogger(__name__)


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def create_job(
    db: Session,
    *,
    kind: str,
    company_id: str | None = None,
    action_id: str | None = None,
    agent_kind: str | None = None,
    initial_status: str = "pending",
    initial_progress: list[dict] | None = None,
    initial_result: dict | None = None,
    initial_error: str | None = None,
    initial_error_code: str | None = None,
) -> Job:
    job = Job(
        id=f"j_{uuid.uuid4()}",
        kind=kind,
        status=initial_status,
        company_id=company_id,
        action_id=action_id,
        agent_kind=agent_kind,
        progress={"events": list(initial_progress or [])},
        result=initial_result,
        error=initial_error,
        error_code=initial_error_code,
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def append_event(db: Session, job_id: str, event_type: str, data: dict | None = None) -> dict:
    job = db.get(Job, job_id)
    if not job:
        raise ValueError(f"job {job_id} not found")
    event = {"t": _utcnow_iso(), "type": event_type, "data": data or {}}
    progress = dict(job.progress or {"events": []})
    events = list(progress.get("events", []))
    events.append(event)
    progress["events"] = events
    job.progress = progress
    job.updated_at = datetime.now(timezone.utc)
    db.commit()
    return event


def mark_running(db: Session, job_id: str) -> None:
    job = db.get(Job, job_id)
    if job and job.status == "pending":
        job.status = "running"
        job.updated_at = datetime.now(timezone.utc)
        db.commit()


def mark_done(db: Session, job_id: str, result: dict | None) -> None:
    job = db.get(Job, job_id)
    if not job:
        return
    job.status = "done"
    job.result = result
    job.updated_at = datetime.now(timezone.utc)
    db.commit()


def mark_failed(
    db: Session, job_id: str, error: str, error_code: str | None = None
) -> None:
    job = db.get(Job, job_id)
    if not job:
        return
    job.status = "failed"
    job.error = error
    job.error_code = error_code
    job.updated_at = datetime.now(timezone.utc)
    db.commit()


def run_in_background(
    coro_factory: Callable[[Session], Awaitable[Any]],
    job_id: str,
) -> asyncio.Task:
    """Spawn a coroutine that owns its own DB session and reports failure
    back into the Job row.

    Single place where asyncio tasks are created so we can add observability
    later without hunting through routers.
    """

    async def runner() -> None:
        db = SessionLocal()
        try:
            mark_running(db, job_id)
            try:
                await coro_factory(db)
            except Exception as e:  # noqa: BLE001 — top-level safety net
                logger.exception("background job %s crashed", job_id)
                mark_failed(db, job_id, str(e), error_code="internal_error")
        finally:
            db.close()

    return asyncio.create_task(runner())
