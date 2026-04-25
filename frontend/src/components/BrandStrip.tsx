import { motion } from "motion/react";

import type { BrandStat } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  brands: BrandStat[];
};

export default function BrandStrip({ brands }: Props) {
  if (!brands.length) return null;
  const sorted = [...brands].sort((a, b) => b.visibility - a.visibility);
  const max = Math.max(...sorted.map((b) => b.visibility));

  return (
    <div className="px-5 py-4">
      <div className="mb-3 flex items-baseline justify-between">
        <h3
          className="text-rose"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 14,
            fontWeight: 500,
            letterSpacing: "-0.012em",
          }}
        >
          Brand standings
        </h3>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/75">
          last 30 days
        </span>
      </div>
      <div className="grid grid-cols-1 gap-1 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((b, i) => (
          <motion.div
            key={b.brand_id}
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 + i * 0.03, duration: 0.4, ease }}
            className={cn(
              "grid grid-cols-[18px_minmax(0,1fr)_70px_36px] items-center gap-2 rounded-md px-2 py-1.5",
              b.is_own && "bg-[rgba(30,91,201,0.05)]",
            )}
          >
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground/85">
              {i + 1}
            </span>
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  b.is_own
                    ? "bg-[var(--blue)] shadow-[0_0_0_3px_rgba(30,91,201,0.10)]"
                    : "bg-[var(--lavender)]/40",
                )}
              />
              <span
                className={cn(
                  "truncate text-[12.5px] tracking-[-0.005em]",
                  b.is_own ? "font-medium text-rose" : "text-rose/85",
                )}
              >
                {b.brand_name}
              </span>
              {b.is_own && (
                <span className="shrink-0 rounded-sm bg-[rgba(30,91,201,0.10)] px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--blue)]">
                  you
                </span>
              )}
            </div>
            <div className="relative h-1 overflow-hidden rounded-full bg-[var(--ink-2)]/55">
              <motion.div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  b.is_own
                    ? "bg-gradient-to-r from-[var(--blue)] to-[var(--blue-soft)]"
                    : "bg-[var(--lavender)]/55",
                )}
                initial={{ width: 0 }}
                animate={{ width: `${(b.visibility / max) * 100}%` }}
                transition={{ delay: 0.05 + i * 0.03 + 0.15, duration: 0.6, ease }}
              />
            </div>
            <span
              className={cn(
                "text-right font-mono text-[11.5px] tabular-nums",
                b.is_own ? "text-[var(--blue)] font-medium" : "text-rose/80",
              )}
            >
              {Math.round(b.visibility * 100)}%
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
