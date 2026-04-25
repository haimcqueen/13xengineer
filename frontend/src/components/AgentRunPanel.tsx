import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode,
  FileText,
  GitBranch,
  GitPullRequestArrow,
  Loader2,
  Play,
  X,
} from "lucide-react";
import Markdown from "react-markdown";

import AgentBadge from "@/components/AgentBadge";
import GlassPanel from "@/components/GlassPanel";
import { getJob, startAgentRun } from "@/lib/mockBackend";
import type {
  ActionOut,
  AgentResult,
  ArticleResult,
  CodePrResult,
  CompanyOut,
  JobOut,
  VideoResult,
} from "@/lib/types";

type Props = {
  action: ActionOut;
  company: CompanyOut;
  completed?: boolean;
  onClose: () => void;
  onDone?: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

const AGENT_TITLE: Record<string, string> = {
  article: "Drafting article",
  video: "Generating video preview",
  "code-pr": "Opening pull request",
};

const ALL_STAGE_LABELS: Record<string, string[]> = {
  article: [
    "Researching keywords & intent",
    "Deep research & data collection",
    "Structuring the article",
    "Writing the full article",
  ],
  video: ["Drafting storyboard", "Selecting shots", "Rendering preview"],
  "code-pr": ["Cloning repo", "Generating diff", "Opening pull request"],
};

export default function AgentRunPanel({
  action,
  company,
  completed,
  onClose,
  onDone,
}: Props) {
  const isManual = action.suggested_agent === null;

  if (isManual) {
    return (
      <PanelShell action={action} onClose={onClose}>
        <ManualBriefBody
          action={action}
          completed={!!completed}
          onMarkDone={() => {
            onDone?.();
            onClose();
          }}
        />
      </PanelShell>
    );
  }

  return (
    <RunBody
      action={action}
      company={company}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

// ===== Run flow (article / video / code-pr) ====================================

function RunBody({
  action,
  company: _company,
  onClose,
  onDone,
}: {
  action: ActionOut;
  company: CompanyOut;
  onClose: () => void;
  onDone?: () => void;
}) {
  const [jobId] = useState(() => startAgentRun(action, _company));
  const [job, setJob] = useState<JobOut | null>(() => getJob(jobId));
  const [notifiedDone, setNotifiedDone] = useState(false);

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    const tick = () => {
      const j = getJob(jobId);
      setJob(j ? { ...j, progress: [...j.progress] } : null);
      if (j && j.status === "done" && !notifiedDone) {
        setNotifiedDone(true);
        onDone?.();
      }
      if (j && (j.status === "done" || j.status === "failed")) return;
      timer = window.setTimeout(() => {
        raf = requestAnimationFrame(tick);
      }, 200);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [jobId, notifiedDone, onDone]);

  const stages = useMemo(
    () =>
      (job?.progress ?? [])
        .filter((p) => p.type === "stage")
        .map((p) => String(p.data.label)),
    [job],
  );

  const status = job?.status ?? "pending";
  const agent = action.suggested_agent ?? "article";
  const title = AGENT_TITLE[agent] ?? "Running agent";
  const doneTitleText = doneTitle(agent);

  return (
    <PanelShell action={action} onClose={onClose}>
      <PanelHeaderStatus
        status={status}
        title={status === "done" ? doneTitleText : title}
      />
      <div className="grain relative overflow-y-auto px-7 py-6">
        {status !== "done" ? (
          <Stages stages={stages} agent={agent} />
        ) : (
          <ResultBody result={job!.result as unknown as AgentResult} />
        )}
      </div>
    </PanelShell>
  );
}

function doneTitle(agent: string): string {
  switch (agent) {
    case "article":
      return "Article ready";
    case "video":
      return "Video preview ready";
    case "code-pr":
      return "Pull request opened";
    default:
      return "Done";
  }
}

function Stages({ stages, agent }: { stages: string[]; agent: string }) {
  const labels = ALL_STAGE_LABELS[agent] ?? [];
  const completedCount = stages.length;

  return (
    <ol className="space-y-3">
      {labels.map((label, i) => {
        const done = i < completedCount - 1;
        const active = i === completedCount - 1;
        const pending = i >= completedCount;
        return (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/30 px-4 py-3 transition-colors ${
              active ? "ring-1 ring-[rgba(30,91,201,0.18)]" : ""
            }`}
          >
            <span
              className={`grid size-6 place-items-center rounded-full ${
                done
                  ? "bg-emerald-500 text-white"
                  : active
                    ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)]"
                    : "bg-[var(--ink-2)]/60 text-muted-foreground"
              }`}
            >
              {done ? (
                <Check className="size-3" strokeWidth={3} />
              ) : active ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <span className="size-1 rounded-full bg-current opacity-40" />
              )}
            </span>
            <span
              className={`text-[13px] ${
                pending ? "text-muted-foreground/60" : "text-rose"
              }`}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ===== Panel shell (shared between run + manual brief) =========================

function PanelShell({
  action,
  onClose,
  children,
}: {
  action: ActionOut;
  onClose: () => void;
  children: React.ReactNode;
}) {
  // Esc to close
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
          {children}
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
  );
}

function PanelHeaderStatus({
  status,
  title,
}: {
  status: string;
  title: string;
}) {
  const Icon =
    status === "done" ? Check : status === "failed" ? X : Loader2;
  const animate = status === "pending" || status === "running";
  return (
    <div className="flex items-center gap-3 border-b border-[var(--border)]/60 px-7 py-3 text-[12px] text-muted-foreground">
      <span
        className={`grid size-7 place-items-center rounded-full ${
          status === "done"
            ? "bg-emerald-500 text-white"
            : status === "failed"
              ? "bg-red-500 text-white"
              : "bg-[rgba(30,91,201,0.12)] text-[var(--blue)]"
        }`}
      >
        <Icon
          className={`size-3.5 ${animate ? "animate-spin" : ""}`}
          strokeWidth={2.5}
        />
      </span>
      <span className="text-[12px] tracking-[-0.005em] text-rose">{title}</span>
    </div>
  );
}

// ===== Manual brief variant ===================================================

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

// ===== Result bodies ===========================================================

function ResultBody({ result }: { result: AgentResult }) {
  if (result.type === "article") return <ArticleBody result={result} />;
  if (result.type === "video") return <VideoBody result={result} />;
  return <CodePrBody result={result} />;
}

function ArticleBody({ result }: { result: ArticleResult }) {
  const [copied, setCopied] = useState(false);
  const [postState, setPostState] = useState<"idle" | "loading" | "done">(
    "idle",
  );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const handlePost = () => {
    setPostState("loading");
    setTimeout(() => setPostState("done"), 1800);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <FileText className="size-3" />
        <span>Article · ~{result.word_count_estimate.toLocaleString()} words</span>
      </div>

      <div className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-white/60 p-6 text-rose/90 prose-headings:text-rose prose-headings:font-medium prose-h1:text-xl prose-h2:text-lg prose-h3:text-base prose-p:text-[13px] prose-p:leading-relaxed prose-li:text-[13px] prose-table:text-[12px] prose-th:text-left prose-th:font-medium prose-td:py-1.5 prose-a:text-[var(--blue)]">
        <Markdown>{result.markdown}</Markdown>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-4 py-2 text-[12px] font-medium text-rose transition-colors hover:bg-white"
        >
          {copied ? (
            <Check className="size-3.5" strokeWidth={3} />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copied" : "Copy markdown"}
        </button>
        <button
          type="button"
          onClick={handlePost}
          disabled={postState !== "idle"}
          className={`inline-flex items-center gap-2 rounded-[var(--radius-pill)] px-4 py-2 text-[12px] font-medium text-white transition-all ${
            postState === "done"
              ? "bg-emerald-500"
              : "bg-[var(--blue)] hover:opacity-90"
          } disabled:cursor-default`}
        >
          {postState === "loading" ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Posting...
            </>
          ) : postState === "done" ? (
            <>
              <Check className="size-3.5" strokeWidth={3} />
              Posted!
            </>
          ) : (
            <>
              <ExternalLink className="size-3.5" />
              Post to blog
            </>
          )}
        </button>
      </div>
    </div>
  );
}

function VideoBody({ result }: { result: VideoResult }) {
  const hasRealVideo =
    result.video_url.startsWith("/") || result.video_url.startsWith("blob:");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <Play className="size-3" />
        <span>Demo video · {result.duration_seconds}s</span>
      </div>

      {hasRealVideo ? (
        <video
          controls
          preload="metadata"
          className="w-full overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-black"
        >
          <source src={result.video_url} type="video/mp4" />
          Your browser doesn't support inline video.
        </video>
      ) : (
        <div className="relative aspect-video overflow-hidden rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/60">
          <div className="absolute inset-0 grid place-items-center">
            <div className="grid size-14 place-items-center rounded-full bg-[var(--blue)] text-white shadow-[0_8px_24px_-8px_rgba(30,91,201,0.5)]">
              <Play className="size-6" fill="currentColor" />
            </div>
          </div>
          <span className="absolute bottom-3 left-3 font-mono text-[10px] uppercase tracking-[0.2em] text-rose/70">
            {result.thumbnail_url}
          </span>
        </div>
      )}

      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Storyboard
        </div>
        <ol className="space-y-2">
          {result.storyboard.map((s, i) => (
            <li key={i} className="flex gap-3 text-[13px] text-rose">
              <span className="w-6 shrink-0 font-mono text-[11px] text-muted-foreground">
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <GitBranch className="size-3" />
        <span>
          {result.repo} · {result.branch}
        </span>
      </div>

      <a
        href={result.pr_url}
        target="_blank"
        rel="noreferrer"
        className="group inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--blue)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
      >
        <GitPullRequestArrow className="size-3.5" />
        Open pull request
        <ExternalLink className="size-3 opacity-70 transition-transform group-hover:translate-x-0.5" />
      </a>

      <div>
        <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          <FileCode className="size-3" />
          Files changed
        </div>
        <ul className="space-y-1.5 font-mono text-[12.5px] text-rose">
          {result.files_changed.map((f) => (
            <li key={f} className="flex items-center gap-2">
              <span className="text-[var(--blue)]">+</span>
              {f}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <div className="mb-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Diff preview
        </div>
        <pre className="max-h-[40vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 p-4 font-mono text-[12px] leading-relaxed text-rose/90">
          {result.diff_preview}
        </pre>
      </div>
    </div>
  );
}
