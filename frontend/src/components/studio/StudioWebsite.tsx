import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Check, ExternalLink, GitBranch, GitPullRequestArrow, X } from "lucide-react";

import ActionFeed from "@/components/ActionFeed";
import AgentConfigForm from "@/components/AgentConfigForm";
import LGCard from "@/components/LGCard";
import RunOverlay, { type RunStage } from "@/components/RunOverlay";
import { createDeliverable, useDeliverables } from "@/lib/deliverables";
import type { ActionOut, CompanyOut } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  onRun: (a: ActionOut) => void;
  completed: Set<string>;
};

type State =
  | { kind: "idle" }
  | { kind: "running"; action: ActionOut; stage: number; elapsedMs: number }
  | { kind: "done"; action: ActionOut; prUrl: string };

const STAGES: RunStage[] = [
  {
    label: "Cloning repo",
    hint: "Fetching the working tree from GitHub",
    ms: 2400,
  },
  {
    label: "Reading site structure",
    hint: "Detecting framework, routes, existing meta",
    ms: 3200,
  },
  {
    label: "Generating JSON-LD + meta",
    hint: "Drafting Organization · FAQPage · breadcrumbs",
    ms: 3600,
  },
  {
    label: "Committing changes",
    hint: "Touching layout & SEO sources only",
    ms: 2400,
  },
  {
    label: "Opening pull request",
    hint: "Filing PR with reviewers + summary",
    ms: 2000,
  },
];

function streamItemsForStage(
  stage: number,
  repoSlug: string,
  schemas: string[],
): string[] {
  if (stage === 0)
    return [
      `git clone https://github.com/${repoSlug}.git`,
      "Cloned · 2,418 files",
      "Detected default branch · main",
      "Working tree clean",
    ];
  if (stage === 1)
    return [
      "Detected · Next.js 14 · App Router",
      "Routes discovered · 8",
      "Found · open-graph tags · partial",
      "Missing · JSON-LD on / and /pricing",
    ];
  if (stage === 2)
    return [
      ...schemas.map((s) => `Drafted · ${s} schema`),
      "Lint clean · 0 warnings",
      "Inserted into app/layout.tsx",
    ];
  if (stage === 3)
    return [
      "Modified · app/layout.tsx",
      "Modified · app/seo.ts",
      "+38 / -2 lines",
      "Commit · 'Add JSON-LD structured data'",
    ];
  return [
    "Pushed · midas/seo branch",
    "Opened PR · awaiting review",
    "Reviewers · @design-review",
    "Status · open",
  ];
}

export default function StudioWebsite({
  company,
  actions,
  onRun,
  completed,
}: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [configFor, setConfigFor] = useState<ActionOut | null>(null);
  const deliverables = useDeliverables();

  const own = company.own_brand?.name ?? company.name;
  const repoSlug = `${(company.own_domain ?? "site").replace(/\.[^.]+$/, "")}/${(company.own_brand?.name ?? "site").toLowerCase().replace(/\s+/g, "-")}`;

  function handleRun(action: ActionOut) {
    // site_blog (publish-to-site) doesn't fit the GitHub-PR overlays here —
    // delegate to the global AgentRunPanel which has the publish flow + iframe.
    if (action.kind === "site_blog") {
      onRun(action);
      return;
    }
    // Already shipped → reopen the done overlay with the saved PR url.
    const existing = deliverables.find((d) => d.action_id === action.id);
    if (existing && existing.payload.type === "code-pr") {
      setState({
        kind: "done",
        action,
        prUrl: existing.payload.pr_url,
      });
      return;
    }
    // Otherwise show the config form first.
    setConfigFor(action);
  }

  function start(action: ActionOut) {
    if (state.kind === "running") return;
    setState({ kind: "running", action, stage: 0, elapsedMs: 0 });
    let i = 0;
    let elapsed = 0;
    const tick = () => {
      elapsed += STAGES[i]?.ms ?? 0;
      i += 1;
      if (i >= STAGES.length) {
        const prUrl = `https://github.com/FabianSalge/brick-by-brick-clone/pull/4`;
        setState({ kind: "done", action, prUrl });
        const schemas = (action.target.schemas as string[] | undefined) ?? [
          "Organization",
          "FAQPage",
        ];
        createDeliverable(action, {
          type: "code-pr",
          title: action.title,
          repo: repoSlug,
          branch: `midas/${action.id.split("_").slice(-1)[0]?.slice(0, 6) ?? "abc"}`,
          pr_url: prUrl,
          files_changed: ["app/layout.tsx", "app/seo.ts"],
          diff_preview: "+ structured data added",
          schemas_added: schemas,
        });
        return;
      }
      setState({ kind: "running", action, stage: i, elapsedMs: elapsed });
      window.setTimeout(tick, STAGES[i]?.ms ?? 900);
    };
    window.setTimeout(tick, STAGES[0].ms);
  }

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
          eyebrow="Studio · Website"
          title="Optimize"
          accent={own}
          subtitle="Specialist agent reads your site, ships JSON-LD, FAQ schema, and structured data — opens a PR for review."
        />

        <ActionFeed
          actions={actions}
          completed={completed}
          onRun={handleRun}
          noun={{ singular: "PR", plural: "PRs" }}
        />
      </div>

      <AnimatePresence>
        {configFor && (
          <AgentConfigForm
            key={`config-${configFor.id}`}
            open
            agent="code-pr"
            action={configFor}
            onClose={() => setConfigFor(null)}
            onGenerate={() => {
              const a = configFor;
              setConfigFor(null);
              if (a) start(a);
            }}
          />
        )}
        {state.kind === "running" && (
          <RunOverlay
            key="running"
            title={`${repoSlug} · ${state.action.title}`}
            stages={STAGES}
            stage={state.stage}
            elapsedMs={state.elapsedMs}
            streamItems={streamItemsForStage(
              state.stage,
              repoSlug,
              (state.action.target.schemas as string[] | undefined) ?? [
                "Organization",
                "FAQPage",
              ],
            )}
            workingLabel="Opening PR"
          />
        )}
        {state.kind === "done" && (
          <DoneOverlay
            key="done"
            action={state.action}
            prUrl={state.prUrl}
            repoSlug={repoSlug}
            onClose={() => setState({ kind: "idle" })}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}

// ---- Overlays --------------------------------------------------------------

function DoneOverlay({
  action,
  prUrl,
  repoSlug,
  onClose,
}: {
  action: ActionOut;
  prUrl: string;
  repoSlug: string;
  onClose: () => void;
}) {
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
        <LGCard cornerRadius={22}>
          <div className="px-7 pb-7 pt-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <GitBranch className="size-3" />
                {repoSlug}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid size-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
              >
                <X className="size-3.5" strokeWidth={1.75} />
              </button>
            </div>
            <h3
              className="mb-3 text-rose"
              style={{
                fontFamily: "var(--font-sans)",
                fontSize: 17,
                fontWeight: 500,
                letterSpacing: "-0.012em",
                lineHeight: 1.25,
              }}
            >
              {action.title}
            </h3>
            <div className="mb-3 flex items-center gap-2 rounded-[var(--radius-md)] border border-emerald-200/80 bg-emerald-50/70 px-3 py-2.5 text-[12.5px] text-emerald-800">
              <Check className="size-3.5" strokeWidth={3} />
              PR opened on {repoSlug}
            </div>
            <a
              href={prUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/85 px-3 py-2.5 text-[12.5px] font-mono text-rose transition-colors hover:border-[var(--border-strong)]"
            >
              <span className="flex items-center gap-2">
                <GitPullRequestArrow className="size-3.5 text-[var(--blue)]" />
                {prShortSlug(prUrl)}
              </span>
              <ExternalLink className="size-3 opacity-70" />
            </a>
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
