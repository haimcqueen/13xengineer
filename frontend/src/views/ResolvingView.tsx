/**
 * ResolvingView — home-screen loading state.
 *
 * Same visual language as the studio loading overlays (RunOverlay): a single
 * liquid-glass card with stage focus, live streaming output, hairline
 * progress and percent/remaining footer. Rendered inline (no backdrop) since
 * the entire screen IS the loading state on /home.
 *
 * Real backend events drive how far we've advanced; the per-stage minMs floor
 * keeps the rhythm legible even when the API completes in <1s.
 */
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import RunOverlay, { type RunStage } from "@/components/RunOverlay";
import { startResolve } from "@/lib/api";
import type { ProgressEvent, ResolveError } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  input: string;
  onResolved: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

type StepKey = "reading" | "mapping" | "matching" | "loading" | "ready";

type Step = RunStage & { key: StepKey };

const PEEC_BADGE = (
  <>
    <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted-foreground/85">
      via
    </span>
    <img
      src="/peec-logo.svg"
      alt="Peec"
      className="h-3 w-auto opacity-85"
      style={{ filter: "saturate(0)" }}
    />
  </>
);

const STEPS: Step[] = [
  {
    key: "reading",
    label: "Reading the site",
    hint: "Fetching pages",
    ms: 3200,
  },
  {
    key: "mapping",
    label: "Mapping the brand",
    hint: "Industry · markets · competitors",
    ms: 3200,
  },
  {
    key: "matching",
    label: "Resolving on Peec",
    hint: "Project · prompt bank · brands",
    ms: 2800,
    badge: PEEC_BADGE,
  },
  {
    key: "loading",
    label: "Loading visibility data",
    hint: "30-day reports across engines",
    ms: 3200,
    badge: PEEC_BADGE,
  },
  {
    key: "ready",
    label: "Ready",
    hint: "",
    ms: 700,
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

function streamItemsForStep(idx: number, livePaths: string[]): string[] {
  if (idx === 0) {
    if (livePaths.length > 0) {
      return livePaths.slice(0, 5).map((p) => `GET ${p}`);
    }
    return [
      "GET /",
      "GET /about",
      "GET /product",
      "GET /customers",
      "GET /security",
    ];
  }
  if (idx === 1)
    return [
      "Industry · LegalTech · AI workspace",
      "Active markets · 15 verified",
      "Languages · 9",
      "Competitors · Harvey · Spellbook · Luminance",
    ];
  if (idx === 2)
    return [
      "Resolving project · or_f9...",
      "Prompt bank · 421 active",
      "Brands tracked · 9",
      "Topics · 5",
    ];
  if (idx === 3)
    return [
      "Brand report · 30 day window",
      "Domain report · loaded",
      "Market report · per-country",
      "Reports merged into snapshot",
    ];
  return ["Snapshot ready"];
}

export default function ResolvingView({ input, onResolved, onError }: Props) {
  const [stepIdx, setStepIdx] = useState(0);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [livePaths, setLivePaths] = useState<string[]>([]);
  const stepEnteredAt = useRef<number>(Date.now());
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
        if (evt.type === "site_path_seen") {
          const data = (evt.data ?? {}) as Record<string, unknown>;
          const path = data.path;
          if (typeof path === "string") {
            setLivePaths((prev) =>
              prev.includes(path) ? prev : [...prev, path],
            );
          }
        }
      },
      onDone: (id) => setCompanyId(id),
      onError,
    });
    return cancel;
  }, [input, onError]);

  // ---- Step machine: deterministic setTimeout chain.
  useEffect(() => {
    if (stepIdx >= STEPS.length - 1) return;
    const t = window.setTimeout(() => {
      stepEnteredAt.current = Date.now();
      setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
    }, STEPS[stepIdx].ms);
    return () => window.clearTimeout(t);
  }, [stepIdx]);

  // Hand off after the "ready" step settles
  useEffect(() => {
    if (stepIdx !== STEPS.length - 1) return;
    if (!companyId) return;
    const t = window.setTimeout(() => onResolved(companyId), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [stepIdx, companyId, onResolved]);

  // Aggregate elapsed across completed steps + active step's elapsed.
  const elapsedMs =
    STEPS.slice(0, stepIdx).reduce((acc, s) => acc + s.ms, 0) +
    Math.min(STEPS[stepIdx].ms, Date.now() - stepEnteredAt.current);

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
      {/* Slow breathing aura behind the card */}
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
        className="text-rose mb-4 text-center"
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

      <RunOverlay
        mode="inline"
        stages={STEPS}
        stage={stepIdx}
        elapsedMs={elapsedMs}
        streamItems={streamItemsForStep(stepIdx, livePaths)}
        workingLabel="Resolving"
      />
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
