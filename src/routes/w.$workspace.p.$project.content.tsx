import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, ArrowUpRight, ChevronDown, ChevronRight, Copy, Database, FileText, Folder, FolderInput, FolderOpen, FolderPlus, GripVertical, MoreHorizontal, Plus, Rocket, Settings2, Trash2 } from "lucide-react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { entries, schemas } from "@/lib/cms/mock-data";
import { collectionActions, useCMS } from "@/lib/cms/store";
import type { Collection } from "@/lib/cms/types";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useProjectPresence } from "@/lib/workspace/presence-store";
import { PresenceStack } from "@/components/cms/presence/Presence";
import { newPageId, pagesActions, usePages, type PageDoc, type PageState } from "@/lib/cms/pages-store";
import { collectionUrlBase, descendantIds, eligibleParents, folderActions, folderTrail, folderUrlPrefix, useFolders } from "@/lib/cms/folders-store";
import { NewPageDialog } from "@/components/cms/pages/NewPageDialog";
import { FolderDialog } from "@/components/cms/pages/FolderDialog";
import { Draggable, Droppable, mergeRefs } from "@/components/cms/pages/tree-dnd";
import { Paginator, clampPage, type PageSize } from "@/components/cms/Paginator";
import { getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import { PublishMenu } from "@/components/cms/editor/PublishMenu";
import { PageSettingsDialog } from "@/components/cms/editor/PageSettingsDialog";
import { canCompose, canPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PageShell, Section } from "@/components/cms/layout";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/cms/format-time";
import { GenerateMenu } from "@/components/cms/generate/GenerateMenu";
import { GenerationBatchBar } from "@/components/cms/generate/GenerationBatchBar";
import { agentRunActions } from "@/lib/agent/runs-store";
import { MarkdownManager } from "@/components/cms/markdown/MarkdownManager";
import { pageToMarkdown } from "@/lib/md/serialize";
import { ListToolbar, SegmentedFilter } from "@/components/cms/ListToolbar";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/p/$project/content")({
  validateSearch: (s: Record<string, unknown>): { view?: "pages" | "content" | "markdown"; batch?: string } => ({
    view: s.view === "content" ? "content" : s.view === "markdown" ? "markdown" : undefined,
    batch: typeof s.batch === "string" && s.batch.length > 0 ? s.batch : undefined,
  }),
  component: ContentPage,
});

const PAGE_TONE: Record<PageState, { label: string; dot: string; text: string }> = {
  draft: { label: "Draft", dot: "bg-muted-foreground/50", text: "text-muted-foreground" },
  published: { label: "Published", dot: "bg-emerald-400", text: "text-emerald-600" },
  modified: { label: "Unpublished changes", dot: "bg-amber-400", text: "text-amber-600" },
  scheduled: { label: "Scheduled", dot: "bg-sky-400", text: "text-sky-600" },
  archived: { label: "Archived", dot: "bg-muted-foreground/40", text: "text-muted-foreground/70" },
};

function ContentPage() {
  const { workspace, project } = Route.useParams();
  const { view, batch } = Route.useSearch();
  const pr = getProjectBySlug(workspace, project)!;
  const staging = `${pr.slug}.bettercms.site`;
  const allPages = usePages(pr.id);
  const presencePeers = useProjectPresence(pr.id);
  const batchRun = batch ? agentRunActions.get(batch) : undefined;
  const pages = batchRun ? allPages.filter((p) => p.batchId === batchRun.id) : allPages;
  const [pageQuery, setPageQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PageState>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "static" | "generated" | "collection">("all");
  const [sort, setSort] = useState<"recent" | "name" | "path">("recent");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize>(50);
  const folders = useFolders(pr.id);
  const allCollections = useCMS((s) => s.collections);
  const cols = allCollections.filter((c) => c.projectId === pr.id);
  const pq = pageQuery.trim().toLowerCase();
  const hasGenerated = allPages.some((p) => p.batchId);
  const filtersActive = pq !== "" || statusFilter !== "all" || typeFilter !== "all";
  // Search, filters and sort only apply to the full list, not a batch review.
  const filteredPages = batchRun
    ? pages
    : [...pages]
        .filter(
          (p) =>
            (statusFilter === "all" || p.state === statusFilter) &&
            (typeFilter === "all" || (typeFilter === "generated" ? !!p.batchId : !p.batchId)) &&
            (pq === "" || p.title.toLowerCase().includes(pq) || p.path.toLowerCase().includes(pq)),
        )
        .sort((a, b) =>
          sort === "recent" ? b.updatedAt - a.updatedAt : sort === "name" ? a.title.localeCompare(b.title) : a.path.localeCompare(b.path),
        );

  const pageNav = clampPage(pageIndex, filteredPages.length, pageSize);
  const pagedPages = batchRun ? filteredPages : filteredPages.slice(pageNav * pageSize, (pageNav + 1) * pageSize);

  // A loose page (no explicit folder) still groups by its first path segment
  // so generated batches like /lp and /for read as folders.
  const virtualFolderOf = (p: PageDoc) => {
    if (p.folderId) return null;
    const segs = p.path.split("/").filter(Boolean);
    return segs.length > 1 ? `/${segs[0]}` : null;
  };

  type RowItem =
    | { kind: "page"; pg: PageDoc; depth: number }
    | { kind: "collection"; col: Collection; depth: number }
    | { kind: "folder"; key: string; name: string; slug: string; count: number; depth: number; folderId?: string };
  const rowItems: RowItem[] = [];

  // Collection pages join the same tree as static pages. They show unless the
  // status filter (a page state) is set, or the type filter excludes them.
  const showCols = !batchRun && statusFilter === "all" && (typeFilter === "all" || typeFilter === "collection");
  const treeCols = showCols
    ? cols.filter((c) => pq === "" || c.name.toLowerCase().includes(pq) || c.slug.toLowerCase().includes(pq))
    : [];

  if (batchRun) {
    for (const pg of pagedPages) rowItems.push({ kind: "page", pg, depth: 0 });
  } else {
    const pagesByFolder = new Map<string, PageDoc[]>();
    const loose: PageDoc[] = [];
    for (const p of pagedPages) {
      if (p.folderId) pagesByFolder.set(p.folderId, [...(pagesByFolder.get(p.folderId) ?? []), p]);
      else loose.push(p);
    }
    const colsByFolder = new Map<string, Collection[]>();
    const rootCols: Collection[] = [];
    for (const c of treeCols) {
      if (c.folderId) colsByFolder.set(c.folderId, [...(colsByFolder.get(c.folderId) ?? []), c]);
      else rootCols.push(c);
    }
    const childFolders = (parentId: string | null) =>
      folders.filter((f) => f.parentId === parentId).sort((a, b) => a.name.localeCompare(b.name));
    // A folder's total counts both static pages and collection pages under it.
    const totalUnder = (fid: string): number => {
      let n = (pagesByFolder.get(fid)?.length ?? 0) + (colsByFolder.get(fid)?.length ?? 0);
      for (const c of childFolders(fid)) n += totalUnder(c.id);
      return n;
    };
    const walk = (parentId: string | null, depth: number) => {
      for (const f of childFolders(parentId)) {
        const count = totalUnder(f.id);
        // Empty folders show only in the plain, unfiltered, first-page view.
        if (count === 0 && (filtersActive || pageNav > 0)) continue;
        rowItems.push({ kind: "folder", key: f.id, name: f.name, slug: f.slug, count, depth, folderId: f.id });
        if (!collapsed.has(f.id)) {
          walk(f.id, depth + 1);
          for (const pg of pagesByFolder.get(f.id) ?? []) rowItems.push({ kind: "page", pg, depth: depth + 1 });
          for (const c of colsByFolder.get(f.id) ?? []) rowItems.push({ kind: "collection", col: c, depth: depth + 1 });
        }
      }
    };
    // Root-level pages and virtual (path-derived) folders first, then real folders.
    const virtual = new Map<string, PageDoc[]>();
    const rootPages: PageDoc[] = [];
    for (const p of loose) {
      const v = virtualFolderOf(p);
      if (v) virtual.set(v, [...(virtual.get(v) ?? []), p]);
      else rootPages.push(p);
    }
    for (const pg of rootPages) rowItems.push({ kind: "page", pg, depth: 0 });
    for (const c of rootCols) rowItems.push({ kind: "collection", col: c, depth: 0 });
    for (const [name, list] of [...virtual.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rowItems.push({ kind: "folder", key: name, name, slug: name.replace(/^\//, ""), count: list.length, depth: 0 });
      if (!collapsed.has(name)) for (const pg of list) rowItems.push({ kind: "page", pg, depth: 1 });
    }
    walk(null, 0);
  }
  const toggleFolder = (key: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const { effective } = useEffectiveRole(workspace);
  const canBuild = canCompose(effective);
  const showPublish = canPublish(effective);
  const navigate = useNavigate();

  const isContent = view === "content";
  const isMarkdown = view === "markdown";
  const [settingsPage, setSettingsPage] = useState<PageDoc | null>(null);
  const [publishFor, setPublishFor] = useState<{ page: PageDoc; rect: { top: number; left: number } } | null>(null);
  const [newPageOpen, setNewPageOpen] = useState(false);
  const [folderDialog, setFolderDialog] = useState<{ folder: Parameters<typeof FolderDialog>[0]["folder"] } | "new" | null>(null);
  const [colPage, setColPage] = useState(0);
  const [colSize, setColSize] = useState<PageSize>(50);
  const colNav = clampPage(colPage, cols.length, colSize);
  const pagedCols = cols.slice(colNav * colSize, (colNav + 1) * colSize);

  function deleteFolder(folderId: string) {
    const removed = folderActions.remove(pr.id, folderId);
    pagesActions.clearFolders(pr.id, removed);
    collectionActions.clearFolders(pr.id, removed);
    toast.success("Folder removed. Pages inside moved to the top level.");
  }

  // The URL a page actually serves at: its own slug under any URL-folder
  // prefix. A page dragged into a folder keeps its short path, so we compose
  // the effective URL for display rather than rewriting the stored path.
  function effectiveUrl(pg: PageDoc) {
    const prefix = folderUrlPrefix(folders, pg.folderId ?? null);
    if (!prefix) return pg.path;
    const last = pg.path.split("/").filter(Boolean).pop() ?? "";
    return `${prefix}/${last}`;
  }

  function duplicate(pg: PageDoc) {
    let path = `${pg.path}-copy`;
    let n = 1;
    while (allPages.some((p) => p.path === path)) path = `${pg.path}-copy-${++n}`;
    pagesActions.add(pr.id, {
      ...pg,
      id: newPageId(),
      path,
      title: `${pg.title} copy`,
      state: "draft",
      staged: false,
      updatedAt: Date.now(),
      sections: pg.sections.map((s) => ({ ...s })),
    });
  }

  /* -------------------------------------------------- drag to organize */
  // Drag a page onto a folder to move it in, or a folder onto a folder to
  // nest it. Row order still follows the Sort dropdown; drag only changes
  // folder membership and nesting.
  const [drag, setDrag] = useState<{ id: string; type: "page" | "folder"; label: string } | null>(null);
  const dndOff = !canBuild || !!batchRun;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );
  const foldersById = new Map(folders.map((f) => [f.id, f]));
  const folderHeight = (fid: string): number => {
    const kids = folders.filter((f) => f.parentId === fid);
    return kids.length === 0 ? 0 : 1 + Math.max(...kids.map((k) => folderHeight(k.id)));
  };
  // While dragging a folder, its own subtree can't be a drop target.
  const draggingFolderId = drag?.type === "folder" ? drag.id.slice("folder:".length) : null;
  const blockedTargets = draggingFolderId ? new Set([draggingFolderId, ...descendantIds(folders, draggingFolderId)]) : null;

  const onDragStart = (e: DragStartEvent) => {
    const d = e.active.data.current as { type: "page" | "folder"; label: string } | undefined;
    if (d) setDrag({ id: String(e.active.id), type: d.type, label: d.label });
  };
  const onDragEnd = (e: DragEndEvent) => {
    setDrag(null);
    const a = e.active.data.current as { type: "page" | "folder"; path?: string; folderId?: string } | undefined;
    const o = e.over?.data.current as { type: "folder" | "root"; folderId?: string } | undefined;
    if (!a || !o) return;
    const target = o.type === "root" ? null : o.folderId ?? null;
    if (a.type === "page" && a.path != null) {
      const pg = pages.find((p) => p.path === a.path);
      if (!pg || (pg.folderId ?? null) === target) return;
      pagesActions.setFolder(pr.id, a.path, target);
      toast.success(target ? `Moved to ${folderTrail(folders, target)}` : "Moved to top level");
    } else if (a.type === "folder" && a.folderId) {
      if ((foldersById.get(a.folderId)?.parentId ?? null) === target) return;
      if (target === null) {
        folderActions.update(pr.id, a.folderId, { parentId: null });
        toast.success("Moved to top level");
        return;
      }
      const ok = eligibleParents(folders, a.folderId, folderHeight(a.folderId)).some((f) => f.id === target);
      if (!ok) {
        toast.error("Can't nest there. That would go too deep.");
        return;
      }
      folderActions.update(pr.id, a.folderId, { parentId: target });
      toast.success(`Nested in ${folderTrail(folders, target)}`);
    }
  };

  return (
    <PageShell
      breadcrumbs={[
        { label: workspace, to: "/w/$workspace", params: { workspace } },
        { label: pr.name, to: "/w/$workspace/p/$project/content", params: { workspace, project } },
        { label: isContent ? "Content" : isMarkdown ? "Markdown" : "Pages" },
      ]}
      title={isContent ? "Content" : isMarkdown ? "Markdown" : "Pages"}
      description={
        isContent
          ? "Structured collections that power your pages and API."
          : isMarkdown
            ? "Everything on this site, served as markdown for agents and answer engines."
            : "Every page on your site. Open one to edit it visually."
      }
      actions={
        !isContent && !isMarkdown && canBuild ? (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => setFolderDialog("new")}>
              <FolderPlus className="mr-1 h-3.5 w-3.5" /> New folder
            </Button>
            <GenerateMenu projectId={pr.id} workspace={workspace} project={project} sitePlan={pr.sitePlan ?? "free"} />
            <Button size="sm" onClick={() => setNewPageOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New page
            </Button>
          </div>
        ) : undefined
      }
    >
      {isContent ? (
        <Section title="Collections" meta={`${cols.length} ${cols.length === 1 ? "collection" : "collections"}`}>
          {cols.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[color:var(--border-hairline)] bg-[color:var(--surface-3)] p-12 text-center">
              <Database className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <h3 className="mt-3 text-[14px] font-semibold text-foreground">No collections yet</h3>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Collections model repeatable structured content, like blog posts or authors.
              </p>
            </div>
          ) : (
            <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {pagedCols.map((c) => {
                const sch = schemas.find((s) => s.id === c.schemaId);
                const count = entries.filter((e) => e.collectionId === c.id).length;
                return (
                  <Link
                    key={c.id}
                    to="/w/$workspace/p/$project/editor"
                    params={{ workspace, project }}
                    search={{ scope: "collections" as const, node: `collection:${c.id}`, section: undefined }}
                    className="group rounded-xl border border-[color:var(--border-hairline)] bg-card p-4 transition-colors hover:border-[color:var(--color-border-strong)] hover:bg-[var(--s4)]"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
                        <Database className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[13.5px] font-semibold text-foreground">{c.name}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">/{c.slug}</div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100" />
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                      <span className="tabular-nums">{count} {count === 1 ? "entry" : "entries"}</span>
                      <span className="tabular-nums">{sch?.fields.length ?? 0} fields</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            {cols.length > colSize && (
              <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
                <Paginator total={cols.length} page={colNav} size={colSize} onPage={setColPage} onSize={(s) => { setColSize(s); setColPage(0); }} noun="collection" />
              </div>
            )}
            </>
          )}
        </Section>
      ) : (
        <>
        <div className="mb-3 flex w-fit items-center gap-0.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-0.5">
          {(
            [
              { label: "Pages", search: {} as Record<string, unknown>, active: !isMarkdown },
              { label: "Markdown", search: { view: "markdown" }, active: isMarkdown },
            ]
          ).map((v) => (
            <Link
              key={v.label}
              to="/w/$workspace/p/$project/content"
              params={{ workspace, project }}
              search={v.search as never}
              className={cn(
                "rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
                v.active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {v.label}
            </Link>
          ))}
        </div>
        {isMarkdown ? (
          <MarkdownManager projectId={pr.id} siteName={pr.name} domain={pr.domain ?? staging} canEdit={canBuild} />
        ) : (
        <>
        {batchRun && (
          <GenerationBatchBar
            projectId={pr.id}
            run={batchRun}
            pages={pages}
            canPublish={showPublish}
            onDismiss={() => navigate({ to: "/w/$workspace/p/$project/content", params: { workspace, project }, search: {} })}
          />
        )}
        {!batchRun && (
          <ListToolbar query={pageQuery} onQuery={setPageQuery} placeholder="Search pages">
            <SegmentedFilter<"all" | PageState>
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { id: "all", label: "All", count: pages.length },
                { id: "published", label: "Published", count: pages.filter((p) => p.state === "published").length },
                { id: "draft", label: "Draft", count: pages.filter((p) => p.state === "draft").length },
                { id: "scheduled", label: "Scheduled", count: pages.filter((p) => p.state === "scheduled").length },
              ]}
            />
            {(hasGenerated || cols.length > 0) && (
              <SegmentedFilter<"all" | "static" | "generated" | "collection">
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { id: "all", label: "All types" },
                  { id: "static", label: "Static" },
                  ...(hasGenerated ? [{ id: "generated" as const, label: "Generated" }] : []),
                  ...(cols.length > 0 ? [{ id: "collection" as const, label: "Collections" }] : []),
                ]}
              />
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {sort === "recent" ? "Recently edited" : sort === "name" ? "Name" : "Path"}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[170px]">
                {(
                  [
                    ["recent", "Recently edited"],
                    ["name", "Name"],
                    ["path", "Path"],
                  ] as const
                ).map(([id, label]) => (
                  <DropdownMenuItem key={id} className="justify-between text-[13px]" onSelect={() => setSort(id)}>
                    {label}
                    {sort === id && <span className="text-primary">•</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </ListToolbar>
        )}
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDrag(null)}>
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <div className="grid grid-cols-[1fr_92px_64px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:grid-cols-[1fr_150px_130px_76px]">
            <span>Page</span>
            <span>Status</span>
            <span className="hidden sm:block">Updated</span>
            <span />
          </div>
          {drag && (
            <Droppable id="root" data={{ type: "root" }} disabled={dndOff}>
              {({ setNodeRef, isOver }) => (
                <div
                  ref={setNodeRef}
                  className={cn(
                    "flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-4 py-2 text-[11.5px] font-medium transition-colors",
                    isOver ? "bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary" : "bg-[color:var(--s2)]/60 text-muted-foreground",
                  )}
                >
                  <FolderInput className="h-3.5 w-3.5" /> Drop here to move to the top level
                </div>
              )}
            </Droppable>
          )}
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {rowItems.length === 0 && (
              <li className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">No pages match your search.</li>
            )}
            {rowItems.map((item) => {
              if (item.kind === "folder") {
                const open = !collapsed.has(item.key);
                const isReal = !!item.folderId;
                const dropDisabled = dndOff || !isReal || (blockedTargets?.has(item.folderId ?? "") ?? false);
                const dragDisabled = dndOff || !isReal;
                return (
                  <Droppable key={`folder:${item.key}`} id={`folder:${item.folderId ?? item.key}`} data={{ type: "folder", folderId: item.folderId }} disabled={dropDisabled}>
                    {({ setNodeRef: dropRef, isOver }) => (
                      <Draggable id={`folder:${item.folderId ?? item.key}`} data={{ type: "folder", folderId: item.folderId, label: item.name }} disabled={dragDisabled}>
                        {({ setNodeRef: dragRef, handleProps, style }) => (
                          <li
                            ref={mergeRefs(dropRef, dragRef)}
                            style={style}
                            className={cn(
                              "group relative grid grid-cols-[1fr_44px] items-center bg-[color:var(--s2)]/60 transition-colors hover:bg-[var(--s4)]",
                              isOver && "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] ring-1 ring-inset ring-[color:color-mix(in_oklab,var(--primary)_55%,transparent)]",
                            )}
                          >
                            {!dragDisabled && (
                              <button
                                type="button"
                                aria-label={`Drag ${item.name}`}
                                {...handleProps}
                                style={{ left: item.depth * 22 }}
                                className="absolute top-1/2 z-10 grid h-6 w-4 -translate-y-1/2 cursor-grab touch-none place-items-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
                              >
                                <GripVertical className="h-3.5 w-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => toggleFolder(item.key)}
                              aria-expanded={open}
                              className="flex w-full items-center gap-2.5 py-2 pr-2 text-left"
                              style={{ paddingLeft: 16 + item.depth * 22 }}
                            >
                              {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                              {open ? <FolderOpen className="h-4 w-4 shrink-0 text-primary/70" /> : <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              <span className="text-[12.5px] font-semibold text-foreground">{item.name}</span>
                              {isReal && !item.slug && <span className="rounded bg-[color:var(--s2)] px-1 text-[9.5px] font-medium text-muted-foreground">organizer</span>}
                              {item.slug && <span className="font-mono text-[10.5px] text-muted-foreground/80">/{item.slug}</span>}
                              <span className="text-[11px] tabular-nums text-muted-foreground">{item.count} {item.count === 1 ? "page" : "pages"}</span>
                            </button>
                            {canBuild && isReal && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button type="button" aria-label={`Folder actions for ${item.name}`} className="mr-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 max-md:opacity-100 data-[state=open]:opacity-100">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-[170px]">
                                  <DropdownMenuItem className="text-[13px]" onSelect={() => setNewPageOpen(true)}>
                                    <Plus className="mr-2 h-3.5 w-3.5" /> New page here
                                  </DropdownMenuItem>
                                  <DropdownMenuItem className="text-[13px]" onSelect={() => setFolderDialog({ folder: folders.find((f) => f.id === item.folderId) ?? null })}>
                                    <Settings2 className="mr-2 h-3.5 w-3.5" /> Rename or move
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive" onSelect={() => deleteFolder(item.folderId!)}>
                                    <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete folder
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </li>
                        )}
                      </Draggable>
                    )}
                  </Droppable>
                );
              }
              if (item.kind === "collection") {
                const c = item.col;
                const count = entries.filter((e) => e.collectionId === c.id).length;
                const base = collectionUrlBase(folders, c.folderId ?? null, c.slug);
                return (
                  <li
                    key={c.id}
                    className="group relative grid grid-cols-[1fr_92px_64px] items-center gap-3 py-2.5 pr-4 transition-colors hover:bg-[var(--s4)] sm:grid-cols-[1fr_150px_130px_76px]"
                    style={{ paddingLeft: 16 + item.depth * 22 }}
                  >
                    <Link
                      to="/w/$workspace/p/$project/editor"
                      params={{ workspace, project }}
                      search={{ scope: "collections" as const, node: `collection:${c.id}`, section: undefined }}
                      className="flex min-w-0 items-center gap-2.5"
                    >
                      <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-foreground">{c.name}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{base}/:slug</div>
                      </div>
                    </Link>
                    <span className="hidden items-center gap-1.5 text-[12px] sm:inline-flex">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--primary)]/70" />
                      <span className="text-muted-foreground">Dynamic</span>
                    </span>
                    <span className="hidden text-[11.5px] tabular-nums text-muted-foreground sm:block">{count} {count === 1 ? "entry" : "entries"}</span>
                    <span className="flex items-center justify-end gap-0.5">
                      {canBuild && (
                        <>
                          <Link
                            to="/w/$workspace/p/$project/schema"
                            params={{ workspace, project }}
                            aria-label={`Settings for ${c.name}`}
                            title="Collection settings"
                            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 max-md:opacity-100"
                          >
                            <Settings2 className="h-4 w-4" />
                          </Link>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button type="button" aria-label={`Actions for ${c.name}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 max-md:opacity-100 data-[state=open]:opacity-100">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-[190px]">
                              <DropdownMenuItem className="text-[13px]" onSelect={() => navigate({ to: "/w/$workspace/p/$project/editor", params: { workspace, project }, search: { scope: "collections", node: `collection:${c.id}`, section: undefined } })}>
                                <ArrowUpRight className="mr-2 h-3.5 w-3.5" /> Open entries
                              </DropdownMenuItem>
                              <DropdownMenuSub>
                                <DropdownMenuSubTrigger className="text-[13px]">
                                  <FolderInput className="mr-2 h-3.5 w-3.5" /> Move to folder
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="max-h-[280px] w-[220px] overflow-y-auto">
                                  <DropdownMenuItem className="text-[13px]" disabled={!c.folderId} onSelect={() => collectionActions.setFolder(pr.id, c.id, null)}>
                                    Top level
                                    {!c.folderId && <span className="ml-auto text-primary">•</span>}
                                  </DropdownMenuItem>
                                  {folders.length > 0 && <DropdownMenuSeparator />}
                                  {folders.map((f) => (
                                    <DropdownMenuItem
                                      key={f.id}
                                      className="text-[13px]"
                                      disabled={c.folderId === f.id}
                                      onSelect={() => {
                                        collectionActions.setFolder(pr.id, c.id, f.id);
                                        const prefix = folderUrlPrefix(folders, f.id);
                                        toast.success(prefix ? `Moved to ${folderTrail(folders, f.id)} · ${prefix}/${c.slug}/:slug` : `Moved to ${folderTrail(folders, f.id)}`);
                                      }}
                                    >
                                      <span className="truncate">{folderTrail(folders, f.id)}</span>
                                      {c.folderId === f.id && <span className="ml-auto text-primary">•</span>}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuSubContent>
                              </DropdownMenuSub>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </span>
                  </li>
                );
              }
              const pg = item.pg;
              const tone = PAGE_TONE[pg.state];
              const kinds = [...new Set(pg.sections.map((s) => getSectionDef(s.type)?.name).filter(Boolean))];
              return (
                <Draggable key={pg.id} id={`page:${pg.path}`} data={{ type: "page", path: pg.path, label: pg.title }} disabled={dndOff}>
                  {({ setNodeRef, handleProps, style }) => (
                <li ref={setNodeRef} className="group relative grid grid-cols-[1fr_92px_64px] items-center gap-3 py-2.5 pr-4 transition-colors hover:bg-[var(--s4)] sm:grid-cols-[1fr_150px_130px_76px]" style={{ ...style, paddingLeft: 16 + item.depth * 22 }}>
                  {!dndOff && (
                    <button
                      type="button"
                      aria-label={`Drag ${pg.title}`}
                      {...handleProps}
                      style={{ left: item.depth * 22 }}
                      className="absolute top-1/2 z-10 grid h-6 w-4 -translate-y-1/2 cursor-grab touch-none place-items-center text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 active:cursor-grabbing"
                    >
                      <GripVertical className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ page: pg.path }} className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-foreground">{pg.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{effectiveUrl(pg)}</span>
                        {kinds.length > 0 && <span className="text-muted-foreground/70"> · {pg.sections.length} sections</span>}
                      </div>
                    </div>
                  </Link>

                  {showPublish ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        setPublishFor({ page: pg, rect: { top: Math.min(r.bottom + 6, window.innerHeight - 508), left: Math.min(r.left, window.innerWidth - 366) } });
                      }}
                      className="inline-flex w-fit min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-[color:var(--color-row-hover)]"
                      title="Publish settings"
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
                      <span className={cn("truncate", tone.text)}>{tone.label}</span>
                      {pg.staged && <span className="hidden rounded bg-[color:var(--s2)] px-1 text-[9.5px] font-medium text-muted-foreground sm:inline">staging</span>}
                    </button>
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-1.5 text-[12px]">
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", tone.dot)} />
                      <span className={cn("truncate", tone.text)}>{tone.label}</span>
                    </span>
                  )}

                  <span className="hidden text-[11.5px] text-muted-foreground sm:block">{formatRelative(new Date(pg.updatedAt).toISOString())}</span>

                  <span className="flex items-center justify-end gap-0.5">
                  <PresenceStack
                    peers={presencePeers.filter((p) => p.surface === "canvas" && p.pagePath === pg.path && p.status === "active")}
                    size={18}
                    max={2}
                  />
                  {canBuild && (
                    <button
                      type="button"
                      aria-label={`Page settings for ${pg.title}`}
                      title="Page settings & SEO"
                      onClick={() => setSettingsPage(pg)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 max-md:opacity-100"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Actions for ${pg.title}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 max-md:opacity-100 data-[state=open]:opacity-100">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[180px]">
                      <DropdownMenuItem className="text-[13px]" onSelect={() => navigate({ to: "/w/$workspace/p/$project/visual", params: { workspace, project }, search: { page: pg.path } })}>
                        <ArrowUpRight className="mr-2 h-3.5 w-3.5" /> Open in editor
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-[13px]"
                        onSelect={() => {
                          navigator.clipboard.writeText(pageToMarkdown({ name: pr.name, domain: pr.domain ?? staging }, pg));
                          toast.success("Page copied as markdown");
                        }}
                      >
                        <Copy className="mr-2 h-3.5 w-3.5" /> Copy as Markdown
                      </DropdownMenuItem>
                      {canBuild && (
                        <DropdownMenuItem className="text-[13px]" onSelect={() => setSettingsPage(pg)}>
                          <Settings2 className="mr-2 h-3.5 w-3.5" /> Page settings & SEO
                        </DropdownMenuItem>
                      )}
                      {showPublish && (
                        <DropdownMenuItem
                          className="text-[13px]"
                          onSelect={(e) => {
                            const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            setPublishFor({ page: pg, rect: { top: Math.min(r.top, window.innerHeight - 508), left: Math.min(r.left, window.innerWidth - 366) } });
                          }}
                        >
                          <Rocket className="mr-2 h-3.5 w-3.5" /> Publish
                        </DropdownMenuItem>
                      )}
                      {canBuild && (
                        <>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger className="text-[13px]">
                              <FolderInput className="mr-2 h-3.5 w-3.5" /> Move to folder
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="max-h-[280px] w-[220px] overflow-y-auto">
                              <DropdownMenuItem className="text-[13px]" disabled={!pg.folderId} onSelect={() => pagesActions.setFolder(pr.id, pg.path, null)}>
                                Top level
                                {!pg.folderId && <span className="ml-auto text-primary">•</span>}
                              </DropdownMenuItem>
                              {folders.length > 0 && <DropdownMenuSeparator />}
                              {folders.map((f) => (
                                <DropdownMenuItem key={f.id} className="text-[13px]" disabled={pg.folderId === f.id} onSelect={() => pagesActions.setFolder(pr.id, pg.path, f.id)}>
                                  <span className="truncate">{folderTrail(folders, f.id)}</span>
                                  {pg.folderId === f.id && <span className="ml-auto text-primary">•</span>}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[13px]" onSelect={() => duplicate(pg)}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive" onSelect={() => pagesActions.remove(pr.id, pg.path)}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  </span>
                </li>
                  )}
                </Draggable>
              );
            })}
          </ul>
          {canBuild && !batchRun && (
            <button type="button" onClick={() => setNewPageOpen(true)} className="flex w-full items-center gap-2 border-t border-[color:var(--border-hairline)] px-4 py-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--s4)]">
              <Plus className="h-3.5 w-3.5" /> New page
            </button>
          )}
          {!batchRun && (
            <Paginator
              total={filteredPages.length}
              page={pageNav}
              size={pageSize}
              onPage={setPageIndex}
              onSize={(s) => {
                setPageSize(s);
                setPageIndex(0);
              }}
              noun="page"
            />
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {drag && (
            <div className="pointer-events-none inline-flex items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 py-1.5 text-[12.5px] font-medium text-foreground shadow-lg">
              {drag.type === "folder" ? <Folder className="h-3.5 w-3.5 text-muted-foreground" /> : <FileText className="h-3.5 w-3.5 text-muted-foreground" />}
              {drag.label}
            </div>
          )}
        </DragOverlay>
        </DndContext>
        </>
        )}
        </>
      )}

      {settingsPage && (
        <PageSettingsDialog
          projectId={pr.id}
          page={settingsPage}
          staging={staging}
          onClose={() => setSettingsPage(null)}
          onDelete={() => pagesActions.remove(pr.id, settingsPage.path)}
        />
      )}
      {publishFor && (
        <PublishMenu
          projectId={pr.id}
          page={publishFor.page}
          staging={staging}
          domain={pr.domain}
          portal
          rect={publishFor.rect}
          onClose={() => setPublishFor(null)}
        />
      )}
      {newPageOpen && (
        <NewPageDialog projectId={pr.id} workspace={workspace} project={project} onClose={() => setNewPageOpen(false)} />
      )}
      {folderDialog && (
        <FolderDialog
          projectId={pr.id}
          folder={folderDialog === "new" ? null : folderDialog.folder}
          onClose={() => setFolderDialog(null)}
        />
      )}
    </PageShell>
  );
}
