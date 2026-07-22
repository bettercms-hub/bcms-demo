import type { RoleRow } from "@/lib/workspace/queries";
import { countEnabled, totalCapabilities } from "@/lib/workspace/capabilities";
import { Lock, Pencil, Trash2 } from "lucide-react";

interface Props {
  role: RoleRow;
  count?: number;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TONE: Record<string, string> = {
  amber: "bg-[color-mix(in_srgb,var(--status-warning)_12%,transparent)] text-[color:var(--status-warning)] border-transparent",
  violet: "bg-[color:var(--status-review-bg)] text-[color:var(--status-review-fg)] border-transparent",
  sky: "bg-[color:var(--status-review-bg)] text-[color:var(--status-review-fg)] border-transparent",
  emerald: "bg-[color:var(--status-live-bg)] text-[color:var(--status-live-fg)] border-transparent",
  rose: "bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] text-[color:var(--destructive)] border-transparent",
  slate: "bg-[color:var(--status-draft-bg)] text-[color:var(--status-draft-fg)] border-transparent",
};

export function RoleCard({ role, count, onEdit, onDelete }: Props) {
  const enabled = countEnabled(role.capabilities);
  const total = totalCapabilities();
  const tone = TONE[role.color ?? "slate"] ?? TONE.slate;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] ${tone}`}>
              {role.is_builtin ? "Built-in" : "Custom"}
            </span>
            <h3 className="truncate text-[14px] font-semibold text-foreground">{role.name}</h3>
          </div>
          {role.description && (
            <p className="mt-1 line-clamp-2 text-[12.5px] text-muted-foreground">{role.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {role.is_builtin ? (
            <span className="grid h-7 w-7 place-items-center text-muted-foreground" title="Built-in role">
              <Lock className="h-3.5 w-3.5" />
            </span>
          ) : (
            <>
              {onEdit && (
                <button
                  type="button"
                  onClick={onEdit}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                  aria-label="Edit role"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-destructive"
                  aria-label="Delete role"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between border-t border-border pt-3 text-[11.5px] text-muted-foreground">
        <span className="tabular-nums">
          {enabled} / {total} capabilities
        </span>
        {count !== undefined && (
          <span>
            {count} member{count === 1 ? "" : "s"}
          </span>
        )}
      </div>
    </div>
  );
}
