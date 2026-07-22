import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon?: LucideIcon;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  active?: boolean;
  disabled?: boolean;
  nested?: boolean;
  initial?: string;
  trailing?: React.ReactNode;
}

/**
 * V2 workspace nav row — 36px, radius 6, 14px medium. The active row is the
 * only "card" in the sidebar: white surface, hairline border, the layered
 * nav-card micro shadow, plus the 2px burgundy indicator bar hanging at the
 * sidebar's left edge (the list carries px-3, so -left-3 lands on the edge
 * of the scroll container, safely inside its clip box).
 */
export function SidebarItem({
  label,
  icon: Icon,
  to,
  params,
  search,
  active,
  disabled,
  nested,
  initial,
  trailing,
}: Props) {
  const cls = `group relative flex h-9 items-center gap-2 rounded-md border ${
    nested ? "pl-7 pr-2.5" : "px-2.5"
  } text-sm font-medium tracking-[-0.01em] transition-colors duration-150 ${
    active
      ? "border-border bg-card text-foreground shadow-[var(--shadow-nav-card)]"
      : disabled
        ? "cursor-default border-transparent text-muted-foreground/50"
        : "border-transparent text-foreground-secondary hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
  }`;

  const content = (
    <>
      {active && (
        <span
          aria-hidden
          className="absolute -left-3 bottom-2 top-2 w-0.5 rounded-full bg-[color:var(--nav-active-indicator)]"
        />
      )}
      {Icon && (
        <Icon
          className={`h-[18px] w-[18px] shrink-0 ${
            active ? "text-foreground-secondary" : "text-muted-foreground group-hover:text-foreground-secondary"
          }`}
          strokeWidth={1.75}
        />
      )}

      {initial && !Icon && (
        <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border border-border bg-[color:var(--s3)] text-[9.5px] font-semibold uppercase text-foreground/80">
          {initial}
        </span>
      )}
      <span className="flex-1 truncate">{label}</span>
      {trailing}
    </>
  );

  if (disabled) {
    return (
      <li>
        <div className={cls} aria-disabled="true" title="Coming soon">
          {content}
        </div>
      </li>
    );
  }

  return (
    <li>
      <Link
        to={to as "/w/$workspace"}
        params={params as { workspace: string }}
        search={search as never}
        preload="intent"
        className={cls}
      >
        {content}
      </Link>
    </li>
  );
}
