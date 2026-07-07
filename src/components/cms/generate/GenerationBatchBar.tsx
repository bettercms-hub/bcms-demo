/**
 * GenerationBatchBar — the review surface after a generator run. Sits above
 * the Pages table while ?batch= is active: publish the whole batch, undo the
 * run, or dismiss back to all pages.
 */
import { Sparkles, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { agentRunActions } from "@/lib/agent/runs-store";
import { pagesActions, type PageDoc } from "@/lib/cms/pages-store";
import { Button } from "@/components/ui/button";
import type { AgentRun } from "@/lib/agent/types";

export function GenerationBatchBar({
  projectId,
  run,
  pages,
  canPublish,
  onDismiss,
}: {
  projectId: string;
  run: AgentRun;
  pages: PageDoc[];
  canPublish: boolean;
  onDismiss: () => void;
}) {
  const drafts = pages.filter((p) => p.state === "draft").length;
  const live = pages.length - drafts;

  function publishAll() {
    for (const pg of pages) {
      if (pg.state === "draft") pagesActions.update(projectId, pg.path, (p) => ({ ...p, state: "published" }));
    }
    toast.success(`${drafts} ${drafts === 1 ? "page" : "pages"} published`);
  }

  function undoBatch() {
    const { reverted, skipped } = agentRunActions.undo(run.id);
    if (reverted > 0) toast.success(`Removed ${reverted} draft ${reverted === 1 ? "page" : "pages"}`);
    if (skipped > 0) toast.info(`${skipped} kept, already published or edited`);
    onDismiss();
  }

  return (
    <div className="mb-3 flex items-center gap-3 rounded-xl border border-[color:color-mix(in_oklab,var(--primary)_30%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-3.5 py-2.5">
      <Sparkles className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[12.5px] font-medium text-foreground">{run.title}</div>
        <div className="text-[11px] text-muted-foreground">
          {pages.length} {pages.length === 1 ? "page" : "pages"} in this batch
          {live > 0 ? `, ${live} live, ${drafts} still drafts` : ", all drafts"}
        </div>
      </div>
      {canPublish && drafts > 0 && (
        <Button size="sm" onClick={publishAll}>
          Publish all ({drafts})
        </Button>
      )}
      {!run.reverted && drafts > 0 && (
        <Button size="sm" variant="outline" onClick={undoBatch}>
          <Undo2 className="mr-1 h-3.5 w-3.5" /> Undo
        </Button>
      )}
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Show all pages"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
