/**
 * ResolvingView — minimalist liquid-glass resolve screen.
 *
 * One glass card. One headline. One subtle progress thread. Slow rhythm.
 *
 * Real backend events drive the labels (Exa crawl → Peec match → ready);
 * min/max dwell times keep the rhythm contemplative regardless of how fast
 * the API actually completes.
 */
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import LGCard from "@/components/LGCard";
import { startResolve } from "@/lib/api";
import type { ProgressEvent, ResolveError } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  input: string;
  onResolved: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

type StepKey =
  | "reading"
  | "mapping"
  | "matching"
  | "loading"
  | "ready";

type Step = {
  key: StepKey;
  label: string;
  hint: string;
  /** Minimum time this step is shown, even if the backend already advanced. */
  minMs: number;
};

const STEPS: Step[] = [
  {
    key: "reading",
    label: "Reading the site",
    hint: "Fetching pages with Exa",
    minMs: 3200,
  },
  {
    key: "mapping",
    label: "Mapping the brand",
    hint: "Industry · markets · competitors",
    minMs: 3000,
  },
  {
    key: "matching",
    label: "Resolving on Peec",
    hint: "Project · prompt bank · brands",
    minMs: 3000,
  },
  {
    key: "loading",
    label: "Loading visibility data",
    hint: "30-day reports across engines",
    minMs: 2800,
  },
  {
    key: "ready",
    label: "Ready",
    hint: "",
    minMs: 500,
  },
];

const SETTLE_MS = 500;

// Map backend events → which step we're on. Events arrive over the lifetime
// of the resolve; the step machine only ever advances, so out-of-order
// arrivals are harmless.
const EVENT_TO_INDEX: Record<string, number> = {
  crawl_started: 0,
  site_path_seen: 0,
  site_summary: 1,
  project_matched: 2,
  brands_loaded: 3,
  topics_loaded: 3,
  prompts_loaded: 3,
  reports_loaded: 3,
  actions_pending: 3,
  actions_loaded: 4,
  done: 4,
};

export default function ResolvingView({ input, onResolved, onError }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const stepEnteredAt = useRef<number>(Date.now());
  // Latest "intent" from the backend — index we want to be at, gated by minMs.
  const targetIdxRef = useRef(0);

  const domain = formatDomain(input);

  // ---- Real resolve ------------------------------------------------------
  useEffect(() => {
    const cancel = startResolve(input, {
      onEvent: (evt: ProgressEvent) => {
        const target = EVENT_TO_INDEX[evt.type];
        if (typeof target === "number") {
          targetIdxRef.current = Math.max(targetIdxRef.current, target);
        }
      },
      onDone: (id) => setCompanyId(id),
      onError,
    });
    return cancel;
  }, [input, onError]);

  // ---- Step machine: deterministic setTimeout chain.
  // Each step holds at least minMs. If the backend has already signalled we
  // should be further along (target > current), we advance the moment the
  // floor elapses; otherwise we still advance after minMs so the user is
  // never stuck on one step forever.
  useEffect(() => {
    if (stepIdx >= STEPS.length - 1) return;
    const t = window.setTimeout(() => {
      stepEnteredAt.current = Date.now();
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEPS[stepIdx].minMs);
    return () => window.clearTimeout(t);
  }, [stepIdx]);

  // Hand off after the "ready" step settles
  useEffect(() => {
    if (stepIdx !== STEPS.length - 1) return;
    if (!companyId) return;
    const t = window.setTimeout(() => onResolved(companyId), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [stepIdx, companyId, onResolved]);

  const totalMs = STEPS.reduce((acc, s) => acc + s.minMs, 0);
  const elapsedMs =
    STEPS.slice(0, stepIdx).reduce((acc, s) => acc + s.minMs, 0) +
    Math.min(STEPS[stepIdx].minMs, Date.now() - stepEnteredAt.current);
  const progress = Math.min(1, elapsedMs / totalMs);

  return (
    <motion.section
      key="resolving"
      className="relative z-10 mx-auto flex min-h-svh w-full max-w-[640px] flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.6, ease } }}
      exit={{
        opacity: 0,
        scale: 1.015,
        filter: "blur(12px)",
        transition: { duration: 0.6, ease: [0.4, 0, 0.4, 1] },
      }}
    >
      {/* Slow breathing aura — no logo */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 380,
          height: 380,
          top: "calc(50% - 190px)",
          left: "calc(50% - 190px)",
          background:
            "radial-gradient(circle, rgba(30,91,201,0.14) 0%, rgba(30,91,201,0.04) 45%, rgba(30,91,201,0) 75%)",
        }}
        animate={{ scale: [0.92, 1.06, 0.92], opacity: [0.45, 0.85, 0.45] }}
        transition={{ duration: 6.0, repeat: Infinity, ease: "easeInOut" }}
      />

      <div
        className="text-rose mb-1 text-center"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.05rem, 2vw, 1.25rem)",
          letterSpacing: "-0.012em",
          fontWeight: 400,
        }}
      >
        Resolving{" "}
        <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
          {domain}
        </span>
      </div>

      {/* The single liquid-glass card */}
      <div className="mt-8 w-full max-w-[440px]">
        <LGCard cornerRadius={22}>
          <div className="px-7 py-7">
            <AnimatePresence mode="wait">
              <motion.div
                key={STEPS[stepIdx].key}
                initial={{ opacity: 0, y: 6, filter: "blur(4px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                exit={{
                  opacity: 0,
                  y: -6,
                  filter: "blur(4px)",
                  transition: { duration: 0.45, ease },
                }}
                transition={{ duration: 0.7, ease }}
              >
                <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
                  <span
                    className="size-1 rounded-full bg-[var(--blue)]"
                    style={{
                      boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                      animation:
                        stepIdx < STEPS.length - 1
                          ? "lg-pulse 2.4s ease-in-out infinite"
                          : "none",
                    }}
                  />
                  Step {stepIdx + 1} · {STEPS.length}
                </div>
                <h2
                  className="text-rose"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: "clamp(1.65rem, 3vw, 2rem)",
                    fontWeight: 500,
                    letterSpacing: "-0.028em",
                    lineHeight: 1.1,
                  }}
                >
                  {STEPS[stepIdx].label}
                </h2>
                {STEPS[stepIdx].hint && (
                  <p className="mt-2 text-[12.5px] tracking-[-0.005em] text-muted-foreground">
                    {STEPS[stepIdx].hint}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Hairline progress thread */}
          <div className="relative h-px w-full overflow-hidden bg-[var(--border)]/70">
            <motion.div
              className="absolute inset-y-0 left-0 bg-[var(--blue)]"
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 0.6, ease }}
            />
          </div>
        </LGCard>
      </div>

      {/* Tiny inline keyframes for the dot pulse */}
      <style>{`
        @keyframes lg-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.55; }
        }
      `}</style>
    </motion.section>
  );
}

// ---- Helpers --------------------------------------------------------------

function formatDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "—";
  if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(trimmed)) return trimmed;
  const cleaned = trimmed.replace(/\s+(project|app|inc|llc)$/i, "");
  return `${cleaned.replace(/\s+/g, "")}.com`;
}
