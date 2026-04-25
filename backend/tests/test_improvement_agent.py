"""Unit tests for ImprovementAgent.

Anthropic SDK is mocked. git_ops.clone is monkeypatched to return a
pre-populated temp dir so the file-tree + inline-content logic runs for real.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from app.agents.improvement import ImprovementAgent, ImprovementError
from app.models import RepoConfig
from app.services import git_ops, jobs as jobs_svc


def _make_anthropic_mock(plan: dict):
    response = SimpleNamespace(
        stop_reason="tool_use",
        content=[
            SimpleNamespace(type="tool_use", name="submit_plan", input=plan),
        ],
        usage=SimpleNamespace(input_tokens=100, output_tokens=50, cache_read_input_tokens=0),
    )
    create = AsyncMock(return_value=response)
    return SimpleNamespace(beta=SimpleNamespace(messages=SimpleNamespace(create=create))), create


def _build_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "felix-repo-test" / "repo"
    repo.mkdir(parents=True)
    (repo / "index.html").write_text(
        "<html><head><title>Test</title></head><body></body></html>",
        encoding="utf-8",
    )
    (repo / "package.json").write_text('{"name":"x"}', encoding="utf-8")
    (repo / "src").mkdir()
    (repo / "src" / "layout.tsx").write_text(
        "export default function Layout(){return <div/>}", encoding="utf-8"
    )
    return repo


@pytest.mark.asyncio
async def test_raises_when_no_repo_configured(db, seeded_action, seeded_company):
    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
    )
    agent = ImprovementAgent(anthropic_client=SimpleNamespace())
    with pytest.raises(ImprovementError) as exc_info:
        await agent.run(seeded_action, seeded_company, db=db, job_id=job.id)
    assert exc_info.value.code == "repo_not_configured"


@pytest.mark.asyncio
async def test_happy_path_returns_validated_plan(
    db, seeded_action, seeded_company, seeded_snapshot, monkeypatch, tmp_path
):
    # Configure repo
    db.add(
        RepoConfig(
            id=f"rc_{uuid.uuid4()}",
            company_id=seeded_company.id,
            site_url="https://example.com",
            repo_url="https://github.com/octo/example",
            default_branch="main",
            github_token="tok",
        )
    )
    db.commit()

    repo_dir = _build_repo(tmp_path)

    async def fake_clone(repo_url, token, *, depth=1):
        assert repo_url == "https://github.com/octo/example"
        assert token == "tok"
        return repo_dir

    cleanups: list[Path] = []
    monkeypatch.setattr(git_ops, "clone", fake_clone)
    monkeypatch.setattr(git_ops, "cleanup", lambda p: cleanups.append(p))

    plan = {
        "summary": "Add Organization JSON-LD",
        "rationale": "Competitors expose Organization markup; we don't.",
        "expected_impact": "Improves AI search visibility for branded queries.",
        "edits": [
            {
                "file_path": "index.html",
                "change_type": "modify",
                "description": "Inject Organization JSON-LD into <head>.",
                "content": "<html><head><script type='application/ld+json'>{}</script></head></html>",
            }
        ],
    }
    mock_client, create_mock = _make_anthropic_mock(plan)

    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
    )

    agent = ImprovementAgent(anthropic_client=mock_client)
    result = await agent.run(seeded_action, seeded_company, db=db, job_id=job.id)

    # Plan is validated and returned as a dict matching ImprovementPlan
    assert result["summary"] == plan["summary"]
    assert result["rationale"] == plan["rationale"]
    assert len(result["edits"]) == 1
    assert result["edits"][0]["file_path"] == "index.html"

    # Cleanup happened
    assert cleanups == [repo_dir]

    # Anthropic was called once with web_fetch + submit_plan tools
    create_mock.assert_called_once()
    call_kwargs = create_mock.call_args.kwargs
    tool_names = {t.get("name") for t in call_kwargs["tools"]}
    assert "web_fetch" in tool_names
    assert "submit_plan" in tool_names
    # Competitor URLs should be derived from snapshot.brands (is_own=False)
    user_msg = call_kwargs["messages"][0]["content"]
    assert "https://competitor1.com" in user_msg
    assert "https://competitor2.com" in user_msg
    # Site URL from RepoConfig must be in the prompt (not company.own_domain)
    assert "https://example.com" in user_msg

    # Progress events recorded in order
    db.refresh(job)
    event_types = [e["type"] for e in job.progress["events"]]
    assert "cloning_repo" in event_types
    assert "repo_summarized" in event_types
    assert "analyzing" in event_types
    assert "plan_ready" in event_types


@pytest.mark.asyncio
async def test_raises_when_claude_does_not_call_submit_plan(
    db, seeded_action, seeded_company, seeded_snapshot, monkeypatch, tmp_path
):
    db.add(
        RepoConfig(
            id=f"rc_{uuid.uuid4()}",
            company_id=seeded_company.id,
            site_url="https://example.com",
            repo_url="https://github.com/octo/example",
            default_branch="main",
            github_token="tok",
        )
    )
    db.commit()

    repo_dir = _build_repo(tmp_path)
    monkeypatch.setattr(git_ops, "clone", AsyncMock(return_value=repo_dir))
    monkeypatch.setattr(git_ops, "cleanup", lambda p: None)

    # Response with no submit_plan tool use
    response = SimpleNamespace(
        stop_reason="end_turn",
        content=[SimpleNamespace(type="text", text="hello")],
        usage=SimpleNamespace(input_tokens=1, output_tokens=1, cache_read_input_tokens=0),
    )
    mock_client = SimpleNamespace(
        beta=SimpleNamespace(messages=SimpleNamespace(create=AsyncMock(return_value=response)))
    )

    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
    )
    agent = ImprovementAgent(anthropic_client=mock_client)
    with pytest.raises(ImprovementError) as exc_info:
        await agent.run(seeded_action, seeded_company, db=db, job_id=job.id)
    assert exc_info.value.code == "no_plan_submitted"


@pytest.mark.asyncio
async def test_raises_when_plan_fails_validation(
    db, seeded_action, seeded_company, seeded_snapshot, monkeypatch, tmp_path
):
    db.add(
        RepoConfig(
            id=f"rc_{uuid.uuid4()}",
            company_id=seeded_company.id,
            site_url="https://example.com",
            repo_url="https://github.com/octo/example",
            default_branch="main",
            github_token="tok",
        )
    )
    db.commit()

    repo_dir = _build_repo(tmp_path)
    monkeypatch.setattr(git_ops, "clone", AsyncMock(return_value=repo_dir))
    monkeypatch.setattr(git_ops, "cleanup", lambda p: None)

    # Bad plan: missing required fields
    bad_plan = {"summary": "x", "edits": []}
    mock_client, _ = _make_anthropic_mock(bad_plan)

    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
    )
    agent = ImprovementAgent(anthropic_client=mock_client)
    with pytest.raises(ImprovementError) as exc_info:
        await agent.run(seeded_action, seeded_company, db=db, job_id=job.id)
    assert exc_info.value.code == "plan_invalid"
