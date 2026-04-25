import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Code,
  FileText,
  GitCompareArrows,
  MessageSquare,
  Play,
  Sparkles,
  Users,
} from "lucide-react";

import ActionCard from "@/components/ActionCard";
import ActionCardCompact from "@/components/ActionCardCompact";
import AgentRunPanel from "@/components/AgentRunPanel";
import BrandRanking from "@/components/BrandRanking";
import BrandStrip from "@/components/BrandStrip";
import KPITile from "@/components/KPITile";
import LGCard from "@/components/LGCard";
import MarketGlobe from "@/components/MarketGlobe";
import Sidebar, { type WorkspaceView } from "@/components/Sidebar";
import type { ActionOut, CompanyOut, Opportunity } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onReset: () => void;
};

export default function Workspace({ company, actions, onReset }: Props) {
  const [view, setView] = useState<WorkspaceView>("overview");
  const [running, setRunning] = useState<ActionOut | null>(null);

  return (
    <div className="relative z-10 flex min-h-svh w-full">
      <Sidebar
        company={company}
        actions={actions}
        current={view}
        onChange={setView}
        onReset={onReset}
      />

      <main className="relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {view === "overview" && (
            <OverviewPane
              key="overview"
              company={company}
              actions={actions}
              onSelect={setRunning}
            />
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
          {view === "owned" && (
            <ActionsPane
              key="owned"
              title="Owned media"
              subtitle="Surfaces you control — articles, comparisons, schema, video"
              actions={actions.filter((a) => a.category === "owned_media")}
              onRun={setRunning}
            />
          )}
          {view === "earned" && (
            <ActionsPane
              key="earned"
              title="Earned media"
              subtitle="Third-party citations — editorial, community, references"
              actions={actions.filter((a) => a.category === "earned_media")}
              onRun={setRunning}
            />
          )}
          {view === "studio-articles" && (
            <StudioPane
              key="studio-articles"
              icon={FileText}
              title="Articles"
              subtitle="Long-form drafts, listicles, and how-to guides"
              actions={actions.filter((a) =>
                ["article", "listicle"].includes(a.kind),
              )}
              onRun={setRunning}
            />
          )}
          {view === "studio-comparisons" && (
            <StudioPane
              key="studio-comparisons"
              icon={GitCompareArrows}
              title="Comparisons"
              subtitle="Head-to-head pages targeting competitor-comparison queries"
              actions={actions.filter((a) => a.kind === "comparison")}
              onRun={setRunning}
            />
          )}
          {view === "studio-outreach" && (
            <StudioPane
              key="studio-outreach"
              icon={MessageSquare}
              title="Outreach"
              subtitle="Editorial pitches, listicle inclusions, journalist outreach"
              actions={actions.filter((a) =>
                ["editorial", "listicle_inclusion"].includes(a.kind),
              )}
              onRun={setRunning}
            />
          )}
          {view === "studio-community" && (
            <StudioPane
              key="studio-community"
              icon={Users}
              title="Community"
              subtitle="Reddit, YouTube, and community engagement"
              actions={actions.filter((a) =>
                ["subreddit", "youtube"].includes(a.kind),
              )}
              onRun={setRunning}
            />
          )}
          {view === "studio-code" && (
            <StudioPane
              key="studio-code"
              icon={Code}
              title="Code & schema"
              subtitle="Structured data, llms.txt, and on-page changes"
              actions={actions.filter((a) => a.kind === "code")}
              onRun={setRunning}
            />
          )}
          {view === "studio-videos" && (
            <StudioPane
              key="studio-videos"
              icon={Play}
              title="Videos"
              subtitle="Demo videos, walkthroughs, and feature highlights"
              actions={actions.filter((a) => a.kind === "video")}
              onRun={setRunning}
            />
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {running && (
          <AgentRunPanel
            key={running.id}
            action={running}
            company={company}
            onClose={() => setRunning(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Overview =================================================================

function OverviewPane({
  company,
  actions,
  onSelect,
}: {
  company: CompanyOut;
  actions: ActionOut[];
  onSelect: (a: ActionOut) => void;
}) {
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

  const topActions = useMemo(
    () =>
      [...actions]
        .sort((a, b) => OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity])
        .slice(0, 3),
    [actions],
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease }}
      className="px-10 pb-16 pt-9"
    >
      {/* Header */}
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

      {/* Hero KPI tiles — liquid glass */}
      <div className="mb-12 grid grid-cols-1 gap-5 md:grid-cols-3">
        <LGCard cornerRadius={20}>
          <KPITile
            label="Visibility"
            value={`${Math.round(ownVis * 100)}%`}
            delta={{
              direction: "up",
              text: "+5pp · 7d",
              tone: "good",
            }}
            accent
            index={0}
          />
        </LGCard>
        <LGCard cornerRadius={20}>
          <KPITile
            label="Avg position"
            value={ownPos ? `#${ownPos.toFixed(1)}` : "—"}
            delta={{
              direction: "up",
              text: "best in set",
              tone: "good",
            }}
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

      {/* Globe — full width hero, no panel border */}
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

      {/* Top recommendations — 3 hero cards, liquid glass */}
      <div className="mb-12">
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
            Ship this week
          </h2>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/75">
            {topActions.length} of {actions.length} →
          </span>
        </div>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {topActions.map((a, i) => (
            <LGCard
              key={a.id}
              cornerRadius={20}
              onClick={() => onSelect(a)}
            >
              <ActionCardCompact action={a} onRun={onSelect} index={i} />
            </LGCard>
          ))}
        </div>
      </div>

      {/* Brand standings — compact glass strip */}
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

// ===== Actions (Owned / Earned) ================================================

function ActionsPane({
  title,
  subtitle,
  actions,
  onRun,
}: {
  title: string;
  subtitle: string;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
}) {
  const sorted = [...actions].sort(
    (a, b) => OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity],
  );

  return (
    <PaneFrame title={title} subtitle={subtitle} count={sorted.length}>
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {sorted.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.5, ease }}
            >
              <ActionCard action={a} onRun={onRun} />
            </motion.div>
          ))}
        </div>
      )}
    </PaneFrame>
  );
}

// ===== Studio panes =============================================================

function StudioPane({
  icon: Icon,
  title,
  subtitle,
  actions,
  onRun,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
  title: string;
  subtitle: string;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
}) {
  return (
    <PaneFrame
      title={title}
      subtitle={subtitle}
      count={actions.length}
      titleIcon={Icon}
    >
      {actions.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {actions.map((a, i) => (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.04 * i, duration: 0.5, ease }}
            >
              <ActionCard action={a} onRun={onRun} />
            </motion.div>
          ))}
        </div>
      )}
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
  count,
  titleIcon: TitleIcon,
  children,
}: {
  title: string;
  subtitle: string;
  count?: number;
  titleIcon?: React.ComponentType<{
    className?: string;
    strokeWidth?: number;
  }>;
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
            {typeof count === "number" && (
              <>
                <span className="font-mono text-muted-foreground/65">·</span>
                <span className="font-mono text-muted-foreground/85">
                  {count}
                </span>
              </>
            )}
          </div>
          <h1
            className="font-display text-rose flex items-center gap-3"
            style={{
              fontSize: "clamp(1.6rem, 3vw, 2.1rem)",
              lineHeight: 1.05,
              letterSpacing: "-0.022em",
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144, "SOFT" 30',
            }}
          >
            {TitleIcon && (
              <TitleIcon
                className="size-5 text-[var(--lavender)]"
                strokeWidth={1.5}
              />
            )}
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

function EmptyState() {
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
          No actions in this category yet. Refresh the snapshot to pull new data from Peec.
        </p>
      </div>
    </div>
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
