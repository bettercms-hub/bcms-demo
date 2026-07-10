/**
 * ComparePageDialog — Published ↔ Draft for a page, field by field.
 *
 * Mirrors the entry Compare: two aligned columns, changed sections first,
 * word-level highlights (removed struck in the published column, additions
 * highlighted in the draft column), and one action per row — restore the
 * published value into the draft.
 */
import { useMemo } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, History, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pagesActions, type PageDoc } from "@/lib/cms/pages-store";
import { diffText } from "@/lib/cms/diff-text";
import { relativeTime } from "@/lib/cms/snapshots";
import { getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import type { SectionInstance } from "@/components/cms/editor/sections/SectionSystem";

interface Row {
  id: string;
  sectionId: string;
  section: string;
  label: string;
  before: string;
  after: string;
  changed: boolean;
  added: boolean;
  removed: boolean;
}

function humanize(key: string): string {
  const map: Record<string, string> = { headline: "Headline", subheadline: "Subheadline", heading: "Heading", subtext: "Subtext", ctaLabel: "CTA label", primaryCta: "Primary CTA", secondaryCta: "Secondary CTA", badge: "Badge" };
  return map[key] ?? key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}
function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}
function sectionLabel(s?: SectionInstance): string {
  if (!s) return "Section";
  return getSectionDef(s.type)?.name ?? s.type;
}

/** Field-level diff rows between a page's draft and its published snapshot. */
export function computePageRows(page: PageDoc): Row[] {
  const snap = page.publishedSnapshot;
  if (!snap) return [];
  const out: Row[] = [];
  if ((snap.title ?? "") !== (page.title ?? "")) {
    out.push({ id: "__title", sectionId: "", section: "Page", label: "Title", before: snap.title ?? "", after: page.title ?? "", changed: true, added: false, removed: false });
  }
  const pubById = new Map(snap.sections.map((s) => [s.id, s]));
  const draftIds = new Set(page.sections.map((s) => s.id));
  page.sections.forEach((sec) => {
    const pub = pubById.get(sec.id);
    const label = sectionLabel(sec);
    const keys = new Set([...Object.keys(sec.content ?? {}), ...Object.keys(pub?.content ?? {})]);
    for (const k of keys) {
      const before = String(pub?.content?.[k] ?? "");
      const after = String(sec.content?.[k] ?? "");
      if (before === after) continue;
      out.push({ id: `${sec.id}.${k}`, sectionId: sec.id, section: label, label: humanize(k), before, after, changed: !!before && !!after, added: !before, removed: !after });
    }
  });
  for (const s of snap.sections) {
    if (draftIds.has(s.id)) continue;
    const label = sectionLabel(s);
    for (const [k, v] of Object.entries(s.content ?? {})) {
      if (!v) continue;
      out.push({ id: `${s.id}.${k}`, sectionId: s.id, section: `${label} (removed)`, label: humanize(k), before: String(v), after: "", changed: false, added: false, removed: true });
    }
  }
  return out;
}

export function pageDiffCount(page: PageDoc): number {
  return computePageRows(page).length;
}

export function ComparePageDialog({ projectId, page, canEdit, onClose }: { projectId: string; page: PageDoc; canEdit: boolean; onClose: () => void }) {
  const snap = page.publishedSnapshot;
  const rows = useMemo<Row[]>(() => computePageRows(page), [page]);

  function restore(row: Row) {
    if (row.id === "__title") {
      pagesActions.update(projectId, page.path, (p) => ({ ...p, title: row.before }));
    } else {
      pagesActions.update(projectId, page.path, (p) => ({
        ...p,
        sections: p.sections.map((s) => (s.id === row.sectionId ? { ...s, content: { ...s.content, [row.id.slice(row.sectionId.length + 1)]: row.before } } : s)),
      }));
    }
    toast.success(`Restored published ${row.label.toLowerCase()}`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] pointer-events-auto" data-nested-dialog>
      <div className="absolute inset-0 bg-slate-900/50" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare page versions"
        className="absolute inset-x-3 inset-y-[3vh] mx-auto flex max-w-[1060px] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl sm:inset-x-6"
      >
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">Compare versions</span>
            <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{page.title}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/12 px-2.5 py-1 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> Published
            </span>
            <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 dark:text-amber-400">
              <span className="h-1.5 w-1.5 rounded-full bg-current" /> Draft
            </span>
          </div>
          <div className="flex items-center justify-end">
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!snap ? (
          <EmptyState title="Not published yet" body="Publish this page once and later drafts can be compared against it here." />
        ) : rows.length === 0 ? (
          <EmptyState title="No differences" body="This draft matches the published page. Edit a section and the comparison shows up here." />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {rows.length} {rows.length === 1 ? "field" : "fields"} changed · published version captured {relativeTime(new Date(snap.capturedAt).toISOString())}
              </div>
              <div className="space-y-4">
                {rows.map((row) => (
                  <PageCompareRow key={row.id} row={row} canEdit={canEdit} onRestore={() => restore(row)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="grid flex-1 place-items-center p-10 text-center">
      <div className="max-w-sm">
        <div className="text-[14px] font-semibold text-foreground">{title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

function PageCompareRow({ row, canEdit, onRestore }: { row: Row; canEdit: boolean; onRestore: () => void }) {
  const before = stripTags(row.before);
  const after = stripTags(row.after);
  const diff = row.changed ? diffText(before, after) : null;
  return (
    <div className="group">
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</span>
        <span className="text-[11px] text-muted-foreground/70">{row.section}</span>
        {row.added && <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Added</span>}
        {row.removed && <span className="rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-medium text-rose-600 dark:text-rose-400">Removed</span>}
        {row.changed && <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Changed</span>}
        {canEdit && (
          <button
            type="button"
            onClick={onRestore}
            className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground opacity-0 transition-all hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
          >
            <RotateCcw className="h-3 w-3" /> Restore published value
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        <div className="min-w-0 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {before === "" ? (
            <span className="italic text-muted-foreground/60">Empty</span>
          ) : diff ? (
            diff.before.map((p, i) => (
              <span key={i} className={p.changed ? "rounded bg-rose-500/15 px-0.5 text-rose-600 line-through decoration-rose-500/50 dark:text-rose-400" : undefined}>
                {p.text}
              </span>
            ))
          ) : (
            <span className="whitespace-pre-wrap break-words">{before}</span>
          )}
        </div>
        <div className={cn("min-w-0 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed text-foreground", row.removed ? "border-[color:var(--border-hairline)]" : "border-emerald-500/40 bg-emerald-500/[0.04]")}>
          {after === "" ? (
            <span className="italic text-muted-foreground/60">Empty</span>
          ) : diff ? (
            diff.after.map((p, i) => (
              <span key={i} className={p.changed ? "rounded bg-emerald-500/20 px-0.5 font-medium text-emerald-800 dark:text-emerald-300" : undefined}>
                {p.text}
              </span>
            ))
          ) : (
            <span className="whitespace-pre-wrap break-words">{after}</span>
          )}
        </div>
      </div>
    </div>
  );
}
