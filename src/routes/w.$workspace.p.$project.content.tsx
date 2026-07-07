import { useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, Copy, Database, FileText, MoreHorizontal, Plus, Rocket, Settings2, Trash2 } from "lucide-react";
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

export const Route = createFileRoute("/w/$workspace/p/$project/content")({
  validateSearch: (s: Record<string, unknown>): { view?: "pages" | "content" } => ({
    view: s.view === "content" ? "content" : undefined,
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
  const { view } = Route.useSearch();
  const pr = getProjectBySlug(workspace, project)!;
  const staging = `${pr.slug}.bettercms.site`;
  const pages = usePages(pr.id);
  const cols = collections.filter((c) => c.projectId === pr.id);
  const { effective } = useEffectiveRole(workspace);
  const canBuild = canCompose(effective);
  const showPublish = canPublish(effective);
  const navigate = useNavigate();

  const isContent = view === "content";
  const [settingsPage, setSettingsPage] = useState<PageDoc | null>(null);
  const [publishFor, setPublishFor] = useState<{ page: PageDoc; rect: { top: number; left: number } } | null>(null);

  function duplicate(pg: PageDoc) {
    let path = `${pg.path}-copy`;
    let n = 1;
    while (pages.some((p) => p.path === path)) path = `${pg.path}-copy-${++n}`;
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
        { label: isContent ? "Content" : "Pages" },
      ]}
      title={isContent ? "Content" : "Pages"}
      description={isContent ? "Structured collections that power your pages and API." : "Every page on your site. Open one to edit it visually."}
      actions={
        !isContent && canBuild ? (
          <Button asChild size="sm">
            <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ new: true }}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New page
            </Link>
          </Button>
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
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <div className="grid grid-cols-[1fr_150px_130px_44px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Page</span>
            <span>Status</span>
            <span>Updated</span>
            <span />
          </div>
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {pages.map((pg) => {
              const tone = PAGE_TONE[pg.state];
              const kinds = [...new Set(pg.sections.map((s) => getSectionDef(s.type)?.name).filter(Boolean))];
              return (
                <li key={pg.id} className="group grid grid-cols-[1fr_150px_130px_44px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--s4)]">
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
                </li>
              );
            })}
          </ul>
          {canBuild && (
            <Link to="/w/$workspace/p/$project/visual" params={{ workspace, project }} search={{ new: true }} className="flex items-center gap-2 border-t border-[color:var(--border-hairline)] px-4 py-2.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-[var(--s4)]">
              <Plus className="h-3.5 w-3.5" /> New page
            </Link>
          )}
        </div>
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
