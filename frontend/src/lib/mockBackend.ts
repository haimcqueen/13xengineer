import type {
  ActionOut,
  AgentKind,
  AgentResult,
  CompanyOut,
  JobOut,
  ProgressEvent,
  ResolveError,
} from "./types";

// ----- helpers ------------------------------------------------------------

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();
const id = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 10)}`;

// ----- tracked companies --------------------------------------------------

export const TRACKED_COMPANIES = [
  "Legora",
  "BMW",
  "Revolut",
  "Mindspace",
  "Nothing Phone",
] as const;

type CompanyKey = "legora" | "bmw" | "revolut" | "mindspace" | "nothing-phone";

const COMPANIES: Record<CompanyKey, CompanyOut> = {
  legora: {
    id: "c_legora",
    name: "Legora Project",
    own_domain: "legora.com",
    own_brand: {
      id: "b_legora",
      name: "Legora",
      domains: ["legora.com"],
      is_own: true,
    },
    topics: [{ id: "t_legora_1", name: "AI-powered document review tools" }],
    prompt_count: 30,
    last_refreshed_at: now(),
  },
  bmw: {
    id: "c_bmw",
    name: "BMW",
    own_domain: "bmw.com",
    own_brand: {
      id: "b_bmw",
      name: "BMW",
      domains: ["bmw.com", "bmw.de"],
      is_own: true,
    },
    topics: [
      { id: "t_bmw_1", name: "Premium electric vehicles" },
      { id: "t_bmw_2", name: "Luxury car comparisons" },
    ],
    prompt_count: 18,
    last_refreshed_at: now(),
  },
  revolut: {
    id: "c_revolut",
    name: "Revolut",
    own_domain: "revolut.com",
    own_brand: {
      id: "b_revolut",
      name: "Revolut",
      domains: ["revolut.com"],
      is_own: true,
    },
    topics: [{ id: "t_revolut_1", name: "Digital banking in Europe" }],
    prompt_count: 22,
    last_refreshed_at: now(),
  },
  mindspace: {
    id: "c_mindspace",
    name: "Mindspace",
    own_domain: "mindspace.me",
    own_brand: {
      id: "b_mindspace",
      name: "Mindspace",
      domains: ["mindspace.me"],
      is_own: true,
    },
    topics: [{ id: "t_mindspace_1", name: "Coworking and flex office space" }],
    prompt_count: 14,
    last_refreshed_at: now(),
  },
  "nothing-phone": {
    id: "c_nothing",
    name: "Nothing Phone",
    own_domain: "nothing.tech",
    own_brand: {
      id: "b_nothing",
      name: "Nothing",
      domains: ["nothing.tech"],
      is_own: true,
    },
    topics: [{ id: "t_nothing_1", name: "Mid-range Android phones" }],
    prompt_count: 19,
    last_refreshed_at: now(),
  },
};

// ----- actions seed -------------------------------------------------------

const LEGORA_ACTIONS: ActionOut[] = [
  {
    id: "a_legora_1",
    category: "owned_media",
    kind: "article",
    title: "Publish a how-to: Reviewing multilingual contracts with Legora",
    rationale:
      "Prompts in your topic 'AI-powered document review tools' frequently mention multilingual review, but no own-domain article ranks for it. Competitors are cited via long-form how-to guides.",
    opportunity: "high",
    target: {
      topic: "AI-powered document review tools",
      format: "how-to article",
      competitor_gap: ["Harvey AI", "Spellbook"],
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_2",
    category: "owned_media",
    kind: "comparison",
    title: "Comparison page: Legora vs Harvey AI vs Spellbook",
    rationale:
      "Competitor-comparison prompts (\"X vs Y\") are over-represented in your prompt set and currently surface third-party listicles, not your own domain.",
    opportunity: "high",
    target: {
      format: "comparison page",
      competitors: ["Harvey AI", "Spellbook"],
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_3",
    category: "owned_media",
    kind: "listicle",
    title: "Listicle: Top 7 workflows AI can automate for legal teams",
    rationale:
      "AI search engines lean heavily on listicle-format pages for category overviews; you're absent from this format on your own domain.",
    opportunity: "medium",
    target: {
      format: "listicle",
      topic: "legal workflow automation",
    },
    suggested_agent: "article",
  },
  {
    id: "a_legora_4",
    category: "owned_media",
    kind: "video",
    title: "Demo video: 'Reviewing a 60-page contract in under 5 minutes'",
    rationale:
      "Video demonstrations of speed/efficiency claims drive citations from review sites that quote runtimes.",
    opportunity: "medium",
    target: { format: "demo video", duration_target_seconds: 90 },
    suggested_agent: "video",
  },
  {
    id: "a_legora_5",
    category: "owned_media",
    kind: "code",
    title: "Add structured data (Product + FAQPage) to legora.com landing pages",
    rationale:
      "AI search engines heavily favor pages with schema.org markup. Your landing pages currently have only basic Organization markup.",
    opportunity: "high",
    target: { domain: "legora.com", schemas: ["Product", "FAQPage"] },
    suggested_agent: "code-pr",
  },
  {
    id: "a_legora_6",
    category: "owned_media",
    kind: "code",
    title: "Publish an OpenGraph + JSON-LD-rich /integrations page",
    rationale:
      "Integration prompts (\"X integrates with Word/Google Docs\") often cite vendor /integrations pages. legora.com/integrations doesn't exist.",
    opportunity: "medium",
    target: { domain: "legora.com", path: "/integrations" },
    suggested_agent: "code-pr",
  },
  {
    id: "a_legora_7",
    category: "earned_media",
    kind: "subreddit",
    title: "Engage in r/LegalTech threads on AI document review",
    rationale:
      "AI engines frequently cite Reddit threads on legaltech tooling. r/LegalTech has multiple high-traffic threads with no Legora mention.",
    opportunity: "medium",
    target: { subreddit: "LegalTech", thread_count: 4 },
    suggested_agent: null,
  },
  {
    id: "a_legora_8",
    category: "earned_media",
    kind: "editorial",
    title: "Pitch case study to Legaltech News",
    rationale:
      "Legaltech News articles are repeatedly cited as sources for AI-tool roundups. A signed customer case study would close a high-value gap.",
    opportunity: "high",
    target: { publication: "Legaltech News", format: "case study" },
    suggested_agent: null,
  },
  {
    id: "a_legora_9",
    category: "earned_media",
    kind: "listicle_inclusion",
    title: "Get included in 'Best AI tools for law firms' listicles",
    rationale:
      "Of the 12 listicles AI engines cite for the category, you appear in 3. Outreach to the remaining 9 has the highest visibility ROI.",
    opportunity: "high",
    target: {
      category: "Best AI tools for law firms",
      missing_listicles: 9,
    },
    suggested_agent: null,
  },
  {
    id: "a_legora_10",
    category: "earned_media",
    kind: "youtube",
    title: "Sponsor or co-produce a video with a legaltech YouTube channel",
    rationale:
      "Video sources are increasingly cited by Gemini and Perplexity for product evaluation queries.",
    opportunity: "low",
    target: { platform: "YouTube", channel_size_min_subs: 25000 },
    suggested_agent: null,
  },
];

// Sparser sets for the other tracked companies — same shape, fewer entries.
const SPARSE_ACTIONS = (companyId: string, name: string): ActionOut[] => [
  {
    id: `a_${companyId}_1`,
    category: "owned_media",
    kind: "article",
    title: `How-to article: getting started with ${name}`,
    rationale:
      "Onboarding-intent prompts surface third-party walkthroughs instead of your own domain.",
    opportunity: "high",
    target: { format: "how-to article" },
    suggested_agent: "article",
  },
  {
    id: `a_${companyId}_2`,
    category: "owned_media",
    kind: "code",
    title: `Add JSON-LD Product schema to ${name} landing pages`,
    rationale:
      "AI search engines favor pages with schema.org markup; current pages carry only Organization data.",
    opportunity: "medium",
    target: { schemas: ["Product"] },
    suggested_agent: "code-pr",
  },
  {
    id: `a_${companyId}_3`,
    category: "earned_media",
    kind: "editorial",
    title: `Pitch a feature story about ${name} to industry press`,
    rationale:
      "Industry-trade publications dominate citations for category-defining searches.",
    opportunity: "medium",
    target: { format: "feature story" },
    suggested_agent: null,
  },
];

const ACTIONS: Record<CompanyKey, ActionOut[]> = {
  legora: LEGORA_ACTIONS,
  bmw: SPARSE_ACTIONS("bmw", "BMW"),
  revolut: SPARSE_ACTIONS("revolut", "Revolut"),
  mindspace: SPARSE_ACTIONS("mindspace", "Mindspace"),
  "nothing-phone": SPARSE_ACTIONS("nothing", "Nothing Phone"),
};

// ----- matching ----------------------------------------------------------

function matchKey(input: string): CompanyKey | null {
  const norm = input.trim().toLowerCase();
  if (!norm) return null;
  if (norm.includes("legora")) return "legora";
  if (norm.includes("bmw")) return "bmw";
  if (norm.includes("revolut")) return "revolut";
  if (norm.includes("mindspace")) return "mindspace";
  if (norm.includes("nothing")) return "nothing-phone";
  return null;
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
    const key = matchKey(input);
    if (!key) {
      await sleep(550);
      if (cancelled) return;
      handlers.onError({
        code: "no_match",
        message:
          "We don't track that company yet. Try one of the brands already configured in Peec.",
        tracked: [...TRACKED_COMPANIES],
      });
      return;
    }
    const company = COMPANIES[key];
    const actions = ACTIONS[key];

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
  return Object.values(COMPANIES).find((c) => c.id === companyId) ?? null;
}

export function getActions(companyId: string): ActionOut[] {
  const entry = Object.entries(COMPANIES).find(
    ([, c]) => c.id === companyId,
  ) as [CompanyKey, CompanyOut] | undefined;
  if (!entry) return [];
  return ACTIONS[entry[0]];
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
      const markdown = [
        `# ${title}`,
        ``,
        `_Draft article for ${company.name}_`,
        ``,
        `## Why this matters`,
        ``,
        action.rationale ?? "High-impact content gap.",
        ``,
        `## Outline`,
        ``,
        `1. Introduction to ${topic}`,
        `2. The challenge ${company.name} customers face`,
        `3. Step-by-step walkthrough`,
        `4. Pitfalls and edge cases`,
        `5. Closing call-to-action`,
        ``,
        `---`,
        `_Generated by Felix article agent (stub)._`,
      ].join("\n");
      return {
        type: "article",
        title,
        markdown,
        word_count_estimate: 1200,
      };
    }
    case "video": {
      const duration = Number(action.target.duration_target_seconds ?? 90);
      return {
        type: "video",
        title: action.title,
        duration_seconds: duration,
        video_url: `https://demo.felix.local/videos/${company.id}/preview.mp4`,
        thumbnail_url: `https://demo.felix.local/videos/${company.id}/thumb.jpg`,
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
        branch: "felix/structured-data",
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

  // Schedule transitions
  const startedAt = Date.now();
  const stageTimes = [200, 700, 1400, 2100, 2400];

  setTimeout(() => {
    const j = jobs.get(jobId);
    if (!j) return;
    j.status = "running";
    j.progress.push({ t: now(), type: "running", data: { agent } });
  }, stageTimes[0]);

  for (let i = 0; i < stages.length; i++) {
    setTimeout(() => {
      const j = jobs.get(jobId);
      if (!j) return;
      j.progress.push({ t: now(), type: "stage", data: { label: stages[i] } });
    }, stageTimes[1] + i * 350);
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
    stageTimes[1] + stages.length * 350 + 200,
  );

  // (startedAt unused but useful if we later add elapsed time.)
  void startedAt;

  return jobId;
}

export function getJob(jobId: string): JobOut | null {
  return jobs.get(jobId) ?? null;
}

function stageLabels(agent: AgentKind): string[] {
  switch (agent) {
    case "article":
      return ["Pulling context", "Drafting outline", "Writing draft"];
    case "video":
      return ["Drafting storyboard", "Selecting shots", "Rendering preview"];
    case "code-pr":
      return ["Cloning repo", "Generating diff", "Opening pull request"];
  }
}
