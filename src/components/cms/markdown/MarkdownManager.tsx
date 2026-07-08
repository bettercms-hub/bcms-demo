/**
 * MarkdownManager — the markdown delivery surface for a project.
 *
 * Three parts, top to bottom:
 * 1. Delivery: llms.txt and llms-full.txt toggles, plus the content
 *    negotiation note (Accept: text/markdown on the canonical URL).
 * 2. Endpoints: every page and collection entry with its .md twin, a
 *    per-row Serve toggle and a live preview of the serialized markdown.
 * 3. Files: standalone .md documents written or uploaded by hand.
 *
 * Pages and entries stay structured; markdown is serialized on request.
 */
import { useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Copy, Download, FileCode2, FileText, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { collections as allCollections, entries as allEntries, schemas as allSchemas } from "@/lib/cms/mock-data";
import { usePages } from "@/lib/cms/pages-store";
import { mdActions, useMdState, type MdFile } from "@/lib/md/md-store";
import { entryToMarkdown, llmsFullTxt, llmsTxt, pageToMarkdown, type LlmsInput } from "@/lib/md/serialize";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Row {
  key: string;
  title: string;
  path: string;
  source: string;
  kind: "page" | "entry" | "file";
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
  const uploadRef = useRef<HTMLInputElement>(null);

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

  const llmsInput: LlmsInput = {
    site,
    pages: pages.filter((p) => !md.excluded.includes(p.path)),
    collections: cols.map((g) => ({ ...g, entries: g.entries.filter((e) => !md.excluded.includes(e.id)) })),
    files: md.files.map((f) => ({ path: f.path, title: f.title })),
  };

  const rows: Row[] = [
    ...pages.map((p): Row => ({
      key: p.path,
      title: p.title,
      path: `${p.path === "/" ? "/index" : p.path}.md`,
      source: "Page",
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
      source: "File",
      kind: "file",
      served: true,
      markdown: () => f.body,
      file: f,
    })),
  ];

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
      mdActions.addFile(projectId, { path: `/docs/${file.name}`, title, body });
      toast.success(`${file.name} added`);
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

        <SurfaceRow
          title="llms.txt"
          note="A markdown index of everything worth reading, at the site root. Agents and AI dev tools fetch this first."
          url={`https://${domain}/llms.txt`}
          on={md.llms}
          canEdit={canEdit}
          onToggle={(v) => mdActions.setSurface(projectId, "llms", v)}
          onPreview={() => setPreview({ title: "llms.txt", path: "/llms.txt", body: llmsTxt(llmsInput) })}
          onCopy={() => copyUrl("/llms.txt")}
        />
        <SurfaceRow
          title="llms-full.txt"
          note="The whole site inlined in one file. Large sites can exceed agent context windows, so this stays off unless you need it."
          url={`https://${domain}/llms-full.txt`}
          on={md.llmsFull}
          canEdit={canEdit}
          onToggle={(v) => mdActions.setSurface(projectId, "llmsFull", v)}
          onPreview={() =>
            setPreview({ title: "llms-full.txt", path: "/llms-full.txt", body: llmsFullTxt(llmsInput, md.files) })
          }
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
      <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card">
        <div className="grid grid-cols-[1fr_120px_90px_150px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Markdown endpoint</span>
          <span>Source</span>
          <span>Serve</span>
          <span />
        </div>
        <ul className="divide-y divide-[color:var(--border-hairline)]">
          {rows.map((r) => (
            <li key={r.key} className={cn("group grid grid-cols-[1fr_120px_90px_150px] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--s4)]", !r.served && "opacity-55")}>
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
                  <span className="text-[11px] text-muted-foreground">Always</span>
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
                    <button
                      type="button"
                      aria-label={`Delete ${r.title}`}
                      onClick={() => {
                        mdActions.removeFile(projectId, r.file!.id);
                        toast.success(`${r.path} deleted`);
                      }}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-destructive group-hover:opacity-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </span>
            </li>
          ))}
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
      </div>

      {preview && <MdPreviewDialog {...preview} onClose={() => setPreview(null)} />}
      {editing && (
        <MdFileDialog
          file={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSave={(input) => {
            if (editing === "new") {
              const f = mdActions.addFile(projectId, input);
              toast.success(`${f.path} created`);
            } else {
              mdActions.updateFile(projectId, editing.id, input);
              toast.success("File saved");
            }
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- pieces */

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

function MdPreviewDialog({ title, path, body, onClose }: { title: string; path: string; body: string; onClose: () => void }) {
  function copy() {
    navigator.clipboard.writeText(body);
    toast.success("Markdown copied");
  }
  function download() {
    const blob = new Blob([body], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = path.split("/").pop() ?? "content.md";
    a.click();
    URL.revokeObjectURL(url);
  }
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
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={copy}>
            <Copy className="mr-1 h-3 w-3" /> Copy
          </Button>
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[12px]" onClick={download}>
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

function MdFileDialog({ file, onClose, onSave }: { file: MdFile | null; onClose: () => void; onSave: (input: { path: string; title: string; body: string }) => void }) {
  const [title, setTitle] = useState(file?.title ?? "");
  const [path, setPath] = useState(file?.path ?? "/docs/");
  const [body, setBody] = useState(file?.body ?? "");
  const valid = title.trim().length > 0 && path.trim().length > 1 && body.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={file ? "Edit markdown file" : "New markdown file"} className="absolute left-1/2 top-[6vh] flex max-h-[88vh] w-[min(680px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <FileCode2 className="h-4 w-4 shrink-0 text-primary" />
          <div className="flex-1 text-[13.5px] font-semibold text-foreground">{file ? "Edit markdown file" : "New markdown file"}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Title</div>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Getting started" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
            </label>
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Path</div>
              <input value={path} onChange={(e) => setPath(e.target.value)} placeholder="/docs/getting-started.md" className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 font-mono text-[12px] outline-none transition-colors focus:border-[color:var(--primary)]" />
            </label>
          </div>
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Content</div>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={14} placeholder={"# Heading\n\nWrite markdown here."} className="w-full resize-y rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 font-mono text-[12px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]" />
          </label>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={() => onSave({ title: title.trim(), path, body })}>
            {file ? "Save file" : "Create file"}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
