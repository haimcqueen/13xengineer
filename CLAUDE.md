# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project nature

Hackathon project ("Felix · by Peec"). Lean toward shipping working features over production-grade refactors — skip CI/deployment/auth ceremony unless explicitly asked.

## Commands

Backend (`backend/`, Python 3.12+, managed by [uv](https://docs.astral.sh/uv/)):

```bash
uv sync                                              # install deps
uv run uvicorn app.main:app --reload --port 8000     # dev server
uv run pytest                                        # run tests (pytest + httpx are dev deps)
uv run pytest path/to/test_x.py::test_name           # single test
uv run ruff check .                                  # lint (line-length 100, py312)
uv run ruff format .                                 # format
```

Frontend (`frontend/`, Node, Vite 8 + React 19 + TS 6):

```bash
npm install
npm run dev          # Vite dev server on :5173, proxies /api -> :8000
npm run build        # tsc -b && vite build
npm run lint         # eslint (flat config)
npx shadcn@latest add <component>   # add shadcn/ui component
```

There is no test runner wired up on the frontend.

Run backend and frontend in two separate terminals; the Vite dev proxy (`vite.config.ts`) only resolves `/api/*` calls when uvicorn is up on port 8000.

## Architecture

### Backend (`backend/app/`)

FastAPI app composed in `main.py`:
- **Lifespan** runs `Base.metadata.create_all(bind=engine)` — schema is created on startup directly from SQLAlchemy models, no Alembic. New models must be imported into `app.models` (or otherwise reachable from `Base.metadata`) before they will be created.
- **CORS** origins come from `settings.cors_origins` (`.env` → `pydantic_settings`). Defaults to `http://localhost:5173`.
- **Routers** live in `app/routers/` and are mounted under `/api` (see `app.include_router(ping.router, prefix="/api")`). Add a new router by creating `app/routers/<name>.py` exporting `router = APIRouter()`, then `include_router` it in `main.py`.
- **DB session** via `app.db.get_db` — inject as a FastAPI dependency: `db: Session = Depends(get_db)`.
- **Models** use SQLAlchemy 2.0 `DeclarativeBase` + `Mapped[...]` style (see the example comment in `models.py`).
- **Schemas** (Pydantic v2) live in `schemas.py`. Wire request/response models on routes via `response_model=...`.
- **Settings**: `app.config.settings` is the single source — read env vars via `Settings` fields, not `os.getenv`.

### Frontend (`frontend/src/`)

Vite + React 19 + TypeScript + Tailwind v4 + shadcn/ui ("new-york" style, neutral base).
- **Path alias**: `@/*` → `src/*` (configured in both `tsconfig.app.json` and `vite.config.ts`).
- **shadcn aliases** (`components.json`): `@/components`, `@/components/ui`, `@/lib`, `@/lib/utils`, `@/hooks`. Generated UI primitives go under `@/components/ui` — do not put hand-written app components there.
- **Routing**: React Router 7 in `App.tsx`. Currently only `/` → `routes/Home.tsx`.
- **View pattern**: `Home.tsx` swaps between `views/EntryView` and `views/InsightsView` via `AnimatePresence` from `motion/react`. The data flow is currently mock: `lib/mockInsights.ts` deterministically generates an `Insights` object from the user's input — there is no backend call yet for this flow.
- **API client**: `lib/api.ts` exposes `api<T>(path, init?)` which prepends `import.meta.env.VITE_API_BASE` (empty in dev — relies on the Vite proxy). Use this rather than raw `fetch`.
- **Tailwind v4** is loaded via `@import "tailwindcss"` in `src/index.css`. There is no `tailwind.config.js`; theme tokens are defined in `@theme inline { ... }` inside `index.css`.
- **Design system** lives in `src/index.css`: brand palette (ink/plum/lavender/rose/blue), `--font-display` (Fraunces), `--font-sans` (Onest), `--font-mono` (JetBrains Mono — fonts are loaded from Google Fonts in `index.html`), plus `.glass` / `.glass-strong` (liquid-glass surfaces) and `.grain` (overlay) component classes. Reuse these tokens/utilities rather than introducing new ad-hoc colors.
- **Class merging**: use `cn(...)` from `@/lib/utils` (clsx + tailwind-merge).

## Environment

`backend/.env.example`:
```
DATABASE_URL=sqlite:///./app.db
CORS_ORIGINS=["http://localhost:5173"]
```
The SQLite file (`backend/app.db`) is created on first run and gitignored. `CORS_ORIGINS` is parsed as JSON by pydantic-settings, so keep the list-syntax brackets.
