import type { ReactNode } from "react";
import type { PageDiff } from "@/lib/cms/snapshots";

interface Props {
  diff?: PageDiff | null;
  draft: ReactNode;
  published: ReactNode;
}

export function ComparePane({ diff, draft, published }: Props) {
  const changed = diff?.changedIds.size ?? 0;
  const added = diff?.addedIds.size ?? 0;
  const removed = diff?.removedIds.size ?? 0;
  const noChange = changed + added + removed === 0;
  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--canvas)]">
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-[color:var(--topbar)] px-4 py-2 text-[11px]">
        <span className="font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Diff
        </span>
        {noChange ? (
          <span className="text-muted-foreground">No changes since last publish</span>
        ) : (
          <>
            <Stat label="changed" value={changed} tone="warning" />
            <Stat label="added" value={added} tone="success" />
            <Stat label="removed" value={removed} tone="danger" />
          </>
        )}
      </div>
      {noChange ? (
        <div className="grid flex-1 place-items-center p-8 text-center">
          <div className="max-w-xs">
            <div className="text-[13px] font-semibold text-foreground">
              No differences
            </div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Draft matches the last published version. Make an edit to see a
              side-by-side comparison here.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid flex-1 min-h-0 grid-cols-1 gap-0 overflow-hidden xl:grid-cols-2">
          {/* Before — published */}
          <div className="flex min-h-0 min-w-0 flex-col border-r border-border">
            <div className="sticky top-0 z-10 flex h-8 shrink-0 items-center justify-between border-b border-border bg-[color:var(--s-card-head,var(--topbar))] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Before · Published</span>
            </div>
            <div className="min-w-0 flex-1 overflow-auto bg-[color:var(--canvas)] p-4">
              {published}
            </div>
          </div>
          {/* After — draft (accent border) */}
          <div className="relative flex min-h-0 min-w-0 flex-col">
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-[color:var(--primary)]"
            />
            <div className="sticky top-0 z-10 flex h-8 shrink-0 items-center justify-between border-b border-border bg-[color:var(--s-card-head,var(--topbar))] px-3 text-[10px] font-bold uppercase tracking-[0.12em] text-primary">
              <span>After · Draft</span>
            </div>
            <div className="min-w-0 flex-1 overflow-auto bg-[color:var(--canvas)] p-4">
              {draft}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warning" | "success" | "danger";
}) {
  if (value === 0) return null;
  const cls =
    tone === "warning"
      ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
      : tone === "success"
        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
        : "bg-[color-mix(in_srgb,var(--status-error)_14%,transparent)] text-[var(--status-error)]";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}
    >
      <span className="tabular-nums">{value}</span>
      <span className="opacity-70">{label}</span>
    </span>
  );
}
