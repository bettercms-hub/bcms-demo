/**
 * Workflow bits — small shared pieces: the stage badge, assignee avatars,
 * and the due-date chip. Used by the board, the entry editor and lists.
 */
import { CalendarClock } from "lucide-react";
import { getWorkflow, stageOfEntry, useCMS } from "@/lib/cms/store";
import { cn } from "@/lib/utils";
import { initialsOf, toneFor } from "@/lib/cms/avatar-color";
import { PersonTooltipForMember } from "./PersonTooltip";
import type { Entry, Member, WorkflowStage } from "@/lib/cms/types";

export function stageChipStyle(stage: WorkflowStage): React.CSSProperties {
  return {
    backgroundColor: `color-mix(in oklab, ${stage.color} 12%, transparent)`,
    color: stage.color,
  };
}

export function StageChip({ stage, size = "sm" }: { stage: WorkflowStage; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[4px] font-medium",
        size === "sm" ? "px-2 py-0.5 text-[10.5px]" : "px-2.5 py-1 text-[11.5px]",
      )}
      style={stageChipStyle(stage)}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {stage.name}
    </span>
  );
}

/** Stage badge for an entry; hidden for published/archived (lifecycle wins). */
export function WorkflowStageBadge({ entry }: { entry: Entry }) {
  const collection = useCMS((s) => s.collections.find((c) => c.id === entry.collectionId));
  const stages = useCMS((s) => {
    const w = s.workflows.find((x) => x.projectId === collection?.projectId);
    return w?.stages;
  });
  const stage = stageOfEntry(entry, stages ?? getWorkflow(collection?.projectId ?? ""));
  if (!stage || entry.status === "published" || entry.status === "archived") return null;
  return <StageChip stage={stage} />;
}

export function MemberAvatar({ member, size = 20 }: { member: Member; size?: number }) {
  return (
    <PersonTooltipForMember member={member}>
      <span
        tabIndex={0}
        className="grid shrink-0 select-none place-items-center rounded-full font-semibold text-white outline-none"
        style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)), backgroundColor: toneFor(member.id), boxShadow: "0 0 0 2px var(--card)" }}
      >
        {initialsOf(member.name)}
      </span>
    </PersonTooltipForMember>
  );
}

export function AssigneeStack({ ids, size = 20, max = 3 }: { ids: string[] | undefined; size?: number; max?: number }) {
  const members = useCMS((s) => s.members);
  const list = (ids ?? []).map((id) => members.find((m) => m.id === id)).filter((m): m is Member => !!m);
  if (list.length === 0) return null;
  const shown = list.slice(0, max);
  const extra = list.length - shown.length;
  return (
    <span className="flex items-center pl-1">
      {shown.map((m) => (
        <span key={m.id} className="-ml-1 first:ml-0">
          <MemberAvatar member={m} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          className="-ml-1 grid shrink-0 place-items-center rounded-full bg-[color:var(--s2)] font-semibold text-muted-foreground"
          style={{ width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)), boxShadow: "0 0 0 2px var(--card)" }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

export function DueChip({ iso }: { iso?: string }) {
  if (!iso) return null;
  const due = new Date(iso);
  const diff = due.getTime() - Date.now();
  const overdue = diff < 0;
  const days = overdue ? Math.max(1, Math.ceil(-diff / 86_400_000)) : Math.ceil(diff / 86_400_000);
  const soon = !overdue && days <= 2;
  const label = overdue ? `${days}d overdue` : days === 0 ? "Due today" : `Due in ${days}d`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium",
        overdue
          ? "bg-[color-mix(in_srgb,var(--status-error)_12%,transparent)] text-[var(--status-error)]"
          : soon
            ? "bg-amber-500/12 text-amber-700 dark:text-amber-400"
            : "bg-[color:var(--s2)] text-muted-foreground",
      )}
      title={due.toLocaleDateString()}
    >
      <CalendarClock className="h-3 w-3" />
      {label}
    </span>
  );
}
