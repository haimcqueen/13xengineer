from datetime import timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Job
from app.schemas import JobOut, ProgressEvent

router = APIRouter()


@router.get("/jobs/{job_id}", response_model=JobOut)
def get_job(job_id: str, db: Session = Depends(get_db)) -> JobOut:
    job = db.get(Job, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")

    events_raw = (job.progress or {}).get("events", [])
    events = []
    for e in events_raw:
        t = e.get("t")
        if isinstance(t, str):
            from datetime import datetime

            try:
                t = datetime.fromisoformat(t)
                if t.tzinfo is None:
                    t = t.replace(tzinfo=timezone.utc)
            except ValueError:
                from datetime import datetime as _dt

                t = _dt.now(timezone.utc)
        events.append(
            ProgressEvent(
                t=t,
                type=e.get("type", "message"),
                data=e.get("data") or {},
            )
        )

    return JobOut(
        id=job.id,
        kind=job.kind,  # type: ignore[arg-type]
        status=job.status,  # type: ignore[arg-type]
        progress=events,
        result=job.result,
        error=job.error,
        error_code=job.error_code,
    )
