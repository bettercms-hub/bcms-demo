import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpDown, ArrowUpRight, ChevronDown, ChevronRight, Copy, Database, FileText, Folder, MoreHorizontal, Plus, Rocket, Settings2, Trash2 } from "lucide-react";
import { collections, entries, schemas } from "@/lib/cms/mock-data";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { newPageId, pagesActions, usePages, type PageDoc, type PageState } from "@/lib/cms/pages-store";
import { getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import { PublishMenu } from "@/components/cms/editor/PublishMenu";
import { PageSettingsDialog } from "@/components/cms/editor/PageSettingsDialog";
import { canCompose, canPublish, useEffectiveRole } from "@/lib/workspace/my-role";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  const batchRun = batch ? agentRunActions.get(batch) : undefined;
  const pages = batchRun ? allPages.filter((p) => p.batchId === batchRun.id) : allPages;
  const [pageQuery, setPageQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | PageState>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "static" | "generated">("all");
  const [sort, setSort] = useState<"recent" | "name" | "path">("recent");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const pq = pageQuery.trim().toLowerCase();
  const hasGenerated = allPages.some((p) => p.batchId);
  // Search, filters and sort only apply to the full list, not a batch review.
  const visiblePages = batchRun
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

  // Folders derive from the URL structure: /lp/paris and /lp/lyon group
  // under /lp. Single-segment pages stay flat at the top.
  const folderOf = (p: PageDoc) => {
    const segs = p.path.split("/").filter(Boolean);
    return segs.length > 1 ? `/${segs[0]}` : null;
  };
  type RowItem = { kind: "page"; pg: PageDoc; nested?: boolean } | { kind: "folder"; name: string; count: number };
  const rowItems: RowItem[] = [];
  if (batchRun) {
    for (const pg of visiblePages) rowItems.push({ kind: "page", pg });
  } else {
    const rootPages = visiblePages.filter((p) => folderOf(p) === null);
    const folders = new Map<string, PageDoc[]>();
    for (const p of visiblePages) {
      const f = folderOf(p);
      if (f) folders.set(f, [...(folders.get(f) ?? []), p]);
    }
    for (const pg of rootPages) rowItems.push({ kind: "page", pg });
    for (const [name, list] of [...folders.entries()].sort(([a], [b]) => a.localeCompare(b))) {
      rowItems.push({ kind: "folder", name, count: list.length });
      if (!collapsed.has(name)) for (const pg of list) rowItems.push({ kind: "page", pg, nested: true });
    }
  }
  const toggleFolder = (name: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  const cols = collections.filter((c) => c.projectId === pr.id);
  const { effective } = useEffectiveRole(workspace);
  const canBuild = canCompose(effective);
  const showPublish = canPublish(effective);
  const navigate = useNavigate();

  const isContent = view === "content";
  const isMarkdown = view === "markdown";
  const [settingsPage, setSettingsPage] = useState<PageDoc | null>(null);
  const [publishFor, setPublishFor] = useState<{ page: PageDoc; rect: { top: number; left: number } } | null>(null);

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
            <GenerateMenu projectId={pr.id} workspace={workspace} project={project} sitePlan={pr.sitePlan ?? "free"} />
            <Button asChild size="sm">
              <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ new: true }}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                New page
              </Link>
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
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {cols.map((c) => {
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
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-[11.5px] text-muted-foreground">
                      <span className="tabular-nums">{count} {count === 1 ? "entry" : "entries"}</span>
                      <span className="tabular-nums">{sch?.fields.length ?? 0} fields</span>
                    </div>
                  </Link>
                );
              })}
            </div>
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
            {hasGenerated && (
              <SegmentedFilter<"all" | "static" | "generated">
                value={typeFilter}
                onChange={setTypeFilter}
                options={[
                  { id: "all", label: "All types" },
                  { id: "static", label: "Static" },
                  { id: "generated", label: "Generated" },
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
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <div className="grid grid-cols-[1fr_150px_130px_76px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Page</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {rowItems.length === 0 && (
              <li className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">No pages match your search.</li>
            )}
            {rowItems.map((item) => {
              if (item.kind === "folder") {
                const open = !collapsed.has(item.name);
                return (
                  <li key={`folder:${item.name}`}>
                    <button
                      type="button"
                      onClick={() => toggleFolder(item.name)}
                      aria-expanded={open}
                      className="flex w-full items-center gap-2.5 bg-[color:var(--s2)]/60 px-4 py-2 text-left transition-colors hover:bg-[var(--s4)]"
                    >
                      {open ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="font-mono text-[12px] font-medium text-foreground">{item.name}</span>
                      <span className="text-[11px] tabular-nums text-muted-foreground">{item.count} {item.count === 1 ? "page" : "pages"}</span>
                    </button>
                  </li>
                );
              }
              const pg = item.pg;
              const tone = PAGE_TONE[pg.state];
              const kinds = [...new Set(pg.sections.map((s) => getSectionDef(s.type)?.name).filter(Boolean))];
              return (
                <li key={pg.id} className={cn("group grid grid-cols-[1fr_150px_130px_76px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--s4)]", item.nested && "pl-11")}>
                  <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ page: pg.path }} className="flex min-w-0 items-center gap-2.5">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-foreground">{pg.title}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        <span className="font-mono">{pg.path}</span>
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
                      className="inline-flex w-fit items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] transition-colors hover:bg-[color:var(--color-row-hover)]"
                      title="Publish settings"
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                      <span className={tone.text}>{tone.label}</span>
                      {pg.staged && <span className="rounded bg-[color:var(--s2)] px-1 text-[9.5px] font-medium text-muted-foreground">staging</span>}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[12px]">
                      <span className={cn("h-1.5 w-1.5 rounded-full", tone.dot)} />
                      <span className={tone.text}>{tone.label}</span>
                    </span>
                  )}

                  <span className="text-[11.5px] text-muted-foreground">{formatRelative(new Date(pg.updatedAt).toISOString())}</span>

                  <span className="flex items-center justify-end gap-0.5">
                  {canBuild && (
                    <button
                      type="button"
                      aria-label={`Page settings for ${pg.title}`}
                      title="Page settings & SEO"
                      onClick={() => setSettingsPage(pg)}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={`Actions for ${pg.title}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
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
              );
            })}
          </ul>
          {canBuild && !batchRun && (
            <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ new: true }} className="flex items-center gap-2 border-t border-[color:var(--border-hairline)] px-4 py-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--s4)]">
              <Plus className="h-3.5 w-3.5" /> New page
            </Link>
          )}
        </div>
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
    </PageShell>
  );
}
