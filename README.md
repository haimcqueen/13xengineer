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

## Adding shadcn components

```bash
cd frontend
npx shadcn@latest add <component>
```
