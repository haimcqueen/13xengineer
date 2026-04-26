/**
 * AgentConfigForm — the "Customize before running" form that appears in
 * AgentRunPanel, lifted out so the per-Studio pages can show the same
 * pre-flight config modal before kicking off their own run pipelines.
 *
 * Each agent has its own config block (ArticleConfig / VideoConfig /
 * WebsiteConfig). The shared `Config` type carries fields for all three so a
 * single state object can flow through any of them.
 */
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { Settings2, Sparkles, X } from "lucide-react";

import LGCard from "@/components/LGCard";
import type { ActionOut, AgentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

export type AgentConfig = {
  // article
  tone: "punchy" | "authoritative" | "conversational";
  length: "concise" | "standard" | "deep-dive";
  includeFAQ: boolean;
  // video
  duration: "30s" | "60s" | "90s";
  voiceover: "warm" | "sharp" | "none";
  aspect: "16:9" | "9:16" | "1:1";
  // website (informational + repo)
  schemas: string[];
  repoUrl: string;
  githubToken: string;
  siteUrl: string;
  defaultBranch: string;
};

export function defaultAgentConfig(action: ActionOut): AgentConfig {
  const targetSchemas =
    (action.target.schemas as string[] | undefined) ?? [
      "Organization",
      "FAQPage",
    ];
  const siteUrl = action.target.domain
    ? `https://${action.target.domain as string}`
    : "";
  return {
    tone: "authoritative",
    length: "standard",
    includeFAQ: true,
    duration: "90s",
    voiceover: "warm",
    aspect: "16:9",
    schemas: targetSchemas,
    repoUrl: "",
    githubToken: "",
    siteUrl,
    defaultBranch: "main",
  };
}

export function isWebsiteConfigValid(c: AgentConfig): boolean {
  return (
    /^https?:\/\/.+/i.test(c.siteUrl) &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+/i.test(c.repoUrl) &&
    c.githubToken.trim().length > 5 &&
    c.defaultBranch.trim().length > 0
  );
}

// ---- Modal wrapper used by each Studio page -------------------------------

type Props = {
  open: boolean;
  agent: AgentKind;
  action: ActionOut;
  onClose: () => void;
  onGenerate: (config: AgentConfig) => void;
};

export default function AgentConfigForm({
  open,
  agent,
  action,
  onClose,
  onGenerate,
}: Props) {
  const [config, setConfig] = useState<AgentConfig>(() =>
    defaultAgentConfig(action),
  );

  // Re-seed config when the action changes (so each new modal opens fresh).
  useEffect(() => {
    if (open) setConfig(defaultAgentConfig(action));
  }, [open, action]);

  // Esc to dismiss
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const verb =
    agent === "article"
      ? "Draft article"
      : agent === "video"
        ? "Generate video"
        : agent === "code-pr"
          ? "Open pull request"
          : "Run";

  const canGenerate =
    agent === "code-pr" ? isWebsiteConfigValid(config) : true;

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
        className="fixed inset-x-4 top-1/2 z-50 mx-auto w-full max-w-[560px] -translate-y-1/2"
      >
        <LGCard cornerRadius={22}>
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-6 py-4">
            <div className="min-w-0">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                {agent === "article"
                  ? "Article agent"
                  : agent === "video"
                    ? "Video agent"
                    : "Website agent"}
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
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
            >
              <X className="size-3.5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
            <div className="mb-5 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
              <Settings2 className="size-3" />
              Customize before running
            </div>

            {agent === "article" && (
              <ArticleConfig
                config={config}
                onChange={setConfig}
                action={action}
              />
            )}
            {agent === "video" && (
              <VideoConfig
                config={config}
                onChange={setConfig}
                action={action}
              />
            )}
            {agent === "code-pr" && (
              <WebsiteConfig
                config={config}
                onChange={setConfig}
                action={action}
              />
            )}

            <div className="mt-6 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/30 p-4">
              <div className="mb-1.5 flex items-center gap-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                <Sparkles className="size-3" />
                Grounded in Peec data
              </div>
              <p className="text-[12.5px] leading-relaxed text-rose/85">
                {action.rationale ??
                  "This action is sourced from your latest Peec snapshot."}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--border)] px-6 py-4">
            <button
              type="button"
              onClick={() => onGenerate(config)}
              disabled={!canGenerate}
              className={cn(
                "group flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-3 text-[13px] font-medium text-white transition-opacity",
                canGenerate
                  ? "bg-[var(--blue)] hover:opacity-90"
                  : "cursor-not-allowed bg-[var(--ink-2)]/85 text-muted-foreground",
              )}
            >
              <Sparkles className="size-3.5" strokeWidth={2.5} />
              {verb}
              <span className="ml-1 inline-flex items-center gap-0.5 opacity-70 transition-transform group-hover:translate-x-0.5">
                <span aria-hidden>→</span>
              </span>
            </button>
            {agent === "code-pr" && !canGenerate && (
              <p className="mt-2 text-center font-mono text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground/85">
                Fill repo URL, token & site URL to continue
              </p>
            )}
          </div>
        </LGCard>
      </motion.div>
    </>
  );
}

// ---- Per-agent config blocks ----------------------------------------------

function ArticleConfig({
  config,
  onChange,
  action,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  action: ActionOut;
}) {
  const competitors =
    (action.target.competitors as string[] | undefined) ?? [];
  const topic =
    (action.target.topic as string | undefined) ??
    (action.target.format as string | undefined) ??
    "the prompt set";

  return (
    <div className="space-y-5">
      <Field label="Tone">
        <PillGroup
          value={config.tone}
          options={[
            { value: "punchy", label: "Punchy" },
            { value: "authoritative", label: "Authoritative" },
            { value: "conversational", label: "Conversational" },
          ]}
          onChange={(v) =>
            onChange({ ...config, tone: v as AgentConfig["tone"] })
          }
        />
      </Field>

      <Field label="Length">
        <PillGroup
          value={config.length}
          options={[
            { value: "concise", label: "Concise · ~1,200" },
            { value: "standard", label: "Standard · ~2,000" },
            { value: "deep-dive", label: "Deep dive · ~3,500" },
          ]}
          onChange={(v) =>
            onChange({ ...config, length: v as AgentConfig["length"] })
          }
        />
      </Field>

      <Field label="Schema markup">
        <Toggle
          checked={config.includeFAQ}
          onChange={(c) => onChange({ ...config, includeFAQ: c })}
          label="Include FAQPage schema"
          hint="Adds a Q&A block at the bottom plus JSON-LD"
        />
      </Field>

      {competitors.length > 0 && (
        <Field
          label="Reference competitors"
          hint="Pulled from this action's Peec data"
        >
          <div className="flex flex-wrap gap-1.5">
            {competitors.map((c) => (
              <span
                key={c}
                className="rounded-md border border-[var(--border)] bg-white/70 px-2 py-1 font-mono text-[10.5px] text-rose/80"
              >
                {c}
              </span>
            ))}
          </div>
        </Field>
      )}

      <Field label="Topic anchor">
        <span className="block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-3 py-2 font-mono text-[12px] text-rose/85">
          {topic}
        </span>
      </Field>
    </div>
  );
}

function VideoConfig({
  config,
  onChange,
  action,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  action: ActionOut;
}) {
  const featureFocus =
    (action.target.feature_focus as string | undefined) ?? "Thought leadership";
  return (
    <div className="space-y-5">
      <Field label="Duration">
        <PillGroup
          value={config.duration}
          options={[
            { value: "30s", label: "30s · teaser" },
            { value: "60s", label: "60s · social" },
            { value: "90s", label: "90s · demo" },
          ]}
          onChange={(v) =>
            onChange({ ...config, duration: v as AgentConfig["duration"] })
          }
        />
      </Field>

      <Field label="Voiceover">
        <PillGroup
          value={config.voiceover}
          options={[
            { value: "warm", label: "Warm" },
            { value: "sharp", label: "Sharp" },
            { value: "none", label: "No VO" },
          ]}
          onChange={(v) =>
            onChange({ ...config, voiceover: v as AgentConfig["voiceover"] })
          }
        />
      </Field>

      <Field label="Aspect ratio">
        <PillGroup
          value={config.aspect}
          options={[
            { value: "16:9", label: "16:9 — landscape" },
            { value: "9:16", label: "9:16 — vertical" },
            { value: "1:1", label: "1:1 — square" },
          ]}
          onChange={(v) =>
            onChange({ ...config, aspect: v as AgentConfig["aspect"] })
          }
        />
      </Field>

      <Field label="Feature focus" hint="Sourced from this action">
        <span className="block rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--ink-2)]/40 px-3 py-2 font-mono text-[12px] text-rose/85">
          {featureFocus}
        </span>
      </Field>
    </div>
  );
}

function WebsiteConfig({
  config,
  onChange,
  action,
}: {
  config: AgentConfig;
  onChange: (c: AgentConfig) => void;
  action: ActionOut;
}) {
  const allSchemas = [
    "Organization",
    "SoftwareApplication",
    "Product",
    "FAQPage",
    "BreadcrumbList",
    "Article",
  ];
  const domain = (action.target.domain as string | undefined) ?? "your site";

  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-md)] border border-[rgba(30,91,201,0.20)] bg-[rgba(30,91,201,0.04)] px-4 py-3">
        <div className="mb-1 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.22em] text-[var(--blue)]">
          <Sparkles className="size-3" />
          GitHub access required
        </div>
        <p className="text-[12px] leading-relaxed text-rose/85">
          The Website agent clones your repo, generates the structured-data
          edits, and opens a real PR. We need a personal access token with{" "}
          <code className="font-mono text-[11px]">repo</code> scope.
        </p>
      </div>

      <Field label="Repository URL" hint="https://github.com/owner/repo">
        <input
          type="text"
          value={config.repoUrl}
          onChange={(e) => onChange({ ...config, repoUrl: e.target.value })}
          placeholder="https://github.com/your-org/your-site"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="GitHub token"
        hint="Stored locally · used only for this run"
      >
        <input
          type="password"
          value={config.githubToken}
          onChange={(e) =>
            onChange({ ...config, githubToken: e.target.value })
          }
          placeholder="ghp_…"
          autoComplete="off"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="Live site URL"
        hint="The agent fetches this to read existing markup"
      >
        <input
          type="text"
          value={config.siteUrl}
          onChange={(e) => onChange({ ...config, siteUrl: e.target.value })}
          placeholder={`https://${domain}`}
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field label="Default branch">
        <input
          type="text"
          value={config.defaultBranch}
          onChange={(e) =>
            onChange({ ...config, defaultBranch: e.target.value })
          }
          placeholder="main"
          className="block w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-white/70 px-3 py-2 font-mono text-[12.5px] text-rose outline-none transition-colors focus:border-[var(--border-strong)]"
        />
      </Field>

      <Field
        label="Schemas hint"
        hint="The agent decides the final set after reading the live site"
      >
        <div className="flex flex-wrap gap-1.5">
          {allSchemas.map((s) => {
            const active = config.schemas.includes(s);
            return (
              <button
                key={s}
                type="button"
                onClick={() => {
                  const next = active
                    ? config.schemas.filter((x) => x !== s)
                    : [...config.schemas, s];
                  onChange({ ...config, schemas: next });
                }}
                className={cn(
                  "rounded-[var(--radius-pill)] px-2.5 py-1 font-mono text-[10.5px] uppercase tracking-[0.16em] transition-all",
                  active
                    ? "bg-[rgba(30,91,201,0.10)] text-[var(--blue)] ring-1 ring-inset ring-[rgba(30,91,201,0.25)]"
                    : "border border-[var(--border)] bg-white/70 text-muted-foreground hover:border-[var(--border-strong)]",
                )}
              >
                {s}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}

// ---- shared form primitives ----------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-muted-foreground">
          {label}
        </label>
        {hint && (
          <span className="text-[10.5px] text-muted-foreground/70">{hint}</span>
        )}
      </div>
      {children}
    </div>
  );
}

function PillGroup<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={cn(
              "rounded-[var(--radius-pill)] px-3 py-1.5 text-[11.5px] font-medium transition-all",
              active
                ? "bg-[var(--rose)] text-white"
                : "border border-[var(--border)] bg-white/70 text-[var(--lavender)] hover:border-[var(--border-strong)] hover:text-rose",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (c: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center justify-between gap-3 rounded-[var(--radius-md)] border px-3 py-2.5 text-left transition-colors",
        checked
          ? "border-[rgba(30,91,201,0.25)] bg-[rgba(30,91,201,0.06)]"
          : "border-[var(--border)] bg-white/70 hover:border-[var(--border-strong)]",
      )}
    >
      <div className="min-w-0">
        <div className="truncate text-[12.5px] font-medium text-rose">
          {label}
        </div>
        {hint && (
          <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {hint}
          </div>
        )}
      </div>
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-[var(--blue)]" : "bg-[var(--ink-2)]",
        )}
      >
        <span
          className={cn(
            "absolute h-3 w-3 rounded-full bg-white transition-transform",
            checked ? "translate-x-3.5" : "translate-x-0.5",
          )}
        />
      </span>
    </button>
  );
}
