import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Check,
  Film,
  Loader2,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";

import LGCard from "@/components/LGCard";
import type { ActionOut, CompanyOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
  completed: Set<string>;
};

const RENDER_STAGES: { label: string; hint: string; ms: number }[] = [
  {
    label: "Drafting storyboard",
    hint: "Mapping the demo to your product surface",
    ms: 4500,
  },
  {
    label: "Selecting shots",
    hint: "Pulling product UI takes from the canvas",
    ms: 5500,
  },
  {
    label: "Generating voice-over",
    hint: "Writing & timing the script to picture",
    ms: 5000,
  },
  {
    label: "Animating scenes",
    hint: "Camera, transitions, motion design",
    ms: 6500,
  },
  {
    label: "Mastering audio",
    hint: "Mixing music bed & VO levels",
    ms: 4500,
  },
  {
    label: "Encoding 1080p",
    hint: "Final pass · constant bitrate",
    ms: 5000,
  },
];

const VIDEO_SRC = "/videos/legora-tabular-review.mp4";

type RenderState =
  | { kind: "idle" }
  | { kind: "rendering"; action: ActionOut; stage: number; elapsed: number }
  | { kind: "ready"; action: ActionOut };

export default function StudioVideo({ company, actions, completed }: Props) {
  const [state, setState] = useState<RenderState>({ kind: "idle" });
  const [overlayOpen, setOverlayOpen] = useState(false);

  function start(action: ActionOut) {
    if (state.kind !== "idle") return;
    setState({ kind: "rendering", action, stage: 0, elapsed: 0 });
  }

  // Drive the multi-stage render
  useEffect(() => {
    if (state.kind !== "rendering") return;
    const stage = state.stage;
    if (stage >= RENDER_STAGES.length) {
      setState({ kind: "ready", action: state.action });
      setOverlayOpen(true);
      return;
    }
    const t = window.setTimeout(() => {
      setState((s) =>
        s.kind === "rendering"
          ? { ...s, stage: s.stage + 1, elapsed: s.elapsed + RENDER_STAGES[stage].ms }
          : s,
      );
    }, RENDER_STAGES[stage].ms);
    return () => window.clearTimeout(t);
  }, [state]);

  const totalMs = RENDER_STAGES.reduce((acc, s) => acc + s.ms, 0);
  const elapsed = state.kind === "rendering" ? state.elapsed : state.kind === "ready" ? totalMs : 0;
  const progress = Math.min(1, elapsed / totalMs);

  const own = company.own_brand?.name ?? company.name;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-8"
    >
      <div className="mx-auto w-full max-w-[920px]">
        <Header
          eyebrow="Studio · Video"
          title="Demo videos for"
          accent={own}
          subtitle="Specialist agent storyboards, animates, and renders feature demos. Heavy lift — give it a minute."
        />

        <div
          className="grid grid-cols-1 gap-5"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}
        >
          {/* Briefs (left) */}
          <div className="space-y-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Recommended demos · {actions.length}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/65">
                from Peec actions
              </span>
            </div>

            {actions.length === 0 ? (
              <Empty />
            ) : (
              actions.map((a, i) => {
                const isRunning =
                  state.kind === "rendering" && state.action.id === a.id;
                const isReady =
                  state.kind === "ready" && state.action.id === a.id;
                const isDone = isReady || completed.has(a.id);
                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.05 * i, duration: 0.4, ease }}
                  >
                    <LGCard cornerRadius={18}>
                      <div className="px-5 py-4">
                        <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                          <Film className="size-3" />
                          {(a.target.feature_focus as string) ?? "Demo video"}
                          <span className="text-muted-foreground/65">·</span>
                          <span className="font-mono text-muted-foreground/85">
                            {(a.target.duration_target_seconds as number) ?? 90}s
                          </span>
                        </div>
                        <h3
                          className="text-rose"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 16,
                            fontWeight: 500,
                            letterSpacing: "-0.012em",
                            lineHeight: 1.2,
                          }}
                        >
                          {a.title}
                        </h3>
                        {a.rationale && (
                          <p className="mt-2 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
                            {a.rationale}
                          </p>
                        )}
                        <div className="mt-4 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                            <span
                              className={cn(
                                "rounded-sm px-1.5 py-0.5",
                                a.opportunity === "high"
                                  ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)]"
                                  : "bg-[var(--ink-2)]/70 text-muted-foreground",
                              )}
                            >
                              {a.opportunity}
                            </span>
                          </div>
                          {isDone ? (
                            <button
                              type="button"
                              onClick={() => setOverlayOpen(true)}
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-emerald-600/95 px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                            >
                              <Play className="size-3.5" strokeWidth={3} />
                              Preview
                            </button>
                          ) : isRunning ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3.5 py-1.5 text-[12px] font-medium text-white"
                            >
                              <Loader2 className="size-3.5 animate-spin" />
                              Rendering
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => start(a)}
                              disabled={state.kind !== "idle"}
                              className={cn(
                                "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3.5 py-1.5 text-[12px] font-medium transition-opacity",
                                state.kind === "idle"
                                  ? "bg-[var(--blue)] text-white hover:opacity-90"
                                  : "cursor-not-allowed bg-[var(--ink-2)]/70 text-muted-foreground",
                              )}
                            >
                              <Play className="size-3.5" strokeWidth={2.5} />
                              Render
                            </button>
                          )}
                        </div>
                      </div>
                    </LGCard>
                  </motion.div>
                );
              })
            )}
          </div>

          {/* Render console (right) */}
          <div className="space-y-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Render console
            </div>
            <LGCard cornerRadius={18}>
              <div className="px-5 py-5">
                <AnimatePresence mode="wait">
                  {state.kind === "idle" && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-3"
                    >
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Click "Render" on a brief. The Video agent will compose
                        a 90-second demo from your product UI.
                      </p>
                      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-[11.5px] text-muted-foreground/85">
                        Idle
                      </div>
                    </motion.div>
                  )}
                  {state.kind === "rendering" && (
                    <motion.div
                      key="rendering"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.6, ease }}
                      className="-mx-5 -my-5"
                    >
                      <div className="px-7 pb-6 pt-7">
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={state.stage}
                            initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                            animate={{
                              opacity: 1,
                              y: 0,
                              filter: "blur(0px)",
                            }}
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
                                  boxShadow:
                                    "0 0 0 4px rgba(30,91,201,0.16)",
                                  animation:
                                    "lg-pulse 2.4s ease-in-out infinite",
                                }}
                              />
                              Step {state.stage + 1} · {RENDER_STAGES.length}
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
                              {RENDER_STAGES[state.stage]?.label}
                            </h3>
                            {RENDER_STAGES[state.stage]?.hint && (
                              <p className="mt-2 text-[12px] tracking-[-0.005em] text-muted-foreground">
                                {RENDER_STAGES[state.stage]?.hint}
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
                    </motion.div>
                  )}
                  {state.kind === "ready" && (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-[12.5px] text-emerald-800">
                        <Check className="size-3.5" strokeWidth={3} />
                        Render complete · 1080p
                      </div>
                      <button
                        type="button"
                        onClick={() => setOverlayOpen(true)}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--blue)] px-3 py-2.5 text-[12.5px] font-medium text-white transition-opacity hover:opacity-90"
                      >
                        <Play className="size-3.5" strokeWidth={2.5} />
                        Open big preview
                      </button>
                      <button
                        type="button"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/80 px-3 py-2.5 text-[12.5px] font-medium text-rose transition-colors hover:border-[var(--border-strong)]"
                      >
                        <Calendar className="size-3.5" />
                        Schedule release
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </LGCard>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {overlayOpen && state.kind === "ready" && (
          <BigReveal
            action={state.action}
            onClose={() => setOverlayOpen(false)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ----------------------------------------------------------------------------
// Big full-screen reveal — the wow moment
// ----------------------------------------------------------------------------

function BigReveal({
  action,
  onClose,
}: {
  action: ActionOut;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);

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
                Video · ready
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
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-white px-4 py-2 text-[12.5px] font-medium text-[#1F1A28] transition-opacity hover:opacity-90"
            >
              <Calendar className="size-3.5" />
              Schedule release
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-white/25 bg-white/5 px-4 py-2 text-[12.5px] font-medium text-white transition-colors hover:bg-white/15"
            >
              Download MP4
            </button>
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
    <div className="mb-8">
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

function Empty() {
  return (
    <div className="grid place-items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--border-strong)] py-14">
      <div className="text-center">
        <Sparkles
          className="mx-auto mb-3 size-5 text-[var(--lavender)]/60"
          strokeWidth={1.5}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          empty
        </span>
        <p className="mt-2 max-w-[36ch] text-[13px] text-muted-foreground">
          No video briefs in this snapshot yet.
        </p>
      </div>
    </div>
  );
}
