# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project nature

Hackathon project ("Midas · by Peec"). Lean toward shipping working features over production-grade refactors — skip CI/deployment/auth ceremony unless explicitly asked. Demo target is **Legora** (`legora.com`); other tracked companies are BMW, Revolut, Mindspace, Nothing Phone.

The product surface presents three named agents — **Michelangelo** (builder, maps to internal `improvement` + `code-pr` kinds), **Tolkien** (writer, `article`), and **Nolan** (director, `video`). The character names are display-only; routes, registry keys, DB columns, and agent-kind enums all use the internal strings. Don't rename them in code without updating the API contract.

## Commands

Backend (`backend/`, Python 3.12+, managed by [uv](https://docs.astral.sh/uv/)):

```bash
uv sync                                              # install deps
uv run uvicorn app.main:app --reload --port 8000     # dev server
uv run pytest                                        # run tests (asyncio_mode=auto)
uv run pytest tests/test_agents_router.py::test_x   # single test
uv run ruff check .                                  # lint (line-length 100, py312)
uv run ruff format .                                 # format
```

Frontend (`frontend/`, Vite 8 + React 19 + TS 6):

```bash
npm install
npm run dev          # Vite dev server on :5173, proxies /api -> :8000
npm run build        # tsc -b && vite build
npm run lint         # eslint (flat config)
npx shadcn@latest add <component>   # add shadcn/ui component
```

There is no test runner wired up on the frontend.

Run backend and frontend in two separate terminals; the Vite dev proxy (`vite.config.ts`) only resolves `/api/*` calls when uvicorn is up on port 8000.

### One-time Peec MCP connect

REST gives metadata only (prompts/brands/topics/tags/models). Actions/sources/citations require Peec's MCP server, which is OAuth-gated. After `uv sync`:

```bash
cd backend
uv run python -m app.scripts.connect_peec   # opens browser, stores OAuth tokens in app.db
```

Then set `PEEC_USE_REAL_MCP=true` in the **project root** `.env` and restart uvicorn. Without this, `peec_actions.derive` falls back to `fixtures/legora_actions.json` (Legora-only) plus a tiny synthetic action set so the UI is never empty.

## Architecture

### Backend (`backend/app/`)

FastAPI app composed in `main.py`:
- **Lifespan** runs `Base.metadata.create_all(bind=engine)` — schema is created on startup directly from SQLAlchemy 2.0 models (`Mapped[...]` style), no Alembic. New models must be imported at the top of `main.py` (or otherwise reachable from `Base.metadata`) before they will be created.
- **Routers** live in `app/routers/` and are all mounted under `/api`: `ping`, `companies`, `agents`, `jobs`, `repos`. Add a new router by creating `app/routers/<name>.py` exporting `router = APIRouter()`, then `include_router` in `main.py`.
- **Settings**: `app.config.settings` is the single source — read env vars via `Settings` fields, not `os.getenv`. `Settings` reads from `("../.env", ".env")` so the root `.env` and `backend/.env` both work; root is canonical.
- **DB session**: inject `db: Session = Depends(get_db)` from `app.db`. For background work that outlives the request, use `SessionLocal()` directly and close it (see `services/jobs.py`).
- **Schemas** (Pydantic v2) live in `schemas.py`. Wire request/response models on routes via `response_model=...`.

The frontend↔backend contract is documented in `docs/frontend-integration.md` — keep it in sync when changing routes/payloads.

#### Resolve pipeline (`POST /api/companies/resolve`)

`services/resolve.py` runs the cold path:
1. `company_match.resolve(input)` — match user input against Peec's tracked projects.
2. Parallel REST fetches (`peec_rest.PeecRestClient`): prompts, brands, topics, tags, models.
3. `peec_mcp.get_mcp_client().get_actions(project_id)` — Claude+MCP analyses the project and emits structured actions via a forced `submit_actions` tool call. `FallbackMCPClient` tries real MCP first, falls back to the fixture on empty/timeout/error.
4. Persist a `PeecSnapshot` + derived `Action` rows (`peec_actions.derive`).

Snapshots are TTL-cached (`settings.snapshot_ttl_seconds`, default 600s). `find_fresh_company` short-circuits the pipeline; `hydrate_cache_hit_job` replays the same SSE event sequence so the frontend doesn't branch.

#### Background jobs

`services/jobs.py` is the single place where async tasks are spawned:
- `create_job(...)` writes a `Job` row.
- `run_in_background(coro_factory, job_id)` calls `asyncio.create_task` with a runner that owns its own DB session, marks the job `running`/`done`/`failed`, and catches all exceptions as `internal_error`.
- `append_event(db, job_id, type, data)` appends to `Job.progress["events"]`. Both the SSE endpoint (`/api/companies/resolve/stream`) and the poll endpoint (`/api/jobs/{id}`) read from this column — events are replayable and reconnect-safe.

When adding a new long-running flow, route through `jobs_svc` rather than spawning tasks directly.

#### Agents (`app/agents/`)

Pluggable executors registered in `agents/registry.py`. Current agents: `article`, `video` (stubs), `improvement`, `code-pr`. Each implements the `Agent` protocol (`base.py`) — an async `run(action, company, **kwargs) -> dict`. The `agents` router dispatches by `kind`, validates preconditions, and wraps the call in `jobs_svc.run_in_background`.

Two non-obvious constraints in `routers/agents.py`:
- `improvement` and `code-pr` require a `RepoConfig` for the company (`PUT /api/companies/{id}/repo` first); router returns 400 `repo_not_configured` otherwise.
- `code-pr` is a follow-on executor — it requires `improvement_job_id` pointing to a *completed* `improvement` job for the same action; it reads `ImprovementPlan` from that job's `result`, applies edits via `services/git_ops.py`, pushes a feature branch, and opens a PR.

`ImprovementAgent` calls Claude with the `web_fetch` beta tool plus a forced `submit_plan` tool call; its prompt is scoped strictly to AEO/SEO markup edits (Schema.org JSON-LD, meta tags, canonical/robots, FAQ). When extending, keep the scope tight — don't broaden it into general code changes.

#### Tests (`backend/tests/`)

`conftest.py` provides:
- `db_engine` — in-memory SQLite with `StaticPool` (single shared connection so FastAPI's threaded sessions see fixture-created rows).
- `client` — `TestClient` with `app.dependency_overrides[get_db]` wired to the in-memory factory.
- `seeded_company` / `seeded_snapshot` / `seeded_action` — minimal fixture chain for router/agent tests.

`pytest-asyncio` runs in `auto` mode (`pyproject.toml`) — async tests don't need `@pytest.mark.asyncio`.

### Frontend (`frontend/src/`)

Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui ("new-york" style, neutral base).
- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`).
- **shadcn aliases** (`components.json`): `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Generated UI primitives go under `@/components/ui` — do not put hand-written app components there.
- **Routing**: React Router 7 in `App.tsx`. Currently only `/` → `routes/Home.tsx`.
- **View pattern**: `Home.tsx` swaps between `EntryView` → `ResolvingView` → `Workspace` (with `NoMatchView` as the failure branch) via `AnimatePresence` from `motion/react`.
- **Data layer is currently mocked**: `lib/mockBackend.ts` returns a deterministic `CompanyOut` + `ActionOut[]` for the demo set. The real backend contract (resolve / SSE / company / actions / agents / jobs) is documented in `docs/frontend-integration.md` — wire `lib/api.ts` against that when replacing the mock.
- **API client**: `lib/api.ts` exposes `api<T>(path, init?)` which prepends `import.meta.env.VITE_API_BASE` (empty in dev — relies on the Vite proxy). Use this rather than raw `fetch`.
- **Tailwind v4** is loaded via `@import "tailwindcss"` in `src/index.css`. There is no `tailwind.config.js`; theme tokens are defined in `@theme inline { ... }` inside `index.css`.
- **Design system** lives in `src/index.css`: brand palette (ink/plum/lavender/rose/blue), `--font-display` (Fraunces), `--font-sans` (Onest), `--font-mono` (JetBrains Mono — fonts are loaded from Google Fonts in `index.html`), plus `.glass` / `.glass-strong` (liquid-glass surfaces) and `.grain` (overlay) component classes. Reuse these tokens/utilities rather than introducing new ad-hoc colors.
- **Class merging**: use `cn(...)` from `@/lib/utils` (clsx + tailwind-merge).

## Environment

`.env` lives at the **project root** (loaded by both backend Settings and `connect_peec`):

```
PEEC_API_KEY=<your peec key>
ANTHROPIC_API_KEY=<your anthropic key>
PEEC_USE_REAL_MCP=false           # flip to true after running connect_peec
DATABASE_URL=sqlite:///./app.db
CORS_ORIGINS=["http://localhost:5173"]
```

`CORS_ORIGINS` is parsed as JSON by pydantic-settings, so keep the list-syntax brackets. The SQLite file (`backend/app.db`) is created on first run and gitignored; it stores Companies/Snapshots/Actions/Jobs/RepoConfigs and the OAuth tokens written by `connect_peec`.

## Blog pipeline (separate workflow)

The `.claude/commands/blog-*` slash commands and `.claude/agents/blog-*` agents drive a multi-step blog generation pipeline that writes drafts into `blog/content/drafts/`. SEO/AEO rules live in `.claude/rules/blog-seo.md`. Image generation scripts are under `scripts/`. This is independent of the Midas product code — touch it only when working on blog content.
