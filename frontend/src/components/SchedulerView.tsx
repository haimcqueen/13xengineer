import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  CheckCircle2,
  Clock,
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

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
};

export default function SchedulerView({ company, actions: _actions }: Props) {
  const [weekOffset, setWeekOffset] = useState(0);
  const deliverables = useDeliverables();
  const [scheduling, setScheduling] = useState<Deliverable | null>(null);

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

  const drafts = deliverables.filter((d) => d.status === "draft");
  const scheduled = deliverables.filter((d) => d.status === "scheduled");
  const published = deliverables.filter((d) => d.status === "published");

  const slotsForCalendar = useMemo(() => {
    return [...scheduled, ...published]
      .map((d) => {
        const iso = d.scheduled_at ?? d.published_at;
        return iso ? { d, when: new Date(iso) } : null;
      })
      .filter((x): x is { d: Deliverable; when: Date } => x !== null);
  }, [scheduled, published]);

  const own = company.own_brand?.name ?? company.name;

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
              week, and ship.
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
          </div>
        </div>

        {/* KPI row */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <SummaryCard label="Drafts" value={drafts.length} sub="awaiting schedule" tone="amber" />
          <SummaryCard label="Scheduled" value={scheduled.length} sub="this & coming weeks" tone="blue" />
          <SummaryCard label="Published" value={published.length} sub="lifetime" tone="emerald" />
        </div>

        <div
          className="grid gap-5"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}
        >
          {/* Week calendar */}
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
                minHeight: 380,
              }}
            >
              {days.map((d, dayIdx) => {
                const daySlots = slotsForCalendar
                  .filter((s) => sameDay(s.when, d))
                  .sort((a, b) => a.when.getTime() - b.when.getTime());
                return (
                  <div
                    key={dayIdx}
                    className={cn(
                      "relative border-l border-[var(--border)] p-2 first:border-l-0",
                      sameDay(d, new Date()) && "bg-[rgba(30,91,201,0.02)]",
                    )}
                  >
                    {daySlots.length === 0 && (
                      <div className="grid h-full place-items-center opacity-0 transition-opacity hover:opacity-60">
                        <Plus className="size-3 text-muted-foreground" />
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {daySlots.map((s) => (
                        <SlotPill
                          key={s.d.id}
                          deliverable={s.d}
                          when={s.when}
                          onUnschedule={() => unscheduleDeliverable(s.d.id)}
                          onPublish={() => publishDeliverable(s.d.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </LGCard>

          {/* Drafts queue */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Drafts queue · {drafts.length}
              </span>
            </div>
            {drafts.length === 0 ? (
              <DraftsEmpty />
            ) : (
              drafts.map((d) => (
                <DraftCard
                  key={d.id}
                  deliverable={d}
                  onSchedule={() => setScheduling(d)}
                  onPublish={() => publishDeliverable(d.id)}
                />
              ))
            )}
          </div>
        </div>

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

      <AnimatePresence>
        {scheduling && (
          <ScheduleModal
            deliverable={scheduling}
            onClose={() => setScheduling(null)}
            onConfirm={(when) => {
              scheduleDeliverable(scheduling.id, when);
              setScheduling(null);
            }}
          />
        )}
      </AnimatePresence>
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

function SlotPill({
  deliverable,
  when,
  onUnschedule,
  onPublish,
}: {
  deliverable: Deliverable;
  when: Date;
  onUnschedule: () => void;
  onPublish: () => void;
}) {
  const Icon = iconFor(deliverable.agent_kind);
  const tone = toneFor(deliverable.agent_kind);
  const [open, setOpen] = useState(false);

  const isPublished = deliverable.status === "published";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full items-center gap-1.5 overflow-hidden rounded-[10px] px-2 py-1.5 text-left transition-colors hover:bg-white/60"
        style={{ background: tone.bg }}
      >
        <Icon
          className="size-3 shrink-0"
          style={{ color: tone.fg }}
          strokeWidth={2}
        />
        <span className="flex-1 truncate text-[10.5px] leading-tight text-rose">
          {deliverable.title.replace(/^Publish a /i, "").replace(/^Ship /i, "")}
        </span>
        <span
          className="font-mono text-[8.5px] uppercase tracking-[0.16em] shrink-0"
          style={{
            color: isPublished ? "#047857" : "var(--lavender)",
          }}
        >
          {isPublished ? (
            <span className="inline-flex items-center gap-0.5">
              <CheckCircle2 className="size-2" />
              live
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <Clock className="size-2" />
              {pad(when.getHours())}:{pad(when.getMinutes())}
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/95 p-2 shadow-lg backdrop-blur-md">
          <div className="px-1.5 pb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {agentLabel(deliverable.agent_kind)} · {when.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
          </div>
          {!isPublished && (
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
          {!isPublished && (
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
  if (agent === "article") return "Article";
  if (agent === "video") return "Video";
  return "Website PR";
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
