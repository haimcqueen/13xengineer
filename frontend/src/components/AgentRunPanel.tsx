import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
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
  onClose: () => void;
};

const ease = [0.22, 1, 0.36, 1] as const;

const AGENT_TITLE: Record<string, string> = {
  article: "Drafting article",
  video: "Generating video preview",
  "code-pr": "Opening pull request",
};

export default function AgentRunPanel({ action, company, onClose }: Props) {
  const [jobId] = useState(() => startAgentRun(action, company));
  const [job, setJob] = useState<JobOut | null>(() => getJob(jobId));

  useEffect(() => {
    let raf = 0;
    let timer = 0;
    const tick = () => {
      const j = getJob(jobId);
      setJob(j);
      if (j && (j.status === "done" || j.status === "failed")) return;
      timer = window.setTimeout(() => {
        raf = requestAnimationFrame(tick);
      }, 250);
    };
    tick();
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [jobId]);

  // Esc to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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

  return (
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.32)] backdrop-blur-[6px]"
      />
      <motion.div
        key="panel"
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ duration: 0.5, ease }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto max-h-[88vh] w-full max-w-[760px] -translate-y-1/2 overflow-hidden"
      >
        <GlassPanel
          strong
          className="flex max-h-[88vh] flex-col overflow-hidden p-0"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 border-b border-[var(--border)] px-7 py-5">
            <div className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-[rgba(30,91,201,0.10)] text-[var(--blue)]">
                {status === "done" ? (
                  <Check className="size-4" strokeWidth={2.5} />
                ) : status === "failed" ? (
                  <X className="size-4" strokeWidth={2.5} />
                ) : (
                  <Loader2 className="size-4 animate-spin" strokeWidth={2} />
                )}
              </span>
              <div className="flex flex-col">
                <span className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
                  {agent} agent
                </span>
                <span
                  className="font-display text-rose"
                  style={{
                    fontSize: 18,
                    fontWeight: 400,
                    fontVariationSettings: '"opsz" 60, "SOFT" 50',
                    letterSpacing: "-0.015em",
                  }}
                >
                  {status === "done" ? doneTitle(agent) : title}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Body */}
          <div className="grain relative overflow-y-auto px-7 py-6">
            {status !== "done" ? (
              <Stages stages={stages} agent={agent} />
            ) : (
              <ResultBody result={job!.result as unknown as AgentResult} />
            )}
          </div>
        </GlassPanel>
      </motion.div>
    </AnimatePresence>
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
  const all = [...stages];
  const expected =
    agent === "article" ? 3 : agent === "video" ? 3 : 3;
  while (all.length < expected) all.push("");

  return (
    <ol className="space-y-3">
      {all.map((label, i) => {
        const completed = i < stages.length - (label === "" ? 0 : 1);
        const active = label !== "" && i === stages.length - 1;
        const pending = label === "";
        return (
          <li
            key={i}
            className={`flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/30 px-4 py-3 transition-colors ${
              active ? "ring-1 ring-[rgba(30,91,201,0.18)]" : ""
            }`}
          >
            <span
              className={`grid size-6 place-items-center rounded-full ${
                completed
                  ? "bg-[var(--blue)] text-white"
                  : active
                    ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)]"
                    : "bg-[var(--ink-2)]/60 text-muted-foreground"
              }`}
            >
              {completed ? (
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
              {label || `Step ${i + 1}`}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ResultBody({ result }: { result: AgentResult }) {
  if (result.type === "article") return <ArticleBody result={result} />;
  if (result.type === "video") return <VideoBody result={result} />;
  return <CodePrBody result={result} />;
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
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <FileText className="size-3" />
        <span>Markdown · ~{result.word_count_estimate.toLocaleString()} words</span>
      </div>

      <pre className="max-h-[48vh] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 p-5 font-mono text-[12.5px] leading-relaxed text-rose/90 whitespace-pre-wrap">
        {result.markdown}
      </pre>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-2 rounded-[var(--radius-pill)] bg-[var(--blue)] px-4 py-2 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {copied ? <Check className="size-3.5" strokeWidth={3} /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy markdown"}
        </button>
      </div>
    </div>
  );
}

function VideoBody({ result }: { result: VideoResult }) {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
        <Play className="size-3" />
        <span>Demo video · {result.duration_seconds}s</span>
      </div>

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
