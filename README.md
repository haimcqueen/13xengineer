# 13xengineer

Hackathon skeleton: FastAPI backend + Vite/React/TypeScript/Tailwind/shadcn frontend.

## Stack

- **Backend** — FastAPI, SQLAlchemy, SQLite, Pydantic v2, managed with [uv](https://docs.astral.sh/uv/)
- **Frontend** — Vite + React 19 + TypeScript, Tailwind v4, shadcn/ui, React Router

## Layout

```
backend/    FastAPI app (port 8000)
frontend/   Vite app    (port 5173)
```

## Running locally

Two terminals:

```bash
# terminal 1
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```

```bash
# terminal 2
cd frontend
npm install
npm run dev
```

Then open http://localhost:5173. The home page calls `GET /api/ping` through the Vite dev proxy and renders the response.

## Endpoints

- `GET /health` — liveness
- `GET /api/ping` — returns `{ "message": "pong" }`
- `GET /docs` — FastAPI Swagger UI

See `docs/frontend-integration.md` for the full Felix endpoint contract
(company resolve, actions, agent runs, jobs).

## Connecting to Peec (one-time)

The backend uses Peec's REST API by default (metadata only — no Actions).
To get real Actions via Peec's MCP server, do this once after `uv sync`:

```bash
cd backend
uv run python -m app.scripts.connect_peec
```

This opens your browser, logs you into Peec, and stores OAuth tokens in
SQLite. Then set `PEEC_USE_REAL_MCP=true` in the project root `.env` and
restart uvicorn. The Action panel will be populated by Claude calling
Peec's MCP tools rather than the Legora fixture.

Required env vars (in project root `.env`):

```
PEEC_API_KEY=<your peec key>
ANTHROPIC_API_KEY=<your anthropic key>
PEEC_USE_REAL_MCP=false   # flip to true after running connect_peec
```

## Adding shadcn components

```bash
cd frontend
npx shadcn@latest add <component>
```
