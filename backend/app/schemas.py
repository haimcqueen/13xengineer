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


class BrandStat(BaseModel):
    brand_id: str
    brand_name: str
    visibility: float
    share_of_voice: float
    sentiment: float
    position: float
    mention_count: int
    is_own: bool


class MarketStat(BaseModel):
    country_code: str
    country_name: str
    lat: float
    lng: float
    prompt_count: int
    visibility: float
    position: float


class CompanyOut(BaseModel):
    id: str
    name: str
    own_domain: str | None
    own_brand: BrandOut | None
    topics: list[TopicOut]
    prompt_count: int
    last_refreshed_at: datetime
    brand_stats: list[BrandStat] = []
    market_stats: list[MarketStat] = []
    total_chats: int = 0


ActionCategory = Literal["owned_media", "earned_media"]
Opportunity = Literal["low", "medium", "high"]
AgentKind = Literal["article", "video", "code-pr", "improvement"]
PlanChangeType = Literal["add", "modify", "create"]


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
    improvement_job_id: str | None = None


class AgentRunResponse(BaseModel):
    job_id: str


class RepoConfigIn(BaseModel):
    site_url: str = Field(min_length=1, max_length=500)
    repo_url: str = Field(min_length=1, max_length=500)
    default_branch: str = "main"
    github_token: str = Field(min_length=1, max_length=500)


class RepoConfigOut(BaseModel):
    company_id: str
    site_url: str
    repo_url: str
    default_branch: str
    has_token: bool


class PlanEdit(BaseModel):
    file_path: str
    change_type: PlanChangeType
    description: str
    content: str
    insertion_anchor: str | None = None


class ImprovementPlan(BaseModel):
    summary: str
    rationale: str
    expected_impact: str
    edits: list[PlanEdit]


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
