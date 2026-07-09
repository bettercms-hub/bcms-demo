import * as React from "react";
import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * PageShell — the universal page anatomy.
 *
 *   Breadcrumb
 *   Title           Primary actions
 *   Description
 *   ─── divider ───
 *   Sections…
 *   ─── footer ───
 *
 * Every route renders its body inside PageShell so the platform feels like one
 * operating system. Width snaps to the 1440px / 80px-margin grid.
 */

export type Crumb = {
  label: string;
  to?: string;
  params?: Record<string, string>;
};

export interface PageShellProps {
  breadcrumbs?: Crumb[];
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  /** Hide the divider between header and sections. */
  noDivider?: boolean;
  /** Outer max width — defaults to 1440px. Pass "full" to fill. */
  width?: "default" | "narrow" | "full";
  /** Optional footer slot (legal, support links, etc.) */
  footer?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

const WIDTH: Record<NonNullable<PageShellProps["width"]>, string> = {
  default: "max-w-[1440px] px-4 sm:px-6 lg:px-10 xl:px-14",
  narrow: "max-w-[960px] px-4 sm:px-6 lg:px-8",
  full: "max-w-none px-4 sm:px-6 lg:px-10",
};

export function PageShell({
  breadcrumbs,
  eyebrow,
  title,
  description,
  actions,
  noDivider = false,
  width = "default",
  footer,
  className,
  children,
}: PageShellProps) {
  return (
    <div className={cn("mx-auto w-full pb-16 pt-6 sm:pb-24 sm:pt-10", WIDTH[width], className)}>
      <header className="mb-6 sm:mb-8">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav
            aria-label="Breadcrumb"
            className="mb-3 flex items-center gap-1 text-[12px] text-muted-foreground"
          >
            {breadcrumbs.map((c, i) => {
              const isLast = i === breadcrumbs.length - 1;
              return (
                <React.Fragment key={`${c.label}-${i}`}>
                  {c.to && !isLast ? (
                    <Link
                      to={c.to}
                      params={c.params}
                      className="transition-colors hover:text-foreground"
                    >
                      {c.label}
                    </Link>
                  ) : (
                    <span className={cn(isLast && "text-foreground")}>
                      {c.label}
                    </span>
                  )}
                  {!isLast && (
                    <ChevronRight
                      className="h-3 w-3 text-muted-foreground/60"
                      aria-hidden
                    />
                  )}
                </React.Fragment>
              );
            })}
          </nav>
        )}

        <div className="flex flex-wrap items-end justify-between gap-3 sm:gap-6">
          <div className="min-w-0 flex-1">
            {eyebrow && (
              <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {eyebrow}
              </div>
            )}
            <h1 className="mt-2 text-[22px] font-semibold leading-[1.1] tracking-tight text-foreground sm:text-[26px]">
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-muted-foreground">
                {description}
              </p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          )}
        </div>
      </header>

      {!noDivider && (
        <div
          aria-hidden
          className="mb-6 h-px w-full bg-[color:var(--border-hairline)] sm:mb-10"
        />
      )}

      <div>{children}</div>

      {footer && (
        <footer className="mt-16 border-t border-[color:var(--border-hairline)] pt-6 text-[12px] text-muted-foreground">
          {footer}
        </footer>
      )}
    </div>
  );
}
