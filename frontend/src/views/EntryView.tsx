import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight } from "lucide-react";

import FelixMark from "@/components/FelixMark";

const PLACEHOLDERS = [
  "acme.com",
  "stripe.com",
  "linear.app",
  "vercel.com",
  "anthropic.com",
];

const ease = [0.22, 1, 0.36, 1] as const;

type Props = {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
};

export default function EntryView({ value, onChange, onSubmit }: Props) {
  const ready = value.trim().length > 0;
  const [phIdx, setPhIdx] = useState(0);

  useEffect(() => {
    if (value) return;
    const id = window.setInterval(
      () => setPhIdx((i) => (i + 1) % PLACEHOLDERS.length),
      3500,
    );
    return () => window.clearInterval(id);
  }, [value]);

  return (
    <motion.section
      key="entry"
      className="relative z-10 flex min-h-svh w-full flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.7, ease } }}
      exit={{
        opacity: 0,
        scale: 1.08,
        filter: "blur(8px)",
        transition: { duration: 0.55, ease: [0.4, 0, 0.4, 1] },
      }}
      style={{ transformOrigin: "50% 50%" }}
    >
      {/* Brand — top-left of viewport */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease, delay: 0.15 }}
        className="absolute left-7 top-7"
      >
        <FelixMark size={40} withWordmark />
      </motion.div>

      {/* Centered content */}
      <div className="w-full max-w-[640px] text-center">
        <h1
          className="mb-14 font-display text-rose"
          style={{
            fontSize: "clamp(2.4rem, 5.2vw, 3.75rem)",
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            fontWeight: 300,
            fontVariationSettings: '"opsz" 144, "SOFT" 30',
          }}
        >
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12, duration: 0.7, ease }}
            className="block"
          >
            See how AI sees
          </motion.span>
          <motion.em
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: 0.46, duration: 0.95, ease }}
            className="block text-[var(--lavender)]"
            style={{
              fontStyle: "italic",
              fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 1',
            }}
          >
            your brand.
          </motion.em>
        </h1>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.7, ease }}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
          className="w-full"
        >
          <div className="glass glass-focus-ring mx-auto flex w-full max-w-[480px] items-center gap-2 rounded-[var(--radius-pill)] p-1.5 pl-6">
            <div className="relative min-w-0 flex-1">
              <input
                type="text"
                autoFocus
                value={value}
                onChange={(e) => onChange(e.target.value)}
                spellCheck={false}
                aria-label="Brand or domain"
                className="w-full bg-transparent py-3 text-[15px] tracking-[-0.005em] text-rose focus:outline-none"
              />
              {!value && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0 flex items-center text-[15px] tracking-[-0.005em] text-[var(--lavender)]/55"
                >
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={phIdx}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      transition={{ duration: 0.45, ease }}
                    >
                      {PLACEHOLDERS[phIdx]}
                    </motion.span>
                  </AnimatePresence>
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!ready}
              aria-label="Analyze"
              className="group glass grid size-10 shrink-0 place-items-center rounded-full transition-opacity duration-300 disabled:opacity-50"
            >
              <ArrowRight
                className={`size-4 transition-all duration-300 ${
                  ready
                    ? "text-[var(--blue)] group-hover:translate-x-0.5"
                    : "text-[var(--lavender)]"
                }`}
              />
            </button>
          </div>
        </motion.form>
      </div>
    </motion.section>
  );
}
