"""Thin async subprocess wrappers around `git` plus a GitHub PR opener.

Kept deliberately minimal — clones go to TemporaryDirectory paths owned by
the caller (use a context manager to clean up). Errors raise GitOpsError so
the caller can surface a useful job.error string.
"""

from __future__ import annotations

import asyncio
import logging
import re
import shutil
import tempfile
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

import httpx

logger = logging.getLogger(__name__)


_EXCLUDE_DIRS = {
    ".git",
    "node_modules",
    ".next",
    ".nuxt",
    "dist",
    "build",
    "out",
    "target",
    ".venv",
    "venv",
    "__pycache__",
    ".cache",
    ".turbo",
    ".vercel",
    ".idea",
    ".vscode",
}


class GitOpsError(RuntimeError):
    """Raised when a git/GitHub operation fails. The message is safe to surface."""


@dataclass
class RepoSlug:
    owner: str
    repo: str


def parse_repo_slug(repo_url: str) -> RepoSlug:
    """Parse `https://github.com/owner/repo[.git]` → RepoSlug."""
    parsed = urlparse(repo_url)
    if parsed.netloc != "github.com":
        raise GitOpsError(f"only github.com URLs are supported, got: {repo_url}")
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) < 2:
        raise GitOpsError(f"could not parse owner/repo from {repo_url}")
    owner, repo = parts[0], parts[1]
    if repo.endswith(".git"):
        repo = repo[:-4]
    return RepoSlug(owner=owner, repo=repo)


def _authed_url(repo_url: str, token: str | None) -> str:
    if not token:
        return repo_url
    parsed = urlparse(repo_url)
    return f"{parsed.scheme}://x-access-token:{token}@{parsed.netloc}{parsed.path}"


async def _run(*args: str, cwd: Path | None = None, env: dict | None = None) -> str:
    """Run a subprocess; return stdout. Raises GitOpsError with stderr on failure."""
    proc = await asyncio.create_subprocess_exec(
        *args,
        cwd=str(cwd) if cwd else None,
        env=env,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout_b, stderr_b = await proc.communicate()
    if proc.returncode != 0:
        stderr = stderr_b.decode("utf-8", errors="replace").strip()
        # never echo back tokens
        scrubbed = re.sub(r"x-access-token:[^@\s]+@", "x-access-token:***@", stderr)
        raise GitOpsError(f"`{args[0]} {args[1]}` failed: {scrubbed}")
    return stdout_b.decode("utf-8", errors="replace")


async def clone(repo_url: str, token: str | None, *, depth: int = 1) -> Path:
    """Shallow-clone repo_url into a fresh temp dir and return its Path.

    Caller owns cleanup — use `cleanup(path)` or wrap in TemporaryDirectory.
    """
    tmp_root = Path(tempfile.mkdtemp(prefix="midas-repo-"))
    target = tmp_root / "repo"
    auth_url = _authed_url(repo_url, token)
    try:
        await _run(
            "git",
            "clone",
            "--depth",
            str(depth),
            auth_url,
            str(target),
        )
    except GitOpsError:
        # Clean partial state before re-raising
        shutil.rmtree(tmp_root, ignore_errors=True)
        raise
    return target


def cleanup(repo_dir: Path) -> None:
    """Remove a cloned repo directory tree (and its temp parent)."""
    parent = repo_dir.parent
    shutil.rmtree(parent, ignore_errors=True)


async def list_files(repo_dir: Path, max_files: int = 200) -> list[str]:
    """Return repo-relative file paths, capped at max_files, with common
    build/vendor dirs excluded."""
    out: list[str] = []
    for path in sorted(repo_dir.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(repo_dir)
        if any(part in _EXCLUDE_DIRS for part in rel.parts):
            continue
        out.append(str(rel))
        if len(out) >= max_files:
            break
    return out


async def apply_edits(repo_dir: Path, edits: list[dict]) -> tuple[list[str], list[str]]:
    """Apply a list of edit dicts (PlanEdit shape) to the working tree.

    Returns (changed_files, skipped_with_reason). Skipped is a list of strings
    like "src/foo.ts: anchor not found". The agent treats skips as warnings
    rather than failures so a partially-good plan still ships a partial PR.
    """
    changed: list[str] = []
    skipped: list[str] = []

    for edit in edits:
        file_path = edit.get("file_path")
        change_type = edit.get("change_type")
        content = edit.get("content", "")
        if not file_path or not change_type:
            skipped.append("<unknown>: missing file_path or change_type")
            continue

        rel = Path(file_path)
        if rel.is_absolute() or ".." in rel.parts:
            skipped.append(f"{file_path}: path escapes repo")
            continue
        target = repo_dir / rel

        if change_type == "create":
            if target.exists():
                skipped.append(f"{file_path}: already exists (create)")
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")
            changed.append(file_path)
        elif change_type == "modify":
            if not target.exists():
                skipped.append(f"{file_path}: missing (modify)")
                continue
            target.write_text(content, encoding="utf-8")
            changed.append(file_path)
        elif change_type == "add":
            if not target.exists():
                skipped.append(f"{file_path}: missing (add)")
                continue
            anchor = edit.get("insertion_anchor")
            existing = target.read_text(encoding="utf-8")
            if anchor:
                idx = existing.find(anchor)
                if idx == -1:
                    skipped.append(f"{file_path}: anchor not found")
                    continue
                insert_at = idx + len(anchor)
                new_content = existing[:insert_at] + content + existing[insert_at:]
            else:
                # Append to end if no anchor specified
                sep = "" if existing.endswith("\n") else "\n"
                new_content = existing + sep + content
            target.write_text(new_content, encoding="utf-8")
            changed.append(file_path)
        else:
            skipped.append(f"{file_path}: unknown change_type {change_type!r}")

    return changed, skipped


async def commit_and_push(
    repo_dir: Path,
    branch: str,
    message: str,
    *,
    author_name: str = "MIDAS Bot",
    author_email: str = "midas-bot@peec.ai",
) -> None:
    """Create branch, stage all changes, commit, push to origin."""
    # Local-scope identity so we don't depend on the host's git config.
    await _run("git", "config", "user.name", author_name, cwd=repo_dir)
    await _run("git", "config", "user.email", author_email, cwd=repo_dir)
    await _run("git", "checkout", "-b", branch, cwd=repo_dir)
    await _run("git", "add", "-A", cwd=repo_dir)
    await _run("git", "commit", "-m", message, cwd=repo_dir)
    await _run("git", "push", "-u", "origin", branch, cwd=repo_dir)


async def diff_summary(repo_dir: Path, base_branch: str, head_branch: str) -> str:
    """Best-effort short diff stat of head vs base. Returns '' on failure."""
    try:
        return await _run(
            "git",
            "diff",
            "--stat",
            f"origin/{base_branch}...{head_branch}",
            cwd=repo_dir,
        )
    except GitOpsError as e:
        logger.warning("diff_summary failed: %s", e)
        return ""


async def full_diff(
    repo_dir: Path,
    base_branch: str,
    head_branch: str,
    *,
    max_bytes: int = 50_000,
) -> str:
    """Best-effort full unified diff of head vs base. Returns '' on failure.

    Truncated to `max_bytes` (UTF-8) with a `...[truncated]` marker so the
    frontend never has to load megabytes of diff on a wide-ranging change.
    """
    try:
        out = await _run(
            "git",
            "diff",
            f"origin/{base_branch}...{head_branch}",
            cwd=repo_dir,
        )
    except GitOpsError as e:
        logger.warning("full_diff failed: %s", e)
        return ""
    encoded = out.encode("utf-8")
    if len(encoded) > max_bytes:
        return encoded[:max_bytes].decode("utf-8", errors="ignore") + "\n...[truncated]"
    return out


async def open_pull_request(
    owner: str,
    repo: str,
    token: str,
    *,
    head: str,
    base: str,
    title: str,
    body: str,
) -> str:
    """POST a pull request to the GitHub REST API; returns the PR's html_url."""
    url = f"https://api.github.com/repos/{owner}/{repo}/pulls"
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    payload = {"title": title, "head": head, "base": base, "body": body}
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
    if resp.status_code >= 300:
        # GitHub returns useful JSON error messages — surface the message field
        try:
            err = resp.json()
            msg = err.get("message") or resp.text
            details = err.get("errors") or ""
        except ValueError:
            msg, details = resp.text, ""
        raise GitOpsError(f"GitHub PR open failed ({resp.status_code}): {msg} {details}".strip())
    pr_url = resp.json().get("html_url")
    if not pr_url:
        raise GitOpsError("GitHub PR open returned no html_url")
    return pr_url
