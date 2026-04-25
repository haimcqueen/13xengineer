from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class PingResponse(BaseModel):
    message: str


class BrandOut(BaseModel):
    id: str
    name: str
    domains: list[str]
    is_own: bool


class TopicOut(BaseModel):
    id: str
    name: str


class CompanyOut(BaseModel):
    id: str
    name: str
    own_domain: str | None
    own_brand: BrandOut | None
    topics: list[TopicOut]
    prompt_count: int
    last_refreshed_at: datetime


ActionCategory = Literal["owned_media", "earned_media"]
Opportunity = Literal["low", "medium", "high"]
AgentKind = Literal["article", "video", "code-pr"]


class ActionOut(BaseModel):
    id: str
    category: ActionCategory
    kind: str
    title: str
    rationale: str | None
    opportunity: Opportunity
    target: dict
    suggested_agent: AgentKind | None


class CompanyResolveRequest(BaseModel):
    input: str = Field(min_length=1, max_length=200)


class CompanyResolveResponse(BaseModel):
    job_id: str
    company_id: str | None


class AgentRunRequest(BaseModel):
    action_id: str


class AgentRunResponse(BaseModel):
    job_id: str


class ProgressEvent(BaseModel):
    t: datetime
    type: str
    data: dict


JobKind = Literal["resolve_company", "agent_run"]
JobStatus = Literal["pending", "running", "done", "failed"]


class JobOut(BaseModel):
    id: str
    kind: JobKind
    status: JobStatus
    progress: list[ProgressEvent]
    result: dict | None
    error: str | None
    error_code: str | None
