import { motion } from "motion/react";

import type { BrandStat } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  brands: BrandStat[];
};

export default function BrandRanking({ brands }: Props) {
  if (!brands.length) return null;

  const sorted = [...brands].sort((a, b) => b.visibility - a.visibility);
  const max = Math.max(...sorted.map((b) => b.visibility));
  const totalMentions = sorted.reduce((s, b) => s + b.mention_count, 0);

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
            Brand visibility
          </h3>
          <p className="mt-1 text-[11px] tracking-[-0.005em] text-muted-foreground">
            Last 30 days · {totalMentions.toLocaleString()} total mentions
          </p>
        </div>
        <div className="hidden items-baseline gap-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70 sm:flex">
          <span className="w-[70px] text-right">Visibility</span>
          <span className="w-[44px] text-right">Pos.</span>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        {sorted.map((b, i) => (
          <motion.div
            key={b.brand_id}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.45, ease }}
            className="grid grid-cols-[20px_1fr_140px_70px_44px] items-center gap-3 px-5 py-2.5 text-[13px] sm:gap-4"
          >
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/85">
              {i + 1}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  b.is_own
                    ? "bg-[var(--blue)] shadow-[0_0_0_3px_rgba(30,91,201,0.10)]"
                    : "bg-[var(--lavender)]/45",
                )}
              />
              <span
                className={cn(
                  "truncate tracking-[-0.005em]",
                  b.is_own ? "font-medium text-rose" : "text-rose/85",
                )}
              >
                {b.brand_name}
              </span>
              {b.is_own && (
                <span className="shrink-0 rounded-sm bg-[rgba(30,91,201,0.08)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-[var(--blue)]">
                  you
                </span>
              )}
            </div>

            <div className="relative h-1.5 overflow-hidden rounded-full bg-[var(--ink-2)]/55">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  b.is_own
                    ? "bg-gradient-to-r from-[var(--blue)] to-[var(--blue-soft)]"
                    : "bg-[var(--lavender)]/55",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(b.visibility / max) * 100}%` }}
                transition={{ delay: 0.04 * i + 0.18, duration: 0.7, ease }}
              />
            </div>

            <span className="text-right font-mono text-[12.5px] tabular-nums text-rose">
              {Math.round(b.visibility * 100)}%
            </span>
            <span
              className={cn(
                "text-right font-mono text-[11.5px] tabular-nums",
                b.is_own ? "text-[var(--blue)]" : "text-muted-foreground",
              )}
            >
              #{b.position.toFixed(1)}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
