# Felix — frontend integration guide

This document describes the contract the backend exposes to the frontend so the
two can be developed in parallel. It is written for the agent doing the
frontend redesign.

## Product shape (one paragraph)

Felix extends Peec.ai. The user lands on a single screen, types a company name
or URL, and is taken to an "insights" screen showing prioritized actions Peec
suggests for that company's brand visibility. Each action can optionally be
handed to one of three downstream agents (article writer, video generator,
code/PR raiser) which produce concrete deliverables.

## Two screens, in order

1. **Onboarding (single input).** Centred logo, short headline, one rounded
   text input. The user enters either a company name (e.g. `Legora`) or a
   domain (e.g. `legora.com`). On Enter, transition smoothly to the Insights
   screen — the transition begins immediately, *before* data finishes loading.
2. **Insights.** Header with the resolved company. Body shows actions grouped
   by category (Owned Media / Earned Media), sorted by opportunity
   (high → low). Each action card has a "Run" button when
   `suggested_agent !== null`.

## Backend endpoints the frontend calls

All endpoints are served from the backend at `http://localhost:8000`. The Vite
dev server proxies `/api/*` and `/health` to it.

### 1. Resolve a company

```
POST /api/companies/resolve
body: { "input": "legora.com" }
→ 202 { "job_id": "j_…", "company_id": "c_…" | null }
```

Always returns immediately. `company_id` is non-null only on a fresh cache
hit; otherwise the frontend should wait on the SSE stream.

### 2. Stream resolution progress

```
GET /api/companies/resolve/stream?job_id=j_…
→ text/event-stream
```

Events emitted, in order, on a cold resolve:

| event              | data                                              |
|--------------------|---------------------------------------------------|
| `project_matched`  | `{ company_id, name, own_domain }`                |
| `prompts_loaded`   | `{ count }`                                       |
| `brands_loaded`    | `{ count, own_brand: { name, domains[] } }`       |
| `topics_loaded`    | `{ count }`                                       |
| `actions_loaded`   | `{ count }`                                       |
| `done`             | `{ company_id }`                                  |
| `error`            | `{ message, code }` *(terminal)*                  |

The transition screen should render as soon as `project_matched` arrives. The
remaining events drive a small progress affordance ("Pulling prompts…",
"Reading brand presence…", "Generating actions…"). After `done`, navigate
to the insights view and call the next two endpoints.

On cache hit (cached `company_id` returned by POST), the SSE stream still
fires but every event is sent in the same tick — frontend can either skip
streaming and call the GETs directly, or run the same stream code path; both
work.

### 3. Get the company snapshot

```
GET /api/companies/{company_id}
→ 200 CompanyOut
```

```ts
type CompanyOut = {
  id: string
  name: string                     // Peec project name, e.g. "Legora Project"
  own_domain: string | null        // "legora.com"
  own_brand: BrandOut | null
  topics: TopicOut[]
  prompt_count: number
  last_refreshed_at: string        // ISO 8601
}
```

### 4. Get actions for the company

```
GET /api/companies/{company_id}/actions
→ 200 ActionOut[]
```

```ts
type ActionOut = {
  id: string
  category: 'owned_media' | 'earned_media'
  kind: string                     // 'article' | 'listicle' | 'subreddit' | …
  title: string                    // human-readable, render as the card title
  rationale: string | null
  opportunity: 'low' | 'medium' | 'high'
  target: Record<string, unknown>  // opaque blob — show selectively if you want
  suggested_agent: 'article' | 'video' | 'code-pr' | null
}
```

`suggested_agent === null` means we don't have an agent for this kind of
action yet — the card should still render, just without a Run button.

### 5. Run an agent on an action

```
POST /api/agents/{kind}/run
  kind ∈ { article, video, code-pr }
body: { "action_id": "a_…" }
→ 202 { "job_id": "j_…" }
```

### 6. Poll a job

```
GET /api/jobs/{job_id}
→ 200 JobOut
```

```ts
type JobOut = {
  id: string
  kind: 'resolve_company' | 'agent_run'
  status: 'pending' | 'running' | 'done' | 'failed'
  progress: ProgressEvent[]
  result: Record<string, unknown> | null
  error: string | null
}
```

For agent jobs the frontend should poll every ~1.5 s. We may add SSE for
agent jobs later; the polling contract will keep working.

## What the frontend does NOT need to do

- **No Peec credentials.** The backend holds `PEEC_API_KEY` server-side. The
  frontend never sees Peec or talks to `api.peec.ai` directly.
- **No company creation flow.** Peec doesn't expose project creation via API;
  if `resolve` finds no match, the SSE stream emits an `error` event with
  `code: "no_match"` and a list of tracked company names in the message
  payload. The frontend should show "We don't track that company yet — try
  one of these:" with the list.
- **No auth.** Hackathon scope. One implicit user.

## Minimum viable user input

The whole product is one form field. The user types **one string** —
a company name OR a domain — and Enter. That's the full input surface for
the entire path from landing to seeing actions. (Agent runs are
single-button; no extra inputs.) See the design spec for the rationale on
keeping it this small.

## Demo target

**Legora** (`legora.com`). Has 30 prompts, 1 own brand, 1 topic in the
Peec account. Other tracked companies: BMW, Revolut, Mindspace, Nothing
Phone — all should resolve.
