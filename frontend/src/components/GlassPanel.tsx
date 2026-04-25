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
        "glass rounded-[var(--radius-lg)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-[2px]",
        strong && "glass-strong",
        className,
      )}
      {...props}
    />
  ),
);
GlassPanel.displayName = "GlassPanel";

export default GlassPanel;
