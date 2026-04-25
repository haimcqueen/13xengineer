import { memo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Check, Loader2 } from "lucide-react";

import type { ActionOut, JobOut, Opportunity } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  action: ActionOut;
  index: number;
  job: JobOut | null;
  onRun: (action: ActionOut) => void;
  onViewResult: (action: ActionOut) => void;
};

const AGENT_LABEL: Record<string, string> = {
  article: "article agent",
  video: "video agent",
  "code-pr": "code agent",
};

const NUMBER_COLOR: Record<Opportunity, string> = {
  high: "text-[var(--blue)]",
  medium: "text-rose/85",
  low: "text-[var(--lavender)]/70",
};

const OPP_COLOR: Record<Opportunity, string> = {
  high: "text-[var(--blue)]",
  medium: "text-rose/75",
  low: "text-muted-foreground/70",
};

function ActionCardImpl({
  action,
  index,
  job,
  onRun,
  onViewResult,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const status = job?.status ?? "idle";
  const isRunning = status === "running" || status === "pending";
  const isDone = status === "done";
  const runnable = action.suggested_agent !== null;

  const currentStage =
    job?.progress
      .filter((p) => p.type === "stage")
      .map((p) => String(p.data.label))
      .pop() ?? null;

  const progress = computeProgress(job);
  const targetChips = collectTargetChips(action.target);
  const numberStr = String(index).padStart(2, "0");

  const discState: DiscState = !runnable
    ? "manual"
    : isRunning
      ? "running"
      : isDone
        ? "done"
        : "idle";

  return (
    <div
      className={`glass-flat overflow-hidden rounded-[var(--radius-lg)] transition-[transform,background-color] duration-[250ms] ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[2px] ${
        isDone ? "bg-[rgba(30,91,201,0.045)]" : ""
      }`}
    >
      <div className="flex items-stretch">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="group flex flex-1 items-center gap-5 px-6 py-5 text-left outline-none transition-colors duration-200 hover:bg-[rgba(31,26,40,0.025)] focus-visible:bg-[rgba(31,26,40,0.025)]"
        >
          <span
            className={`shrink-0 select-none font-display tabular-nums ${NUMBER_COLOR[action.opportunity]}`}
            style={{
              fontSize: 26,
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144',
              minWidth: "2ch",
            }}
          >
            {numberStr}
          </span>

          <div className="min-w-0 flex-1">
            <h3
              className="font-display text-rose"
              style={{
                fontSize: 16.5,
                lineHeight: 1.3,
                letterSpacing: "-0.012em",
                fontWeight: 400,
                fontVariationSettings: '"opsz" 60, "SOFT" 50',
              }}
            >
              {action.title}
            </h3>
            <div className="mt-1.5 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="font-mono">
                {action.kind.replace(/_/g, " ")}
              </span>
              <span className="text-muted-foreground/40">·</span>
              <span className={`font-medium ${OPP_COLOR[action.opportunity]}`}>
                {action.opportunity}
              </span>
              {runnable && (
                <>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="font-mono">
                    {AGENT_LABEL[action.suggested_agent ?? ""] ?? "agent"}
                  </span>
                </>
              )}
            </div>
          </div>
        </button>

        <div className="flex shrink-0 items-center pr-6">
          <RunDisc
            state={discState}
            onClick={
              isDone
                ? () => onViewResult(action)
                : runnable
                  ? () => onRun(action)
                  : undefined
            }
          />
        </div>
      </div>

      <AnimatePresence>
        {isRunning && (
          <motion.div
            key="prog"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="border-t border-[rgba(30,91,201,0.12)]"
          >
            <div className="flex items-center gap-3 px-6 py-3 text-[12px]">
              <span className="relative grid size-2 place-items-center">
                <motion.span
                  className="absolute inline-flex size-2 rounded-full bg-[var(--blue)]"
                  animate={{ scale: [1, 1.9], opacity: [0.5, 0] }}
                  transition={{
                    duration: 1.6,
                    repeat: Infinity,
                    ease: "easeOut",
                  }}
                />
                <span className="absolute inline-flex size-2 rounded-full bg-[var(--blue)] opacity-90" />
              </span>
              <span className="text-muted-foreground">
                {currentStage ? `${currentStage}…` : "Starting agent…"}
              </span>
              <div className="relative ml-auto h-px w-32 overflow-hidden bg-[var(--border)]">
                <motion.span
                  initial={{ width: 0 }}
                  animate={{ width: `${progress * 100}%` }}
                  transition={{ duration: 0.5, ease }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--blue)] to-[var(--blue-soft)]"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="expand"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="border-t border-[var(--border)]"
          >
            <div className="space-y-4 px-6 py-5">
              {action.rationale && (
                <p className="max-w-[64ch] text-[13px] leading-relaxed text-muted-foreground">
                  {action.rationale}
                </p>
              )}
              {targetChips.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {targetChips.map((c) => (
                    <span
                      key={c}
                      className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-2 py-1 font-mono text-[10.5px] text-rose/80"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              )}
              {!runnable && (
                <p className="text-[12px] italic text-muted-foreground/80">
                  Felix doesn't have an agent for this kind of action yet —
                  execute it manually in your own workflow.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const ActionCard = memo(ActionCardImpl);
export default ActionCard;

type DiscState = "idle" | "running" | "done" | "manual";

function RunDisc({
  state,
  onClick,
}: {
  state: DiscState;
  onClick?: () => void;
}) {
  const interactive = state === "idle" || state === "done";
  const label =
    state === "idle"
      ? "Run agent"
      : state === "done"
        ? "View result"
        : state === "running"
          ? "Running"
          : "Manual action";

  return (
    <button
      type="button"
      onClick={(e) => {
        if (!interactive) return;
        e.stopPropagation();
        onClick?.();
      }}
      aria-label={label}
      disabled={!interactive}
      className={`group glass grid size-11 shrink-0 place-items-center rounded-full transition-all duration-300 ${
        interactive
          ? "cursor-pointer hover:-translate-y-[1px]"
          : "cursor-default"
      }`}
    >
      <DiscIcon state={state} />
    </button>
  );
}

function DiscIcon({ state }: { state: DiscState }) {
  if (state === "manual") {
    return <ArrowUpRight className="size-4 text-[var(--lavender)]/50" />;
  }
  if (state === "running") {
    return <Loader2 className="size-4 animate-spin text-[var(--blue)]" />;
  }
  if (state === "done") {
    return (
      <Check className="size-4 text-[var(--blue)]" strokeWidth={2.6} />
    );
  }
  return (
    <ArrowUpRight className="size-4 text-[var(--blue)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
  );
}

function computeProgress(job: JobOut | null): number {
  if (!job) return 0;
  if (job.status === "done") return 1;
  const stagesSeen = job.progress.filter((p) => p.type === "stage").length;
  const total = 3;
  return Math.min(0.15 + (stagesSeen / total) * 0.85, 0.95);
}

function collectTargetChips(target: ActionOut["target"]): string[] {
  const chips: string[] = [];
  for (const [k, v] of Object.entries(target)) {
    if (v == null) continue;
    if (Array.isArray(v)) {
      if (v.length === 0) continue;
      chips.push(`${humanize(k)}: ${v.join(", ")}`);
    } else if (typeof v === "object") {
      continue;
    } else {
      chips.push(`${humanize(k)}: ${String(v)}`);
    }
  }
  return chips.slice(0, 5);
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
