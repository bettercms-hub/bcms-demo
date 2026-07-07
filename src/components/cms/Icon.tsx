import * as React from "react";
import type { LucideIcon, LucideProps } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Icon — the single icon convention for BetterCMS.
 *
 * Standardizes:
 *   • Stroke width: 1.75 (decorative), 2 (status checks/closes), 1.5 (large outline glyphs)
 *   • Sizes:        xs=12, sm=14, md=16, lg=20, xl=24, 2xl=32
 *   • Color:        currentColor (inherits text-* utilities)
 *
 * Always use <Icon icon={SomeLucide} /> instead of raw <SomeLucide /> when
 * you'd otherwise hand-set className="h-x w-y strokeWidth=...".
 *
 * For one-off sizing pass `className` and the size token is overridden.
 */

export type IconSize = "xs" | "sm" | "md" | "lg" | "xl" | "2xl";

const SIZE_CLASS: Record<IconSize, string> = {
  xs: "h-3 w-3",
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  xl: "h-6 w-6",
  "2xl": "h-8 w-8",
};

export interface IconProps extends Omit<LucideProps, "ref" | "size"> {
  icon: LucideIcon;
  size?: IconSize;
  /** Override stroke width. Default 1.75. */
  weight?: number;
}

export const Icon = React.forwardRef<SVGSVGElement, IconProps>(
  ({ icon: Component, size = "md", weight = 1.75, className, ...rest }, ref) => (
    <Component
      ref={ref}
      strokeWidth={weight}
      className={cn(SIZE_CLASS[size], "shrink-0", className)}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    />
  ),
);
Icon.displayName = "Icon";
