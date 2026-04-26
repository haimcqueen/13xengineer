import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import AgentBadge from "@/components/AgentBadge";
import AgentRunPanel from "@/components/AgentRunPanel";
import BrandRanking from "@/components/BrandRanking";
import LGCard from "@/components/LGCard";
import MarketGlobe from "@/components/MarketGlobe";
import Sidebar, { type WorkspaceView } from "@/components/Sidebar";
import StudioBlog from "@/components/studio/StudioBlog";
import StudioVideo from "@/components/studio/StudioVideo";
import StudioWebsite from "@/components/studio/StudioWebsite";
import SchedulerView from "@/components/SchedulerView";
import OverviewPane from "@/components/OverviewPane";
import { actionVerbs } from "@/lib/agentIdentity";
import {
  useDeliverables,
  type Deliverable,
} from "@/lib/deliverables";
import type {
  ActionOut,
  AgentKind,
  CompanyOut,
  Opportunity,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Send,
  Sparkles,
} from "lucide-react";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Filter = "all" | AgentKind | "manual";

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onReset: () => void;
};

export default function Workspace({ company, actions, onReset }: Props) {
  const [view, setView] = useState<WorkspaceView>("overview");
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
          {view === "overview" && (
            <OverviewPane key="overview" company={company} />
          )}
          {view === "actions" && (
            <ActionsView
              key="actions"
              company={company}
              actions={actions}
              completed={completed}
              onRun={setRunning}
            />
          )}
          {view === "studio-website" && (
            <StudioWebsite
              key="studio-website"
              company={company}
              actions={actions.filter((a) => a.suggested_agent === "code-pr")}
              onRun={setRunning}
              completed={completed}
            />
          )}
          {view === "studio-video" && (
            <StudioVideo
              key="studio-video"
              company={company}
              actions={actions.filter((a) => a.suggested_agent === "video")}
              onRun={setRunning}
              completed={completed}
            />
          )}
          {view === "studio-blog" && (
            <StudioBlog
              key="studio-blog"
              company={company}
              actions={actions.filter((a) => a.suggested_agent === "article")}
              onRun={setRunning}
              completed={completed}
            />
          )}
          {view === "scheduler" && (
            <SchedulerView
              key="scheduler"
              company={company}
              actions={actions}
            />
          )}
          {view === "brands" && (
            <BrandsPane key="brands" company={company} />
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
            onClose={() => setRunning(null)}
            onDone={() => handleAgentDone(running.id)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ===== Actions list view =======================================================

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
  const deliverables = useDeliverables();

  const refreshed = useMemo(
    () => formatRefreshed(company.last_refreshed_at),
    [company.last_refreshed_at],
  );

  // Index deliverables by action_id for fast lookup.
  const deliverableByAction = useMemo(() => {
    const m = new Map<string, Deliverable>();
    for (const d of deliverables) m.set(d.action_id, d);
    return m;
  }, [deliverables]);

  // An action is "shipped" if it has a deliverable OR is a completed manual brief.
  const isShipped = (a: ActionOut) =>
    deliverableByAction.has(a.id) ||
    (a.suggested_agent === null && completed.has(a.id));

  // Sort by tier, then alphabetical (stable for the eye).
  const sortedAll = useMemo(
    () =>
      [...actions].sort(
        (a, b) =>
          OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity] ||
          a.title.localeCompare(b.title),
      ),
    [actions],
  );

  // Partition into "to ship" and "in flight" (shipped).
  const toShipAll = sortedAll.filter((a) => !isShipped(a));
  const inFlight = sortedAll.filter((a) => isShipped(a));

  // Apply the agent filter to the to-ship list (hero + queue come from this).
  const toShipFiltered = useMemo(
    () => toShipAll.filter((a) => filterMatches(a, filter)),
    [toShipAll, filter],
  );

  // Hero = the top filtered non-shipped action.
  const hero = toShipFiltered[0] ?? null;
  const filteredQueue = hero ? toShipFiltered.slice(1) : [];

  // Counts use the unfiltered to-ship pool so chips show absolute totals.
  const counts = useMemo(() => {
    const c: Record<Filter, number> = {
      all: toShipAll.length,
      article: 0,
      video: 0,
      "code-pr": 0,
      manual: 0,
    };
    for (const a of toShipAll) {
      if (a.suggested_agent === null) c.manual++;
      else c[a.suggested_agent]++;
    }
    return c;
  }, [toShipAll]);

  const total = actions.length;
  const shippedCount = inFlight.length;
  const progress = total > 0 ? shippedCount / total : 0;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-12 pt-7"
    >
      <div className="mx-auto w-full max-w-[820px]">
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
            Ship these for{" "}
            <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
              {brandName(company)}
            </span>
          </h1>
        </div>

        {/* Progress strip */}
        <ProgressStrip shipped={shippedCount} total={total} progress={progress} />

        {/* Hero next-up */}
        {hero ? (
          <NextUpHero
            action={hero}
            onRun={onRun}
            position={1}
            outOf={toShipAll.length}
          />
        ) : toShipAll.length === 0 ? (
          <AllShippedState count={total} />
        ) : (
          <FilterEmptyHero filter={filter} onClear={() => setFilter("all")} />
        )}

        {/* Queue */}
        {(toShipAll.length > 1 || filter !== "all") && (
          <section className="mt-10">
            <div className="mb-3 flex flex-wrap items-baseline gap-3">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-rose">
                Queue
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                · {filteredQueue.length} more to ship
              </span>
              <div className="ml-auto flex flex-wrap items-center gap-1.5">
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
              </div>
            </div>

            {filteredQueue.length === 0 ? (
              <FilterEmpty filter={filter} />
            ) : (
              <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/55 backdrop-blur-md">
                {filteredQueue.map((a, i) => (
                  <motion.li
                    key={a.id}
                    initial={{ opacity: 0, x: -4 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.02 * i, duration: 0.35, ease }}
                  >
                    <ActionRow
                      action={a}
                      onRun={onRun}
                      isLast={i === filteredQueue.length - 1}
                    />
                  </motion.li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* In flight */}
        {inFlight.length > 0 && (
          <section className="mt-10">
            <div className="mb-3 flex items-baseline gap-3">
              <h2 className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-rose">
                In flight
              </h2>
              <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                · {inFlight.length} {inFlight.length === 1 ? "action" : "actions"}
              </span>
            </div>
            <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/45 backdrop-blur-md">
              {inFlight.map((a, i) => (
                <InFlightRow
                  key={a.id}
                  action={a}
                  deliverable={deliverableByAction.get(a.id) ?? null}
                  manualDone={
                    a.suggested_agent === null && completed.has(a.id)
                  }
                  onOpen={() => onRun(a)}
                  isLast={i === inFlight.length - 1}
                />
              ))}
            </ul>
          </section>
        )}
      </div>
    </motion.section>
  );
}

// ----- Header progress strip ------------------------------------------------

function ProgressStrip({
  shipped,
  total,
  progress,
}: {
  shipped: number;
  total: number;
  progress: number;
}) {
  return (
    <div className="mb-6">
      <div className="mb-2 flex items-baseline justify-between gap-3 font-mono text-[10.5px] uppercase tracking-[0.22em]">
        <span className="text-muted-foreground">
          {shipped > 0 ? (
            <span className="text-emerald-700">{shipped} shipped</span>
          ) : (
            <span>0 shipped</span>
          )}{" "}
          <span className="text-muted-foreground/70">of {total}</span>
        </span>
        <span className="text-muted-foreground/85">
          {Math.round(progress * 100)}%
        </span>
      </div>
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-[var(--border)]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-[var(--blue)] to-emerald-500"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.7, ease }}
        />
      </div>
    </div>
  );
}

// ----- Hero "next up" --------------------------------------------------------

const HERO_VERB: Record<string, string> = {
  article: "Deploy Article agent",
  video: "Deploy Video agent",
  "code-pr": "Deploy Website agent",
  manual: "Open brief",
};

function NextUpHero({
  action,
  onRun,
  position,
  outOf,
}: {
  action: ActionOut;
  onRun: (a: ActionOut) => void;
  position: number;
  outOf: number;
}) {
  const agent = action.suggested_agent;
  const verb =
    action.kind === "site_blog"
      ? "Publish to your site"
      : HERO_VERB[agent ?? "manual"];
  const accent =
    agent === "article"
      ? { bg: "rgba(199, 122, 122, 0.10)", fg: "#A85B5B" }
      : agent === "video"
        ? { bg: "rgba(87, 79, 97, 0.10)", fg: "#574F61" }
        : agent === "code-pr"
          ? { bg: "rgba(30, 91, 201, 0.08)", fg: "#1E5BC9" }
          : { bg: "rgba(110, 101, 122, 0.06)", fg: "var(--lavender)" };

  return (
    <motion.button
      type="button"
      onClick={() => onRun(action)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      whileHover={{ y: -2 }}
      className="group relative block w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-white/85 text-left shadow-[0_18px_40px_-20px_rgba(31,26,40,0.18)] backdrop-blur-md transition-shadow hover:shadow-[0_24px_56px_-22px_rgba(31,26,40,0.28)]"
      style={{
        backgroundImage: `linear-gradient(135deg, ${accent.bg} 0%, rgba(255,255,255,0.0) 60%)`,
      }}
    >
      <div className="px-7 pb-6 pt-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-rose">
            <span
              className="size-1.5 rounded-full bg-[var(--blue)]"
              style={{
                boxShadow: "0 0 0 4px rgba(30,91,201,0.18)",
              }}
            />
            Next up · {position} of {outOf}
          </span>
          <AgentBadge agent={agent} size="md" />
        </div>

        <h2
          className="text-rose"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: "clamp(1.5rem, 2.8vw, 1.9rem)",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            lineHeight: 1.1,
          }}
        >
          {action.title}
        </h2>

        {action.rationale && (
          <p className="mt-3 max-w-[64ch] text-[13.5px] leading-relaxed text-muted-foreground">
            {action.rationale}
          </p>
        )}

        <div className="mt-5 flex items-center gap-3">
          <span
            className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-4 py-2.5 text-[13px] font-medium ring-1 ring-inset transition-all group-hover:translate-y-[-1px]"
            style={{
              backgroundColor: accent.fg,
              color: "white",
              boxShadow: `0 8px 24px -8px ${accent.fg}55`,
            }}
          >
            <Sparkles className="size-3.5" strokeWidth={2.5} />
            {verb}
            <ArrowRight
              className="size-3.5 transition-transform duration-300 group-hover:translate-x-0.5"
              strokeWidth={2.25}
            />
          </span>
          <OpportunityChip value={action.opportunity} />
        </div>
      </div>
    </motion.button>
  );
}

// ----- Compact queue row -----------------------------------------------------

function ActionRow({
  action,
  onRun,
  isLast,
}: {
  action: ActionOut;
  onRun: (a: ActionOut) => void;
  isLast: boolean;
}) {
  const agent = action.suggested_agent;
  const verbs = actionVerbs(action);

  return (
    <button
      type="button"
      onClick={() => onRun(action)}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ink-2)]/35",
        !isLast && "border-b border-[var(--border)]",
      )}
    >
      <AgentBadge agent={agent} />
      <OpportunityDot opportunity={action.opportunity} />
      <span
        className="flex-1 truncate text-[13px] text-rose"
        style={{ letterSpacing: "-0.005em" }}
      >
        {action.title}
      </span>
      <span className="hidden font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/85 group-hover:inline lg:inline">
        {verbs.idle}
      </span>
      <ArrowRight
        className="size-3.5 text-muted-foreground/65 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-[var(--blue)]"
        strokeWidth={2}
      />
    </button>
  );
}

function OpportunityDot({ opportunity }: { opportunity: Opportunity }) {
  const cls =
    opportunity === "high"
      ? "bg-[var(--blue)]"
      : opportunity === "medium"
        ? "bg-[var(--lavender)]/65"
        : "bg-[var(--ink-2)]";
  return (
    <span
      className={cn("size-1.5 shrink-0 rounded-full", cls)}
      title={`${opportunity} opportunity`}
    />
  );
}

// ----- In-flight row ---------------------------------------------------------

function InFlightRow({
  action,
  deliverable,
  manualDone,
  onOpen,
  isLast,
}: {
  action: ActionOut;
  deliverable: Deliverable | null;
  manualDone: boolean;
  onOpen: () => void;
  isLast: boolean;
}) {
  const agent = action.suggested_agent;
  const status = deliverable?.status ?? (manualDone ? "manual-done" : "draft");

  let statusChip: { label: string; bg: string; fg: string; ring: string; Icon: typeof Sparkles };
  let action_: { label: string; icon: typeof ExternalLink } | null = null;
  let externalHref: string | undefined;

  if (status === "draft") {
    statusChip = {
      label: "Drafted",
      bg: "bg-amber-50",
      fg: "text-amber-800",
      ring: "ring-amber-200",
      Icon: Sparkles,
    };
    action_ = { label: "View", icon: ArrowRight };
  } else if (status === "scheduled") {
    statusChip = {
      label: scheduledLabel(deliverable?.scheduled_at),
      bg: "bg-[rgba(30,91,201,0.08)]",
      fg: "text-[var(--blue)]",
      ring: "ring-[rgba(30,91,201,0.25)]",
      Icon: Calendar,
    };
    action_ = { label: "View", icon: ArrowRight };
  } else if (status === "published") {
    statusChip = {
      label: deliverable?.destination
        ? `Live · ${deliverable.destination}`
        : "Published",
      bg: "bg-emerald-50",
      fg: "text-emerald-700",
      ring: "ring-emerald-200",
      Icon: Send,
    };
    if (
      deliverable?.payload.type === "code-pr" &&
      typeof deliverable.payload.pr_url === "string"
    ) {
      externalHref = deliverable.payload.pr_url;
      action_ = { label: "Open", icon: ExternalLink };
    } else {
      action_ = { label: "View", icon: ArrowRight };
    }
  } else {
    statusChip = {
      label: "Done",
      bg: "bg-emerald-50",
      fg: "text-emerald-700",
      ring: "ring-emerald-200",
      Icon: CheckCircle2,
    };
    action_ = { label: "Open", icon: ArrowRight };
  }

  const RowEl = externalHref ? "a" : "button";

  return (
    <RowEl
      type={externalHref ? undefined : "button"}
      href={externalHref}
      target={externalHref ? "_blank" : undefined}
      rel={externalHref ? "noreferrer" : undefined}
      onClick={externalHref ? undefined : onOpen}
      className={cn(
        "group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--ink-2)]/35",
        !isLast && "border-b border-[var(--border)]",
      )}
    >
      <AgentBadge agent={agent} />
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-[var(--radius-pill)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.16em] ring-1 ring-inset",
          statusChip.bg,
          statusChip.fg,
          statusChip.ring,
        )}
      >
        <statusChip.Icon className="size-2.5" />
        {statusChip.label}
      </span>
      <span
        className="flex-1 truncate text-[13px] text-rose/90"
        style={{ letterSpacing: "-0.005em" }}
      >
        {action.title}
      </span>
      {action_ && (
        <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/85 group-hover:text-rose">
          {action_.label}
          <action_.icon
            className="size-3 transition-transform duration-300 group-hover:translate-x-0.5"
            strokeWidth={2}
          />
        </span>
      )}
    </RowEl>
  );
}

function scheduledLabel(iso: string | null | undefined): string {
  if (!iso) return "Scheduled";
  const d = new Date(iso);
  return `Scheduled · ${d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
}

// ----- All-shipped empty state ----------------------------------------------

function AllShippedState({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="grid place-items-center rounded-[var(--radius-lg)] border border-emerald-200/50 bg-emerald-50/40 px-8 py-14 text-center"
    >
      <div className="grid size-12 place-items-center rounded-full bg-emerald-100">
        <CheckCircle2
          className="size-6 text-emerald-700"
          strokeWidth={2}
        />
      </div>
      <h2
        className="mt-4 text-rose"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: 22,
          fontWeight: 500,
          letterSpacing: "-0.018em",
        }}
      >
        All clear.
      </h2>
      <p className="mt-2 max-w-[42ch] text-[13px] text-muted-foreground">
        You've shipped all {count} actions in this snapshot. Refresh to pull new
        recommendations from Peec.
      </p>
    </motion.div>
  );
}

function FilterEmptyHero({
  filter,
  onClear,
}: {
  filter: Filter;
  onClear: () => void;
}) {
  const label =
    filter === "code-pr"
      ? "website actions"
      : filter === "manual"
        ? "manual briefs"
        : `${filter} actions`;
  return (
    <div className="grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] py-10 text-center">
      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
        nothing here
      </span>
      <p className="mt-2 max-w-[42ch] text-[13px] text-muted-foreground">
        No {label} left to ship in this snapshot.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
      >
        Show all
      </button>
    </div>
  );
}

// ----- Opportunity chip (kept for hero) -------------------------------------

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
      {value === "high" ? "High" : value === "medium" ? "Medium" : "Low"}
    </span>
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
        <LGCard cornerRadius={20}>
          <div className="grid place-items-center overflow-hidden">
            <MarketGlobe markets={markets} width={620} height={520} />
          </div>
        </LGCard>

        <LGCard cornerRadius={20}>
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
        </LGCard>
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
      <div className="mb-7">
        <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="h-px w-7 bg-[var(--lavender)]/40" />
          {title}
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
          {title}
        </h1>
        <p className="mt-2 max-w-[60ch] text-[13px] tracking-[-0.005em] text-muted-foreground">
          {subtitle}
        </p>
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
