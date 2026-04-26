"""Hackathon-trim synthesizers for the heavy Peec /reports/* endpoints.

The frontend only consumes the joined output (`brand_stats`, `market_stats`)
that `routers/companies.py` builds from `brand_report` + `market_report`.
The real /reports/* calls are slow (~3-8s) and they're not even running for
the active demo, so we synthesize believable values from the cheap, real
`/brands` payload + a curated country list.

Returns the same shape the real Peec endpoints return so the joining logic
in `routers/companies.py` doesn't change.
"""

from __future__ import annotations

import hashlib
import math


# Curated demo markets — same set the frontend mock uses, so the globe
# always has something to render.
_DEMO_MARKETS: list[tuple[str, float, float]] = [
    # (country_code, base_visibility, base_position)
    ("US", 0.18, 3.5),
    ("GB", 0.16, 3.4),
    ("DE", 0.22, 2.9),
    ("AT", 0.20, 3.1),
    ("CH", 0.18, 3.2),
    ("SE", 0.34, 2.4),
    ("NO", 0.27, 2.7),
    ("DK", 0.24, 2.8),
    ("FI", 0.26, 2.6),
    ("FR", 0.15, 3.6),
    ("ES", 0.18, 3.3),
    ("PL", 0.18, 3.4),
    ("CA", 0.13, 3.8),
    ("AU", 0.13, 3.9),
    ("IN", 0.10, 4.2),
]


def _seed(s: str) -> float:
    """Deterministic 0..1 from a string."""
    h = hashlib.md5(s.encode()).digest()
    return int.from_bytes(h[:4], "big") / 0xFFFFFFFF


def synthesize_brand_report(brands: dict) -> dict:
    """Build a realistic-looking /reports/brands payload from /brands.

    Strategy: own brand sits at moderate visibility (~17%); top competitor
    leads (~32%); others taper down. Deterministic per brand_id so refreshes
    don't shuffle the order.
    """
    data = (brands or {}).get("data", [])
    if not data:
        return {"data": []}

    own = [b for b in data if b.get("is_own")]
    others = [b for b in data if not b.get("is_own")]
    # Stable ordering: by descending seed → looks chosen, not random.
    others.sort(key=lambda b: -_seed(b.get("id") or b.get("name") or ""))

    rows: list[dict] = []
    n = len(others)
    for i, b in enumerate(others):
        # 0.32 → 0.04 across the competitor list
        vis = round(max(0.04, 0.32 - (i / max(1, n - 1)) * 0.28), 3)
        rows.append(
            _brand_row(
                b,
                visibility=vis,
                position=round(4.0 + i * 0.4, 1),
                sentiment=58 + (i % 4),
                mention_count=int(max(500, 16000 - i * 1800)),
            )
        )

    for b in own:
        rows.append(
            _brand_row(
                b,
                visibility=0.17,
                position=3.0,
                sentiment=60,
                mention_count=12500,
            )
        )

    # Total — used by routers/companies.py for total_chats. Sum of mentions
    # is a reasonable stand-in for visibility_total.
    total = sum(int(r.get("mention_count") or 0) for r in rows)
    for r in rows:
        r["visibility_total"] = total

    rows.sort(key=lambda r: -float(r["visibility"]))
    return {"data": rows}


def _brand_row(
    b: dict,
    *,
    visibility: float,
    position: float,
    sentiment: float,
    mention_count: int,
) -> dict:
    return {
        "brand": {"id": b.get("id"), "name": b.get("name")},
        "visibility": float(visibility),
        "share_of_voice": round(float(visibility) * 0.92, 3),
        "sentiment": float(sentiment),
        "position": float(position),
        "mention_count": int(mention_count),
    }


def synthesize_market_report(brands: dict, project_id: str) -> dict:
    """Per-country breakdown for the OWN brand only.

    Returns rows with `country_code`, `visibility`, `position`. The country
    name + lat/lng are joined back in by `routers/companies.py` from its
    static `_COUNTRIES` table, so we don't include geometry here.
    """
    own = next(
        (b for b in (brands or {}).get("data", []) if b.get("is_own")),
        None,
    )
    if not own:
        return {"data": []}

    own_id = own.get("id")
    own_name = own.get("name")
    seed = _seed(project_id or "default")

    rows: list[dict] = []
    for i, (cc, base_vis, base_pos) in enumerate(_DEMO_MARKETS):
        # Per-project wobble so different projects look different on the globe.
        wobble = math.sin(seed * 13.7 + i * 1.3) * 0.04
        vis = max(0.05, min(0.45, base_vis + wobble))
        pos = max(2.0, min(7.0, base_pos - wobble * 4))
        rows.append(
            {
                "brand": {"id": own_id, "name": own_name},
                "country_code": cc,
                "visibility": round(vis, 3),
                "position": round(pos, 2),
                "share_of_voice": round(vis * 0.92, 3),
                "mention_count": int(max(80, (1.0 - i * 0.05) * 5000)),
            }
        )
    return {"data": rows}
