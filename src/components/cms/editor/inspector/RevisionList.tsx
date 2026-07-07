import { GitCompare, RotateCcw } from "lucide-react";
import type { Revision } from "@/lib/cms/types";
import { useCMS } from "@/lib/cms/store";
import { formatRevisionStamp } from "@/lib/cms/format-time";
import { ICON_STROKE } from "@/lib/cms/icons";

interface Props {
  revisions: Revision[];
  onView?: (rev: Revision) => void;
  onRestore?: (rev: Revision) => void;
}

export function RevisionList({ revisions, onView, onRestore }: Props) {
  if (revisions.length === 0) {
    return (
      <div className="rounded-[6px] border border-dashed border-border px-3 py-4 text-center text-[11px] text-muted-foreground">
        No revisions yet. Publishing creates a snapshot.
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[6px] border border-border">
      {revisions.map((r, i) => (
        <RevisionRow
          key={r.id}
          rev={r}
          first={i === 0}
          onView={onView}
          onRestore={onRestore}
        />
      ))}
    </div>
  );
}

function RevisionRow({
  rev,
  first,
  onView,
  onRestore,
}: {
  rev: Revision;
  first: boolean;
  onView?: (r: Revision) => void;
  onRestore?: (r: Revision) => void;
}) {
  const author = useCMS((s) =>
    rev.createdBy ? s.members.find((m) => m.id === rev.createdBy) : undefined,
  );
  const initials = author?.name
    ? author.name
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase())
        .join("")
    : "—";

  return (
    <div
      className={`group/rev relative flex items-center gap-3 px-2.5 py-2 text-[12px] transition-colors hover:bg-[color:var(--color-row-hover)] ${
        first ? "" : "border-t border-border"
      }`}
    >
      {/* Timestamp column */}
      <div className="w-[68px] shrink-0 font-mono text-[10.5px] uppercase tracking-wide text-muted-foreground/80">
        {formatRevisionStamp(rev.createdAt)}
      </div>

      {/* Label + author chip */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-foreground">
            {rev.label ?? "Revision"}
          </span>
          {first && (
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1 text-[9px] font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              current
            </span>
          )}
        </div>
        {author && (
          <div className="mt-0.5 flex items-center gap-1.5">
            <span className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[color:var(--s4)] text-[9px] font-semibold text-muted-foreground">
              {initials}
            </span>
            <span className="truncate text-[11px] text-muted-foreground">
              {author.name}
            </span>
          </div>
        )}
      </div>

      {/* Hover-revealed actions */}
      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/rev:opacity-100 focus-within:opacity-100">
        {onView && (
          <button
            type="button"
            onClick={() => onView(rev)}
            title="Compare with current"
            className="inline-flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <GitCompare className="h-3 w-3" strokeWidth={ICON_STROKE} />
            Compare
          </button>
        )}
        {onRestore && !first && (
          <button
            type="button"
            onClick={() => onRestore(rev)}
            title="Restore this version into draft"
            className="inline-flex h-6 items-center gap-1 rounded-[4px] px-1.5 text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={ICON_STROKE} />
            Restore
          </button>
        )}
      </div>
    </div>
  );
}
