import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Low-level surface primitive.
 *
 * Surface ladder:
 *   1 → Canvas (app background)
 *   2 → Workspace panel
 *   3 → Section surface
 *   4 → Card / interactive (sits on a section)
 *
 * Depth comes from tonal contrast — never shadows.
 * Each step is ~2–3% brighter than its parent.
 */
type SurfaceLevel = 1 | 2 | 3 | 4;

const SURFACE_BG: Record<SurfaceLevel, string> = {
  1: "bg-[color:var(--surface-1)]",
  2: "bg-[color:var(--surface-2)]",
  3: "bg-[color:var(--surface-3)]",
  4: "bg-[color:var(--surface-4)]",
};

export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  level?: SurfaceLevel;
  bordered?: boolean;
  as?: React.ElementType;
}

export const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  ({ level = 3, bordered = true, as: Tag = "div", className, ...rest }, ref) => {
    const Element = Tag;
    return (
      <Element
        ref={ref}
        className={cn(
          SURFACE_BG[level],
          bordered && "border border-[color:var(--border-hairline)]",
          "rounded-xl",
          className,
        )}
        {...rest}
      />
    );
  },
);
Surface.displayName = "Surface";
