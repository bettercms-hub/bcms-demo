/**
 * Publishing panel: lifecycle status, the editorial workflow card
 * (stage, assignees, due date, approve / request changes), scheduling,
 * and publish/unpublish quick actions.
 */
import { entryActions, getWorkflow, stageOfEntry, useCMS, workflowActions } from "@/lib/cms/store";
import { diffEntry } from "@/lib/cms/snapshots";
import type { Entry, Member, WorkflowStage } from "@/lib/cms/types";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import { AssigneeStack, DueChip, MemberAvatar } from "@/components/cms/workflow/WorkflowBits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, GitCompareArrows, MessageSquareWarning, ThumbsUp, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EntryPublishingPanel({ entry, onCompare }: { entry: Entry; onCompare?: () => void }) {
  const [scheduleAt, setScheduleAt] = useState(toLocalInputValue(entry.scheduledAt));
  const status = entry.status ?? "draft";
  const changed = entry.publishedSnapshot
    ? diffEntry(entry, entry.publishedSnapshot).changedFields.size +
      (entry.publishedSnapshot.entry.title !== entry.title ? 1 : 0)
    : 0;

  const schedule = () => {
    if (!scheduleAt) {
      toast.error("Pick a date and time first");
      return;
    }
    entryActions.schedule(entry.id, new Date(scheduleAt).toISOString());
    toast.success("Scheduled");
  };

  return (
    <div className="space-y-6 p-6 text-[13px]">
      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Current status
        </div>
        <div className="flex items-center gap-3">
          <PublishBadge state={status} />
          <span className="text-muted-foreground">
            Updated {new Date(entry.updatedAt).toLocaleString()}
          </span>
        </div>
        {entry.lastPublishedAt ? (
          <div className="text-[12px] text-muted-foreground">
            Last published {new Date(entry.lastPublishedAt).toLocaleString()}
          </div>
        ) : null}
        {entry.scheduledAt ? (
          <div className="text-[12px] text-muted-foreground">
            Scheduled for {new Date(entry.scheduledAt).toLocaleString()}
          </div>
        ) : null}
        {entry.publishedSnapshot && changed > 0 && onCompare && (
          <button
            type="button"
            onClick={onCompare}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary hover:underline"
          >
            <GitCompareArrows className="h-3.5 w-3.5" />
            {changed} {changed === 1 ? "field differs" : "fields differ"} from the published version · Compare
          </button>
        )}
      </section>

      <WorkflowCard entry={entry} />

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Schedule
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-[12px]">Publish at</Label>
            <Input
              type="datetime-local"
              value={scheduleAt}
              onChange={(e) => setScheduleAt(e.target.value)}
            />
          </div>
          <Button variant="outline" onClick={schedule}>
            Schedule
          </Button>
          {status === "scheduled" ? (
            <Button
              variant="ghost"
              onClick={() => {
                entryActions.unschedule(entry.id);
                setScheduleAt("");
                toast.success("Unscheduled");
              }}
            >
              Unschedule
            </Button>
          ) : null}
        </div>
      </section>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Quick actions
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => {
              entryActions.publish(entry.id);
              toast.success("Published");
            }}
          >
            Publish now
          </Button>
          {status === "published" ? (
            <Button
              variant="outline"
              onClick={() => {
                entryActions.transition(entry.id, "draft");
                toast.success("Unpublished");
              }}
            >
              Unpublish
            </Button>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------- workflow */

function WorkflowCard({ entry }: { entry: Entry }) {
  const collection = useCMS((s) => s.collections.find((c) => c.id === entry.collectionId));
  const projectId = collection?.projectId ?? "";
  const customStages = useCMS((s) => s.workflows.find((w) => w.projectId === projectId)?.stages);
  const stages = customStages ?? getWorkflow(projectId);
  const members = useCMS((s) => s.members);
  const workspace = useCMS((s) => {
    const pr = s.projects.find((p) => p.id === projectId);
    return s.workspaces.find((w) => w.id === pr?.workspaceId);
  });
  const teammates = members.filter((m) => workspace?.memberIds.includes(m.id) && m.status !== "invited");

  const stage = stageOfEntry(entry, stages);
  const published = entry.status === "published";
  const [requesting, setRequesting] = useState(false);
  const [comment, setComment] = useState("");

  const changesStage = stages.find((s) => s.id === "wfs_changes") ?? stages.find((s) => /change/i.test(s.name));
  const gateStage = stages.find((s) => s.publishGate) ?? stages[stages.length - 1];

  function move(to: WorkflowStage, opts?: { comment?: string }) {
    workflowActions.moveEntry(entry.id, to.id, opts);
    toast.success(`Moved to ${to.name}`);
  }

  function requestChanges() {
    if (!changesStage) return;
    if (!comment.trim()) {
      toast.error("Say what needs to change");
      return;
    }
    move(changesStage, { comment: comment.trim() });
    setComment("");
    setRequesting(false);
  }

  const moverName = entry.workflowLastMove
    ? (members.find((m) => m.id === entry.workflowLastMove?.by)?.name ?? "Someone")
    : null;

  return (
    <section className="space-y-3">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Workflow</div>

      {published ? (
        <p className="text-[12.5px] text-muted-foreground">
          This entry is live. Move it to a working stage to start a new version.
        </p>
      ) : null}

      {/* stage picker */}
      <div className="flex flex-wrap gap-1.5">
        {stages.map((s) => {
          const active = !published && stage?.id === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => (active ? undefined : move(s))}
              aria-pressed={active}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                active
                  ? "border-transparent"
                  : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
              )}
              style={active ? { backgroundColor: `color-mix(in oklab, ${s.color} 14%, transparent)`, color: s.color } : undefined}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name}
              {s.publishGate && <span className="text-[9px] uppercase tracking-wide opacity-70">gate</span>}
            </button>
          );
        })}
      </div>

      {/* assignees + due */}
      <div className="flex flex-wrap items-center gap-3">
        <AssigneePicker
          teammates={teammates}
          value={entry.workflowAssigneeIds ?? []}
          onChange={(ids) => workflowActions.assignEntry(entry.id, ids)}
        />
        <label className="flex items-center gap-2 text-[12px] text-muted-foreground">
          Due
          <Input
            type="date"
            className="h-8 w-[150px] text-[12px]"
            value={entry.workflowDueDate ? entry.workflowDueDate.slice(0, 10) : ""}
            onChange={(e) =>
              workflowActions.setDueDate(entry.id, e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined)
            }
          />
        </label>
        <DueChip iso={entry.workflowDueDate} />
      </div>

      {/* quick actions */}
      {!published && (
        <div className="flex flex-wrap items-center gap-2">
          {gateStage && stage?.id !== gateStage.id && (
            <Button size="sm" onClick={() => move(gateStage)}>
              <ThumbsUp className="mr-1.5 h-3.5 w-3.5" /> Approve
            </Button>
          )}
          {stage?.publishGate && (
            <Button
              size="sm"
              onClick={() => {
                entryActions.publish(entry.id);
                toast.success("Published");
              }}
            >
              <Check className="mr-1.5 h-3.5 w-3.5" /> Publish
            </Button>
          )}
          {changesStage && stage?.id !== changesStage.id && (
            <Button size="sm" variant="outline" onClick={() => setRequesting((v) => !v)}>
              <MessageSquareWarning className="mr-1.5 h-3.5 w-3.5" /> Request changes
            </Button>
          )}
        </div>
      )}

      {requesting && (
        <div className="space-y-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] p-3">
          <Label className="text-[12px]">What needs to change?</Label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            autoFocus
            placeholder="Be specific so the author can act on it."
            className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 py-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRequesting(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={requestChanges} disabled={!comment.trim()}>
              Send back
            </Button>
          </div>
        </div>
      )}

      {entry.workflowLastMove && (
        <p className="text-[11.5px] text-muted-foreground">
          Moved by {moverName} · {new Date(entry.workflowLastMove.at).toLocaleString()}
          {entry.workflowLastMove.comment ? <> · “{entry.workflowLastMove.comment}”</> : null}
        </p>
      )}
    </section>
  );
}

function AssigneePicker({
  teammates,
  value,
  onChange,
}: {
  teammates: Member[];
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const selected = new Set(value);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
          {value.length === 0 ? "Assign" : <AssigneeStack ids={value} size={18} />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[240px] p-1.5">
        <div className="px-1.5 pb-1 pt-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
          Assignees
        </div>
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
        {teammates.length === 0 && (
          <div className="px-1.5 py-2 text-[12px] text-muted-foreground">No teammates in this workspace.</div>
        )}
      </PopoverContent>
    </Popover>
  );
}
