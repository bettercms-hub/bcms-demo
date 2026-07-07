/**
 * Publishing panel: status transitions, scheduling, and publish/unpublish.
 */
import { entryActions } from "@/lib/cms/store";
import type { Entry, PublishState } from "@/lib/cms/types";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

const TRANSITIONS: Array<{ to: PublishState; label: string }> = [
  { to: "draft", label: "Move to draft" },
  { to: "review", label: "Submit for review" },
  { to: "approved", label: "Approve" },
  { to: "published", label: "Publish now" },
  { to: "archived", label: "Archive" },
];

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EntryPublishingPanel({ entry }: { entry: Entry }) {
  const [scheduleAt, setScheduleAt] = useState(toLocalInputValue(entry.scheduledAt));
  const status = entry.status ?? "draft";

  const transition = (to: PublishState) => {
    const ok = entryActions.transition(entry.id, to);
    if (!ok) toast.error(`Can't move from ${status} to ${to}`);
    else toast.success(`Moved to ${to}`);
  };

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
      </section>

      <section className="space-y-2">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Workflow
        </div>
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS.filter((t) => t.to !== status).map((t) => (
            <Button
              key={t.to}
              variant={t.to === "published" ? "default" : "outline"}
              size="sm"
              onClick={() => transition(t.to)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      </section>

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
