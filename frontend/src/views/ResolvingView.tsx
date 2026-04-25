/**
 * ResolvingView — multi-phase loading.
 *
 * MOCKED (current): Hardcoded scripted animation for "legora" input.
 * Phase 1 (crawling 2.5s): URL scanner + discovery lines
 * Phase 2 (generating 3.5s): prompt cards cascade in
 *
 * FUTURE (post-demo): Replace with Claude Agent SDK that actually crawls the
 * input URL, extracts brand metadata, and generates a real prompt bank via
 * Peec MCP create_prompts. Backend streams progress events; this view renders
 * them as they arrive. See vault/01 - Projects/Peec AI Hackathon.md for spec.
 */
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

import FelixMark from "@/components/FelixMark";
import { startResolve } from "@/lib/mockBackend";
import type { ResolveError } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  input: string;
  onResolved: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

type Phase = "crawling" | "generating" | "settle";

// ---- Mocked crawl content -------------------------------------------------

const CRAWL_PATHS = [
  "/about",
  "/product/tabular-review",
  "/product/word-add-in",
  "/product/workflows",
  "/customers",
  "/security",
  "/news/series-d",
  "/news/munich-office",
  "/solutions/m-and-a",
  "/solutions/litigation",
  "/careers",
  "/integrations/imanage",
];

const DISCOVERIES = [
  { label: "Industry", value: "LegalTech · AI workspace" },
  { label: "Customers", value: "1,000+ across 50+ markets" },
  { label: "Competitors", value: "Harvey · Spellbook · Luminance · Clio · LegalFly" },
  { label: "Active markets", value: "15 verified · 9 languages" },
  { label: "ICP", value: "BigLaw · In-house · M&A · Banking" },
  { label: "Compliance", value: "ISO 42001 · ISO 27001 · SOC 2 · GDPR" },
];

const GENERATED_PROMPTS = [
  { flag: "🇺🇸", code: "US", text: "Top US law firms using AI in 2026" },
  { flag: "🇩🇪", code: "DE", text: "Top Anwaltskanzleien in Deutschland mit KI-Einsatz 2026" },
  { flag: "🇬🇧", code: "GB", text: "Best legal AI for Magic Circle firms" },
  { flag: "🇫🇷", code: "FR", text: "Top cabinets d'affaires français utilisant l'IA en 2026" },
  { flag: "🇸🇪", code: "SE", text: "Bästa juridiska AI-verktyg för svenska advokatbyråer" },
  { flag: "🇪🇸", code: "ES", text: "Top despachos de abogados en España que usan IA en 2026" },
  { flag: "🇨🇦", code: "CA", text: "Best legal AI for Bay Street law firms" },
  { flag: "🇵🇱", code: "PL", text: "Najlepsze AI prawne dla polskich kancelarii" },
  { flag: "🇳🇴", code: "NO", text: "Beste juridiske AI-verktøy for norske advokatfirmaer" },
  { flag: "🇮🇳", code: "IN", text: "Top Indian law firms using AI in 2026" },
  { flag: "🇩🇰", code: "DK", text: "Bedste juridiske AI-værktøjer for danske advokatfirmaer" },
  { flag: "🇫🇮", code: "FI", text: "Parhaat oikeudelliset tekoälytyökalut suomalaisille" },
  { flag: "🇦🇹", code: "AT", text: "Top Anwaltskanzleien in Österreich mit KI-Einsatz" },
  { flag: "🇨🇭", code: "CH", text: "Beste KI für Schweizer Großkanzleien" },
  { flag: "🇦🇺", code: "AU", text: "Top Australian law firms using AI in 2026" },
];

// ---- Phase timings --------------------------------------------------------

const CRAWL_MS = 2800;
const GENERATE_MS = 3800;
const SETTLE_MS = 500;

// ---- View -----------------------------------------------------------------

export default function ResolvingView({ input, onResolved, onError }: Props) {
  const [phase, setPhase] = useState<Phase>("crawling");
  const [companyId, setCompanyId] = useState<string | null>(null);

  const domain = formatDomain(input);

  // Kick off the mock resolve in the background — we ignore its event timing
  // (the animation runs on its own clock for visual rhythm) but use the
  // companyId it returns to know where to navigate.
  useEffect(() => {
    const cancel = startResolve(input, {
      onEvent: () => {},
      onDone: (id) => setCompanyId(id),
      onError,
    });
    return cancel;
  }, [input, onError]);

  // Phase machine
  useEffect(() => {
    const t1 = window.setTimeout(() => setPhase("generating"), CRAWL_MS);
    const t2 = window.setTimeout(() => setPhase("settle"), CRAWL_MS + GENERATE_MS);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  // After settle phase + companyId arrival, hand off
  useEffect(() => {
    if (phase !== "settle") return;
    if (!companyId) return;
    const t = window.setTimeout(() => onResolved(companyId), SETTLE_MS);
    return () => window.clearTimeout(t);
  }, [phase, companyId, onResolved]);

  return (
    <motion.section
      key="resolving"
      className="relative z-10 mx-auto flex min-h-svh w-full max-w-[760px] flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.5, ease } }}
      exit={{
        opacity: 0,
        scale: 1.02,
        filter: "blur(8px)",
        transition: { duration: 0.5, ease: [0.4, 0, 0.4, 1] },
      }}
    >
      {/* Felix mark with breathing aura */}
      <div className="relative mb-8 inline-flex items-center justify-center">
        <motion.span
          aria-hidden
          className="pointer-events-none absolute rounded-full"
          style={{
            width: 220,
            height: 220,
            background:
              "radial-gradient(circle, rgba(30,91,201,0.20) 0%, rgba(30,91,201,0.06) 40%, rgba(30,91,201,0) 70%)",
          }}
          animate={{ scale: [0.9, 1.08, 0.9], opacity: [0.55, 1, 0.55] }}
          transition={{ duration: 3.0, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.span
          aria-hidden
          className="pointer-events-none absolute rounded-[22%] border border-[rgba(30,91,201,0.35)]"
          style={{ width: 92, height: 92 }}
          initial={{ scale: 1, opacity: 0.4 }}
          animate={{ scale: [1, 1.7], opacity: [0.4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease, delay: 0.05 }}
          className="relative"
        >
          <FelixMark size={72} />
        </motion.div>
      </div>

      <AnimatePresence mode="wait">
        {phase === "crawling" && (
          <CrawlPhase key="crawl" domain={domain} />
        )}
        {phase === "generating" && (
          <GeneratePhase key="gen" />
        )}
        {phase === "settle" && (
          <SettlePhase key="settle" domain={domain} />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ---- Crawl phase ----------------------------------------------------------

function CrawlPhase({ domain }: { domain: string }) {
  const [pathIdx, setPathIdx] = useState(0);
  const [discoveryIdx, setDiscoveryIdx] = useState(-1);

  // Cycle paths fast (visual scanner)
  useEffect(() => {
    const id = window.setInterval(() => {
      setPathIdx((i) => (i + 1) % CRAWL_PATHS.length);
    }, 220);
    return () => window.clearInterval(id);
  }, []);

  // Reveal discoveries one by one
  useEffect(() => {
    const timeouts = DISCOVERIES.map((_, i) =>
      window.setTimeout(() => setDiscoveryIdx(i), 350 + i * 380),
    );
    return () => timeouts.forEach(window.clearTimeout);
  }, []);

  return (
    <motion.div
      key="crawl"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.35, ease } }}
      transition={{ duration: 0.5, ease }}
      className="flex w-full flex-col items-center"
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Felix is reading
      </div>
      <h2
        className="text-rose"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.8rem, 3.4vw, 2.4rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 500,
        }}
      >
        Crawling{" "}
        <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
          {domain}
        </span>
      </h2>

      {/* URL scanner box */}
      <div className="mt-7 w-full max-w-[480px] overflow-hidden rounded-[12px] border border-[var(--border)] bg-white/45 backdrop-blur-md">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
          <div className="flex gap-1.5">
            <span className="size-1.5 rounded-full bg-[var(--lavender)]/40" />
            <span className="size-1.5 rounded-full bg-[var(--lavender)]/40" />
            <span className="size-1.5 rounded-full bg-[var(--lavender)]/40" />
          </div>
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/70">
            scanning
          </span>
          <span className="ml-auto font-mono text-[10.5px] tabular-nums text-muted-foreground/80">
            {String(pathIdx + 1).padStart(2, "0")} / {CRAWL_PATHS.length}
          </span>
        </div>
        <div className="relative h-[120px] overflow-hidden">
          {CRAWL_PATHS.map((p, i) => {
            const offset = i - pathIdx;
            const visible = offset >= -2 && offset <= 4;
            return (
              <motion.div
                key={p}
                className="absolute left-3 right-3 flex items-center gap-2 font-mono text-[12.5px]"
                animate={{
                  y: offset * 22 + 50,
                  opacity: !visible
                    ? 0
                    : offset === 0
                      ? 1
                      : Math.max(0, 1 - Math.abs(offset) * 0.35),
                }}
                transition={{ duration: 0.25, ease }}
              >
                <span
                  className={
                    offset === 0
                      ? "text-[var(--blue)]"
                      : "text-muted-foreground/65"
                  }
                >
                  {offset === 0 ? "▸" : " "}
                </span>
                <span
                  className={
                    offset === 0 ? "text-rose" : "text-muted-foreground/65"
                  }
                >
                  {domain}
                  {p}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* Discoveries */}
      <div className="mt-7 w-full max-w-[480px] space-y-1.5">
        {DISCOVERIES.map((d, i) => {
          const visible = i <= discoveryIdx;
          return (
            <motion.div
              key={d.label}
              initial={{ opacity: 0, x: -6, filter: "blur(4px)" }}
              animate={
                visible
                  ? { opacity: 1, x: 0, filter: "blur(0px)" }
                  : { opacity: 0, x: -6, filter: "blur(4px)" }
              }
              transition={{ duration: 0.45, ease }}
              className="grid grid-cols-[110px_1fr] items-baseline gap-3 text-[12.5px]"
            >
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/75">
                {d.label}
              </span>
              <span className="text-rose tracking-[-0.005em]">{d.value}</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ---- Generate phase -------------------------------------------------------

function GeneratePhase() {
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setShown((s) => Math.min(s + 1, GENERATED_PROMPTS.length));
    }, 240);
    return () => window.clearInterval(interval);
  }, []);

  // Show last 5 cards in the stack — older ones fade up + out
  const visible = GENERATED_PROMPTS.slice(0, shown);

  return (
    <motion.div
      key="gen"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, transition: { duration: 0.35, ease } }}
      transition={{ duration: 0.5, ease }}
      className="flex w-full flex-col items-center"
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Felix is generating
      </div>
      <h2
        className="text-rose"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.8rem, 3.4vw, 2.4rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 500,
        }}
      >
        Generating prompt bank
      </h2>
      <div className="mt-2 flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
        <CountUp target={Math.min(421, shown * 35 + 28)} /> prompts
        <span className="text-muted-foreground/40">·</span>
        <span>9 languages</span>
        <span className="text-muted-foreground/40">·</span>
        <span>15 markets</span>
      </div>

      {/* Prompt cards stack */}
      <div className="relative mt-7 w-full max-w-[560px]">
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {visible.slice(-6).map((p) => {
              return (
                <motion.div
                  key={`${p.code}-${p.text}`}
                  layout
                  initial={{ opacity: 0, y: 24, scale: 0.96, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -16, scale: 0.98 }}
                  transition={{ duration: 0.5, ease }}
                  className="grid grid-cols-[28px_36px_1fr] items-center gap-3 rounded-[12px] border border-[var(--border)] bg-white/55 px-4 py-3 backdrop-blur-md"
                >
                  <span className="text-[18px] leading-none">{p.flag}</span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/75">
                    {p.code}
                  </span>
                  <span
                    className="text-[13px] tracking-[-0.005em] text-rose truncate"
                    style={{ fontFamily: "var(--font-sans)" }}
                  >
                    {p.text}
                  </span>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
        {/* Faded count of total generated below */}
        <div className="mt-4 flex items-center justify-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground/65">
          <span className="size-1 animate-pulse rounded-full bg-[var(--blue)]" />
          {shown} sample · {Math.max(0, 421 - shown)} more queued
        </div>
      </div>
    </motion.div>
  );
}

// ---- Settle phase --------------------------------------------------------

function SettlePhase({ domain }: { domain: string }) {
  return (
    <motion.div
      key="settle"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease }}
      className="flex flex-col items-center"
    >
      <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-muted-foreground">
        Ready
      </div>
      <h2
        className="text-rose"
        style={{
          fontFamily: "var(--font-sans)",
          fontSize: "clamp(1.8rem, 3.4vw, 2.4rem)",
          lineHeight: 1.05,
          letterSpacing: "-0.03em",
          fontWeight: 500,
        }}
      >
        <span className="text-[var(--blue)]" style={{ fontWeight: 600 }}>
          {domain}
        </span>{" "}
        mapped
      </h2>
      <div className="mt-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground/80">
        421 prompts · 15 markets · 9 brands tracked
      </div>
    </motion.div>
  );
}

// ---- Helpers --------------------------------------------------------------

function CountUp({ target }: { target: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf = 0;
    const t0 = performance.now();
    const dur = 600;
    const step = (t: number) => {
      const e = Math.min((t - t0) / dur, 1);
      const k = 1 - Math.pow(1 - e, 3);
      setV(Math.round(target * k));
      if (e < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <span className="tabular-nums">{v}</span>;
}

function formatDomain(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "—";
  // Already a domain?
  if (/^[a-z0-9-]+\.[a-z]{2,}$/i.test(trimmed)) return trimmed;
  // Strip common suffix words and add .com
  const cleaned = trimmed.replace(/\s+(project|app|inc|llc)$/i, "");
  return `${cleaned.replace(/\s+/g, "")}.com`;
}
