"""Unit tests for CodePrAgent.

git_ops is monkeypatched. We verify the agent loads the plan from the
improvement job, applies edits to a real temp dir, and calls open_pull_request
with the expected arguments.
"""

from __future__ import annotations

import uuid
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

from app.agents.code_pr import CodePrAgent, CodePrError
from app.models import RepoConfig
from app.services import git_ops, jobs as jobs_svc


_VALID_PLAN = {
    "summary": "Add Organization JSON-LD",
    "rationale": "Competitors expose Organization markup; we don't.",
    "expected_impact": "Improves brand entity recognition.",
    "edits": [
        {
            "file_path": "index.html",
            "change_type": "modify",
            "description": "Add JSON-LD",
            "content": "<html><head><script type='application/ld+json'>{}</script></head></html>",
        }
    ],
}


@pytest.fixture
def repo_with_index(tmp_path):
    repo = tmp_path / "felix-repo-x" / "repo"
    repo.mkdir(parents=True)
    (repo / "index.html").write_text("<html></html>", encoding="utf-8")
    return repo


@pytest.fixture
def configured_repo(db, seeded_company):
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


@pytest.mark.asyncio
async def test_raises_when_improvement_job_missing(
    db, seeded_action, seeded_company, configured_repo
):
    job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="code-pr",
    )
    agent = CodePrAgent()
    with pytest.raises(CodePrError) as exc_info:
        await agent.run(
            seeded_action,
            seeded_company,
            db=db,
            job_id=job.id,
            improvement_job_id="j_does_not_exist",
        )
    assert exc_info.value.code == "improvement_job_missing"


@pytest.mark.asyncio
async def test_raises_when_improvement_not_done(db, seeded_action, seeded_company, configured_repo):
    imp_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
        initial_status="running",
    )
    code_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="code-pr",
    )
    agent = CodePrAgent()
    with pytest.raises(CodePrError) as exc_info:
        await agent.run(
            seeded_action,
            seeded_company,
            db=db,
            job_id=code_job.id,
            improvement_job_id=imp_job.id,
        )
    assert exc_info.value.code == "improvement_not_done"


@pytest.mark.asyncio
async def test_raises_when_improvement_targets_different_action(
    db, seeded_action, seeded_company, configured_repo
):
    # Improvement job for a totally different action ID
    imp_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id="ac_other",
        agent_kind="improvement",
        initial_status="done",
        initial_result=_VALID_PLAN,
    )
    code_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="code-pr",
    )
    agent = CodePrAgent()
    with pytest.raises(CodePrError) as exc_info:
        await agent.run(
            seeded_action,
            seeded_company,
            db=db,
            job_id=code_job.id,
            improvement_job_id=imp_job.id,
        )
    assert exc_info.value.code == "improvement_action_mismatch"


@pytest.mark.asyncio
async def test_happy_path_opens_pr(
    db, seeded_action, seeded_company, configured_repo, repo_with_index, monkeypatch
):
    imp_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
        initial_status="done",
        initial_result=_VALID_PLAN,
    )
    code_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="code-pr",
    )

    clone_mock = AsyncMock(return_value=repo_with_index)
    commit_mock = AsyncMock()
    diff_stat_mock = AsyncMock(return_value=" index.html | 1 +\n 1 file changed, 1 insertion(+)\n")
    full_diff_mock = AsyncMock(
        return_value=(
            "diff --git a/index.html b/index.html\n"
            "@@ -1 +1 @@\n"
            "-<html></html>\n"
            "+<html><head><script type='application/ld+json'>{}</script></head></html>\n"
        )
    )
    pr_mock = AsyncMock(return_value="https://github.com/octo/example/pull/42")
    cleanups: list[Path] = []

    monkeypatch.setattr(git_ops, "clone", clone_mock)
    monkeypatch.setattr(git_ops, "commit_and_push", commit_mock)
    monkeypatch.setattr(git_ops, "diff_summary", diff_stat_mock)
    monkeypatch.setattr(git_ops, "full_diff", full_diff_mock)
    monkeypatch.setattr(git_ops, "open_pull_request", pr_mock)
    monkeypatch.setattr(git_ops, "cleanup", lambda p: cleanups.append(p))

    agent = CodePrAgent()
    result = await agent.run(
        seeded_action,
        seeded_company,
        db=db,
        job_id=code_job.id,
        improvement_job_id=imp_job.id,
    )

    assert result["type"] == "code-pr"
    assert result["title"] == _VALID_PLAN["summary"]
    assert result["rationale"] == _VALID_PLAN["rationale"]
    assert result["expected_impact"] == _VALID_PLAN["expected_impact"]
    assert result["repo"] == "octo/example"
    assert result["pr_url"] == "https://github.com/octo/example/pull/42"
    assert result["files_changed"] == ["index.html"]
    assert "1 file changed" in result["diff_stat"]
    assert "application/ld+json" in result["diff"]
    # pr_body matches what was sent as the GitHub PR body
    assert result["pr_body"] == pr_mock.call_args.kwargs["body"]
    # And the body contains the rationale + expected impact
    assert _VALID_PLAN["rationale"] in result["pr_body"]
    assert _VALID_PLAN["expected_impact"] in result["pr_body"]

    # apply_edits ran for real on the temp dir; verify the file got rewritten
    rewritten = (repo_with_index / "index.html").read_text(encoding="utf-8")
    assert "application/ld+json" in rewritten

    # Branch name shape: "felix/" + first 8 chars after the j_ prefix
    expected_branch_prefix = "felix/"
    commit_call = commit_mock.call_args
    assert commit_call.args[1].startswith(expected_branch_prefix)

    # PR was opened with title from plan.summary and base from RepoConfig
    pr_kwargs = pr_mock.call_args.kwargs
    assert pr_kwargs["title"] == _VALID_PLAN["summary"]
    assert pr_kwargs["base"] == "main"

    # Cleanup ran
    assert cleanups == [repo_with_index]


@pytest.mark.asyncio
async def test_raises_when_no_edits_applied(
    db, seeded_action, seeded_company, configured_repo, tmp_path, monkeypatch
):
    plan_with_missing_file = dict(_VALID_PLAN)
    plan_with_missing_file["edits"] = [
        {
            "file_path": "does/not/exist.html",
            "change_type": "modify",
            "description": "x",
            "content": "x",
        }
    ]
    imp_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="improvement",
        initial_status="done",
        initial_result=plan_with_missing_file,
    )
    code_job = jobs_svc.create_job(
        db,
        kind="agent_run",
        company_id=seeded_company.id,
        action_id=seeded_action.id,
        agent_kind="code-pr",
    )

    repo = tmp_path / "felix-repo-y" / "repo"
    repo.mkdir(parents=True)
    (repo / "index.html").write_text("<html></html>")

    monkeypatch.setattr(git_ops, "clone", AsyncMock(return_value=repo))
    monkeypatch.setattr(git_ops, "commit_and_push", AsyncMock())
    monkeypatch.setattr(git_ops, "open_pull_request", AsyncMock())
    monkeypatch.setattr(git_ops, "cleanup", lambda p: None)

    agent = CodePrAgent()
    with pytest.raises(CodePrError) as exc_info:
        await agent.run(
            seeded_action,
            seeded_company,
            db=db,
            job_id=code_job.id,
            improvement_job_id=imp_job.id,
        )
    assert exc_info.value.code == "no_edits_applied"
