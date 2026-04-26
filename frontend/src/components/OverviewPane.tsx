import { useMemo } from "react";
import { motion } from "motion/react";

import LGCard from "@/components/LGCard";
import MarketGlobe from "@/components/MarketGlobe";
import type { CompanyOut } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
};

export default function OverviewPane({ company }: Props) {
  const ownStat = useMemo(
    () => company.brand_stats?.find((b) => b.is_own) ?? null,
    [company.brand_stats],
  );

  const leaderStat = useMemo(() => {
    if (!company.brand_stats) return null;
    const sorted = [...company.brand_stats].sort(
      (a, b) => b.visibility - a.visibility,
    );
    return sorted[0]?.is_own ? sorted[1] : sorted[0];
  }, [company.brand_stats]);

  const topMarket = useMemo(() => {
    if (!company.market_stats || company.market_stats.length === 0) return null;
    return [...company.market_stats].sort(
      (a, b) => b.visibility - a.visibility,
    )[0];
  }, [company.market_stats]);

  const refreshed = useMemo(
    () => formatRefreshed(company.last_refreshed_at),
    [company.last_refreshed_at],
  );

  const ownVis = ownStat?.visibility ?? 0;
  const ownPos = ownStat?.position ?? null;
  const gapToLeader = leaderStat ? ownVis - leaderStat.visibility : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.65, ease }}
      className="relative flex h-full flex-col px-8 pb-10 pt-7"
    >
      {/* Header — compact so the globe owns the page */}
      <div className="mb-4 flex items-end justify-between gap-6">
        <div>
          <div className="mb-2.5 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-px w-7 bg-[var(--lavender)]/40" />
            Overview
            <span className="font-mono text-muted-foreground/65">·</span>
            <span className="font-mono text-muted-foreground/85">
              refreshed {refreshed}
            </span>
          </div>
          <h1
            className="text-rose"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(2rem, 3.6vw, 2.5rem)",
              lineHeight: 1.02,
              letterSpacing: "-0.035em",
              fontWeight: 500,
            }}
          >
            How AI sees{" "}
            <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
              {brandName(company)}
            </span>
          </h1>
        </div>
        <Legend />
      </div>

      {/* Two-column: globe (left, hero) + stats stacked on the right */}
      <div
        className="grid flex-1 min-h-[680px] gap-6"
        style={{ gridTemplateColumns: "minmax(0, 1fr) 280px" }}
      >
        {/* Globe — hero, fills its column */}
        <div className="relative grid place-items-center overflow-hidden">
          <MarketGlobe
            markets={company.market_stats ?? []}
            width={920}
            height={760}
          />
        </div>

        {/* Stats column — right rail */}
        <div className="flex flex-col gap-3">
          <Stat
            delay={0.1}
            label="Visibility"
            value={`${Math.round(ownVis * 100)}%`}
            sub="own brand · 30d"
            delta="+5pp · 7d"
            deltaTone="good"
            tone="primary"
          />
          <Stat
            delay={0.2}
            label="Avg position"
            value={ownPos ? `#${ownPos.toFixed(1)}` : "—"}
            sub="best in tracked set"
            delta="−0.6 · 30d"
            deltaTone="good"
            tone="default"
          />
          <Stat
            delay={0.3}
            label="Gap to leader"
            value={`${gapToLeader >= 0 ? "+" : ""}${Math.round(gapToLeader * 100)}pp`}
            sub={`vs ${leaderStat?.brand_name ?? "—"}`}
            delta=""
            deltaTone="bad"
            tone="default"
          />
          {topMarket && (
            <Stat
              delay={0.4}
              label="Top market"
              value={topMarket.country_code}
              sub={topMarket.country_name}
              delta={`${Math.round(topMarket.visibility * 100)}% · #${topMarket.position.toFixed(1)}`}
              deltaTone="good"
              tone="default"
            />
          )}
        </div>
      </div>
    </motion.section>
  );
}

// ----------------------------------------------------------------------------

function Stat({
  delay,
  label,
  value,
  sub,
  delta,
  deltaTone,
  tone,
}: {
  delay: number;
  label: string;
  value: string;
  sub: string;
  delta: string;
  deltaTone: "good" | "bad" | "neutral";
  tone: "primary" | "default";
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease, delay }}
    >
      <LGCard cornerRadius={18}>
        <div className="px-4 py-3.5">
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.24em] text-muted-foreground/85">
              {label}
            </span>
            {delta && (
              <span
                className={
                  "font-mono text-[10px] tabular-nums " +
                  (deltaTone === "good"
                    ? "text-emerald-700"
                    : deltaTone === "bad"
                      ? "text-[#b04a3a]"
                      : "text-muted-foreground")
                }
              >
                {delta}
              </span>
            )}
          </div>
          <div
            className={tone === "primary" ? "text-[var(--blue)]" : "text-rose"}
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: tone === "primary" ? 36 : 26,
              fontWeight: tone === "primary" ? 600 : 500,
              letterSpacing: "-0.024em",
              lineHeight: 1,
            }}
          >
            {value}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground/85">
            {sub}
          </div>
        </div>
      </LGCard>
    </motion.div>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 sm:flex">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[rgba(174,156,168,0.7)]" />
        Untracked
      </span>
      <span className="flex items-center gap-1.5">
        <span
          className="size-1.5 rounded-full bg-[var(--blue)]"
          style={{ boxShadow: "0 0 0 4px rgba(30,91,201,0.18)" }}
        />
        Tracked
      </span>
    </div>
  );
}

// ----------------------------------------------------------------------------

function brandName(company: CompanyOut): string {
  if (company.own_brand) return company.own_brand.name;
  return company.name.replace(/\s+project$/i, "");
}

function formatRefreshed(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
  });
}
