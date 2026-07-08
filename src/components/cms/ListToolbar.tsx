/**
 * ListToolbar — a search box plus one or more segmented filters, shared by
 * the Pages list and the Markdown endpoints list. Keeps both lists filtering
 * the same way so the two views feel like one surface.
 */
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterOption<T extends string> {
  id: T;
  label: string;
  count?: number;
}

export function ListToolbar({
  query,
  onQuery,
  placeholder = "Search",
  children,
}: {
  query: string;
  onQuery: (v: string) => void;
  placeholder?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-card pl-8 pr-8 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

/** A compact segmented control for a single-select filter. */
export function SegmentedFilter<T extends string>({
  options,
  value,
  onChange,
}: {
  options: FilterOption<T>[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
            value === o.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
          {o.count != null && (
            <span className={cn("tabular-nums", value === o.id ? "text-muted-foreground" : "text-muted-foreground/70")}>{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
