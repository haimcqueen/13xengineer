def test_get_404_when_not_configured(client, seeded_company):
    resp = client.get(f"/api/companies/{seeded_company.id}/repo")
    assert resp.status_code == 404


def test_put_creates_then_get_returns_it(client, seeded_company):
    body = {
        "site_url": "https://my-clone.vercel.app",
        "repo_url": "https://github.com/octo/my-clone",
        "default_branch": "main",
        "github_token": "ghp_secret",
    }
    resp = client.put(f"/api/companies/{seeded_company.id}/repo", json=body)
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["company_id"] == seeded_company.id
    assert data["site_url"] == body["site_url"]
    assert data["repo_url"] == body["repo_url"]
    assert data["default_branch"] == "main"
    assert data["has_token"] is True
    # Token must NEVER be returned
    assert "github_token" not in data

    resp = client.get(f"/api/companies/{seeded_company.id}/repo")
    assert resp.status_code == 200
    assert resp.json()["site_url"] == body["site_url"]


def test_put_updates_existing(client, seeded_company):
    body1 = {
        "site_url": "https://a.example.com",
        "repo_url": "https://github.com/octo/a",
        "default_branch": "main",
        "github_token": "tok1",
    }
    body2 = {
        "site_url": "https://b.example.com",
        "repo_url": "https://github.com/octo/b",
        "default_branch": "develop",
        "github_token": "tok2",
    }
    client.put(f"/api/companies/{seeded_company.id}/repo", json=body1)
    resp = client.put(f"/api/companies/{seeded_company.id}/repo", json=body2)
    assert resp.status_code == 200
    data = resp.json()
    assert data["repo_url"] == body2["repo_url"]
    assert data["default_branch"] == "develop"


def test_put_rejects_invalid_repo_url(client, seeded_company):
    body = {
        "site_url": "https://my-clone.vercel.app",
        "repo_url": "https://gitlab.com/octo/my-clone",
        "default_branch": "main",
        "github_token": "ghp_secret",
    }
    resp = client.put(f"/api/companies/{seeded_company.id}/repo", json=body)
    assert resp.status_code == 422


def test_put_rejects_invalid_site_url(client, seeded_company):
    body = {
        "site_url": "not-a-url",
        "repo_url": "https://github.com/octo/my-clone",
        "default_branch": "main",
        "github_token": "ghp_secret",
    }
    resp = client.put(f"/api/companies/{seeded_company.id}/repo", json=body)
    assert resp.status_code == 422


def test_put_404_for_unknown_company(client):
    body = {
        "site_url": "https://my-clone.vercel.app",
        "repo_url": "https://github.com/octo/my-clone",
        "default_branch": "main",
        "github_token": "ghp_secret",
    }
    resp = client.put("/api/companies/co_unknown/repo", json=body)
    assert resp.status_code == 404


def test_delete_removes_config(client, seeded_company):
    body = {
        "site_url": "https://my-clone.vercel.app",
        "repo_url": "https://github.com/octo/my-clone",
        "default_branch": "main",
        "github_token": "ghp_secret",
    }
    client.put(f"/api/companies/{seeded_company.id}/repo", json=body)
    resp = client.delete(f"/api/companies/{seeded_company.id}/repo")
    assert resp.status_code == 204
    assert client.get(f"/api/companies/{seeded_company.id}/repo").status_code == 404


def test_delete_is_idempotent(client, seeded_company):
    # Deleting when nothing exists should still succeed silently.
    resp = client.delete(f"/api/companies/{seeded_company.id}/repo")
    assert resp.status_code == 204
