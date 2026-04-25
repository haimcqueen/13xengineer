import { type HTMLAttributes, forwardRef } from "react";
import { cn } from "@/lib/utils";

type Props = HTMLAttributes<HTMLDivElement> & {
  strong?: boolean;
};

const GlassPanel = forwardRef<HTMLDivElement, Props>(
  ({ className, strong, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "glass glass-elastic rounded-[var(--radius-lg)]",
        strong && "glass-strong",
        className,
      )}
      {...props}
    />
  ),
);
GlassPanel.displayName = "GlassPanel";

export default GlassPanel;
