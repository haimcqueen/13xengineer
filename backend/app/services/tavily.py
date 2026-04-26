"""Tavily web search wrapper used by the Tolkien (article) agent.

Tavily is an AI-optimized search API that returns structured results plus an
optional synthesized answer. We use it to inject real, current web sources into
the article research stage so Claude isn't relying on training-data alone.

Designed to fail open: if `TAVILY_API_KEY` is missing or the API errors, every
function returns an empty `TavilySearch` and the article pipeline continues
with its existing Claude-only path. Never raises to callers.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class TavilyResult:
    title: str
    url: str
    content: str
    score: float | None = None


@dataclass
class TavilySearch:
    query: str
    answer: str | None = None
    results: list[TavilyResult] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not self.results and not self.answer

    def to_prompt_block(self, max_results: int = 6) -> str:
        """Render the search payload as a markdown block for prompt injection."""
        if self.is_empty:
            return ""
        lines: list[str] = [f"### Live web research (Tavily) — query: {self.query}"]
        if self.answer:
            lines.append(f"\n**Synthesized answer:** {self.answer}\n")
        if self.results:
            lines.append("\n**Sources:**")
            for i, r in enumerate(self.results[:max_results], start=1):
                snippet = (r.content or "").strip().replace("\n", " ")
                if len(snippet) > 320:
                    snippet = snippet[:317] + "..."
                lines.append(f"{i}. [{r.title}]({r.url})\n   {snippet}")
        return "\n".join(lines)


async def search(
    query: str,
    *,
    max_results: int = 6,
    search_depth: str = "advanced",
    include_answer: bool = True,
    topic: str = "general",
) -> TavilySearch:
    """Run a Tavily search. Returns an empty TavilySearch on any failure."""
    empty = TavilySearch(query=query)

    if not settings.tavily_api_key:
        logger.info("TAVILY_API_KEY missing; skipping Tavily search")
        return empty

    try:
        # Imported lazily so the dep isn't required when Tavily is unconfigured.
        from tavily import TavilyClient
    except ImportError:
        logger.warning("tavily-python not installed; skipping Tavily search")
        return empty

    def _do_search() -> dict:
        client = TavilyClient(api_key=settings.tavily_api_key)
        return client.search(
            query=query,
            max_results=max_results,
            search_depth=search_depth,
            include_answer=include_answer,
            topic=topic,
        )

    try:
        raw = await asyncio.wait_for(asyncio.to_thread(_do_search), timeout=20.0)
    except asyncio.TimeoutError:
        logger.warning("Tavily search timed out for query=%r", query)
        return empty
    except Exception as e:  # noqa: BLE001
        logger.warning("Tavily search failed: %s", e)
        return empty

    results: list[TavilyResult] = []
    for item in raw.get("results", []) or []:
        url = item.get("url") or ""
        title = item.get("title") or url
        content = item.get("content") or ""
        if not url:
            continue
        results.append(
            TavilyResult(
                title=title,
                url=url,
                content=content,
                score=item.get("score"),
            )
        )

    return TavilySearch(
        query=query,
        answer=raw.get("answer"),
        results=results,
    )
