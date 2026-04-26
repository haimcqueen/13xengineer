import { Code, FileText, MessageSquare, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { AgentKind } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  agent: AgentKind | null;
  size?: "sm" | "md";
  className?: string;
};

type Identity = {
  icon: LucideIcon;
  label: string;
  bg: string;
  fg: string;
  ring?: string;
};

const IDENTITY: Record<string, Identity> = {
  article: {
    icon: FileText,
    label: "Tolkien",
    bg: "rgba(199, 122, 122, 0.14)",
    fg: "#A85B5B",
  },
  video: {
    icon: Play,
    label: "Nolan",
    bg: "rgba(87, 79, 97, 0.16)",
    fg: "#574F61",
  },
  "code-pr": {
    icon: Code,
    label: "Michelangelo",
    bg: "rgba(30, 91, 201, 0.10)",
    fg: "#1E5BC9",
  },
  manual: {
    icon: MessageSquare,
    label: "Manual brief",
    bg: "transparent",
    fg: "var(--lavender)",
    ring: "var(--border-strong)",
  },
};

export default function AgentBadge({ agent, size = "sm", className }: Props) {
  const id = IDENTITY[agent ?? "manual"];
  const Icon = id.icon;
  const md = size === "md";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] font-medium uppercase tracking-[0.16em]",
        md ? "px-3 py-1.5 text-[11px]" : "px-2 py-1 text-[10px]",
        className,
      )}
      style={{
        backgroundColor: id.bg,
        color: id.fg,
        ...(id.ring ? { boxShadow: `inset 0 0 0 1px ${id.ring}` } : {}),
      }}
    >
      <Icon className={cn(md ? "size-3.5" : "size-3")} strokeWidth={2} />
      {id.label}
    </span>
  );
}
