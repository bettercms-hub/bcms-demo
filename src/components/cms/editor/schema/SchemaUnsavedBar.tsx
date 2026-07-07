/**
 * SchemaUnsavedBar — sticky footer surfaced when the current schema
 * structure differs from the last "saved" baseline.
 *
 * The bar shows a coarse diff (added / removed / modified field counts +
 * an indicator when group structure has changed) and exposes:
 *
 *   - Discard  → revert to baseline (still undoable via ⌘Z)
 *   - Mark as saved → re-baseline to the current structure
 *
 * "Saving" is mock — no network. This bar exists to make the dirty-state
 * model legible in v4 polish.
 */
import { RotateCcw, Check } from "lucide-react";
import type { SchemaDiff } from "@/lib/cms/schema/use-schema-history";

interface Props {
  diff: SchemaDiff;
  onDiscard: () => void;
  onMarkSaved: () => void;
}

export function SchemaUnsavedBar({ diff, onDiscard, onMarkSaved }: Props) {
  const parts: string[] = [];
  if (diff.added) parts.push(`${diff.added} added`);
  if (diff.removed) parts.push(`${diff.removed} removed`);
  if (diff.modified) parts.push(`${diff.modified} modified`);
  if (diff.groupsChanged) parts.push("groups changed");
  const summary = parts.length ? parts.join(" · ") : "No changes";

  return (
    <div className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border/40 bg-[color:var(--panel)] px-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-amber-500/80" />
        <span className="text-[11.5px] font-medium text-foreground">
          Unsaved schema changes
        </span>
        <span className="truncate text-[11.5px] text-muted-foreground">
          {summary}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDiscard}
          className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Discard
        </button>
        <button
          type="button"
          onClick={onMarkSaved}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-2.5 text-[11.5px] font-medium text-background hover:bg-foreground/90"
        >
          <Check className="h-3.5 w-3.5" /> Mark as saved
        </button>
      </div>
    </div>
  );
}
