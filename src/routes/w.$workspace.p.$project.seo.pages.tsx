import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ImageIcon, ImagePlus, Link2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { HeadlessApiCallout } from "@/components/cms/headless/HeadlessApiCallout";
import { MediaPickerDialog } from "@/components/cms/media/MediaPickerDialog";
import { Switch } from "@/components/ui/switch";
import { TokenField, prettifyToken, useTokenFieldStyles } from "@/components/cms/seo/TokenField";
import {
  isDynamic,
  isGradient,
  useSeoPages,
  type SitePage,
} from "@/lib/seo/site-pages";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/pages")({
  component: PagesSeoTable,
});

function PagesSeoTable() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const [pages, setPages] = useSeoPages(pr.id, pr.name);
  const [q, setQ] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const domain = `${pr.slug}.com`;

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () => pages.filter((p) => !query || p.name.toLowerCase().includes(query) || p.slug.toLowerCase().includes(query)),
    [pages, query],
  );
  const editing = pages.find((p) => p.id === editingId) ?? null;

  function patch(id: string, p: Partial<SitePage>) {
    setPages((cur) => cur.map((x) => (x.id === id ? { ...x, ...p } : x)));
  }
  function addPage() {
    const id = `pg_${Date.now().toString(36)}`;
    const n = pages.filter((p) => p.kind === "static").length + 1;
    setPages((cur) => [
      ...cur,
      { id, name: "New page", slug: `/new-page-${n}`, kind: "static", index: true, metaTitle: "", metaDescription: "", ogImage: "" },
    ]);
    setEditingId(id);
  }
  function remove(id: string) {
    setPages((cur) => cur.filter((x) => x.id !== id));
    setEditingId(null);
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">Pages</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Meta title, description, and social image for every page.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search pages…"
              className="h-9 w-52 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] pl-8 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
            />
          </div>
          <button
            type="button"
            onClick={addPage}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-3 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            <Plus className="h-4 w-4" /> Add page
          </button>
        </div>
      </header>

      {pr.kind === "headless" && (
        <HeadlessApiCallout
          path={`/api/public/projects/${pr.id}/seo?path=/about`}
          keyType="Public"
          description="Per-page meta (title, description, canonical, robots, Open Graph, Twitter) is served by the API so your frontend can render the tags in the page head."
        />
      )}

      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
        <div className="grid grid-cols-[1.4fr_2fr_2.6fr_72px_72px] items-center gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>Page</div>
          <div>Meta title</div>
          <div>Meta description</div>
          <div className="text-center">Social</div>
          <div className="text-center">Indexed</div>
        </div>
        {filtered.map((p) => (
          <PageRow
            key={p.id}
            page={p}
            onEdit={() => setEditingId(p.id)}
            onToggleIndex={(on) => patch(p.id, { index: on })}
          />
        ))}
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">No pages match “{q}”.</div>
        )}
      </div>

      <p className="mt-3 text-[12px] text-muted-foreground">
        {pages.length} pages · click a row to edit · CMS templates use{" "}
        <code className="rounded bg-[color:var(--s2)] px-1 py-0.5 font-mono text-[11px]">{"{{fields}}"}</code> resolved per
        item.
      </p>

      {editing && (
        <PageEditModal
          page={editing}
          domain={domain}
          projectId={pr.id}
          onSave={(d) => {
            patch(editing.id, d);
            setEditingId(null);
          }}
          onDelete={() => remove(editing.id)}
          onClose={() => setEditingId(null)}
        />
      )}
    </>
  );
}

function PageRow({
  page,
  onEdit,
  onToggleIndex,
}: {
  page: SitePage;
  onEdit: () => void;
  onToggleIndex: (on: boolean) => void;
}) {
  const cms = page.kind === "cms";
  const title = page.metaTitle || <span className="text-muted-foreground/60">No meta title</span>;
  const desc = page.metaDescription || <span className="text-muted-foreground/60">No meta description</span>;
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onEdit}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onEdit())}
      className="group grid cursor-pointer grid-cols-[1.4fr_2fr_2.6fr_72px_72px] items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3 last:border-b-0 hover:bg-[color:var(--color-row-hover)]"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[13px] font-medium text-foreground">{page.name}</span>
          {cms && (
            <span className="shrink-0 rounded border border-violet-500/30 bg-violet-500/10 px-1 py-0.5 text-[9.5px] font-semibold uppercase text-violet-600 dark:text-violet-400">
              CMS
            </span>
          )}
          <Pencil className="ml-0.5 h-3 w-3 shrink-0 text-transparent transition-colors group-hover:text-muted-foreground" />
        </div>
        <div className="truncate font-mono text-[11px] text-muted-foreground">{page.slug}</div>
      </div>
      <div className={`truncate text-[12.5px] ${isDynamic(page.metaTitle) ? "font-mono text-violet-600 dark:text-violet-300" : "text-foreground"}`}>
        {title}
      </div>
      <div className={`truncate text-[12.5px] ${isDynamic(page.metaDescription) ? "font-mono text-violet-600 dark:text-violet-300" : "text-muted-foreground"}`}>
        {desc}
      </div>
      <div className="flex justify-center">
        <OgThumb value={page.ogImage} />
      </div>
      <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
        <Switch
          checked={page.index}
          onCheckedChange={onToggleIndex}
          aria-label={`Index ${page.name}`}
          title={page.index ? "Indexed (index,follow)" : "Not indexed (noindex)"}
        />
      </div>
    </div>
  );
}

/* ── OG display + picker ── */

function OgThumb({ value, className = "h-[34px] w-16" }: { value: string; className?: string }) {
  const dyn = isDynamic(value);
  return (
    <div
      className={`grid ${className} place-items-center overflow-hidden rounded-md border border-[color:var(--border-hairline)]`}
      style={isGradient(value) ? { background: value } : undefined}
    >
      {value === "" ? (
        <ImagePlus className="h-4 w-4 text-muted-foreground" />
      ) : dyn ? (
        <span className="px-1 text-center font-mono text-[9px] font-medium text-violet-600 dark:text-violet-300">{value}</span>
      ) : isGradient(value) ? null : (
        <img src={value} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function OgPicker({
  page,
  projectId,
  value,
  onChange,
  children,
}: {
  page: SitePage;
  projectId: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [mediaOpen, setMediaOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="block w-full text-left">
        {children}
      </button>
      <MediaPickerDialog
        open={mediaOpen}
        onOpenChange={setMediaOpen}
        projectId={projectId}
        title="Choose a social image"
        onSelect={(u) => {
          onChange(u);
          setOpen(false);
        }}
      />
      {open && (
        <>
          <div className="fixed inset-0 z-[60]" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-[61] mt-1.5 w-64 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-3 shadow-[var(--shadow-3)]">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setMediaOpen(true);
              }}
              className="mb-2.5 flex w-full items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 py-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
              Browse media library
            </button>
            {page.kind === "cms" && page.fields && (
              <div className="mt-2.5">
                <div className="mb-1 text-[10.5px] font-medium text-muted-foreground">Bind to a field</div>
                <div className="flex flex-wrap gap-1">
                  {page.fields
                    .filter((f) => /image|avatar|cover|photo/i.test(f))
                    .concat(["coverImage"])
                    .filter((f, i, a) => a.indexOf(f) === i)
                    .map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => {
                          onChange(`{{${f}}}`);
                          setOpen(false);
                        }}
                        className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 font-mono text-[10px] text-violet-600 dark:text-violet-300"
                      >
                        {`{{${f}}}`}
                      </button>
                    ))}
                </div>
              </div>
            )}
            <div className="mt-2.5 flex items-center gap-1.5">
              <Link2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && url.trim()) {
                    onChange(url.trim());
                    setUrl("");
                    setOpen(false);
                  }
                }}
                placeholder="Paste image URL…"
                className="h-7 flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2 text-[11.5px] outline-none focus:border-primary"
              />
            </div>
            {value !== "" && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="mt-2 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-destructive"
              >
                <X className="h-3 w-3" /> Remove image
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ── edit modal ── */

function PageEditModal({
  page,
  domain,
  projectId,
  onSave,
  onDelete,
  onClose,
}: {
  page: SitePage;
  domain: string;
  projectId: string;
  onSave: (d: Partial<SitePage>) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [d, setD] = useState<SitePage>(page);
  const set = (p: Partial<SitePage>) => setD((x) => ({ ...x, ...p }));
  const cms = page.kind === "cms";
  useTokenFieldStyles();
  const fieldOptions = (page.fields ?? []).map((f) => ({ token: f, label: prettifyToken(f) }));

  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-black/45 p-4" onClick={onClose}>
      <div
        className="my-4 w-full max-w-3xl rounded-xl border border-[color:var(--color-border)] bg-[color:var(--elevated-modal)] shadow-[var(--shadow-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <h3 className="text-[15px] font-semibold text-foreground">Edit page SEO</h3>
            {cms && (
              <span className="rounded border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-violet-600 dark:text-violet-400">
                CMS template
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-6 p-5 md:grid-cols-2">
          {/* form */}
          <div className="space-y-4">
            <Field label="Page name">
              <input
                value={d.name}
                onChange={(e) => set({ name: e.target.value })}
                className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 text-[13px] text-foreground outline-none focus:border-primary"
              />
            </Field>
            <Field label="Slug" hint={cms ? "Dynamic route" : undefined}>
              <input
                value={d.slug}
                onChange={(e) => set({ slug: e.target.value })}
                className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 font-mono text-[12.5px] text-foreground outline-none focus:border-primary"
              />
            </Field>
            <Field label="Meta title" counter={{ len: d.metaTitle.length, good: [30, 60], dyn: cms && isDynamic(d.metaTitle) }}>
              <TokenField
                value={d.metaTitle}
                onChange={(v) => set({ metaTitle: v })}
                fields={fieldOptions}
                placeholder="Add a meta title…"
              />
            </Field>
            <Field label="Meta description" counter={{ len: d.metaDescription.length, good: [120, 160], dyn: cms && isDynamic(d.metaDescription) }}>
              <TokenField
                value={d.metaDescription}
                onChange={(v) => set({ metaDescription: v })}
                fields={fieldOptions}
                multiline
                placeholder="Add a meta description…"
              />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-3 py-2.5">
              <div>
                <div className="text-[13px] font-medium text-foreground">Indexed</div>
                <div className="text-[11.5px] text-muted-foreground">
                  {d.index ? "Search engines can index this page" : "Hidden from search (noindex)"}
                </div>
              </div>
              <Switch checked={d.index} onCheckedChange={(on) => set({ index: on })} aria-label={`Index ${d.name}`} />
            </div>
          </div>

          {/* previews */}
          <div className="space-y-4">
            <div>
              <div className="mb-1.5 text-[12px] font-medium text-foreground">Google result</div>
              <div className="rounded-lg border border-[color:var(--border-hairline)] bg-white p-3.5 dark:bg-[color:var(--s1)]">
                <div className="text-[12px] text-status-success">
                  {domain}
                  <span className="text-muted-foreground"> › {d.slug.replace(/^\//, "")}</span>
                </div>
                <div className="mt-0.5 truncate text-[16px] leading-snug text-[#1a0dab] dark:text-[#8ab4f8]">
                  {d.metaTitle || d.name}
                </div>
                <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-snug text-[#4d5156] dark:text-muted-foreground">
                  {d.metaDescription || "No description set."}
                </div>
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-foreground">Social card</span>
                <span className="text-[11px] text-muted-foreground">click image to change</span>
              </div>
              <OgPicker page={page} projectId={projectId} value={d.ogImage} onChange={(v) => set({ ogImage: v })}>
                <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)] transition-shadow hover:ring-2 hover:ring-primary/30">
                  <div
                    className="grid aspect-[1.91/1] w-full place-items-center bg-[color:var(--s2)]"
                    style={isGradient(d.ogImage) ? { background: d.ogImage } : undefined}
                  >
                    {d.ogImage === "" ? (
                      <div className="flex flex-col items-center gap-1 text-muted-foreground">
                        <ImagePlus className="h-6 w-6" />
                        <span className="text-[11px]">Add social image</span>
                      </div>
                    ) : isDynamic(d.ogImage) ? (
                      <span className="font-mono text-[12px] font-medium text-violet-600 dark:text-violet-300">{d.ogImage}</span>
                    ) : isGradient(d.ogImage) ? null : (
                      <img src={d.ogImage} alt="" className="h-full w-full object-cover" />
                    )}
                  </div>
                  <div className="bg-[color:var(--card)] px-3 py-2">
                    <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{domain}</div>
                    <div className="truncate text-[13px] font-semibold text-foreground">{d.metaTitle || d.name}</div>
                    <div className="line-clamp-1 text-[11.5px] text-muted-foreground">{d.metaDescription || "—"}</div>
                  </div>
                </div>
              </OgPicker>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] px-5 py-3.5">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground transition-colors hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete page
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-[6px] px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onSave(d)}
              className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  counter,
  children,
}: {
  label: string;
  hint?: string;
  counter?: { len: number; good: [number, number]; dyn: boolean };
  children: React.ReactNode;
}) {
  const c = counter;
  const inRange = c ? c.len >= c.good[0] && c.len <= c.good[1] : false;
  const tone = c && c.len === 0 ? "text-muted-foreground/60" : inRange ? "text-status-success" : "text-status-warning";
  return (
    <label className="block">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[12px] font-medium text-foreground">
          {label}
          {hint && <span className="ml-1.5 font-normal text-muted-foreground">· {hint}</span>}
        </span>
        {c && (c.dyn ? <span className="text-[10px] font-medium text-violet-500">Dynamic</span> : <span className={`text-[10px] tabular-nums ${tone}`}>{c.len}</span>)}
      </div>
      {children}
    </label>
  );
}

