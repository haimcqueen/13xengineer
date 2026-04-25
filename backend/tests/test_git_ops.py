"""Pure-logic tests for git_ops helpers (no network, no subprocess)."""

from __future__ import annotations

import pytest

from app.services import git_ops


def test_parse_repo_slug_strips_dot_git():
    slug = git_ops.parse_repo_slug("https://github.com/octo/cat.git")
    assert slug.owner == "octo"
    assert slug.repo == "cat"


def test_parse_repo_slug_plain():
    slug = git_ops.parse_repo_slug("https://github.com/octo/cat")
    assert slug.owner == "octo"
    assert slug.repo == "cat"


def test_parse_repo_slug_rejects_non_github():
    with pytest.raises(git_ops.GitOpsError):
        git_ops.parse_repo_slug("https://gitlab.com/octo/cat")


def test_parse_repo_slug_rejects_short_path():
    with pytest.raises(git_ops.GitOpsError):
        git_ops.parse_repo_slug("https://github.com/octo")


@pytest.mark.asyncio
async def test_apply_edits_modify_existing(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "x.html").write_text("<html></html>")
    edits = [
        {
            "file_path": "x.html",
            "change_type": "modify",
            "description": "rewrite",
            "content": "<html><body>new</body></html>",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == ["x.html"]
    assert skipped == []
    assert (repo / "x.html").read_text() == "<html><body>new</body></html>"


@pytest.mark.asyncio
async def test_apply_edits_create_new(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    edits = [
        {
            "file_path": "robots.txt",
            "change_type": "create",
            "description": "add robots",
            "content": "User-agent: *\nAllow: /\n",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == ["robots.txt"]
    assert skipped == []
    assert "User-agent" in (repo / "robots.txt").read_text()


@pytest.mark.asyncio
async def test_apply_edits_create_skips_existing(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "robots.txt").write_text("existing")
    edits = [
        {
            "file_path": "robots.txt",
            "change_type": "create",
            "description": "x",
            "content": "y",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == []
    assert any("already exists" in s for s in skipped)
    # File untouched
    assert (repo / "robots.txt").read_text() == "existing"


@pytest.mark.asyncio
async def test_apply_edits_add_with_anchor(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "page.html").write_text("<head><title>X</title></head>")
    edits = [
        {
            "file_path": "page.html",
            "change_type": "add",
            "description": "inject schema",
            "content": "<script>schema</script>",
            "insertion_anchor": "<head>",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == ["page.html"]
    assert skipped == []
    assert (
        repo / "page.html"
    ).read_text() == "<head><script>schema</script><title>X</title></head>"


@pytest.mark.asyncio
async def test_apply_edits_add_anchor_not_found(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    (repo / "page.html").write_text("<body></body>")
    edits = [
        {
            "file_path": "page.html",
            "change_type": "add",
            "description": "x",
            "content": "<script/>",
            "insertion_anchor": "<<<NOT-PRESENT>>>",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == []
    assert any("anchor not found" in s for s in skipped)


@pytest.mark.asyncio
async def test_apply_edits_rejects_path_traversal(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    edits = [
        {
            "file_path": "../escape.txt",
            "change_type": "create",
            "description": "x",
            "content": "y",
        }
    ]
    changed, skipped = await git_ops.apply_edits(repo, edits)
    assert changed == []
    assert any("escapes repo" in s for s in skipped)


@pytest.mark.asyncio
async def test_list_files_excludes_node_modules(tmp_path):
    repo = tmp_path / "repo"
    (repo / "node_modules" / "lodash").mkdir(parents=True)
    (repo / "node_modules" / "lodash" / "index.js").write_text("//")
    (repo / "src").mkdir()
    (repo / "src" / "app.tsx").write_text("//")
    (repo / "index.html").write_text("//")
    files = await git_ops.list_files(repo)
    assert "index.html" in files
    assert "src/app.tsx" in files
    assert not any("node_modules" in f for f in files)
