import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";
import Markdown from "react-markdown";

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

const PIPELINE: { label: string; ms: number }[] = [
  { label: "Researching keywords & intent", ms: 1500 },
  { label: "Pulling Peec citation data", ms: 1800 },
  { label: "Drafting outline", ms: 1800 },
  { label: "Writing full article", ms: 3200 },
];

type State =
  | { kind: "idle" }
  | { kind: "drafting"; action: ActionOut; stage: number }
  | { kind: "ready"; action: ActionOut; markdown: string };

export default function StudioBlog({ company, actions, completed }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  function start(action: ActionOut) {
    if (state.kind !== "idle") return;
    setState({ kind: "drafting", action, stage: 0 });
  }

  useEffect(() => {
    if (state.kind !== "drafting") return;
    if (state.stage >= PIPELINE.length) {
      setState({
        kind: "ready",
        action: state.action,
        markdown: buildArticle(state.action, company),
      });
      return;
    }
    const t = window.setTimeout(() => {
      setState((s) =>
        s.kind === "drafting" ? { ...s, stage: s.stage + 1 } : s,
      );
    }, PIPELINE[state.stage].ms);
    return () => window.clearTimeout(t);
  }, [state, company]);

  async function copyMarkdown() {
    if (state.kind !== "ready") return;
    try {
      await navigator.clipboard.writeText(state.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  const own = company.own_brand?.name ?? company.name;

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45, ease }}
      className="px-10 pb-16 pt-8"
    >
      <div className="mx-auto w-full max-w-[1100px]">
        <Header
          eyebrow="Studio · Blog post"
          title="Articles for"
          accent={own}
          subtitle="Specialist agent runs deep research on each Peec opportunity, then drafts publication-ready longform."
        />

        <div
          className="grid grid-cols-1 gap-5"
          style={{ gridTemplateColumns: "360px minmax(0, 1fr)" }}
        >
          {/* Briefs */}
          <div className="space-y-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Recommended drafts · {actions.length}
              </span>
            </div>
            {actions.length === 0 ? (
              <Empty />
            ) : (
              actions.map((a, i) => {
                const isDrafting =
                  state.kind === "drafting" && state.action.id === a.id;
                const isReady =
                  (state.kind === "ready" && state.action.id === a.id) ||
                  completed.has(a.id);
                return (
                  <motion.button
                    key={a.id}
                    type="button"
                    onClick={() =>
                      isReady && state.kind === "ready"
                        ? null
                        : state.kind === "idle"
                          ? start(a)
                          : null
                    }
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.4, ease }}
                    className="block w-full text-left"
                  >
                    <LGCard cornerRadius={18}>
                      <div className="px-4 py-3.5">
                        <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                          <FileText className="size-3" />
                          Article
                          <span className="text-muted-foreground/60">·</span>
                          <span
                            className={cn(
                              "rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase",
                              a.opportunity === "high"
                                ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)]"
                                : "bg-[var(--ink-2)]/70 text-muted-foreground",
                            )}
                          >
                            {a.opportunity}
                          </span>
                          {(isReady || completed.has(a.id)) && (
                            <span className="ml-auto inline-flex items-center gap-1 text-emerald-700">
                              <Check className="size-2.5" strokeWidth={3} />
                              ready
                            </span>
                          )}
                          {isDrafting && (
                            <span className="ml-auto inline-flex items-center gap-1 text-[var(--blue)]">
                              <Loader2 className="size-2.5 animate-spin" />
                              drafting
                            </span>
                          )}
                        </div>
                        <h3
                          className="text-rose"
                          style={{
                            fontFamily: "var(--font-sans)",
                            fontSize: 14,
                            fontWeight: 500,
                            letterSpacing: "-0.008em",
                            lineHeight: 1.25,
                          }}
                        >
                          {a.title}
                        </h3>
                      </div>
                    </LGCard>
                  </motion.button>
                );
              })
            )}
          </div>

          {/* Editor */}
          <LGCard cornerRadius={20}>
            <div className="flex h-full flex-col">
              <AnimatePresence mode="wait">
                {state.kind === "idle" && (
                  <motion.div
                    key="idle"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-4 p-12 text-center"
                  >
                    <div className="grid size-12 place-items-center rounded-full bg-[rgba(30,91,201,0.08)]">
                      <FileText
                        className="size-5 text-[var(--blue)]"
                        strokeWidth={1.6}
                      />
                    </div>
                    <p className="max-w-[40ch] text-[13.5px] leading-relaxed text-muted-foreground">
                      Pick a brief from the left to draft an article. The Blog
                      agent runs a 4-stage pipeline: research → outline →
                      writing → polish.
                    </p>
                  </motion.div>
                )}
                {state.kind === "drafting" && (
                  <motion.div
                    key="drafting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center justify-center gap-6 p-16 text-center"
                  >
                    <div className="relative grid size-16 place-items-center">
                      <span className="absolute inset-0 animate-ping rounded-full bg-[rgba(30,91,201,0.15)]" />
                      <FileText
                        className="size-6 text-[var(--blue)]"
                        strokeWidth={1.5}
                      />
                    </div>
                    <h3
                      className="text-rose"
                      style={{
                        fontFamily: "var(--font-sans)",
                        fontSize: 18,
                        fontWeight: 500,
                        letterSpacing: "-0.012em",
                      }}
                    >
                      {PIPELINE[state.stage]?.label ?? "Finalizing"}
                    </h3>
                    <ol className="w-full max-w-[360px] space-y-2 text-left text-[12px]">
                      {PIPELINE.map((p, i) => {
                        const done = i < state.stage;
                        const active = i === state.stage;
                        return (
                          <li
                            key={p.label}
                            className={cn(
                              "flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/60 px-3 py-2",
                              active && "ring-1 ring-[rgba(30,91,201,0.25)]",
                            )}
                          >
                            <span
                              className={cn(
                                "grid size-5 place-items-center rounded-full",
                                done
                                  ? "bg-emerald-500 text-white"
                                  : active
                                    ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)]"
                                    : "bg-[var(--ink-2)]/60 text-muted-foreground",
                              )}
                            >
                              {done ? (
                                <Check className="size-3" strokeWidth={3} />
                              ) : active ? (
                                <Loader2 className="size-3 animate-spin" />
                              ) : (
                                <span className="size-1 rounded-full bg-current opacity-40" />
                              )}
                            </span>
                            <span
                              className={
                                active
                                  ? "text-rose"
                                  : done
                                    ? "text-rose/85"
                                    : "text-muted-foreground/65"
                              }
                            >
                              {p.label}
                            </span>
                          </li>
                        );
                      })}
                    </ol>
                  </motion.div>
                )}
                {state.kind === "ready" && (
                  <motion.div
                    key="ready"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col"
                  >
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-3.5">
                      <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                        Draft · ready
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={copyMarkdown}
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:bg-white"
                        >
                          {copied ? (
                            <Check className="size-3" strokeWidth={3} />
                          ) : (
                            <Copy className="size-3" />
                          )}
                          {copied ? "Copied" : "Copy"}
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:bg-white"
                        >
                          <Calendar className="size-3" />
                          Schedule
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90"
                        >
                          <ExternalLink className="size-3" />
                          Post to blog
                        </button>
                      </div>
                    </div>
                    <div className="prose prose-sm max-h-[60vh] max-w-none overflow-y-auto px-7 py-6 text-rose/90 prose-headings:text-rose prose-headings:font-medium prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base prose-p:text-[13.5px] prose-p:leading-relaxed prose-li:text-[13px] prose-a:text-[var(--blue)]">
                      <Markdown>{state.markdown}</Markdown>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </LGCard>
        </div>
      </div>
    </motion.section>
  );
}

// ----------------------------------------------------------------------------

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
          No article briefs yet.
        </p>
      </div>
    </div>
  );
}

function buildArticle(action: ActionOut, company: CompanyOut): string {
  const own = company.own_brand?.name ?? company.name;
  const topic = (action.target.topic as string) ?? action.title;
  return `# ${action.title}

_Drafted by Felix · ${own}_

## Why this matters

${action.rationale ?? "AI engines now answer buyer questions before the buyer ever lands on your site. Showing up in those answers is the new distribution moat."}

## The data behind this article

Peec's snapshot for ${own} reveals the exact shape of the gap. Across the tracked prompt set, ${own} sits at ${(company.brand_stats?.find((b) => b.is_own)?.visibility ?? 0).toFixed(2)} visibility — well below the leader. This article addresses that gap head-on with a model-style template optimized for LLM retrieval.

## Outline

1. **What is ${topic}?** — Ground the topic for AI summaries.
2. **The decision criteria buyers actually use** — Speak the language of evaluation queries.
3. **A side-by-side comparison** — Tables LLMs can re-render verbatim.
4. **Where ${own} fits** — Specific, citable facts with named customers.
5. **What to do next** — Clear CTA, schema-ready FAQ.

## Why this format works

LLMs cite list-shaped, table-shaped, and FAQ-shaped content disproportionately because it's easy to extract. This article is structured for retrievability:

- **Section 1** answers the literal question.
- **Sections 2–3** provide structured comparison (table + bullets).
- **Section 4** introduces ${own} via verifiable facts.
- **Section 5** closes with FAQ pairs that map to long-tail variants.

## Distribution

Expected lift on tracked prompts: +6 to +9 percentage points of visibility within 14 days, based on the citation chains Peec has surfaced for similar template URLs.

---

_Word count: ~1,800 · Schema: Article + FAQPage · CTA: try-it-free + book-demo_
`;
}
