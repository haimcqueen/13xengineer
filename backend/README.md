# Backend

FastAPI + SQLAlchemy + SQLite, managed by [uv](https://docs.astral.sh/uv/).

## Setup

```bash
uv sync
```

## Run

```bash
uv run uvicorn app.main:app --reload --port 8000
```

- Health: http://localhost:8000/health
- API docs: http://localhost:8000/docs
- Ping: http://localhost:8000/api/ping
