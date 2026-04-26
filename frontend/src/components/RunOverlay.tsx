/**
 * RunOverlay — the shared cinematic loading screen for any agent run.
 *
 * Lifted from the Actions screen's RunningStep so the studio overlays
 * (StudioWebsite / StudioVideo / StudioBlog) share the exact same
 * visual language: stage focus → live streaming output → hairline
 * progress + footer with percent + remaining time.
 *
 * Two display modes:
 *   - `mode="modal"` (default) — centered liquid-glass card on a backdrop.
 *   - `mode="inline"` — just the card body, for the resolve flow on /home
 *     where the screen IS the loading state.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

import LGCard from "@/components/LGCard";

const ease = [0.22, 1, 0.36, 1] as const;

export type RunStage = {
  label: string;
  hint?: string;
  /** How long this stage holds, in milliseconds. */
  ms: number;
  /** Optional per-stage badge — e.g. the Peec wordmark on Peec steps. */
  badge?: React.ReactNode;
};

type Props = {
  /** Tiny mono caption shown above the headline (action title). */
  title?: string;
  stages: RunStage[];
  /** Index of the currently active stage. */
  stage: number;
  /** Total ms elapsed across all completed stages + the active one. */
  elapsedMs: number;
  /** Per-stage live-output strings; revealed one-by-one. */
  streamItems?: string[];
  mode?: "modal" | "inline";
  /** When `mode="modal"`, optionally close on backdrop click. */
  onClose?: () => void;
  /** Override the default "Working" footer label. */
  workingLabel?: string;
};

export default function RunOverlay({
  title,
  stages,
  stage,
  elapsedMs,
  streamItems,
  mode = "modal",
  onClose,
  workingLabel = "Working",
}: Props) {
  const totalMs = useMemo(
    () => stages.reduce((acc, s) => acc + s.ms, 0),
    [stages],
  );
  const progress = Math.min(1, Math.max(0, elapsedMs / totalMs));
  const remainingSec = Math.max(
    0,
    Math.ceil((totalMs - elapsedMs) / 1000),
  );
  const current = stages[Math.min(stage, stages.length - 1)] ?? null;
  if (!current) return null;

  const card = (
    <LGCard cornerRadius={22}>
      <div className="grain relative px-7 pb-6 pt-7">
        {title && (
          <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground line-clamp-1">
            {title}
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={stage}
            initial={{ opacity: 0, y: 8, filter: "blur(6px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              y: -8,
              filter: "blur(6px)",
              transition: { duration: 0.4, ease },
            }}
            transition={{ duration: 0.55, ease }}
          >
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              <span
                className="size-1 rounded-full bg-[var(--blue)]"
                style={{
                  boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                  animation: "lg-pulse 2.4s ease-in-out infinite",
                }}
              />
              Step {stage + 1} · {stages.length}
              {current.badge && (
                <span className="ml-auto inline-flex items-center gap-1.5 normal-case tracking-normal">
                  {current.badge}
                </span>
              )}
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
              {current.label}
            </h3>
            {current.hint && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                {current.hint}
              </p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Streaming live output for the current stage */}
        {streamItems && streamItems.length > 0 && (
          <StreamingOutput
            items={streamItems}
            stageDurationMs={current.ms}
            stageKey={`${stage}-${current.label}`}
          />
        )}

        <style>{`@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}`}</style>
      </div>

      {/* Hairline progress */}
      <div className="relative h-px w-full overflow-hidden bg-[var(--border)]/70">
        <motion.div
          className="absolute inset-y-0 left-0 bg-[var(--blue)]"
          animate={{ width: `${progress * 100}%` }}
          transition={{ duration: 0.6, ease }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-[var(--border)]/60 bg-white/65 px-7 py-3 backdrop-blur-md">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {Math.round(progress * 100)}% · {remainingSec}s remaining
        </span>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.22em] text-[var(--blue)]">
          <Loader2 className="size-3 animate-spin" />
          {workingLabel}
        </span>
      </div>
    </LGCard>
  );

  if (mode === "inline") {
    return <div className="w-full max-w-[520px]">{card}</div>;
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.42)] backdrop-blur-md"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.45, ease }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-[520px] -translate-y-1/2"
      >
        {card}
      </motion.div>
    </>
  );
}

// ---- Streaming output --------------------------------------------------

function StreamingOutput({
  items,
  stageDurationMs,
  stageKey,
}: {
  items: string[];
  stageDurationMs: number;
  stageKey: string;
}) {
  const [revealed, setRevealed] = useState(0);
  const stageKeyRef = useRef(stageKey);

  useEffect(() => {
    if (stageKeyRef.current !== stageKey) {
      setRevealed(0);
      stageKeyRef.current = stageKey;
    }
  }, [stageKey]);

  useEffect(() => {
    setRevealed(0);
    if (items.length === 0) return;
    const perItem = Math.max(180, Math.floor(stageDurationMs / (items.length + 0.5)));
    let i = 0;
    let timer = 0;
    const tick = () => {
      i += 1;
      setRevealed(i);
      if (i < items.length) {
        timer = window.setTimeout(tick, perItem);
      }
    };
    timer = window.setTimeout(tick, perItem * 0.5);
    return () => window.clearTimeout(timer);
  }, [items, stageDurationMs, stageKey]);

  if (items.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/85">
        Live output
      </div>
      <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/35 px-4 py-3">
        <ul className="space-y-1.5">
          {items.slice(0, revealed).map((item, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, x: -4 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.35, ease }}
              className="flex items-start gap-2 font-mono text-[11.5px] leading-relaxed text-rose/85"
            >
              <span className="mt-1.5 size-1 shrink-0 rounded-full bg-[var(--blue)]/65" />
              <span className="flex-1">{item}</span>
            </motion.li>
          ))}
          {revealed < items.length && (
            <li className="flex items-center gap-2 font-mono text-[11.5px] text-muted-foreground/65">
              <Loader2 className="size-2.5 animate-spin" />
              <span className="opacity-80">…</span>
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
