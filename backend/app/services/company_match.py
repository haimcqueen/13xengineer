import asyncio
import logging
from dataclasses import dataclass
from urllib.parse import urlparse

from app.services.peec_rest import PeecError, PeecRestClient

logger = logging.getLogger(__name__)


@dataclass
class MatchedProject:
    project_id: str
    name: str
    own_domain: str | None


@dataclass
class MatchFailure:
    tracked_names: list[str]


def _normalize_domain(s: str) -> str | None:
    """Extract bare hostname from a free-text input.

    "legora.com" -> "legora.com"
    "https://www.legora.com/path" -> "legora.com"
    "Legora" -> None  (not a domain)
    """
    s = s.strip().lower()
    if not s:
        return None
    if "://" in s:
        host = urlparse(s).hostname or ""
    elif "/" in s or "." in s:
        head = s.split("/", 1)[0]
        host = head if "." in head else ""
    else:
        return None
    if host.startswith("www."):
        host = host[4:]
    return host or None


def _domain_matches(input_domain: str, brand_domain: str) -> bool:
    """input domain matches brand domain on equality or subdomain suffix."""
    a = input_domain.lower()
    b = brand_domain.lower().lstrip(".")
    return a == b or a.endswith("." + b) or b.endswith("." + a)


def _name_matches(user_input: str, project_name: str) -> bool:
    """Case-insensitive substring match either way."""
    a = user_input.strip().lower()
    b = project_name.strip().lower()
    if not a or not b:
        return False
    return a in b or b in a


async def resolve(user_input: str) -> MatchedProject | MatchFailure:
    """Resolve a free-text company input against the user's Peec projects.

    Strategy:
      1. List projects.
      2. Fan out /brands per project to find own-brand domains.
      3. If input parses as a domain, match against own-brand domains first.
      4. Else, match against project names.
      5. If both fail, return a failure with the list of tracked names so
         the frontend can show "we don't track that yet, try one of these".
    """
    async with PeecRestClient() as client:
        projects = await client.list_projects()
        if not projects:
            return MatchFailure(tracked_names=[])

        async def fetch_own_domain(p: dict) -> tuple[dict, list[str]]:
            try:
                brands = await client.get_brands(p["id"])
            except PeecError as e:
                logger.warning("brands fetch failed for %s: %s", p["id"], e)
                return p, []
            domains: list[str] = []
            for b in brands.get("data", []):
                if b.get("is_own"):
                    domains.extend(b.get("domains") or [])
            return p, domains

        per_project = await asyncio.gather(*(fetch_own_domain(p) for p in projects))

    input_domain = _normalize_domain(user_input)

    if input_domain:
        for project, own_domains in per_project:
            for d in own_domains:
                if _domain_matches(input_domain, d):
                    return MatchedProject(
                        project_id=project["id"],
                        name=project["name"],
                        own_domain=d,
                    )

    for project, own_domains in per_project:
        if _name_matches(user_input, project["name"]):
            return MatchedProject(
                project_id=project["id"],
                name=project["name"],
                own_domain=own_domains[0] if own_domains else None,
            )

    return MatchFailure(tracked_names=[p["name"] for p, _ in per_project])
