"""ImprovementAgent — analyzes the customer's live site + repo and produces an
AEO/SEO markup edit plan via Claude with the web_fetch tool.

Output is an `ImprovementPlan` dict (matching `app.schemas.ImprovementPlan`)
that the downstream `CodePrAgent` reads from this job's `result` to actually
write the diff and open a PR.
"""

from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

import anthropic
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Action, Company, PeecSnapshot, RepoConfig
from app.schemas import ImprovementPlan
from app.services import git_ops
from app.services import jobs as jobs_svc

logger = logging.getLogger(__name__)


_CALL_TIMEOUT_SECONDS = 120.0
_MAX_FILES_IN_TREE = 200
_INLINE_FILE_BYTES = 8_000  # cap each inlined file at ~8kb
_INLINE_TOTAL_BYTES = 80_000  # cap total inlined content
_INLINE_EXTENSIONS = {
    ".html",
    ".htm",
    ".tsx",
    ".jsx",
    ".ts",
    ".js",
    ".astro",
    ".vue",
    ".svelte",
    ".md",
    ".mdx",
    ".json",
    ".xml",
    ".txt",
}


class ImprovementError(RuntimeError):
    """Raised on configuration / fetch failures the user can act on."""

    def __init__(self, message: str, code: str = "improvement_failed"):
        super().__init__(message)
        self.code = code


_PLAN_EDIT_SCHEMA = {
    "type": "object",
    "properties": {
        "file_path": {
            "type": "string",
            "description": (
                "Repo-relative file path. MUST be one of the files listed in the "
                "provided file tree (or, for change_type='create', a sensible new "
                "path next to existing similar files)."
            ),
        },
        "change_type": {
            "type": "string",
            "enum": ["add", "modify", "create"],
            "description": (
                "'modify' replaces the entire file with `content`. 'create' writes a "
                "new file with `content`. 'add' inserts `content` after `insertion_anchor` "
                "(or appends to end if anchor is null)."
            ),
        },
        "description": {
            "type": "string",
            "description": "1-2 sentences describing what this edit does.",
        },
        "content": {
            "type": "string",
            "description": (
                "For 'modify'/'create': the full new file contents. "
                "For 'add': the snippet to insert (must include surrounding whitespace/newlines)."
            ),
        },
        "insertion_anchor": {
            "type": ["string", "null"],
            "description": (
                "Only used for change_type='add'. A substring of the existing file; "
                "the snippet is inserted immediately after it. Null means append at EOF."
            ),
        },
    },
    "required": ["file_path", "change_type", "description", "content"],
    "additionalProperties": False,
}

_SUBMIT_PLAN_TOOL = {
    "name": "submit_plan",
    "description": (
        "Submit the final improvement plan once you have inspected the live site, "
        "competitor sites, and the relevant repo files. Call this exactly once."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "summary": {
                "type": "string",
                "description": "Imperative one-line summary of the change (used as PR title).",
            },
            "rationale": {
                "type": "string",
                "description": (
                    "2-4 sentences explaining WHY this change improves AI search visibility, "
                    "grounded in what you actually observed on the live site vs competitors."
                ),
            },
            "expected_impact": {
                "type": "string",
                "description": "Concise qualitative impact statement.",
            },
            "edits": {
                "type": "array",
                "minItems": 1,
                "maxItems": 10,
                "items": _PLAN_EDIT_SCHEMA,
            },
        },
        "required": ["summary", "rationale", "expected_impact", "edits"],
        "additionalProperties": False,
    },
}


_SYSTEM_PROMPT = """You are an AEO/SEO markup specialist. Given a single improvement action for a customer's website, produce a concrete, minimal code edit plan.

Scope is strict: structured data (Schema.org JSON-LD), meta tags (title, description, OG, Twitter card), canonical URLs, robots directives, and FAQ markup. Do NOT propose new features, refactors, copy rewrites, or design changes.

Workflow:

1. Use the `web_fetch` tool to fetch the customer's live site URL. Inspect the HTML head/body for what's already present. Then optionally fetch 1-2 competitor sites to see what they do that the customer does not.
2. Look at the file tree provided in the user message. Edits in your plan MUST reference real paths from that tree (or sensible new paths for `create`).
3. Call `submit_plan` exactly once with the final plan. Each edit must include the actual `content` to write — no placeholders, no TODOs, no `...`.

Constraints:
- Prefer 1-3 small, surgical edits over many large ones.
- For React/Next/Vite/Astro projects, JSON-LD is typically added inside the page/layout component or via a `<Head>`/`<script type="application/ld+json">` element.
- Do not propose touching `node_modules`, lockfiles, build output, or framework-generated files.
- Do not narrate. Just call tools."""


class ImprovementAgent:
    kind = "improvement"

    def __init__(self, anthropic_client: anthropic.AsyncAnthropic | None = None):
        self._client = anthropic_client

    def _client_or_default(self) -> anthropic.AsyncAnthropic:
        if self._client is not None:
            return self._client
        return anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=_CALL_TIMEOUT_SECONDS + 30,
        )

    async def run(
        self,
        action: Action,
        company: Company,
        *,
        db: Session,
        job_id: str,
        **_: object,
    ) -> dict:
        # 1. Load RepoConfig
        repo_cfg = db.query(RepoConfig).filter(RepoConfig.company_id == company.id).first()
        if repo_cfg is None:
            raise ImprovementError(
                "no repo configured for this company; PUT /api/companies/{id}/repo first",
                code="repo_not_configured",
            )

        # 2. Build competitor list from latest snapshot
        snapshot = (
            db.query(PeecSnapshot)
            .filter(PeecSnapshot.company_id == company.id)
            .order_by(PeecSnapshot.fetched_at.desc())
            .first()
        )
        competitor_urls = _competitor_urls(snapshot, limit=3)

        # 3. Clone repo, build file tree + inline excerpts
        jobs_svc.append_event(db, job_id, "cloning_repo", {"repo_url": repo_cfg.repo_url})
        try:
            repo_dir = await git_ops.clone(repo_cfg.repo_url, repo_cfg.github_token)
        except git_ops.GitOpsError as e:
            raise ImprovementError(f"failed to clone repo: {e}", code="clone_failed") from e

        try:
            file_tree = await git_ops.list_files(repo_dir, max_files=_MAX_FILES_IN_TREE)
            inlined = _inline_relevant_files(repo_dir, file_tree)
        finally:
            git_ops.cleanup(repo_dir)

        jobs_svc.append_event(
            db,
            job_id,
            "repo_summarized",
            {"file_count": len(file_tree), "inlined_count": len(inlined)},
        )

        # 4. Compose user prompt + call Claude
        user_prompt = _build_user_prompt(
            action=action,
            site_url=repo_cfg.site_url,
            competitor_urls=competitor_urls,
            file_tree=file_tree,
            inlined_files=inlined,
        )

        jobs_svc.append_event(
            db, job_id, "analyzing", {"site_url": repo_cfg.site_url, "competitors": competitor_urls}
        )

        client = self._client_or_default()
        started = time.monotonic()
        try:
            response = await asyncio.wait_for(
                client.beta.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=8192,
                    system=[
                        {
                            "type": "text",
                            "text": _SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    tools=[
                        {
                            "type": "web_fetch_20250910",
                            "name": "web_fetch",
                            "max_uses": 5,
                        },
                        _SUBMIT_PLAN_TOOL,
                    ],
                    messages=[{"role": "user", "content": user_prompt}],
                    betas=["web-fetch-2025-09-10"],
                ),
                timeout=_CALL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError as e:
            raise ImprovementError(
                f"claude analysis exceeded {_CALL_TIMEOUT_SECONDS:.0f}s",
                code="analysis_timeout",
            ) from e
        except anthropic.APIError as e:
            raise ImprovementError(f"anthropic error: {e}", code="anthropic_error") from e

        elapsed = time.monotonic() - started

        # 5. Extract submit_plan tool call
        plan_input = None
        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "submit_plan":
                plan_input = block.input
                break

        if plan_input is None:
            logger.warning(
                "improvement agent: no submit_plan call (stop_reason=%s, blocks=%s)",
                response.stop_reason,
                [getattr(b, "type", "?") for b in response.content],
            )
            raise ImprovementError("claude did not produce a plan", code="no_plan_submitted")

        # 6. Validate against ImprovementPlan
        try:
            plan = ImprovementPlan.model_validate(plan_input)
        except Exception as e:
            raise ImprovementError(f"plan failed validation: {e}", code="plan_invalid") from e

        logger.info(
            "improvement agent produced %d edits in %.1fs",
            len(plan.edits),
            elapsed,
        )
        jobs_svc.append_event(db, job_id, "plan_ready", {"edit_count": len(plan.edits)})

        return plan.model_dump()


def _competitor_urls(snapshot: PeecSnapshot | None, *, limit: int) -> list[str]:
    if snapshot is None:
        return []
    brands = (snapshot.brands or {}).get("data") or []
    urls: list[str] = []
    for b in brands:
        if b.get("is_own"):
            continue
        for d in b.get("domains") or []:
            if not d:
                continue
            urls.append(d if d.startswith("http") else f"https://{d}")
            break  # one URL per competitor brand
        if len(urls) >= limit:
            break
    return urls


def _inline_relevant_files(repo_dir: Path, file_tree: list[str]) -> list[dict]:
    """Read text content of files most likely to host SEO/AEO markup,
    capped by per-file and total byte budgets."""
    candidates: list[str] = []
    # Prioritize files whose names hint at HTML head / layout / SEO
    priority_hints = (
        "index.html",
        "layout",
        "head",
        "seo",
        "_app",
        "_document",
        "page.tsx",
        "page.jsx",
        "page.astro",
        "robots",
        "sitemap",
        "metadata",
    )

    def priority(path: str) -> int:
        lower = path.lower()
        for i, hint in enumerate(priority_hints):
            if hint in lower:
                return i
        return len(priority_hints)

    for path in sorted(file_tree, key=priority):
        suffix = Path(path).suffix.lower()
        if suffix not in _INLINE_EXTENSIONS:
            continue
        candidates.append(path)

    total = 0
    out: list[dict] = []
    for path in candidates:
        full = repo_dir / path
        try:
            data = full.read_bytes()
        except OSError:
            continue
        if len(data) == 0:
            continue
        truncated = False
        if len(data) > _INLINE_FILE_BYTES:
            data = data[:_INLINE_FILE_BYTES]
            truncated = True
        try:
            text = data.decode("utf-8", errors="replace")
        except Exception:
            continue
        out.append({"path": path, "content": text, "truncated": truncated})
        total += len(data)
        if total >= _INLINE_TOTAL_BYTES:
            break
    return out


def _build_user_prompt(
    *,
    action: Action,
    site_url: str,
    competitor_urls: list[str],
    file_tree: list[str],
    inlined_files: list[dict],
) -> str:
    competitor_block = (
        "\n".join(f"- {u}" for u in competitor_urls) if competitor_urls else "(none provided)"
    )
    tree_block = "\n".join(file_tree) if file_tree else "(empty)"
    inlined_block = (
        "\n\n".join(
            f"--- {f['path']}{' (truncated)' if f['truncated'] else ''} ---\n{f['content']}"
            for f in inlined_files
        )
        if inlined_files
        else "(no relevant files inlined)"
    )
    target_block = ", ".join(f"{k}={v!r}" for k, v in (action.target or {}).items()) or "(none)"

    return f"""Action to fulfill:
- Title: {action.title}
- Rationale (from Peec): {action.rationale or "(none)"}
- Target metadata: {target_block}

Customer site (live): {site_url}
Competitor sites:
{competitor_block}

Repo file tree (truncated to {len(file_tree)} entries):
{tree_block}

Inlined contents of likely-relevant files:

{inlined_block}

Now: fetch the live site (and 1-2 competitor sites if useful), figure out the smallest concrete AEO/SEO markup edit that fulfills the action, and call `submit_plan` once."""
