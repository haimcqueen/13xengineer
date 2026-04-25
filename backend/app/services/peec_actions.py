import uuid
from collections.abc import Iterable
from typing import Any

from app.models import Action, PeecSnapshot

_OPP_RANK = {"high": 0, "medium": 1, "low": 2}
_VALID_AGENTS = {"article", "video", "code-pr"}
_VALID_CATEGORIES = {"owned_media", "earned_media"}
_VALID_OPPORTUNITY = {"low", "medium", "high"}


def derive(snapshot: PeecSnapshot) -> list[Action]:
    """Turn a PeecSnapshot into a sorted list of Action rows.

    Source priority:
      1. mcp_actions_raw — if MCP returned anything, those are authoritative.
      2. fallback synthesis — derive a small action set from prompt/brand
         coverage gaps so the UI is never empty.

    The returned Actions are NOT yet committed; the caller adds them to the
    session and commits in one transaction.
    """
    raw = snapshot.mcp_actions_raw or {}
    raw_items: Iterable[dict] = []
    if isinstance(raw, list):
        raw_items = raw
    elif isinstance(raw, dict):
        raw_items = raw.get("actions", [])

    actions: list[Action] = []
    for item in raw_items:
        actions.append(_action_from_raw(item, snapshot))

    if not actions:
        actions.extend(_synthesize_fallback(snapshot))

    actions.sort(key=lambda a: (_OPP_RANK.get(a.opportunity, 99), a.title))
    return actions


def _action_from_raw(item: dict, snapshot: PeecSnapshot) -> Action:
    category = item.get("category", "owned_media")
    if category not in _VALID_CATEGORIES:
        category = "owned_media"

    opportunity = item.get("opportunity", "medium")
    if opportunity not in _VALID_OPPORTUNITY:
        opportunity = "medium"

    suggested_agent = item.get("suggested_agent")
    if suggested_agent not in _VALID_AGENTS:
        suggested_agent = None

    return Action(
        id=f"a_{uuid.uuid4()}",
        company_id=snapshot.company_id,
        snapshot_id=snapshot.id,
        category=category,
        kind=str(item.get("kind", "article")),
        title=str(item.get("title", "Untitled action")),
        rationale=item.get("rationale"),
        opportunity=opportunity,
        target=item.get("target") or {},
        suggested_agent=suggested_agent,
    )


def _synthesize_fallback(snapshot: PeecSnapshot) -> list[Action]:
    """Tiny synthesis when MCP gave us nothing.

    We have no source/citation data via REST, so this is intentionally
    weak — just a couple of generic prompts using the topic + own brand.
    Better than an empty insights screen.
    """
    out: list[Action] = []

    topics: list[dict[str, Any]] = (snapshot.topics or {}).get("data", [])
    own_brand_name: str | None = None
    own_domain: str | None = None
    for b in (snapshot.brands or {}).get("data", []):
        if b.get("is_own"):
            own_brand_name = b.get("name")
            domains = b.get("domains") or []
            own_domain = domains[0] if domains else None
            break

    for t in topics[:3]:
        title = (
            f"Write a how-to article about {t.get('name', 'your topic')}"
            if own_brand_name
            else "Write a how-to article on a tracked topic"
        )
        out.append(
            Action(
                id=f"a_{uuid.uuid4()}",
                company_id=snapshot.company_id,
                snapshot_id=snapshot.id,
                category="owned_media",
                kind="article",
                title=title,
                rationale="Topic appears in your tracked prompts. Coverage gap inferred from REST metadata.",
                opportunity="medium",
                target={"topic": t.get("name"), "topic_id": t.get("id")},
                suggested_agent="article",
            )
        )

    if own_domain:
        out.append(
            Action(
                id=f"a_{uuid.uuid4()}",
                company_id=snapshot.company_id,
                snapshot_id=snapshot.id,
                category="owned_media",
                kind="code",
                title=f"Add structured data (Product + FAQPage) to {own_domain}",
                rationale="Generic recommendation — schema markup is a known driver of AI search citations.",
                opportunity="medium",
                target={"domain": own_domain, "schemas": ["Product", "FAQPage"]},
                suggested_agent="code-pr",
            )
        )

    return out
