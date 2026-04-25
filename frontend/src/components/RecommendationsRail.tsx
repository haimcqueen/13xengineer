import { motion } from "motion/react";
import { ArrowUpRight, Sparkles } from "lucide-react";

import type { ActionOut, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Props = {
  actions: ActionOut[];
  onSelect: (action: ActionOut) => void;
  limit?: number;
};

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

export default function RecommendationsRail({
  actions,
  onSelect,
  limit = 8,
}: Props) {
  const sorted = [...actions]
    .sort((a, b) => OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity])
    .slice(0, limit);

  if (!sorted.length) return null;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/65 backdrop-blur-md">
      <div className="flex items-baseline justify-between gap-4 border-b border-[var(--border)] px-5 py-4">
        <div>
          <h3
            className="font-display text-rose"
            style={{
              fontSize: 16,
              lineHeight: 1.1,
              letterSpacing: "-0.012em",
              fontWeight: 400,
              fontVariationSettings: '"opsz" 60, "SOFT" 50',
            }}
          >
            Top recommendations
          </h3>
          <p className="mt-1 text-[11px] tracking-[-0.005em] text-muted-foreground">
            Ranked by opportunity score
          </p>
        </div>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
          {sorted.length} of {actions.length}
        </span>
      </div>

      <ul className="divide-y divide-[var(--border)]">
        {sorted.map((a, i) => (
          <motion.li
            key={a.id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * i, duration: 0.45, ease }}
          >
            <button
              type="button"
              onClick={() => onSelect(a)}
              className="group flex w-full flex-col gap-1.5 px-5 py-3 text-left transition-colors hover:bg-[var(--ink-2)]/35"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <Dot opp={a.opportunity} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                    {KIND_LABEL[a.kind] ?? a.kind}
                  </span>
                </span>
                <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[var(--blue)]" />
              </div>
              <div className="line-clamp-2 text-[13px] leading-snug tracking-[-0.005em] text-rose">
                {a.title}
              </div>
            </button>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}

function Dot({ opp }: { opp: Opportunity }) {
  if (opp === "high") {
    return (
      <span className="inline-flex items-center gap-1 rounded-sm bg-[rgba(30,91,201,0.08)] px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.16em] text-[var(--blue)]">
        <Sparkles className="size-2.5" strokeWidth={2} />
        High
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-[0.16em]",
        opp === "medium"
          ? "bg-[rgba(31,26,40,0.05)] text-rose/85"
          : "text-muted-foreground/75",
      )}
    >
      {opp === "medium" ? "Med" : "Low"}
    </span>
  );
}
