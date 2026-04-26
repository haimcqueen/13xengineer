import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Check,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";

import ActionFeed from "@/components/ActionFeed";
import AgentConfigForm from "@/components/AgentConfigForm";
import LGCard from "@/components/LGCard";
import {
  createDeliverable,
  publishDeliverable,
  scheduleDeliverable,
  useDeliverableForAction,
  useDeliverables,
} from "@/lib/deliverables";
import type { ActionOut, CompanyOut } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
  completed: Set<string>;
};

const RENDER_STAGES: { label: string; hint: string; ms: number }[] = [
  { label: "Drafting storyboard", hint: "Mapping the demo to your product surface", ms: 4500 },
  { label: "Selecting shots", hint: "Pulling product UI takes from the canvas", ms: 5500 },
  { label: "Generating voice-over", hint: "Writing & timing the script to picture", ms: 5000 },
  { label: "Animating scenes", hint: "Camera, transitions, motion design", ms: 6500 },
  { label: "Mastering audio", hint: "Mixing music bed & VO levels", ms: 4500 },
  { label: "Encoding 1080p", hint: "Final pass · constant bitrate", ms: 5000 },
];

const VIDEO_SRC = "/videos/jude_law.mp4";

type RenderState =
  | { kind: "idle" }
  | { kind: "rendering"; action: ActionOut; stage: number }
  | { kind: "ready"; action: ActionOut };

export default function StudioVideo({ company, actions, completed }: Props) {
  const [state, setState] = useState<RenderState>({ kind: "idle" });
  const [previewing, setPreviewing] = useState<ActionOut | null>(null);
  const [configFor, setConfigFor] = useState<ActionOut | null>(null);
  const deliverables = useDeliverables();

  const own = company.own_brand?.name ?? company.name;

  function start(action: ActionOut) {
    if (state.kind !== "idle") return;
    setState({ kind: "rendering", action, stage: 0 });
  }

  function handleRun(action: ActionOut) {
    // Already shipped → reopen the big reveal with the saved video.
    const existing = deliverables.find((d) => d.action_id === action.id);
    if (existing) {
      setPreviewing(action);
      return;
    }
    // Otherwise show the config form first.
    setConfigFor(action);
  }

  // Drive the multi-stage render
  useEffect(() => {
    if (state.kind !== "rendering") return;
    const stage = state.stage;
    if (stage >= RENDER_STAGES.length) {
      setState({ kind: "ready", action: state.action });
      // Open the big reveal automatically.
      setPreviewing(state.action);
      createDeliverable(state.action, {
        type: "video",
        title: state.action.title,
        duration_seconds:
          (state.action.target.duration_target_seconds as number) ?? 90,
        video_url: VIDEO_SRC,
        thumbnail_url: "",
        storyboard: [
          "Open on a clock — \"the billable hour isn't dying\"",
          "Pull-quote from Kyle Poe · Legora · Mar 25, 2026",
          "Stat reveal · 72% of firms offer alternative fee arrangements",
          "Stat reveal · 90% at firms with 50+ lawyers",
          "Analogy · Big Four accounting's shift to fixed fees",
          "Close · billable hour stays for high-stakes work, fixed fees take routine",
        ],
      });
      return;
    }
    const t = window.setTimeout(() => {
      setState((s) =>
        s.kind === "rendering" ? { ...s, stage: s.stage + 1 } : s,
      );
    }, RENDER_STAGES[stage].ms);
    return () => window.clearTimeout(t);
  }, [state, company]);

  const totalMs = RENDER_STAGES.reduce((acc, s) => acc + s.ms, 0);
  const elapsed =
    state.kind === "rendering"
      ? RENDER_STAGES.slice(0, state.stage).reduce((acc, s) => acc + s.ms, 0)
      : 0;
  const progress = Math.min(1, elapsed / totalMs);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-8"
    >
      <div className="mx-auto w-full max-w-[820px]">
        <Header
          eyebrow="Studio · Video"
          title="Videos for"
          accent={own}
          subtitle="Specialist agent re-cuts your strongest written thinking into short, citable video. Heavy lift — give it a minute."
        />

        <ActionFeed
          actions={actions}
          completed={completed}
          onRun={handleRun}
          noun={{ singular: "video", plural: "videos" }}
        />
      </div>

      <AnimatePresence>
        {configFor && (
          <AgentConfigForm
            key={`config-${configFor.id}`}
            open
            agent="video"
            action={configFor}
            onClose={() => setConfigFor(null)}
            onGenerate={() => {
              const a = configFor;
              setConfigFor(null);
              if (a) start(a);
            }}
          />
        )}
        {state.kind === "rendering" && (
          <RenderOverlay
            key="rendering"
            action={state.action}
            stage={state.stage}
            progress={progress}
          />
        )}
        {previewing && (
          <BigReveal
            key="preview"
            action={previewing}
            onClose={() => {
              setPreviewing(null);
              if (state.kind === "ready") setState({ kind: "idle" });
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ---- Render overlay -------------------------------------------------------

function RenderOverlay({
  action,
  stage,
  progress,
}: {
  action: ActionOut;
  stage: number;
  progress: number;
}) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.42)] backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.45, ease }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-[480px] -translate-y-1/2"
      >
        <LGCard cornerRadius={22}>
          <div className="px-7 py-7">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground line-clamp-1">
              {action.title}
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={stage}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: -6,
                  filter: "blur(4px)",
                  transition: { duration: 0.4, ease },
                }}
                transition={{ duration: 0.6, ease }}
              >
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  <span
                    className="size-1 rounded-full bg-[var(--blue)]"
                    style={{
                      boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                      animation: "lg-pulse 2.4s ease-in-out infinite",
                    }}
                  />
                  Step {stage + 1} · {RENDER_STAGES.length}
                </div>
                <h3
                  className="text-rose"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 22,
                    fontWeight: 500,
                    letterSpacing: "-0.022em",
                    lineHeight: 1.1,
                  }}
                >
                  {RENDER_STAGES[stage]?.label}
                </h3>
                {RENDER_STAGES[stage]?.hint && (
                  <p className="mt-2 text-[12px] tracking-[-0.005em] text-muted-foreground">
                    {RENDER_STAGES[stage]?.hint}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="relative h-px w-full overflow-hidden bg-[var(--border)]/70">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[var(--blue)]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease }}
            />
          </div>
          <style>{`@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}`}</style>
        </LGCard>
      </motion.div>
    </>
  );
}

// ---- Big reveal ------------------------------------------------------------

function BigReveal({
  action,
  onClose,
}: {
  action: ActionOut;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const deliverable = useDeliverableForAction(action.id);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.play().catch(() => setPlaying(false));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        if (v.paused) {
          v.play();
          setPlaying(true);
        } else {
          v.pause();
          setPlaying(false);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function toggle() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }

  function handleSchedule() {
    if (!deliverable) return;
    const when = new Date();
    when.setDate(when.getDate() + 1);
    when.setHours(10, 0, 0, 0);
    scheduleDeliverable(deliverable.id, when);
  }

  function handlePublish() {
    if (!deliverable) return;
    publishDeliverable(deliverable.id, "LinkedIn");
  }

  const status = deliverable?.status ?? "draft";

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.78)] backdrop-blur-2xl"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.6, ease }}
        className="fixed inset-0 z-50 grid place-items-center p-8"
      >
        <div className="relative w-full max-w-[1200px]">
          <div className="mb-3 flex items-center justify-between gap-4">
            <div>
              <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.24em] text-white/60">
                Video · {status}
              </div>
              <h2
                className="text-white"
                style={{
                  fontFamily: "var(--font-sans)",
                  fontSize: "clamp(1.4rem, 2.6vw, 1.85rem)",
                  fontWeight: 500,
                  letterSpacing: "-0.022em",
                }}
              >
                {action.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-9 place-items-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <X className="size-4" strokeWidth={2} />
            </button>
          </div>
          <div
            className="relative aspect-video overflow-hidden rounded-[24px] bg-black shadow-[0_40px_120px_-30px_rgba(0,0,0,0.7)]"
            onClick={toggle}
          >
            <video
              ref={videoRef}
              src={VIDEO_SRC}
              className="h-full w-full object-cover"
              autoPlay
              loop
              playsInline
            />
            {!playing && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggle();
                }}
                aria-label="Play"
                className="absolute inset-0 grid place-items-center bg-black/30 text-white"
              >
                <span className="grid size-20 place-items-center rounded-full bg-white/15 backdrop-blur-md">
                  <Play className="size-10" fill="currentColor" />
                </span>
              </button>
            )}
            <div className="pointer-events-none absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-white/85 backdrop-blur-md">
              {playing ? (
                <Pause className="size-3" fill="currentColor" />
              ) : (
                <Play className="size-3" fill="currentColor" />
              )}
              1080p
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2.5">
            {status === "draft" && (
              <button
                type="button"
                onClick={handleSchedule}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white px-4 py-2 text-[12.5px] font-medium text-[#1F1A28] transition-opacity hover:opacity-90"
              >
                <Calendar className="size-3.5" />
                Schedule release
              </button>
            )}
            {status === "draft" && (
              <button
                type="button"
                onClick={handlePublish}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-white/25 bg-white/5 px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-white/15"
              >
                <Sparkles className="size-3.5" />
                Publish to social
              </button>
            )}
            {status === "scheduled" && deliverable?.scheduled_at && (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white/10 px-4 py-2 font-mono text-[11px] uppercase tracking-[0.18em] text-white/85">
                <Calendar className="size-3.5" />
                Scheduled ·{" "}
                {new Date(deliverable.scheduled_at).toLocaleString("en-US", {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </span>
            )}
            {status === "published" && (
              <span className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-emerald-500/90 px-4 py-2 text-[12.5px] font-medium text-white">
                <Check className="size-3.5" strokeWidth={3} />
                Live · {deliverable?.destination ?? "social"}
              </span>
            )}
            <span className="ml-auto font-mono text-[10px] uppercase tracking-[0.24em] text-white/55">
              press space to play · esc to close
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}

function Header({
  eyebrow,
  title,
  accent,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  subtitle: string;
}) {
  return (
    <div className="mb-7">
      <div className="mb-3 flex items-center gap-3 text-[10.5px] uppercase tracking-[0.24em] text-muted-foreground">
        <span className="h-px w-7 bg-[var(--lavender)]/40" />
        {eyebrow}
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
        {title}{" "}
        <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
          {accent}
        </span>
      </h1>
      <p className="mt-2 max-w-[60ch] text-[13px] text-muted-foreground">
        {subtitle}
      </p>
    </div>
  );
}
