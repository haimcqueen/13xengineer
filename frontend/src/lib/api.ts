import type {
  ActionOut,
  CompanyOut,
  JobOut,
  ProgressEvent,
  ResolveError,
} from "./types";

const API_BASE = import.meta.env.VITE_API_BASE ?? ""

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    throw new Error(`API ${path} ${res.status}: ${await res.text()}`)
  }
  return res.json() as Promise<T>
}

// ---- Resolve flow ---------------------------------------------------------

type ResolveResponse = { job_id: string; company_id: string | null };

export type ResolveStreamHandlers = {
  onEvent: (e: ProgressEvent) => void;
  onDone: (companyId: string) => void;
  onError: (err: ResolveError) => void;
};

/**
 * Real backend resolve. POSTs to /api/companies/resolve and polls the job
 * until it terminates. Forwards progress events as they appear in the job row.
 *
 * Returns a cancel function that stops polling.
 */
export function startResolve(
  input: string,
  handlers: ResolveStreamHandlers,
): () => void {
  let cancelled = false;
  const cancel = () => {
    cancelled = true;
  };

  (async () => {
    let resp: ResolveResponse;
    try {
      resp = await api<ResolveResponse>("/api/companies/resolve", {
        method: "POST",
        body: JSON.stringify({ input }),
      });
    } catch (e) {
      if (cancelled) return;
      handlers.onError({
        code: "peec_unavailable",
        message: e instanceof Error ? e.message : "Resolve failed",
        tracked: [],
      });
      return;
    }

    const { job_id } = resp;
    let sentEvents = 0;

    while (!cancelled) {
      let job: JobOut;
      try {
        job = await api<JobOut>(`/api/jobs/${job_id}`);
      } catch (e) {
        if (cancelled) return;
        handlers.onError({
          code: "peec_unavailable",
          message: e instanceof Error ? e.message : "Polling failed",
          tracked: [],
        });
        return;
      }

      const newEvents = job.progress.slice(sentEvents);
      for (const evt of newEvents) {
        handlers.onEvent(evt);
      }
      sentEvents = job.progress.length;

      if (job.status === "done") {
        const companyId =
          (job.result as { company_id?: string } | null)?.company_id ?? null;
        if (companyId) {
          handlers.onDone(companyId);
        } else {
          handlers.onError({
            code: "peec_unavailable",
            message: "Job finished without company_id",
            tracked: [],
          });
        }
        return;
      }

      if (job.status === "failed") {
        // Look for a no_match error event with tracked names
        const errEvt = job.progress.find((e) => e.type === "error");
        const data = (errEvt?.data ?? {}) as {
          code?: string;
          tracked_names?: string[];
        };
        handlers.onError({
          code: (job.error_code as ResolveError["code"]) ?? data.code ?? "peec_unavailable",
          message: job.error ?? "Resolve failed",
          tracked: data.tracked_names ?? [],
        });
        return;
      }

      await sleep(400);
    }
  })();

  return cancel;
}

// ---- Reads ----------------------------------------------------------------

export function getCompany(companyId: string): Promise<CompanyOut> {
  return api<CompanyOut>(`/api/companies/${companyId}`);
}

export function getActions(companyId: string): Promise<ActionOut[]> {
  return api<ActionOut[]>(`/api/companies/${companyId}/actions`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
