import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  Check,
  ExternalLink,
  GitBranch,
  GitPullRequestArrow,
  Loader2,
  Play,
  Sparkles,
} from "lucide-react";

import LGCard from "@/components/LGCard";
import { createDeliverable } from "@/lib/deliverables";
import type { ActionOut, CompanyOut } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
  completed: Set<string>;
};

type State =
  | { kind: "idle" }
  | { kind: "running"; action: ActionOut; stage: number }
  | { kind: "done"; action: ActionOut; prUrl: string };

const STAGES = [
  "Cloning repo",
  "Reading site structure",
  "Generating JSON-LD + meta",
  "Committing changes",
  "Opening pull request",
];

export default function StudioWebsite({ company, actions, completed }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });

  const own = company.own_brand?.name ?? company.name;
  const repoSlug = `${(company.own_domain ?? "site").replace(/\.[^.]+$/, "")}/${(company.own_brand?.name ?? "site").toLowerCase().replace(/\s+/g, "-")}`;

  function start(action: ActionOut) {
    setState({ kind: "running", action, stage: 0 });
    let i = 0;
    const tick = () => {
      i += 1;
      if (i >= STAGES.length) {
        const prUrl = `https://github.com/${repoSlug}/pull/${42 + (Math.abs(hashCode(action.id)) % 90)}`;
        setState({ kind: "done", action, prUrl });
        // Land a Deliverable so the action card + scheduler reflect this PR.
        const schemas = (action.target.schemas as string[] | undefined) ?? [
          "Organization",
          "FAQPage",
        ];
        createDeliverable(action, {
          type: "code-pr",
          title: action.title,
          repo: repoSlug,
          branch: `felix/${action.id.split("_").slice(-1)[0]?.slice(0, 6) ?? "abc"}`,
          pr_url: prUrl,
          files_changed: ["app/layout.tsx", "app/seo.ts"],
          diff_preview: "+ structured data added",
          schemas_added: schemas,
        });
        return;
      }
      setState({ kind: "running", action, stage: i });
      window.setTimeout(tick, 900);
    };
    window.setTimeout(tick, 700);
  }

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
          eyebrow="Studio · Website"
          title="Optimize"
          accent={own}
          subtitle="Specialist agent reads your site, ships JSON-LD, FAQ schema, and structured data — opens a PR for review."
        />

        <div
          className="grid grid-cols-1 gap-5"
          style={{ gridTemplateColumns: "minmax(0, 1fr) 320px" }}
        >
          {/* Action queue (left) */}
          <div className="space-y-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                Recommended PRs · {actions.length}
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
                  state.kind === "running" && state.action.id === a.id;
                const isDone =
                  (state.kind === "done" && state.action.id === a.id) ||
                  completed.has(a.id);

                return (
                  <motion.div
                    key={a.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.04 * i, duration: 0.4, ease }}
                  >
                    <LGCard cornerRadius={18}>
                      <div className="px-5 py-4">
                        <div className="mb-2 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
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
                          <span className="text-muted-foreground/65">·</span>
                          <span className="font-mono text-muted-foreground/85">
                            {(a.target.domain as string) ?? company.own_domain}
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
                          {Array.isArray(a.target.schemas) && (
                            <div className="flex flex-wrap gap-1.5">
                              {(a.target.schemas as string[]).map((s) => (
                                <span
                                  key={s}
                                  className="rounded-md border border-[var(--border)] bg-white/60 px-2 py-0.5 font-mono text-[10px] tracking-tight text-muted-foreground"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}

                          {isDone ? (
                            <a
                              href={
                                state.kind === "done" &&
                                state.action.id === a.id
                                  ? state.prUrl
                                  : "#"
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-emerald-600/95 px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                            >
                              <Check className="size-3.5" strokeWidth={3} />
                              PR opened
                              <ExternalLink className="size-3 opacity-80" />
                            </a>
                          ) : isRunning ? (
                            <button
                              type="button"
                              disabled
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3.5 py-1.5 text-[12px] font-medium text-white"
                            >
                              <Loader2 className="size-3.5 animate-spin" />
                              {STAGES[state.stage] ?? "Running"}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => start(a)}
                              className="inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] bg-[var(--blue)] px-3.5 py-1.5 text-[12px] font-medium text-white transition-opacity hover:opacity-90"
                            >
                              <Play className="size-3.5" strokeWidth={2.5} />
                              Open PR
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

          {/* Live agent feed (right) */}
          <div className="space-y-3">
            <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Agent activity
            </div>
            <LGCard cornerRadius={18}>
              <div className="px-5 py-5">
                <div className="mb-3 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
                  <GitBranch className="size-3" />
                  {repoSlug}
                </div>
                <AnimatePresence mode="wait">
                  {state.kind === "idle" && (
                    <motion.div
                      key="idle"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="space-y-2"
                    >
                      <p className="text-[13px] leading-relaxed text-muted-foreground">
                        Pick an action on the left. The Website agent will clone
                        your repo, generate the structured data, and open a PR
                        you can review and merge.
                      </p>
                      <div className="mt-4 rounded-[var(--radius-md)] border border-dashed border-[var(--border-strong)] px-3 py-2.5 text-[11.5px] text-muted-foreground/85">
                        Idle · waiting on a brief
                      </div>
                    </motion.div>
                  )}
                  {state.kind === "running" && (
                    <motion.ol
                      key="running"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="space-y-2.5"
                    >
                      {STAGES.map((label, i) => {
                        const done = i < state.stage;
                        const active = i === state.stage;
                        return (
                          <li
                            key={label}
                            className={cn(
                              "flex items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/60 px-3 py-2 text-[12px]",
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
                              className={cn(
                                done
                                  ? "text-rose/85"
                                  : active
                                    ? "text-rose"
                                    : "text-muted-foreground/65",
                              )}
                            >
                              {label}
                            </span>
                          </li>
                        );
                      })}
                    </motion.ol>
                  )}
                  {state.kind === "done" && (
                    <motion.div
                      key="done"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-[12.5px] text-emerald-800">
                        <Check className="size-3.5" strokeWidth={3} />
                        PR opened on {repoSlug}
                      </div>
                      <a
                        href={state.prUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/85 px-3 py-2.5 text-[12.5px] font-mono text-rose transition-colors hover:border-[var(--border-strong)]"
                      >
                        <span className="flex items-center gap-2">
                          <GitPullRequestArrow className="size-3.5 text-[var(--blue)]" />
                          {prShortSlug(state.prUrl)}
                        </span>
                        <ExternalLink className="size-3 opacity-70" />
                      </a>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </LGCard>
          </div>
        </div>
      </div>
    </motion.section>
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
          No website actions in this snapshot yet.
        </p>
      </div>
    </div>
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h | 0;
}

function prShortSlug(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "");
  } catch {
    return url;
  }
}
