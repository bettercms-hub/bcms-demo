import { useMemo, useState } from "react";
import {
  AlertCircle,
  Archive,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock,
  Eye,
  GitBranch,
  PauseCircle,
  PenLine,
  Rocket,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import type { Entry, Page, PublishState, Revision } from "@/lib/cms/types";
import { entryActions, pageActions, useCMS } from "@/lib/cms/store";
import { canTransition, disabledReason } from "@/lib/cms/publishing";
import { diffEntry, diffPage, relativeTime, summarizeDiff } from "@/lib/cms/snapshots";
import { editorBus } from "@/lib/cms/editor-bus";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import { RevisionList } from "./RevisionList";
import { ICON_STROKE } from "@/lib/cms/icons";

// ───────── State catalogue ─────────

interface StateMeta {
  label: string;
  purpose: string;
  permission: string;
  icon: typeof PenLine;
  tone: "neutral" | "info" | "warn" | "good" | "muted";
}

const STATE_META: Record<PublishState, StateMeta> = {
  draft: {
    label: "Draft",
    purpose: "Work in progress. Visible only inside the editor.",
    permission: "Anyone with edit access can modify a draft.",
    icon: PenLine,
    tone: "neutral",
  },
  review: {
    label: "In review",
    purpose: "Awaiting editorial sign-off before approval.",
    permission: "Reviewers and admins can approve or send back.",
    icon: UserCheck,
    tone: "info",
  },
  approved: {
    label: "Approved",
    purpose: "Ready to publish — content is locked from edits.",
    permission: "Editors with publish rights can release or schedule.",
    icon: ShieldCheck,
    tone: "good",
  },
  scheduled: {
    label: "Scheduled",
    purpose: "Will publish automatically at the scheduled time.",
    permission: "Editors with publish rights can reschedule or cancel.",
    icon: CalendarClock,
    tone: "info",
  },
  published: {
    label: "Published",
    purpose: "Live on your site. New changes require a re-publish.",
    permission: "Anyone with edit access can start a new draft.",
    icon: Rocket,
    tone: "good",
  },
  archived: {
    label: "Archived",
    purpose: "Removed from the public site and editing flow.",
    permission: "Admins can restore an archived item.",
    icon: Archive,
    tone: "muted",
  },
};

const TONE_BG: Record<StateMeta["tone"], string> = {
  neutral: "bg-[color:var(--color-elevated)]",
  info: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  warn: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  good: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  muted: "bg-muted text-muted-foreground",
};

// ───────── Public ─────────

interface Props {
  kind: "page" | "entry";
  ownerId: string;
}

export function PublishingPanel({ kind, ownerId }: Props) {
  const page = useCMS((s) => (kind === "page" ? s.pages.find((p) => p.id === ownerId) : undefined));
  const entry = useCMS((s) => (kind === "entry" ? s.entries.find((e) => e.id === ownerId) : undefined));
  const sections = useCMS((s) => {
    if (!page) return [];
    return page.sectionIds.map((id) => s.sections.find((x) => x.id === id)).filter(Boolean);
  });
  const revisions = useCMS((s) =>
    s.revisions.filter((r) => r.ownerKind === kind && r.ownerId === ownerId),
  );

  const target = page ?? entry;
  if (!target) return null;
  const state = (page?.publishState ?? entry?.status ?? "draft") as PublishState;
  const scheduledAt = page?.scheduledAt ?? entry?.scheduledAt;
  const lastPublishedAt = page?.lastPublishedAt ?? entry?.lastPublishedAt;

  const diff = useMemo(() => {
    if (page) return diffPage({ sections: sections as never }, page.publishedSnapshot ?? null);
    if (entry) return diffEntry({ fields: entry.fields }, entry.publishedSnapshot ?? null);
    return null;
  }, [page, entry, sections]);

  const summary = summarizeDiff(diff);
  const hasPending = !!diff && (
    "changedFields" in diff
      ? diff.changedFields.size > 0
      : diff.changedIds.size + diff.addedIds.size + diff.removedIds.size + (diff.orderChanged ? 1 : 0) > 0
  );

  const onTransition = (to: PublishState) => {
    if (page) pageActions.transition(page.id, to);
    if (entry) entryActions.transition(entry.id, to);
  };
  const onPublish = () => {
    if (page) pageActions.publish(page.id);
    if (entry) entryActions.publish(entry.id);
  };
  const onSchedule = (iso: string) => {
    if (page) pageActions.schedule(page.id, iso);
    if (entry) entryActions.schedule(entry.id, iso);
  };
  const onUnschedule = () => {
    if (page) pageActions.unschedule(page.id);
    if (entry) entryActions.unschedule(entry.id);
  };
  const onRestore = (rev: Revision) => {
    if (page) pageActions.restoreRevision(page.id, rev.id);
    if (entry) entryActions.restoreRevision(entry.id, rev.id);
  };

  return (
    <div className="space-y-6">
      <StateCard
        state={state}
        hasPending={hasPending}
        onTransition={onTransition}
        onPublish={onPublish}
      />

      <Timeline
        state={state}
        scheduledAt={scheduledAt}
        lastPublishedAt={lastPublishedAt}
        pendingSummary={hasPending ? summary : undefined}
        revisionCount={revisions.length}
        currentLabel={revisions[0]?.label ?? "Working draft"}
      />

      {(state === "approved" || state === "scheduled") && (
        <ScheduleBlock
          scheduledAt={scheduledAt}
          canSchedule={true}
          onSchedule={onSchedule}
          onUnschedule={onUnschedule}
        />
      )}

      <section>
        <GroupHeader title="Revisions" hint={`${revisions.length} total`} />
        <RevisionList
          revisions={revisions}
          onView={() => editorBus.emit({ type: "editor:set-preview-source", source: "published" })}
          onRestore={onRestore}
        />
      </section>
    </div>
  );
}

// ───────── State card ─────────

function StateCard({
  state,
  hasPending,
  onTransition,
  onPublish,
}: {
  state: PublishState;
  hasPending: boolean;
  onTransition: (to: PublishState) => void;
  onPublish: () => void;
}) {
  const meta = STATE_META[state];
  const Icon = meta.icon;

  const allowedTargets = (
    ["draft", "review", "approved", "scheduled", "published", "archived"] as PublishState[]
  ).filter((t) => canTransition(state, t));

  const primary = pickPrimaryAction(state, hasPending);
  const PrimaryIcon = primary.icon;
  const primaryDisabled =
    primary.kind === "publish"
      ? !(state === "approved" || state === "scheduled" || state === "draft")
      : !canTransition(state, primary.to!);

  return (
    <section className="overflow-hidden rounded-[10px] border border-border bg-[color:var(--color-panel)]">
      <div className="flex items-start gap-3 px-4 pt-3.5">
        <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-[8px] ${TONE_BG[meta.tone]}`}>
          <Icon className="h-4 w-4" strokeWidth={ICON_STROKE} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold text-foreground">{meta.label}</span>
            <PublishBadge state={state} />
          </div>
          <div className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{meta.purpose}</div>
        </div>
      </div>

      <div className="mt-2 px-4 pb-1 text-[11.5px] text-muted-foreground/90">
        <span className="font-medium text-foreground/80">Who:</span> {meta.permission}
      </div>

      {hasPending && state === "published" && (
        <div className="mx-4 mt-2.5 flex items-start gap-2 rounded-[6px] border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-[11.5px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="mt-[1px] h-3.5 w-3.5 shrink-0" strokeWidth={ICON_STROKE} />
          <span>Unpublished changes — re-publish to push them live.</span>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2 border-t border-border bg-[color:var(--color-elevated)]/50 px-4 py-2.5">
        <button
          type="button"
          onClick={primary.kind === "publish" ? onPublish : () => onTransition(primary.to!)}
          disabled={primaryDisabled}
          className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[6px] bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          <PrimaryIcon className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          {primary.label}
        </button>
        {allowedTargets.length > 0 && (
          <TransitionMenu state={state} targets={allowedTargets} onTransition={onTransition} />
        )}
      </div>
    </section>
  );
}

function pickPrimaryAction(state: PublishState, hasPending: boolean): {
  kind: "publish" | "transition";
  label: string;
  icon: typeof Rocket;
  to?: PublishState;
} {
  switch (state) {
    case "draft":
      return { kind: "transition", label: "Send to review", icon: UserCheck, to: "review" };
    case "review":
      return { kind: "transition", label: "Approve", icon: ShieldCheck, to: "approved" };
    case "approved":
      return { kind: "publish", label: "Publish now", icon: Rocket };
    case "scheduled":
      return { kind: "publish", label: "Publish now", icon: Rocket };
    case "published":
      return hasPending
        ? { kind: "publish", label: "Re-publish", icon: Rocket }
        : { kind: "transition", label: "Edit new draft", icon: PenLine, to: "draft" };
    case "archived":
      return { kind: "transition", label: "Restore to draft", icon: PenLine, to: "draft" };
  }
}

function TransitionMenu({
  state,
  targets,
  onTransition,
}: {
  state: PublishState;
  targets: PublishState[];
  onTransition: (to: PublishState) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:border-border-strong"
      >
        Move to
        <ChevronRight className={`h-3 w-3 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-[8px] border border-border bg-popover shadow-lg">
            {targets.map((t) => {
              const m = STATE_META[t];
              const reason = disabledReason(state, t);
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    onTransition(t);
                    setOpen(false);
                  }}
                  title={reason}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-foreground hover:bg-[color:var(--color-row-hover)]"
                >
                  <m.icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={ICON_STROKE} />
                  {m.label}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ───────── Timeline ─────────

function Timeline({
  state,
  scheduledAt,
  lastPublishedAt,
  pendingSummary,
  revisionCount,
  currentLabel,
}: {
  state: PublishState;
  scheduledAt?: string;
  lastPublishedAt?: string;
  pendingSummary?: string;
  revisionCount: number;
  currentLabel: string;
}) {
  type Item = {
    id: string;
    icon: typeof Clock;
    title: string;
    detail: string;
    tone: StateMeta["tone"];
    action?: { label: string; icon: typeof Eye; onClick: () => void };
  };

  const items: Item[] = [];

  items.push({
    id: "current",
    icon: PenLine,
    title: currentLabel,
    detail: state === "draft" ? "Not yet sent for review." : `Current state: ${STATE_META[state].label}`,
    tone: "neutral",
  });

  if (pendingSummary) {
    items.push({
      id: "pending",
      icon: AlertCircle,
      title: "Pending changes",
      detail: pendingSummary,
      tone: "warn",
      action: {
        label: "View live",
        icon: GitBranch,
        onClick: () => editorBus.emit({ type: "editor:set-preview-source", source: "published" }),
      },
    });
  }

  if (scheduledAt) {
    items.push({
      id: "scheduled",
      icon: CalendarClock,
      title: "Scheduled to publish",
      detail: new Date(scheduledAt).toLocaleString(),
      tone: "info",
    });
  }

  items.push(
    lastPublishedAt
      ? {
          id: "lastpub",
          icon: Rocket,
          title: "Last published",
          detail: relativeTime(lastPublishedAt),
          tone: "good",
          action: {
            label: "View",
            icon: Eye,
            onClick: () => editorBus.emit({ type: "editor:set-preview-source", source: "published" }),
          },
        }
      : {
          id: "neverpub",
          icon: PauseCircle,
          title: "Never published",
          detail: "Publish to create the first live version.",
          tone: "muted",
        },
  );

  items.push({
    id: "revisions",
    icon: CheckCircle2,
    title: `${revisionCount} revision${revisionCount === 1 ? "" : "s"}`,
    detail: revisionCount === 0 ? "Publishing snapshots will appear here." : "See history below.",
    tone: "muted",
  });

  return (
    <section>
      <GroupHeader title="Timeline" />
      <ol className="relative space-y-2 pl-5">
        <span className="absolute bottom-1 left-[7px] top-1 w-px bg-border" aria-hidden />
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <li key={it.id} className="relative">
              <span
                className={`absolute -left-[18px] top-1 grid h-[15px] w-[15px] place-items-center rounded-full ring-2 ring-[color:var(--inspector)] ${TONE_BG[it.tone]}`}
              >
                <Icon className="h-2.5 w-2.5" strokeWidth={ICON_STROKE} />
              </span>
              <div className="flex items-start gap-2 rounded-[6px] py-0.5">
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-foreground">{it.title}</div>
                  <div className="mt-0.5 text-[11.5px] text-muted-foreground">{it.detail}</div>
                </div>
                {it.action && (
                  <button
                    type="button"
                    onClick={it.action.onClick}
                    className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[4px] px-1.5 text-[11px] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                  >
                    <it.action.icon className="h-3 w-3" strokeWidth={ICON_STROKE} />
                    {it.action.label}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ───────── Schedule ─────────

function ScheduleBlock({
  scheduledAt,
  canSchedule,
  onSchedule,
  onUnschedule,
}: {
  scheduledAt?: string;
  canSchedule: boolean;
  onSchedule: (iso: string) => void;
  onUnschedule: () => void;
}) {
  const [value, setValue] = useState(() => {
    if (scheduledAt) {
      try {
        const d = new Date(scheduledAt);
        const off = d.getTimezoneOffset();
        return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
      } catch {
        return "";
      }
    }
    return "";
  });
  return (
    <section>
      <GroupHeader title="Schedule" />
      <div className="flex gap-1.5">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!canSchedule}
          className="h-8 flex-1 rounded-[6px] border border-border bg-surface px-2 text-[12px] disabled:opacity-50"
        />
        {scheduledAt ? (
          <button
            type="button"
            onClick={onUnschedule}
            title="Cancel schedule"
            className="inline-flex h-8 items-center justify-center rounded-[6px] border border-border bg-background px-2 text-[12px] hover:border-border-strong"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canSchedule || !value}
            onClick={() => value && onSchedule(new Date(value).toISOString())}
            className="inline-flex h-8 items-center justify-center rounded-[6px] border border-border bg-background px-2.5 text-[12px] hover:border-border-strong disabled:opacity-40"
          >
            Schedule
          </button>
        )}
      </div>
      {scheduledAt && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          Will publish {new Date(scheduledAt).toLocaleString()}.
        </div>
      )}
    </section>
  );
}

// ───────── Local primitives ─────────

function GroupHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {hint && <span className="text-[10.5px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

// Re-export for legacy direct imports.
export type { Page, Entry };
