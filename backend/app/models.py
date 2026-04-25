from datetime import datetime, timezone

from sqlalchemy import JSON, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Company(Base):
    __tablename__ = "companies"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    peec_project_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    name: Mapped[str] = mapped_column(String)
    own_domain: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    user_input: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)


class PeecSnapshot(Base):
    __tablename__ = "peec_snapshots"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    fetched_at: Mapped[datetime] = mapped_column(default=_utcnow)

    prompts: Mapped[dict] = mapped_column(JSON)
    brands: Mapped[dict] = mapped_column(JSON)
    topics: Mapped[dict] = mapped_column(JSON)
    tags: Mapped[dict] = mapped_column(JSON)
    models: Mapped[dict] = mapped_column(JSON)
    mcp_actions_raw: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class Action(Base):
    __tablename__ = "actions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    company_id: Mapped[str] = mapped_column(ForeignKey("companies.id"), index=True)
    snapshot_id: Mapped[str] = mapped_column(ForeignKey("peec_snapshots.id"))

    category: Mapped[str] = mapped_column(String)
    kind: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    rationale: Mapped[str | None] = mapped_column(String, nullable=True)
    opportunity: Mapped[str] = mapped_column(String)
    target: Mapped[dict] = mapped_column(JSON)
    suggested_agent: Mapped[str | None] = mapped_column(String, nullable=True)


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    kind: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)

    company_id: Mapped[str | None] = mapped_column(
        ForeignKey("companies.id"), nullable=True
    )
    action_id: Mapped[str | None] = mapped_column(
        ForeignKey("actions.id"), nullable=True
    )
    agent_kind: Mapped[str | None] = mapped_column(String, nullable=True)

    progress: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    result: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    error: Mapped[str | None] = mapped_column(String, nullable=True)
    error_code: Mapped[str | None] = mapped_column(String, nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)


class OAuthCredentials(Base):
    __tablename__ = "oauth_credentials"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    provider: Mapped[str] = mapped_column(String, unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String)
    access_token: Mapped[str] = mapped_column(String)
    refresh_token: Mapped[str | None] = mapped_column(String, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(nullable=True)
    scope: Mapped[str | None] = mapped_column(String, nullable=True)
    token_endpoint: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(default=_utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=_utcnow, onupdate=_utcnow)
