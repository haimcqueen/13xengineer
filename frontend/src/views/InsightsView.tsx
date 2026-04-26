import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Sparkles, X } from "lucide-react";

import ActionCard from "@/components/ActionCard";
import AgentRunPanel from "@/components/AgentRunPanel";
import MidasMark from "@/components/MidasMark";
import type { ActionOut, CompanyOut, Opportunity } from "@/lib/types";

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
  const [running, setRunning] = useState<ActionOut | null>(null);

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

  const refreshed = useMemo(
    () => formatRefreshed(company.last_refreshed_at),
    [company.last_refreshed_at],
  );

  return (
    <motion.section
      key="insights"
      className="relative z-10 mx-auto w-full max-w-[1180px] px-6 pb-24 pt-7"
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
      {/* Top brand strip — MIDAS on the left, reset on the right */}
      <div className="mb-10 flex items-center justify-between gap-4">
        <MidasMark size={28} withWordmark />
        <button
          type="button"
          onClick={onReset}
          className="group inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--ink-2)]/40 px-3.5 py-1.5 text-[11.5px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-[rgba(30,91,201,0.28)] hover:text-rose"
        >
          Track another brand
          <X className="size-3" />
        </button>
      </div>

      {/* Hero — company name + metadata */}
      <motion.div
        variants={reveal}
        custom={0}
        initial="hidden"
        animate="show"
        className="mb-12"
      >
        <div className="mb-2 flex items-center gap-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
          <span className="h-px w-8 bg-[var(--lavender)]/40" />
          <Sparkles className="size-3 text-[var(--blue-soft)]" />
          MIDAS · Action plan
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
          {brandDisplayName(company)}{" "}
          <em
            className="text-[var(--lavender)]"
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
            }}
          >
            visibility
          </em>
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[12.5px] text-muted-foreground">
          {company.own_domain && (
            <span className="font-mono text-rose/85">{company.own_domain}</span>
          )}
          <Dot />
          <span>
            <span className="text-rose">{company.prompt_count}</span> prompts
          </span>
          <Dot />
          <span>
            <span className="text-rose">{company.topics.length}</span>{" "}
            topic{company.topics.length === 1 ? "" : "s"}
          </span>
          <Dot />
          <span>
            <span className="text-rose">{actions.length}</span> action
            {actions.length === 1 ? "" : "s"}
          </span>
          <Dot />
          <span>refreshed {refreshed}</span>
        </div>

        {company.topics.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {company.topics.map((t) => (
              <span
                key={t.id}
                className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-2.5 py-1 text-[11.5px] text-rose/85"
              >
                {t.name}
              </span>
            ))}
          </div>
        )}
      </motion.div>

      {/* Owned media */}
      {owned.length > 0 && (
        <Section
          title="Owned media"
          subtitle="Where you can ship something on your own surface"
          count={owned.length}
          delayBase={1}
        >
          {owned.map((a, i) => (
            <motion.div
              key={a.id}
              variants={reveal}
              custom={2 + i}
              initial="hidden"
              animate="show"
            >
              <ActionCard action={a} onRun={setRunning} />
            </motion.div>
          ))}
        </Section>
      )}

      {/* Earned media */}
      {earned.length > 0 && (
        <Section
          title="Earned media"
          subtitle="Where presence comes from outside surfaces and citations"
          count={earned.length}
          delayBase={2 + owned.length}
        >
          {earned.map((a, i) => (
            <motion.div
              key={a.id}
              variants={reveal}
              custom={3 + owned.length + i}
              initial="hidden"
              animate="show"
            >
              <ActionCard action={a} onRun={setRunning} />
            </motion.div>
          ))}
        </Section>
      )}

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
    </motion.section>
  );
}

function Section({
  title,
  subtitle,
  count,
  delayBase,
  children,
}: {
  title: string;
  subtitle: string;
  count: number;
  delayBase: number;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-12 last:mb-0">
      <motion.div
        variants={reveal}
        custom={delayBase}
        initial="hidden"
        animate="show"
        className="mb-5 flex items-baseline justify-between gap-4 border-b border-[var(--border)] pb-3"
      >
        <div className="flex items-baseline gap-3">
          <h2
            className="font-display text-rose"
            style={{
              fontSize: "22px",
              lineHeight: 1,
              letterSpacing: "-0.015em",
              fontWeight: 400,
              fontVariationSettings: '"opsz" 60, "SOFT" 60',
            }}
          >
            {title}
          </h2>
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            {count}
          </span>
        </div>
        <span className="hidden text-[12px] text-muted-foreground sm:block">
          {subtitle}
        </span>
      </motion.div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {children}
      </div>
    </div>
  );
}

function Dot() {
  return <span className="text-[var(--lavender)]/50">·</span>;
}

function brandDisplayName(company: CompanyOut): string {
  if (company.own_brand) return company.own_brand.name;
  // Strip trailing " Project" added by Peec project naming convention
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
