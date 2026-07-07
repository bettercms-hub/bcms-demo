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
  const cls = `group relative my-px flex h-8 items-center gap-2.5 rounded-md ${
    nested ? "pl-7 pr-2" : "px-2.5"
  } text-[13px] transition-colors duration-150 ${
    active
      ? "bg-[color:var(--color-row-selected)] font-medium text-foreground"
      : disabled
        ? "cursor-default text-muted-foreground/50"
        : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
  }`;

  const content = (
    <>
      {Icon && (
        <Icon
          className={`h-4 w-4 shrink-0 ${
            active ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
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
