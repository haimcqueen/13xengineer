"""Validation-path tests for /api/agents/{kind}/run.

These tests stop at the synchronous validation gates (404/400/422) — they do
NOT exercise the background task path, which would require patching the
production SessionLocal. The agent classes are unit-tested separately.
"""


def test_unknown_agent_kind_returns_404(client, seeded_action):
    resp = client.post(
        "/api/agents/nonsense/run",
        json={"action_id": seeded_action.id},
    )
    assert resp.status_code == 404


def test_unknown_action_returns_404(client):
    resp = client.post(
        "/api/agents/article/run",
        json={"action_id": "ac_does_not_exist"},
    )
    assert resp.status_code == 404


def test_improvement_run_without_repo_config_returns_400(client, seeded_action):
    resp = client.post(
        "/api/agents/improvement/run",
        json={"action_id": seeded_action.id},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "repo_not_configured"


def test_code_pr_run_without_repo_config_returns_400(client, seeded_action):
    resp = client.post(
        "/api/agents/code-pr/run",
        json={"action_id": seeded_action.id, "improvement_job_id": "j_anything"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "repo_not_configured"


def test_code_pr_without_improvement_job_id_returns_400(client, seeded_company, seeded_action):
    # First configure the repo so we get past the repo gate
    client.put(
        f"/api/companies/{seeded_company.id}/repo",
        json={
            "site_url": "https://example.com",
            "repo_url": "https://github.com/octo/x",
            "default_branch": "main",
            "github_token": "tok",
        },
    )
    resp = client.post(
        "/api/agents/code-pr/run",
        json={"action_id": seeded_action.id},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["code"] == "improvement_job_id_required"


def test_article_run_does_not_require_repo_config(client, seeded_action):
    # article/video should not be repo-gated. We accept the request (202)
    # — the background task is fire-and-forget; we don't await it here.
    resp = client.post(
        "/api/agents/article/run",
        json={"action_id": seeded_action.id},
    )
    assert resp.status_code == 202
    assert "job_id" in resp.json()
