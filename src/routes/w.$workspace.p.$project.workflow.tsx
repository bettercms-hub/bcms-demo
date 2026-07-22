/**
 * Workflow — the editorial board for a project's entries.
 *
 * Kanban columns are the project's workflow stages plus the built-in
 * Published column (system lifecycle). Cards drag between stages with
 * role checks; publishing is offered only from the publish-gate stage.
 * Clicking a card opens the same entry slide-over the Content tab uses,
 * so stage, assignees and due dates stay one system everywhere.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CheckCircle2, ChevronDown, Database, LayoutGrid, Rows3, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { entryActions, getWorkflow, stageOfEntry, useCMS, workflowActions } from "@/lib/cms/store";
import { canEditContent, canPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import { siteHas } from "@/lib/billing/pricing";
import { LockedFeature } from "@/components/cms/billing/FeatureGate";
import { Draggable, Droppable } from "@/components/cms/pages/tree-dnd";
import { SegmentedFilter } from "@/components/cms/ListToolbar";
import { AssigneeStack, DueChip, StageChip } from "@/components/cms/workflow/WorkflowBits";
import { CustomizeStagesDialog } from "@/components/cms/workflow/CustomizeStagesDialog";
import { EntrySlideOver } from "@/components/cms/editor/views/EntrySlideOver";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Collection, Entry, Schema, WorkflowStage } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/p/$project/workflow")({
  component: WorkflowPage,
});

type Scope = "all" | "mine" | "overdue";
type View = "board" | "list";
const CURRENT_MEMBER = "m_jane"; // demo viewer identity (Jane Park)

function WorkflowPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const { effective } = useEffectiveRole(workspace);
  const canEdit = canEditContent(effective);
  const publishAllowed = canPublish(effective);

  const collections = useCMS((s) => s.collections.filter((c) => c.projectId === pr?.id));
  const schemas = useCMS((s) => s.schemas);
  const allEntries = useCMS((s) => s.entries);
  const customStages = useCMS((s) => s.workflows.find((w) => w.projectId === pr?.id)?.stages);
  const stages = customStages ?? getWorkflow(pr?.id ?? "");

  const [view, setView] = useState<View>("board");
  const [scope, setScope] = useState<Scope>("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [openEntry, setOpenEntry] = useState<string | null>(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const entries = useMemo(() => {
    const colIds = new Set(collections.map((c) => c.id));
    return allEntries.filter((e) => {
      if (!colIds.has(e.collectionId)) return false;
      if (e.status === "archived") return false;
      if (collectionFilter !== "all" && e.collectionId !== collectionFilter) return false;
      if (scope === "mine" && !(e.workflowAssigneeIds ?? []).includes(CURRENT_MEMBER)) return false;
      if (scope === "overdue") {
        if (!e.workflowDueDate || e.status === "published") return false;
        if (new Date(e.workflowDueDate).getTime() > Date.now()) return false;
      }
      return true;
    });
  }, [allEntries, collections, collectionFilter, scope]);

  const mineCount = useMemo(
    () => entries.filter((e) => (e.workflowAssigneeIds ?? []).includes(CURRENT_MEMBER)).length,
    [entries],
  );
  const overdueCount = useMemo(
    () =>
      entries.filter(
        (e) => e.status !== "published" && e.workflowDueDate && new Date(e.workflowDueDate).getTime() <= Date.now(),
      ).length,
    [entries],
  );

  if (!pr) {
    return <div className="grid flex-1 place-items-center p-8 text-[13px] text-muted-foreground">Project not found.</div>;
  }

  if (!siteHas(pr.sitePlan ?? "free", "workflows")) {
    return (
      <LockedFeature
        featureKey="workflows"
        title="Publishing workflows"
        blurb="Review stages, assignees, due dates and a board that shows where every entry stands."
        wsSlug={workspace}
      />
    );
  }

  function publishFrom(entryId: string) {
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) return;
    if (!publishAllowed) {
      toast.error("Your seat can't publish", { description: "Ask a marketer, developer, or owner to publish." });
      return;
    }
    const stage = stageOfEntry(entry, stages);
    if (stage && !stage.publishGate) {
      const gate = stages.find((s) => s.publishGate);
      toast.error(`Publish from ${gate?.name ?? "the approval stage"}`, {
        description: `Entries publish from the gate stage, so approval stays meaningful. Move it to ${gate?.name ?? "Approved"} first.`,
      });
      return;
    }
    entryActions.publish(entryId);
    toast.success("Entry published");
  }

  function moveTo(entryId: string, stageId: string) {
    const entry = allEntries.find((e) => e.id === entryId);
    if (!entry) return;
    const stage = stageOfEntry(entry, stages);
    if (entry.status !== "published" && stage?.id === stageId) return;
    workflowActions.moveEntry(entryId, stageId);
    toast.success(`Moved to ${stages.find((s) => s.id === stageId)?.name ?? "stage"}`);
  }

  function onDragEnd(ev: DragEndEvent) {
    const entryId = ev.active.data.current?.entryId as string | undefined;
    const target = ev.over?.data.current as { stageId?: string; published?: boolean } | undefined;
    if (!entryId || !target) return;

    if (target.published) {
      publishFrom(entryId);
      return;
    }
    if (target.stageId) {
      const entry = allEntries.find((e) => e.id === entryId);
      if (!entry) return;
      const stage = stageOfEntry(entry, stages);
      if (entry.status !== "published" && stage?.id === target.stageId) return;
      workflowActions.moveEntry(entryId, target.stageId);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* header */}
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[color:var(--border-hairline)] px-5 py-3">
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold tracking-tight text-foreground">Workflow</h1>
          <p className="text-[12px] text-muted-foreground">Every entry, staged from draft to published.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-0.5">
            <ViewToggle icon={LayoutGrid} label="Board" active={view === "board"} onClick={() => setView("board")} />
            <ViewToggle icon={Rows3} label="List" active={view === "list"} onClick={() => setView("list")} />
          </div>
          <SegmentedFilter
            options={[
              { id: "all", label: "All" },
              { id: "mine", label: "Assigned to me", count: mineCount },
              { id: "overdue", label: "Overdue", count: overdueCount },
            ]}
            value={scope}
            onChange={(v) => setScope(v)}
          />
          <select
            value={collectionFilter}
            onChange={(e) => setCollectionFilter(e.target.value)}
            aria-label="Filter by collection"
            className="h-8 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-2 text-[12px] font-medium text-foreground outline-none"
          >
            <option value="all">All collections</option>
            {collections.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setCustomizeOpen(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Settings2 className="h-3.5 w-3.5" /> Customize stages
          </button>
        </div>
      </div>

      {/* board */}
      {view === "board" ? (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragEnd={onDragEnd}>
          <div className="min-h-0 flex-1 overflow-x-auto overflow-y-hidden">
            <div className="flex h-full min-w-max gap-3 p-4">
              {stages.map((stage) => (
                <StageColumn
                  key={stage.id}
                  stage={stage}
                  entries={entries.filter((e) => e.status !== "published" && stageOfEntry(e, stages)?.id === stage.id)}
                  collections={collections}
                  schemas={schemas}
                  canEdit={canEdit}
                  onOpen={setOpenEntry}
                />
              ))}
              {/* built-in terminal column */}
              <PublishedColumn
                entries={entries.filter((e) => e.status === "published")}
                collections={collections}
                schemas={schemas}
                canEdit={canEdit}
                onOpen={setOpenEntry}
              />
            </div>
          </div>
        </DndContext>
      ) : (
        <WorkflowList
          entries={entries}
          stages={stages}
          collections={collections}
          schemas={schemas}
          canEdit={canEdit}
          publishAllowed={publishAllowed}
          onOpen={setOpenEntry}
          onMoveTo={moveTo}
          onPublish={publishFrom}
        />
      )}

      <EntrySlideOver open={!!openEntry} onOpenChange={(v) => !v && setOpenEntry(null)} entryId={openEntry} />
      {customizeOpen && (
        <CustomizeStagesDialog projectId={pr.id} sitePlan={pr.sitePlan ?? "free"} wsSlug={workspace} onClose={() => setCustomizeOpen(false)} />
      )}
    </div>
  );
}

/* ---------------------------------------------------------- view toggle */

function ViewToggle({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof LayoutGrid;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={`${label} view`}
      className={cn(
        "grid h-7 w-7 place-items-center rounded-md transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
    </button>
  );
}

/* ------------------------------------------------------------- list view */

function WorkflowList({
  entries,
  stages,
  collections,
  schemas,
  canEdit,
  publishAllowed,
  onOpen,
  onMoveTo,
  onPublish,
}: {
  entries: Entry[];
  stages: WorkflowStage[];
  collections: Collection[];
  schemas: Schema[];
  canEdit: boolean;
  publishAllowed: boolean;
  onOpen: (id: string) => void;
  onMoveTo: (entryId: string, stageId: string) => void;
  onPublish: (entryId: string) => void;
}) {
  // Order by the board's left-to-right flow: stage order, published last.
  const order = new Map(stages.map((s, i) => [s.id, i]));
  const rank = (e: Entry) => {
    if (e.status === "published") return stages.length + 1;
    const st = stageOfEntry(e, stages);
    return st ? (order.get(st.id) ?? stages.length) : stages.length;
  };
  const rows = [...entries].sort((a, b) => rank(a) - rank(b) || a.title.localeCompare(b.title));

  return (
    <div className="min-h-0 flex-1 overflow-auto">
      {rows.length === 0 ? (
        <div className="grid flex-1 place-items-center p-12 text-[13px] text-muted-foreground">
          No entries match these filters.
        </div>
      ) : (
        <div className="min-w-[720px]">
          {/* header */}
          <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1fr)_140px_150px_120px_88px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--canvas)] px-5 py-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>Entry</span>
            <span>Collection</span>
            <span>Stage</span>
            <span>Due</span>
            <span className="text-right">Assignees</span>
          </div>
          {rows.map((e) => (
            <WorkflowListRow
              key={e.id}
              entry={e}
              stages={stages}
              collections={collections}
              schemas={schemas}
              canEdit={canEdit}
              publishAllowed={publishAllowed}
              onOpen={onOpen}
              onMoveTo={onMoveTo}
              onPublish={onPublish}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowListRow({
  entry,
  stages,
  collections,
  schemas,
  canEdit,
  publishAllowed,
  onOpen,
  onMoveTo,
  onPublish,
}: {
  entry: Entry;
  stages: WorkflowStage[];
  collections: Collection[];
  schemas: Schema[];
  canEdit: boolean;
  publishAllowed: boolean;
  onOpen: (id: string) => void;
  onMoveTo: (entryId: string, stageId: string) => void;
  onPublish: (entryId: string) => void;
}) {
  const col = collections.find((c) => c.id === entry.collectionId);
  const schema = schemas.find((sc) => sc.id === col?.schemaId);
  const imageField = schema?.fields.find((f) => f.type === "image");
  const cover = imageField ? (entry.fields[imageField.name] as string | undefined) : undefined;
  const stage = stageOfEntry(entry, stages);
  const published = entry.status === "published";
  const canChangeStage = canEdit && (stage || published);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(entry.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(entry.id);
        }
      }}
      className="grid w-full cursor-pointer grid-cols-[minmax(0,1fr)_140px_150px_120px_88px] items-center gap-3 border-b border-[color:var(--border-hairline)] px-5 py-2.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {cover ? (
          <img src={cover} alt="" loading="lazy" className="h-8 w-11 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid h-8 w-11 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <Database className="h-3.5 w-3.5" />
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-medium text-foreground">{entry.title}</span>
          {entry.status === "scheduled" && (
            <span className="mt-0.5 inline-flex">
              <PublishBadge state="scheduled" />
            </span>
          )}
        </span>
      </span>
      <span className="truncate text-[12px] text-muted-foreground">{col?.name}</span>
      <span className="min-w-0" onClick={(e) => e.stopPropagation()}>
        {canChangeStage ? (
          <StageDropdown
            entry={entry}
            stage={stage}
            stages={stages}
            published={published}
            publishAllowed={publishAllowed}
            onMoveTo={(stageId) => onMoveTo(entry.id, stageId)}
            onPublish={() => onPublish(entry.id)}
          />
        ) : published ? (
          <PublishBadge state="published" />
        ) : stage ? (
          <StageChip stage={stage} />
        ) : (
          <PublishBadge state={entry.status} />
        )}
      </span>
      <span className="min-w-0">
        {published || !entry.workflowDueDate ? (
          <span className="text-[11px] text-muted-foreground/60">—</span>
        ) : (
          <DueChip iso={entry.workflowDueDate} />
        )}
      </span>
      <span className="flex justify-end">
        {(entry.workflowAssigneeIds ?? []).length > 0 ? (
          <AssigneeStack ids={entry.workflowAssigneeIds} size={20} max={3} />
        ) : (
          <span className="text-[11px] text-muted-foreground/60">—</span>
        )}
      </span>
    </div>
  );
}

/* ------------------------------------------------------- stage dropdown */

function StageDropdown({
  entry,
  stage,
  stages,
  published,
  publishAllowed,
  onMoveTo,
  onPublish,
}: {
  entry: Entry;
  stage: WorkflowStage | undefined;
  stages: WorkflowStage[];
  published: boolean;
  publishAllowed: boolean;
  onMoveTo: (stageId: string) => void;
  onPublish: () => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="group inline-flex items-center gap-1 rounded-md transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          {published ? <PublishBadge state="published" /> : stage ? <StageChip stage={stage} /> : <PublishBadge state={entry.status} />}
          <ChevronDown className="h-3 w-3 text-muted-foreground/50 transition-colors group-hover:text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {stages.map((s) => (
          <DropdownMenuItem key={s.id} disabled={!published && stage?.id === s.id} onSelect={() => onMoveTo(s.id)} className="gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} /> {s.name}
          </DropdownMenuItem>
        ))}
        {!published && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled={!publishAllowed || !stage?.publishGate} onSelect={onPublish} className="gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" /> Publish
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------- columns */

function StageColumn({
  stage,
  entries,
  collections,
  schemas,
  canEdit,
  onOpen,
}: {
  stage: WorkflowStage;
  entries: Entry[];
  collections: Collection[];
  schemas: Schema[];
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <Droppable id={`stage:${stage.id}`} data={{ stageId: stage.id }} disabled={!canEdit}>
      {({ setNodeRef, isOver }) => (
        <div
          ref={setNodeRef}
          className={cn(
            "flex h-full w-[264px] shrink-0 flex-col rounded-xl border bg-[color:var(--s2)]/50 transition-colors",
            isOver ? "border-[color:color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]" : "border-[color:var(--border-hairline)]",
          )}
        >
          <ColumnHeader color={stage.color} name={stage.name} count={entries.length} gate={stage.publishGate} />
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} collections={collections} schemas={schemas} canEdit={canEdit} onOpen={onOpen} />
            ))}
            {entries.length === 0 && (
              <div className="grid h-20 place-items-center rounded-lg border border-dashed border-[color:var(--border-hairline)] text-[11.5px] text-muted-foreground/70">
                Nothing here
              </div>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

function PublishedColumn({
  entries,
  collections,
  schemas,
  canEdit,
  onOpen,
}: {
  entries: Entry[];
  collections: Collection[];
  schemas: Schema[];
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  return (
    <Droppable id="stage:published" data={{ published: true }} disabled={!canEdit}>
      {({ setNodeRef, isOver }) => (
        <div
          ref={setNodeRef}
          className={cn(
            "flex h-full w-[264px] shrink-0 flex-col rounded-xl border bg-[color:var(--s2)]/50 transition-colors",
            isOver ? "border-[color-mix(in_srgb,var(--status-live)_60%,transparent)] bg-[color-mix(in_srgb,var(--status-live)_5%,transparent)]" : "border-[color:var(--border-hairline)]",
          )}
        >
          <div className="flex items-center gap-2 px-3 py-2.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-[var(--status-live)]" />
            <span className="text-[12.5px] font-semibold text-foreground">Published</span>
            <span className="ml-auto rounded-[4px] bg-[color:var(--card)] px-1.5 py-0.5 text-[10.5px] tabular-nums text-muted-foreground">
              {entries.length}
            </span>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
            {entries.map((e) => (
              <EntryCard key={e.id} entry={e} collections={collections} schemas={schemas} canEdit={canEdit} onOpen={onOpen} />
            ))}
            {entries.length === 0 && (
              <div className="grid h-20 place-items-center rounded-lg border border-dashed border-[color:var(--border-hairline)] text-[11.5px] text-muted-foreground/70">
                Drop here to publish
              </div>
            )}
          </div>
        </div>
      )}
    </Droppable>
  );
}

function ColumnHeader({ color, name, count, gate }: { color: string; name: string; count: number; gate?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-[12.5px] font-semibold text-foreground">{name}</span>
      {gate && (
        <span className="rounded bg-[color:var(--card)] px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wider text-muted-foreground" title="Publishing is offered from this stage">
          Gate
        </span>
      )}
      <span className="ml-auto rounded-[4px] bg-[color:var(--card)] px-1.5 py-0.5 text-[10.5px] tabular-nums text-muted-foreground">{count}</span>
    </div>
  );
}

/* ----------------------------------------------------------------- card */

function EntryCard({
  entry,
  collections,
  schemas,
  canEdit,
  onOpen,
}: {
  entry: Entry;
  collections: Collection[];
  schemas: Schema[];
  canEdit: boolean;
  onOpen: (id: string) => void;
}) {
  const col = collections.find((c) => c.id === entry.collectionId);
  const schema = schemas.find((sc) => sc.id === col?.schemaId);
  const imageField = schema?.fields.find((f) => f.type === "image");
  const cover = imageField ? (entry.fields[imageField.name] as string | undefined) : undefined;

  return (
    <Draggable id={`entry:${entry.id}`} data={{ entryId: entry.id }} disabled={!canEdit}>
      {({ setNodeRef, handleProps, style }) => (
        <div
          ref={setNodeRef}
          {...handleProps}
          style={style}
          onClick={() => onOpen(entry.id)}
          className="cursor-pointer rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 shadow-sm transition-shadow hover:shadow-md"
        >
          <div className="flex items-start gap-2.5">
            {cover ? (
              <img src={cover} alt="" loading="lazy" className="h-10 w-14 shrink-0 rounded-md object-cover" />
            ) : (
              <span className="grid h-10 w-14 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
                <Database className="h-4 w-4" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-[12.5px] font-medium leading-snug text-foreground">{entry.title}</div>
              <div className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{col?.name}</div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {entry.status === "scheduled" && <PublishBadge state="scheduled" />}
            <DueChip iso={entry.status === "published" ? undefined : entry.workflowDueDate} />
            <span className="ml-auto">
              <AssigneeStack ids={entry.workflowAssigneeIds} size={18} max={3} />
            </span>
          </div>
        </div>
      )}
    </Draggable>
  );
}
