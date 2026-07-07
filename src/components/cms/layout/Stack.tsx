import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Stack — vertical rhythm primitive bound to the spacing scale.
 * Use this instead of ad-hoc space-y-* utilities so spacing stays systematic.
 */
type Space = 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;

const GAP: Record<Space, string> = {
  1: "gap-1",
  2: "gap-2",
  3: "gap-3",
  4: "gap-4",
  5: "gap-5",
  6: "gap-6",
  8: "gap-8",
  10: "gap-10",
  12: "gap-12",
};

export interface StackProps extends React.HTMLAttributes<HTMLDivElement> {
  gap?: Space;
  direction?: "column" | "row";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around";
  wrap?: boolean;
}

const ALIGN: Record<NonNullable<StackProps["align"]>, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
};

const JUSTIFY: Record<NonNullable<StackProps["justify"]>, string> = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
  around: "justify-around",
};

export const Stack = React.forwardRef<HTMLDivElement, StackProps>(
  (
    {
      gap = 4,
      direction = "column",
      align,
      justify,
      wrap,
      className,
      ...rest
    },
    ref,
  ) => (
    <div
      ref={ref}
      className={cn(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        GAP[gap],
        align && ALIGN[align],
        justify && JUSTIFY[justify],
        wrap && "flex-wrap",
        className,
      )}
      {...rest}
    />
  ),
);
Stack.displayName = "Stack";
