import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  FileText,
  X,
} from "lucide-react";
import Markdown from "react-markdown";

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
  const [viewing, setViewing] = useState<{
    action: ActionOut;
    markdown: string;
  } | null>(null);
  const [configFor, setConfigFor] = useState<ActionOut | null>(null);
  const deliverables = useDeliverables();

  function start(action: ActionOut) {
    if (state.kind !== "idle") return;
    setState({ kind: "drafting", action, stage: 0 });
  }

  // Drive the drafting pipeline.
  useEffect(() => {
    if (state.kind !== "drafting") return;
    if (state.stage >= PIPELINE.length) {
      let cancelled = false;
      const action = state.action;
      const slug = articleSlugFor(action, actions);
      void (async () => {
        let markdown = "";
        try {
          const res = await fetch(`/articles/${slug}.md`);
          if (res.ok) markdown = stripFrontmatter(await res.text());
        } catch {
          /* ignore */
        }
        if (cancelled) return;
        setState({ kind: "ready", action, markdown });
        setViewing({ action, markdown });
        createDeliverable(action, {
          type: "article",
          title: action.title,
          markdown,
          word_count_estimate: estimateWords(markdown),
        });
      })();
      return () => {
        cancelled = true;
      };
    }
    const t = window.setTimeout(() => {
      setState((s) =>
        s.kind === "drafting" ? { ...s, stage: s.stage + 1 } : s,
      );
    }, PIPELINE[state.stage].ms);
    return () => window.clearTimeout(t);
  }, [state, company, actions]);

  // ActionFeed onRun: re-open the editor for shipped actions; otherwise show
  // the config form first.
  async function handleRun(action: ActionOut) {
    if (action.suggested_agent !== "article") {
      setConfigFor(action);
      return;
    }
    // Already shipped → reopen the editor with the saved markdown.
    const existing = deliverables.find((d) => d.action_id === action.id);
    if (existing && existing.payload.type === "article") {
      setViewing({ action, markdown: existing.payload.markdown });
      return;
    }
    // Otherwise show the config form first.
    setConfigFor(action);
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
      <div className="mx-auto w-full max-w-[820px]">
        <Header
          eyebrow="Studio · Blog post"
          title="Articles for"
          accent={own}
          subtitle="Specialist agent runs deep research on each Peec opportunity, then drafts publication-ready longform."
        />

        <ActionFeed
          actions={actions}
          completed={completed}
          onRun={handleRun}
          noun={{ singular: "article", plural: "articles" }}
        />
      </div>

      <AnimatePresence>
        {configFor && (
          <AgentConfigForm
            key={`config-${configFor.id}`}
            open
            agent="article"
            action={configFor}
            onClose={() => setConfigFor(null)}
            onGenerate={() => {
              const a = configFor;
              setConfigFor(null);
              if (a) start(a);
            }}
          />
        )}
        {state.kind === "drafting" && (
          <DraftingOverlay key="drafting" stage={state.stage} action={state.action} />
        )}
        {viewing && (
          <EditorOverlay
            key="editor"
            action={viewing.action}
            markdown={viewing.markdown}
            onClose={() => {
              setViewing(null);
              if (state.kind === "ready") setState({ kind: "idle" });
            }}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ---- Drafting overlay -----------------------------------------------------

function DraftingOverlay({
  stage,
  action,
}: {
  stage: number;
  action: ActionOut;
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
            <div className="mb-3 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
              <span
                className="size-1 rounded-full bg-[var(--blue)]"
                style={{
                  boxShadow: "0 0 0 4px rgba(30,91,201,0.16)",
                  animation: "lg-pulse 2.4s ease-in-out infinite",
                }}
              />
              Step {Math.min(stage + 1, PIPELINE.length)} · {PIPELINE.length}
            </div>
            <h3
              className="mb-5 text-rose"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 22,
                fontWeight: 500,
                letterSpacing: "-0.022em",
                lineHeight: 1.1,
              }}
            >
              {PIPELINE[Math.min(stage, PIPELINE.length - 1)]?.label}
            </h3>
            <ol className="space-y-2 text-[12px]">
              {PIPELINE.map((p, i) => {
                const done = i < stage;
                const active = i === stage;
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
                        <span className="size-2 animate-pulse rounded-full bg-current" />
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
          </div>
        </LGCard>
        <style>{`@keyframes lg-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.4);opacity:.55}}`}</style>
      </motion.div>
    </>
  );
}

// ---- Editor overlay (shows the rendered markdown article) -----------------

function EditorOverlay({
  action,
  markdown,
  onClose,
}: {
  action: ActionOut;
  markdown: string;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const deliverable = useDeliverableForAction(action.id);
  const status = deliverable?.status ?? "draft";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
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
    publishDeliverable(deliverable.id, "Blog");
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3, ease }}
        onClick={onClose}
        className="fixed inset-0 z-40 bg-[rgba(31,26,40,0.55)] backdrop-blur-2xl"
      />
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 16, scale: 0.97 }}
        transition={{ duration: 0.5, ease }}
        className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-[920px] -translate-y-1/2"
      >
        <LGCard cornerRadius={22}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-3">
              <FileText className="size-4 text-[var(--blue)]" strokeWidth={1.6} />
              <div className="min-w-0">
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {status === "scheduled"
                    ? "Article · scheduled"
                    : status === "published"
                      ? "Article · live"
                      : "Article · draft"}
                </div>
                <h3
                  className="truncate text-rose"
                  style={{
                    fontFamily: "var(--font-sans)",
                    fontSize: 16,
                    fontWeight: 500,
                    letterSpacing: "-0.012em",
                  }}
                >
                  {action.title}
                </h3>
              </div>
            </div>
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
                onClick={handleSchedule}
                disabled={status === "scheduled" || status === "published"}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] border border-[var(--border)] bg-white/80 px-3 py-1.5 text-[11.5px] font-medium text-rose transition-colors hover:bg-white disabled:opacity-40"
              >
                <Calendar className="size-3" />
                {status === "scheduled" ? "Scheduled" : "Schedule"}
              </button>
              <button
                type="button"
                onClick={handlePublish}
                disabled={status === "published"}
                className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3 py-1.5 text-[11.5px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                <ExternalLink className="size-3" />
                {status === "published" ? "Published" : "Post to blog"}
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
          </div>
          <div className="prose prose-sm max-h-[68vh] max-w-none overflow-y-auto px-8 py-6 text-rose/90 prose-headings:text-rose prose-headings:font-medium prose-h1:text-2xl prose-h2:text-lg prose-h3:text-base prose-p:text-[13.5px] prose-p:leading-relaxed prose-li:text-[13px] prose-a:text-[var(--blue)]">
            <Markdown>{markdown}</Markdown>
          </div>
        </LGCard>
      </motion.div>
    </>
  );
}

// ---- Header ---------------------------------------------------------------

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

// ---- Article source mapping ----------------------------------------------

const ARTICLE_SLUGS = [
  "ai-document-review-ma-due-diligence",
  "evaluate-legal-ai-tools-framework",
  "outside-counsel-guidelines-firms-adapting",
] as const;

function articleSlugFor(action: ActionOut, all: ActionOut[]): string {
  const text = `${action.title} ${action.rationale ?? ""}`.toLowerCase();
  if (/(due[ -]diligence|m&a|document review)/.test(text)) {
    return "ai-document-review-ma-due-diligence";
  }
  if (/(evaluat|framework|how to (?:choose|pick))/.test(text)) {
    return "evaluate-legal-ai-tools-framework";
  }
  if (/(outside counsel|ocg|guideline)/.test(text)) {
    return "outside-counsel-guidelines-firms-adapting";
  }
  const articleActions = all.filter((a) => a.suggested_agent === "article");
  const idx = Math.max(0, articleActions.findIndex((a) => a.id === action.id));
  return ARTICLE_SLUGS[idx % ARTICLE_SLUGS.length];
}

function stripFrontmatter(md: string): string {
  if (!md.startsWith("---")) return md;
  const end = md.indexOf("\n---", 3);
  if (end === -1) return md;
  return md.slice(end + 4).replace(/^\s+/, "");
}

function estimateWords(md: string): number {
  return md.trim().split(/\s+/).filter(Boolean).length;
}
