import { type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { type LucideIcon } from "lucide-react";

interface Props {
  label: string;
  icon?: LucideIcon;
  initial?: string;
  to?: string;
  params?: Record<string, string>;
  active?: boolean;
  nested?: boolean;
  children: ReactNode;
}

export function SidebarItemGroup({
  label,
  icon: Icon,
  initial,
  to,
  params,
  active,
  nested,
  children,
}: Props) {
  const rowCls = `group relative my-px flex h-8 items-center gap-2.5 rounded-md ${
    nested ? "pl-7 pr-1.5" : "px-2.5"
  } text-[13px] transition-colors duration-150 ${
    active
      ? "bg-[color:var(--color-row-selected)] font-medium text-foreground"
      : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
  }`;

  const Icons = Icon ? (
    <Icon
      className={`h-4 w-4 shrink-0 ${
        active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
      }`}
      strokeWidth={1.75}
    />
  ) : initial ? (
    <span className="grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border border-border bg-[color:var(--s3)] text-[9.5px] font-semibold uppercase text-foreground/80">
      {initial}
    </span>
  ) : null;

  const RowInner = (
    <>
      {active && (
        <span className="pointer-events-none absolute inset-y-1.5 left-0 w-[2px] rounded-r-full bg-primary" />
      )}
      {Icons}
      <span className="flex-1 truncate">{label}</span>
    </>
  );

  return (
    <li>
      {to ? (
        <Link
          to={to as "/w/$workspace"}
          params={params as { workspace: string }}
          preload="intent"
          className={rowCls}
        >
          {RowInner}
        </Link>
      ) : (
        <div className={rowCls}>{RowInner}</div>
      )}
      <ul className="flex flex-col gap-px py-0.5">{children}</ul>
    </li>
  );
}
