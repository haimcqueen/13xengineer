import { motion } from "motion/react";
import { ArrowLeft, ArrowUpRight } from "lucide-react";

import FelixMark from "@/components/FelixMark";
import GlassPanel from "@/components/GlassPanel";
import type { ResolveError } from "@/lib/types";

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  error: ResolveError;
  attemptedInput: string;
  onPick: (name: string) => void;
  onBack: () => void;
};

export default function NoMatchView({
  error,
  attemptedInput,
  onPick,
  onBack,
}: Props) {
  return (
    <motion.section
      key="no-match"
      className="relative z-10 flex min-h-svh w-full items-center justify-center px-6"
      initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
      animate={{
        opacity: 1,
        scale: 1,
        filter: "blur(0px)",
        transition: { duration: 0.6, ease, delay: 0.05 },
      }}
      exit={{
        opacity: 0,
        scale: 1.04,
        filter: "blur(6px)",
        transition: { duration: 0.4, ease: [0.4, 0, 0.4, 1] },
      }}
      style={{ transformOrigin: "50% 50%" }}
    >
      <div className="w-full max-w-[560px]">
        <GlassPanel className="p-9">
          <div className="mb-7 flex flex-col items-center text-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, ease, delay: 0.1 }}
              className="mb-5"
            >
              <FelixMark size={56} />
            </motion.div>
            <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
              No match yet
            </div>
            <h2
              className="mt-2 font-display text-rose"
              style={{
                fontSize: "clamp(1.6rem, 3vw, 2rem)",
                lineHeight: 1.15,
                letterSpacing: "-0.02em",
                fontWeight: 300,
                fontVariationSettings: '"opsz" 144, "SOFT" 30',
              }}
            >
              We don&rsquo;t track{" "}
              <em
                className="text-[var(--lavender)]"
                style={{
                  fontStyle: "italic",
                  fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
                }}
              >
                {attemptedInput || "that"}
              </em>{" "}
              yet.
            </h2>
            <p className="mt-3 max-w-[40ch] text-[13px] leading-relaxed text-muted-foreground">
              {error.message}
            </p>
          </div>

          {error.tracked.length > 0 && (
            <div>
              <div className="mb-3 text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                Try one of these
              </div>
              <ul className="flex flex-wrap gap-2">
                {error.tracked.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onClick={() => onPick(name)}
                      className="group inline-flex items-center gap-2 rounded-[var(--radius-pill)] border border-[var(--border-strong)] bg-[var(--ink-2)]/40 px-3.5 py-1.5 text-[12.5px] text-rose transition-colors hover:border-[rgba(30,91,201,0.28)] hover:bg-[rgba(30,91,201,0.06)]"
                    >
                      {name}
                      <ArrowUpRight className="size-3 text-muted-foreground transition-colors group-hover:text-[var(--blue)]" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-7 border-t border-[var(--border)] pt-5">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-rose"
            >
              <ArrowLeft className="size-3" />
              Try another input
            </button>
          </div>
        </GlassPanel>
      </div>
    </motion.section>
  );
}
