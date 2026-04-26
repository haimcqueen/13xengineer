import type {
  ActionOut,
  AgentKind,
  AgentResult,
  BrandStat,
  CompanyOut,
  JobOut,
  MarketStat,
  ProgressEvent,
  ResolveError,
} from "./types";

// ----- shared data --------------------------------------------------------

const LEGORA_BRAND_STATS: BrandStat[] = [
  { brand_id: "kw_fac1acf3", brand_name: "Harvey", visibility: 0.32, share_of_voice: 0.31, sentiment: 59, position: 4.1, mention_count: 14785, is_own: false },
  { brand_id: "kw_b3c53a7b", brand_name: "Luminance", visibility: 0.20, share_of_voice: 0.12, sentiment: 58, position: 5.1, mention_count: 5764, is_own: false },
  { brand_id: "kw_c5935219", brand_name: "Spellbook", visibility: 0.20, share_of_voice: 0.16, sentiment: 58, position: 5.3, mention_count: 7842, is_own: false },
  { brand_id: "kw_011d2338", brand_name: "Legora", visibility: 0.17, share_of_voice: 0.26, sentiment: 60, position: 3.0, mention_count: 12497, is_own: true },
  { brand_id: "kw_905e0e68", brand_name: "Clio Duo", visibility: 0.06, share_of_voice: 0.04, sentiment: 61, position: 6.2, mention_count: 2147, is_own: false },
  { brand_id: "kw_7c38ad73", brand_name: "Ironclad", visibility: 0.05, share_of_voice: 0.03, sentiment: 58, position: 5.7, mention_count: 1662, is_own: false },
  { brand_id: "kw_6131836f", brand_name: "LegalFly", visibility: 0.05, share_of_voice: 0.04, sentiment: 57, position: 4.3, mention_count: 2123, is_own: false },
  { brand_id: "kw_99cad6df", brand_name: "Streamline AI", visibility: 0.02, share_of_voice: 0.01, sentiment: 59, position: 6.5, mention_count: 613, is_own: false },
  { brand_id: "kw_69a8112f", brand_name: "Leah", visibility: 0.02, share_of_voice: 0.01, sentiment: 61, position: 7.2, mention_count: 520, is_own: false },
];

const LEGORA_MARKET_STATS: MarketStat[] = [
  { country_code: "US", country_name: "United States",  lat:  39.8, lng:  -98.6, prompt_count: 50, visibility: 0.18, position: 3.5 },
  { country_code: "GB", country_name: "United Kingdom", lat:  54.0, lng:   -2.0, prompt_count: 40, visibility: 0.16, position: 3.4 },
  { country_code: "DE", country_name: "Germany",        lat:  51.2, lng:   10.5, prompt_count: 35, visibility: 0.22, position: 2.9 },
  { country_code: "AT", country_name: "Austria",        lat:  47.5, lng:   14.0, prompt_count: 10, visibility: 0.20, position: 3.1 },
  { country_code: "CH", country_name: "Switzerland",    lat:  46.8, lng:    8.2, prompt_count: 10, visibility: 0.18, position: 3.2 },
  { country_code: "SE", country_name: "Sweden",         lat:  60.1, lng:   18.6, prompt_count: 15, visibility: 0.34, position: 2.4 },
  { country_code: "NO", country_name: "Norway",         lat:  60.5, lng:    8.5, prompt_count: 10, visibility: 0.27, position: 2.7 },
  { country_code: "DK", country_name: "Denmark",        lat:  56.0, lng:   10.0, prompt_count: 10, visibility: 0.24, position: 2.8 },
  { country_code: "FI", country_name: "Finland",        lat:  64.0, lng:   26.0, prompt_count: 10, visibility: 0.26, position: 2.6 },
  { country_code: "FR", country_name: "France",         lat:  46.6, lng:    2.2, prompt_count: 25, visibility: 0.15, position: 3.6 },
  { country_code: "ES", country_name: "Spain",          lat:  40.5, lng:   -3.7, prompt_count: 22, visibility: 0.18, position: 3.3 },
  { country_code: "PL", country_name: "Poland",         lat:  51.9, lng:   19.1, prompt_count: 15, visibility: 0.18, position: 3.4 },
  { country_code: "CA", country_name: "Canada",         lat:  56.1, lng: -106.3, prompt_count: 20, visibility: 0.13, position: 3.8 },
  { country_code: "AU", country_name: "Australia",      lat: -25.3, lng:  133.8, prompt_count: 20, visibility: 0.13, position: 3.9 },
  { country_code: "IN", country_name: "India",          lat:  20.6, lng:   79.0, prompt_count: 15, visibility: 0.10, position: 4.2 },
];

// ----- helpers ------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// ----- tracked companies --------------------------------------------------
//
// Only Legora is mocked. Every other input falls through to NoMatchView.
// The new ResolvingView animation is hardcoded for legora.com so adding
// other companies would mean reworking that view too.

export const TRACKED_COMPANIES = ["Legora"] as const;

const LEGORA: CompanyOut = {
  id: "c_legora",
  name: "Legora Project",
  own_domain: "legora.com",
  own_brand: {
    id: "b_legora",
    name: "Legora",
    domains: ["legora.com"],
    is_own: true,
  },
  topics: [
    { id: "t_legora_1", name: "Comparisons & Alternatives" },
    { id: "t_legora_2", name: "M&A & Due Diligence" },
    { id: "t_legora_3", name: "BigLaw & Enterprise" },
    { id: "t_legora_4", name: "EU & Compliance" },
    { id: "t_legora_5", name: "Workflows & Office Integration" },
  ],
  prompt_count: 421,
  last_refreshed_at: now(),
  brand_stats: LEGORA_BRAND_STATS,
  market_stats: LEGORA_MARKET_STATS,
  total_chats: 12597,
};

// ----- actions seed -------------------------------------------------------

const LEGORA_ACTIONS: ActionOut[] = [
  {
    id: "a_legora_1",
    category: "owned_media",
    kind: "article",
    title:
      "Publish 'AI Document Review for M&A Due Diligence: What Actually Works'",
    rationale:
      "Buyers searching 'AI document review M&A due diligence' are mid-deal evaluators with high commercial intent — and Legora is invisible on this query. The article opens on a $1.5M tax liability hidden by a fabricated AI citation (Bloomberg, Apr 2026), grounds the case for AI in McKinsey's 20% cost / 30-50% faster cycle data, and ends with the practitioner's checklist firms ask for. OWNED·ARTICLE shows 67% gap across 2,841 due-diligence citations.",
    opportunity: "high",
    target: {
      format: "article",
      topic: "AI document review M&A due diligence",
      audience: "M&A practitioners · GCs · deal counsel",
      draft_slug: "ai-document-review-ma-due-diligence",
      citations_in_category: 2841,
      publish_target: "legora.com/blog",
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_2",
    category: "owned_media",
    kind: "article",
    title: "Publish 'How to Evaluate Legal AI Tools: A 6-Dimension Framework'",
    rationale:
      "Individual lawyer AI adoption hit 69% in 2026 but only 34% of firms have formally adopted — managing partners are searching for a structured way to evaluate vendors. The article reframes evaluation around the dimensions that predict ROI (workflow integration, adoption, accuracy, security, cost, vendor quality) instead of a feature checklist. OWNED·ARTICLE shows 1,932 citations on this evaluation intent and Legora appears in zero of them.",
    opportunity: "high",
    target: {
      format: "article",
      topic: "evaluate legal AI tools framework",
      audience: "managing partners · innovation leads · IT decision-makers",
      draft_slug: "evaluate-legal-ai-tools-framework",
      citations_in_category: 1932,
      publish_target: "legora.com/blog",
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_3",
    category: "owned_media",
    kind: "article",
    title:
      "Publish 'Outside Counsel Guidelines Are Getting Stricter — Here's How Firms Are Adapting'",
    rationale:
      "50% of in-house teams now believe they're being overbilled, 79% are under pressure to cut spend, and OCGs have started covering AI disclosure, e-billing automation and mandatory AFAs. This article extends the 'billable hour' video into operational territory and is the natural pull-through for firms reading Kyle's piece. OWNED·ARTICLE shows 1,247 citations on OCG-AI intent — a topic where Legora's Word Add-in / governance story has a clear claim.",
    opportunity: "high",
    target: {
      format: "article",
      topic: "outside counsel guidelines AI",
      audience: "law firm partners · legal ops · GCs",
      draft_slug: "outside-counsel-guidelines-firms-adapting",
      citations_in_category: 1247,
      publish_target: "legora.com/blog",
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_4",
    category: "owned_media",
    kind: "code",
    title: "Add JSON-LD SoftwareApplication + FAQPage schema to legora.com",
    rationale:
      "OWNED·HOMEPAGE shows 62% gap despite legora.com being the #5 most-retrieved domain (1,819 retrievals). Structured data closes the 'cited as source but not mentioned as brand' gap.",
    opportunity: "high",
    target: {
      domain: "legora.com",
      schemas: ["SoftwareApplication", "FAQPage", "Organization"],
      current_homepage_retrievals: 1819,
    },
    suggested_agent: "code-pr",
  },
  {
    id: "a_legora_6",
    category: "owned_media",
    kind: "video",
    title:
      "Turn 'The billable hour isn't dying — AI is transforming it' into a 90-second explainer",
    rationale:
      "Kyle Poe's Mar 25 article makes a sharp, citable argument: AI doesn't kill the billable hour, it makes work predictable enough to price as fixed fees (72% of firms already offer alternatives, 90% at 50+ lawyer firms). UGC·YouTube and LinkedIn show 80% gap for this thesis — re-cutting the article as video opens a second citation surface for the same data points.",
    opportunity: "medium",
    target: {
      format: "thought-leadership video",
      duration_target_seconds: 90,
      source_article_url:
        "https://legora.com/blog/the-billable-hour-isnt-dying-but-ai-is-transforming-it",
      source_author: "Kyle Poe",
      source_published_at: "2026-03-25",
      feature_focus: "Billable hour, transformed",
      topic: "Billable hour · AI pricing",
    },
    suggested_agent: "video",
  },
  {
    id: "a_legora_7",
    category: "earned_media",
    kind: "listicle_inclusion",
    title: "Pitch tech-now.io for German legal-AI listicle inclusion",
    rationale:
      "EDITORIAL·LISTICLE drill-down identified tech-now.io's 'Top 10 Besten KI-Tools für Anwälte in Deutschland' as a high-leverage target. Legora's Munich office (Mar 2026) opens DACH market but isn't yet in the citation graph.",
    opportunity: "high",
    target: {
      publication: "tech-now.io",
      article_url: "https://tech-now.io/blog/top-10-besten-ki-tools-fur-anwalte-in-deutschland",
      market: "DACH",
      language: "de",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_8",
    category: "earned_media",
    kind: "editorial",
    title: "Pitch Reuters: counter-narrative to the Harvey $11B funding story",
    rationale:
      "EDITORIAL·ARTICLE drill-down identified the Reuters Harvey funding article as a top-cited Harvey article. Pitch a 'European challenger' angle (Series D, Munich/Toronto expansion) to the same publication.",
    opportunity: "high",
    target: {
      publication: "reuters.com",
      anchor_article: "https://reuters.com/technology/legal-software-firm-harvey-valued-11-billion-latest-funding-round-2026-03-25",
      angle: "European challenger expansion",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_9",
    category: "earned_media",
    kind: "subreddit",
    title: "Reply in r/Lawyertalk: 'best (and most reliable) legal AI/software'",
    rationale:
      "UGC·Reddit drill-down identified the exact thread by URL: reddit.com/r/Lawyertalk/comments/1c6os32. Score 3 high-intent thread — buyers asking the canonical evaluation question. Reply must be authentic-tone, peer-to-peer.",
    opportunity: "high",
    target: {
      subreddit: "Lawyertalk",
      thread_url: "https://reddit.com/r/Lawyertalk/comments/1c6os32/what_is_the_best_and_most_reliable_legal",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_10",
    category: "earned_media",
    kind: "youtube",
    title: "Outreach to Sam Mollaei, Esq. for sponsored Tabular Review demo",
    rationale:
      "UGC·YouTube drill-down identified Sam Mollaei (youtube.com/@sammollaei) as a high-leverage legal-AI YouTuber. His videos are cited by Gemini and Perplexity for product-evaluation queries.",
    opportunity: "medium",
    target: {
      channel: "Sam Mollaei, Esq.",
      channel_url: "https://www.youtube.com/channel/@sammollaei",
      format: "sponsored deep-dive demo",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_11",
    category: "earned_media",
    kind: "editorial",
    title: "LinkedIn collab with @lani-morand-a636524b",
    rationale:
      "UGC·LinkedIn drill-down surfaced @lani-morand-a636524b as a high-leverage individual creator. LinkedIn is the #2 most-retrieved UGC source (4,632 retrievals).",
    opportunity: "medium",
    target: {
      platform: "LinkedIn",
      handle: "@lani-morand-a636524b",
      profile_url: "https://www.linkedin.com/in/lani-morand-a636524b",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_12",
    category: "earned_media",
    kind: "editorial",
    title: "Update Wikipedia: Harvey (software) page + propose Legora article",
    rationale:
      "REFERENCE·Wikipedia at 100% gap. Harvey has a Wikipedia article; Legora doesn't. Wikipedia is one of the highest-trust sources LLMs cite. Requires neutral editing through a contributor, not direct brand edits.",
    opportunity: "low",
    target: {
      platform: "wikipedia.org",
      harvey_page: "https://en.wikipedia.org/wiki/Harvey_(software)",
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_13",
    category: "earned_media",
    kind: "editorial",
    title: "Take inspiration from G2's 'Top 10 Harvey AI Alternatives' review",
    rationale:
      "UGC·G2 drill-down identified g2.com/products/harvey-ai/competitors/alternatives as the canonical alternatives listing. G2 reviews are heavily cited.",
    opportunity: "low",
    target: {
      platform: "g2.com",
      anchor_url: "https://g2.com/products/harvey-ai/competitors/alternatives",
    },
    suggested_agent: null,
  },
];

// ----- matching ----------------------------------------------------------

function isLegora(input: string): boolean {
  const norm = input.trim().toLowerCase();
  return norm.includes("legora");
}

// ----- resolve stream ----------------------------------------------------

export type ResolveStreamHandlers = {
  onEvent: (e: ProgressEvent) => void;
  onDone: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

/** Simulates the SSE resolve stream. Returns a cancel function. */
export function startResolve(
  input: string,
  handlers: ResolveStreamHandlers,
): () => void {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  (async () => {
    if (!isLegora(input)) {
      await sleep(550);
      if (cancelled) return;
      handlers.onError({
        code: "no_match",
        message:
          "Only Legora is configured in this demo. The real version uses Claude Agent SDK to crawl any brand site.",
        tracked: [...TRACKED_COMPANIES],
      });
      return;
    }
    const company = LEGORA;
    const actions = LEGORA_ACTIONS;

    const events: ProgressEvent[] = [
      {
        t: now(),
        type: "project_matched",
        data: {
          company_id: company.id,
          name: company.name,
          own_domain: company.own_domain,
        },
      },
      { t: now(), type: "prompts_loaded", data: { count: company.prompt_count } },
      {
        t: now(),
        type: "brands_loaded",
        data: { count: 1, own_brand: company.own_brand },
      },
      { t: now(), type: "topics_loaded", data: { count: company.topics.length } },
      { t: now(), type: "actions_loaded", data: { count: actions.length } },
      { t: now(), type: "done", data: { company_id: company.id } },
    ];

    // Realistic-ish per-step delays
    const delays = [550, 520, 460, 420, 580, 280];

    for (let i = 0; i < events.length; i++) {
      await sleep(delays[i]);
      if (cancelled) return;
      handlers.onEvent({ ...events[i], t: now() });
    }
    handlers.onDone(company.id);
  })();

  return cancel;
}

// ----- company / actions accessors ---------------------------------------

export function getCompany(companyId: string): CompanyOut | null {
  return companyId === LEGORA.id ? LEGORA : null;
}

export function getActions(companyId: string): ActionOut[] {
  return companyId === LEGORA.id ? LEGORA_ACTIONS : [];
}

// ----- agent jobs --------------------------------------------------------

const jobs = new Map<string, JobOut>();

function buildResult(action: ActionOut, company: CompanyOut): AgentResult {
  switch (action.suggested_agent) {
    case "article": {
      const topic =
        (action.target.topic as string | undefined) ?? "your tracked topic";
      const title = action.title
        .replace(/^Publish a how-to:\s*/i, "")
        .replace(/^Write a how-to article about\s*/i, "");
      const markdown = generateMockArticle(title, topic, action.rationale ?? "", company.name);
      return {
        type: "article",
        title,
        markdown,
        word_count_estimate: 2100,
      };
    }
    case "video": {
      const duration = Number(action.target.duration_target_seconds ?? 90);
      const isLegora = /legora/i.test(company.name);
      return {
        type: "video",
        title: action.title,
        duration_seconds: duration,
        video_url: isLegora
          ? "/videos/jude_law.mp4"
          : `https://demo.midas.local/videos/${company.id}/preview.mp4`,
        thumbnail_url: `https://demo.midas.local/videos/${company.id}/thumb.jpg`,
        storyboard: [
          "Open on a 60-page contract on screen.",
          `Cut to ${company.name} interface — start review.`,
          "Highlight key clauses being flagged.",
          "Show timer: 4:32 elapsed.",
          "Closing card with CTA.",
        ],
      };
    }
    case "code-pr": {
      const domain =
        (action.target.domain as string | undefined) ??
        company.own_domain ??
        "example.com";
      const schemas =
        (action.target.schemas as string[] | undefined) ?? ["Product", "FAQPage"];
      const diff = [
        "diff --git a/index.html b/index.html",
        "@@ -10,6 +10,28 @@",
        '   <meta charset="UTF-8" />',
        `+  <script type="application/ld+json">`,
        "+    {",
        '+      "@context": "https://schema.org",',
        `+      "@type": "${schemas[0]}",`,
        `+      "name": "${company.name}",`,
        `+      "url": "https://${domain}"`,
        "+    }",
        "+  </script>",
      ].join("\n");
      return {
        type: "code-pr",
        title: action.title,
        repo: `${company.name.toLowerCase().replace(/\s+/g, "-")}/website`,
        branch: "midas/structured-data",
        pr_url: `https://github.com/demo/${company.id}/pull/42`,
        files_changed: ["index.html", "src/components/SEO.tsx"],
        diff_preview: diff,
        schemas_added: schemas,
      };
    }
    default:
      throw new Error("Action has no suggested agent");
  }
}

/**
 * Kicks off a mock agent job.
 * Mirrors backend behavior: returns a job_id immediately, status transitions
 * pending → running → done over ~2.5s, with progress events appended.
 */
export function startAgentRun(action: ActionOut, company: CompanyOut): string {
  if (!action.suggested_agent) throw new Error("Action has no suggested agent");
  const jobId = id("j");
  const job: JobOut = {
    id: jobId,
    kind: "agent_run",
    status: "pending",
    progress: [{ t: now(), type: "queued", data: {} }],
    result: null,
    error: null,
    error_code: null,
  };
  jobs.set(jobId, job);

  const agent = action.suggested_agent;
  const stages = stageLabels(agent);

  // Schedule transitions — articles have 4 stages so take longer
  const startedAt = Date.now();
  const stageInterval = agent === "article" ? 1200 : 800;

  setTimeout(() => {
    const j = jobs.get(jobId);
    if (!j) return;
    j.status = "running";
    j.progress.push({ t: now(), type: "running", data: { agent } });
  }, 300);

  for (let i = 0; i < stages.length; i++) {
    setTimeout(() => {
      const j = jobs.get(jobId);
      if (!j) return;
      j.progress.push({ t: now(), type: "stage", data: { label: stages[i] } });
    }, 800 + i * stageInterval);
  }

  setTimeout(
    () => {
      const j = jobs.get(jobId);
      if (!j) return;
      j.status = "done";
      j.progress.push({ t: now(), type: "done", data: {} });
      j.result = buildResult(action, company) as unknown as Record<
        string,
        unknown
      >;
    },
    800 + stages.length * stageInterval + 600,
  );

  // (startedAt unused but useful if we later add elapsed time.)
  void startedAt;

  return jobId;
}

export function getJob(jobId: string): JobOut | null {
  return jobs.get(jobId) ?? null;
}

function generateMockArticle(title: string, topic: string, _rationale: string, companyName: string): string {
  return [
    `# ${title}`,
    ``,
    `Every law firm faces the same question: how do we adopt AI without losing what makes us valuable? The answer depends on where you start.`,
    ``,
    `## The Problem`,
    ``,
    `Most firms know they need to act on ${topic.toLowerCase()}. Few know where to begin. The gap between "we should use AI" and "AI is embedded in our workflows" is where competitive advantage lives.`,
    ``,
    `## What the Data Shows`,
    ``,
    `| Metric | Industry Average | Top Performers |`,
    `|--------|-----------------|----------------|`,
    `| AI adoption rate | 21% firm-wide | 80%+ (BAHR with ${companyName}) |`,
    `| Daily active usage | 8% of lawyers | 30%+ |`,
    `| Time saved per matter | 15-20% | 40-60% |`,
    `| Client satisfaction impact | Neutral | +22% NPS |`,
    ``,
    `The firms seeing real results share a common pattern: they started with a specific workflow, proved value, then expanded.`,
    ``,
    `## How Leading Firms Approach ${topic}`,
    ``,
    `### 1. Start with the workflow, not the tool`,
    ``,
    `The most common mistake is buying an AI tool and asking lawyers to find uses for it. The firms that succeed start with a painful workflow (document review, contract markup, research synthesis) and work backward to the tool that solves it.`,
    ``,
    `### 2. Measure adoption, not licenses`,
    ``,
    `A tool that 80% of lawyers use daily is worth more than one that 5% of lawyers use weekly. The cost per adopted user matters more than the cost per seat.`,
    ``,
    `### 3. Embed AI in existing tools`,
    ``,
    `Lawyers live in Word and their DMS. Any AI that requires switching to a separate interface will see low adoption. The tools that succeed integrate directly into the lawyer's existing workflow.`,
    ``,
    `### 4. Build institutional knowledge, not individual shortcuts`,
    ``,
    `When one lawyer uses ChatGPT to draft a clause, that knowledge dies with the session. When a firm uses a collaborative AI platform, every review, every markup preference, every precedent becomes institutional memory.`,
    ``,
    `## The Comparison Landscape`,
    ``,
    `| Capability | ${companyName} | Harvey | CoCounsel | Luminance |`,
    `|-----------|--------|--------|-----------|-----------|`,
    `| Document review at scale | ✅ Tabular Review | ✅ | ✅ | ✅ |`,
    `| Word integration | ✅ Native add-in | ❌ | ✅ | ❌ |`,
    `| DMS integration | ✅ iManage + SharePoint | ⚠️ Limited | ✅ | ✅ |`,
    `| Collaborative workflows | ✅ Real-time | ❌ | ❌ | ⚠️ Limited |`,
    `| Adoption rate evidence | 80% at BAHR | Not disclosed | Not disclosed | Not disclosed |`,
    ``,
    `## What This Means for Your Firm`,
    ``,
    `The question is no longer whether to adopt AI for ${topic.toLowerCase()}. The question is whether you'll be the firm that figures it out first, or the one that follows.`,
    ``,
    `The firms moving fastest share three traits: they chose a tool that embeds into existing workflows, they measured adoption rather than procurement, and they treated AI as a collaborative layer rather than a replacement.`,
    ``,
    `## FAQ`,
    ``,
    `### How long does it take to implement AI document review?`,
    ``,
    `Most firms see initial results within 2-4 weeks. Full workflow integration, including DMS connectivity and team training, typically takes 6-8 weeks.`,
    ``,
    `### What's the ROI of AI-assisted legal work?`,
    ``,
    `Firms report 40-60% time savings on routine document review and research tasks. The bigger ROI is competitive: firms using AI can offer fixed-fee pricing with confidence, winning work from firms that can't.`,
    ``,
    `### Is AI-generated legal work reliable enough for client delivery?`,
    ``,
    `AI excels at first-pass review, pattern recognition, and consistency checking. Human judgment remains essential for strategy, negotiation, and novel legal questions. The best implementations use AI for the 80% that's routine and free lawyers for the 20% that requires expertise.`,
    ``,
    `### How do we handle data security concerns?`,
    ``,
    `Enterprise legal AI platforms use private cloud deployments, SOC 2 compliance, and client-matter isolation. No client data is used for model training. Check that your vendor provides audit trails and data residency controls.`,
    ``,
    `### What should we look for when evaluating legal AI vendors?`,
    ``,
    `Adoption rates matter more than feature lists. Ask for reference customers and their daily active usage numbers. A tool with fewer features but 80% adoption will deliver more value than a feature-rich tool that 5% of your lawyers use.`,
    ``,
    `---`,
    ``,
    `*Generated by the MIDAS article pipeline (brief → research → outline → article).*`,
  ].join("\n");
}

function stageLabels(agent: AgentKind): string[] {
  switch (agent) {
    case "article":
      return [
        "Researching keywords & intent",
        "Deep research & data collection",
        "Structuring the article",
        "Writing the full article",
      ];
    case "video":
      return ["Drafting storyboard", "Selecting shots", "Rendering preview"];
    case "code-pr":
      return ["Cloning repo", "Generating diff", "Opening pull request"];
  }
}
