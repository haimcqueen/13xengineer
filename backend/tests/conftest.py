"""Shared test fixtures: an isolated SQLite engine, a session factory, a
TestClient with dependency_overrides, and helpers to seed Company / Action /
Job rows for router and agent tests.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app
from app.models import Action, Company, PeecSnapshot


@pytest.fixture
def db_engine():
    # StaticPool keeps a single shared in-memory connection so tables created
    # at fixture setup are visible to every session (including ones spawned by
    # FastAPI's dependency injection on a different thread).
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    return engine


@pytest.fixture
def db_session_factory(db_engine):
    return sessionmaker(bind=db_engine, autocommit=False, autoflush=False)


@pytest.fixture
def db(db_session_factory) -> Session:
    session = db_session_factory()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(db_session_factory):
    def override_get_db():
        db = db_session_factory()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as c:
            yield c
    finally:
        app.dependency_overrides.clear()


@pytest.fixture
def seeded_company(db: Session) -> Company:
    company = Company(
        id=f"co_{uuid.uuid4()}",
        peec_project_id=f"or_{uuid.uuid4()}",
        name="Test Company",
        own_domain="example.com",
        user_input="example.com",
        created_at=datetime.now(timezone.utc),
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


@pytest.fixture
def seeded_snapshot(db: Session, seeded_company: Company) -> PeecSnapshot:
    snap = PeecSnapshot(
        id=f"sn_{uuid.uuid4()}",
        company_id=seeded_company.id,
        prompts={"data": []},
        brands={
            "data": [
                {
                    "id": "b1",
                    "name": "Test Company",
                    "domains": ["example.com"],
                    "is_own": True,
                },
                {
                    "id": "b2",
                    "name": "Competitor One",
                    "domains": ["competitor1.com"],
                    "is_own": False,
                },
                {
                    "id": "b3",
                    "name": "Competitor Two",
                    "domains": ["competitor2.com"],
                    "is_own": False,
                },
            ]
        },
        topics={"data": []},
        tags={"data": []},
        models={"data": []},
    )
    db.add(snap)
    db.commit()
    db.refresh(snap)
    return snap


@pytest.fixture
def seeded_action(db: Session, seeded_company: Company, seeded_snapshot: PeecSnapshot) -> Action:
    action = Action(
        id=f"ac_{uuid.uuid4()}",
        company_id=seeded_company.id,
        snapshot_id=seeded_snapshot.id,
        category="owned_media",
        kind="code",
        title="Add Organization JSON-LD schema",
        rationale="Competitors expose Organization markup; we don't.",
        opportunity="high",
        target={"domain": "example.com", "schemas": ["Organization"]},
        suggested_agent="code-pr",
    )
    db.add(action)
    db.commit()
    db.refresh(action)
    return action
