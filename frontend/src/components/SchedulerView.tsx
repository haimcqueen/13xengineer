import { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  Calendar,
  FileText,
  GitPullRequestArrow,
  Plus,
  Send,
  Sparkles,
  Video,
  X,
} from "lucide-react";

import LGCard from "@/components/LGCard";
import {
  publishDeliverable,
  scheduleDeliverable,
  unscheduleDeliverable,
  useDeliverables,
} from "@/lib/deliverables";
import type { Deliverable } from "@/lib/deliverables";
import type { ActionOut, AgentKind, CompanyOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
};

// Calendar slots come from two sources: real Deliverables produced by the
// agents, and a small mocked set so the calendar always looks alive.
type CalendarSlot =
  | {
      kind: "deliverable";
      deliverable: Deliverable;
      when: Date;
    }
  | {
      kind: "mock";
      id: string;
      title: string;
      agent_kind: AgentKind;
      status: "scheduled" | "published";
      destination: string;
      when: Date;
    };

function slotKey(s: CalendarSlot): string {
  return s.kind === "deliverable" ? s.deliverable.id : s.id;
}

function slotTitle(s: CalendarSlot): string {
  return s.kind === "deliverable" ? s.deliverable.title : s.title;
}

function slotAgent(s: CalendarSlot): AgentKind {
  return s.kind === "deliverable" ? s.deliverable.agent_kind : s.agent_kind;
}

function slotStatus(s: CalendarSlot): "scheduled" | "published" {
  if (s.kind === "deliverable") {
    return s.deliverable.status === "published" ? "published" : "scheduled";
  }
  return s.status;
}

// Mock calendar items — pure demo content, intentionally distinct from
// anything generated through the Studio pages so the calendar shows the
// "ongoing publishing pipeline" without leaking generated work onto it.
function buildMockSlots(monthCursor: Date): CalendarSlot[] {
  const now = new Date();
  const seeds: {
    day: number;
    hour: number;
    title: string;
    agent_kind: AgentKind;
    destination: string;
  }[] = [
    {
      day: 3,
      hour: 9,
      title: "LinkedIn · CEO post · 'AI is making law firms more local, not less'",
      agent_kind: "article",
      destination: "linkedin.com",
    },
    {
      day: 5,
      hour: 14,
      title: "X thread · 5 stats from the 2026 LegalTech adoption report",
      agent_kind: "article",
      destination: "x.com",
    },
    {
      day: 7,
      hour: 11,
      title: "April newsletter · BigLaw AI adoption recap",
      agent_kind: "article",
      destination: "legora.com/newsletter",
    },
    {
      day: 10,
      hour: 10,
      title: "Customer story · Mannheimer Swartling · 18-mo retrospective",
      agent_kind: "video",
      destination: "legora.com/customers",
    },
    {
      day: 13,
      hour: 16,
      title: "Webinar · EU AI Act compliance for law firms",
      agent_kind: "video",
      destination: "zoom.us",
    },
    {
      day: 16,
      hour: 9,
      title: "Press release · Munich office · one-year update",
      agent_kind: "code-pr",
      destination: "prnewswire.com",
    },
    {
      day: 19,
      hour: 13,
      title: "Legaltech Today podcast · guest spot",
      agent_kind: "video",
      destination: "spotify.com",
    },
    {
      day: 22,
      hour: 10,
      title: "ILTA EUR 2026 keynote · slides + clip",
      agent_kind: "video",
      destination: "iltaeur.org",
    },
    {
      day: 25,
      hour: 15,
      title: "r/Lawyertalk · reply to 'best legal AI in 2026'",
      agent_kind: "article",
      destination: "reddit.com",
    },
    {
      day: 28,
      hour: 11,
      title: "Docs update · LLM citations in API responses",
      agent_kind: "code-pr",
      destination: "github.com",
    },
  ];
  const out: CalendarSlot[] = [];
  for (let i = 0; i < seeds.length; i++) {
    const s = seeds[i];
    const when = new Date(monthCursor);
    when.setDate(s.day);
    when.setHours(s.hour, 0, 0, 0);
    // Anything in the past in the visible month is "published"; future is "scheduled".
    const status: "scheduled" | "published" =
      when.getTime() < now.getTime() ? "published" : "scheduled";
    out.push({
      kind: "mock",
      id: `mock-${monthCursor.getFullYear()}-${monthCursor.getMonth()}-${i}`,
      title: s.title,
      agent_kind: s.agent_kind,
      status,
      destination: s.destination,
      when,
    });
  }
  return out;
}

export default function SchedulerView({ company, actions: _actions }: Props) {
  const [monthOffset, setMonthOffset] = useState(0);

  // First day of the visible month (offset from today's month).
  const monthCursor = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(1);
    d.setMonth(d.getMonth() + monthOffset);
    return d;
  }, [monthOffset]);

  // 6×7 grid: starts on the Monday on/before the 1st, spans 42 days.
  const gridStart = useMemo(() => {
    const d = new Date(monthCursor);
    const dow = d.getDay();
    const offsetToMonday = (dow + 6) % 7;
    d.setDate(d.getDate() - offsetToMonday);
    return d;
  }, [monthCursor]);

  const days = useMemo(() => {
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(gridStart);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [gridStart]);

  // Calendar shows ONLY mocked content — anything generated via a Studio
  // page is intentionally excluded so the schedule reads as the ongoing
  // publishing pipeline rather than a record of agent runs.
  const mockSlots = useMemo<CalendarSlot[]>(
    () => buildMockSlots(monthCursor),
    [monthCursor],
  );
  const slotsForCalendar = mockSlots;

  const mockCounts = useMemo(() => {
    const out = { scheduled: 0, published: 0 };
    for (const s of mockSlots) {
      if (s.kind === "mock") {
        if (s.status === "published") out.published += 1;
        else out.scheduled += 1;
      }
    }
    return out;
  }, [mockSlots]);

  const own = company.own_brand?.name ?? company.name;
  const monthLabel = monthCursor.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-8"
    >
      <div className="mx-auto w-full max-w-[1240px]">
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
              Publishing pipeline for{" "}
              <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
                {own}
              </span>
            </h1>
            <p className="mt-2 max-w-[58ch] text-[13px] text-muted-foreground">
              Everything an agent has produced lands here. Schedule drafts, watch the
              month, and ship.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m - 1)}
              aria-label="Previous month"
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              ← Prev
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset(0)}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              {monthLabel}
            </button>
            <button
              type="button"
              onClick={() => setMonthOffset((m) => m + 1)}
              aria-label="Next month"
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              Next →
            </button>
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard
            label="In flight"
            value={mockCounts.scheduled + mockCounts.published}
            sub="this month"
            tone="amber"
          />
          <SummaryCard
            label="Scheduled"
            value={mockCounts.scheduled}
            sub="upcoming this month"
            tone="blue"
          />
          <SummaryCard
            label="Published"
            value={mockCounts.published}
            sub="this month"
            tone="emerald"
          />
        </div>

        <div>
          {/* Month calendar */}
          <LGCard cornerRadius={20}>
            {/* Weekday header row */}
            <div
              className="grid border-b border-[var(--border)]"
              style={{ gridTemplateColumns: "repeat(7, minmax(0, 1fr))" }}
            >
              {WEEKDAYS.map((label) => (
                <div
                  key={label}
                  className="border-l border-[var(--border)] px-3 py-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground first:border-l-0"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* 6×7 day grid */}
            <div
              className="grid"
              style={{
                gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
                gridAutoRows: "minmax(96px, 1fr)",
              }}
            >
              {days.map((d, dayIdx) => {
                const inMonth = d.getMonth() === monthCursor.getMonth();
                const isToday = sameDay(d, new Date());
                const daySlots = slotsForCalendar
                  .filter((s) => sameDay(s.when, d))
                  .sort((a, b) => a.when.getTime() - b.when.getTime());
                const overflow = Math.max(0, daySlots.length - 2);
                const visible = daySlots.slice(0, 2);
                const isWeekStart = dayIdx % 7 === 0;
                const rowStart = Math.floor(dayIdx / 7) === 0;

                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "relative border-l border-t border-[var(--border)] p-1.5",
                      isWeekStart && "border-l-0",
                      rowStart && "border-t-0",
                      isToday && "bg-[rgba(30,91,201,0.04)]",
                      !inMonth && "bg-[var(--ink-2)]/15",
                    )}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span
                        className={cn(
                          "inline-flex size-5 items-center justify-center rounded-full font-mono text-[10.5px] tabular-nums",
                          isToday
                            ? "bg-[var(--blue)] text-white"
                            : inMonth
                              ? "text-rose"
                              : "text-muted-foreground/55",
                        )}
                      >
                        {d.getDate()}
                      </span>
                    </div>
                    {daySlots.length === 0 ? (
                      <div className="grid h-full place-items-center opacity-0 transition-opacity hover:opacity-60">
                        <Plus className="size-3 text-muted-foreground" />
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {visible.map((s) => (
                          <SlotChip
                            key={slotKey(s)}
                            slot={s}
                            inMonth={inMonth}
                          />
                        ))}
                        {overflow > 0 && (
                          <div className="pl-1 font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                            +{overflow} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </LGCard>
        </div>

        {/* Legend */}
        <div className="mt-5 flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <FileText className="size-3 text-[var(--blue)]" />
            Tolkien · post · newsletter
          </span>
          <span className="flex items-center gap-1.5">
            <Video className="size-3 text-[#b04a3a]" />
            Nolan · podcast · webinar
          </span>
          <span className="flex items-center gap-1.5">
            <GitPullRequestArrow className="size-3 text-emerald-700" />
            Michelangelo · docs · PR
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
  tone,
}: {
  label: string;
  value: number;
  sub: string;
  tone: "amber" | "blue" | "emerald";
}) {
  const toneMap = {
    amber: "text-amber-700",
    blue: "text-[var(--blue)]",
    emerald: "text-emerald-700",
  };
  return (
    <LGCard cornerRadius={18}>
      <div className="px-5 py-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </span>
        <div
          className={cn("mt-1", toneMap[tone])}
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

function DraftCard({
  deliverable,
  onSchedule,
  onPublish,
}: {
  deliverable: Deliverable;
  onSchedule: () => void;
  onPublish: () => void;
}) {
  const Icon = iconFor(deliverable.agent_kind);
  const tone = toneFor(deliverable.agent_kind);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease }}
    >
      <LGCard cornerRadius={16}>
        <div className="px-4 py-3.5">
          <div
            className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em]"
            style={{ color: tone.fg }}
          >
            <Icon className="size-3" />
            {agentLabel(deliverable.agent_kind)}
            <span className="ml-auto rounded-sm bg-amber-100 px-1.5 py-0.5 font-mono text-[9px] text-amber-800">
              draft
            </span>
          </div>
          <h4
            className="text-rose"
            style={{
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              fontWeight: 500,
              letterSpacing: "-0.008em",
              lineHeight: 1.25,
            }}
          >
            {deliverable.title}
          </h4>
          <div className="mt-3 flex items-center gap-1.5">
            <button
              type="button"
              onClick={onSchedule}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/85 px-2.5 py-1 text-[11px] font-medium text-rose transition-colors hover:bg-white"
            >
              <Calendar className="size-3" />
              Schedule
            </button>
            <button
              type="button"
              onClick={onPublish}
              className="inline-flex items-center gap-1 rounded-[var(--radius-pill)] bg-[var(--blue)] px-2.5 py-1 text-[11px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Send className="size-3" />
              Publish
            </button>
          </div>
        </div>
      </LGCard>
    </motion.div>
  );
}

function DraftsEmpty() {
  return (
    <LGCard cornerRadius={16}>
      <div className="grid place-items-center px-5 py-8 text-center">
        <Sparkles className="mb-2 size-4 text-[var(--lavender)]/60" strokeWidth={1.5} />
        <p className="text-[12px] text-muted-foreground">
          No drafts yet. Run an agent on an action and the output will land here.
        </p>
      </div>
    </LGCard>
  );
}

function SlotChip({
  slot,
  inMonth,
  onUnschedule,
  onPublish,
}: {
  slot: CalendarSlot;
  inMonth: boolean;
  onUnschedule?: () => void;
  onPublish?: () => void;
}) {
  const agent = slotAgent(slot);
  const Icon = iconFor(agent);
  const tone = toneFor(agent);
  const status = slotStatus(slot);
  const title = slotTitle(slot);
  const [open, setOpen] = useState(false);

  const isPublished = status === "published";
  const isMock = slot.kind === "mock";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "group flex w-full items-center gap-1 overflow-hidden rounded-[6px] px-1.5 py-1 text-left transition-colors hover:brightness-105",
          !inMonth && "opacity-55",
        )}
        style={{ background: tone.bg }}
      >
        <Icon
          className="size-2.5 shrink-0"
          style={{ color: tone.fg }}
          strokeWidth={2.25}
        />
        <span
          className="flex-1 truncate text-[10px] leading-tight"
          style={{ color: isPublished ? "#047857" : "var(--rose)" }}
        >
          {title.replace(/^Publish '?/i, "").replace(/'$/, "")}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/95 p-2 shadow-lg backdrop-blur-md">
          <div className="px-1.5 pb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground">
            {agentLabel(agent)} ·{" "}
            {slot.when.toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </div>
          <div className="px-1.5 pb-1 text-[11px] text-rose">
            {title}
          </div>
          <div className="px-1.5 pb-2 font-mono text-[10px] text-muted-foreground">
            {isPublished ? "Live · " : "Scheduled · "}
            {slot.kind === "mock"
              ? slot.destination
              : (slot.deliverable.destination ?? "—")}
          </div>
          {!isPublished && onPublish && (
            <button
              type="button"
              onClick={() => {
                onPublish();
                setOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-rose hover:bg-[var(--ink-2)]/40"
            >
              Publish now
            </button>
          )}
          {!isPublished && onUnschedule && (
            <button
              type="button"
              onClick={() => {
                onUnschedule();
                setOpen(false);
              }}
              className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-rose hover:bg-[var(--ink-2)]/40"
            >
              Unschedule
            </button>
          )}
          {isMock && (
            <div className="rounded-md px-2 py-1.5 text-[10.5px] text-muted-foreground/80">
              Demo entry · run an agent on the matching action to ship for real.
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="block w-full rounded-md px-2 py-1.5 text-left text-[11px] text-muted-foreground hover:bg-[var(--ink-2)]/40"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduleModal({
  deliverable,
  onClose,
  onConfirm,
}: {
  deliverable: Deliverable;
  onClose: () => void;
  onConfirm: (when: Date) => void;
}) {
  const presets = useMemo(() => buildPresets(), []);
  const [when, setWhen] = useState<Date>(presets[0].when);

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.32)] backdrop-blur-[4px]"
      />
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.96 }}
        transition={{ duration: 0.4, ease }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-[420px] -translate-x-1/2 -translate-y-1/2"
      >
        <LGCard cornerRadius={20}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Schedule
              </div>
              <div className="mt-0.5 text-[14px] text-rose">
                {deliverable.title}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="space-y-2 px-5 py-4">
            {presets.map((p) => {
              const active = when.getTime() === p.when.getTime();
              return (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => setWhen(p.when)}
                  className={cn(
                    "flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors",
                    active
                      ? "border-[rgba(30,91,201,0.30)] bg-[rgba(30,91,201,0.06)]"
                      : "border-[var(--border)] bg-white/70 hover:border-[var(--border-strong)]",
                  )}
                >
                  <span className="text-[13px] text-rose">{p.label}</span>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {p.when.toLocaleString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] px-5 py-3.5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/70 px-3 py-1.5 text-[12px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(when)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
            >
              <Calendar className="size-3.5" />
              Schedule
            </button>
          </div>
        </LGCard>
      </motion.div>
    </>
  );
}

function buildPresets(): { label: string; when: Date }[] {
  const out: { label: string; when: Date }[] = [];
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  out.push({ label: "Tomorrow · 10am", when: tomorrow });

  const inTwoDays = new Date();
  inTwoDays.setDate(inTwoDays.getDate() + 2);
  inTwoDays.setHours(14, 0, 0, 0);
  out.push({ label: "In 2 days · 2pm", when: inTwoDays });

  const friday = (() => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const daysUntilFri = (5 - dayOfWeek + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFri);
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  out.push({ label: "Friday · 9am", when: friday });

  const nextMonday = (() => {
    const d = new Date();
    const dayOfWeek = d.getDay();
    const daysUntilMon = (1 - dayOfWeek + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMon);
    d.setHours(9, 0, 0, 0);
    return d;
  })();
  out.push({ label: "Next Monday · 9am", when: nextMonday });

  return out;
}

function iconFor(agent: AgentKind) {
  if (agent === "article") return FileText;
  if (agent === "video") return Video;
  return GitPullRequestArrow;
}

function toneFor(agent: AgentKind): { bg: string; fg: string } {
  if (agent === "article")
    return { bg: "rgba(30,91,201,0.10)", fg: "var(--blue)" };
  if (agent === "video") return { bg: "rgba(176,74,58,0.10)", fg: "#b04a3a" };
  return { bg: "rgba(16,138,79,0.10)", fg: "#0c8043" };
}

function agentLabel(agent: AgentKind): string {
  if (agent === "article") return "Tolkien";
  if (agent === "video") return "Nolan";
  return "Michelangelo";
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
