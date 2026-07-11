/**
 * CompareVersionsDialog — Published ↔ Draft, side by side, for one entry.
 *
 * Kept deliberately calm: changed fields first (unchanged behind a toggle),
 * two aligned value columns with word-level highlights (removed words struck
 * in the published column, new words highlighted in the draft column), and
 * one action per row — restore the published value into the draft. Nothing
 * else. The published column is read-only by definition.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, History, RotateCcw, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { entryActions, useCMS } from "@/lib/cms/store";
import { diffText } from "@/lib/cms/diff-text";
import { relativeTime } from "@/lib/cms/snapshots";
import { docToPlainText, type DocValue } from "@/lib/cms/blocks/doc";
import { Switch } from "@/components/ui/switch";
import type { Entry, SchemaField } from "@/lib/cms/types";

interface FieldRowModel {
  key: string;
  label: string;
  type: SchemaField["type"] | "title";
  published: unknown;
  draft: unknown;
  changed: boolean;
}

function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  // A rich-text DocValue renders as readable prose, not raw JSON.
  if (v && typeof v === "object" && (v as DocValue).version === 1 && Array.isArray((v as DocValue).blocks)) {
    return docToPlainText(v as DocValue);
  }
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean).join(", ");
  return JSON.stringify(v, null, 2);
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function CompareVersionsDialog({ entryId, onClose, canEdit }: { entryId: string; onClose: () => void; canEdit: boolean }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  const collection = useCMS((s) => (entry ? s.collections.find((c) => c.id === entry.collectionId) : undefined));
  const schema = useCMS((s) => (collection ? s.schemas.find((sc) => sc.id === collection.schemaId) : undefined));
  const [showUnchanged, setShowUnchanged] = useState(false);

  // Close on Escape without letting a parent dialog (the entry slide-over) act on it.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const rows = useMemo<FieldRowModel[]>(() => {
    if (!entry) return [];
    const snap = entry.publishedSnapshot?.entry;
    const out: FieldRowModel[] = [];
    out.push({
      key: "__title",
      label: "Title",
      type: "title",
      published: snap?.title ?? "",
      draft: entry.title,
      changed: (snap?.title ?? "") !== entry.title,
    });
    const seen = new Set<string>();
    for (const f of schema?.fields ?? []) {
      seen.add(f.name);
      const pub = snap?.fields?.[f.name];
      const dr = entry.fields[f.name];
      out.push({
        key: f.name,
        label: f.label || f.name,
        type: f.type,
        published: pub,
        draft: dr,
        changed: JSON.stringify(pub ?? null) !== JSON.stringify(dr ?? null),
      });
    }
    // Draft fields the schema no longer lists still deserve a row when changed.
    for (const [k, v] of Object.entries(entry.fields)) {
      if (seen.has(k)) continue;
      const pub = snap?.fields?.[k];
      if (JSON.stringify(pub ?? null) === JSON.stringify(v ?? null)) continue;
      out.push({ key: k, label: k, type: "text", published: pub, draft: v, changed: true });
    }
    return out;
  }, [entry, schema]);

  if (!entry) return null;
  const snap = entry.publishedSnapshot;
  const changedCount = rows.filter((r) => r.changed).length;
  const visible = rows.filter((r) => r.changed || showUnchanged);

  function restore(row: FieldRowModel) {
    if (row.type === "title") entryActions.update(entry!.id, { title: String(row.published ?? "") });
    else entryActions.setField(entry!.id, row.key, row.published);
    toast.success(`Restored published ${row.label.toLowerCase()}`);
  }

  return createPortal(
    <div className="fixed inset-0 z-[95] pointer-events-auto" data-nested-dialog>
      <div className="absolute inset-0 bg-slate-900/50" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Compare versions"
        className="absolute inset-x-3 inset-y-[3vh] mx-auto flex max-w-[1060px] flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl sm:inset-x-6"
      >
        {/* header */}
        <div className="grid shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold">Compare versions</span>
            <span className="hidden truncate text-[12px] text-muted-foreground sm:block">{stripTags(entry.title)}</span>
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
          <div className="flex items-center justify-end gap-3">
            <label className="hidden cursor-pointer items-center gap-2 text-[12px] text-muted-foreground sm:flex">
              Show unchanged
              <Switch checked={showUnchanged} onCheckedChange={setShowUnchanged} aria-label="Show unchanged fields" />
            </label>
            <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* body */}
        {!snap ? (
          <EmptyState title="Not published yet" body="Publish this entry once and you can compare any later draft against it here." />
        ) : changedCount === 0 && !showUnchanged ? (
          <EmptyState
            title="No differences"
            body="The draft matches the published version. Edit a field and the comparison shows up here."
            action={
              <button type="button" onClick={() => setShowUnchanged(true)} className="mt-3 text-[12.5px] font-medium text-primary hover:underline">
                Show all fields anyway
              </button>
            }
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[960px] px-4 py-4 sm:px-6">
              <div className="mb-3 flex items-center gap-2 text-[12px] text-muted-foreground">
                <History className="h-3.5 w-3.5" />
                {changedCount === 0 ? "No changes" : `${changedCount} ${changedCount === 1 ? "field" : "fields"} changed`} · published version captured {relativeTime(snap.capturedAt)}
              </div>
              <div className="space-y-4">
                {visible.map((row) => (
                  <CompareRow key={row.key} row={row} canEdit={canEdit} onRestore={() => restore(row)} />
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

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="grid flex-1 place-items-center p-10 text-center">
      <div className="max-w-sm">
        <div className="text-[14px] font-semibold text-foreground">{title}</div>
        <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">{body}</p>
        {action}
      </div>
    </div>
  );
}

function CompareRow({ row, canEdit, onRestore }: { row: FieldRowModel; canEdit: boolean; onRestore: () => void }) {
  const pubText = stripTags(asText(row.published));
  const draftText = stripTags(asText(row.draft));
  const isImage = row.type === "image";
  const diff = useMemo(() => (row.changed && !isImage ? diffText(pubText, draftText) : null), [row.changed, isImage, pubText, draftText]);

  return (
    <div className={cn("group", !row.changed && "opacity-55")}>
      <div className="mb-1.5 flex items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{row.label}</span>
        {row.changed && (
          <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">Changed</span>
        )}
        {row.changed && canEdit && (
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
        {/* Published */}
        <div className="min-w-0 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-3 py-2.5 text-[13px] leading-relaxed text-muted-foreground">
          {isImage ? (
            <ImageValue url={pubText} />
          ) : pubText === "" ? (
            <span className="italic text-muted-foreground/60">Empty</span>
          ) : diff ? (
            diff.before.map((p, i) => (
              <span key={i} className={p.changed ? "rounded bg-rose-500/15 px-0.5 text-rose-600 line-through decoration-rose-500/50 dark:text-rose-400" : undefined}>
                {p.text}
              </span>
            ))
          ) : (
            <span className="whitespace-pre-wrap break-words">{pubText}</span>
          )}
        </div>
        {/* Draft */}
        <div
          className={cn(
            "min-w-0 rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed text-foreground",
            row.changed ? "border-emerald-500/40 bg-emerald-500/[0.04]" : "border-[color:var(--border-hairline)]",
          )}
        >
          {isImage ? (
            <ImageValue url={draftText} highlight={row.changed} />
          ) : draftText === "" ? (
            <span className="italic text-muted-foreground/60">Empty</span>
          ) : diff ? (
            diff.after.map((p, i) => (
              <span key={i} className={p.changed ? "rounded bg-emerald-500/20 px-0.5 font-medium text-emerald-800 dark:text-emerald-300" : undefined}>
                {p.text}
              </span>
            ))
          ) : (
            <span className="whitespace-pre-wrap break-words">{draftText}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function ImageValue({ url, highlight }: { url: string; highlight?: boolean }) {
  if (!url) return <span className="italic text-muted-foreground/60">No image</span>;
  return (
    <img
      src={url}
      alt=""
      className={cn("h-24 w-40 rounded-md object-cover", highlight && "ring-2 ring-[color:var(--primary)]")}
      loading="lazy"
    />
  );
}
