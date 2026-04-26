import { useEffect, useState } from "react";
import { AnimatePresence } from "motion/react";

import Atmosphere from "@/components/Atmosphere";
import LiquidGlassFilter from "@/components/LiquidGlassFilter";
import EntryView from "@/views/EntryView";
import NoMatchView from "@/views/NoMatchView";
import ResolvingView from "@/views/ResolvingView";
import Workspace from "@/views/Workspace";
import { getActions, getCompany } from "@/lib/api";
import type { ActionOut, CompanyOut, ResolveError } from "@/lib/types";

type View = "entry" | "resolving" | "insights" | "no-match";

export default function Home() {
  const [view, setView] = useState<View>("entry");
  const [input, setInput] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [company, setCompany] = useState<CompanyOut | null>(null);
  const [actions, setActions] = useState<ActionOut[]>([]);
  const [error, setError] = useState<ResolveError | null>(null);

  useEffect(() => {
    if (!companyId) {
      setCompany(null);
      setActions([]);
      return;
    }
    let cancelled = false;
    Promise.all([getCompany(companyId), getActions(companyId)])
      .then(([c, a]) => {
        if (cancelled) return;
        setCompany(c);
        setActions(a);
      })
      .catch((e) => {
        if (cancelled) return;
        setError({
          code: "peec_unavailable",
          message: e instanceof Error ? e.message : "Failed to load company",
          tracked: [],
        });
        setView("no-match");
      });
    return () => {
      cancelled = true;
    };
  }, [companyId]);

  function submit() {
    const v = input.trim();
    if (!v) return;
    setError(null);
    setView("resolving");
  }

  function handleResolved(id: string) {
    setCompanyId(id);
    setView("insights");
  }

  function handleResolveError(err: ResolveError) {
    setError(err);
    setView("no-match");
  }

  function reset() {
    setView("entry");
    setCompanyId(null);
    setError(null);
  }

  function pickTracked(name: string) {
    setInput(name);
    setError(null);
    setView("resolving");
  }

  return (
    <>
      <LiquidGlassFilter />
      <Atmosphere />
      <main className="grain relative min-h-svh">
        <AnimatePresence mode="popLayout" initial={false}>
          {view === "entry" && (
            <EntryView
              key="entry"
              value={input}
              onChange={setInput}
              onSubmit={submit}
            />
          )}
          {view === "resolving" && (
            <ResolvingView
              key="resolving"
              input={input}
              onResolved={handleResolved}
              onError={handleResolveError}
            />
          )}
          {view === "insights" && company && (
            <Workspace
              key="insights"
              company={company}
              actions={actions}
              onReset={reset}
            />
          )}
          {view === "no-match" && error && (
            <NoMatchView
              key="no-match"
              error={error}
              attemptedInput={input}
              onPick={pickTracked}
              onBack={reset}
            />
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
