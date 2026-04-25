# Actions feed redesign

**Date:** 2026-04-26
**Scope:** Frontend only. Mock backend stays in place; real API wiring is out of scope.
**Goal:** Make the actions list the centerpiece of the workspace, with each action clearly tied to the agent that runs it.

## Why

Today the workspace opens on an Overview pane (KPIs + globe + brand standings) and actions are scattered across 8 sidebar entries (`Owned`, `Earned`, plus six `Studio` sub-tabs by kind). Attention is diffused, the agent that runs each action is buried in a small mono-text label, and the run experience is a generic centered modal that doesn't make the user feel like they're "deploying an agent."

The product premise is simpler than the UI suggests: the user wants to know *what to do to improve their AI visibility*, and *deploy an agent to do it*. Everything else is context.

## Outcome

- Default workspace view becomes a single ranked **Actions feed**, sorted by opportunity (high → medium → low).
- The 8 action-related sidebar entries collapse into one primary `Actions` entry. Insights views (Overview, Brands, Markets) demote to a secondary group.
- Each action card visibly belongs to one of three agents (Article · Video · Website) or a Manual brief, with agent identity load-bearing.
- Clicking an action opens a right-side panel (~55% viewport) that runs the agent and renders a per-agent result, including a real `<video>` element for the video agent.
- Completed actions show a green Done state; the result remains viewable.

## Information architecture

### `WorkspaceView` becomes:

```ts
type WorkspaceView = "actions" | "overview" | "brands" | "domains" | "markets";
```

Default: `actions`.

The following entries are **deleted**: `owned`, `earned`, `studio-articles`, `studio-comparisons`, `studio-outreach`, `studio-community`, `studio-code`, `studio-videos`. Their corresponding `*Pane` components in `Workspace.tsx` are removed (`ActionsPane`, `StudioPane`).

### Sidebar

```
┌─────────────────────────┐
│  Felix mark · X reset   │
│  [ Project pill ]       │
├─────────────────────────┤
│  ACTIONS                │   ← primary, default. Badge = count of pending actions.
│    > Actions    (n)     │
├─────────────────────────┤
│  INSIGHTS               │   ← secondary, positioned below Actions
│    Overview             │
│    Brands       (n)     │
│    Domains              │
│    Markets      (n)     │
├─────────────────────────┤
│  prompts · chats        │
└─────────────────────────┘
```

`Section` and `NavItem` components are reused unchanged. The Insights group is differentiated only by position (below Actions) and the existing muted section-label style — no new opacity/sizing tweaks.

### Overview pane (demoted)

`OverviewPane` stays, but the **"Ship this week" 3-card top-actions section is removed** — it's redundant with the new Actions feed. Keep KPI tiles, MarketGlobe, and BrandStrip. `ActionCardCompact` becomes unused after this and is **deleted**.

`BrandsPane`, `MarketsPane`, `PlaceholderPane` (Domains) stay as-is.

## Actions feed (new primary view)

A new `ActionsView` component replaces the old `OverviewPane` as the default. Layout, top to bottom:

### 1. Header

- `Actions` eyebrow (uppercase tracking, same style as today's `PaneFrame`)
- Hero title: "What to ship for **{brandName}**" (display font, large)
- Right side: refreshed timestamp

### 2. KPI strip

3-column strip of the same hero KPIs from Overview (Visibility, Avg position, Gap to leader). Reuses `KPITile` + `LGCard` unchanged, in a `grid grid-cols-3 gap-3` container (vs. Overview's `gap-5`). Same `cornerRadius={20}` on `LGCard`. Purpose: anchors *why* the actions matter without leaving the feed.

### 3. Filter row

Pill chips, single row:

```
[ All (n) ]  [ ✍ Article (n) ]  [ ▶ Video (n) ]  [ </> Website (n) ]  [ ✉ Manual (n) ]
```

Counts reflect the full action list. Active filter chip uses `--blue` ring; inactive chips use `--border`. Click toggles the filter; "All" clears it.

`Article` filters by `suggested_agent === "article"`. `Video` filters by `suggested_agent === "video"`. `Website` filters by `suggested_agent === "code-pr"`. `Manual` filters by `suggested_agent === null`.

### 4. Tier-grouped feed

Sort: by `OPP_RANK[opportunity]`, stable. Within the sorted list, render thin section dividers between tiers:

```
─── HIGH · 3 ────────────────────────────
  [ ActionCard ]
  [ ActionCard ]
  [ ActionCard ]
─── MEDIUM · 5 ──────────────────────────
  [ ActionCard ]
  ...
─── LOW · 2 ─────────────────────────────
  [ ActionCard ]
  ...
```

Divider markup: a horizontal rule using `var(--border)` with the label centered or left-aligned in uppercase mono tracking, matching today's `PaneFrame` eyebrow style.

Single column inside a `max-w-[720px] mx-auto` container in the main area. One card per row. The current 2/3-column grid is removed — actions are meant to be read, not skimmed.

### 5. Empty state

If a filter yields zero rows: existing `EmptyState` component, copy adapted to the active filter ("No video actions in this snapshot").

## ActionCard redesign

Per-card layout:

```
┌──────────────────────────────────────────────────────┐
│  [✍ Article agent]                       [HIGH ✦]   │  ← agent badge + opportunity
│                                                      │
│  Publish a how-to: AI-assisted contract review       │  ← title, large display
│                                                      │
│  Lawyers searching for "AI contract review tools"    │  ← rationale, muted
│  see Harvey and Spellbook ranked above Legora; a     │
│  how-to with concrete examples closes the gap.       │
│                                                      │
│  [Topic: Contract Review]  [Format: How-to]          │  ← target chips, compact
│                                                      │
│  ───────────────────────────────────────────────     │
│  [          ✍ Draft article           →   ]          │  ← full-width agent CTA
└──────────────────────────────────────────────────────┘
```

### Agent badge (top-left)

A new small reusable component `AgentBadge` with this signature:

```tsx
type AgentBadgeProps = {
  agent: AgentKind | null;
  size?: "sm" | "md";   // sm = card badge, md = run-panel header
};
```

Renders `icon + label + tinted background` per agent:

| `agent` | Icon | Label | Background |
|---|---|---|---|
| `"article"` | `FileText` | `Article agent` | `rgba(199, 122, 122, 0.14)` (warm rose) |
| `"video"` | `Play` | `Video agent` | `rgba(87, 79, 97, 0.16)` (plum) |
| `"code-pr"` | `Code` | `Website agent` | `rgba(30, 91, 201, 0.10)` (blue) |
| `null` | `MessageSquare` | `Manual brief` | transparent, `border` outline using `var(--border-strong)` |

Icon color matches the strongest tone of each tint (rose-warm / plum / blue / muted). Three distinct quiet tints + one bare outline — the goal is at-a-glance recognition, not strong color blocking.

### Opportunity chip (top-right)

Existing `OpportunityChip` reused, no change.

### Title / rationale / target chips

Same as today (display font, muted rationale, mono target chips). Rationale gets `line-clamp-3` so cards stay uniform height.

### CTA (bottom)

Full-width button (replaces today's text-link CTA), agent-accented background. Verb is per agent:

| Agent | Verb (idle) | Verb (completed) |
|---|---|---|
| article | `Draft article` | `View article` |
| video | `Generate video` | `Watch video` |
| code-pr | `Open pull request` | `View pull request` |
| null (manual) | `Open brief` | `View brief` |

The completed-state CTA uses green text + `CheckCircle2` icon (extends the existing pattern — today's `ActionCard` already does this for articles, but with the wrong verb for non-article agents; this fixes it).

The whole card remains clickable as a fallback (existing behavior). The CTA is the visual hierarchy.

## Side-panel run experience

`AgentRunPanel.tsx` is restyled from a centered modal to a right-side takeover.

### Container

- Position: `fixed`, `right-0`, `top-0`, `bottom-0`
- Width: `min(55vw, 880px)`, min-width 600px
- Backdrop: existing full-viewport dim layer (kept), click-to-close, Esc-to-close. The backdrop sits under the panel, dimming the rest of the workspace (~45% on the left)
- Slide animation: `initial={{ x: 60, opacity: 0 }}`, `animate={{ x: 0, opacity: 1 }}`, exit reverses. Same `[0.22, 1, 0.36, 1]` ease as elsewhere.
- Shell: `GlassPanel strong`, full height, scrollable body

### Header (sticky)

- Status icon (existing: spinner / check / X)
- `AgentBadge` (same component as on the card — re-use for consistency)
- Action title beneath the badge, display font
- Close button (X) on the right

### Body — running

Existing `Stages` component, **no change** — it already pulls per-agent labels from `ALL_STAGE_LABELS` (article: 4 steps, video: 3, code-pr: 3). Done=green check, active=blue spinner, pending=dim dot.

### Body — done

Existing `ResultBody` dispatch, **no change to article** (markdown via react-markdown, Copy + Post to blog buttons stay), **two changes**:

- **`VideoBody`**: replace the fake play-button placeholder with a real `<video controls preload="metadata">` element pointing at `result.video_url`. Storyboard list stays below.
- **`CodePrBody`**: no functional change, just verify it fits the side-panel width (the diff `<pre>` already has `max-h-[40vh] overflow-y-auto`).

### Body — manual brief

If the action has `suggested_agent === null`, the panel skips stages entirely. Body shows:

- Full action rationale (no truncation)
- `target` metadata as a structured key/value list (not chips)
- A `Mark as done` button at the bottom — when clicked, calls `onDone(action.id)` (same callback used by the agent-run path) and closes the panel.

Re-opening a Done manual brief shows the same content with a green Done strip at the top. Completed state is sticky for the session — no "Mark as not done" affordance, matching the runnable-agent flow where re-opening a done card just re-shows the result.

## Mock backend & video asset

### Video file

Currently on disk: `videos/jude_law.mp4` (~146 MB) at repo root. This is the demo video for the Legora video action.

Copy it to `frontend/public/videos/jude_law.mp4` so Vite serves it at `/videos/jude_law.mp4`. The repo-root file stays in place for now — duplication is fine for the hackathon. **Add `frontend/public/videos/` to `.gitignore`** to avoid committing the 146 MB blob; the file is treated as a local asset for the demo.

### `mockBackend.ts`

In `buildResult(action, company)` for the `video` case, set `video_url` based on company:

- For Legora: `/videos/jude_law.mp4`
- For others: keep current placeholder thumbnail behavior (no real video file)

The existing `VideoResult.thumbnail_url` stays — it's used as a `<video poster=...>` fallback.

Other mock behavior (timing, stage labels, article markdown, completed state propagation) stays as-is.

## Files touched

| File | Change |
|---|---|
| `frontend/src/views/Workspace.tsx` | Heavy refactor: new `WorkspaceView` enum, default to `actions`, new `ActionsView` component (inline or extracted), remove `ActionsPane` and `StudioPane`, strip "Ship this week" from `OverviewPane` |
| `frontend/src/components/Sidebar.tsx` | Heavy refactor: remove all `owned`/`earned`/`studio-*` `NavItem`s, add primary `Actions` entry, demote Insights group |
| `frontend/src/components/ActionCard.tsx` | Refactor: new layout, integrate `AgentBadge`, full-width agent-accent CTA, agent-aware completed verbs |
| `frontend/src/components/AgentBadge.tsx` | **New**: reusable agent identity chip (icon + label + tint), used on cards and in the run panel header |
| `frontend/src/components/AgentRunPanel.tsx` | Restyle to right-side panel: positioning, sizing, slide animation; integrate `AgentBadge` in header; replace `VideoBody` placeholder with real `<video>`; add manual-brief variant |
| `frontend/src/lib/mockBackend.ts` | Set `VideoResult.video_url` to `/videos/jude_law.mp4` for Legora |
| `frontend/src/components/ActionCardCompact.tsx` | **Delete** (no remaining consumers) |
| `frontend/public/videos/jude_law.mp4` | **New**: copy from repo-root `videos/jude_law.mp4` (gitignored) |
| `.gitignore` | Add `frontend/public/videos/` |

## Out of scope

- Real backend wiring (the `lib/api.ts` calls against `/api/companies/*` and `/api/agents/*`). Mock backend stays.
- Restructuring the `improvement` → `code-pr` two-step pipeline on the backend. Frontend treats `suggested_agent === "code-pr"` as one logical "Website agent."
- Detailed redesign of `OverviewPane`, `BrandsPane`, `MarketsPane`. They keep their current implementations.
- Bulk action operations (run multiple, queue, retry).
- Any persistence of completed state across reloads. `Set<string>` in workspace state is fine.
- Real "Post to blog" integration — the existing fake loading→done flow is kept.
- Changes to the `Domains` placeholder pane.

## Acceptance

- `npm run dev` opens the workspace on the Actions feed by default for a resolved Legora company.
- Sidebar shows 1 primary entry (Actions) and 4 secondary (Overview, Brands, Domains, Markets). All Studio/Owned/Earned entries are gone.
- Filtering by Article / Video / Website / Manual narrows the feed correctly.
- Tier dividers ("HIGH · n", "MEDIUM · n", "LOW · n") render between groups.
- Each card shows a per-agent badge in its corresponding tint and a per-agent CTA verb.
- Clicking a runnable action slides in the right-side panel, plays the existing per-agent stage animation, and renders the per-agent result. Closing the panel returns to the feed.
- For the Legora video action specifically, the result body plays `/videos/jude_law.mp4` in a real `<video controls>` element.
- Completed actions show a green Done state; reopening shows the result with the agent-aware "View {kind}" CTA.
- Manual brief actions open the panel with no stages, show the brief, and the "Mark as done" button updates the card.
- `npm run lint` and `npm run build` both pass.
