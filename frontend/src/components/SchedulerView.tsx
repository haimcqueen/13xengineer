import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  Clock,
  FileText,
  GitPullRequestArrow,
  Plus,
  Video,
} from "lucide-react";

import LGCard from "@/components/LGCard";
import type { ActionOut, AgentKind, CompanyOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
};

type Slot = {
  date: Date;
  type: AgentKind;
  title: string;
  hour: number;
  state: "scheduled" | "draft" | "published";
};

export default function SchedulerView({ company, actions }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const dow = d.getDay();
    const offsetToMonday = (dow + 6) % 7;
    d.setDate(d.getDate() - offsetToMonday + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const days = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [weekStart]);

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    let dayIdx = 0;
    for (const a of actions) {
      if (a.suggested_agent === null) continue;
      const day = days[dayIdx % 7];
      const hour = 8 + ((dayIdx * 3) % 9);
      out.push({
        date: new Date(day),
        type: a.suggested_agent,
        title: a.title,
        hour,
        state: dayIdx < 2 ? "draft" : dayIdx < 5 ? "scheduled" : "published",
      });
      dayIdx += 1;
    }
    return out;
  }, [actions, days]);

  const own = company.own_brand?.name ?? company.name;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-8"
    >
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
              <span className="h-px w-7 bg-[var(--lavender)]/40" />
              Plan · Scheduler
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
              Publishing calendar for{" "}
              <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
                {own}
              </span>
            </h1>
            <p className="mt-2 max-w-[58ch] text-[13px] text-muted-foreground">
              Pace your articles, videos, and website PRs across the week. Drag to
              reschedule.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w - 1)}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset(0)}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              This week
            </button>
            <button
              type="button"
              onClick={() => setWeekOffset((w) => w + 1)}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              Next →
            </button>
            <button
              type="button"
              className="ml-1 inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              New slot
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard
            label="This week"
            value={String(slots.filter((s) => s.state === "scheduled").length)}
            sub="scheduled"
          />
          <SummaryCard
            label="Drafts"
            value={String(slots.filter((s) => s.state === "draft").length)}
            sub="awaiting review"
          />
          <SummaryCard
            label="Published"
            value={String(slots.filter((s) => s.state === "published").length)}
            sub="last 30 days"
          />
        </div>

        {/* Week grid */}
        <LGCard cornerRadius={20}>
          <div
            className="grid border-b border-[var(--border)]"
            style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
          >
            {days.map((d, i) => {
              const isToday = sameDay(d, new Date());
              return (
                <div
                  key={i}
                  className={cn(
                    "border-l border-[var(--border)] px-4 py-3 first:border-l-0",
                    isToday && "bg-[rgba(30,91,201,0.04)]",
                  )}
                >
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </div>
                  <div
                    className={cn(
                      "mt-1 font-mono text-[18px] tabular-nums",
                      isToday ? "text-[var(--blue)]" : "text-rose",
                    )}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            className="grid"
            style={{
              gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
              minHeight: 360,
            }}
          >
            {days.map((d, dayIdx) => {
              const daySlots = slots.filter((s) => sameDay(s.date, d));
              return (
                <div
                  key={dayIdx}
                  className={cn(
                    "relative border-l border-[var(--border)] p-2 first:border-l-0",
                    sameDay(d, new Date()) && "bg-[rgba(30,91,201,0.02)]",
                  )}
                >
                  <div className="space-y-1.5">
                    {daySlots.map((s, i) => (
                      <SlotPill key={i} slot={s} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </LGCard>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="size-3 text-[var(--blue)]" />
            Article
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="size-3 text-[#b04a3a]" />
            Video
          </span>
          <span className="flex items-center gap-1.5">
            <GitPullRequestArrow className="size-3 text-emerald-700" />
            Website PR
          </span>
        </div>
      </div>
    </motion.section>
  );
}

// ----------------------------------------------------------------------------

function SummaryCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <LGCard cornerRadius={18}>
      <div className="px-5 py-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <div
          className="mt-1 text-rose"
          style={{
            fontFamily: "var(--font-sans)",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.022em",
          }}
        >
          {value}
        </div>
        <div className="mt-1 text-[11px] text-muted-foreground/85">{sub}</div>
      </div>
    </LGCard>
  );
}

function SlotPill({ slot }: { slot: Slot }) {
  const Icon =
    slot.type === "article"
      ? FileText
      : slot.type === "video"
        ? Video
        : GitPullRequestArrow;

  const colorMap: Record<AgentKind, string> = {
    article: "rgba(30,91,201,0.10)",
    video: "rgba(176,74,58,0.10)",
    "code-pr": "rgba(16,138,79,0.10)",
    improvement: "rgba(176,74,58,0.10)",
  };
  const textMap: Record<AgentKind, string> = {
    article: "var(--blue)",
    video: "#b04a3a",
    "code-pr": "#0c8043",
    improvement: "#b04a3a",
  };

  const stateBadge =
    slot.state === "draft"
      ? "draft"
      : slot.state === "published"
        ? "live"
        : `${pad(slot.hour)}:00`;

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-1.5 overflow-hidden rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-white/60"
      style={{ background: colorMap[slot.type] }}
    >
      <Icon
        className="size-3 shrink-0"
        style={{ color: textMap[slot.type] }}
        strokeWidth={2}
      />
      <span className="flex-1 truncate text-[10.5px] leading-tight text-rose">
        {slot.title.replace(/^Publish a /i, "").replace(/^Ship /i, "")}
      </span>
      <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground shrink-0">
        {stateBadge === "draft" || stateBadge === "live" ? (
          <span className="inline-flex items-center gap-0.5">
            {stateBadge === "draft" ? (
              <span className="size-1 rounded-full bg-amber-500" />
            ) : (
              <span className="size-1 rounded-full bg-emerald-600" />
            )}
            {stateBadge}
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5">
            <Clock className="size-2" />
            {stateBadge}
          </span>
        )}
      </span>
    </button>
  );
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
