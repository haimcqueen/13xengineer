import type { ActionOut, AgentKind } from "@/lib/types";

type Identity = {
  bg: string;
  fg: string;
};

const ACCENTS: Record<string, Identity> = {
  article: { bg: "rgba(199, 122, 122, 0.14)", fg: "#A85B5B" },
  video: { bg: "rgba(87, 79, 97, 0.16)", fg: "#574F61" },
  "code-pr": { bg: "rgba(30, 91, 201, 0.10)", fg: "#1E5BC9" },
  manual: { bg: "transparent", fg: "var(--lavender)" },
};

export function agentAccent(agent: AgentKind | null): Identity {
  return ACCENTS[agent ?? "manual"];
}

export function agentVerbs(agent: AgentKind | null): {
  idle: string;
  done: string;
} {
  switch (agent) {
    case "article":
      return { idle: "Draft article", done: "View article" };
    case "video":
      return { idle: "Generate video", done: "Watch video" };
    case "code-pr":
      return { idle: "Open pull request", done: "View pull request" };
    default:
      return { idle: "Open brief", done: "View brief" };
  }
}

/** Like agentVerbs but special-cases custom action subkinds
 * (e.g. `site_blog` actions publish to the user's site rather than
 * just drafting markdown). */
export function actionVerbs(action: ActionOut): {
  idle: string;
  done: string;
} {
  if (action.kind === "site_blog") {
    return { idle: "Publish to site", done: "View live post" };
  }
  return agentVerbs(action.suggested_agent);
}
