import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles } from "lucide-react";

import ActionCard from "@/components/ActionCard";
import AgentRunPanel from "@/components/AgentRunPanel";
import BrandRanking from "@/components/BrandRanking";
import BrandStrip from "@/components/BrandStrip";
import KPITile from "@/components/KPITile";
import LGCard from "@/components/LGCard";
import MarketGlobe from "@/components/MarketGlobe";
import Sidebar, { type WorkspaceView } from "@/components/Sidebar";
import type {
  ActionOut,
  AgentKind,
  CompanyOut,
  Opportunity,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Filter = "all" | AgentKind | "manual";

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onReset: () => void;
};

export default function Workspace({ company, actions, onReset }: Props) {
  const [view, setView] = useState<WorkspaceView>("actions");
  const [running, setRunning] = useState<ActionOut | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  function handleAgentDone(actionId: string) {
    setCompleted((prev) => {
      if (prev.has(actionId)) return prev;
      const next = new Set(prev);
      next.add(actionId);
      return next;
    });
  }

  return (
    <div className="relative z-10 flex h-svh w-full overflow-hidden">
      <Sidebar
        company={company}
        actions={actions}
        current={view}
        completed={completed}
        onChange={setView}
        onReset={onReset}
      />

      <main className="relative flex-1 overflow-y-auto overscroll-contain">
        <AnimatePresence mode="wait">
          {view === "actions" && (
            <ActionsView
              key="actions"
              company={company}
              actions={actions}
              completed={completed}
              onRun={setRunning}
            />
          )}
          {view === "overview" && (
            <OverviewPane key="overview" company={company} />
          )}
          {view === "brands" && (
            <BrandsPane key="brands" company={company} />
          )}
          {view === "domains" && (
            <PlaceholderPane
              key="domains"
              title="Domains"
              subtitle="Top sources cited by AI engines for your category"
            />
          )}
          {view === "markets" && (
            <MarketsPane key="markets" company={company} />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {running && (
          <AgentRunPanel
            key={running.id}
            action={running}
            company={company}
            completed={completed.has(running.id)}
            onClose={() => setRunning(null)}
            onDone={() => handleAgentDone(running.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Actions (primary) ========================================================

function filterMatches(action: ActionOut, filter: Filter): boolean {
  if (filter === "all") return true;
  if (filter === "manual") return action.suggested_agent === null;
  return action.suggested_agent === filter;
}

function ActionsView({
  company,
  actions,
  completed,
  onRun,
}: {
  company: CompanyOut;
  actions: ActionOut[];
  completed: Set<string>;
  onRun: (a: ActionOut) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");

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

  const refreshed = useMemo(
    () => formatRefreshed(company.last_refreshed_at),
    [company.last_refreshed_at],
  );

  const ownVis = ownStat?.visibility ?? 0;
  const ownPos = ownStat?.position ?? null;
  const gapToLeader = leaderStat ? ownVis - leaderStat.visibility : 0;

  const counts = useMemo(() => {
    const c = { all: actions.length, article: 0, video: 0, "code-pr": 0, manual: 0 };
    for (const a of actions) {
      if (a.suggested_agent === null) c.manual++;
      else c[a.suggested_agent]++;
    }
    return c;
  }, [actions]);

  const sorted = useMemo(
    () =>
      [...actions]
        .filter((a) => filterMatches(a, filter))
        .sort(
          (a, b) =>
            OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity] ||
            a.title.localeCompare(b.title),
        ),
    [actions, filter],
  );

  // Group by tier preserving order
  const grouped = useMemo(() => {
    const groups: { tier: Opportunity; items: ActionOut[] }[] = [];
    for (const a of sorted) {
      const last = groups[groups.length - 1];
      if (last && last.tier === a.opportunity) last.items.push(a);
      else groups.push({ tier: a.opportunity, items: [a] });
    }
    return groups;
  }, [sorted]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-12 pt-7"
    >
      <div className="mx-auto w-full max-w-[760px]">
        {/* Header */}
        <div className="mb-5">
          <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-px w-7 bg-[var(--lavender)]/40" />
            Actions
            <span className="font-mono text-muted-foreground/65">·</span>
            <span className="font-mono text-muted-foreground/85">
              refreshed {refreshed}
            </span>
          </div>
          <h1
            className="text-rose"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: "clamp(1.85rem, 3.6vw, 2.4rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.03em",
              fontWeight: 500,
            }}
          >
            What to ship for{" "}
            <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
              {brandName(company)}
            </span>
          </h1>
          <p className="mt-2 max-w-[60ch] text-[13px] text-muted-foreground">
            Each action is a play to improve how AI engines see your brand. Deploy an
            agent to ship it for you.
          </p>
        </div>

        {/* KPI strip */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <LGCard cornerRadius={20}>
            <KPITile
              label="Visibility"
              value={`${Math.round(ownVis * 100)}%`}
              delta={{ direction: "up", text: "+5pp · 7d", tone: "good" }}
              accent
              index={0}
            />
          </LGCard>
          <LGCard cornerRadius={20}>
            <KPITile
              label="Avg position"
              value={ownPos ? `#${ownPos.toFixed(1)}` : "—"}
              delta={{ direction: "up", text: "best in set", tone: "good" }}
              index={1}
            />
          </LGCard>
          <LGCard cornerRadius={20}>
            <KPITile
              label="Gap to leader"
              value={`${gapToLeader >= 0 ? "+" : ""}${Math.round(gapToLeader * 100)}pp`}
              delta={{
                direction: "down",
                text: `vs ${leaderStat?.brand_name ?? "—"}`,
                tone: "bad",
              }}
              index={2}
            />
          </LGCard>
        </div>

        {/* Filter row */}
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <FilterChip
            label="All"
            count={counts.all}
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <FilterChip
            label="Article"
            count={counts.article}
            active={filter === "article"}
            onClick={() => setFilter("article")}
          />
          <FilterChip
            label="Video"
            count={counts.video}
            active={filter === "video"}
            onClick={() => setFilter("video")}
          />
          <FilterChip
            label="Website"
            count={counts["code-pr"]}
            active={filter === "code-pr"}
            onClick={() => setFilter("code-pr")}
          />
          <FilterChip
            label="Manual"
            count={counts.manual}
            active={filter === "manual"}
            onClick={() => setFilter("manual")}
          />
          <span className="ml-auto font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/75">
            {completed.size > 0 && (
              <span className="text-emerald-700">{completed.size} done · </span>
            )}
            {sorted.length} of {actions.length}
          </span>
        </div>

        {/* Feed */}
        {grouped.length === 0 ? (
          <FilterEmpty filter={filter} />
        ) : (
          <div className="space-y-8">
            {grouped.map((group) => (
              <div key={group.tier}>
                <TierDivider tier={group.tier} count={group.items.length} />
                <div className="mt-4 space-y-4">
                  {group.items.map((a, i) => (
                    <motion.div
                      key={a.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.03 * i, duration: 0.45, ease }}
                    >
                      <ActionCard
                        action={a}
                        onRun={onRun}
                        completed={completed.has(a.id)}
                      />
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1.5 text-[12px] font-medium transition-all",
        active
          ? "bg-[var(--rose)] text-white"
          : "border border-[var(--border)] bg-white/70 text-[var(--lavender)] hover:border-[var(--border-strong)] hover:text-rose",
      )}
    >
      {label}
      <span
        className={cn(
          "rounded-md px-1 font-mono text-[10px] tabular-nums",
          active
            ? "bg-white/15 text-white/85"
            : "bg-[var(--ink-2)]/60 text-muted-foreground",
        )}
      >
        {count}
      </span>
    </button>
  );
}

const TIER_LABEL: Record<Opportunity, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

function TierDivider({ tier, count }: { tier: Opportunity; count: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">
        {TIER_LABEL[tier]} · {count}
      </span>
      <span className="h-px flex-1 bg-[var(--border)]" />
    </div>
  );
}

function FilterEmpty({ filter }: { filter: Filter }) {
  const label =
    filter === "all"
      ? "actions"
      : filter === "code-pr"
        ? "website actions"
        : filter === "manual"
          ? "manual briefs"
          : `${filter} actions`;
  return (
    <div className="grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] py-20">
      <div className="text-center">
        <Sparkles
          className="mx-auto mb-3 size-5 text-[var(--lavender)]/60"
          strokeWidth={1.5}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          empty
        </span>
        <p className="mt-2 max-w-[36ch] text-[13px] text-muted-foreground">
          No {label} in this snapshot.
        </p>
      </div>
    </div>
  );
}

// ===== Overview (demoted) ======================================================

function OverviewPane({ company }: { company: CompanyOut }) {
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
      transition={{ duration: 0.5, ease }}
      className="px-10 pb-16 pt-9"
    >
      <div className="mb-7">
        <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
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
            fontSize: "clamp(2rem, 4vw, 2.65rem)",
            lineHeight: 1.05,
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

      <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        <LGCard cornerRadius={20}>
          <KPITile
            label="Visibility"
            value={`${Math.round(ownVis * 100)}%`}
            delta={{ direction: "up", text: "+5pp · 7d", tone: "good" }}
            accent
            index={0}
          />
        </LGCard>
        <LGCard cornerRadius={20}>
          <KPITile
            label="Avg position"
            value={ownPos ? `#${ownPos.toFixed(1)}` : "—"}
            delta={{ direction: "up", text: "best in set", tone: "good" }}
            index={1}
          />
        </LGCard>
        <LGCard cornerRadius={20}>
          <KPITile
            label="Gap to leader"
            value={`${gapToLeader >= 0 ? "+" : ""}${Math.round(gapToLeader * 100)}pp`}
            delta={{
              direction: "down",
              text: `vs ${leaderStat?.brand_name ?? "—"}`,
              tone: "bad",
            }}
            index={2}
          />
        </LGCard>
      </div>

      <div className="relative mb-12">
        <div className="mb-4 flex items-end justify-between gap-4 px-1">
          <h2
            className="text-rose"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 18,
              fontWeight: 500,
              letterSpacing: "-0.018em",
            }}
          >
            Visibility across markets
          </h2>
          <Legend />
        </div>
        <div className="relative flex justify-center overflow-hidden">
          <MarketGlobe
            markets={company.market_stats ?? []}
            width={1000}
            height={640}
          />
        </div>
      </div>

      {company.brand_stats && (
        <LGCard cornerRadius={20}>
          <BrandStrip brands={company.brand_stats} />
        </LGCard>
      )}
    </motion.section>
  );
}

function Legend() {
  return (
    <div className="hidden items-center gap-3 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/70 sm:flex">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[rgba(174,156,168,0.7)]" />
        Low
      </span>
      <span className="h-px w-4 bg-[var(--border)]" />
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 rounded-full bg-[var(--blue)]" />
        High
      </span>
    </div>
  );
}

// ===== Brands ===================================================================

function BrandsPane({ company }: { company: CompanyOut }) {
  return (
    <PaneFrame
      title="Brands"
      subtitle="Tracked brands and their visibility across the prompt set"
    >
      {company.brand_stats && <BrandRanking brands={company.brand_stats} />}
    </PaneFrame>
  );
}

// ===== Markets ==================================================================

function MarketsPane({ company }: { company: CompanyOut }) {
  const markets = company.market_stats ?? [];
  const sorted = [...markets].sort((a, b) => b.visibility - a.visibility);

  return (
    <PaneFrame
      title="Markets"
      subtitle={`Visibility across ${markets.length} active markets`}
    >
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/55 backdrop-blur-md">
          <div className="grid place-items-center overflow-hidden">
            <MarketGlobe markets={markets} width={620} height={520} />
          </div>
        </div>

        <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/65 backdrop-blur-md">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h3
              className="font-display text-rose"
              style={{
                fontSize: 16,
                fontWeight: 400,
                letterSpacing: "-0.012em",
                fontVariationSettings: '"opsz" 60, "SOFT" 50',
              }}
            >
              Country ranking
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Sorted by own-brand visibility
            </p>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {sorted.map((m, i) => (
              <motion.div
                key={m.country_code}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.03 * i, duration: 0.4, ease }}
                className="grid grid-cols-[28px_1fr_56px_44px] items-center gap-3 px-5 py-2.5 text-[13px]"
              >
                <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  {m.country_code}
                </span>
                <span className="truncate text-rose/90">{m.country_name}</span>
                <span className="text-right font-mono text-[12.5px] tabular-nums text-rose">
                  {Math.round(m.visibility * 100)}%
                </span>
                <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                  #{m.position.toFixed(1)}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </PaneFrame>
  );
}

// ===== Generic placeholder ======================================================

function PlaceholderPane({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <PaneFrame title={title} subtitle={subtitle}>
      <div className="grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] py-24">
        <div className="text-center">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            coming soon
          </span>
          <p className="mt-3 max-w-[40ch] text-[13px] text-muted-foreground">
            This view is part of the roadmap — drill-downs from the Peec MCP land here.
          </p>
        </div>
      </div>
    </PaneFrame>
  );
}

// ===== Pane shell ===============================================================

function PaneFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-9"
    >
      <div className="mb-7 flex items-baseline justify-between gap-6">
        <div>
          <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            <span className="h-px w-7 bg-[var(--lavender)]/40" />
            {title}
          </div>
          <h1
            className="font-display text-rose"
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.1rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.022em",
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            {title}
          </h1>
          <p className="mt-2 max-w-[60ch] text-[13px] tracking-[-0.005em] text-muted-foreground">
            {subtitle}
          </p>
        </div>
      </div>
      {children}
    </motion.section>
  );
}

// ===== utils ====================================================================

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

export type { WorkspaceView };
