import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react";

import GlassPanel from "@/components/GlassPanel";
import type { ActionOut, Opportunity } from "@/lib/types";

type Props = {
  action: ActionOut;
  onRun: (action: ActionOut) => void;
  completed?: boolean;
};

const OPPORTUNITY_LABEL: Record<Opportunity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

const AGENT_LABEL: Record<string, string> = {
  article: "article agent",
  video: "video agent",
  "code-pr": "code agent",
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
      className={`inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] ring-1 ring-inset ${styles}`}
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
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function ActionCard({ action, onRun, completed }: Props) {
  const chips = targetChips(action.target);
  const runnable = action.suggested_agent !== null;

  return (
    <GlassPanel className={`flex h-full flex-col p-6 ${completed ? "ring-1 ring-green-400/30" : ""}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        {completed ? (
          <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-green-50 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.2em] text-green-600 ring-1 ring-inset ring-green-200">
            <CheckCircle2 className="size-2.5" />
            Done
          </span>
        ) : (
          <OpportunityChip value={action.opportunity} />
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {action.kind.replace(/_/g, " ")}
        </span>
      </div>

      <h3
        className="mb-3 font-display text-rose"
        style={{
          fontSize: "20px",
          lineHeight: 1.2,
          letterSpacing: "-0.015em",
          fontWeight: 400,
          fontVariationSettings: '"opsz" 60, "SOFT" 50',
        }}
      >
        {action.title}
      </h3>

      {action.rationale && (
        <p className="mb-5 text-[13px] leading-relaxed text-muted-foreground">
          {action.rationale}
        </p>
      )}

      {chips.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-1.5">
          {chips.map((c) => (
            <span
              key={c}
              className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-2 py-1 font-mono text-[10.5px] text-rose/80"
            >
              {c}
            </span>
          ))}
        </div>
      )}

      <div className="mt-auto border-t border-[var(--border)] pt-4">
        {completed ? (
          <button
            type="button"
            onClick={() => onRun(action)}
            className="group inline-flex items-center gap-2 text-[12px] font-medium text-green-600 transition-colors hover:text-green-700"
          >
            <span className="font-mono uppercase tracking-[0.16em]">
              View article
            </span>
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        ) : runnable ? (
          <button
            type="button"
            onClick={() => onRun(action)}
            className="group inline-flex items-center gap-2 text-[12px] font-medium text-[var(--blue)] transition-colors hover:text-[var(--blue-soft)]"
          >
            <span className="font-mono uppercase tracking-[0.16em]">
              Run with {AGENT_LABEL[action.suggested_agent ?? ""] ?? "agent"}
            </span>
            <ArrowUpRight className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
            <span className="size-1 rounded-full bg-[var(--lavender)]/40" />
            Manual action
          </span>
        )}
      </div>
    </GlassPanel>
  );
}
