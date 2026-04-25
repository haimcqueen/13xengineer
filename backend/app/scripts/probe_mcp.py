"""Diagnostic: run the real-MCP Anthropic call once with a long timeout
and dump every content block so we can see exactly what Claude did.

Usage:
    uv run python -m app.scripts.probe_mcp

Reads the Peec OAuth token from SQLite, calls Anthropic with the same
prompt + MCP server we use in production, and prints a per-block trace.
"""

import asyncio
import json
import time

import anthropic

from app.config import settings
from app.db import SessionLocal
from app.services import peec_oauth
from app.services.peec_mcp import _SUBMIT_ACTIONS_TOOL, _SYSTEM_PROMPT

LEGORA_PROJECT_ID = "or_f980868d-5a09-40f7-9c1d-256b991a6ba2"
TIMEOUT = 300.0  # 5 min hard ceiling for the probe


def _trim(s: str, n: int = 240) -> str:
    s = s.replace("\n", " ")
    return s if len(s) <= n else s[:n] + f" …(+{len(s) - n} chars)"


async def main() -> int:
    db = SessionLocal()
    try:
        access_token = peec_oauth.get_valid_access_token(db, provider="peec")
    finally:
        db.close()
    print(f"✓ Got access token ({len(access_token)} chars)")

    client = anthropic.AsyncAnthropic(
        api_key=settings.anthropic_api_key,
        timeout=TIMEOUT,
    )

    user_prompt = (
        f"Generate the suggested actions for Peec project_id `{LEGORA_PROJECT_ID}`. "
        f"Use the `peec` MCP tools to gather visibility, sources, and competitor "
        f"data, then call `submit_actions` exactly once with the final list."
    )

    print(f"→ Calling claude {settings.anthropic_model} with peec MCP attached")
    print(f"  prompt: {_trim(user_prompt)}")
    print(f"  timeout: {TIMEOUT}s")
    started = time.monotonic()

    try:
        response = await client.beta.messages.create(
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
        )
    except Exception as e:
        elapsed = time.monotonic() - started
        print(f"\n✗ FAILED after {elapsed:.1f}s: {type(e).__name__}: {e}")
        return 1

    elapsed = time.monotonic() - started
    print(f"\n✓ Returned in {elapsed:.1f}s")
    print(f"  stop_reason = {response.stop_reason}")
    print(f"  usage       = in={response.usage.input_tokens}, "
          f"out={response.usage.output_tokens}, "
          f"cache_read={getattr(response.usage, 'cache_read_input_tokens', 0) or 0}")
    print()

    print(f"=== {len(response.content)} content blocks ===")
    submit_actions_called = False
    mcp_tool_calls = 0
    mcp_tool_errors = 0

    for i, block in enumerate(response.content):
        btype = getattr(block, "type", "?")
        prefix = f"[{i:02d}] {btype}"

        if btype == "thinking":
            text = getattr(block, "thinking", "") or ""
            print(f"{prefix}  ({len(text)} chars)  {_trim(text, 180)}")
        elif btype == "text":
            print(f"{prefix}  {_trim(block.text)}")
        elif btype == "mcp_tool_use":
            mcp_tool_calls += 1
            inp = getattr(block, "input", {})
            print(f"{prefix}  server={block.server_name} name={block.name}")
            print(f"      input={_trim(json.dumps(inp), 300)}")
        elif btype == "mcp_tool_result":
            is_err = getattr(block, "is_error", False)
            if is_err:
                mcp_tool_errors += 1
            content = getattr(block, "content", []) or []
            text_parts = []
            for c in content:
                if getattr(c, "type", None) == "text":
                    text_parts.append(c.text)
            joined = " ".join(text_parts)
            tag = "ERROR" if is_err else "ok"
            print(f"{prefix}  [{tag}]  {_trim(joined, 300)}")
        elif btype == "tool_use":
            if block.name == "submit_actions":
                submit_actions_called = True
                actions = block.input.get("actions") or []
                print(f"{prefix}  submit_actions  ({len(actions)} actions)")
                for a in actions[:5]:
                    print(f"      [{a.get('opportunity'):>6}] {a.get('category'):>12s}/{a.get('kind'):<14s} → {_trim(a.get('title', ''), 80)}")
                if len(actions) > 5:
                    print(f"      … {len(actions) - 5} more")
            else:
                print(f"{prefix}  custom tool: {block.name}")
        else:
            print(f"{prefix}")

    print()
    print(f"summary: mcp_tool_calls={mcp_tool_calls}, "
          f"mcp_errors={mcp_tool_errors}, "
          f"submit_actions_called={submit_actions_called}")
    return 0 if submit_actions_called else 2


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
