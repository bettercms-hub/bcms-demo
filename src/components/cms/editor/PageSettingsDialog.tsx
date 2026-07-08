/**
 * PageSettingsDialog — edit a page's name, URL and SEO meta. Used from the
 * Pages list and the visual editor. Writes to the pages store on save.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Globe, Settings2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getPages, pagesActions, type PageDoc } from "@/lib/cms/pages-store";

export function PageSettingsDialog({
  projectId,
  page,
  staging,
  onClose,
  onPathChange,
  onDelete,
}: {
  projectId: string;
  page: PageDoc;
  staging: string;
  onClose: () => void;
  /** Called when the path changes so the caller can follow the page. */
  onPathChange?: (next: string) => void;
  onDelete?: () => void;
}) {
  const [title, setTitle] = useState(page.title);
  const [path, setPath] = useState(page.path);
  const [seoTitle, setSeoTitle] = useState(page.seoTitle ?? "");
  const [seoDescription, setSeoDescription] = useState(page.seoDescription ?? "");
  const [indexing, setIndexing] = useState<"index" | "noindex">(page.indexing ?? "index");
  const [jsonLd, setJsonLd] = useState(page.jsonLd ?? "");

  const normPath = "/" + path.replace(/^\/+/, "").replace(/\s+/g, "-").toLowerCase();
  const taken = normPath !== page.path && getPages(projectId).some((p) => p.path === normPath);
  const jsonLdValid = (() => {
    if (jsonLd.trim() === "") return true;
    try {
      JSON.parse(jsonLd);
      return true;
    } catch {
      return false;
    }
  })();
  const valid = title.trim().length > 0 && !taken && jsonLdValid;

  function save() {
    if (!valid) return;
    pagesActions.update(projectId, page.path, (p) => ({
      ...p,
      title: title.trim(),
      path: normPath,
      seoTitle: seoTitle.trim() || undefined,
      seoDescription: seoDescription.trim() || undefined,
      indexing,
      jsonLd: jsonLd.trim() || undefined,
    }));
    if (normPath !== page.path) onPathChange?.(normPath);
    toast.success("Page settings saved");
    onClose();
  }

  const suffix = normPath === "/" ? "" : normPath;
  const descLen = seoDescription.trim().length;

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Page settings"
        className="absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[min(520px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <Settings2 className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Page settings</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{page.title}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          <FieldRow label="Page name">
            <input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
          </FieldRow>

          <FieldRow label="URL path" hint={taken ? "This path is already used by another page." : undefined} error={taken}>
            <div className="flex items-center rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 focus-within:border-[color:var(--primary)]">
              <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <span className="ml-1.5 shrink-0 font-mono text-[12px] text-muted-foreground">/</span>
              <input
                value={path.replace(/^\//, "")}
                onChange={(e) => setPath(e.target.value)}
                placeholder="about"
                className="h-9 w-full bg-transparent px-1 font-mono text-[12.5px] outline-none"
              />
            </div>
          </FieldRow>

          <div className="h-px bg-[color:var(--border-hairline)]" />
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">SEO</div>

          <FieldRow label="Meta title" hint="Shown in search results and browser tabs. Defaults to the page name.">
            <input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} placeholder={title} className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
          </FieldRow>

          <FieldRow label="Meta description" hint={`${descLen}/160 characters, the snippet under your title in search.`} error={descLen > 160}>
            <textarea value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} rows={3} placeholder="A short, compelling summary of this page." className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 py-2 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]" />
          </FieldRow>

          <FieldRow label="Search indexing">
            <div className="grid grid-cols-2 gap-1.5">
              {(["index", "noindex"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setIndexing(v)}
                  aria-pressed={indexing === v}
                  className={cn(
                    "rounded-md border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors",
                    indexing === v
                      ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
                      : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
                  )}
                >
                  {v === "index" ? "Index" : "No-index"}
                  <span className="mt-0.5 block text-[10.5px] font-normal text-muted-foreground">
                    {v === "index" ? "Allow search engines" : "Hide from search"}
                  </span>
                </button>
              ))}
            </div>
          </FieldRow>

          <FieldRow
            label="Structured data (JSON-LD)"
            hint={jsonLdValid ? "Optional. Emitted in the page head for rich results and answer engines." : "This is not valid JSON yet."}
            error={!jsonLdValid}
          >
            <textarea
              value={jsonLd}
              onChange={(e) => setJsonLd(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "..."\n}'}
              className={cn(
                "w-full resize-y rounded-md border bg-[color:var(--s2)] px-2.5 py-2 font-mono text-[11.5px] leading-relaxed outline-none transition-colors",
                jsonLdValid ? "border-[color:var(--color-border)] focus:border-[color:var(--primary)]" : "border-rose-400",
              )}
            />
          </FieldRow>

          <div className="rounded-md bg-[color:var(--s2)] px-2.5 py-2 text-[11px] text-muted-foreground">
            Preview: <span className="font-mono text-foreground">{staging}{suffix}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          {onDelete && (
            <button type="button" onClick={() => { onDelete(); onClose(); }} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-rose-600 transition-colors hover:bg-rose-50">
              <Trash2 className="h-3.5 w-3.5" /> Delete page
            </button>
          )}
          <button type="button" onClick={onClose} className="ml-auto h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
            Cancel
          </button>
          <button type="button" onClick={save} disabled={!valid} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
            Save changes
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FieldRow({ label, hint, error, children }: { label: string; hint?: string; error?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-[12px] font-medium text-foreground">{label}</div>
      {children}
      {hint && <div className={cn("mt-1 text-[11px]", error ? "text-rose-500" : "text-muted-foreground")}>{hint}</div>}
    </label>
  );
}
