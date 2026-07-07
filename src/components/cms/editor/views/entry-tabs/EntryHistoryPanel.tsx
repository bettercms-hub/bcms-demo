/**
 * History panel: list of revisions for the entry with a restore action.
 */
import { entryActions, useCMS } from "@/lib/cms/store";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function EntryHistoryPanel({ entryId }: { entryId: string }) {
  const revisions = useCMS((s) =>
    s.revisions
      .filter((r) => r.ownerKind === "entry" && r.ownerId === entryId)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),
  );
  const members = useCMS((s) => s.members);

  if (revisions.length === 0) {
    return (
      <div className="p-6 text-[13px] text-muted-foreground">
        No revisions yet. Publishing the entry creates a snapshot you can restore.
      </div>
    );
  }

  return (
    <div className="space-y-2 p-6">
      {revisions.map((r) => {
        const author = members.find((m) => m.id === r.createdBy);
        return (
          <div
            key={r.id}
            className="flex items-center justify-between rounded-md border border-border/60 bg-[color:var(--card)] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="text-[13px] font-medium">{r.label ?? "Revision"}</div>
              <div className="text-[11px] text-muted-foreground">
                {new Date(r.createdAt).toLocaleString()} ·{" "}
                {author?.name ?? r.createdBy ?? "Unknown"}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                entryActions.restoreRevision(entryId, r.id);
                toast.success("Restored to draft");
              }}
            >
              Restore
            </Button>
          </div>
        );
      })}
    </div>
  );
}
