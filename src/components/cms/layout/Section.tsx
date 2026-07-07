import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Section — a labeled, bounded content region inside a page.
 *
 * Anatomy:
 *   [eyebrow]   [actions]
 *   Title       (right)
 *   Description
 *   ─── divider ───
 *   children
 *
 * Every page body is a stack of Sections. Nothing floats directly on canvas.
 */
export interface SectionProps extends Omit<React.HTMLAttributes<HTMLElement>, "title"> {
  eyebrow?: React.ReactNode;
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  /** Wrap children in a bounded Surface (level 3). Default: false (children sit directly). */
  surface?: boolean;
  /** Padding inside the surface when surface=true. */
  padded?: boolean;
  /** Gap between header and body. */
  bodyGap?: "sm" | "md" | "lg";
}

const GAP: Record<NonNullable<SectionProps["bodyGap"]>, string> = {
  sm: "mt-4",
  md: "mt-5",
  lg: "mt-6",
};

export const Section = React.forwardRef<HTMLElement, SectionProps>(
  (
    {
      eyebrow,
      title,
      description,
      actions,
      meta,
      surface = false,
      padded = true,
      bodyGap = "md",
      className,
      children,
      ...rest
    },
    ref,
  ) => {
    const hasHeader = eyebrow || title || description || actions || meta;
    return (
      <section ref={ref} className={cn("mb-12", className)} {...rest}>
        {hasHeader && (
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              {eyebrow && (
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                  {eyebrow}
                </div>
              )}
              {title && (
                <h2 className="mt-1 text-[16px] font-semibold tracking-tight text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-1 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {meta && (
                <span className="text-[12px] tabular-nums text-muted-foreground">
                  {meta}
                </span>
              )}
              {actions}
            </div>
          </header>
        )}

        {surface ? (
          <div
            className={cn(
              hasHeader && GAP[bodyGap],
              "rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--surface-3)]",
              padded && "p-6",
            )}
          >
            {children}
          </div>
        ) : (
          <div className={cn(hasHeader && GAP[bodyGap])}>{children}</div>
        )}
      </section>
    );
  },
);
Section.displayName = "Section";
