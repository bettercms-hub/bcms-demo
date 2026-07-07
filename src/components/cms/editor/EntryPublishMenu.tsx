/**
 * EntryPublishMenu — the single publish control for a collection entry.
 *
 * One tight cluster in the editor toolbar: a status dot, a Save button, and
 * a split Publish button whose caret opens a proper dropdown (publish now,
 * schedule, staging link, unpublish). Nothing about publishing lives anywhere
 * else on the entry screen, so "Published" appears exactly once.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  CalendarClock,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  Link2,
  Rocket,
  Undo2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { entryActions, useCMS } from "@/lib/cms/store";
import type { PublishState } from "@/lib/cms/types";
import { canEditContent, canPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const STATE_LABEL: Record<PublishState, string> = {
  draft: "Draft",
  review: "In review",
  approved: "Approved",
  scheduled: "Scheduled",
  published: "Published",
  archived: "Archived",
};

const STATE_DOT: Record<PublishState, string> = {
  draft: "bg-zinc-400",
  review: "bg-amber-500",
  approved: "bg-sky-500",
  scheduled: "bg-violet-500",
  published: "bg-emerald-500",
  archived: "bg-zinc-400",
};

export function EntryPublishMenu({ entryId, wsSlug }: { entryId: string; wsSlug: string }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  const { effective } = useEffectiveRole(wsSlug);
  const [saved, setSaved] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const canEdit = canEditContent(effective);
  const publishAllowed = canPublish(effective);

  const status: PublishState = entry?.status ?? "draft";
  const stagingUrl = useMemo(
    () => `https://staging.bettercms.site/preview/e/${entryId}?token=prv_${entryId.slice(-6)}`,
    [entryId],
  );

  if (!entry) return null;

  // Reviewers: status only, no controls.
  if (!canEdit) return <StatusPill status={status} />;

  const save = () => {
    entryActions.update(entry.id, {});
    setSaved(true);
    window.setTimeout(() => setSaved(false), 1600);
  };
  const publishNow = () => {
    if (!publishAllowed) {
      toast.error("Publishing needs a marketer seat or above");
      return;
    }
    entryActions.publish(entry.id);
    toast.success(status === "published" ? "Changes published" : "Entry published", {
      description: entry.title,
    });
  };
  const unpublish = () => {
    entryActions.setStatus(entry.id, "draft");
    toast.success("Entry unpublished");
  };
  const cancelSchedule = () => {
    entryActions.unschedule(entry.id);
    toast.success("Schedule canceled");
  };
  const copyStaging = () => {
    navigator.clipboard?.writeText(stagingUrl).catch(() => {});
    toast.success("Staging link copied");
  };

  const primaryLabel = status === "published" ? "Republish" : "Publish";

  return (
    <div className="flex items-center gap-1.5">
      <StatusPill status={status} />

      {/* Save */}
      <button
        type="button"
        onClick={save}
        className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
      >
        {saved ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-500" /> Saved
          </>
        ) : (
          "Save"
        )}
      </button>

      {/* Publish split button */}
      <div className="flex items-center">
        <button
          type="button"
          onClick={publishNow}
          disabled={!publishAllowed}
          title={publishAllowed ? undefined : "Publishing needs a marketer seat or above"}
          className="inline-flex h-7 items-center gap-1.5 rounded-l-md bg-primary pl-2.5 pr-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Rocket className="h-3.5 w-3.5" strokeWidth={2} />
          {primaryLabel}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label="Publish options"
              className="grid h-7 w-6 place-items-center rounded-r-md border-l border-white/25 bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="flex items-center gap-1.5 text-[12px] font-normal text-muted-foreground">
              <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[status]}`} aria-hidden />
              {STATE_LABEL[status]}
              {status === "published" && entry.lastPublishedAt && (
                <span className="ml-auto text-[11px]">live {timeAgo(entry.lastPublishedAt)}</span>
              )}
              {status === "scheduled" && entry.scheduledAt && (
                <span className="ml-auto text-[11px]">{new Date(entry.scheduledAt).toLocaleDateString()}</span>
              )}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={publishNow} disabled={!publishAllowed} className="gap-2">
              <Rocket className="h-3.5 w-3.5 text-muted-foreground" />
              {status === "published" ? "Publish changes" : "Publish now"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setScheduleOpen(true)} disabled={!publishAllowed} className="gap-2">
              <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
              {status === "scheduled" ? "Reschedule…" : "Schedule…"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={copyStaging} className="gap-2">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground" />
              Copy staging link
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => window.open(stagingUrl, "_blank", "noopener")}
              className="gap-2"
            >
              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              Open staging preview
            </DropdownMenuItem>
            {status === "scheduled" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={cancelSchedule} className="gap-2">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                  Cancel schedule
                </DropdownMenuItem>
              </>
            )}
            {status === "published" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={unpublish} className="gap-2 text-destructive focus:text-destructive">
                  <Undo2 className="h-3.5 w-3.5" />
                  Unpublish
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
    </div>
  );
}

function StatusPill({ status }: { status: PublishState }) {
  return (
    <span className="inline-flex h-7 items-center gap-1.5 px-1.5 text-[11.5px] font-medium text-muted-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[status]}`} aria-hidden />
      {STATE_LABEL[status]}
    </span>
  );
}

function ScheduleDialog({
  initial,
  onClose,
  onConfirm,
}: {
  initial?: string;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}) {
  const [value, setValue] = useState(() => {
    if (!initial) return "";
    try {
      const d = new Date(initial);
      return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    } catch {
      return "";
    }
  });

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Schedule entry"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative w-full max-w-[380px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-violet-50 text-violet-600">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-[14px] font-semibold text-foreground">Schedule publish</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              This entry goes live automatically at the chosen time. The rest of the site is untouched.
            </p>
          </div>
        </div>
        <div className="px-5 py-4">
          <label className="text-[12px] font-medium text-foreground">Publish date and time</label>
          <input
            autoFocus
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!value}
            onClick={() => value && onConfirm(new Date(value).toISOString())}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <CalendarClock className="h-3.5 w-3.5" /> Schedule
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const d = Math.floor(diff / 86_400_000);
  if (d > 0) return `${d}d ago`;
  const h = Math.floor(diff / 3_600_000);
  if (h > 0) return `${h}h ago`;
  const m = Math.floor(diff / 60_000);
  return m > 0 ? `${m}m ago` : "just now";
}
