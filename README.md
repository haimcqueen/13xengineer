# Midas · by Peec

**Midas** is an AI-powered brand intelligence and content automation platform built on top of the [Peec.ai](https://peec.ai) API. It analyzes where a company is losing ground in AI-generated content, surfaces concrete improvement opportunities, and executes them autonomously through three specialized agents — turning overlooked brands into unavoidable ones.

Built for the Peec hackathon. Demo target: **Legora** (`legora.com`).

---

## Table of Contents

1. [How It Works](#how-it-works)
2. [Tech Stack](#tech-stack)
3. [Prerequisites](#prerequisites)
4. [Setup & Installation](#setup--installation)
5. [Environment Variables](#environment-variables)
6. [Running Locally](#running-locally)
7. [API Reference](#api-reference)
8. [Agents](#agents)
9. [Architecture Overview](#architecture-overview)
10. [Project Structure](#project-structure)
11. [External APIs & Tools](#external-apis--tools)

---

## How It Works

1. **Enter a company name** — Midas matches it against Peec's tracked projects.
2. **Analysis pipeline runs** — Midas fetches brand data (prompts, topics, models, brand share) from Peec's REST API and calls Peec's MCP server via Claude to derive structured action items.
3. **Workspace loads** — A prioritized feed of improvement opportunities appears, each tagged with the optimal agent to execute it.
4. **Run an agent** — Pick an action and trigger one of three agents. Midas streams live progress back over SSE:
   - **Michelangelo** (builder): Connects to your GitHub repo, analyzes your site, benchmarks competitors, and opens a PR with structured data, schema markup, and SEO fixes.
   - **Tolkien** (writer): Starts with your positioning, does deep keyword research, structures the argument, then writes a full publication-ready blog article. No filler — every sentence earns its place.
   - **Nolan** (director): Takes any whitepaper, presentation, or blog article and turns it into a visually compelling video of any length.

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Python 3.12+ |
| Web framework | FastAPI 0.115+ |
| ASGI server | Uvicorn |
| ORM | SQLAlchemy 2.0 (Mapped types) |
| Database | SQLite (file: `backend/app.db`) |
| Validation | Pydantic v2 + pydantic-settings |
| HTTP client | httpx |
| Streaming | sse-starlette (Server-Sent Events) |
| AI | Anthropic Claude SDK (`anthropic` >=0.40) |
| Web research | Exa (`exa-py` >=2.12) for site crawl, Tavily (`tavily-python` >=0.5) for live article research |
| Package manager | [uv](https://docs.astral.sh/uv/) |

### Frontend
| Layer | Technology |
|-------|-----------|
| Build tool | Vite 8 |
| Framework | React 19 + TypeScript 6 |
| Routing | React Router 7 |
| Styling | Tailwind CSS v4 (tokens in `index.css`, no config file) |
| Components | shadcn/ui (new-york style, Radix primitives) |
| Animation | Motion (Framer Motion v12) |
| 3D | Three.js + react-globe.gl |
| Icons | lucide-react |
| Markdown | react-markdown |

---

## Prerequisites

- **Python 3.12+** and [uv](https://docs.astral.sh/uv/) (`curl -LsSf https://astral.sh/uv/install.sh | sh`)
- **Node.js 20+** and npm
- A **Peec API key** (from your Peec dashboard)
- An **Anthropic API key** (for Claude — agents + MCP action analysis)
- An **Exa API key** (for the resolve pipeline's site crawl; optional but recommended)
- A **Tavily API key** (for live web research in Tolkien; optional but recommended)
- A **GitHub personal access token** (only required for the Code-PR agent)

---

## Setup & Installation

### 1. Clone the repository

```bash
git clone <repo-url>
cd 13xengineer
```

### 2. Configure environment variables

Create a `.env` file at the **project root** (not inside `backend/`):

```bash
cp .env.example .env
# then fill in your keys (see Environment Variables section)
```

### 3. Install backend dependencies

```bash
cd backend
uv sync
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

### 5. Connect to Peec MCP (one-time, optional but recommended)

Peec's REST API provides metadata (prompts, brands, topics). Real action items require Peec's MCP server, which is OAuth-gated:

```bash
cd backend
uv run python -m app.scripts.connect_peec
```

This opens a browser window, completes the OAuth PKCE flow, and stores tokens in `app.db`. After it completes, set `PEEC_USE_REAL_MCP=true` in your root `.env` and restart the backend.

> Without this step, Midas falls back to a pre-built fixture (`fixtures/legora_actions.json`) so the UI is never empty during demos.

---

## Environment Variables

All variables go in the **project root `.env`** (loaded by both the backend and `connect_peec`):

```env
# Required
PEEC_API_KEY=<your peec key>
ANTHROPIC_API_KEY=<your anthropic key>

# Optional but recommended
EXA_API_KEY=<your exa key>            # site crawl + brand intel for the resolve pipeline
TAVILY_API_KEY=<your tavily key>      # live web research for Tolkien (article agent)

# Peec MCP
PEEC_USE_REAL_MCP=false               # set to true after running connect_peec
PEEC_API_BASE=https://api.peec.ai/customer/v1
PEEC_MCP_URL=https://api.peec.ai/mcp
PEEC_OAUTH_METADATA_URL=https://api.peec.ai/.well-known/oauth-authorization-server/mcp
PEEC_OAUTH_REDIRECT_URI=http://localhost:8765/oauth/callback

# Backend
DATABASE_URL=sqlite:///./app.db
CORS_ORIGINS=["http://localhost:5173"]  # JSON array — keep the brackets
ANTHROPIC_MODEL=claude-sonnet-4-6       # Claude model used for all agents
SNAPSHOT_TTL_SECONDS=600               # how long to cache a company snapshot

# Code-PR agent (only needed if using the PR feature)
# GitHub token is configured per-company via PUT /api/companies/{id}/repo
```

---

## Running Locally

Open two terminals:

**Terminal 1 — Backend**
```bash
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

The FastAPI app starts at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

**Terminal 2 — Frontend**
```bash
cd frontend
npm run dev
```

The Vite dev server starts at `http://localhost:5173`. All `/api/*` requests are proxied to `:8000` via `vite.config.ts`.

Open `http://localhost:5173` in your browser.

### Other commands

```bash
# Backend
uv run pytest                          # run all tests
uv run pytest tests/test_agents_router.py::test_x  # single test
uv run ruff check .                    # lint
uv run ruff format .                   # format

# Frontend
npm run build                          # production build (tsc -b && vite build)
npm run lint                           # eslint
npx shadcn@latest add <component>      # add a shadcn/ui component
```

---

## API Reference

Base URL: `http://localhost:8000`

### Health

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Liveness check |
| GET | `/api/ping` | Returns `{ "message": "pong" }` |

### Companies

#### Resolve a company
```
POST /api/companies/resolve
```
Starts an async resolution job that matches the input against Peec's tracked projects, fetches brand data, and derives action items.

**Request body:**
```json
{ "input": "Legora" }
```

**Response (202):**
```json
{ "job_id": "uuid", "company_id": "uuid or null" }
```

---

#### Stream resolution progress (SSE)
```
GET /api/companies/resolve/stream?job_id=<uuid>
```
Server-Sent Events stream. Events arrive in order:

| Event type | Payload |
|-----------|---------|
| `project_matched` | `{ "name": str, "company_id": str }` |
| `prompts_loaded` | `{ "count": int }` |
| `brands_loaded` | `{ "count": int }` |
| `topics_loaded` | `{ "count": int }` |
| `actions_pending` | `{}` |
| `actions_loaded` | `{ "count": int }` |
| `done` | `{ "company_id": str }` |
| `error` | `{ "message": str }` |

---

#### Get company
```
GET /api/companies/{company_id}
```
**Response:**
```json
{
  "id": "uuid",
  "name": "Legora",
  "own_domain": "legora.com",
  "own_brand": "Legora",
  "topics": ["legal tech", "contract management"],
  "prompt_count": 42,
  "last_refreshed_at": "2024-01-01T00:00:00Z",
  "brand_stats": { "share": 0.34, "rank": 2, "trend": "up" },
  "market_stats": { "countries": 12, "languages": 5 },
  "total_chats": 8400
}
```

---

#### Get company actions
```
GET /api/companies/{company_id}/actions
```
**Response:** array of action objects:
```json
[
  {
    "id": "uuid",
    "category": "content",
    "kind": "blog_article",
    "title": "Write a guide on contract automation ROI",
    "rationale": "This topic ranks in 80+ prompts where Legora is absent",
    "opportunity": "high",
    "target": "https://legora.com/blog",
    "suggested_agent": "article"
  }
]
```

`suggested_agent` is one of: `"article"` | `"video"` | `"code-pr"` | `null`

---

#### Configure repository (Code-PR agent prerequisite)
```
PUT /api/companies/{company_id}/repo
```
```json
{
  "site_url": "https://legora.com",
  "repo_url": "https://github.com/org/repo",
  "default_branch": "main",
  "github_token": "ghp_..."
}
```

```
GET /api/companies/{company_id}/repo   # fetch current config
DELETE /api/companies/{company_id}/repo  # remove config
```

---

### Agents

#### Run an agent
```
POST /api/agents/{kind}/run
```

`kind` must be one of: `article`, `video`, `improvement`, `code-pr`

**Request body:**
```json
{
  "action_id": "uuid",
  "improvement_job_id": "uuid"   // required only for code-pr
}
```

**Response (202):**
```json
{ "job_id": "uuid" }
```

**Preconditions:**
- `improvement` and `code-pr` require a `RepoConfig` for the company (set via `PUT /api/companies/{id}/repo`).
- `code-pr` requires `improvement_job_id` pointing to a completed `improvement` job for the same action.

---

### Jobs

#### Poll job status
```
GET /api/jobs/{job_id}
```
**Response:**
```json
{
  "id": "uuid",
  "kind": "agent_run",
  "status": "done",
  "progress": {
    "events": [
      { "type": "thinking", "data": { "text": "Researching topic..." } },
      { "type": "draft_ready", "data": { "word_count": 1200 } }
    ]
  },
  "result": { ... },
  "error": null,
  "error_code": null
}
```

| `status` | Meaning |
|---------|---------|
| `pending` | Queued, not started |
| `running` | In progress |
| `done` | Completed successfully; `result` is populated |
| `failed` | Error occurred; `error` and `error_code` are set |

---

## Agents

### Michelangelo (Builder)
Analyzes a live website for AEO/SEO markup deficiencies and ships a GitHub pull request with the fixes.

**Flow:**
1. Fetches the target URL using Claude's `web_fetch` beta tool.
2. Audits Schema.org JSON-LD, meta tags, canonical/robots directives, and FAQ markup — benchmarking against competitors where available.
3. Forces a `submit_plan` tool call to produce a structured `ImprovementPlan` (list of file edits with before/after diffs).
4. Clones the repository, applies edits to a feature branch, and opens a GitHub PR with a structured description.

**Output:** GitHub PR URL.

**Scope:** Strictly AEO/SEO markup — Schema.org JSON-LD, meta tags, canonical, robots.txt, FAQ structured data. Does not modify application logic.

**Internal agent kinds:** `improvement` (analysis step) + `code-pr` (PR step)

---

### Tolkien (Writer)
Writes complete SEO/AEO-optimized blog articles that read like a human copywriter wrote them.

**Flow:**
1. **Brief** — Claude generates a keyword strategy, search intent analysis, and competitor gaps from the action's rationale and company positioning.
2. **Research** — pulls live web sources via **Tavily** (synthesized answer + ranked source list with snippets), then Claude folds those citations into a structured research doc.
3. **Outline** — Claude structures the argument (H2/H3 hierarchy, FAQ candidates, Quick Answer block for LLM citation).
4. **Write** — Claude writes the full 1,500–2,500 word article in markdown. Every sentence earns its place.

**Output:** Markdown article + metadata (title, word count, suggested slug, tags).

**Internal agent kind:** `article`

---

### Nolan (Director)
Turns any whitepaper, presentation, or blog article into a visually compelling video of any length.

Trained on 50+ top-performing YouTube channels for hooks, pacing, and style — with its own built-in taste. Built to address the Hera challenge: the most engaging content is video.

**Internal agent kind:** `video`

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│   React 19 + Vite · Tailwind v4 · shadcn/ui · Motion       │
└───────────────────────────┬─────────────────────────────────┘
                            │ /api/* (Vite proxy in dev)
┌───────────────────────────▼─────────────────────────────────┐
│                  FastAPI (port 8000)                        │
│                                                             │
│  POST /companies/resolve  ──►  ResolveService               │
│         │                         │                         │
│         │                    ┌────▼─────────────────────┐   │
│         │                    │  1. company_match        │   │
│         │                    │  2. peec_rest (parallel) │   │
│         │                    │  3. peec_mcp + Claude    │   │
│         │                    │  4. persist snapshot     │   │
│         │                    └──────────────────────────┘   │
│                                                             │
│  POST /agents/{kind}/run  ──►  AgentRegistry.dispatch()     │
│         │                         │                         │
│         │              ┌──────────▼──────────┐              │
│         │              │  jobs_svc            │              │
│         │              │  asyncio.create_task │              │
│         │              └──────────────────────┘              │
│                                                             │
│  GET /jobs/{id}  ──►  Job.progress["events"]  (polling)    │
│  GET /companies/resolve/stream  ──►  SSE                    │
│                                                             │
│  SQLite (app.db)                                            │
│  Companies · Snapshots · Actions · Jobs · RepoConfigs       │
└─────────────────────────────────────────────────────────────┘
                            │
          ┌─────────────────┼──────────────────┐
          │                 │                  │
    ┌─────▼──────┐  ┌───────▼──────┐  ┌───────▼──────┐
    │ Peec REST  │  │ Peec MCP     │  │ Anthropic    │
    │ (metadata) │  │ (OAuth/PKCE) │  │ Claude API   │
    └────────────┘  └──────────────┘  └──────────────┘
                                              │
                                       ┌──────▼──────┐
                                       │  Exa Search │
                                       └─────────────┘
```

### Resolve Pipeline (cold path)

```
user input
    │
    ▼
company_match.resolve()       ← fuzzy-matches Peec tracked projects
    │
    ▼
[parallel] peec_rest fetches  ← prompts, brands, topics, tags, models
    │
    ▼
peec_mcp.get_actions()        ← Claude + MCP → forced submit_actions tool call
    │  (falls back to legora_actions.json fixture if MCP unavailable)
    ▼
peec_actions.derive()         ← normalizes into Action rows
    │
    ▼
persist PeecSnapshot + Actions
    │
    ▼
stream SSE events to frontend
```

Snapshots are TTL-cached (default 600s). A cache hit replays the same SSE event sequence so the frontend code path is identical.

### Background Job Pattern

All long-running work goes through `services/jobs.py`:

```python
job = create_job(db, kind="agent_run", ...)
run_in_background(lambda: agent.run(...), job_id)
# → asyncio.create_task with own DB session
# → marks job running → done/failed
# → appends typed events to job.progress["events"]
```

Both the SSE endpoint and the `GET /api/jobs/{id}` poll endpoint read from the same event log, making reconnection safe.

---

## Project Structure

```
13xengineer/
├── .env                        # project root env vars (gitignored)
├── backend/
│   ├── pyproject.toml          # Python deps + tool config
│   ├── app/
│   │   ├── main.py             # FastAPI app, lifespan, router mounts
│   │   ├── config.py           # Settings (pydantic-settings)
│   │   ├── db.py               # SQLAlchemy engine + get_db
│   │   ├── models.py           # SQLAlchemy models (Company, Action, Job, ...)
│   │   ├── schemas.py          # Pydantic request/response schemas
│   │   ├── routers/
│   │   │   ├── companies.py    # /api/companies/*
│   │   │   ├── agents.py       # /api/agents/*
│   │   │   ├── jobs.py         # /api/jobs/*
│   │   │   ├── repos.py        # /api/companies/{id}/repo
│   │   │   └── ping.py         # /api/ping
│   │   ├── agents/
│   │   │   ├── base.py         # Agent protocol
│   │   │   ├── registry.py     # kind → agent mapping
│   │   │   ├── article.py      # ArticleAgent (Claude + Exa)
│   │   │   ├── improvement.py  # ImprovementAgent (Claude + web_fetch)
│   │   │   ├── code_pr.py      # CodePrAgent (git + GitHub API)
│   │   │   └── video.py        # VideoAgent (stub)
│   │   ├── services/
│   │   │   ├── resolve.py      # resolve pipeline orchestration
│   │   │   ├── company_match.py
│   │   │   ├── peec_rest.py    # Peec REST client
│   │   │   ├── peec_mcp.py     # Peec MCP client wrapper
│   │   │   ├── peec_oauth.py   # OAuth PKCE flow + token storage
│   │   │   ├── peec_actions.py # action derivation + normalization
│   │   │   ├── git_ops.py      # clone, commit, push, open PR
│   │   │   ├── site_intel.py   # live site scraping
│   │   │   ├── jobs.py         # background job management
│   │   │   └── mock_reports.py # synthetic reports for non-Peec paths
│   │   ├── scripts/
│   │   │   └── connect_peec.py # one-time OAuth setup
│   │   └── fixtures/
│   │       └── legora_actions.json  # MCP fallback fixture
│   └── tests/
│       ├── conftest.py         # in-memory SQLite, TestClient, seeded fixtures
│       └── test_*.py
├── frontend/
│   ├── package.json
│   ├── vite.config.ts          # /api proxy → :8000
│   ├── src/
│   │   ├── App.tsx             # BrowserRouter, single route
│   │   ├── index.css           # Tailwind v4 + design tokens + glass utilities
│   │   ├── routes/
│   │   │   └── Home.tsx        # view switcher (Entry → Resolving → Workspace)
│   │   ├── views/
│   │   │   ├── EntryView.tsx   # company search input
│   │   │   ├── ResolvingView.tsx # SSE progress stream UI
│   │   │   ├── Workspace.tsx   # main insights + agent run UI
│   │   │   ├── InsightsView.tsx
│   │   │   └── NoMatchView.tsx
│   │   ├── components/
│   │   │   ├── ActionCard.tsx
│   │   │   ├── ActionFeed.tsx
│   │   │   ├── AgentRunPanel.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MarketGlobe.tsx  # Three.js 3D globe
│   │   │   ├── BrandRanking.tsx
│   │   │   ├── studio/
│   │   │   │   ├── StudioBlog.tsx
│   │   │   │   ├── StudioWebsite.tsx
│   │   │   │   └── StudioVideo.tsx
│   │   │   └── ui/             # shadcn/ui generated primitives
│   │   └── lib/
│   │       ├── api.ts          # fetch wrapper (VITE_API_BASE)
│   │       ├── types.ts        # TypeScript interfaces
│   │       ├── mockBackend.ts  # deterministic demo data
│   │       ├── agentIdentity.ts
│   │       ├── deliverables.ts
│   │       └── utils.ts        # cn() helper
└── docs/
    └── frontend-integration.md  # full frontend↔backend contract
```

---

## External APIs & Tools

| Service | Purpose | Required |
|---------|---------|---------|
| [Peec REST API](https://peec.ai) | Brand data — prompts, brands, topics, market share | Yes |
| [Peec MCP Server](https://peec.ai) | AI-powered action generation via OAuth-gated MCP | No (fixture fallback) |
| [Anthropic Claude API](https://anthropic.com) | All AI generation — Tolkien articles, Michelangelo improvement plans, action analysis | Yes |
| [Exa Search](https://exa.ai) | Site crawl + brand intel for the resolve pipeline (`services/site_intel.py`) | Recommended |
| [Tavily Search](https://tavily.com) | Live web research feeding Tolkien's research stage (`services/tavily.py`) | Recommended |
| GitHub API | Open pull requests from Michelangelo (via personal access token) | Only for Michelangelo |

### Claude usage
- **Resolve pipeline**: Claude calls Peec MCP tools and produces structured actions via a forced `submit_actions` tool call.
- **Michelangelo**: Claude fetches the live site (via `web_fetch` beta tool) and produces a structured `ImprovementPlan` via a forced `submit_plan` tool call; a second Claude call generates the PR description.
- **Tolkien**: Claude writes the full blog article from an Exa-researched brief.
- **Default model**: `claude-sonnet-4-6` (configurable via `ANTHROPIC_MODEL`).

### Fallback behavior
- If Peec MCP is unavailable: `FallbackMCPClient` serves actions from `fixtures/legora_actions.json`.
- If Exa is unconfigured: the resolve pipeline still produces a `SiteIntel` containing the normalized domain so the SSE stream completes.
- If Tavily is unconfigured (or errors out): `services/tavily.py` returns an empty result and Tolkien falls back to Claude-only research without breaking the pipeline.
