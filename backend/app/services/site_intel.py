"""Crawl a brand's website with Exa and extract intel.

Used by `resolve_pipeline` to make the cold-path resolve feel real:
- pull the brand's homepage + a handful of key pages from Exa
- emit "site_path_seen" progress events as discoveries land
- return a `SiteIntel` summary the frontend can render

The Anthropic step (turn pages into structured brand metadata + a
multilingual prompt bank) is wired here behind a feature flag — if
ANTHROPIC_API_KEY is empty we fall back to a deterministic shape so the
SSE stream still produces realistic events.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from typing import Awaitable, Callable
from urllib.parse import urlparse

from exa_py import Exa

from app.config import settings

logger = logging.getLogger(__name__)


@dataclass
class CrawledPage:
    url: str
    path: str
    title: str | None = None
    text: str | None = None


@dataclass
class SiteIntel:
    domain: str
    pages: list[CrawledPage] = field(default_factory=list)
    industry: str | None = None
    competitors: list[str] = field(default_factory=list)
    markets: list[str] = field(default_factory=list)
    languages: list[str] = field(default_factory=list)


_INTEREST_PATHS = (
    "/",
    "/about",
    "/customers",
    "/security",
    "/careers",
    "/news",
    "/product",
    "/pricing",
    "/integrations",
)


def _normalize_input(s: str) -> str:
    s = s.strip().lower()
    if "://" in s:
        host = urlparse(s).hostname or s
    else:
        host = s.split("/", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def _path_for(url: str) -> str:
    try:
        return urlparse(url).path or "/"
    except Exception:
        return "/"


async def crawl_with_exa(
    user_input: str,
    on_event: Callable[[str, dict], Awaitable[None]] | None = None,
) -> SiteIntel:
    """Search the brand's site with Exa, emit progress events, return a SiteIntel.

    Resilient by design: if EXA_API_KEY is unset or the API errors, we still
    produce a SiteIntel containing at least the normalized domain so the rest
    of the resolve flow keeps working.
    """
    domain = _normalize_input(user_input) or user_input.lower()
    intel = SiteIntel(domain=domain)

    if not settings.exa_api_key:
        logger.info("EXA_API_KEY missing; skipping live crawl")
        return intel

    if on_event:
        await on_event("crawl_started", {"domain": domain})

    try:
        client = Exa(api_key=settings.exa_api_key)

        def _do_search() -> list[dict]:
            res = client.search_and_contents(
                query=domain,
                num_results=10,
                include_domains=[domain],
                text={"max_characters": 1200},
            )
            out = []
            for r in res.results:
                out.append(
                    {
                        "url": r.url,
                        "title": getattr(r, "title", None),
                        "text": getattr(r, "text", None),
                    }
                )
            return out

        results = await asyncio.to_thread(_do_search)
    except Exception as e:  # noqa: BLE001
        logger.warning("exa search failed: %s", e)
        if on_event:
            await on_event(
                "crawl_failed",
                {"domain": domain, "reason": str(e)[:160]},
            )
        return intel

    seen_paths: set[str] = set()
    for r in results:
        url = r.get("url") or ""
        if not url:
            continue
        path = _path_for(url)
        if path in seen_paths:
            continue
        seen_paths.add(path)
        page = CrawledPage(
            url=url,
            path=path,
            title=r.get("title"),
            text=r.get("text"),
        )
        intel.pages.append(page)
        if on_event:
            await on_event(
                "site_path_seen",
                {"path": path, "title": page.title},
            )

    # Heuristic discoveries from the crawled corpus — keeps the demo realistic
    # even when the LLM stage is disabled.
    blob = "\n".join(
        f"{p.title or ''}\n{p.text or ''}" for p in intel.pages
    ).lower()

    if any(k in blob for k in ("legal", "lawyer", "law firm", "contract")):
        intel.industry = "Legal · AI workspace"
    elif any(k in blob for k in ("crm", "sales", "pipeline")):
        intel.industry = "Sales · CRM"
    elif "fintech" in blob or "banking" in blob:
        intel.industry = "Fintech"

    intel.markets = _extract_markets(blob)
    intel.competitors = _extract_competitors(blob)
    intel.languages = _extract_languages(blob)

    if on_event:
        await on_event(
            "site_summary",
            {
                "pages": len(intel.pages),
                "industry": intel.industry,
                "markets": intel.markets,
                "competitors": intel.competitors,
                "languages": intel.languages,
            },
        )

    return intel


_MARKET_HINTS: tuple[tuple[str, str], ...] = (
    ("stockholm", "SE"),
    ("london", "GB"),
    ("munich", "DE"),
    ("berlin", "DE"),
    ("paris", "FR"),
    ("madrid", "ES"),
    ("amsterdam", "NL"),
    ("zurich", "CH"),
    ("vienna", "AT"),
    ("toronto", "CA"),
    ("new york", "US"),
    ("san francisco", "US"),
    ("sydney", "AU"),
    ("bengaluru", "IN"),
    ("oslo", "NO"),
    ("helsinki", "FI"),
    ("copenhagen", "DK"),
)


def _extract_markets(blob: str) -> list[str]:
    found: list[str] = []
    for needle, code in _MARKET_HINTS:
        if needle in blob and code not in found:
            found.append(code)
    return found


_COMPETITOR_HINTS: tuple[str, ...] = (
    "harvey",
    "spellbook",
    "luminance",
    "ironclad",
    "clio",
    "legalfly",
    "leah",
    "streamline",
    "hubspot",
    "salesforce",
    "attio",
    "notion",
    "miro",
)


def _extract_competitors(blob: str) -> list[str]:
    out: list[str] = []
    for c in _COMPETITOR_HINTS:
        if c in blob:
            out.append(c.capitalize())
    return out


_LANG_HINTS: tuple[tuple[str, str], ...] = (
    ("english", "en"),
    ("deutsch", "de"),
    ("français", "fr"),
    ("español", "es"),
    ("italiano", "it"),
    ("svenska", "sv"),
    ("norsk", "no"),
    ("polski", "pl"),
)


def _extract_languages(blob: str) -> list[str]:
    out: list[str] = []
    for needle, code in _LANG_HINTS:
        if needle in blob and code not in out:
            out.append(code)
    return out
