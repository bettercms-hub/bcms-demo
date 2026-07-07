import type { ReactNode } from "react";

interface Props {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  accent?: boolean;
  icon?: ReactNode;
  trend?: { value: string; positive?: boolean };
}

export function MetricTile({ label, value, sublabel, icon, trend }: Props) {
  const trendTone = !trend
    ? ""
    : trend.positive
      ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
      : "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300";
  return (
    <div className="bg-card px-6 py-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </span>
        {icon && <span className="text-muted-foreground/60">{icon}</span>}
      </div>
      <div className="mt-3 text-[26px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-foreground">
        {value}
      </div>
      {(sublabel || trend) && (
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          {trend && (
            <span className={`inline-flex h-[20px] items-center gap-0.5 rounded-full px-1.5 text-[11px] font-medium tabular-nums ${trendTone}`}>
              {trend.positive ? "▲" : "▼"} {trend.value}
            </span>
          )}
          {sublabel && <span className="truncate">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

export function MetricGrid({ children, cols = 4 }: { children: ReactNode; cols?: 2 | 3 | 4 }) {
  const colClass = cols === 2 ? "md:grid-cols-2" : cols === 3 ? "md:grid-cols-3" : "md:grid-cols-4";
  return (
    <div className={`grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-border bg-border ${colClass}`}>
      {children}
    </div>
  );
}
