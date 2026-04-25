import { useMemo } from "react";
import { motion } from "motion/react";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  label: string;
  value: string;
  /** -ve / +ve / 0 — direction. Magnitude shown as text. */
  delta?: { direction: "up" | "down" | "flat"; text: string; tone?: "good" | "bad" | "neutral" };
  /** Pre-baked sparkline values (7-30 points). Auto-generated if omitted. */
  spark?: number[];
  accent?: boolean;
  index?: number;
};

function generateSpark(seed: number, points = 14): number[] {
  // Smooth-ish synthetic curve with seeded randomness
  const out: number[] = [];
  let x = 0.5 + Math.sin(seed) * 0.1;
  for (let i = 0; i < points; i++) {
    x += (Math.sin(seed + i * 0.7) * 0.08 + Math.cos(seed * 1.3 + i * 0.4) * 0.06);
    out.push(Math.max(0.1, Math.min(0.95, x)));
  }
  return out;
}

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const w = 80;
  const h = 22;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.001, max - min);
  const stepX = w / (values.length - 1);
  const pts = values.map((v, i) => {
    const x = i * stepX;
    const y = h - ((v - min) / span) * (h - 4) - 2;
    return [x, y] as const;
  });
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`)
    .join(" ");
  const area = `${d} L ${w} ${h} L 0 ${h} Z`;
  const last = pts[pts.length - 1];
  const gradId = `sparkfill-${color.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${gradId})`} />
      <path
        d={d}
        stroke={color}
        strokeWidth="1.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r="2" fill={color} />
    </svg>
  );
}

function DeltaPill({ delta }: { delta: NonNullable<Props["delta"]> }) {
  const { direction, text, tone = "neutral" } = delta;
  const Icon =
    direction === "up" ? TrendingUp : direction === "down" ? TrendingDown : Minus;
  const tonal =
    tone === "good"
      ? "bg-[rgba(16,185,129,0.10)] text-[#047857]"
      : tone === "bad"
        ? "bg-[rgba(239,68,68,0.10)] text-[#B91C1C]"
        : "bg-[rgba(31,26,40,0.06)] text-[var(--lavender)]";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums tracking-[-0.005em]",
        tonal,
      )}
    >
      <Icon className="size-2.5" strokeWidth={2.5} />
      {text}
    </span>
  );
}

export default function KPITile({
  label,
  value,
  delta,
  spark,
  accent,
  index = 0,
}: Props) {
  const sparkData = useMemo(
    () => spark ?? generateSpark((label.length + 3) * 7.13),
    [spark, label],
  );
  const sparkColor = accent ? "#1E5BC9" : "#574F61";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 + index * 0.06, duration: 0.55, ease }}
      className="relative h-full w-full p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground/80">
          {label}
        </span>
        {delta && <DeltaPill delta={delta} />}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <span
          className={cn(
            "tabular-nums",
            accent ? "text-[var(--blue)]" : "text-rose",
          )}
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(2rem, 3.6vw, 2.6rem)",
            lineHeight: 1,
            letterSpacing: "-0.04em",
            fontWeight: 500,
          }}
        >
          {value}
        </span>
        <Sparkline values={sparkData} color={sparkColor} />
      </div>
    </motion.div>
  );
}
