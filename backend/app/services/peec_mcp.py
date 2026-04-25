import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Protocol

import anthropic

from app.config import settings
from app.db import SessionLocal
from app.services import peec_oauth

logger = logging.getLogger(__name__)

# Wall-clock cap on the Anthropic+MCP call. The Anthropic SDK default is
# 10 minutes; that's unusable. 90s is enough for ~10 MCP tool iterations
# at typical EU↔US latencies.
_MCP_CALL_TIMEOUT_SECONDS = 90.0

FIXTURES_DIR = Path(__file__).resolve().parents[2] / "fixtures"


class ActionDTO(dict):
    """Untyped dict for now — schema is enforced at derivation time.

    Shape: {category, kind, title, rationale, opportunity, target,
            suggested_agent}
    """


class MCPClient(Protocol):
    async def get_actions(self, project_id: str) -> list[ActionDTO]: ...


class FixtureMCPClient:
    """Reads pre-recorded Action data from a JSON fixture.

    Returns Legora's curated actions for the Legora project_id; an empty
    list otherwise. Used until the real MCP OAuth client is wired up.
    """

    def __init__(self, fixtures_dir: Path | None = None):
        self._dir = fixtures_dir or FIXTURES_DIR

    async def get_actions(self, project_id: str) -> list[ActionDTO]:
        legora_path = self._dir / "legora_actions.json"
        if not legora_path.exists():
            logger.warning("legora fixture missing at %s", legora_path)
            return []
        try:
            data = json.loads(legora_path.read_text())
        except json.JSONDecodeError as e:
            logger.error("legora fixture invalid: %s", e)
            return []
        if data.get("project_id") != project_id:
            return []
        return list(data.get("actions", []))


# JSON Schema for the structured Action output. Sent to Claude as the
# `submit_actions` tool input schema so Claude must produce shape-correct JSON.
_ACTION_ITEM_SCHEMA = {
    "type": "object",
    "properties": {
        "category": {
            "type": "string",
            "enum": ["owned_media", "earned_media"],
            "description": "Owned media (content on the brand's domain) vs earned media (third-party).",
        },
        "kind": {
            "type": "string",
            "description": "Action subtype, e.g. 'article', 'comparison', 'listicle', 'video', 'code', 'subreddit', 'editorial', 'listicle_inclusion', 'youtube'.",
        },
        "title": {
            "type": "string",
            "description": "Imperative one-line title shown on the action card.",
        },
        "rationale": {
            "type": "string",
            "description": "1-3 sentence justification grounded in the Peec data you observed.",
        },
        "opportunity": {
            "type": "string",
            "enum": ["low", "medium", "high"],
            "description": "Relative opportunity score given competitor coverage and source frequency.",
        },
        "target": {
            "type": "object",
            "description": "Free-form metadata about what the action targets — topic, format, domain, competitors, etc. The frontend renders this opportunistically.",
        },
        "suggested_agent": {
            "type": ["string", "null"],
            "enum": ["article", "video", "code-pr", None],
            "description": "Which downstream agent can execute this action, or null if no agent fits (e.g. earned-media outreach we can't automate).",
        },
    },
    "required": [
        "category",
        "kind",
        "title",
        "rationale",
        "opportunity",
        "target",
        "suggested_agent",
    ],
    "additionalProperties": False,
}

_SUBMIT_ACTIONS_TOOL = {
    "name": "submit_actions",
    "description": (
        "Submit the final list of suggested actions for the company once you have "
        "gathered enough Peec MCP data. Call this exactly once, with the full list."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "actions": {
                "type": "array",
                "minItems": 0,
                "maxItems": 20,
                "items": _ACTION_ITEM_SCHEMA,
            }
        },
        "required": ["actions"],
        "additionalProperties": False,
    },
}

_SYSTEM_PROMPT = """You are an analyst that produces a prioritized list of brand-visibility actions for one company tracked in Peec.ai.

You have two sets of tools:

1. The Peec MCP toolset (`peec`). Use it to gather data about the company's project: visibility, sources, citations, competitors, and any Actions Peec already surfaces. Read what's available — do not speculate.
2. A single output tool `submit_actions`. After you've gathered enough data, call it exactly once with the final list.

Output rules:

- Each action belongs to one of two categories:
  - `owned_media`: content the company publishes on its own domain (articles, comparison pages, listicles, demo videos, structured-data improvements, new pages).
  - `earned_media`: third-party surfaces (subreddit engagement, editorial pitches, getting included in listicles, YouTube collaborations).
- `kind` is a free-text subtype like `article`, `comparison`, `listicle`, `video`, `code`, `subreddit`, `editorial`, `listicle_inclusion`, `youtube`. Pick what fits.
- `opportunity` is `low` / `medium` / `high`, weighing competitor citation gap and source frequency. At most ~3 should be `high`.
- `suggested_agent` MUST be one of: `article` (for written content), `video` (for video creation), `code-pr` (for website code/structured-data changes), or null (for earned-media actions we can't automate today).
- `rationale` must reference what you actually saw in the Peec data. No generic advice.
- Aim for 8-12 actions, balanced across owned and earned media. Skip filler.
- If Peec data is empty or unavailable, still return at least 3 broadly applicable actions for the company so the UI is never empty, and say so in the rationale.

Be efficient. Make at most 4 MCP tool calls before submitting. If the first 1-2 calls already give you enough signal, submit immediately. Do NOT call the same tool repeatedly with slightly different parameters. Do not narrate."""


class RealMCPClient:
    """Anthropic-mediated MCP client.

    Calls Claude via the Messages API with the Peec MCP server attached.
    Claude orchestrates the MCP tool calls; we receive structured JSON
    via a forced tool call to `submit_actions`.
    """

    def __init__(self, anthropic_client: anthropic.AsyncAnthropic | None = None):
        self._client = anthropic_client or anthropic.AsyncAnthropic(
            api_key=settings.anthropic_api_key,
            timeout=_MCP_CALL_TIMEOUT_SECONDS + 30,
        )

    async def get_actions(self, project_id: str) -> list[ActionDTO]:
        db = SessionLocal()
        try:
            access_token = peec_oauth.get_valid_access_token(db, provider="peec")
        finally:
            db.close()

        user_prompt = (
            f"Generate the suggested actions for Peec project_id `{project_id}`. "
            f"Use the `peec` MCP tools to gather visibility, sources, and competitor "
            f"data, then call `submit_actions` exactly once with the final list."
        )

        started = time.monotonic()
        try:
            response = await asyncio.wait_for(
                self._client.beta.messages.create(
                    model=settings.anthropic_model,
                    max_tokens=4096,
                    thinking={"type": "adaptive"},
                    output_config={"effort": "medium"},
                    system=[
                        {
                            "type": "text",
                            "text": _SYSTEM_PROMPT,
                            "cache_control": {"type": "ephemeral"},
                        }
                    ],
                    mcp_servers=[
                        {
                            "type": "url",
                            "url": settings.peec_mcp_url,
                            "name": "peec",
                            "authorization_token": access_token,
                        }
                    ],
                    tools=[
                        {"type": "mcp_toolset", "mcp_server_name": "peec"},
                        _SUBMIT_ACTIONS_TOOL,
                    ],
                    messages=[{"role": "user", "content": user_prompt}],
                    betas=["mcp-client-2025-11-20"],
                ),
                timeout=_MCP_CALL_TIMEOUT_SECONDS,
            )
        except asyncio.TimeoutError:
            elapsed = time.monotonic() - started
            logger.warning(
                "real mcp call exceeded %.0fs (waited %.1fs); returning empty",
                _MCP_CALL_TIMEOUT_SECONDS,
                elapsed,
            )
            return []
        except anthropic.APIError as e:
            logger.warning("real mcp anthropic error: %s", e)
            return []

        elapsed = time.monotonic() - started
        if response.stop_reason == "pause_turn":
            logger.warning(
                "anthropic stop_reason=pause_turn after %.1fs (in=%d, out=%d); "
                "MCP loop hit iteration cap",
                elapsed,
                response.usage.input_tokens,
                response.usage.output_tokens,
            )

        for block in response.content:
            if getattr(block, "type", None) == "tool_use" and block.name == "submit_actions":
                actions = block.input.get("actions") or []
                logger.info(
                    "real mcp returned %d actions in %.1fs (in=%d, out=%d, cache_read=%d)",
                    len(actions),
                    elapsed,
                    response.usage.input_tokens,
                    response.usage.output_tokens,
                    getattr(response.usage, "cache_read_input_tokens", 0) or 0,
                )
                return [ActionDTO(a) for a in actions]

        logger.warning(
            "anthropic response did not call submit_actions in %.1fs; stop_reason=%s, blocks=%s",
            elapsed,
            response.stop_reason,
            [getattr(b, "type", "?") for b in response.content],
        )
        return []


class FallbackMCPClient:
    """Tries the real MCP client first; on empty/timeout/error, falls back
    to the fixture client. The composite is what `get_mcp_client` returns
    when PEEC_USE_REAL_MCP is on, so the UI is never empty for known projects.
    """

    def __init__(self):
        self._real = RealMCPClient()
        self._fixture = FixtureMCPClient()

    async def get_actions(self, project_id: str) -> list[ActionDTO]:
        actions = await self._real.get_actions(project_id)
        if actions:
            return actions
        logger.info("real mcp returned 0 actions; falling back to fixture")
        return await self._fixture.get_actions(project_id)


def get_mcp_client() -> MCPClient:
    if settings.peec_use_real_mcp:
        return FallbackMCPClient()
    return FixtureMCPClient()
