import * as React from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Columns3,
  Filter,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/cms/EmptyState";
import { Icon } from "@/components/cms/Icon";

/**
 * Generalized DataTable — the single table component for BetterCMS.
 *
 * Features:
 *   • Sticky header
 *   • Sort (click header)
 *   • Search (free-text across configured accessors)
 *   • Filter facets (chip dropdowns)
 *   • Density switch (compact / cozy / comfortable)
 *   • Column visibility
 *   • Bulk selection + bulk action bar
 *   • Pagination
 *   • Keyboard navigation:
 *        ↑ / ↓        — move focused row
 *        Space        — toggle selection on focused row
 *        ⌘/Ctrl + A   — select page
 *        Esc          — clear selection
 *        Enter        — invoke onRowActivate (if provided)
 *   • Empty / loading states
 */

export type SortDir = "asc" | "desc";
export type Density = "compact" | "cozy" | "comfortable";

export interface DataTableColumn<T> {
  key: string;
  header: React.ReactNode;
  cell: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number;
  searchAccessor?: (row: T) => string;
  align?: "left" | "right";
  width?: string;
  /** Hide-able via the column visibility menu. */
  hideable?: boolean;
  /** Default visibility. */
  defaultHidden?: boolean;
  /** Pin to left or right. */
  pin?: "left" | "right";
  headerClassName?: string;
  cellClassName?: string;
}

export interface FilterFacet<T> {
  key: string;
  label: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  options: Array<{ value: string; label: React.ReactNode }>;
  predicate: (row: T, value: string) => boolean;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;

  /** Top-level title slot rendered to the right of the search. */
  toolbarStart?: React.ReactNode;
  toolbarEnd?: React.ReactNode;

  /** Free-text search. Disabled when no column has a searchAccessor. */
  searchPlaceholder?: string;
  enableSearch?: boolean;

  /** Filter facets. */
  filters?: FilterFacet<T>[];

  /** Selection. */
  selectable?: boolean;
  bulkActions?: (selectedIds: string[], clear: () => void) => React.ReactNode;

  /** Sort. */
  initialSort?: { key: string; dir: SortDir };

  /** Pagination. 0 disables. */
  pageSize?: number;

  /** Density. */
  defaultDensity?: Density;

  /** Sticky-header max height. */
  maxHeight?: string;

  /** Loading / empty / row click. */
  loading?: boolean;
  skeletonRows?: number;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;

  rowClassName?: (row: T) => string;
  /** Invoked when user presses Enter on a focused row, or double-clicks a row. */
  onRowActivate?: (row: T) => void;
  /** Right-click context menu. */
  rowContextMenu?: (row: T) => React.ReactNode;
}

const DENSITY_ROW: Record<Density, string> = {
  compact: "py-1.5",
  cozy: "py-2.5",
  comfortable: "py-3.5",
};

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  toolbarStart,
  toolbarEnd,
  searchPlaceholder = "Search…",
  enableSearch = true,
  filters = [],
  selectable = false,
  bulkActions,
  initialSort,
  pageSize = 25,
  defaultDensity = "cozy",
  maxHeight = "calc(100vh - 320px)",
  loading = false,
  skeletonRows = 6,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  rowClassName,
  onRowActivate,
  rowContextMenu,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ key: string; dir: SortDir } | null>(
    initialSort ?? null,
  );
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(0);
  const [query, setQuery] = React.useState("");
  const [activeFilters, setActiveFilters] = React.useState<Record<string, string>>({});
  const [density, setDensity] = React.useState<Density>(defaultDensity);
  const [hidden, setHidden] = React.useState<Set<string>>(
    () => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)),
  );
  const [focusIdx, setFocusIdx] = React.useState<number>(-1);

  const visibleColumns = React.useMemo(
    () => columns.filter((c) => !hidden.has(c.key)),
    [columns, hidden],
  );

  const searchableCols = React.useMemo(
    () => columns.filter((c) => c.searchAccessor),
    [columns],
  );

  /* ── filter + search ── */
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (q && searchableCols.length > 0) {
        const matches = searchableCols.some((c) =>
          c.searchAccessor!(row).toLowerCase().includes(q),
        );
        if (!matches) return false;
      }
      for (const facet of filters) {
        const val = activeFilters[facet.key];
        if (val && !facet.predicate(row, val)) return false;
      }
      return true;
    });
  }, [rows, query, activeFilters, filters, searchableCols]);

  /* ── sort ── */
  const sorted = React.useMemo(() => {
    if (!sort) return filtered;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return filtered;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filtered, sort, columns]);

  /* ── paginate ── */
  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const safePage = Math.min(page, totalPages - 1);
  const paged = React.useMemo(() => {
    if (!pageSize) return sorted;
    return sorted.slice(safePage * pageSize, safePage * pageSize + pageSize);
  }, [sorted, safePage, pageSize]);

  React.useEffect(() => {
    setPage(0);
  }, [query, activeFilters]);

  /* ── selection ── */
  const pageRowIds = paged.map(rowKey);
  const allChecked =
    pageRowIds.length > 0 && pageRowIds.every((id) => selected.includes(id));
  const someChecked =
    !allChecked && pageRowIds.some((id) => selected.includes(id));

  const togglePageAll = (check: boolean) => {
    setSelected((prev) => {
      const set = new Set(prev);
      if (check) pageRowIds.forEach((id) => set.add(id));
      else pageRowIds.forEach((id) => set.delete(id));
      return [...set];
    });
  };
  const toggleOne = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const toggleSort = (key: string) => {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortAccessor) return;
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  /* ── keyboard nav ── */
  const onTableKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (paged.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusIdx((i) => Math.min(paged.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusIdx((i) => Math.max(0, i - 1));
    } else if (e.key === " " && focusIdx >= 0 && selectable) {
      e.preventDefault();
      toggleOne(rowKey(paged[focusIdx]));
    } else if (e.key === "Enter" && focusIdx >= 0 && onRowActivate) {
      e.preventDefault();
      onRowActivate(paged[focusIdx]);
    } else if (
      (e.metaKey || e.ctrlKey) &&
      e.key.toLowerCase() === "a" &&
      selectable
    ) {
      e.preventDefault();
      togglePageAll(!allChecked);
    } else if (e.key === "Escape") {
      setSelected([]);
      setFocusIdx(-1);
    }
  };

  const hasToolbar =
    enableSearch || filters.length > 0 || toolbarStart || toolbarEnd ||
    columns.some((c) => c.hideable);

  const clearAll = () => setSelected([]);
  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length;

  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--surface-3)]">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--border-hairline)] px-3 py-2.5">
          {enableSearch && searchableCols.length > 0 && (
            <div className="flex h-8 min-w-[220px] flex-1 items-center gap-2 rounded-md bg-[color:var(--surface-2)] px-2.5 ring-1 ring-transparent transition-shadow focus-within:ring-[color:var(--ring)]">
              <Icon icon={Search} size="sm" className="text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-full flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon icon={X} size="sm" />
                </button>
              )}
            </div>
          )}

          {filters.map((facet) => {
            const val = activeFilters[facet.key];
            const active = !!val;
            const selectedOption = facet.options.find((o) => o.value === val);
            return (
              <DropdownMenu key={facet.key}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 text-[12.5px]",
                      active && "border-primary/40 text-foreground",
                    )}
                  >
                    {facet.icon ? (
                      <Icon icon={facet.icon as never} size="sm" />
                    ) : (
                      <Icon icon={Filter} size="sm" />
                    )}
                    {facet.label}
                    {active && (
                      <span className="ml-0.5 rounded-sm bg-primary/15 px-1 text-[11px] text-primary">
                        {selectedOption?.label}
                      </span>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-[180px]">
                  <DropdownMenuItem
                    onSelect={() =>
                      setActiveFilters((s) => {
                        const next = { ...s };
                        delete next[facet.key];
                        return next;
                      })
                    }
                  >
                    All
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {facet.options.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onSelect={() =>
                        setActiveFilters((s) => ({ ...s, [facet.key]: opt.value }))
                      }
                    >
                      {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            );
          })}

          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={() => setActiveFilters({})}
              className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
            >
              Reset
            </button>
          )}

          <div className="ml-auto flex items-center gap-1.5">
            {toolbarStart}

            {/* density */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Density">
                  <Icon icon={SlidersHorizontal} size="sm" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                  Density
                </DropdownMenuLabel>
                {(["compact", "cozy", "comfortable"] as Density[]).map((d) => (
                  <DropdownMenuCheckboxItem
                    key={d}
                    checked={density === d}
                    onCheckedChange={() => setDensity(d)}
                  >
                    <span className="capitalize">{d}</span>
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* column visibility */}
            {columns.some((c) => c.hideable) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Columns">
                    <Icon icon={Columns3} size="sm" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Columns
                  </DropdownMenuLabel>
                  {columns
                    .filter((c) => c.hideable)
                    .map((c) => (
                      <DropdownMenuCheckboxItem
                        key={c.key}
                        checked={!hidden.has(c.key)}
                        onCheckedChange={(checked) => {
                          setHidden((prev) => {
                            const next = new Set(prev);
                            if (checked) next.delete(c.key);
                            else next.add(c.key);
                            return next;
                          });
                        }}
                      >
                        {typeof c.header === "string" ? c.header : c.key}
                      </DropdownMenuCheckboxItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {toolbarEnd}
          </div>
        </div>
      )}

      {selectable && selected.length > 0 && (
        <div className="flex animate-in fade-in slide-in-from-top-1 items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] px-3 py-2 text-[12.5px] duration-200">
          <span className="font-medium text-foreground">
            {selected.length} selected
          </span>
          <div className="flex items-center gap-1.5">
            {bulkActions?.(selected, clearAll)}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[12px]"
              onClick={clearAll}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div
        className="relative overflow-auto outline-none"
        style={{ maxHeight }}
        tabIndex={0}
        onKeyDown={onTableKeyDown}
        role="grid"
        aria-rowcount={paged.length}
      >
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-[color:var(--surface-3)] text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground shadow-[inset_0_-1px_0_var(--border-hairline)]">
            <tr>
              {selectable && (
                <th className="w-10 px-3 py-2.5">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(c) => togglePageAll(Boolean(c))}
                    aria-label="Select page"
                  />
                </th>
              )}
              {visibleColumns.map((c) => {
                const isSorted = sort?.key === c.key;
                const sortable = !!c.sortAccessor;
                return (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={cn(
                      "px-3 py-2.5",
                      c.align === "right" ? "text-right" : "text-left",
                      c.headerClassName,
                    )}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={cn(
                          "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                          isSorted && "text-foreground",
                        )}
                      >
                        {c.header}
                        {isSorted ? (
                          sort!.dir === "asc" ? (
                            <Icon icon={ArrowUp} size="xs" />
                          ) : (
                            <Icon icon={ArrowDown} size="xs" />
                          )
                        ) : (
                          <Icon icon={ChevronsUpDown} size="xs" className="opacity-40" />
                        )}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: skeletonRows }).map((_, i) => (
                <tr
                  key={`s-${i}`}
                  className="border-b border-[color:var(--border-hairline)] last:border-0"
                >
                  {selectable && (
                    <td className={cn("px-3", DENSITY_ROW[density])}>
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                  )}
                  {visibleColumns.map((c) => (
                    <td key={c.key} className={cn("px-3", DENSITY_ROW[density])}>
                      <Skeleton className="h-3.5 w-[70%] rounded" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              paged.map((row, idx) => {
                const id = rowKey(row);
                const isSel = selected.includes(id);
                const isFocus = idx === focusIdx;
                const tr = (
                  <tr
                    key={id}
                    data-state={isSel ? "selected" : undefined}
                    role="row"
                    aria-selected={isSel}
                    tabIndex={-1}
                    onClick={() => setFocusIdx(idx)}
                    onDoubleClick={() => onRowActivate?.(row)}
                    className={cn(
                      "border-b border-[color:var(--border-hairline)] transition-colors last:border-0 hover:bg-[color:var(--row-hover)]",
                      isSel && "bg-[color:var(--row-selected)]",
                      isFocus && "ring-1 ring-inset ring-[color:var(--ring)]",
                      rowClassName?.(row),
                    )}
                  >
                    {selectable && (
                      <td className={cn("px-3", DENSITY_ROW[density])}>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {visibleColumns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3",
                          DENSITY_ROW[density],
                          c.align === "right" && "text-right",
                          c.cellClassName,
                        )}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );

                if (rowContextMenu) {
                  return (
                    <ContextMenuRow key={id} content={rowContextMenu(row)}>
                      {tr}
                    </ContextMenuRow>
                  );
                }
                return tr;
              })}

            {!loading && paged.length === 0 && (
              <tr>
                <td
                  colSpan={visibleColumns.length + (selectable ? 1 : 0)}
                  className="p-0"
                >
                  <div className="px-3 py-10">
                    <EmptyState
                      title={emptyTitle}
                      description={emptyDescription}
                      action={emptyAction}
                    />
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageSize > 0 && sorted.length > pageSize && (
        <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] px-3 py-2 text-[12px] text-muted-foreground">
          <span>
            {sorted.length === 0
              ? "0 results"
              : `${safePage * pageSize + 1}–${Math.min(
                  (safePage + 1) * pageSize,
                  sorted.length,
                )} of ${sorted.length}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={safePage === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <Icon icon={ChevronLeft} size="sm" />
            </Button>
            <span className="px-2 tabular-nums">
              Page {safePage + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={safePage >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Next page"
            >
              <Icon icon={ChevronRight} size="sm" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Context menu wrapper (simple right-click) ── */
function ContextMenuRow({
  children,
  content,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  const onCtx = (e: React.MouseEvent) => {
    e.preventDefault();
    setPos({ x: e.clientX, y: e.clientY });
    setOpen(true);
  };

  // We can't attach onContextMenu to a fragment, so we clone the <tr> child.
  if (!React.isValidElement(children)) return <>{children}</>;
  const cloned = React.cloneElement(
    children as React.ReactElement<React.HTMLAttributes<HTMLElement>>,
    { onContextMenu: onCtx },
  );

  return (
    <>
      {cloned}
      {open && pos && (
        <tr aria-hidden>
          <td colSpan={999} className="p-0">
            <div
              className="fixed inset-0 z-50"
              onClick={() => setOpen(false)}
              onContextMenu={(e) => {
                e.preventDefault();
                setOpen(false);
              }}
            >
              <div
                style={{ top: pos.y, left: pos.x }}
                className="absolute min-w-[180px] rounded-md border border-[color:var(--border)] bg-[color:var(--surface-4)] py-1 shadow-[var(--shadow-3)] animate-in fade-in zoom-in-95"
              >
                {content}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
