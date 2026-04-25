# Felix backend — design spec

Date: 2026-04-25
Status: approved
Scope: first iteration of the Felix backend (onboarding + insights + agent stubs)

## Product context

Felix is a hackathon extension of [Peec.ai](https://peec.ai/) — an AI search
analytics platform that tracks brand visibility across ChatGPT, Perplexity,
Gemini, and Claude. Peec's "Actions" feature surfaces a prioritized list of
brand-visibility tasks. Felix takes those actions and runs downstream agents
against them: an article writer, a video generator, and a code/PR raising
agent. The user enters a company name or URL, sees actions, and can hand
each to an agent.

This spec covers the **first** backend iteration: onboarding + insights
display + agent stubs (real agent bodies are out of scope for this
iteration).

## Peec API reality (post-probe, 2026-04-25)

A live probe with a real Enterprise key established that Peec's REST API
exposes only configuration data — projects, prompts, brands, topics, tags,
models. Analytics outputs (Actions, visibility scores, source citations,
share-of-voice) are **not** exposed via REST despite what `docs.peec.ai`
suggests; they require the Peec MCP server, which uses OAuth 2.0 access
tokens (the API key is rejected). `/chats` exists but returns empty for
every project on the account, even populated ones.

Implication: REST is the only data source we can rely on without standing
up an OAuth flow. MCP is reachable but additional work. Real Peec Actions
require MCP. We design for both, with a fixture-backed MCP client behind an
interface so the system works end-to-end today and the real client can be
swapped in via a feature flag.

Confirmed REST surface (base `https://api.peec.ai/customer/v1/`,
`x-api-key` header, project key passed as `?project_id=or_*`):
`/projects`, `/prompts`, `/brands`, `/topics`, `/tags`, `/models`. All
return JSON envelopes `{data: [...], totalCount?}`.

## Decisions locked during brainstorming

- **Peec access:** API key already in repo `.env` as `PEEC_API_KEY`.
- **Scope:** onboarding + insights only; downstream agents stubbed.
- **Actions strategy:** hybrid — REST for setup/metadata, MCP (fixture for
  now) for Actions. Behind a single interface so MCP can be swapped at
  runtime.
- **Company resolution:** match user input against the existing 21 Peec
  projects on the account (by project name and by `is_own=true` brand
  domain). No project creation — Peec doesn't expose it. Demo target is
  Legora (`or_f980868d-5a09-40f7-9c1d-256b991a6ba2`).
- **Persistence:** mirror Peec data to SQLite on first resolve, with a TTL
  for staleness. SSE during the first resolve so the frontend's transition
  screen has progressive updates; cache hits on subsequent loads.
- **Architecture:** single-process FastAPI with in-process asyncio jobs
  backed by a `jobs` SQLite table. No external queue, no Redis. Same job
  model used for resolve and for agent runs.

## Architecture

Single FastAPI process. SQLite via SQLAlchemy 2.x. New dependencies:

- `httpx` — Peec REST client
- `sse-starlette` — SSE responses
- `respx` (dev) — httpx mocking for tests

`mcp` and `authlib` are NOT added in this iteration — the MCP client ships
as a fixture-backed implementation behind the same async interface that the
real client will satisfy later.

### Module layout

```
backend/
├── app/
│   ├── main.py             # FastAPI app, lifespan, CORS, router includes
│   ├── config.py           # Settings: DATABASE_URL, CORS_ORIGINS,
│   │                       #   PEEC_API_KEY, PEEC_API_BASE, PEEC_USE_REAL_MCP,
│   │                       #   SNAPSHOT_TTL_SECONDS
│   ├── db.py               # engine, SessionLocal, Base, get_db
│   ├── models.py           # Company, PeecSnapshot, Action, Job
│   ├── schemas.py          # Pydantic: CompanyOut, ActionOut, JobOut, ...
│   ├── routers/
│   │   ├── companies.py    # POST /api/companies/resolve
│   │   │                   # GET  /api/companies/resolve/stream
│   │   │                   # GET  /api/companies/{id}
│   │   │                   # GET  /api/companies/{id}/actions
│   │   ├── agents.py       # POST /api/agents/{kind}/run
│   │   └── jobs.py         # GET  /api/jobs/{id}
│   ├── services/
│   │   ├── peec_rest.py    # httpx client over Peec customer API
│   │   ├── peec_mcp.py     # MCPClient interface + FixtureMCPClient impl
│   │   ├── peec_actions.py # snapshot → Action[] derivation
│   │   ├── company_match.py# resolve user input → peec_project_id
│   │   ├── jobs.py         # create/run/update jobs in DB
│   │   └── resolve.py      # the resolve_pipeline coroutine
│   └── agents/
│       ├── base.py         # Agent protocol
│       ├── article.py      # stub
│       ├── video.py        # stub
│       └── code_pr.py      # stub
└── fixtures/
    └── legora_actions.json # hand-curated Action seed for the MCP fixture
```

Boundaries:

- Only `services/peec_*` modules talk to Peec. Routers never call httpx or
  MCP directly.
- The MCP interface is `async def get_actions(project_id) -> list[ActionDTO]`.
  `FixtureMCPClient` reads `fixtures/legora_actions.json` for Legora and
  returns an empty list for other projects. Selecting the implementation
  is a single `if settings.peec_use_real_mcp:` branch in `peec_mcp.py`.
- All asyncio background work goes through `services/jobs.py`. One place
  to add observability later.

## Data model

```python
class Company(Base):
    __tablename__ = "companies"
    id: Mapped[str] = mapped_column(primary_key=True)        # uuid we mint
    peec_project_id: Mapped[str] = mapped_column(unique=True, index=True)
    name: Mapped[str]
    own_domain: Mapped[str | None] = mapped_column(index=True)
    user_input: Mapped[str]
    created_at: Mapped[datetime]

class PeecSnapshot(Base):
    __tablename__ = "peec_snapshots"
    id: Mapped[str] = mapped_column(primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    fetched_at: Mapped[datetime]
    prompts: Mapped[dict] = mapped_column(JSON)
    brands: Mapped[dict] = mapped_column(JSON)
    topics: Mapped[dict] = mapped_column(JSON)
    tags: Mapped[dict] = mapped_column(JSON)
    models: Mapped[dict] = mapped_column(JSON)
    mcp_actions_raw: Mapped[dict | None] = mapped_column(JSON)

class Action(Base):
    __tablename__ = "actions"
    id: Mapped[str] = mapped_column(primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("peec_snapshots.id"))
    category: Mapped[str]            # "owned_media" | "earned_media"
    kind: Mapped[str]                # "article" | "listicle" | "subreddit" | ...
    title: Mapped[str]
    rationale: Mapped[str | None]
    opportunity: Mapped[str]         # "low" | "medium" | "high"
    target: Mapped[dict] = mapped_column(JSON)
    suggested_agent: Mapped[str | None]

class Job(Base):
    __tablename__ = "jobs"
    id: Mapped[str] = mapped_column(primary_key=True)
    kind: Mapped[str]                # "resolve_company" | "agent_run"
    status: Mapped[str]              # "pending" | "running" | "done" | "failed"
    company_id: Mapped[str | None] = mapped_column(ForeignKey("companies.id"))
    action_id: Mapped[str | None] = mapped_column(ForeignKey("actions.id"))
    agent_kind: Mapped[str | None]
    progress: Mapped[dict | None] = mapped_column(JSON)
    result: Mapped[dict | None] = mapped_column(JSON)
    error: Mapped[str | None]
    error_code: Mapped[str | None]
    created_at: Mapped[datetime]
    updated_at: Mapped[datetime]
```

Notes:

- Raw Peec payloads are kept in `PeecSnapshot` so we can re-derive
  `Action` rows without re-fetching, and so we have ground truth for
  debugging Peec's beta API.
- `Job.progress` is a JSON column logging timestamped events. Same column
  drives SSE replay and post-hoc inspection.
- No `User` table. One implicit user. Auth deferred.

## API surface

```
POST /api/companies/resolve            body { input: string }
                                       → 202 { job_id, company_id|null }

GET  /api/companies/resolve/stream     ?job_id=...
                                       → text/event-stream

GET  /api/companies/{company_id}       → CompanyOut

GET  /api/companies/{company_id}/actions
                                       → ActionOut[]

POST /api/agents/{kind}/run            kind ∈ {article, video, code-pr}
                                       body { action_id }
                                       → 202 { job_id }

GET  /api/jobs/{job_id}                → JobOut

GET  /health                           → liveness
```

Pydantic schemas (frontend-visible):

```python
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

class ActionOut(BaseModel):
    id: str
    category: Literal["owned_media", "earned_media"]
    kind: str
    title: str
    rationale: str | None
    opportunity: Literal["low", "medium", "high"]
    target: dict
    suggested_agent: Literal["article", "video", "code-pr"] | None

class ProgressEvent(BaseModel):
    t: datetime
    type: str
    data: dict

class JobOut(BaseModel):
    id: str
    kind: Literal["resolve_company", "agent_run"]
    status: Literal["pending", "running", "done", "failed"]
    progress: list[ProgressEvent]
    result: dict | None
    error: str | None
    error_code: str | None
```

SSE event types in order on a cold resolve:
`project_matched` → `prompts_loaded` → `brands_loaded` → `topics_loaded` →
`actions_loaded` → `done`. Or `error` (terminal). On cache hit, all events
fire in the same tick.

The SSE endpoint is a thin reader over the `Job.progress` column — it does
not subscribe directly to the resolve coroutine. This makes it
reconnectable, replayable, and equivalent to polling `GET /api/jobs/{id}`
for clients that don't want SSE.

## Critical flows

### Resolve (cold path)

1. POST creates a `Job(kind="resolve_company", status="pending")`, spawns
   `asyncio.create_task(resolve_pipeline(job_id, input))`, returns 202
   with `job_id`.
2. `resolve_pipeline`:
   - Calls `company_match.resolve(input)`. List `/projects`, fan out
     `/brands?is_own=true` per project (parallel httpx). Match the input
     against project name (case-insensitive substring) and against any own-
     brand domain (exact + suffix match: `legora.com` matches a brand with
     domain `legora.com` or `app.legora.com`).
   - On no match: `Job(status=failed, error_code="no_match",
     error=<list of tracked names>)`. Append `error` progress event. Return.
   - On match: insert/update `Company` row. Append `project_matched`
     progress event.
   - Parallel fetch `/prompts`, `/brands`, `/topics`, `/tags`, `/models`.
     Each successful call appends its `*_loaded` event.
   - Call `peec_mcp.get_actions(project_id)` (fixture). Append
     `actions_loaded`.
   - Insert `PeecSnapshot` row + `Action` rows in one transaction via
     `peec_actions.derive(snapshot)`.
   - `Job(status=done, result={"company_id": ...})`. Append `done` event.

### Resolve (cache hit)

If a `Company` exists with a `PeecSnapshot.fetched_at` younger than
`SNAPSHOT_TTL_SECONDS` (default 600), POST returns 202 with
`company_id` populated and the job is created already in `done` state with
all events pre-populated in `progress`. SSE emits all events in the same
tick.

### Agent run

1. POST loads `Action`, validates `kind`, loads company context. Creates
   `Job(kind="agent_run", agent_kind=kind, action_id=action_id)`. Spawns
   `asyncio.create_task(run_agent(...))`. Returns 202 with `job_id`.
2. Stub agent: `mark_running` → `await asyncio.sleep(2)` → write
   realistic-shaped `result` (markdown for `article`, fake URL for
   `video`, fake PR URL + diff for `code-pr`) → `mark_done`.
3. Frontend polls `GET /api/jobs/{job_id}` ~every 1.5s.

## Error handling

- **No match** — terminal `failed` job, `error_code="no_match"`, error
  payload includes the list of tracked company names. No retry by backend.
- **Peec REST 4xx/5xx/timeout** — small retry helper: 3 attempts, exponential
  backoff for 5xx and connection errors, no retry for 401/403/404. On
  terminal failure, job ends `failed` with `error_code="peec_unavailable"`.
- **MCP unavailable** — fixture client doesn't fail today. The interface
  includes failure modes; if the real client errors, log and continue with
  REST-only data. `Action` derivation falls back to a smaller set keyed off
  prompt/brand coverage gaps. User sees fewer, weaker actions, never a
  broken page.
- httpx timeouts: 10s connect, 30s read.

## Testing

`pytest` with `httpx.AsyncClient` against the FastAPI TestClient. SQLite
uses a per-test in-memory DB via a fixture overriding `get_db`.

- `peec_rest.py`: `respx`-mocked tests against recorded Legora payloads;
  retry behavior (5xx retried, 404 not retried); `?project_id=` construction.
- `company_match`: table-driven matching tests using fixtures
  (`projects.json`, per-project `brands.json`).
- `peec_actions.derive`: golden-file tests (snapshot in, action list out).
- Endpoint tests: full POST→poll→GET flow for resolve and for agent run.
- SSE tested by reading `Job.progress` directly (same source of truth as
  the SSE endpoint emits).
- Agent stubs: each kind asserted to produce a `done` job with the expected
  result shape.

No tests for the real MCP client (network + OAuth, not CI-testable). The
fixture client is fully covered.

## Minimum user input

The full input surface from landing page to a generated deliverable:

1. **One string** — company name or domain. Free-text, single input. On Enter.
2. **One click per agent run** — Run button on an action card.

That's the entire interaction surface. The user does not enter Peec
credentials, agent configuration, region/language, competitor lists, or
topic taxonomy. Everything else lives in the Peec project we resolve.

## Out of scope (this iteration)

- Real article/video/code-PR agent implementations.
- Real MCP client (OAuth 2.0 flow, MCP transport, token storage).
- User authentication / multi-tenant.
- Deep-link to Peec for project creation when no match is found.
- Refresh-on-demand UI.
- Background snapshot refresh on a schedule.

These all live behind the contracts defined here. Adding any of them is
additive — none requires reshaping the API or the data model.
