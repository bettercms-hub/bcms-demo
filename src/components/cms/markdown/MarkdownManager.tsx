/**
 * MarkdownManager — the markdown delivery surface for a project.
 *
 * Three parts, top to bottom:
 * 1. Delivery: llms.txt (auto-generated or a hand-authored override you can
 *    edit or upload) and llms-full.txt, plus the content-negotiation note.
 * 2. Endpoints: every page, entry and file with its .md twin, searchable
 *    and filterable by type, each with a live preview.
 * 3. Files: standalone .md documents with their own draft/publish lifecycle,
 *    written in place or uploaded.
 *
 * Pages and entries stay structured; markdown is serialized on request.
 */
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileText,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { collections as allCollections, entries as allEntries, schemas as allSchemas } from "@/lib/cms/mock-data";
import { usePages } from "@/lib/cms/pages-store";
import { mdActions, useMdState, type MdFile, type MdFileState } from "@/lib/md/md-store";
import { entryToMarkdown, llmsFullTxt, llmsTxt, pageToMarkdown, type LlmsInput } from "@/lib/md/serialize";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ListToolbar, SegmentedFilter } from "@/components/cms/ListToolbar";
import { Paginator, clampPage, type PageSize } from "@/components/cms/Paginator";
import { cn } from "@/lib/utils";

type RowKind = "page" | "entry" | "file";
type TypeFilter = "all" | "page" | "entry" | "file";

interface Row {
  key: string;
  title: string;
  path: string;
  source: string;
  kind: RowKind;
  served: boolean;
  markdown: () => string;
  file?: MdFile;
}

export function MarkdownManager({
  projectId,
  siteName,
  domain,
  canEdit,
}: {
  projectId: string;
  siteName: string;
  domain: string;
  canEdit: boolean;
}) {
  const pages = usePages(projectId);
  const md = useMdState(projectId);
  const [preview, setPreview] = useState<{ title: string; path: string; body: string } | null>(null);
  const [editing, setEditing] = useState<MdFile | "new" | null>(null);
  const [llmsEdit, setLlmsEdit] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [mdPage, setMdPage] = useState(0);
  const [mdSize, setMdSize] = useState<PageSize>(50);
  const uploadRef = useRef<HTMLInputElement>(null);
  const llmsUploadRef = useRef<HTMLInputElement>(null);

  const site = { name: siteName, domain };
  const cols = useMemo(
    () =>
      allCollections
        .filter((c) => c.projectId === projectId)
        .map((collection) => ({
          collection,
          schema: allSchemas.find((s) => s.id === collection.schemaId),
          entries: allEntries.filter((e) => e.collectionId === collection.id),
        })),
    [projectId],
  );

  const publishedFiles = md.files.filter((f) => f.state === "published");
  const llmsInput: LlmsInput = {
    site,
    pages: pages.filter((p) => !md.excluded.includes(p.path)),
    collections: cols.map((g) => ({ ...g, entries: g.entries.filter((e) => !md.excluded.includes(e.id)) })),
    files: publishedFiles.map((f) => ({ path: f.path, title: f.title })),
  };
  const generatedLlms = llmsTxt(llmsInput);
  const activeLlms = md.llmsMode === "custom" ? md.llmsCustom : generatedLlms;

  const allRows: Row[] = [
    ...pages.map((p): Row => ({
      key: p.path,
      title: p.title,
      path: `${p.path === "/" ? "/index" : p.path}.md`,
      source: "Static page",
      kind: "page",
      served: !md.excluded.includes(p.path),
      markdown: () => pageToMarkdown(site, p),
    })),
    ...cols.flatMap((g) =>
      g.entries.map((e): Row => ({
        key: e.id,
        title: e.title,
        path: `/${g.collection.slug}/${e.id}.md`,
        source: g.collection.name,
        kind: "entry",
        served: !md.excluded.includes(e.id),
        markdown: () => entryToMarkdown(g.collection, g.schema, e),
      })),
    ),
    ...md.files.map((f): Row => ({
      key: f.id,
      title: f.title,
      path: f.path,
      source: "Markdown file",
      kind: "file",
      served: f.state === "published",
      markdown: () => f.body,
      file: f,
    })),
  ];

  const q = query.trim().toLowerCase();
  const filteredRows = allRows.filter(
    (r) =>
      (typeFilter === "all" || r.kind === typeFilter) &&
      (q === "" || r.title.toLowerCase().includes(q) || r.path.toLowerCase().includes(q)),
  );
  const pageNav = clampPage(mdPage, filteredRows.length, mdSize);
  const rows = filteredRows.slice(pageNav * mdSize, (pageNav + 1) * mdSize);

  const counts = {
    all: allRows.length,
    page: allRows.filter((r) => r.kind === "page").length,
    entry: allRows.filter((r) => r.kind === "entry").length,
    file: allRows.filter((r) => r.kind === "file").length,
  };

  function copyUrl(path: string) {
    navigator.clipboard.writeText(`https://${domain}${path}`);
    toast.success("URL copied");
  }

  function onUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const body = String(reader.result ?? "");
      const heading = body.match(/^#\s+(.+)$/m)?.[1];
      const title = heading ?? file.name.replace(/\.md$/i, "");
      // Uploaded content lands as a draft so you can review before it goes live.
      mdActions.addFile(projectId, { path: `/docs/${file.name}`, title, body, state: "draft" });
      toast.success(`${file.name} uploaded as draft`);
    };
    reader.readAsText(file);
  }

  function onLlmsUpload(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      mdActions.setLlmsMode(projectId, "custom", String(reader.result ?? ""));
      toast.success("llms.txt replaced with your file");
    };
    reader.readAsText(file);
  }

  return (
    <div className="space-y-4">
      {/* ------------------------------------------------ delivery card */}
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
        <div className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Delivery
        </div>

        {/* llms.txt: auto or a hand-authored override */}
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <FileText className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12.5px] font-semibold text-foreground">llms.txt</span>
              <span
                className={cn(
                  "rounded-md px-1.5 py-0.5 text-[10px] font-medium",
                  md.llmsMode === "custom"
                    ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary"
                    : "bg-[color:var(--s2)] text-muted-foreground",
                )}
              >
                {md.llmsMode === "custom" ? "Custom" : "Auto"}
              </span>
              {md.llms && (
                <button type="button" onClick={() => copyUrl("/llms.txt")} className="inline-flex items-center gap-1 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground" title="Copy URL">
                  {domain}/llms.txt <Copy className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              {md.llmsMode === "custom"
                ? "Serving your uploaded file. Revert to keep it generated from the site automatically."
                : "A markdown index of everything worth reading, generated from the site. Agents and AI dev tools fetch this first."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pt-0.5">
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setPreview({ title: "llms.txt", path: "/llms.txt", body: activeLlms })}>
              Preview
            </Button>
            {canEdit && (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setLlmsEdit(activeLlms)}>
                  <Pencil className="mr-1 h-3 w-3" /> Edit
                </Button>
                <input ref={llmsUploadRef} type="file" accept=".txt,.md,text/plain,text/markdown" className="hidden" onChange={(e) => e.target.files?.[0] && onLlmsUpload(e.target.files[0])} />
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => llmsUploadRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" /> Upload
                </Button>
                {md.llmsMode === "custom" && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px] text-muted-foreground" onClick={() => { mdActions.setLlmsMode(projectId, "auto"); toast.success("Back to auto-generated"); }} title="Revert to auto">
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                )}
                <Switch checked={md.llms} onCheckedChange={(v) => mdActions.setSurface(projectId, "llms", v)} aria-label="Serve llms.txt" />
              </>
            )}
            {!canEdit && <Switch checked={md.llms} disabled aria-label="Serve llms.txt" />}
          </div>
        </div>

        <SurfaceRow
          title="llms-full.txt"
          note="The whole site inlined in one file. Large sites can exceed agent context windows, so this stays off unless you need it."
          url={`https://${domain}/llms-full.txt`}
          on={md.llmsFull}
          canEdit={canEdit}
          onToggle={(v) => mdActions.setSurface(projectId, "llmsFull", v)}
          onPreview={() => setPreview({ title: "llms-full.txt", path: "/llms-full.txt", body: llmsFullTxt(llmsInput, publishedFiles) })}
          onCopy={() => copyUrl("/llms-full.txt")}
        />

        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
            <FileCode2 className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-medium text-foreground">Content negotiation</div>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
              Every canonical URL also answers markdown requests directly, so agents never need a second URL. Search engines
              see one page, agents get clean markdown.
            </p>
            <code className="mt-1.5 block w-fit rounded-md bg-[color:var(--s2)] px-2 py-1 font-mono text-[11px] text-foreground">
              curl -H "Accept: text/markdown" https://{domain}/pricing
            </code>
          </div>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
            <Check className="h-3 w-3" /> Always on
          </span>
        </div>
      </div>

      {/* --------------------------------------------- endpoints table */}
      <div>
        <ListToolbar query={query} onQuery={setQuery} placeholder="Search markdown endpoints">
          <SegmentedFilter<TypeFilter>
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { id: "all", label: "All", count: counts.all },
              { id: "page", label: "Static", count: counts.page },
              { id: "entry", label: "Collections", count: counts.entry },
              { id: "file", label: "Files", count: counts.file },
            ]}
          />
        </ListToolbar>

        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
          <div className="grid grid-cols-[1fr_130px_96px_140px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <span>Markdown endpoint</span>
            <span>Source</span>
            <span>Serve</span>
            <span />
          </div>
          <ul className="divide-y divide-[color:var(--border-hairline)]">
            {rows.map((r) => (
              <li key={r.key} className={cn("group grid grid-cols-[1fr_130px_96px_140px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--s4)]", !r.served && "opacity-60")}>
                <div className="flex min-w-0 items-center gap-2.5">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-medium text-foreground">{r.title}</div>
                    <button type="button" onClick={() => copyUrl(r.path)} title="Copy URL" className="truncate font-mono text-[11px] text-muted-foreground hover:text-foreground">
                      {r.path}
                    </button>
                  </div>
                </div>
                <span className={cn("w-fit rounded-md px-1.5 py-0.5 text-[11px] font-medium", r.kind === "file" ? "bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)] text-primary" : "bg-[color:var(--s2)] text-muted-foreground")}>
                  {r.source}
                </span>
                <span>
                  {r.kind === "file" ? (
                    <StateBadge state={r.file!.state} />
                  ) : (
                    <Switch checked={r.served} disabled={!canEdit} onCheckedChange={() => mdActions.toggleExcluded(projectId, r.key)} aria-label={`Serve ${r.title} as markdown`} />
                  )}
                </span>
                <span className="flex items-center justify-end gap-1">
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => setPreview({ title: r.title, path: r.path, body: r.markdown() })}>
                    Preview
                  </Button>
                  {r.kind === "file" && canEdit && (
                    <>
                      <button type="button" aria-label={`Edit ${r.title}`} onClick={() => setEditing(r.file!)} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button type="button" aria-label={`More actions for ${r.title}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100">
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-[180px]">
                          {r.file!.state === "draft" ? (
                            <DropdownMenuItem className="text-[13px]" onSelect={() => { mdActions.setFileState(projectId, r.file!.id, "published"); toast.success(`${r.path} published`); }}>
                              <Send className="mr-2 h-3.5 w-3.5" /> Publish
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem className="text-[13px]" onSelect={() => { mdActions.setFileState(projectId, r.file!.id, "draft"); toast.success(`${r.path} unpublished`); }}>
                              <RotateCcw className="mr-2 h-3.5 w-3.5" /> Unpublish
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem className="text-[13px]" onSelect={() => { navigator.clipboard.writeText(r.markdown()); toast.success("Markdown copied"); }}>
                            <Copy className="mr-2 h-3.5 w-3.5" /> Copy as Markdown
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-[13px]" onSelect={() => download(r.path, r.markdown())}>
                            <Download className="mr-2 h-3.5 w-3.5" /> Download
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-[13px] text-destructive focus:text-destructive" onSelect={() => { mdActions.removeFile(projectId, r.file!.id); toast.success(`${r.path} deleted`); }}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </span>
              </li>
            ))}
            {rows.length === 0 && (
              <li className="px-4 py-10 text-center text-[12.5px] text-muted-foreground">No endpoints match your search.</li>
            )}
          </ul>
          {canEdit && (
            <div className="flex items-center gap-4 border-t border-[color:var(--border-hairline)] px-4 py-2.5">
              <button type="button" onClick={() => setEditing("new")} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-primary transition-colors hover:opacity-80">
                <Plus className="h-3.5 w-3.5" /> New markdown file
              </button>
              <input ref={uploadRef} type="file" accept=".md,text/markdown" className="hidden" onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
              <button type="button" onClick={() => uploadRef.current?.click()} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                <Upload className="h-3.5 w-3.5" /> Upload .md
              </button>
            </div>
          )}
          <Paginator
            total={filteredRows.length}
            page={pageNav}
            size={mdSize}
            onPage={setMdPage}
            onSize={(s) => {
              setMdSize(s);
              setMdPage(0);
            }}
            noun="endpoint"
          />
        </div>
      </div>

      {preview && <MdPreviewDialog {...preview} onClose={() => setPreview(null)} />}
      {llmsEdit !== null && (
        <LlmsEditDialog
          initial={llmsEdit}
          isCustom={md.llmsMode === "custom"}
          onClose={() => setLlmsEdit(null)}
          onSave={(body) => {
            mdActions.setLlmsMode(projectId, "custom", body);
            toast.success("llms.txt saved");
            setLlmsEdit(null);
          }}
          onRevert={() => {
            mdActions.setLlmsMode(projectId, "auto");
            toast.success("Back to auto-generated");
            setLlmsEdit(null);
          }}
        />
      )}
      {editing && (
        <MdFileDialog
          file={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input, publish) => {
            const state: MdFileState = publish ? "published" : "draft";
            if (editing === "new") {
              const f = mdActions.addFile(projectId, { ...input, state });
              toast.success(publish ? `${f.path} published` : `${f.path} saved as draft`);
            } else {
              mdActions.updateFile(projectId, editing.id, { ...input, state });
              toast.success(publish ? "Published" : "Saved as draft");
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- pieces */

function StateBadge({ state }: { state: MdFileState }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px]">
      <span className={cn("h-1.5 w-1.5 rounded-full", state === "published" ? "bg-emerald-400" : "bg-muted-foreground/50")} />
      <span className={state === "published" ? "text-emerald-600" : "text-muted-foreground"}>{state === "published" ? "Published" : "Draft"}</span>
    </span>
  );
}

function download(path: string, body: string) {
  const blob = new Blob([body], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = path.split("/").pop() ?? "content.md";
  a.click();
  URL.revokeObjectURL(url);
}

function SurfaceRow({
  title,
  note,
  url,
  on,
  canEdit,
  onToggle,
  onPreview,
  onCopy,
}: {
  title: string;
  note: string;
  url: string;
  on: boolean;
  canEdit: boolean;
  onToggle: (v: boolean) => void;
  onPreview: () => void;
  onCopy: () => void;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
        <FileText className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[12.5px] font-semibold text-foreground">{title}</span>
          {on && (
            <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground" title="Copy URL">
              {url.replace("https://", "")} <Copy className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">{note}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2 pt-0.5">
        <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={onPreview}>
          Preview
        </Button>
        <Switch checked={on} disabled={!canEdit} onCheckedChange={onToggle} aria-label={`Serve ${title}`} />
      </div>
    </div>
  );
}

function DialogShell({ title, subtitle, icon: Icon, onClose, children, footer }: { title: string; subtitle?: string; icon: typeof FileText; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={title} className="absolute left-1/2 top-[6vh] flex max-h-[88vh] w-[min(700px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <Icon className="h-4 w-4 shrink-0 text-primary" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
            {subtitle && <div className="truncate font-mono text-[11px] text-muted-foreground">{subtitle}</div>}
          </div>
          {footer == null && (
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {children}
        {footer}
      </div>
    </div>,
    document.body,
  );
}

function MdPreviewDialog({ title, path, body, onClose }: { title: string; path: string; body: string; onClose: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={`Markdown preview: ${title}`} className="absolute left-1/2 top-[6vh] flex max-h-[88vh] w-[min(680px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
            <div className="truncate font-mono text-[11px] text-muted-foreground">{path}</div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => { navigator.clipboard.writeText(body); toast.success("Markdown copied"); }}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={() => download(path, body)}>
            <Download className="mr-1 h-3 w-3" /> Download
          </Button>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap bg-[color:var(--s2)] p-4 font-mono text-[12px] leading-relaxed text-foreground">{body}</pre>
      </div>
    </div>,
    document.body,
  );
}

const editorTextarea =
  "w-full flex-1 resize-none border-0 bg-[color:var(--s2)] p-4 font-mono text-[12.5px] leading-relaxed text-foreground outline-none";

function LlmsEditDialog({ initial, isCustom, onClose, onSave, onRevert }: { initial: string; isCustom: boolean; onClose: () => void; onSave: (body: string) => void; onRevert: () => void }) {
  const [body, setBody] = useState(initial);
  return (
    <DialogShell
      title="Edit llms.txt"
      subtitle="/llms.txt"
      icon={FileText}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          {isCustom ? (
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={onRevert}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Revert to auto
            </Button>
          ) : (
            <span className="text-[11px] text-muted-foreground">Saving switches llms.txt from auto to your custom version.</span>
          )}
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={() => onSave(body)}>Save llms.txt</Button>
          </div>
        </div>
      }
    >
      <textarea value={body} onChange={(e) => setBody(e.target.value)} className={cn(editorTextarea, "min-h-[46vh]")} spellCheck={false} />
    </DialogShell>
  );
}

function MdFileDialog({ file, onClose, onSave }: { file: MdFile | null; onClose: () => void; onSave: (input: { path: string; title: string; body: string }, publish: boolean) => void }) {
  const [title, setTitle] = useState(file?.title ?? "");
  const [path, setPath] = useState(file?.path ?? "/docs/");
  const [body, setBody] = useState(file?.body ?? "");
  const valid = title.trim().length > 0 && path.trim().length > 1 && body.trim().length > 0;
  const isPublished = file?.state === "published";

  return (
    <DialogShell
      title={file ? "Edit markdown file" : "New markdown file"}
      icon={FileCode2}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <span className="text-[11px] text-muted-foreground">
            {file ? <>Currently <span className="font-medium text-foreground">{isPublished ? "published" : "a draft"}</span></> : "New files are private until you publish."}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!valid} onClick={() => onSave({ title: title.trim(), path, body }, false)}>
              Save as draft
            </Button>
            <Button size="sm" disabled={!valid} onClick={() => onSave({ title: title.trim(), path, body }, true)}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> {isPublished ? "Save & keep live" : "Publish"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="grid grid-cols-2 gap-3 px-4 py-3">
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Title</div>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Getting started" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
          </label>
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Path</div>
            <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/docs/getting-started.md" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 font-mono text-[12px] outline-none transition-colors focus:border-[color:var(--primary)]" />
          </label>
        </div>
        <div className="px-4 pb-1 text-[11.5px] font-medium text-muted-foreground">Content</div>
        <div className="mx-4 mb-4 min-h-[34vh] flex-1 overflow-hidden rounded-lg border border-[color:var(--color-border)]">
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder={"# Heading\n\nWrite markdown here."} className={cn(editorTextarea, "h-full")} spellCheck={false} />
        </div>
      </div>
    </DialogShell>
  );
}
