import { useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";

import Atmosphere from "@/components/Atmosphere";
import LiquidGlassFilter from "@/components/LiquidGlassFilter";
import EntryView from "@/views/EntryView";
import NoMatchView from "@/views/NoMatchView";
import ResolvingView from "@/views/ResolvingView";
import Workspace from "@/views/Workspace";
import { getActions, getCompany } from "@/lib/mockBackend";
import type { ResolveError } from "@/lib/types";

type View = "entry" | "resolving" | "insights" | "no-match";

export default function Home() {
  const [view, setView] = useState<View>("entry");
  const [input, setInput] = useState("");
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [error, setError] = useState<ResolveError | null>(null);

  const company = useMemo(
    () => (companyId ? getCompany(companyId) : null),
    [companyId],
  );
  const actions = useMemo(
    () => (companyId ? getActions(companyId) : []),
    [companyId],
  );

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
