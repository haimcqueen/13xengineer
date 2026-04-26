/**
 * ActionFeed — the rich actions experience extracted from the global Actions
 * screen so each Studio page (Website / Video / Blog post) can render the
 * same progress + hero + queue + in-flight tracking, scoped to one agent
 * type.
 *
 * The caller passes an already-filtered list of actions; ActionFeed handles
 * sorting, partitioning into "to ship" vs "in flight" using deliverables,
 * progress, and the hero.
 */
import { useMemo } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  ExternalLink,
  Send,
  Sparkles,
} from "lucide-react";

import AgentBadge from "@/components/AgentBadge";
import { agentVerbs } from "@/lib/agentIdentity";
import {
  useDeliverables,
  type Deliverable,
} from "@/lib/deliverables";
import type { ActionOut, Opportunity } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const OPP_RANK: Record<Opportunity, number> = { high: 0, medium: 1, low: 2 };

type Props = {
  actions: ActionOut[];
  completed: Set<string>;
  onRun: (a: ActionOut) => void;
  /**
   * What to call the in-flight items in the empty / shipped copy
   * (e.g. "video", "article", "PR"). Defaults to "action".
   */
  noun?: { singular: string; plural: string };
};

export default function ActionFeed({
  actions,
  completed,
  onRun,
  noun = { singular: "action", plural: "actions" },
}: Props) {
  const deliverables = useDeliverables();

  const deliverableByAction = useMemo(() => {
    const m = new Map<string, Deliverable>();
    for (const d of deliverables) m.set(d.action_id, d);
    return m;
  }, [deliverables]);

  const isShipped = (a: ActionOut) =>
    deliverableByAction.has(a.id) ||
    (a.suggested_agent === null && completed.has(a.id));

  const sortedAll = useMemo(
    () =>
      [...actions].sort(
        (a, b) =>
          OPP_RANK[a.opportunity] - OPP_RANK[b.opportunity] ||
          a.title.localeCompare(b.title),
      ),
    [actions],
  );

  const toShip = sortedAll.filter((a) => !isShipped(a));
  const inFlight = sortedAll.filter((a) => isShipped(a));

  const total = actions.length;
  const shippedCount = inFlight.length;
  const progress = total > 0 ? shippedCount / total : 0;

  const hero = toShip[0] ?? null;
  const queue = hero ? toShip.slice(1) : [];

  return (
    <>
      <ProgressStrip shipped={shippedCount} total={total} progress={progress} />

      {hero ? (
        <NextUpHero
          action={hero}
          onRun={onRun}
          position={1}
          outOf={toShip.length}
        />
      ) : (
        <AllShippedState count={total} noun={noun} />
      )}

      {queue.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex flex-wrap items-baseline gap-3">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-rose">
              Queue
            </h2>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              · {queue.length} more to ship
            </span>
          </div>
          <ul className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white/55 backdrop-blur-md">
            {queue.map((a, i) => (
              <motion.li
                key={a.id}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * i, duration: 0.35, ease }}
              >
                <ActionRow
                  action={a}
                  onRun={onRun}
                  isLast={i === queue.length - 1}
                />
              </motion.li>
            ))}
          </ul>
        </section>
      )}

      {inFlight.length > 0 && (
        <section className="mt-10">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-rose">
              In flight
            </h2>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
              · {inFlight.length}{" "}
              {inFlight.length === 1 ? noun.singular : noun.plural}
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
    </>
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
  article: "Deploy Tolkien",
  video: "Deploy Nolan",
  "code-pr": "Deploy Michelangelo",
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
  const verb = HERO_VERB[agent ?? "manual"];
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
              style={{ boxShadow: "0 0 0 4px rgba(30,91,201,0.18)" }}
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
  const verbs = agentVerbs(agent);

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

  let statusChip: {
    label: string;
    bg: string;
    fg: string;
    ring: string;
    Icon: typeof Sparkles;
  };
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

function AllShippedState({
  count,
  noun,
}: {
  count: number;
  noun: { singular: string; plural: string };
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease }}
      className="grid place-items-center rounded-[var(--radius-lg)] border border-emerald-200/50 bg-emerald-50/40 px-8 py-14 text-center"
    >
      <div className="grid size-12 place-items-center rounded-full bg-emerald-100">
        <CheckCircle2 className="size-6 text-emerald-700" strokeWidth={2} />
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
        You've shipped all {count} {count === 1 ? noun.singular : noun.plural}.
      </p>
    </motion.div>
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
