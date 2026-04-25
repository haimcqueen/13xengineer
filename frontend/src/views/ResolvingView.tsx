import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import FelixMark from "@/components/FelixMark";
import { startResolve } from "@/lib/mockBackend";
import type { ProgressEvent, ResolveError } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

const STEP_ORDER = [
  "project_matched",
  "prompts_loaded",
  "brands_loaded",
  "topics_loaded",
  "actions_loaded",
] as const;

const STEP_LABEL: Record<(typeof STEP_ORDER)[number] | "done", string> = {
  project_matched: "Locating in Peec",
  prompts_loaded: "Pulling prompts",
  brands_loaded: "Reading brand presence",
  topics_loaded: "Mapping topics",
  actions_loaded: "Generating actions",
  done: "Finalising",
};

type Props = {
  input: string;
  onResolved: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

function useCountUp(target: number | undefined, duration = 0.9): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === undefined) return;
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const e = Math.min((t - t0) / 1000 / duration, 1);
      const k = 1 - Math.pow(1 - e, 3);
      setValue(target * k);
      if (e < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function Stat({ value, label }: { value?: number; label: string }) {
  const v = useCountUp(value);
  const filled = value !== undefined;
  return (
    <div className="flex min-h-[88px] flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {filled ? (
          <motion.span
            key="num"
            initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ duration: 0.7, ease }}
            className="font-display text-rose tabular-nums"
            style={{
              fontSize: "clamp(1.9rem, 3.6vw, 2.75rem)",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144',
            }}
          >
            {Math.round(v)}
          </motion.span>
        ) : (
          <motion.span
            key="dash"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.25 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease }}
            className="font-display text-[var(--lavender)] tabular-nums"
            style={{
              fontSize: "clamp(1.9rem, 3.6vw, 2.75rem)",
              lineHeight: 1,
              fontWeight: 300,
              fontVariationSettings: '"opsz" 144',
            }}
          >
            —
          </motion.span>
        )}
      </AnimatePresence>
      <span
        className={`mt-2 text-[10px] uppercase tracking-[0.24em] transition-colors duration-500 ${
          filled ? "text-muted-foreground" : "text-muted-foreground/40"
        }`}
      >
        {label}
      </span>
    </div>
  );
}

export default function ResolvingView({ input, onResolved, onError }: Props) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);

  useEffect(() => {
    const cancel = startResolve(input, {
      onEvent: (e) => {
        setEvents((prev) => [...prev, e]);
        if (e.type === "project_matched") {
          setCompanyName(String(e.data.name ?? null));
          setDomain((e.data.own_domain as string | null) ?? null);
        }
      },
      onDone: (companyId) => {
        // Settling beat — let the final stat land before zooming out.
        window.setTimeout(() => onResolved(companyId), 600);
      },
      onError,
    });
    return cancel;
  }, [input, onResolved, onError]);

  const has = (t: string) => events.some((e) => e.type === t);
  const eventOf = (t: string) => events.find((e) => e.type === t);

  const matched = has("project_matched");
  const prompts = eventOf("prompts_loaded")?.data.count as number | undefined;
  const brands = eventOf("brands_loaded")?.data.count as number | undefined;
  const topics = eventOf("topics_loaded")?.data.count as number | undefined;
  const actions = eventOf("actions_loaded")?.data.count as number | undefined;

  const currentIdx = STEP_ORDER.findIndex((t) => !has(t));
  const allDone = currentIdx === -1;
  const currentLabel = allDone
    ? STEP_LABEL.done
    : STEP_LABEL[STEP_ORDER[currentIdx]];
  const progress = allDone ? 1 : currentIdx / STEP_ORDER.length;

  const displayName = companyName?.replace(/\s+project$/i, "") ?? null;

  return (
    <motion.section
      key="resolving"
      className="relative z-10 flex min-h-svh w-full flex-col items-center justify-center px-6"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(10px)" }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: 0.7, ease, delay: 0.05 },
      }}
      exit={{
        opacity: 0,
        scale: 1.04,
        filter: "blur(8px)",
        transition: { duration: 0.5, ease: [0.4, 0, 0.4, 1] },
      }}
      style={{ transformOrigin: "50% 50%" }}
    >
      {/* Felix mark with pulsing aura */}
      <div className="relative mb-9 inline-flex items-center justify-center">
        {/* Ambient breathing glow */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 240,
            height: 240,
            background:
              "radial-gradient(circle, rgba(30,91,201,0.22) 0%, rgba(30,91,201,0.08) 35%, rgba(30,91,201,0) 70%)",
          }}
          animate={{ scale: [0.85, 1.1, 0.85], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Sonar ping — outward pulse */}
        <motion.span
          aria-hidden
          className="pointer-events-none absolute rounded-[22%] border border-[rgba(30,91,201,0.35)]"
          style={{ width: 100, height: 100 }}
          initial={{ scale: 1, opacity: 0.45 }}
          animate={{ scale: [1, 1.7], opacity: [0.45, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease, delay: 0.1 }}
          className="relative"
        >
          <FelixMark size={84} />
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, ease, delay: 0.2 }}
        className="mb-3 text-[11px] uppercase tracking-[0.28em] text-muted-foreground"
      >
        Felix is reading
      </motion.div>

      {/* Pre-match: user input italic. Post-match: company name + domain */}
      <div className="flex min-h-[110px] flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {matched && displayName ? (
            <motion.div
              key="company"
              initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.7, ease }}
              className="flex flex-col items-center"
            >
              <h2
                className="font-display text-rose"
                style={{
                  fontSize: "clamp(2.2rem, 4.4vw, 3.25rem)",
                  lineHeight: 1.05,
                  letterSpacing: "-0.025em",
                  fontWeight: 300,
                  fontVariationSettings: '"opsz" 144, "SOFT" 30',
                }}
              >
                {displayName}
              </h2>
              {domain && (
                <span className="mt-2 font-mono text-[12.5px] tracking-[-0.005em] text-muted-foreground">
                  {domain}
                </span>
              )}
            </motion.div>
          ) : (
            <motion.span
              key="input"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, filter: "blur(6px)" }}
              transition={{ duration: 0.4, ease }}
              className="font-display text-[var(--lavender)]"
              style={{
                fontSize: "clamp(1.8rem, 3.5vw, 2.4rem)",
                lineHeight: 1.05,
                fontWeight: 300,
                fontStyle: "italic",
                fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
              }}
            >
              {input}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Stats grid */}
      <div className="mt-10 grid w-full max-w-[640px] grid-cols-4 gap-x-6 sm:gap-x-12">
        <Stat value={prompts} label="prompts" />
        <Stat value={brands} label="own brand" />
        <Stat value={topics} label={topics === 1 ? "topic" : "topics"} />
        <Stat value={actions} label="actions" />
      </div>

      {/* Step label + progress line */}
      <div className="mt-12 flex w-full max-w-[420px] flex-col items-center gap-4">
        <AnimatePresence mode="wait">
          <motion.span
            key={currentLabel}
            initial={{ opacity: 0, y: 4, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -4, filter: "blur(4px)" }}
            transition={{ duration: 0.4, ease }}
            className="text-[12px] tracking-tight text-muted-foreground"
          >
            {currentLabel}
            <span className="text-muted-foreground/40">…</span>
          </motion.span>
        </AnimatePresence>

        <div className="relative h-px w-full overflow-hidden bg-[var(--border)]">
          <motion.span
            initial={{ width: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.7, ease }}
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-[var(--blue)] to-[var(--blue-soft)]"
          />
          {/* Trailing comet — visible during loading, settles when done */}
          {!allDone && (
            <motion.span
              aria-hidden
              className="absolute inset-y-0 size-2 -translate-y-1/2 rounded-full bg-[var(--blue)]"
              style={{
                top: "50%",
                boxShadow: "0 0 12px 2px rgba(30,91,201,0.5)",
                left: `calc(${progress * 100}% - 4px)`,
              }}
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>
      </div>
    </motion.section>
  );
}
