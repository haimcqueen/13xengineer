import { motion } from "motion/react";
import { ArrowUpRight, Sparkles } from "lucide-react";

import type { ActionOut, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const KIND_LABEL: Record<string, string> = {
  article: "Article",
  comparison: "Comparison",
  listicle: "Listicle",
  code: "Code & schema",
  video: "Video",
  subreddit: "Reddit",
  editorial: "Editorial",
  listicle_inclusion: "Listicle pitch",
  youtube: "YouTube",
};

type Props = {
  action: ActionOut;
  onRun: (action: ActionOut) => void;
  index?: number;
};

export default function ActionCardCompact({ action, onRun, index = 0 }: Props) {
  const runnable = action.suggested_agent !== null;
  const opp = action.opportunity;

  return (
    <motion.button
      type="button"
      onClick={() => onRun(action)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06, duration: 0.55, ease }}
      className="group relative flex h-full w-full flex-col p-5 text-left"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <OppChip value={opp} />
        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/75">
          {KIND_LABEL[action.kind] ?? action.kind}
        </span>
      </div>
      <h3
        className="mb-3 text-rose"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: "-0.018em",
          fontWeight: 500,
        }}
      >
        {action.title}
      </h3>
      {action.rationale && (
        <p
          className="mb-4 line-clamp-3 text-[12.5px] leading-relaxed text-muted-foreground"
          style={{ letterSpacing: "-0.005em" }}
        >
          {action.rationale}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between border-t border-[var(--border)] pt-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--blue)] transition-colors group-hover:text-[var(--blue-soft)]">
          {runnable ? "Run agent" : "Open brief"}
        </span>
        <ArrowUpRight className="size-3.5 text-[var(--blue)] transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
      </div>
    </motion.button>
  );
}

function OppChip({ value }: { value: Opportunity }) {
  if (value === "high") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md bg-[rgba(30,91,201,0.10)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
        <Sparkles className="size-2.5" strokeWidth={2.5} />
        High
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.18em]",
        value === "medium"
          ? "bg-[rgba(31,26,40,0.06)] text-rose/85"
          : "text-muted-foreground/75",
      )}
    >
      {value === "medium" ? "Med" : "Low"}
    </span>
  );
}
