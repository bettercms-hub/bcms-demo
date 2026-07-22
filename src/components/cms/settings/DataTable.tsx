import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/cms/SettingsSubNav";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  sortAccessor?: (row: T) => string | number;
  align?: "left" | "right";
  width?: string;
  headerClassName?: string;
  cellClassName?: string;
}

export interface DataTableProps<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string;
  /** Sticky-header max height; the table scrolls vertically inside this container. */
  maxHeight?: string;
  /** Loading state: renders skeleton rows. */
  loading?: boolean;
  /** Empty state (after filters applied and not loading). */
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Toolbar slot: search/filter inputs on the left, count/etc on the right. */
  toolbar?: ReactNode;
  /** Enable row selection. */
  selectable?: boolean;
  /** Render bulk action bar when items are selected. */
  bulkActions?: (selectedIds: string[], clear: () => void) => ReactNode;
  /** Page size; 0 disables pagination. */
  pageSize?: number;
  /** Initial sort. */
  initialSort?: { key: string; dir: "asc" | "desc" };
  rowClassName?: (row: T) => string;
  /** Number of skeleton rows to show when loading (default 5). */
  skeletonRows?: number;
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  maxHeight = "calc(100vh - 320px)",
  loading = false,
  emptyTitle = "No results",
  emptyDescription,
  emptyAction,
  toolbar,
  selectable = false,
  bulkActions,
  pageSize = 25,
  initialSort,
  rowClassName,
  skeletonRows = 5,
}: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: "asc" | "desc" } | null>(initialSort ?? null);
  const [selected, setSelected] = useState<string[]>([]);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortAccessor) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [rows, sort, columns]);

  const paged = useMemo(() => {
    if (!pageSize) return sorted;
    return sorted.slice(page * pageSize, page * pageSize + pageSize);
  }, [sorted, page, pageSize]);

  const totalPages = pageSize ? Math.max(1, Math.ceil(sorted.length / pageSize)) : 1;
  const pageRowIds = paged.map(rowKey);
  const allChecked = pageRowIds.length > 0 && pageRowIds.every((id) => selected.includes(id));
  const someChecked = !allChecked && pageRowIds.some((id) => selected.includes(id));

  function togglePageAll(check: boolean) {
    setSelected((prev) => {
      const set = new Set(prev);
      if (check) pageRowIds.forEach((id) => set.add(id));
      else pageRowIds.forEach((id) => set.delete(id));
      return [...set];
    });
  }

  function toggleSort(key: string) {
    const col = columns.find((c) => c.key === key);
    if (!col?.sortAccessor) return;
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  const colSpan = columns.length + (selectable ? 1 : 0);
  const hasResults = paged.length > 0;

  return (
    <div>
      {toolbar && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
          {toolbar}
        </div>
      )}

      {selectable && selected.length > 0 && (
        <div className="flex items-center justify-between border-b border-border bg-[color:var(--color-row-selected)]/50 px-4 py-2 text-[12px]">
          <span>{selected.length} selected</span>
          <div className="flex items-center gap-1.5">
            {bulkActions?.(selected, () => setSelected([])) ?? (
              <Button variant="ghost" size="sm" className="h-7 gap-1 text-[12px] text-destructive">
                <Trash2 className="h-3 w-3" /> Delete
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-[12px]"
              onClick={() => setSelected([])}
            >
              Clear
            </Button>
          </div>
        </div>
      )}

      <div className="relative overflow-auto" style={{ maxHeight }}>
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10 bg-background text-[11px] font-medium uppercase tracking-wider text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border,theme(colors.border))]">
            <tr>
              {selectable && (
                <th className="w-10 px-4 py-2.5">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? "indeterminate" : false}
                    onCheckedChange={(c) => togglePageAll(Boolean(c))}
                    aria-label="Select page"
                  />
                </th>
              )}
              {columns.map((c) => {
                const isSorted = sort?.key === c.key;
                const sortable = !!c.sortAccessor;
                return (
                  <th
                    key={c.key}
                    style={c.width ? { width: c.width } : undefined}
                    className={`px-4 py-2.5 ${c.align === "right" ? "text-right" : "text-left"} ${c.headerClassName ?? ""}`}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(c.key)}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-foreground ${
                          isSorted ? "text-foreground" : ""
                        }`}
                      >
                        {c.header}
                        {isSorted ? (
                          sort!.dir === "asc" ? (
                            <ArrowUp className="h-3 w-3" />
                          ) : (
                            <ArrowDown className="h-3 w-3" />
                          )
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 opacity-40" />
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
                <tr key={`s-${i}`} className="border-b border-border last:border-0">
                  {selectable && (
                    <td className="px-4 py-3">
                      <Skeleton className="h-4 w-4 rounded" />
                    </td>
                  )}
                  {columns.map((c) => (
                    <td key={c.key} className="px-4 py-3">
                      <Skeleton className="h-3.5 w-[70%] rounded" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading &&
              paged.map((row) => {
                const id = rowKey(row);
                const isSel = selected.includes(id);
                return (
                  <tr
                    key={id}
                    className={`border-b border-border last:border-0 hover:bg-[color:var(--color-row-hover)] ${
                      isSel ? "bg-[color:var(--color-row-selected)]/50" : ""
                    } ${rowClassName?.(row) ?? ""}`}
                  >
                    {selectable && (
                      <td className="px-4 py-3">
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={(c) =>
                            setSelected((s) => (c ? [...s, id] : s.filter((x) => x !== id)))
                          }
                          aria-label="Select row"
                        />
                      </td>
                    )}
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={`px-4 py-3 ${c.align === "right" ? "text-right" : ""} ${c.cellClassName ?? ""}`}
                      >
                        {c.cell(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}

            {!loading && !hasResults && (
              <tr>
                <td colSpan={colSpan} className="p-0">
                  <div className="px-4 py-10">
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
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[12px] text-muted-foreground">
          <span>
            {sorted.length === 0
              ? "0 results"
              : `${page * pageSize + 1}–${Math.min((page + 1) * pageSize, sorted.length)} of ${sorted.length}`}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
