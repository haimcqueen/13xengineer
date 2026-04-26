from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.db import Base, engine
from app.models import (  # noqa: F401 — register models
    Action,
    Company,
    Job,
    OAuthCredentials,
    PeecSnapshot,
    RepoConfig,
)
from app.routers import agents, companies, jobs, ping, repos


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="MIDAS API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(ping.router, prefix="/api")
app.include_router(companies.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(jobs.router, prefix="/api")
app.include_router(repos.router, prefix="/api")
