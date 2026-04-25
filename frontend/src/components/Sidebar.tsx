import { motion } from "motion/react";
import {
  Activity,
  Building2,
  ChevronDown,
  Code,
  FileText,
  GitCompareArrows,
  Home,
  Layers,
  MessageSquare,
  Play,
  Sparkles,
  Star,
  Users,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import FelixMark from "@/components/FelixMark";
import type { ActionOut, CompanyOut } from "@/lib/types";
import { cn } from "@/lib/utils";

export type WorkspaceView =
  | "overview"
  | "brands"
  | "domains"
  | "markets"
  | "owned"
  | "earned"
  | "studio-articles"
  | "studio-comparisons"
  | "studio-outreach"
  | "studio-community"
  | "studio-code"
  | "studio-videos";

type Props = {
  company: CompanyOut;
  actions: ActionOut[];
  current: WorkspaceView;
  onChange: (v: WorkspaceView) => void;
  onReset: () => void;
};

type NavItemProps = {
  icon: LucideIcon;
  label: string;
  badge?: number;
  dot?: boolean;
  active?: boolean;
  onClick: () => void;
};

function NavItem({ icon: Icon, label, badge, dot, active, onClick }: NavItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex w-full items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] text-left text-[13px] transition-colors",
        active
          ? "bg-[var(--ink-2)]/85 text-rose"
          : "text-[var(--lavender)] hover:bg-[var(--ink-2)]/45 hover:text-rose",
      )}
    >
      <Icon className="size-3.5 shrink-0 opacity-90" strokeWidth={1.6} />
      <span className="flex-1 truncate tracking-[-0.005em]">{label}</span>
      {dot && (
        <span className="absolute right-9 size-1.5 rounded-full bg-[var(--blue)] shadow-[0_0_0_3px_rgba(30,91,201,0.12)]" />
      )}
      {typeof badge === "number" && (
        <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/85">
          {badge}
        </span>
      )}
    </button>
  );
}

function Section({
  label,
  beta,
  children,
}: {
  label: string;
  beta?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 px-2.5 text-[9.5px] font-medium uppercase tracking-[0.24em] text-muted-foreground/65">
        {label}
        {beta && (
          <span className="rounded-sm bg-[rgba(30,91,201,0.08)] px-1 py-px font-mono text-[8.5px] uppercase tracking-[0.14em] text-[var(--blue)]/80">
            beta
          </span>
        )}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

export default function Sidebar({
  company,
  actions,
  current,
  onChange,
  onReset,
}: Props) {
  const owned = actions.filter((a) => a.category === "owned_media");
  const earned = actions.filter((a) => a.category === "earned_media");
  const ownedHigh = owned.filter((a) => a.opportunity === "high").length;
  const earnedHigh = earned.filter((a) => a.opportunity === "high").length;

  // Studio buckets — group action kinds into the Studio sections
  const articles = actions.filter((a) =>
    ["article", "listicle"].includes(a.kind),
  );
  const comparisons = actions.filter((a) => a.kind === "comparison");
  const outreach = actions.filter((a) =>
    ["editorial", "listicle_inclusion"].includes(a.kind),
  );
  const community = actions.filter((a) =>
    ["subreddit", "youtube"].includes(a.kind),
  );
  const code = actions.filter((a) => a.kind === "code");
  const videos = actions.filter((a) => a.kind === "video");

  const brandCount = company.brand_stats?.length ?? 0;

  return (
    <aside className="flex h-svh w-[260px] flex-col border-r border-[var(--border)] bg-[var(--ink)]/55 backdrop-blur-xl">
      {/* Brand strip */}
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center justify-between gap-3 px-5 pb-3 pt-5"
      >
        <FelixMark size={26} withWordmark />
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset"
          className="grid size-7 place-items-center rounded-full text-muted-foreground/80 transition-colors hover:bg-[var(--ink-2)]/60 hover:text-rose"
        >
          <X className="size-3.5" strokeWidth={1.75} />
        </button>
      </motion.div>

      {/* Project pill */}
      <div className="px-3 pb-3">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white/55 px-2.5 py-2 text-[13px] text-rose transition-colors hover:border-[var(--border-strong)]"
        >
          <span className="grid size-5 shrink-0 place-items-center rounded-sm bg-[rgba(30,91,201,0.10)]">
            <Building2 className="size-3 text-[var(--blue)]" strokeWidth={1.75} />
          </span>
          <span className="flex-1 truncate text-left">
            {company.name.replace(/\s+project$/i, "")}
          </span>
          <ChevronDown className="size-3 text-muted-foreground" strokeWidth={1.75} />
        </button>
      </div>

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 pb-5">
        <Section label="General">
          <NavItem
            icon={Home}
            label="Overview"
            active={current === "overview"}
            onClick={() => onChange("overview")}
          />
        </Section>

        <Section label="Insights">
          <NavItem
            icon={Star}
            label="Brands"
            badge={brandCount}
            active={current === "brands"}
            onClick={() => onChange("brands")}
          />
          <NavItem
            icon={Layers}
            label="Domains"
            active={current === "domains"}
            onClick={() => onChange("domains")}
          />
          <NavItem
            icon={Activity}
            label="Markets"
            badge={company.market_stats?.length}
            active={current === "markets"}
            onClick={() => onChange("markets")}
          />
        </Section>

        <Section label="Actions" beta>
          <NavItem
            icon={Sparkles}
            label="Owned"
            badge={owned.length}
            dot={ownedHigh > 0}
            active={current === "owned"}
            onClick={() => onChange("owned")}
          />
          <NavItem
            icon={Sparkles}
            label="Earned"
            badge={earned.length}
            dot={earnedHigh > 0}
            active={current === "earned"}
            onClick={() => onChange("earned")}
          />
        </Section>

        <Section label="Studio">
          <NavItem
            icon={FileText}
            label="Articles"
            badge={articles.length}
            active={current === "studio-articles"}
            onClick={() => onChange("studio-articles")}
          />
          <NavItem
            icon={GitCompareArrows}
            label="Comparisons"
            badge={comparisons.length}
            active={current === "studio-comparisons"}
            onClick={() => onChange("studio-comparisons")}
          />
          <NavItem
            icon={MessageSquare}
            label="Outreach"
            badge={outreach.length}
            active={current === "studio-outreach"}
            onClick={() => onChange("studio-outreach")}
          />
          <NavItem
            icon={Users}
            label="Community"
            badge={community.length}
            active={current === "studio-community"}
            onClick={() => onChange("studio-community")}
          />
          <NavItem
            icon={Code}
            label="Code"
            badge={code.length}
            active={current === "studio-code"}
            onClick={() => onChange("studio-code")}
          />
          <NavItem
            icon={Play}
            label="Videos"
            badge={videos.length}
            active={current === "studio-videos"}
            onClick={() => onChange("studio-videos")}
          />
        </Section>
      </nav>

      <div className="border-t border-[var(--border)] px-5 py-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
        {company.prompt_count.toLocaleString()} prompts ·{" "}
        {company.total_chats?.toLocaleString() ?? 0} chats
      </div>
    </aside>
  );
}
