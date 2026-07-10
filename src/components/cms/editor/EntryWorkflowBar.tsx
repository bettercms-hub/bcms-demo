/**
 * EntryWorkflowBar — the single document footer for a collection entry.
 *
 * One consistent bar, used on every entry-editing surface (the slide-over
 * and the full editor), so review and publishing live where you write —
 * not in a separate tab. Left: the workflow stage (or lifecycle status) and
 * when it last changed. Right: who it's assigned to, Compare, and one
 * primary action that reads the situation:
 *   working stage  → Approve (advance to the publish gate)
 *   publish gate   → Publish
 *   published      → Publish changes (only when the draft differs)
 * with a dropdown for the rest (request changes, schedule, move to a stage,
 * unpublish). Modelled on Sanity's document actions + badges.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, GitCompareArrows, MessageSquareWarning, Rocket, ThumbsUp, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { entryActions, getWorkflow, stageOfEntry, useCMS, workflowActions } from "@/lib/cms/store";
import { diffEntry, relativeTime } from "@/lib/cms/snapshots";
import { canEditContent, canPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import { AssigneeStack, MemberAvatar, StageChip } from "@/components/cms/workflow/WorkflowBits";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import { CompareVersionsDialog } from "@/components/cms/editor/views/CompareVersionsDialog";
import { ScheduleDialog } from "@/components/cms/editor/EntryPublishMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Member, WorkflowStage } from "@/lib/cms/types";

export function EntryWorkflowBar({ entryId, wsSlug, className }: { entryId: string; wsSlug: string; className?: string }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  const collection = useCMS((s) => (entry ? s.collections.find((c) => c.id === entry.collectionId) : undefined));
  const projectId = collection?.projectId ?? "";
  const customStages = useCMS((s) => s.workflows.find((w) => w.projectId === projectId)?.stages);
  const members = useCMS((s) => s.members);
  const workspace = useCMS((s) => {
    const pr = s.projects.find((p) => p.id === projectId);
    return s.workspaces.find((w) => w.id === pr?.workspaceId);
  });

  const { effective } = useEffectiveRole(wsSlug);
  const canEdit = canEditContent(effective);
  const publishAllowed = canPublish(effective);

  const [compareOpen, setCompareOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);

  const changed = useMemo(
    () =>
      entry?.publishedSnapshot
        ? diffEntry(entry, entry.publishedSnapshot).changedFields.size +
          (entry.publishedSnapshot.entry.title !== entry.title ? 1 : 0)
        : 0,
    [entry],
  );

  if (!entry) return null;

  const stages = customStages ?? getWorkflow(projectId);
  const stage = stageOfEntry(entry, stages);
  const status = entry.status ?? "draft";
  const published = status === "published";
  const scheduled = status === "scheduled";
  const gateStage = stages.find((s) => s.publishGate) ?? stages[stages.length - 1];
  const changesStage = stages.find((s) => s.id === "wfs_changes") ?? stages.find((s) => /change/i.test(s.name));
  const teammates = members.filter((m) => workspace?.memberIds.includes(m.id) && m.status !== "invited");

  const moveTo = (to: WorkflowStage, opts?: { comment?: string }) => {
    workflowActions.moveEntry(entry.id, to.id, opts);
    toast.success(`Moved to ${to.name}`);
  };
  const publish = () => {
    if (!publishAllowed) {
      toast.error("Publishing needs a marketer seat or above");
      return;
    }
    entryActions.publish(entry.id);
    toast.success(published ? "Changes published" : "Entry published", { description: entry.title });
  };

  // The primary action reads the situation.
  type Primary = { label: string; onClick: () => void; icon: typeof Rocket; disabled?: boolean; tone?: "publish" };
  let primary: Primary;
  if (published) {
    primary = { label: changed > 0 ? "Publish changes" : "Published", onClick: publish, icon: Rocket, disabled: changed === 0 || !publishAllowed, tone: "publish" };
  } else if (scheduled) {
    primary = { label: "Publish now", onClick: publish, icon: Rocket, disabled: !publishAllowed, tone: "publish" };
  } else if (stage?.publishGate) {
    primary = { label: "Publish", onClick: publish, icon: Rocket, disabled: !publishAllowed, tone: "publish" };
  } else if (gateStage) {
    primary = { label: "Approve", onClick: () => moveTo(gateStage), icon: ThumbsUp };
  } else {
    primary = { label: "Publish", onClick: publish, icon: Rocket, disabled: !publishAllowed, tone: "publish" };
  }

  return (
    <div className={cn("flex items-center gap-3 border-t border-[color:var(--border-hairline)] bg-[color:var(--card)] px-4 py-2.5", className)}>
      {/* left: stage / status + last change */}
      <div className="flex min-w-0 items-center gap-2">
        {published || status === "archived" ? <PublishBadge state={status} /> : stage ? <StageChip stage={stage} size="md" /> : <PublishBadge state={status} />}
        <span className="hidden truncate text-[11.5px] text-muted-foreground sm:block">
          {entry.workflowLastMove ? `Moved ${relativeTime(entry.workflowLastMove.at)}` : `Updated ${relativeTime(entry.updatedAt)}`}
        </span>
      </div>

      <div className="flex-1" />

      {!canEdit ? (
        <span className="text-[11.5px] text-muted-foreground">Your seat can review, not edit.</span>
      ) : (
        <>
          <AssigneePickerButton teammates={teammates} value={entry.workflowAssigneeIds ?? []} onChange={(ids) => workflowActions.assignEntry(entry.id, ids)} />

          {entry.publishedSnapshot && (
            <button
              type="button"
              onClick={() => setCompareOpen(true)}
              title="Compare the draft with the published version"
              className="relative inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <GitCompareArrows className="h-3.5 w-3.5" /> Compare
              {changed > 0 && (
                <span className="grid h-4 min-w-4 place-items-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold tabular-nums text-amber-700 dark:text-amber-400">
                  {changed}
                </span>
              )}
            </button>
          )}

          {/* primary + dropdown */}
          <div className="flex items-center">
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-l-md pl-2.5 pr-2 text-[12px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]",
              )}
            >
              <primary.icon className="h-3.5 w-3.5" strokeWidth={2} />
              {primary.label}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-label="More publishing actions"
                  className="grid h-8 w-6 place-items-center rounded-r-md border-l border-white/25 bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {changesStage && stage?.id !== changesStage.id && !published && (
                  <>
                    <DropdownMenuItem onSelect={() => setTimeout(() => setRequestOpen(true), 0)} className="gap-2">
                      <MessageSquareWarning className="h-3.5 w-3.5 text-muted-foreground" /> Request changes
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onSelect={publish} disabled={!publishAllowed} className="gap-2">
                  <Rocket className="h-3.5 w-3.5 text-muted-foreground" /> {published ? "Publish changes" : "Publish now"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setTimeout(() => setScheduleOpen(true), 0)} disabled={!publishAllowed} className="gap-2">
                  <Rocket className="h-3.5 w-3.5 text-muted-foreground opacity-0" />
                  {scheduled ? "Reschedule…" : "Schedule…"}
                </DropdownMenuItem>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="gap-2">Move to stage</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {stages.map((s) => (
                      <DropdownMenuItem key={s.id} disabled={!published && stage?.id === s.id} onSelect={() => moveTo(s)} className="gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                {(published || scheduled) && <DropdownMenuSeparator />}
                {scheduled && (
                  <DropdownMenuItem onSelect={() => { entryActions.unschedule(entry.id); toast.success("Unscheduled"); }} className="gap-2">
                    Unschedule
                  </DropdownMenuItem>
                )}
                {published && (
                  <DropdownMenuItem
                    onSelect={() => { entryActions.setStatus(entry.id, "draft"); toast.success("Entry unpublished"); }}
                    className="gap-2 text-destructive focus:text-destructive"
                  >
                    Unpublish
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </>
      )}

      {compareOpen && <CompareVersionsDialog entryId={entry.id} canEdit={canEdit} onClose={() => setCompareOpen(false)} />}
      {scheduleOpen && (
        <ScheduleDialog
          initial={entry.scheduledAt}
          onClose={() => setScheduleOpen(false)}
          onConfirm={(iso) => {
            entryActions.schedule(entry.id, iso);
            toast.success(`Scheduled for ${new Date(iso).toLocaleString()}`);
            setScheduleOpen(false);
          }}
        />
      )}
      {requestOpen && changesStage && (
        <RequestChangesDialog
          onClose={() => setRequestOpen(false)}
          onConfirm={(comment) => {
            moveTo(changesStage, { comment });
            setRequestOpen(false);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------------------------------------- assignee picker */

function AssigneePickerButton({ teammates, value, onChange }: { teammates: Member[]; value: string[]; onChange: (ids: string[]) => void }) {
  const selected = new Set(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Assign reviewers"
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          {value.length === 0 ? "Assign" : <AssigneeStack ids={value} size={18} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-1.5">
        <div className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">Assign to</div>
        {teammates.map((m) => {
          const on = selected.has(m.id);
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(on ? value.filter((id) => id !== m.id) : [...value, m.id])}
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <MemberAvatar member={m} size={22} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{m.name}</span>
              {on && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
            </button>
          );
        })}
        {teammates.length === 0 && <div className="px-1.5 py-2 text-[12px] text-muted-foreground">No teammates in this workspace.</div>}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------- request changes */

function RequestChangesDialog({ onClose, onConfirm }: { onClose: () => void; onConfirm: (comment: string) => void }) {
  const [comment, setComment] = useState("");
  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-auto" data-nested-dialog>
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Request changes"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative w-full max-w-[420px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-500/12 text-amber-600">
            <MessageSquareWarning className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Request changes</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">The author is notified with your note and the entry moves back to Changes requested.</p>
          </div>
        </div>
        <div className="px-5 py-4">
          <textarea
            autoFocus
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={3}
            placeholder="Be specific so the author can act on it."
            className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 py-2 text-[13px] text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button type="button" onClick={onClose} className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
            Cancel
          </button>
          <button
            type="button"
            disabled={!comment.trim()}
            onClick={() => comment.trim() && onConfirm(comment.trim())}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send back
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
