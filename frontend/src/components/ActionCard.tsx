import { ArrowRight, Calendar, CheckCircle2, Send, Sparkles } from "lucide-react";

import AgentBadge from "@/components/AgentBadge";
import GlassPanel from "@/components/GlassPanel";
import { useDeliverableForAction } from "@/lib/deliverables";
import type { Deliverable } from "@/lib/deliverables";
import { agentAccent, agentVerbs } from "@/lib/agentIdentity";
import type { ActionOut, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  action: ActionOut;
  onRun: (action: ActionOut) => void;
  /** Used for manual briefs (no agent). Runnable actions read deliverables instead. */
  completed?: boolean;
};

const OPPORTUNITY_LABEL: Record<Opportunity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function OpportunityChip({ value }: { value: Opportunity }) {
  const styles =
    value === "high"
      ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)] ring-[rgba(30,91,201,0.18)]"
      : value === "medium"
        ? "bg-[rgba(31,26,40,0.05)] text-rose ring-[var(--border-strong)]"
        : "bg-transparent text-muted-foreground ring-[var(--border)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ring-1 ring-inset",
        styles,
      )}
    >
      {value === "high" && <Sparkles className="size-2.5" />}
      {OPPORTUNITY_LABEL[value]}
    </span>
  );
}

function targetChips(target: ActionOut["target"]): string[] {
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
  return chips.slice(0, 4);
}

function humanize(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function statusChip(d: Deliverable | null, manualDone: boolean) {
  if (manualDone) {
    return {
      label: "Done",
      bg: "bg-emerald-50",
      fg: "text-emerald-700",
      ring: "ring-emerald-200",
      Icon: CheckCircle2,
    };
  }
  if (!d) return null;
  if (d.status === "draft")
    return {
      label: "Drafted",
      bg: "bg-amber-50",
      fg: "text-amber-800",
      ring: "ring-amber-200",
      Icon: Sparkles,
    };
  if (d.status === "scheduled")
    return {
      label: scheduleLabel(d.scheduled_at),
      bg: "bg-[rgba(30,91,201,0.08)]",
      fg: "text-[var(--blue)]",
      ring: "ring-[rgba(30,91,201,0.25)]",
      Icon: Calendar,
    };
  return {
    label: d.destination ? `Live · ${d.destination}` : "Published",
    bg: "bg-emerald-50",
    fg: "text-emerald-700",
    ring: "ring-emerald-200",
    Icon: Send,
  };
}

function scheduleLabel(iso: string | null): string {
  if (!iso) return "Scheduled";
  const d = new Date(iso);
  return `Scheduled · ${d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

export default function ActionCard({ action, onRun, completed }: Props) {
  const chips = targetChips(action.target);
  const agent = action.suggested_agent;
  const verbs = agentVerbs(agent);
  const accent = agentAccent(agent);

  const deliverable = useDeliverableForAction(action.id);
  const status = statusChip(deliverable, !!completed && agent === null);
  const isDone = !!deliverable || (completed && agent === null);

  const ctaLabel = isDone ? verbs.done : verbs.idle;

  return (
    <GlassPanel
      flat
      className={cn(
        "flex flex-col p-5",
        deliverable?.status === "published" && "ring-1 ring-emerald-400/35",
        deliverable?.status === "scheduled" && "ring-1 ring-[rgba(30,91,201,0.30)]",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <AgentBadge agent={agent} />
          {status && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] ring-1 ring-inset",
                status.bg,
                status.fg,
                status.ring,
              )}
            >
              <status.Icon className="size-2.5" />
              {status.label}
            </span>
          )}
        </div>
        <OpportunityChip value={action.opportunity} />
      </div>

      <h3
        className="mb-2 font-display text-rose"
        style={{
          fontSize: "18px",
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
          fontWeight: 500,
          fontVariationSettings: '"opsz" 60, "SOFT" 50',
        }}
      >
        {action.title}
      </h3>

      {action.rationale && (
        <p className="mb-3 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
          {action.rationale}
        </p>
      )}

      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {chips.slice(0, 3).map((c) => (
            <span
              key={c}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-2 py-0.5 font-mono text-[10px] text-rose/80"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => onRun(action)}
        className="mt-auto group flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] px-3.5 py-2 text-[12.5px] font-medium ring-1 ring-inset transition-transform hover:translate-y-[-1px]"
        style={{
          backgroundColor: isDone ? "rgba(16, 185, 129, 0.08)" : accent.bg,
          color: isDone ? "#047857" : accent.fg,
          boxShadow: isDone
            ? "inset 0 0 0 1px rgba(16, 185, 129, 0.25)"
            : `inset 0 0 0 1px ${accent.fg}26`,
        }}
      >
        <span className="inline-flex items-center gap-2">
          {isDone && <CheckCircle2 className="size-3.5" strokeWidth={2.25} />}
          {ctaLabel}
        </span>
        <ArrowRight
          className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
          strokeWidth={2}
        />
      </button>
    </GlassPanel>
  );
}
