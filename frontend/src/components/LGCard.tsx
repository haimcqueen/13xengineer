import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  /** Border radius in px. Default 20. */
  cornerRadius?: number;
  /** Click handler — turns the card into a button with hover lift. */
  onClick?: () => void;
  /** Tag override. Default `div` (or `button` if `onClick`). */
  as?: "div" | "section" | "article";
  className?: string;
  style?: CSSProperties;
};

/**
 * iOS-26 liquid glass card — CSS-only, 4-layer architecture.
 *
 * - effect: backdrop blur + saturate + brightness + SVG displacement filter (Chrome)
 * - tint: solid white-ish fill so glass is visible on any background
 * - shine: 4 inset shadows that read as a convex lit bezel
 * - content: your children, above all material layers
 *
 * Sized by its content. Plays nicely with grid / flex parents (unlike
 * `liquid-glass-react` which forces center-anchored absolute positioning).
 */
export default function LGCard({
  children,
  cornerRadius = 20,
  onClick,
  as = "div",
  className,
  style,
}: Props) {
  const radiusStyle: CSSProperties = { borderRadius: cornerRadius };

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn("lg-card lg-card-shadow lg-clickable", className)}
        style={{ ...radiusStyle, ...style }}
      >
        <span className="lg-effect" style={radiusStyle} aria-hidden />
        <span className="lg-tint" style={radiusStyle} aria-hidden />
        <span className="lg-shine" style={radiusStyle} aria-hidden />
        <span className="lg-content block" style={radiusStyle}>
          {children}
        </span>
      </button>
    );
  }

  const content = (
    <>
      <span className="lg-effect" style={radiusStyle} aria-hidden />
      <span className="lg-tint" style={radiusStyle} aria-hidden />
      <span className="lg-shine" style={radiusStyle} aria-hidden />
      <span className="lg-content block" style={radiusStyle}>
        {children}
      </span>
    </>
  );

  const sharedProps = {
    className: cn("lg-card lg-card-shadow", className),
    style: { ...radiusStyle, ...style },
  };

  if (as === "section") return <section {...sharedProps}>{content}</section>;
  if (as === "article") return <article {...sharedProps}>{content}</article>;
  return <div {...sharedProps}>{content}</div>;
}
