import { useEffect, useState } from "react";

import type { ActionOut, AgentKind, AgentResult } from "./types";

export type DeliverableStatus = "draft" | "scheduled" | "published";

export type Deliverable = {
  id: string;
  action_id: string;
  agent_kind: AgentKind;
  title: string;
  status: DeliverableStatus;
  created_at: string;
  scheduled_at: string | null;
  published_at: string | null;
  destination: string | null;
  payload: AgentResult;
};

const store = new Map<string, Deliverable>();
const subs = new Set<() => void>();

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function emit() {
  for (const s of subs) s();
}

export function subscribeDeliverables(fn: () => void): () => void {
  subs.add(fn);
  return () => {
    subs.delete(fn);
  };
}

export function listDeliverables(): Deliverable[] {
  return Array.from(store.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : -1,
  );
}

export function getDeliverableForAction(
  actionId: string,
): Deliverable | null {
  let latest: Deliverable | null = null;
  for (const d of store.values()) {
    if (d.action_id !== actionId) continue;
    if (!latest || d.created_at > latest.created_at) latest = d;
  }
  return latest;
}

export function getDeliverable(id: string): Deliverable | null {
  return store.get(id) ?? null;
}

/** Replace any existing deliverable for the same action (re-runs overwrite). */
export function createDeliverable(
  action: ActionOut,
  payload: AgentResult,
): Deliverable {
  if (!action.suggested_agent) {
    throw new Error("manual actions don't produce deliverables");
  }
  for (const d of store.values()) {
    if (d.action_id === action.id) {
      store.delete(d.id);
      break;
    }
  }
  const d: Deliverable = {
    id: rid("dlv"),
    action_id: action.id,
    agent_kind: action.suggested_agent,
    title: payload.title || action.title,
    status: "draft",
    created_at: new Date().toISOString(),
    scheduled_at: null,
    published_at: null,
    destination: null,
    payload,
  };
  store.set(d.id, d);
  emit();
  return d;
}

export function scheduleDeliverable(
  id: string,
  when: Date,
): Deliverable | null {
  const d = store.get(id);
  if (!d) return null;
  d.status = "scheduled";
  d.scheduled_at = when.toISOString();
  emit();
  return d;
}

export function publishDeliverable(
  id: string,
  destination?: string,
): Deliverable | null {
  const d = store.get(id);
  if (!d) return null;
  d.status = "published";
  d.published_at = new Date().toISOString();
  d.destination = destination ?? defaultDestination(d.agent_kind);
  emit();
  return d;
}

export function unscheduleDeliverable(id: string): Deliverable | null {
  const d = store.get(id);
  if (!d) return null;
  d.status = "draft";
  d.scheduled_at = null;
  emit();
  return d;
}

function defaultDestination(agent: AgentKind): string {
  switch (agent) {
    case "article":
      return "Blog";
    case "video":
      return "Social";
    case "code-pr":
      return "GitHub";
    default:
      return "Live";
  }
}

// ----- React hooks ---------------------------------------------------------

export function useDeliverables(): Deliverable[] {
  const [, force] = useState(0);
  useEffect(() => subscribeDeliverables(() => force((n) => n + 1)), []);
  return listDeliverables();
}

export function useDeliverableForAction(
  actionId: string,
): Deliverable | null {
  const [, force] = useState(0);
  useEffect(() => subscribeDeliverables(() => force((n) => n + 1)), []);
  return getDeliverableForAction(actionId);
}

// ----- Helpers -------------------------------------------------------------

export function statusLabel(d: Deliverable): string {
  switch (d.status) {
    case "draft":
      return "Drafted";
    case "scheduled":
      return d.scheduled_at
        ? `Scheduled · ${shortDate(d.scheduled_at)}`
        : "Scheduled";
    case "published":
      return d.destination ? `Published · ${d.destination}` : "Published";
  }
}

export function shortDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameWeek =
    Math.abs(d.getTime() - now.getTime()) < 7 * 24 * 60 * 60 * 1000;
  if (sameWeek) {
    return d.toLocaleString("en-US", {
      weekday: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
