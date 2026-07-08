/**
 * Paginator — page-size selector plus prev/next, shared across the Pages
 * tree, the Markdown endpoints table and the collections grid. Real
 * pagination (ranges), not "load more", so long lists stay organized.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export const PAGE_SIZES = [50, 100, 200] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

/** Clamp a page index to the available range for a given total and size. */
export function clampPage(page: number, total: number, size: number): number {
  const last = Math.max(0, Math.ceil(total / size) - 1);
  return Math.min(Math.max(page, 0), last);
}

export function Paginator({
  total,
  page,
  size,
  onPage,
  onSize,
  noun = "item",
}: {
  total: number;
  page: number;
  size: PageSize;
  onPage: (p: number) => void;
  onSize: (s: PageSize) => void;
  noun?: string;
}) {
  if (total === 0) return null;
  const pageCount = Math.ceil(total / size);
  const from = page * size + 1;
  const to = Math.min(total, (page + 1) * size);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-hairline)] px-4 py-2.5">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <span className="tabular-nums">
          {from}
          {to > from ? `-${to}` : ""} of {total} {total === 1 ? noun : `${noun}s`}
        </span>
        <span className="text-muted-foreground/40">·</span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
              {size} per page
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[150px]">
            {PAGE_SIZES.map((s) => (
              <DropdownMenuItem key={s} className="justify-between text-[13px]" onSelect={() => onSize(s)}>
                {s} per page
                {s === size && <span className="text-primary">•</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => onPage(page - 1)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border border-[color:var(--color-border)] pl-1.5 pr-2 text-[12px] font-medium transition-colors",
              page === 0 ? "cursor-not-allowed text-muted-foreground/40" : "text-foreground hover:bg-[color:var(--color-row-hover)]",
            )}
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Prev
          </button>
          <span className="px-1.5 text-[12px] tabular-nums text-muted-foreground">
            {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => onPage(page + 1)}
            className={cn(
              "inline-flex h-7 items-center gap-1 rounded-md border border-[color:var(--color-border)] pl-2 pr-1.5 text-[12px] font-medium transition-colors",
              page >= pageCount - 1 ? "cursor-not-allowed text-muted-foreground/40" : "text-foreground hover:bg-[color:var(--color-row-hover)]",
            )}
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
