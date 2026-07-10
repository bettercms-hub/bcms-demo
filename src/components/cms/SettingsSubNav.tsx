import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";

export interface SettingsNavItem {
  label: string;
  href: string;
  group?: string;
}

interface Props {
  items: SettingsNavItem[];
  title: string;
}

export function SettingsSubNav({ items, title }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const groups: { label: string; items: SettingsNavItem[] }[] = [];
  for (const it of items) {
    const g = it.group ?? "General";
    let bucket = groups.find((x) => x.label === g);
    if (!bucket) {
      bucket = { label: g, items: [] };
      groups.push(bucket);
    }
    bucket.items.push(it);
  }

  return (
    <>
      {/* Phones: the rail becomes a horizontal chip bar above the content. */}
      <nav
        aria-label={title}
        className="flex w-full shrink-0 items-center gap-1 overflow-x-auto border-b border-[color:var(--border-hairline)] bg-background px-3 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:hidden"
      >
        {items.map((it) => {
          const active = pathname === it.href || pathname.startsWith(it.href + "/");
          return (
            <Link
              key={it.href}
              to={it.href}
              className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                active
                  ? "bg-[color:var(--row-selected)] text-foreground"
                  : "text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
              }`}
            >
              {it.label}
            </Link>
          );
        })}
      </nav>

    <aside className="hidden w-[220px] shrink-0 border-r border-[color:var(--border-hairline)] bg-background md:block">
      <div className="px-4 pb-3 pt-5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        {title}
      </div>
      <nav className="px-2 pb-6">
        {groups.map((g, gi) => (
          <div key={g.label} className={gi > 0 ? "mt-6" : ""}>
            {groups.length > 1 && (
              <div className="px-2 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
                {g.label}
              </div>
            )}
            {g.items.map((it) => {
              const active = pathname === it.href || pathname.startsWith(it.href + "/");
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={`relative my-px flex h-8 items-center rounded-md px-3 text-[13px] transition-colors ${
                    active
                      ? "bg-[color:var(--row-selected)] text-foreground"
                      : "text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />
                  )}
                  <span>{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
    </>
  );
}

/** Page header with title, optional description and right-aligned action slot. */
export function PageHeader({
  title,
  description,
  action,
  eyebrow,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <header className="mb-10 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4 border-b border-[color:var(--border-hairline)] pb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            {eyebrow}
          </div>
        )}
        <h1 className="truncate text-[22px] font-semibold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Back-compat alias. Prefer PageHeader. */
export const SettingsHeader = PageHeader;

export function ComingSoonCard({ label = "Coming soon" }: { label?: string }) {
  return (
    <div className="rounded-md border border-dashed border-[color:var(--border-hairline)] bg-card px-6 py-8 text-center">
      <div className="text-[13px] font-medium text-foreground">{label}</div>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-muted-foreground">
        The structure is in place. Functionality is coming soon.
      </p>
    </div>
  );
}

/** Setting row: label/description left, control(s) far right. Used for toggles and small inputs. */
export function SettingsRow({
  label,
  description,
  children,
  stacked = false,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
  /** When true, control is rendered below the label (full width). */
  stacked?: boolean;
}) {
  if (stacked) {
    return (
      <div className="border-b border-[color:var(--border-hairline)] py-5 last:border-b-0">
        <div className="mb-2.5">
          <div className="text-[13px] font-medium text-foreground">{label}</div>
          {description && (
            <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</div>
          )}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-[color:var(--border-hairline)] py-4 last:border-b-0 md:py-5">
      <div className="min-w-0">
        <div className="text-[13px] font-medium text-foreground">{label}</div>
        {description && (
          <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{description}</div>
        )}
      </div>
      <div className="flex shrink-0 items-center justify-end">{children}</div>
    </div>
  );
}

/** Label-on-top variant for full-width inputs/textareas. */
export function FieldRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: ReactNode;
}) {
  return <SettingsRow label={label} description={description} stacked>{children}</SettingsRow>;
}

export function SettingsSection({
  title,
  description,
  action,
  children,
  flush = false,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: React.ReactNode;
  /** When true, drop internal padding so a table can sit edge-to-edge. */
  flush?: boolean;
}) {
  return (
    <section className="mb-6">
      <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)] bg-card">
        {/* Header lives INSIDE the card so the title lines up with the content below it. */}
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[color:var(--border-hairline)] px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="text-[13.5px] font-semibold tracking-tight text-foreground">{title}</h2>
            {description && (
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted-foreground">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className={flush ? "" : "px-5 py-4"}>{children}</div>
      </div>
    </section>
  );
}

/** Small status dot, e.g. for environment / SSL / connection status. */
export function StatusDot({ tone = "muted" }: { tone?: "success" | "warning" | "danger" | "info" | "muted" }) {
  const cls =
    tone === "success"
      ? "bg-emerald-500"
      : tone === "warning"
      ? "bg-amber-500"
      : tone === "danger"
      ? "bg-rose-500"
      : tone === "info"
      ? "bg-sky-500"
      : "bg-muted-foreground/50";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-md border border-dashed border-[color:var(--border-hairline)] bg-card px-6 py-10 text-center">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
