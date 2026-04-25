import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowUpRight, Check, Loader2, Sparkles, X, Zap } from "lucide-react";

import ActionCard from "@/components/ActionCard";
import AgentRunPanel from "@/components/AgentRunPanel";
import FelixMark from "@/components/FelixMark";
import { getJob, startAgentRun } from "@/lib/mockBackend";
import type { ActionOut, CompanyOut, JobOut, Opportunity } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onReset: () => void;
};

const reveal = {
  hidden: { opacity: 0, y: 14, filter: "blur(6px)" },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease, delay: 0.1 + i * 0.05 },
  }),
};

export default function InsightsView({ company, actions, onReset }: Props) {
  // actionId → jobId
  const [runs, setRuns] = useState<Record<string, string>>({});
  // actionId → JobOut snapshot (single source of truth, refreshed by one timer)
  const [jobs, setJobs] = useState<Record<string, JobOut>>({});
  const [viewing, setViewing] = useState<ActionOut | null>(null);

  // Single polling effect — pulls each in-flight job once per tick.
  // When mockBackend writes new JobOut refs, React.memo'd cards re-render
  // selectively; finished jobs keep stable refs and skip render entirely.
  useEffect(() => {
    if (Object.keys(runs).length === 0) return;
    const tick = () => {
      const next: Record<string, JobOut> = {};
      let anyInflight = false;
      for (const [actionId, jobId] of Object.entries(runs)) {
        const j = getJob(jobId);
        if (j) {
          next[actionId] = j;
          if (j.status !== "done" && j.status !== "failed") anyInflight = true;
        }
      }
      setJobs(next);
      if (!anyInflight) {
        window.clearInterval(interval);
      }
    };
    tick();
    const interval = window.setInterval(tick, 280);
    return () => window.clearInterval(interval);
  }, [runs]);

  const owned = useMemo(
    () =>
      actions
        .filter((a) => a.category === "owned_media")
        .sort((a, b) => OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity]),
    [actions],
  );
  const earned = useMemo(
    () =>
      actions
        .filter((a) => a.category === "earned_media")
        .sort((a, b) => OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity]),
    [actions],
  );

  const runnable = useMemo(
    () => actions.filter((a) => a.suggested_agent !== null),
    [actions],
  );
  const completedCount = runnable.filter(
    (a) => jobs[a.id]?.status === "done",
  ).length;
  const inflightCount = runnable.filter((a) => {
    const j = jobs[a.id];
    return j && (j.status === "pending" || j.status === "running");
  }).length;
  const allDone = completedCount === runnable.length && runnable.length > 0;
  const anyInflight = inflightCount > 0;

  const refreshed = useMemo(
    () => formatRefreshed(company.last_refreshed_at),
    [company.last_refreshed_at],
  );

  const runOne = useCallback(
    (action: ActionOut) => {
      if (!action.suggested_agent) return;
      setRuns((prev) => {
        if (prev[action.id]) return prev;
        const jobId = startAgentRun(action, company);
        return { ...prev, [action.id]: jobId };
      });
    },
    [company],
  );

  const runAll = useCallback(() => {
    setRuns((prev) => {
      const next = { ...prev };
      let added = false;
      for (const a of runnable) {
        if (next[a.id]) continue;
        next[a.id] = startAgentRun(a, company);
        added = true;
      }
      return added ? next : prev;
    });
  }, [company, runnable]);

  const view = useCallback((action: ActionOut) => setViewing(action), []);

  const countriesCount = company.prompts_by_country?.length ?? 0;
  const competitorCount = company.competitor_brands?.length ?? 0;
  const totalBrands = (company.own_brand ? 1 : 0) + competitorCount;
  const activeModels = company.models?.filter((m) => m.active).length ?? 0;
  const totalModels = company.models?.length ?? 0;
  const brandName = brandDisplayName(company);

  return (
    <motion.section
      key="insights"
      className="relative z-10 mx-auto w-full max-w-[960px] px-6 pb-24 pt-7"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: 0.7, ease, delay: 0.05 },
      }}
      exit={{ opacity: 0, transition: { duration: 0.35 } }}
      style={{ transformOrigin: "50% 50%" }}
    >
      {/* Top brand strip */}
      <div className="mb-10 flex items-center justify-between gap-4">
        <FelixMark size={28} withWordmark />
        <button
          type="button"
          onClick={onReset}
          className="group inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--ink-2)]/40 px-3.5 py-1.5 text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-[rgba(30,91,201,0.28)] hover:text-rose"
        >
          Track another brand
          <X className="size-3" />
        </button>
      </div>

      {/* Hero */}
      <motion.div
        variants={reveal}
        custom={0}
        initial="hidden"
        animate="show"
        className="mb-14"
      >
        <div className="mb-3 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="h-px w-8 bg-[var(--lavender)]/40" />
          <Sparkles className="size-3 text-[var(--blue-soft)]" />
          Felix · from your Peec project
        </div>
        <h1
          className="font-display text-rose"
          style={{
            fontSize: "clamp(2.2rem, 5vw, 3.5rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            fontWeight: 300,
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
          }}
        >
          Action plan{" "}
          <em
            className="text-[var(--lavender)]"
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
            }}
          >
            for {brandName}
          </em>
        </h1>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
          {company.own_domain && (
            <span className="font-mono text-rose/85">{company.own_domain}</span>
          )}
          <Dot />
          <Stat n={company.prompt_count} label="prompts" />
          {countriesCount > 0 && (
            <>
              <Dot />
              <Stat n={countriesCount} label="countries" />
            </>
          )}
          {totalBrands > 0 && (
            <>
              <Dot />
              <Stat
                n={totalBrands}
                label={`brand${totalBrands === 1 ? "" : "s"} tracked`}
              />
            </>
          )}
          {totalModels > 0 && (
            <>
              <Dot />
              <Stat n={`${activeModels}/${totalModels}`} label="AI models" />
            </>
          )}
          <Dot />
          <span>refreshed {refreshed}</span>
        </div>
      </motion.div>

      {/* Action plan section header */}
      <motion.div
        variants={reveal}
        custom={1}
        initial="hidden"
        animate="show"
        className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-[var(--border)] pb-4"
      >
        <div>
          <div className="mb-1.5 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
            Take action
          </div>
          <div
            className="font-display text-rose"
            style={{
              fontSize: 22,
              lineHeight: 1.1,
              letterSpacing: "-0.015em",
              fontWeight: 400,
              fontVariationSettings: '"opsz" 60, "SOFT" 60',
            }}
          >
            <span className="text-rose">{actions.length}</span>{" "}
            <span className="text-[var(--lavender)]">things to ship</span>
            {runnable.length > 0 && (
              <span className="ml-2 text-[12.5px] text-muted-foreground">
                · {runnable.length} can run with Felix
              </span>
            )}
          </div>
        </div>

        <DoItAll
          total={runnable.length}
          completed={completedCount}
          inflight={inflightCount}
          allDone={allDone}
          anyInflight={anyInflight}
          onClick={runAll}
        />
      </motion.div>

      {/* Owned media */}
      {owned.length > 0 && (
        <Section title="Owned media" count={owned.length} delayBase={2}>
          {owned.map((a, i) => (
            <motion.div
              key={a.id}
              variants={reveal}
              custom={3 + i}
              initial="hidden"
              animate="show"
            >
              <ActionCard
                action={a}
                index={i + 1}
                job={jobs[a.id] ?? null}
                onRun={runOne}
                onViewResult={view}
              />
            </motion.div>
          ))}
        </Section>
      )}

      {/* Earned media */}
      {earned.length > 0 && (
        <Section
          title="Earned media"
          count={earned.length}
          delayBase={3 + owned.length}
        >
          {earned.map((a, i) => (
            <motion.div
              key={a.id}
              variants={reveal}
              custom={4 + owned.length + i}
              initial="hidden"
              animate="show"
            >
              <ActionCard
                action={a}
                index={owned.length + i + 1}
                job={jobs[a.id] ?? null}
                onRun={runOne}
                onViewResult={view}
              />
            </motion.div>
          ))}
        </Section>
      )}

      <AnimatePresence>
        {viewing && (
          <AgentRunPanel
            key={viewing.id}
            action={viewing}
            company={company}
            jobId={runs[viewing.id] ?? null}
            onClose={() => setViewing(null)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function DoItAll({
  total,
  completed,
  inflight,
  allDone,
  anyInflight,
  onClick,
}: {
  total: number;
  completed: number;
  inflight: number;
  allDone: boolean;
  anyInflight: boolean;
  onClick: () => void;
}) {
  if (total === 0) return null;
  const disabled = anyInflight || allDone;
  const fillPct = total > 0 ? (completed / total) * 100 : 0;

  const Icon = allDone ? Check : anyInflight ? Loader2 : Zap;
  const iconExtraClass = anyInflight ? "animate-spin" : "";

  const label = allDone
    ? `All ${total} done`
    : anyInflight
      ? `Running ${inflight}`
      : `Do it all`;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="group glass glass-cta relative inline-flex items-center gap-3 overflow-hidden rounded-[var(--radius-pill)] px-5 py-2.5 text-[12px] uppercase tracking-[0.16em] disabled:cursor-default"
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 left-0 bg-gradient-to-r from-[rgba(30,91,201,0.10)] via-[rgba(30,91,201,0.16)] to-[rgba(30,91,201,0.10)]"
        initial={false}
        animate={{ width: anyInflight || allDone ? `${fillPct}%` : "0%" }}
        transition={{ duration: 0.6, ease }}
      />
      <span
        className={`relative grid size-5 place-items-center rounded-full ${
          allDone ? "bg-[var(--blue)] text-white" : "text-[var(--blue)]"
        }`}
      >
        <Icon
          className={`size-3 ${iconExtraClass}`}
          fill={!anyInflight && !allDone ? "currentColor" : undefined}
          strokeWidth={allDone ? 3 : undefined}
        />
      </span>
      <span className="relative font-medium text-rose">{label}</span>
      {!allDone && total > 0 && (
        <span className="relative font-mono text-[11px] tabular-nums text-muted-foreground">
          {anyInflight ? `${completed}/${total}` : total}
        </span>
      )}
      {!anyInflight && !allDone && (
        <ArrowUpRight className="relative size-3.5 text-[var(--blue)] transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      )}
    </button>
  );
}

function Section({
  title,
  count,
  delayBase,
  children,
}: {
  title: string;
  count: number;
  delayBase: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-9 last:mb-0">
      <motion.div
        variants={reveal}
        custom={delayBase}
        initial="hidden"
        animate="show"
        className="mb-3 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground"
      >
        <span>{title}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="font-mono">{count}</span>
      </motion.div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Dot() {
  return <span className="text-[var(--lavender)]/45">·</span>;
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <span>
      <span className="text-rose">{n}</span> {label}
    </span>
  );
}

function brandDisplayName(company: CompanyOut): string {
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
