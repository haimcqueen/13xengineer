import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
  /** Cheap variant: no backdrop-filter. Use for long lists where many
      glass surfaces stack and the compositor stutters. */
  flat?: boolean;
};

const GlassPanel = forwardRef<HTMLDivElement, Props>(
  ({ className, strong, flat, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        flat ? "glass-flat glass-elastic" : "glass glass-elastic",
        "rounded-[var(--radius-lg)]",
        strong && "glass-strong",
        className,
      )}
      {...props}
    />
  ),
);
GlassPanel.displayName = "GlassPanel";

export default GlassPanel;
