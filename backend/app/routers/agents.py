import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.agents.registry import REGISTRY, get_agent
from app.db import get_db
from app.models import Action, Company
from app.schemas import AgentRunRequest, AgentRunResponse
from app.services import jobs as jobs_svc

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post(
    "/agents/{kind}/run",
    response_model=AgentRunResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def run_agent(
    kind: str, body: AgentRunRequest, db: Session = Depends(get_db)
) -> AgentRunResponse:
    if kind not in REGISTRY:
        raise HTTPException(status_code=404, detail=f"unknown agent kind: {kind}")

    action = db.get(Action, body.action_id)
    if action is None:
        raise HTTPException(status_code=404, detail="action not found")

    company = db.get(Company, action.company_id)
    if company is None:
        raise HTTPException(status_code=500, detail="action has no company")

    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=company.id,
        action_id=action.id,
        agent_kind=kind,
    )
    job_id = job.id
    action_id = action.id
    company_id = company.id

    async def factory(session: Session) -> None:
        a = session.get(Action, action_id)
        c = session.get(Company, company_id)
        if a is None or c is None:
            jobs_svc.mark_failed(session, job_id, "action or company missing", "stale_state")
            return
        agent = get_agent(kind)
        result = await agent.run(a, c)
        jobs_svc.mark_done(session, job_id, result)

    jobs_svc.run_in_background(factory, job_id)
    return AgentRunResponse(job_id=job_id)
