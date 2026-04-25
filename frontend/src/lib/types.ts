// TypeScript mirror of the backend Pydantic schemas.
// See docs/frontend-integration.md and backend/app/schemas.py.

export type BrandOut = {
  id: string;
  name: string;
  domains: string[];
  is_own: boolean;
};

export type TopicOut = {
  id: string;
  name: string;
};

export type CompanyOut = {
  id: string;
  name: string;
  own_domain: string | null;
  own_brand: BrandOut | null;
  topics: TopicOut[];
  prompt_count: number;
  last_refreshed_at: string;
};

export type ActionCategory = "owned_media" | "earned_media";
export type Opportunity = "low" | "medium" | "high";
export type AgentKind = "article" | "video" | "code-pr";

export type ActionOut = {
  id: string;
  category: ActionCategory;
  kind: string;
  title: string;
  rationale: string | null;
  opportunity: Opportunity;
  target: Record<string, unknown>;
  suggested_agent: AgentKind | null;
};

export type ProgressEvent = {
  t: string;
  type: string;
  data: Record<string, unknown>;
};

export type JobKind = "resolve_company" | "agent_run";
export type JobStatus = "pending" | "running" | "done" | "failed";

export type JobOut = {
  id: string;
  kind: JobKind;
  status: JobStatus;
  progress: ProgressEvent[];
  result: Record<string, unknown> | null;
  error: string | null;
  error_code: string | null;
};

export type ResolveError = {
  code: "no_match" | "peec_unavailable" | string;
  message: string;
  tracked: string[];
};

// Result shapes for the three agents (stubbed server-side for this iteration).
export type ArticleResult = {
  type: "article";
  title: string;
  markdown: string;
  word_count_estimate: number;
};

export type VideoResult = {
  type: "video";
  title: string;
  duration_seconds: number;
  video_url: string;
  thumbnail_url: string;
  storyboard: string[];
};

export type CodePrResult = {
  type: "code-pr";
  title: string;
  repo: string;
  branch: string;
  pr_url: string;
  files_changed: string[];
  diff_preview: string;
  schemas_added: string[];
};

export type AgentResult = ArticleResult | VideoResult | CodePrResult;
