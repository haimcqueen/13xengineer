import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode,
  FileText,
  Globe,
  GitBranch,
  GitPullRequestArrow,
  Loader2,
  Lock,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  Send,
  Settings2,
  Sparkles,
  X,
} from "lucide-react";
import Markdown from "react-markdown";

import AgentBadge from "@/components/AgentBadge";
import GlassPanel from "@/components/GlassPanel";
import {
  getRepoConfig,
  pollJob,
  putRepoConfig,
  runAgent,
} from "@/lib/api";
import {
  createDeliverable,
  publishDeliverable,
  scheduleDeliverable,
  useDeliverableForAction,
} from "@/lib/deliverables";
import type {
  ActionOut,
  AgentKind,
  AgentResult,
  ArticleResult,
  CodePrResult,
  CompanyOut,
  ProgressEvent,
  SiteBlogResult,
  VideoResult,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  action: ActionOut;
  company: CompanyOut;
  onClose: () => void;
  onDone?: () => void;
};

export default function AgentRunPanel({
  action,
  company,
  onClose,
  onDone,
}: Props) {
  const isManual = action.suggested_agent === null;
  const existing = useDeliverableForAction(action.id);

  if (isManual) {
    return (
      <PanelShell action={action} onClose={onClose}>
        <ManualBriefBody
          action={action}
          completed={existing?.status === "published"}
          onMarkDone={() => {
            onDone?.();
            onClose();
          }}
        />
      </PanelShell>
    );
  }

  return (
    <PanelShell action={action} onClose={onClose}>
      <RunFlow
        action={action}
        company={company}
        startInDoneState={!!existing}
        onDone={onDone}
      />
    </PanelShell>
  );
}

// ===== Run flow ================================================================

type FlowState =
  | { kind: "config" }
  | { kind: "running"; stage: number; elapsed: number }
  | { kind: "running-real"; events: ProgressEvent[]; phase: RealPhase; cancel: () => void }
  | { kind: "done"; result: AgentResult }
  | { kind: "error"; message: string; code?: string };

type RealPhase = "saving-config" | "improvement" | "code-pr";

function RunFlow({
  action,
  company,
  startInDoneState,
  onDone,
}: {
  action: ActionOut;
  company: CompanyOut;
  startInDoneState: boolean;
  onDone?: () => void;
}) {
  const agent = (action.suggested_agent ?? "article") as AgentKind;

  // If the action already has a deliverable, jump straight to done state
  // and reuse the existing payload rather than re-running.
  const existing = useDeliverableForAction(action.id);
  const [state, setState] = useState<FlowState>(() =>
    startInDoneState && existing
      ? { kind: "done", result: existing.payload }
      : { kind: "config" },
  );

  const [config, setConfig] = useState(() => defaultConfig(agent, action));

  // Pre-fill repo config for code-pr from the backend (so users don't re-type
  // URLs after the first run; they still need to re-enter the token).
  useEffect(() => {
    if (agent !== "code-pr") return;
    let cancelled = false;
    getRepoConfig(company.id).then((existing) => {
      if (cancelled || !existing) return;
      setConfig((c) => ({
        ...c,
        repoUrl: c.repoUrl || existing.repo_url,
        siteUrl: c.siteUrl || existing.site_url,
        defaultBranch: existing.default_branch || c.defaultBranch,
      }));
    }).catch(() => {
      /* 404 is fine; nothing to prefill */
    });
    return () => {
      cancelled = true;
    };
  }, [agent, company.id]);

  const stages = stagesFor(action);
  const totalMs = stages.reduce((a, s) => a + s.ms, 0);

  // Mock-stage timer (article + video only — code-pr is real-backend now).
  useEffect(() => {
    if (state.kind !== "running") return;
    if (state.stage >= stages.length) {
      const result = buildResult(action, company, agent, config);
      setState({ kind: "done", result });
      createDeliverable(action, result);
      onDone?.();
      return;
    }
    const t = window.setTimeout(() => {
      setState((s) =>
        s.kind === "running"
          ? {
              ...s,
              stage: s.stage + 1,
              elapsed: s.elapsed + stages[s.stage].ms,
            }
          : s,
      );
    }, stages[state.stage].ms);
    return () => window.clearTimeout(t);
  }, [state, stages, agent, action, company, config, onDone]);

  // Cancel any active real-backend poll on unmount.
  const pollCancelRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    return () => {
      pollCancelRef.current?.();
    };
  }, []);

  function start() {
    // site_blog actions are mock-only (publish-to-site flow), even though
    // their suggested_agent is "code-pr" so they live under the Website
    // identity. Skip the real-backend GitHub path for them.
    if (agent === "code-pr" && action.kind !== "site_blog") {
      void startCodePrReal();
    } else {
      setState({ kind: "running", stage: 0, elapsed: 0 });
    }
  }

  async function startCodePrReal() {
    if (!isCodePrConfigValid(config)) return;

    let phase: RealPhase = "saving-config";
    const setCancel = (fn: () => void) => {
      pollCancelRef.current = fn;
    };

    setState({
      kind: "running-real",
      events: [],
      phase,
      cancel: () => pollCancelRef.current?.(),
    });

    try {
      // 1. Save / overwrite the RepoConfig.
      await putRepoConfig(company.id, {
        site_url: config.siteUrl.trim(),
        repo_url: config.repoUrl.trim(),
        default_branch: config.defaultBranch.trim() || "main",
        github_token: config.githubToken.trim(),
      });

      // 2. Kick off the improvement agent.
      phase = "improvement";
      const improvement = await runAgent("improvement", {
        action_id: action.id,
      });
      const improvementJob = await new Promise<{
        events: ProgressEvent[];
        result: Record<string, unknown> | null;
      }>((resolve, reject) => {
        const stop = pollJob(improvement.job_id, {
          onEvent: (e) =>
            setState((s) =>
              s.kind === "running-real"
                ? { ...s, events: [...s.events, e], phase: "improvement" }
                : s,
            ),
          onDone: (job) =>
            resolve({
              events: job.progress,
              result: job.result,
            }),
          onError: (msg, code) =>
            reject(Object.assign(new Error(msg), { code })),
        });
        setCancel(stop);
      });
      void improvementJob;

      // 3. Kick off code-pr with the improvement_job_id.
      phase = "code-pr";
      const codePr = await runAgent("code-pr", {
        action_id: action.id,
        improvement_job_id: improvement.job_id,
      });
      const codePrJob = await new Promise<{
        events: ProgressEvent[];
        result: Record<string, unknown> | null;
      }>((resolve, reject) => {
        const stop = pollJob(codePr.job_id, {
          onEvent: (e) =>
            setState((s) =>
              s.kind === "running-real"
                ? { ...s, events: [...s.events, e], phase: "code-pr" }
                : s,
            ),
          onDone: (job) =>
            resolve({
              events: job.progress,
              result: job.result,
            }),
          onError: (msg, code) =>
            reject(Object.assign(new Error(msg), { code })),
        });
        setCancel(stop);
      });

      // 4. Build a CodePrResult from the real backend output.
      const r = codePrJob.result ?? {};
      const result: CodePrResult = {
        type: "code-pr",
        title: (r.title as string) ?? action.title,
        repo: (r.repo as string) ?? "",
        branch: (r.branch as string) ?? "",
        pr_url: (r.pr_url as string) ?? "",
        files_changed: (r.files_changed as string[]) ?? [],
        diff_preview: (r.diff as string) ?? "",
        schemas_added: config.schemas,
      };
      setState({ kind: "done", result });
      createDeliverable(action, result);
      onDone?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Agent run failed";
      const code = (err as { code?: string }).code;
      setState({ kind: "error", message, code });
    }
  }

  function reset() {
    setState({ kind: "config" });
  }

  return (
    <AnimatePresence mode="wait">
      {state.kind === "config" && (
        <ConfigStep
          key="config"
          agent={agent}
          action={action}
          config={config}
          onChange={setConfig}
          onGenerate={start}
          canGenerate={
            action.kind === "site_blog" ||
            agent !== "code-pr" ||
            isCodePrConfigValid(config)
          }
        />
      )}
      {state.kind === "running" && (
        <RunningStep
          key="running"
          agent={agent}
          stage={state.stage}
          elapsed={state.elapsed}
          totalMs={totalMs}
          action={action}
          company={company}
          config={config}
        />
      )}
      {state.kind === "running-real" && (
        <RealRunningStep
          key="running-real"
          events={state.events}
          phase={state.phase}
        />
      )}
      {state.kind === "done" && (
        <DoneStep key="done" action={action} result={state.result} />
      )}
      {state.kind === "error" && (
        <ErrorStep
          key="error"
          message={state.message}
          code={state.code}
          onRetry={reset}
        />
      )}
    </AnimatePresence>
  );
}

// ===== Stage timing per agent =================================================

type StageDef = { label: string; hint: string; ms: number };

const STAGE_DEFS: Record<AgentKind, StageDef[]> = {
  article: [
    {
      label: "Researching keywords & intent",
      hint: "Pulling Peec citation patterns for the target prompt set",
      ms: 2200,
    },
    {
      label: "Deep research & data collection",
      hint: "Reading competitor pages and extracting comparison facts",
      ms: 3000,
    },
    {
      label: "Structuring the article",
      hint: "Outlining sections optimized for AI retrieval",
      ms: 2200,
    },
    {
      label: "Writing the full article",
      hint: "Drafting prose with schema-ready FAQ block",
      ms: 3500,
    },
  ],
  video: [
    {
      label: "Drafting storyboard",
      hint: "Mapping the demo to your product surface",
      ms: 2400,
    },
    {
      label: "Selecting shots",
      hint: "Pulling product UI takes from the canvas",
      ms: 2600,
    },
    {
      label: "Animating scenes",
      hint: "Camera, transitions, motion design",
      ms: 3200,
    },
    {
      label: "Encoding 1080p",
      hint: "Final pass · constant bitrate",
      ms: 2400,
    },
  ],
  "code-pr": [
    {
      label: "Cloning repository",
      hint: "Reading site structure and existing markup",
      ms: 1800,
    },
    {
      label: "Generating structured data",
      hint: "Composing JSON-LD + meta tags for AI retrieval",
      ms: 2400,
    },
    {
      label: "Committing changes",
      hint: "Building a single surgical commit",
      ms: 1600,
    },
    {
      label: "Opening pull request",
      hint: "With diff summary and expected impact",
      ms: 1600,
    },
  ],
};

// Site-blog stages: the article agent doing a real publish-to-site run.
// Triggered when `action.kind === "site_blog"`.
const SITE_BLOG_STAGES: StageDef[] = [
  {
    label: "Drafting the essay",
    hint: "Writing 1,800 words of thought leadership",
    ms: 3000,
  },
  {
    label: "Generating cover image",
    hint: "Composing hero image in your brand palette",
    ms: 2200,
  },
  {
    label: "Publishing to legora.com/blog",
    hint: "Pushing to your CMS and rebuilding the page",
    ms: 2200,
  },
  {
    label: "Indexing for AI engines",
    hint: "Sitemap update + IndexNow ping",
    ms: 1500,
  },
];

function stagesFor(action: ActionOut): StageDef[] {
  if (action.kind === "site_blog") return SITE_BLOG_STAGES;
  const agent = (action.suggested_agent ?? "article") as AgentKind;
  return STAGE_DEFS[agent];
}

// ===== Config step ============================================================

type Config = {
  // article
  tone: "punchy" | "authoritative" | "conversational";
  length: "concise" | "standard" | "deep-dive";
  includeFAQ: boolean;
  // video
  duration: "30s" | "60s" | "90s";
  voiceover: "warm" | "sharp" | "none";
  aspect: "16:9" | "9:16" | "1:1";
  // code-pr (informational)
  schemas: string[];
  draftPR: boolean;
  // code-pr (required for real backend run)
  repoUrl: string;
  githubToken: string;
  siteUrl: string;
  defaultBranch: string;
};

function defaultConfig(_agent: AgentKind, action: ActionOut): Config {
  const targetSchemas =
    (action.target.schemas as string[] | undefined) ?? [
      "Organization",
      "FAQPage",
    ];
  const siteUrl =
    (action.target.domain as string | undefined)
      ? `https://${action.target.domain as string}`
      : "";
  return {
    tone: "authoritative",
    length: "standard",
    includeFAQ: true,
    duration: "90s",
    voiceover: "warm",
    aspect: "16:9",
    schemas: targetSchemas,
    draftPR: false,
    repoUrl: "",
    githubToken: "",
    siteUrl,
    defaultBranch: "main",
  };
}

function ConfigStep({
  agent,
  action,
  config,
  onChange,
  onGenerate,
  canGenerate,
}: {
  agent: AgentKind;
  action: ActionOut;
  config: Config;
  onChange: (c: Config) => void;
  onGenerate: () => void;
  canGenerate: boolean;
}) {
  // site_blog uses the article-style customization (tone/length/FAQ) since
  // it's writing a blog post, even though its agent is the website agent.
  const isSiteBlog = action.kind === "site_blog";
  const formAgent: AgentKind = isSiteBlog ? "article" : agent;

  const verb = isSiteBlog
    ? "Publish to site"
    : agent === "article"
      ? "Draft article"
      : agent === "video"
        ? "Generate video"
        : "Open pull request";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35, ease }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="grain relative flex-1 overflow-y-auto px-7 py-6">
        <div className="mb-5 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          <Settings2 className="size-3" />
          Customize before running
        </div>

        {formAgent === "article" && (
          <ArticleConfig config={config} onChange={onChange} action={action} />
        )}
        {formAgent === "video" && (
          <VideoConfig config={config} onChange={onChange} action={action} />
        )}
        {formAgent === "code-pr" && (
          <WebsiteConfig config={config} onChange={onChange} action={action} />
        )}

        <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/30 p-4">
          <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <Sparkles className="size-3" />
            Grounded in Peec data
          </div>
          <p className="text-[12.5px] leading-relaxed text-rose/85">
            {action.rationale ?? "This action is sourced from your latest Peec snapshot."}
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--border)] bg-white/65 px-7 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onGenerate}
          disabled={!canGenerate}
          className={cn(
            "group flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-[13px] font-medium text-white transition-opacity",
            canGenerate
              ? "bg-[var(--blue)] hover:opacity-90"
              : "cursor-not-allowed bg-[var(--ink-2)]/85 text-muted-foreground",
          )}
        >
          <Sparkles className="size-3.5" strokeWidth={2.5} />
          {verb}
          <span className="ml-1 inline-flex items-center gap-0.5 opacity-70 transition-transform group-hover:translate-x-0.5">
            <span aria-hidden>→</span>
          </span>
        </button>
        {agent === "code-pr" && !isSiteBlog && !canGenerate && (
          <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/85">
            Fill repo URL, token & site URL to continue
          </p>
        )}
      </div>
    </motion.div>
  );
}

function ArticleConfig({
  config,
  onChange,
  action,
}: {
  config: Config;
  onChange: (c: Config) => void;
  action: ActionOut;
}) {
  const competitors =
    (action.target.competitors as string[] | undefined) ?? [];
  const topic =
    (action.target.topic as string | undefined) ??
    (action.target.format as string | undefined) ??
    "the prompt set";

  return (
    <div className="space-y-5">
      <Field label="Tone">
        <PillGroup
          value={config.tone}
          options={[
            { value: "punchy", label: "Punchy" },
            { value: "authoritative", label: "Authoritative" },
            { value: "conversational", label: "Conversational" },
          ]}
          onChange={(v) => onChange({ ...config, tone: v as Config["tone"] })}
        />
      </Field>

      <Field label="Length">
        <PillGroup
          value={config.length}
          options={[
            { value: "concise", label: "Concise · ~1,200" },
            { value: "standard", label: "Standard · ~2,000" },
            { value: "deep-dive", label: "Deep dive · ~3,500" },
          ]}
          onChange={(v) => onChange({ ...config, length: v as Config["length"] })}
        />
      </Field>

      <Field label="Schema markup">
        <Toggle
          checked={config.includeFAQ}
          onChange={(c) => onChange({ ...config, includeFAQ: c })}
          label="Include FAQPage schema"
          hint="Adds a Q&A block at the bottom plus JSON-LD"
        />
      </Field>

      {competitors.length > 0 && (
        <Field label="Reference competitors" hint="Pulled from this action's Peec data">
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c) => (
              <span
                key={c}
                className="rounded-md border border-[var(--border)] bg-white/70 px-2 py-1 font-mono text-[10.5px] text-rose/80"
              >
                {c}
              </span>
            ))}
          </div>
        </Field>
      )}

      <Field label="Topic anchor">
        <span className="block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-3 py-2 font-mono text-[12px] text-rose/85">
          {topic}
        </span>
      </Field>
    </div>
  );
}

function VideoConfig({
  config,
  onChange,
  action,
}: {
  config: Config;
  onChange: (c: Config) => void;
  action: ActionOut;
}) {
  const featureFocus =
    (action.target.feature_focus as string | undefined) ?? "Thought leadership";
  return (
    <div className="space-y-5">
      <Field label="Duration">
        <PillGroup
          value={config.duration}
          options={[
            { value: "30s", label: "30s · teaser" },
            { value: "60s", label: "60s · social" },
            { value: "90s", label: "90s · demo" },
          ]}
          onChange={(v) =>
            onChange({ ...config, duration: v as Config["duration"] })
          }
        />
      </Field>

      <Field label="Voiceover">
        <PillGroup
          value={config.voiceover}
          options={[
            { value: "warm", label: "Warm" },
            { value: "sharp", label: "Sharp" },
            { value: "none", label: "No VO" },
          ]}
          onChange={(v) =>
            onChange({ ...config, voiceover: v as Config["voiceover"] })
          }
        />
      </Field>

      <Field label="Aspect ratio">
        <PillGroup
          value={config.aspect}
          options={[
            { value: "16:9", label: "16:9 — landscape" },
            { value: "9:16", label: "9:16 — vertical" },
            { value: "1:1", label: "1:1 — square" },
          ]}
          onChange={(v) =>
            onChange({ ...config, aspect: v as Config["aspect"] })
          }
        />
      </Field>

      <Field label="Feature focus" hint="Sourced from this action">
        <span className="block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-3 py-2 font-mono text-[12px] text-rose/85">
          {featureFocus}
        </span>
      </Field>
    </div>
  );
}

function WebsiteConfig({
  config,
  onChange,
  action,
}: {
  config: Config;
  onChange: (c: Config) => void;
  action: ActionOut;
}) {
  const allSchemas = [
    "Organization",
    "SoftwareApplication",
    "Product",
    "FAQPage",
    "BreadcrumbList",
    "Article",
  ];
  const domain = (action.target.domain as string | undefined) ?? "your site";

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-md)] border border-[rgba(30,91,201,0.20)] bg-[rgba(30,91,201,0.04)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-[var(--blue)]">
          <Sparkles className="size-3" />
          GitHub access required
        </div>
        <p className="text-[12px] leading-relaxed text-rose/85">
          Michelangelo clones your repo, generates the structured-data
          edits, and opens a real PR. We need a personal access token with{" "}
          <code className="font-mono text-[11px]">repo</code> scope.
        </p>
      </div>

      <Field
        label="Repository URL"
        hint="https://github.com/owner/repo"
      >
        <input
          type="text"
          value={config.repoUrl}
          onChange={(e) => onChange({ ...config, repoUrl: e.target.value })}
          placeholder="https://github.com/your-org/your-site"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="GitHub token"
        hint="Stored locally · used only for this run"
      >
        <input
          type="password"
          value={config.githubToken}
          onChange={(e) =>
            onChange({ ...config, githubToken: e.target.value })
          }
          placeholder="ghp_…"
          autoComplete="off"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="Live site URL"
        hint="The agent fetches this with web_fetch to read existing markup"
      >
        <input
          type="text"
          value={config.siteUrl}
          onChange={(e) => onChange({ ...config, siteUrl: e.target.value })}
          placeholder={`https://${domain}`}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field label="Default branch">
        <input
          type="text"
          value={config.defaultBranch}
          onChange={(e) =>
            onChange({ ...config, defaultBranch: e.target.value })
          }
          placeholder="main"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="Schemas hint"
        hint="The agent decides the final set after reading the live site"
      >
        <div className="flex flex-wrap gap-1.5">
          {allSchemas.map((s) => {
            const active = config.schemas.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const next = active
                    ? config.schemas.filter((x) => x !== s)
                    : [...config.schemas, s];
                  onChange({ ...config, schemas: next });
                }}
                className={cn(
                  "rounded-[var(--radius-pill)] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-all",
                  active
                    ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)] ring-1 ring-inset ring-[rgba(30,91,201,0.25)]"
                    : "border border-[var(--border)] bg-white/70 text-muted-foreground hover:border-[var(--border-strong)]",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

export function isCodePrConfigValid(c: Config): boolean {
  return (
    /^https?:\/\/.+/i.test(c.siteUrl) &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(c.repoUrl) &&
    c.githubToken.trim().length > 5 &&
    c.defaultBranch.trim().length > 0
  );
}

// ===== Running step (cinematic) ================================================

function RunningStep({
  agent,
  stage,
  elapsed,
  totalMs,
  action,
  company,
  config,
}: {
  agent: AgentKind;
  stage: number;
  elapsed: number;
  totalMs: number;
  action: ActionOut;
  company: CompanyOut;
  config: Config;
}) {
  const stages = stagesFor(action);
  const current = stages[stage] ?? stages[stages.length - 1];
  const stagedElapsed = elapsed + Math.min(stages[stage]?.ms ?? 0, 0);
  const progress = Math.min(1, stagedElapsed / totalMs);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      {/* Stage focus */}
      <div className="grain relative flex-1 overflow-y-auto px-7 pb-6 pt-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              y: -8,
              filter: "blur(6px)",
              transition: { duration: 0.4, ease },
            }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              <span
                className="size-1 rounded-full bg-[var(--blue)]"
                style={{
                  boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                  animation: "lg-pulse 2.4s ease-in-out infinite",
                }}
              />
              Step {stage + 1} · {stages.length}
            </div>
            <h3
              className="text-rose"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.022em",
                lineHeight: 1.1,
              }}
            >
              {current.label}
            </h3>
            {current.hint && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {current.hint}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Streaming output feed */}
        <StreamingFeed
          agent={agent}
          stage={stage}
          action={action}
          company={company}
          config={config}
        />

        <style>{`@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}`}</style>
      </div>

      {/* Progress bar */}
      <div className="relative h-px w-full overflow-hidden bg-[var(--border)]/70">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[var(--blue)]"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.6, ease }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 bg-white/65 px-7 py-3 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {Math.round(progress * 100)}% · {Math.max(0, Math.ceil((totalMs - stagedElapsed) / 1000))}s remaining
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--blue)]">
          <Loader2 className="size-3 animate-spin" />
          Working
        </span>
      </div>
    </motion.div>
  );
}

// ===== Real backend running step (driven by job events) =======================

const REAL_EVENT_LABELS: Record<
  string,
  { label: string; hint?: string }
> = {
  cloning_repo: {
    label: "Cloning your repository",
    hint: "Reading the site structure",
  },
  repo_summarized: {
    label: "Repository summarized",
    hint: "Identified files for AEO/SEO",
  },
  analyzing: {
    label: "Analyzing live site & competitors",
    hint: "Claude is fetching pages with web_fetch",
  },
  plan_ready: {
    label: "Edit plan ready",
    hint: "Compiled changes to apply",
  },
  loading_plan: {
    label: "Loading edit plan",
    hint: "Validating changes before applying",
  },
  applying_edits: {
    label: "Applying edits",
    hint: "Writing files in the working tree",
  },
  committing: {
    label: "Committing changes",
    hint: "Building the feature branch",
  },
  pushing: {
    label: "Pushing branch to GitHub",
    hint: "Uploading to your remote",
  },
  opening_pr: {
    label: "Opening pull request",
    hint: "With diff summary and expected impact",
  },
};

const REAL_PHASE_LABEL: Record<RealPhase, string> = {
  "saving-config": "Saving repo configuration",
  improvement: "Improvement agent",
  "code-pr": "Pull-request agent",
};

function RealRunningStep({
  events,
  phase,
}: {
  events: ProgressEvent[];
  phase: RealPhase;
}) {
  const eventList = useMemo(
    () =>
      events.filter(
        (e) => e.type !== "queued" && e.type !== "running" && e.type !== "done",
      ),
    [events],
  );
  const last = eventList[eventList.length - 1];
  const label =
    last && REAL_EVENT_LABELS[last.type]
      ? REAL_EVENT_LABELS[last.type].label
      : phase === "saving-config"
        ? "Saving repo configuration"
        : phase === "improvement"
          ? "Starting improvement agent"
          : "Starting pull-request agent";
  const hint =
    (last && REAL_EVENT_LABELS[last.type]?.hint) ??
    "The agent will report progress as it runs.";

  // Total ~10 expected events end-to-end (4 improvement + 6 code-pr).
  const TOTAL_EXPECTED = 10;
  const progress = Math.min(1, eventList.length / TOTAL_EXPECTED);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="grain relative flex-1 overflow-y-auto px-7 pb-6 pt-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${phase}-${last?.type ?? "init"}`}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              y: -8,
              filter: "blur(6px)",
              transition: { duration: 0.4, ease },
            }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              <span
                className="size-1 rounded-full bg-[var(--blue)]"
                style={{
                  boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                  animation: "lg-pulse 2.4s ease-in-out infinite",
                }}
              />
              {REAL_PHASE_LABEL[phase]}
            </div>
            <h3
              className="text-rose"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.022em",
                lineHeight: 1.1,
              }}
            >
              {label}
            </h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {hint}
            </p>
          </motion.div>
        </AnimatePresence>

        {/* Live event log */}
        {eventList.length > 0 && (
          <div className="mt-6 space-y-2">
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/85">
              Agent log
            </div>
            <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/35 px-4 py-3">
              <ul className="space-y-1.5">
                {eventList.map((e, i) => {
                  const meta = REAL_EVENT_LABELS[e.type];
                  return (
                    <motion.li
                      key={`${i}-${e.type}`}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.3, ease }}
                      className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed text-rose/85"
                    >
                      <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--blue)]/65" />
                      <span className="flex-1">
                        <span>{meta?.label ?? e.type}</span>
                        {realEventDataLine(e) && (
                          <span className="ml-1 text-muted-foreground/85">
                            · {realEventDataLine(e)}
                          </span>
                        )}
                      </span>
                    </motion.li>
                  );
                })}
              </ul>
            </div>
          </div>
        )}

        <style>{`@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}`}</style>
      </div>

      <div className="relative h-px w-full overflow-hidden bg-[var(--border)]/70">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[var(--blue)]"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.6, ease }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 bg-white/65 px-7 py-3 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {Math.round(progress * 100)}% · {eventList.length} events
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--blue)]">
          <Loader2 className="size-3 animate-spin" />
          Working
        </span>
      </div>
    </motion.div>
  );
}

function realEventDataLine(e: ProgressEvent): string {
  const d = e.data as Record<string, unknown>;
  if (e.type === "repo_summarized" && typeof d.file_count === "number")
    return `${d.file_count} files`;
  if (e.type === "plan_ready" && typeof d.edit_count === "number")
    return `${d.edit_count} edits`;
  if (e.type === "applying_edits") {
    const changed = (d.changed as string[] | undefined)?.length ?? 0;
    return changed > 0 ? `${changed} files changed` : "";
  }
  if (e.type === "committing" && typeof d.branch === "string")
    return d.branch as string;
  if (e.type === "opening_pr" && typeof d.branch === "string")
    return d.branch as string;
  return "";
}

// ===== Error step =============================================================

function ErrorStep({
  message,
  code,
  onRetry,
}: {
  message: string;
  code?: string;
  onRetry: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3, ease }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="grain relative flex-1 overflow-y-auto px-7 py-7">
        <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-red-600">
          <span className="grid size-5 place-items-center rounded-full bg-red-50 ring-1 ring-inset ring-red-200">
            <X className="size-3" strokeWidth={2.5} />
          </span>
          Run failed{code ? ` · ${code}` : ""}
        </div>
        <h3
          className="text-rose"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 21,
            fontWeight: 500,
            letterSpacing: "-0.018em",
            lineHeight: 1.15,
          }}
        >
          The agent didn't finish.
        </h3>
        <pre className="mt-4 max-h-[40vh] overflow-y-auto whitespace-pre-wrap rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 p-4 font-mono text-[12px] leading-relaxed text-rose/90">
          {message}
        </pre>
        <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">
          Common causes: invalid GitHub token, repo URL doesn't match, or the
          token doesn't have <code className="font-mono text-[11px]">repo</code>{" "}
          scope. Adjust the config and try again.
        </p>
      </div>

      <div className="border-t border-[var(--border)] bg-white/65 px-7 py-4 backdrop-blur-md">
        <button
          type="button"
          onClick={onRetry}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--blue)] px-4 py-3 text-[13px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <Settings2 className="size-3.5" strokeWidth={2.5} />
          Adjust & retry
        </button>
      </div>
    </motion.div>
  );
}

// ===== Streaming feed (faked live output) =====================================

function StreamingFeed({
  agent,
  stage,
  action,
  company,
  config,
}: {
  agent: AgentKind;
  stage: number;
  action: ActionOut;
  company: CompanyOut;
  config: Config;
}) {
  const items = useMemo(
    () => streamItemsForStage(agent, stage, action, company, config),
    [agent, stage, action, company, config],
  );
  const [revealed, setRevealed] = useState(0);
  const stageKey = `${agent}-${stage}`;
  const stageKeyRef = useRef(stageKey);

  useEffect(() => {
    if (stageKeyRef.current !== stageKey) {
      setRevealed(0);
      stageKeyRef.current = stageKey;
    }
  }, [stageKey]);

  // Reveal items one by one over the stage duration.
  useEffect(() => {
    setRevealed(0);
    if (items.length === 0) return;
    const stageMs = stagesFor(action)[stage]?.ms ?? 2000;
    const perItem = Math.max(180, Math.floor(stageMs / (items.length + 0.5)));
    let i = 0;
    const tick = () => {
      i += 1;
      setRevealed(i);
      if (i < items.length) {
        timer = window.setTimeout(tick, perItem);
      }
    };
    let timer = window.setTimeout(tick, perItem * 0.5);
    return () => window.clearTimeout(timer);
  }, [items, agent, stage]);

  if (items.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/85">
        Live output
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/35 px-4 py-3">
        <ul className="space-y-1.5">
          {items.slice(0, revealed).map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease }}
              className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed text-rose/85"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--blue)]/65" />
              <span className="flex-1">{item}</span>
            </motion.li>
          ))}
          {revealed < items.length && (
            <li className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground/65">
              <Loader2 className="size-2.5 animate-spin" />
              <span className="opacity-80">…</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function streamItemsForStage(
  agent: AgentKind,
  stage: number,
  action: ActionOut,
  company: CompanyOut,
  config: Config,
): string[] {
  const own = company.own_brand?.name ?? company.name;
  const competitors =
    (action.target.competitors as string[] | undefined) ?? [
      "Harvey",
      "Spellbook",
    ];
  const topic =
    (action.target.topic as string | undefined) ??
    (action.target.format as string | undefined) ??
    "the prompt set";
  const domain = (action.target.domain as string | undefined) ?? "legora.com";

  // site_blog: article agent in publish-to-site mode.
  if (action.kind === "site_blog") {
    const slug =
      (action.target.slug as string | undefined) ??
      "what-it-takes-to-lead-ai-change";
    const audience =
      (action.target.audience as string | undefined) ??
      "BigLaw decision-makers";
    if (stage === 0)
      return [
        `Loaded ${(action.target.citations_in_category as number) ?? 1184} citations on "${topic}"`,
        `Audience locked · ${audience}`,
        `Drafted opening · 218 words`,
        `Wove in ${competitors[0]} comparison facts`,
        `Closed with CTA → schedule a Legora demo`,
      ];
    if (stage === 1)
      return [
        `Composed cover · "AI lawyer at scale"`,
        `Applied brand palette · #1F1A28 + #1E5BC9`,
        `Optimized for OG card · 1200 × 630`,
      ];
    if (stage === 2)
      return [
        `Created post · slug: ${slug}`,
        `Uploaded cover image to /assets/covers/`,
        `Built static page · 142kb gzipped`,
        `Added to /sitemap.xml`,
      ];
    return [
      "Pinged ChatGPT crawler · queued",
      "Pinged Perplexity · indexed",
      "Pinged Claude search · queued",
      "Live at legora.com/blog",
    ];
  }

  if (agent === "article") {
    if (stage === 0)
      return [
        `Loaded ${(action.target.citations_in_category as number) ?? 1417} citations from Peec`,
        `Top intent cluster: "${topic}" (62% of traffic)`,
        `${competitors[0] ?? "Top competitor"} owns the canonical answer`,
        `${own} appears in 0% of category citations`,
      ];
    if (stage === 1)
      return [
        `Fetched ${competitors[0] ?? "competitor"} reference page`,
        "Extracted 12 comparison facts",
        "Identified 4 missing capability claims",
        "Cross-referenced with 3 buyer-intent prompts",
      ];
    if (stage === 2)
      return [
        "H1 — Title with primary keyword in slot 1",
        "H2 — What is this category? (definition for AI summaries)",
        "H2 — Decision criteria buyers actually use",
        "H2 — Side-by-side comparison table",
        `H2 — Where ${own} fits`,
        config.includeFAQ ? "H2 — FAQ block (FAQPage schema)" : null,
      ].filter(Boolean) as string[];
    return [
      "Drafted intro · 142 words",
      "Drafted comparison table · 8 columns",
      `Added ${own} positioning section · 318 words`,
      config.includeFAQ ? "Wrote 5 FAQ pairs + JSON-LD" : null,
      `Final word count: ~${
        config.length === "concise" ? 1200 : config.length === "deep-dive" ? 3500 : 2000
      }`,
    ].filter(Boolean) as string[];
  }

  if (agent === "video") {
    if (stage === 0)
      return [
        `Format · ${config.duration} ${config.aspect}`,
        `Voiceover · ${config.voiceover === "none" ? "muted" : config.voiceover}`,
        "Drafted 6-beat script · 138 words",
        "Hook: the billable hour isn't dying",
      ];
    if (stage === 1)
      return [
        "Selected take · clock motif open",
        "Selected take · pull-quote · Kyle Poe",
        "Selected take · stat reveal · 72% / 90%",
        "Selected take · Big Four accounting analogy",
      ];
    if (stage === 2)
      return [
        "Easing curves applied to intro & outro",
        "Cross-fade between scenes 2 → 3",
        "Lower-third typography rendered",
        "Audio sidechain ducked under VO",
      ];
    return [
      "Pass 1 · spatial encoding",
      "Pass 2 · constant bitrate · 8 Mbps",
      "MP4 muxed · 1080p · 24fps",
      "Asset registered in your library",
    ];
  }

  // code-pr
  if (stage === 0)
    return [
      `Cloned ${domain} · 184 files`,
      "Detected framework · Next.js 14 (app router)",
      "Located <head> in app/layout.tsx",
      "No existing JSON-LD · clean slate",
    ];
  if (stage === 1) {
    const out: string[] = [];
    for (const s of config.schemas)
      out.push(`+ Generated JSON-LD · ${s}`);
    out.push(`+ Updated <title> for retrievability`);
    out.push(`+ Added canonical URL`);
    return out;
  }
  if (stage === 2)
    return [
      `Created branch · ${config.defaultBranch}`,
      "Staged 2 files",
      `Committed · "${(action.target.format as string) ?? "Add structured data"}"`,
      "Pushed to origin",
    ];
  return [
    "Opened pull request on origin",
    config.draftPR ? "Marked as draft (no CI)" : "Marked ready for review",
    "Linked to MIDAS action in PR body",
    "Posted diff summary",
  ];
}

// ===== Done step (with Deliver footer) ========================================

function DoneStep({
  action,
  result,
}: {
  action: ActionOut;
  result: AgentResult;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-1 flex-col overflow-hidden"
    >
      <div className="grain relative flex-1 overflow-y-auto px-7 py-6">
        <ResultBody result={result} />
      </div>

      <DeliverFooter action={action} result={result} />
    </motion.div>
  );
}

function DeliverFooter({
  action,
  result,
}: {
  action: ActionOut;
  result: AgentResult;
}) {
  const deliverable = useDeliverableForAction(action.id);
  const status = deliverable?.status ?? "draft";

  function handleSchedule() {
    if (!deliverable) return;
    // Pick a sensible "next slot" — tomorrow at 10am.
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(10, 0, 0, 0);
    scheduleDeliverable(deliverable.id, when);
  }

  function handlePublish() {
    if (!deliverable) return;
    const dest =
      result.type === "article"
        ? "Blog"
        : result.type === "video"
          ? "LinkedIn"
          : result.type === "site-blog"
            ? "legora.com/blog"
            : "GitHub";
    publishDeliverable(deliverable.id, dest);
  }

  const publishVerb =
    result.type === "article"
      ? "Post to blog"
      : result.type === "video"
        ? "Publish to social"
        : result.type === "site-blog"
          ? "Open live page"
          : "Open PR on GitHub";
  const PublishIcon =
    result.type === "code-pr" || result.type === "site-blog"
      ? ExternalLink
      : Send;

  // External-link "Publish" buttons: code-pr opens the GitHub PR;
  // site-blog opens the published page on the brand's own domain.
  const pubHref =
    result.type === "code-pr"
      ? (result as CodePrResult).pr_url
      : result.type === "site-blog"
        ? (result as SiteBlogResult).publish_url
        : undefined;

  return (
    <div className="border-t border-[var(--border)] bg-white/70 px-7 py-3.5 backdrop-blur-md">
      {status !== "draft" && (
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-emerald-700">
          <CheckCircle2 className="size-3" strokeWidth={2.5} />
          {status === "scheduled"
            ? `Scheduled · ${formatScheduledAt(deliverable?.scheduled_at)}`
            : `Published · ${deliverable?.destination ?? "live"}`}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/85">
          Deliver
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!deliverable}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[12px] font-medium text-rose transition-colors hover:bg-white disabled:opacity-50"
            onClick={() => {
              /* draft is the default state; no-op but keeps button shape */
            }}
            aria-label="Save as draft"
          >
            <Sparkles className="size-3" />
            Save draft
          </button>
          <button
            type="button"
            disabled={!deliverable || status === "scheduled"}
            onClick={handleSchedule}
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[12px] font-medium text-rose transition-colors hover:bg-white disabled:opacity-50"
          >
            <Calendar className="size-3" />
            {status === "scheduled" ? "Scheduled" : "Schedule"}
          </button>
          {pubHref ? (
            <a
              href={pubHref}
              target="_blank"
              rel="noreferrer"
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <PublishIcon className="size-3" />
              {publishVerb}
            </a>
          ) : (
            <button
              type="button"
              disabled={!deliverable || status === "published"}
              onClick={handlePublish}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <PublishIcon className="size-3" />
              {status === "published" ? "Published" : publishVerb}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function formatScheduledAt(iso: string | null | undefined): string {
  if (!iso) return "scheduled";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

// ===== Result bodies ==========================================================

function ResultBody({ result }: { result: AgentResult }) {
  if (result.type === "article") return <ArticleBody result={result} />;
  if (result.type === "video") return <VideoBody result={result} />;
  if (result.type === "site-blog") return <SiteBlogBody result={result} />;
  return <CodePrBody result={result} />;
}

function SiteBlogBody({ result }: { result: SiteBlogResult }) {
  const [iframeReady, setIframeReady] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const displayHost = (() => {
    try {
      return new URL(result.publish_url).host;
    } catch {
      return "your-site.com";
    }
  })();
  const displayPath = (() => {
    try {
      return new URL(result.publish_url).pathname;
    } catch {
      return "/blog";
    }
  })();

  // Esc to exit fullscreen.
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <Globe className="size-3" />
          Live · ~{result.word_count.toLocaleString()} words
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-emerald-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="size-2.5" />
          Published
        </div>
      </div>

      {/* Browser-chrome wrapper around the live iframe. */}
      <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-white shadow-[0_18px_40px_-20px_rgba(31,26,40,0.18)]">
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--ink-2)]/55 px-3 py-2">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-[#FF5F57]" />
            <span className="size-2.5 rounded-full bg-[#FEBC2E]" />
            <span className="size-2.5 rounded-full bg-[#28C840]" />
          </span>
          <div className="ml-2 flex flex-1 items-center gap-1.5 truncate rounded-[var(--radius-pill)] border border-[var(--border)] bg-white px-2.5 py-1 font-mono text-[11px] text-rose/85">
            <Lock className="size-2.5 shrink-0 text-emerald-600" />
            <span className="truncate">
              <span className="text-rose">{displayHost}</span>
              <span className="text-muted-foreground">{displayPath}</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => setFullscreen(true)}
            title="Fullscreen"
            className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
          >
            <Maximize2 className="size-3" />
          </button>
          <a
            href={result.publish_url}
            target="_blank"
            rel="noreferrer"
            className="grid size-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            title="Open in new tab"
          >
            <ExternalLink className="size-3" />
          </a>
        </div>
        <div className="relative h-[520px] bg-white">
          {!iframeReady && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-[var(--blue)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
                  Loading live page
                </span>
              </div>
            </div>
          )}
          <iframe
            src={result.preview_url}
            title={result.title}
            className={cn(
              "h-full w-full border-0 transition-opacity duration-500",
              iframeReady ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            onLoad={() => setIframeReady(true)}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>
      </div>

      <AnimatePresence>
        {fullscreen && (
          <FullscreenPreview
            url={result.preview_url}
            title={result.title}
            host={displayHost}
            path={displayPath}
            externalUrl={result.publish_url}
            onClose={() => setFullscreen(false)}
          />
        )}
      </AnimatePresence>

      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/30 p-4">
        <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          <Sparkles className="size-3" />
          Indexing status
        </div>
        <ul className="space-y-1 text-[12px] text-rose/85">
          <li className="flex items-center justify-between gap-2 font-mono">
            <span>ChatGPT search · queued</span>
            <span className="text-muted-foreground/85">~1h</span>
          </li>
          <li className="flex items-center justify-between gap-2 font-mono">
            <span>Perplexity · indexed</span>
            <CheckCircle2 className="size-3 text-emerald-600" />
          </li>
          <li className="flex items-center justify-between gap-2 font-mono">
            <span>Claude search · queued</span>
            <span className="text-muted-foreground/85">~2h</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ---- Fullscreen iframe preview --------------------------------------------

function FullscreenPreview({
  url,
  title,
  host,
  path,
  externalUrl,
  onClose,
}: {
  url: string;
  title: string;
  host: string;
  path: string;
  externalUrl: string;
  onClose: () => void;
}) {
  const [iframeReady, setIframeReady] = useState(false);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        className="fixed inset-0 z-[100] bg-[rgba(31,26,40,0.78)] backdrop-blur-2xl"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.98, y: 12 }}
        transition={{ duration: 0.5, ease }}
        className="fixed inset-4 z-[101] flex flex-col overflow-hidden rounded-[20px] bg-white shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Browser chrome */}
        <div className="flex items-center gap-2 border-b border-[var(--border)] bg-[var(--ink-2)]/55 px-3 py-2">
          <span className="flex gap-1.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Close fullscreen"
              className="grid size-3 place-items-center rounded-full bg-[#FF5F57] transition-transform hover:scale-110"
            >
              <X
                className="size-2 text-[#7F2A22] opacity-0 group-hover:opacity-100"
                strokeWidth={3}
              />
            </button>
            <span className="size-3 rounded-full bg-[#FEBC2E]" />
            <span className="size-3 rounded-full bg-[#28C840]" />
          </span>
          <div className="ml-2 flex flex-1 items-center gap-1.5 truncate rounded-[var(--radius-pill)] border border-[var(--border)] bg-white px-2.5 py-1 font-mono text-[11px] text-rose/85">
            <Lock className="size-2.5 shrink-0 text-emerald-600" />
            <span className="truncate">
              <span className="text-rose">{host}</span>
              <span className="text-muted-foreground">{path}</span>
            </span>
          </div>
          <a
            href={externalUrl}
            target="_blank"
            rel="noreferrer"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            title="Open in new tab"
          >
            <ExternalLink className="size-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            title="Exit fullscreen · Esc"
            className="grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
          >
            <Minimize2 className="size-3.5" />
          </button>
        </div>

        {/* Iframe surface fills the remaining space */}
        <div className="relative flex-1 bg-white">
          {!iframeReady && (
            <div className="absolute inset-0 grid place-items-center">
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="size-5 animate-spin text-[var(--blue)]" />
                <span className="font-mono text-[10px] uppercase tracking-[0.22em]">
                  Loading live page
                </span>
              </div>
            </div>
          )}
          <iframe
            src={url}
            title={title}
            className={cn(
              "h-full w-full border-0 transition-opacity duration-500",
              iframeReady ? "opacity-100" : "opacity-0",
            )}
            loading="lazy"
            onLoad={() => setIframeReady(true)}
            sandbox="allow-scripts allow-same-origin allow-popups"
          />
        </div>

        {/* Footer hint */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] bg-white/85 px-4 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground backdrop-blur-md">
          <span className="inline-flex items-center gap-1.5">
            <Globe className="size-3" />
            Live preview · {host}
          </span>
          <span>press esc to exit</span>
        </div>
      </motion.div>
    </>
  );
}

function ArticleBody({ result }: { result: ArticleResult }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <FileText className="size-3" />
          Article · ~{result.word_count_estimate.toLocaleString()} words
        </div>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-2.5 py-1 text-[11px] font-medium text-rose transition-colors hover:bg-white"
        >
          {copied ? (
            <Check className="size-3" strokeWidth={3} />
          ) : (
            <Copy className="size-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="prose prose-sm max-w-none rounded-[var(--radius-md)] border border-[var(--border)] bg-white/60 p-6 text-rose/90 prose-headings:text-rose prose-headings:font-medium prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-[13px] prose-table:text-[12px] prose-th:text-left prose-th:font-medium prose-td:py-1.5 prose-a:text-[var(--blue)]">
        <Markdown>{result.markdown}</Markdown>
      </div>
    </div>
  );
}

function VideoBody({ result }: { result: VideoResult }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const hasRealVideo =
    result.video_url.startsWith("/") || result.video_url.startsWith("blob:");

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <Play className="size-3" />
        Demo video · {result.duration_seconds}s · 1080p
      </div>

      {hasRealVideo ? (
        <div
          className="relative aspect-video overflow-hidden rounded-[var(--radius-md)] bg-black shadow-[0_24px_60px_-24px_rgba(0,0,0,0.45)]"
          onClick={toggle}
        >
          <video
            ref={videoRef}
            src={result.video_url}
            className="h-full w-full object-cover"
            playsInline
            loop
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          {!playing && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggle();
              }}
              aria-label="Play"
              className="absolute inset-0 grid place-items-center bg-black/30 text-white"
            >
              <span className="grid size-16 place-items-center rounded-full bg-white/15 backdrop-blur-md">
                <Play className="size-7" fill="currentColor" />
              </span>
            </button>
          )}
          <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/85 backdrop-blur-md">
            {playing ? (
              <Pause className="size-3" fill="currentColor" />
            ) : (
              <Play className="size-3" fill="currentColor" />
            )}
            1080p
          </div>
        </div>
      ) : (
        <div className="grid aspect-video place-items-center rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/60">
          <div className="grid size-14 place-items-center rounded-full bg-[var(--blue)] text-white">
            <Play className="size-6" fill="currentColor" />
          </div>
        </div>
      )}

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Storyboard
        </div>
        <ol className="space-y-1.5">
          {result.storyboard.map((s, i) => (
            <li key={i} className="flex gap-3 text-[12.5px] text-rose">
              <span className="w-5 shrink-0 font-mono text-[10.5px] text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="leading-relaxed">{s}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function CodePrBody({ result }: { result: CodePrResult }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <GitBranch className="size-3" />
        {result.repo} · {result.branch}
      </div>

      <a
        href={result.pr_url}
        target="_blank"
        rel="noreferrer"
        className="group flex items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/80 px-4 py-3 text-[12.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
      >
        <span className="flex items-center gap-2">
          <GitPullRequestArrow className="size-4 text-[var(--blue)]" />
          {result.pr_url.replace(/^https?:\/\//, "")}
        </span>
        <ExternalLink className="size-3.5 opacity-70 transition-transform group-hover:translate-x-0.5" />
      </a>

      <div>
        <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <FileCode className="size-3" />
          Files changed
        </div>
        <ul className="space-y-1 font-mono text-[12px] text-rose">
          {result.files_changed.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-[var(--blue)]">+</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Diff preview
        </div>
        <pre className="max-h-[36vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 p-4 font-mono text-[11.5px] leading-relaxed text-rose/90">
          {result.diff_preview}
        </pre>
      </div>
    </div>
  );
}

// ===== Manual brief variant ==================================================

function ManualBriefBody({
  action,
  completed,
  onMarkDone,
}: {
  action: ActionOut;
  completed: boolean;
  onMarkDone: () => void;
}) {
  const targetEntries = Object.entries(action.target).filter(([, v]) => {
    if (v == null) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    if (typeof v === "object" && !Array.isArray(v)) return false;
    return true;
  });

  return (
    <div className="grain relative flex-1 overflow-y-auto px-7 py-6">
      {completed && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-emerald-50 px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
          <CheckCircle2 className="size-3" />
          Marked as done
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          Brief
        </div>
        <p className="text-[14px] leading-relaxed text-rose">
          {action.rationale ??
            "No rationale provided for this action. Use the target metadata below as the starting point."}
        </p>
      </div>

      {targetEntries.length > 0 && (
        <div className="mb-6">
          <div className="mb-3 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
            Target
          </div>
          <dl className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/60 p-4">
            {targetEntries.map(([k, v]) => (
              <div
                key={k}
                className="grid grid-cols-[140px_1fr] gap-3 text-[13px]"
              >
                <dt className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  {k.replace(/_/g, " ")}
                </dt>
                <dd className="text-rose">
                  {Array.isArray(v) ? v.join(", ") : String(v)}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <div className="mb-6">
        <div className="mb-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          Why this is manual
        </div>
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          Earned-media plays — editorial pitches, community engagement, listicle
          inclusions — happen on surfaces we can't automate. Use this brief as the
          starting point and ship it where it lives.
        </p>
      </div>

      {!completed && (
        <button
          type="button"
          onClick={onMarkDone}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--rose)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          <CheckCircle2 className="size-3.5" strokeWidth={2.25} />
          Mark as done
        </button>
      )}
    </div>
  );
}

// ===== Panel shell ===========================================================

function PanelShell({
  action,
  onClose,
  children,
}: {
  action: ActionOut;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.32)] backdrop-blur-[4px]"
      />
      <motion.div
        key="panel"
        initial={{ x: 60, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 60, opacity: 0 }}
        transition={{ duration: 0.45, ease }}
        className="fixed right-0 top-0 z-50 h-svh w-full max-w-[880px] sm:w-[55vw] sm:min-w-[600px]"
      >
        <GlassPanel
          strong
          className="flex h-full flex-col overflow-hidden p-0 rounded-none rounded-l-[var(--radius-lg)]"
        >
          <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-7 py-5">
            <div className="flex flex-col gap-2">
              <AgentBadge agent={action.suggested_agent} size="md" />
              <span
                className="font-display text-rose"
                style={{
                  fontSize: 19,
                  fontWeight: 400,
                  fontVariationSettings: '"opsz" 60, "SOFT" 50',
                  letterSpacing: "-0.015em",
                  lineHeight: 1.2,
                }}
              >
                {action.title}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="flex flex-1 flex-col overflow-hidden">
            {children}
          </div>
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  );
}

// ===== Form atoms =============================================================

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-[10.5px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function PillGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-[11.5px] font-medium transition-all",
              active
                ? "bg-[var(--rose)] text-white"
                : "border border-[var(--border)] bg-white/70 text-[var(--lavender)] hover:border-[var(--border-strong)] hover:text-rose",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors",
        checked
          ? "border-[rgba(30,91,201,0.25)] bg-[rgba(30,91,201,0.06)]"
          : "border-[var(--border)] bg-white/70 hover:border-[var(--border-strong)]",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-rose">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      <span
        className={cn(
          "relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--blue)]" : "bg-[var(--ink-2)]/80",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 size-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}

// ===== Result builder (carries config into payload) ===========================

function buildResult(
  action: ActionOut,
  company: CompanyOut,
  agent: AgentKind,
  config: Config,
): AgentResult {
  // site_blog overrides the plain article path: produces a SiteBlogResult
  // that the panel renders as a live-site preview iframe.
  if (action.kind === "site_blog") {
    const previewUrl =
      (action.target.preview_url as string | undefined) ?? "";
    const publishUrl =
      (action.target.publish_url as string | undefined) ??
      `https://${company.own_domain ?? "example.com"}/blog/${
        (action.target.slug as string | undefined) ?? "post"
      }`;
    const topic =
      (action.target.topic as string | undefined) ?? "thought leadership";
    const wordCount =
      (action.target.word_count as number | undefined) ?? 1850;
    return {
      type: "site-blog",
      title: action.title,
      publish_url: publishUrl,
      preview_url: previewUrl,
      word_count: wordCount,
      topic,
    };
  }

  if (agent === "article") {
    const wordCount =
      config.length === "concise"
        ? 1200
        : config.length === "deep-dive"
          ? 3500
          : 2000;
    return {
      type: "article",
      title: action.title,
      markdown: buildArticleMarkdown(action, company, config),
      word_count_estimate: wordCount,
    };
  }
  if (agent === "video") {
    const seconds =
      config.duration === "30s" ? 30 : config.duration === "60s" ? 60 : 90;
    const isLegora = /legora/i.test(company.name);
    return {
      type: "video",
      title: action.title,
      duration_seconds: seconds,
      video_url: isLegora ? "/videos/jude_law.mp4" : "",
      thumbnail_url: "",
      storyboard: [
        "Open on contract document on screen",
        `Cut to ${company.own_brand?.name ?? company.name} interface — start review`,
        "Highlight key clauses being flagged",
        "Show timer · 4:32 elapsed",
        config.voiceover === "none" ? "End card with text overlay" : "Closing VO + CTA card",
      ],
    };
  }
  // code-pr
  const own = company.own_brand?.name ?? company.name;
  const domain = (action.target.domain as string | undefined) ?? "legora.com";
  const slug = action.id.split("_").slice(-1)[0]?.slice(0, 6) ?? "abc";
  const diff = [
    "diff --git a/app/layout.tsx b/app/layout.tsx",
    "@@ -8,6 +8,28 @@",
    "   <head>",
    `+    <script type="application/ld+json">{JSON.stringify({`,
    `+      "@context": "https://schema.org",`,
    `+      "@type": "${config.schemas[0] ?? "Organization"}",`,
    `+      "name": "${own}",`,
    `+      "url": "https://${domain}"`,
    `+    })}</script>`,
    "   </head>",
  ].join("\n");
  return {
    type: "code-pr",
    title: action.title,
    repo: `${own.toLowerCase().replace(/\s+/g, "-")}/website`,
    branch: config.defaultBranch,
    pr_url: `https://github.com/FabianSalge/brick-by-brick-clone/pull/4`,
    files_changed: ["app/layout.tsx", "app/seo.ts"],
    diff_preview: diff,
    schemas_added: config.schemas,
  };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

function buildArticleMarkdown(
  action: ActionOut,
  company: CompanyOut,
  config: Config,
): string {
  const own = company.own_brand?.name ?? company.name;
  const topic =
    (action.target.topic as string | undefined) ??
    (action.target.format as string | undefined) ??
    action.title;
  const competitors =
    (action.target.competitors as string[] | undefined) ?? [
      "Harvey",
      "Spellbook",
    ];

  const intro = {
    punchy: `If you're shipping legal-AI in 2026 and ${own} isn't surfacing in the answers, you're not in the conversation. Here's how to fix it.`,
    authoritative: `Every legal-AI buyer now starts a search inside ChatGPT, Perplexity, or Claude. The firms that win are the ones whose names appear in those answers — not the ones that wait their turn on Google.`,
    conversational: `Look, AI search isn't replacing Google overnight — but it's where the buyer journey *starts* now. And right now ${own} isn't showing up there. Let's talk about why and what to do.`,
  }[config.tone];

  const body = `# ${action.title}

${intro}

## What the Peec data shows

${action.rationale ?? "AI engines now answer buyer questions before the buyer ever lands on your site. Showing up in those answers is the new distribution moat."}

| Metric | ${own} | ${competitors[0] ?? "Top competitor"} |
|---|---|---|
| Visibility (own brand) | ${Math.round((company.brand_stats?.find((b) => b.is_own)?.visibility ?? 0) * 100)}% | ${Math.round((company.brand_stats?.find((b) => b.brand_name === competitors[0])?.visibility ?? 0.32) * 100)}% |
| Avg position when cited | #${company.brand_stats?.find((b) => b.is_own)?.position.toFixed(1) ?? "—"} | #${company.brand_stats?.find((b) => b.brand_name === competitors[0])?.position.toFixed(1) ?? "—"} |
| Sentiment | ${company.brand_stats?.find((b) => b.is_own)?.sentiment ?? 60} | ${company.brand_stats?.find((b) => b.brand_name === competitors[0])?.sentiment ?? 59} |

## Why this format works

LLMs cite list-shaped, table-shaped, and FAQ-shaped content disproportionately because it's easy to extract. This article is structured for retrievability:

- **Section 1** answers the literal question.
- **Sections 2–3** provide structured comparison (table + bullets).
- **Section 4** introduces ${own} via verifiable facts.
${config.includeFAQ ? "- **Section 5** closes with FAQ pairs that map to long-tail variants." : ""}

## How leading firms approach ${topic}

### 1. Start with the workflow, not the tool

The most common mistake is buying an AI tool and asking lawyers to find uses for it. The firms that succeed start with a painful workflow (document review, contract markup, research synthesis) and work backward to the tool that solves it.

### 2. Measure adoption, not licenses

A tool that 80% of lawyers use daily is worth more than one that 5% of lawyers use weekly. The cost per adopted user matters more than the cost per seat.

### 3. Embed AI in existing tools

Lawyers live in Word and their DMS. Any AI that requires switching to a separate interface will see low adoption.

## Where ${own} fits

${own} is the only platform on this list that combines [verifiable claim 1], [verifiable claim 2], and [verifiable claim 3]. The ${competitors.join(" and ")} comparison shows specifically where the differentiation is.

${
  config.includeFAQ
    ? `## FAQ

### How long does it take to implement AI document review?

Most firms see initial results within 2-4 weeks. Full workflow integration typically takes 6-8 weeks.

### What's the ROI of AI-assisted legal work?

Firms report 40-60% time savings on routine review and research tasks. The bigger ROI is competitive: firms using AI can offer fixed-fee pricing with confidence.

### Is AI-generated legal work reliable enough for client delivery?

AI excels at first-pass review, pattern recognition, and consistency checking. Human judgment remains essential for strategy, negotiation, and novel legal questions.
`
    : ""
}

---

*Drafted by MIDAS · ${own}. Tone: ${config.tone}. Schema: Article${config.includeFAQ ? " + FAQPage" : ""}.*
`;

  return body;
}
