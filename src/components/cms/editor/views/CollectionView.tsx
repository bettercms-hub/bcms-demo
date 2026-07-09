/**
 * CollectionView — the content workspace for a collection.
 *
 * One calm surface with two views: Table (dense data work) and Gallery
 * (visual browsing with thumbnails). CSV import/export lives in the
 * header. Everything is role-aware: reviewers browse and export,
 * content editors write, marketers publish.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Download,
  Image as ImageIcon,
  LayoutGrid,
  Plus,
  Search,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Table as TableIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { entryActions, entryCreateActions, useCMS } from "@/lib/cms/store";
import type { Collection, Entry, PublishState, Schema, SchemaField } from "@/lib/cms/types";
import { CreateEntityModal, type CreateKind } from "@/components/cms/modals/CreateEntityModal";
import { getReferenceLabel } from "@/lib/cms/references";
import { canEditContent, canPublish, canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { EntrySlideOver } from "./EntrySlideOver";

/* =========================================================================
   Types & constants
   ========================================================================= */

const STATUS_OPTIONS: Array<{ value: PublishState; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "review", label: "Review" },
  { value: "approved", label: "Approved" },
  { value: "scheduled", label: "Scheduled" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];
const VALID_STATUS = new Set<string>(STATUS_OPTIONS.map((o) => o.value));

type Density = "comfortable" | "compact" | "spacious";
type ViewMode = "table" | "gallery";

const DENSITY_KEY = "bcms.collection.density";
const HIDDEN_COLS_KEY = "bcms.collection.hiddenCols";
const VIEW_KEY = "bcms.collection.view";

interface Props {
  collectionId: string;
  onSelectEntry?: (entryId: string) => void;
}

/* =========================================================================
   Main component
   ========================================================================= */

export function CollectionView({ collectionId }: Props) {
  const params = useParams({ strict: false }) as { workspace?: string; project?: string };
  const navigate = useNavigate();
  const goToSchema = () => {
    if (params.workspace && params.project)
      navigate({
        to: "/w/$workspace/p/$project/schema",
        params: { workspace: params.workspace, project: params.project },
      });
  };
  const col = useCMS((s) => s.collections.find((c) => c.id === collectionId));
  const entries = useCMS((s) => s.entries.filter((e) => e.collectionId === collectionId));
  const schema = useCMS((s) => (col ? s.schemas.find((sc) => sc.id === col.schemaId) : undefined));
  const allEntries = useCMS((s) => s.entries);
  const collections = useCMS((s) => s.collections);
  const schemas = useCMS((s) => s.schemas);

  const { effective } = useEffectiveRole(params.workspace ?? "");
  const canEdit = canEditContent(effective);
  const showDev = canSeeDeveloper(effective);
  const publishAllowed = canPublish(effective);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<Set<PublishState>>(new Set());
  const [sortKey, setSortKey] = useState<string>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = useState(false);
  const [activeEntry, setActiveEntry] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [focusedIdx, setFocusedIdx] = useState<number>(-1);
  const importRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewMode>(() => {
    if (typeof window === "undefined") return "table";
    return localStorage.getItem(VIEW_KEY) === "gallery" ? "gallery" : "table";
  });
  const [density, setDensity] = useState<Density>(() => {
    if (typeof window === "undefined") return "comfortable";
    return (localStorage.getItem(DENSITY_KEY) as Density | null) ?? "comfortable";
  });
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      return new Set(JSON.parse(localStorage.getItem(HIDDEN_COLS_KEY) || "[]"));
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(DENSITY_KEY, density);
  }, [density]);
  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(VIEW_KEY, view);
  }, [view]);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem(HIDDEN_COLS_KEY, JSON.stringify([...hiddenCols]));
  }, [hiddenCols]);

  const listFieldNames = useMemo(() => {
    if (!schema) return [];
    if (schema.listFieldNames && schema.listFieldNames.length) return schema.listFieldNames;
    return schema.fields
      .filter((f) => !["richText", "json", "code", "image", "file"].includes(f.type))
      .slice(0, 3)
      .map((f) => f.name);
  }, [schema]);

  const listFields: SchemaField[] = useMemo(() => {
    if (!schema) return [];
    return listFieldNames
      .map((n) => schema.fields.find((f) => f.name === n))
      .filter((f): f is SchemaField => !!f);
  }, [schema, listFieldNames]);

  const visibleListFields = useMemo(
    () => listFields.filter((f) => !hiddenCols.has(`field:${f.name}`)),
    [listFields, hiddenCols],
  );
  const showStatus = !hiddenCols.has("status");
  const showUpdated = !hiddenCols.has("updatedAt");

  const coverField = useMemo(() => schema?.fields.find((f) => f.type === "image"), [schema]);
  const summaryField = useMemo(
    () =>
      schema?.fields.find(
        (f) => (f.type === "text" || f.type === "richText") && !listFieldNames.includes(f.name),
      ),
    [schema, listFieldNames],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (statusFilter.size > 0 && (!e.status || !statusFilter.has(e.status))) return false;
      if (!q) return true;
      if (e.title.toLowerCase().includes(q)) return true;
      for (const f of schema?.fields ?? []) {
        if (f.type !== "text" && f.type !== "url" && f.type !== "email") continue;
        const v = e.fields[f.name];
        if (typeof v === "string" && v.toLowerCase().includes(q)) return true;
      }
      return false;
    });
  }, [entries, query, statusFilter, schema]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    list.sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [filtered, sortKey, sortDir]);

  const lastUpdated = useMemo(() => {
    if (entries.length === 0) return null;
    return entries.reduce((max, e) => (e.updatedAt > max ? e.updatedAt : max), entries[0].updatedAt);
  }, [entries]);

  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const e of entries) if (e.status) m[e.status] = (m[e.status] ?? 0) + 1;
    return m;
  }, [entries]);

  // Keyboard navigation
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (activeEntry || createOpen || renamingId) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable))
        return;
      if (sorted.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusedIdx((i) => Math.min(sorted.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusedIdx((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter" && focusedIdx >= 0) {
        e.preventDefault();
        setActiveEntry(sorted[focusedIdx]?.id ?? null);
      } else if (e.key === " " && focusedIdx >= 0 && canEdit) {
        e.preventDefault();
        const id = sorted[focusedIdx]?.id;
        if (!id) return;
        setSelected((prev) => {
          const n = new Set(prev);
          if (n.has(id)) n.delete(id);
          else n.add(id);
          return n;
        });
      } else if ((e.key === "Delete" || e.key === "Backspace") && focusedIdx >= 0 && e.metaKey && canEdit) {
        e.preventDefault();
        const id = sorted[focusedIdx]?.id;
        if (id) entryActions.remove(id);
      } else if (e.key === "a" && (e.metaKey || e.ctrlKey) && canEdit) {
        e.preventDefault();
        setSelected(new Set(sorted.map((x) => x.id)));
      } else if (e.key === "Escape") {
        setSelected(new Set());
        setFocusedIdx(-1);
      }
    },
    [activeEntry, createOpen, renamingId, sorted, focusedIdx, canEdit],
  );
  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  if (!col) return null;

  const toggleSort = (k: string) => {
    if (k === sortKey) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };
  const toggleSelectAll = () => {
    if (selected.size === sorted.length) setSelected(new Set());
    else setSelected(new Set(sorted.map((e) => e.id)));
  };
  const toggleStatus = (s: PublishState) => {
    setStatusFilter((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });
  };
  const bulk = (fn: (id: string) => void) => {
    selected.forEach(fn);
    setSelected(new Set());
  };

  const intent: CreateKind | null =
    params.workspace && params.project
      ? { type: "entry", collectionId, workspace: params.workspace, project: params.project }
      : null;

  const densityPad = density === "compact" ? "h-11" : density === "spacious" ? "h-[68px]" : "h-14";

  const toggleHidden = (key: string) =>
    setHiddenCols((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const commitRename = (id: string, next: string) => {
    const value = next.trim();
    if (value) entryActions.update(id, { title: value });
    setRenamingId(null);
  };

  /* ------------------------------------------------------------- CSV I/O */

  const exportCsv = () => {
    // The entry title is its own column; skip the schema field that mirrors it.
    const fields = (schema?.fields ?? []).filter((f) => f.name !== (schema?.titleFieldName ?? "title"));
    const headers = ["Title", "Status", "Updated", ...fields.map((f) => f.label)];
    const rows = sorted.map((e) => [
      e.title,
      e.status ?? "",
      e.updatedAt,
      ...fields.map((f) => {
        const v = e.fields[f.name];
        if (v === undefined || v === null) return "";
        return typeof v === "object" ? JSON.stringify(v) : String(v);
      }),
    ]);
    const csv = [headers, ...rows].map((r) => r.map(csvEscape).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${col.slug || "entries"}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${sorted.length} ${sorted.length === 1 ? "entry" : "entries"}`);
  };

  const importCsv = (file: File) => {
    file
      .text()
      .then((text) => {
        const rows = parseCsv(text);
        if (rows.length < 2) {
          toast.error("The CSV needs a header row and at least one entry");
          return;
        }
        const headers = rows[0].map((h) => h.trim().toLowerCase());
        const mapping = headers.map((h) => {
          if (h === "title") return "__title";
          if (h === "status") return "__status";
          const f = schema?.fields.find(
            (x) => x.name.toLowerCase() === h || x.label.toLowerCase() === h,
          );
          return f ? f.name : null;
        });
        if (!mapping.includes("__title")) {
          toast.error('The CSV needs a "Title" column');
          return;
        }
        let created = 0;
        for (const r of rows.slice(1)) {
          const title = (r[mapping.indexOf("__title")] ?? "").trim() || "Untitled";
          const id = entryCreateActions.add(collectionId, title);
          mapping.forEach((key, i) => {
            if (!key || key.startsWith("__")) return;
            const raw = r[i] ?? "";
            if (raw === "") return;
            const f = schema?.fields.find((x) => x.name === key);
            let v: unknown = raw;
            if (f?.type === "boolean") v = /^(true|yes|1)$/i.test(raw);
            else if (f?.type === "number") {
              const n = Number(raw);
              v = Number.isFinite(n) ? n : raw;
            }
            entryActions.setField(id, key, v);
          });
          const si = mapping.indexOf("__status");
          const st = si >= 0 ? (r[si] ?? "").trim().toLowerCase() : "";
          if (st && VALID_STATUS.has(st)) entryActions.setStatus(id, st as PublishState);
          created++;
        }
        toast.success(`Imported ${created} ${created === 1 ? "entry" : "entries"}`);
      })
      .catch(() => toast.error("Could not read that file"));
  };

  const activeChips = STATUS_OPTIONS.filter((o) => (statusCounts[o.value] ?? 0) > 0);

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-6">
      {/* ============= Header ============= */}
      <header className="mb-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h1 className="truncate text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">
            {col.name}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
            <span className="tabular-nums">
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </span>
            <Dot />
            <span className="tabular-nums">
              {schema?.fields.length ?? 0} {schema?.fields.length === 1 ? "field" : "fields"}
            </span>
            {lastUpdated && (
              <>
                <Dot />
                <span>Updated {relativeTime(lastUpdated)}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex max-w-full shrink-0 flex-wrap items-center gap-1.5">
          {canEdit && (
            <>
              <input
                ref={importRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f);
                  e.target.value = "";
                }}
              />
              <SecondaryBtn onClick={() => importRef.current?.click()} icon={Upload}>
                Import
              </SecondaryBtn>
            </>
          )}
          <SecondaryBtn onClick={exportCsv} icon={Download}>
            Export
          </SecondaryBtn>
          {showDev && (
            <SecondaryBtn onClick={goToSchema} icon={Settings2}>
              Edit schema
            </SecondaryBtn>
          )}
          {canEdit && (
            <button
              type="button"
              disabled={!intent}
              onClick={() => setCreateOpen(true)}
              className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> New entry
            </button>
          )}
        </div>
      </header>

      {/* ============= Toolbar ============= */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="View"
          className="inline-flex h-8 items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
        >
          <ViewBtn active={view === "table"} onClick={() => setView("table")} label="Table" icon={TableIcon} />
          <ViewBtn active={view === "gallery"} onClick={() => setView("gallery")} label="Gallery" icon={LayoutGrid} />
        </div>

        {activeChips.length > 1 && (
          <>
            <span className="h-5 w-px bg-border" aria-hidden />
            <button type="button" onClick={() => setStatusFilter(new Set())} className={chipClass(statusFilter.size === 0)}>
              All <span className="tabular-nums opacity-60">{entries.length}</span>
            </button>
            {activeChips.map((opt) => {
              const active = statusFilter.has(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleStatus(opt.value)}
                  aria-pressed={active}
                  className={chipClass(active)}
                >
                  <StatusDot state={opt.value} />
                  {opt.label}
                  <span className="tabular-nums opacity-60">{statusCounts[opt.value]}</span>
                </button>
              );
            })}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search entries"
              className="h-8 w-44 rounded-lg border border-border bg-background pl-8 pr-2.5 text-[12.5px] text-foreground transition-[width] duration-200 placeholder:text-muted-foreground/70 focus:w-60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/15"
            />
          </div>
          {view === "table" && (
            <ColumnsPopover
              density={density}
              setDensity={setDensity}
              listFields={listFields}
              hiddenCols={hiddenCols}
              toggleHidden={toggleHidden}
              showStatus={showStatus}
              showUpdated={showUpdated}
            />
          )}
        </div>
      </div>

      {/* ============= Body ============= */}
      {sorted.length === 0 ? (
        <EmptyEntries
          onCreate={() => setCreateOpen(true)}
          disabled={!intent || !canEdit}
          hasFilters={query.trim() !== "" || statusFilter.size > 0}
          onClearFilters={() => {
            setQuery("");
            setStatusFilter(new Set());
          }}
        />
      ) : view === "table" ? (
        <TableView
          sorted={sorted}
          selected={selected}
          setSelected={setSelected}
          focusedIdx={focusedIdx}
          setFocusedIdx={setFocusedIdx}
          onOpen={setActiveEntry}
          renamingId={renamingId}
          setRenamingId={setRenamingId}
          commitRename={commitRename}
          visibleListFields={visibleListFields}
          showStatus={showStatus}
          showUpdated={showUpdated}
          sortKey={sortKey}
          sortDir={sortDir}
          toggleSort={toggleSort}
          toggleSelectAll={toggleSelectAll}
          densityPad={densityPad}
          coverField={coverField}
          query={query}
          canEdit={canEdit}
          publishAllowed={publishAllowed}
          ctx={{ allEntries, collections, schemas }}
        />
      ) : (
        <GalleryView
          entries={sorted}
          coverField={coverField}
          summaryField={summaryField}
          onOpen={setActiveEntry}
          focusedIdx={focusedIdx}
          query={query}
        />
      )}

      {/* ============= Floating bulk bar ============= */}
      {canEdit && selected.size > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-border bg-card px-2 py-1.5 text-[13px] shadow-[var(--shadow-elevated)] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <span className="px-2 font-medium tabular-nums text-foreground">{selected.size} selected</span>
            <span className="mx-1 h-5 w-px bg-border" />
            {publishAllowed && (
              <BulkBtn onClick={() => bulk((id) => entryActions.publish(id))}>Publish</BulkBtn>
            )}
            <BulkBtn onClick={() => bulk((id) => entryActions.duplicate(id))}>Duplicate</BulkBtn>
            <BulkBtn onClick={() => bulk((id) => entryActions.setStatus(id, "archived"))}>Archive</BulkBtn>
            <BulkBtn onClick={() => bulk((id) => entryActions.remove(id))} destructive>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </BulkBtn>
            <span className="mx-1 h-5 w-px bg-border" />
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
              aria-label="Clear selection"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      <CreateEntityModal open={createOpen} onOpenChange={setCreateOpen} intent={intent} />

      <EntrySlideOver
        open={activeEntry !== null}
        onOpenChange={(v) => {
          if (!v) setActiveEntry(null);
        }}
        entryId={activeEntry}
      />
    </div>
  );
}

/* =========================================================================
   Table view
   ========================================================================= */

function TableView({
  sorted,
  selected,
  setSelected,
  focusedIdx,
  setFocusedIdx,
  onOpen,
  renamingId,
  setRenamingId,
  commitRename,
  visibleListFields,
  showStatus,
  showUpdated,
  sortKey,
  sortDir,
  toggleSort,
  toggleSelectAll,
  densityPad,
  coverField,
  query,
  canEdit,
  publishAllowed,
  ctx,
}: {
  sorted: Entry[];
  selected: Set<string>;
  setSelected: (s: Set<string>) => void;
  focusedIdx: number;
  setFocusedIdx: (i: number) => void;
  onOpen: (id: string) => void;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  commitRename: (id: string, next: string) => void;
  visibleListFields: SchemaField[];
  showStatus: boolean;
  showUpdated: boolean;
  sortKey: string;
  sortDir: "asc" | "desc";
  toggleSort: (k: string) => void;
  toggleSelectAll: () => void;
  densityPad: string;
  coverField?: SchemaField;
  query: string;
  canEdit: boolean;
  publishAllowed: boolean;
  ctx: { allEntries: Entry[]; collections: Collection[]; schemas: Schema[] };
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="max-h-[calc(100vh-280px)] overflow-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <tr className="text-left text-[11.5px] font-medium text-muted-foreground">
              {canEdit && (
                <th className="w-10 border-b border-border-hairline bg-card px-3.5 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.size === sorted.length && sorted.length > 0}
                    onChange={toggleSelectAll}
                    className="h-3.5 w-3.5 cursor-pointer accent-[color:var(--primary)]"
                    aria-label="Select all"
                  />
                </th>
              )}
              <SortHeader label="Title" k="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} minWidth="min-w-[260px]" />
              {visibleListFields.map((f) => (
                <SortHeader key={f.id} label={f.label} k={`field:${f.name}`} sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
              ))}
              {showStatus && <SortHeader label="Status" k="status" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />}
              {showUpdated && <SortHeader label="Updated" k="updatedAt" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />}
            </tr>
          </thead>
          <tbody>
            {sorted.map((e, idx) => {
              const isSelected = selected.has(e.id);
              const isFocused = focusedIdx === idx;
              const cover = coverField ? (e.fields[coverField.name] as string | undefined) : undefined;
              return (
                <ContextMenu key={e.id}>
                  <ContextMenuTrigger asChild>
                    <tr
                      onClick={() => onOpen(e.id)}
                      onMouseEnter={() => setFocusedIdx(idx)}
                      className={`group/row cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-primary/[0.045]"
                          : isFocused
                            ? "bg-[color:var(--row-hover)]"
                            : "hover:bg-[color:var(--row-hover)]"
                      }`}
                    >
                      {canEdit && (
                        <td
                          className={`relative border-b border-border-hairline px-3.5 ${densityPad} align-middle`}
                          onClick={(ev) => ev.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={(ev) => {
                              const next = new Set(selected);
                              if (ev.target.checked) next.add(e.id);
                              else next.delete(e.id);
                              setSelected(next);
                            }}
                            className="h-3.5 w-3.5 cursor-pointer accent-[color:var(--primary)]"
                            aria-label={`Select ${e.title}`}
                          />
                          {isSelected && <span className="absolute left-0 top-0 h-full w-[3px] bg-primary" aria-hidden />}
                        </td>
                      )}
                      <td
                        className={`max-w-[380px] border-b border-border-hairline px-3.5 ${densityPad} align-middle font-medium text-foreground`}
                        onDoubleClick={(ev) => {
                          if (!canEdit) return;
                          ev.stopPropagation();
                          setRenamingId(e.id);
                        }}
                      >
                        {renamingId === e.id ? (
                          <input
                            autoFocus
                            defaultValue={e.title}
                            onClick={(ev) => ev.stopPropagation()}
                            onBlur={(ev) => commitRename(e.id, ev.target.value)}
                            onKeyDown={(ev) => {
                              if (ev.key === "Enter") commitRename(e.id, (ev.target as HTMLInputElement).value);
                              if (ev.key === "Escape") setRenamingId(null);
                            }}
                            className="-mx-1 w-full rounded border border-primary/40 bg-background px-1 py-0.5 text-[13px] font-medium focus:outline-none"
                          />
                        ) : (
                          <div className="flex min-w-0 items-center gap-2.5">
                            {coverField && <Thumb src={cover} title={e.title} className="h-8 w-12 shrink-0 rounded-md" />}
                            <span className="truncate" title={e.title}>
                              {highlight(e.title, query)}
                            </span>
                          </div>
                        )}
                      </td>
                      {visibleListFields.map((f) => (
                        <td key={f.id} className={`border-b border-border-hairline px-3.5 ${densityPad} align-middle`}>
                          <RichCell field={f} value={e.fields[f.name]} entryId={e.id} ctx={ctx} query={query} />
                        </td>
                      ))}
                      {showStatus && (
                        <td className={`border-b border-border-hairline px-3.5 ${densityPad} align-middle`}>
                          {e.status ? <StatusPill state={e.status} /> : null}
                        </td>
                      )}
                      {showUpdated && (
                        <td
                          className={`border-b border-border-hairline px-3.5 ${densityPad} whitespace-nowrap align-middle text-[12px] text-muted-foreground`}
                          title={new Date(e.updatedAt).toLocaleString()}
                        >
                          {relativeTime(e.updatedAt)}
                        </td>
                      )}
                    </tr>
                  </ContextMenuTrigger>
                  <ContextMenuContent className="w-52">
                    <ContextMenuItem onSelect={() => onOpen(e.id)}>Open</ContextMenuItem>
                    {canEdit && (
                      <>
                        <ContextMenuItem onSelect={() => setRenamingId(e.id)}>Rename</ContextMenuItem>
                        <ContextMenuItem onSelect={() => entryActions.duplicate(e.id)}>Duplicate</ContextMenuItem>
                        <ContextMenuSeparator />
                        {publishAllowed && (
                          <ContextMenuItem onSelect={() => entryActions.publish(e.id)}>Publish</ContextMenuItem>
                        )}
                        <ContextMenuItem onSelect={() => entryActions.setStatus(e.id, "archived")}>Archive</ContextMenuItem>
                      </>
                    )}
                    <ContextMenuSeparator />
                    <ContextMenuItem onSelect={() => navigator.clipboard?.writeText(e.id).catch(() => {})}>
                      Copy ID
                    </ContextMenuItem>
                    {canEdit && (
                      <>
                        <ContextMenuSeparator />
                        <ContextMenuItem className="text-destructive" onSelect={() => entryActions.remove(e.id)}>
                          Delete
                        </ContextMenuItem>
                      </>
                    )}
                  </ContextMenuContent>
                </ContextMenu>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================================================================
   Gallery view
   ========================================================================= */

function GalleryView({
  entries,
  coverField,
  summaryField,
  onOpen,
  focusedIdx,
  query,
}: {
  entries: Entry[];
  coverField?: SchemaField;
  summaryField?: SchemaField;
  onOpen: (id: string) => void;
  focusedIdx: number;
  query: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {entries.map((e, idx) => {
        const cover = coverField ? (e.fields[coverField.name] as string | undefined) : undefined;
        const summary = summaryField ? (e.fields[summaryField.name] as string | undefined) : undefined;
        return (
          <button
            key={e.id}
            type="button"
            onClick={() => onOpen(e.id)}
            className={`group flex flex-col overflow-hidden rounded-xl border border-border bg-card text-left shadow-[var(--shadow-card)] transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[var(--shadow-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
              focusedIdx === idx ? "ring-2 ring-primary/40 ring-offset-2 ring-offset-background" : ""
            }`}
          >
            <div className="relative aspect-[16/9] w-full overflow-hidden">
              <Thumb src={cover} title={e.title} className="size-full" large />
              {e.status && (
                <div className="absolute right-2.5 top-2.5">
                  <StatusPill state={e.status} />
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-4">
              <div className="line-clamp-2 text-[14px] font-semibold leading-snug text-foreground">
                {highlight(e.title, query)}
              </div>
              {summary && (
                <div className="line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">{summary}</div>
              )}
              <div className="mt-auto pt-2 text-[11.5px] text-muted-foreground">
                Updated {relativeTime(e.updatedAt)}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* =========================================================================
   Thumbnails
   ========================================================================= */

const THUMB_TINTS = [
  "from-sky-100 to-indigo-100 text-indigo-400",
  "from-rose-100 to-orange-100 text-rose-400",
  "from-emerald-100 to-teal-100 text-teal-500",
  "from-violet-100 to-fuchsia-100 text-violet-400",
  "from-amber-100 to-yellow-100 text-amber-500",
  "from-slate-100 to-zinc-100 text-slate-400",
];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Image with a graceful, deterministic fallback tile (soft gradient + initial). */
function Thumb({ src, title, className, large }: { src?: string; title: string; className?: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
        className={`object-cover ${className ?? ""} ${large ? "transition-transform duration-500 group-hover:scale-[1.03]" : ""}`}
        draggable={false}
      />
    );
  }
  const tint = THUMB_TINTS[hashStr(title) % THUMB_TINTS.length];
  const letter = title.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className={`grid place-items-center bg-gradient-to-br ${tint} ${className ?? ""}`} aria-hidden>
      {large ? (
        <span className="text-[32px] font-semibold opacity-80">{letter}</span>
      ) : (
        <ImageIcon className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} />
      )}
    </div>
  );
}

/* =========================================================================
   Empty state
   ========================================================================= */

function EmptyEntries({
  onCreate,
  disabled,
  hasFilters,
  onClearFilters,
}: {
  onCreate: () => void;
  disabled: boolean;
  hasFilters: boolean;
  onClearFilters: () => void;
}) {
  if (hasFilters) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-muted text-muted-foreground">
          <Search className="h-5 w-5" />
        </div>
        <div className="text-[15px] font-semibold text-foreground">No matching entries</div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">Try adjusting your search or filters.</div>
        <button
          onClick={onClearFilters}
          className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-background px-3.5 text-[13px] font-medium hover:bg-[color:var(--row-hover)]"
        >
          Clear filters
        </button>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-14 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Sparkles className="h-6 w-6" />
      </div>
      <div className="text-[16px] font-semibold text-foreground">No entries yet</div>
      <div className="mx-auto mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
        Create your first entry to start populating this collection. You can publish, schedule, or save drafts at any time.
      </div>
      <button
        disabled={disabled}
        onClick={onCreate}
        className="mt-6 inline-flex h-10 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13.5px] font-medium text-primary-foreground shadow-sm hover:opacity-95 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" /> Create entry
      </button>
    </div>
  );
}

/* =========================================================================
   Atoms
   ========================================================================= */

function Dot() {
  return <span aria-hidden className="text-muted-foreground/40">·</span>;
}

function SecondaryBtn({
  onClick,
  icon: Icon,
  children,
  disabled,
}: {
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground disabled:opacity-40"
    >
      <Icon className="h-3.5 w-3.5" /> {children}
    </button>
  );
}

function chipClass(active: boolean) {
  return [
    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-medium transition-colors",
    active
      ? "bg-primary/10 text-primary ring-1 ring-inset ring-primary/25"
      : "bg-[color:var(--s2)] text-muted-foreground hover:text-foreground",
  ].join(" ");
}

const STATUS_DOT_COLOR: Record<PublishState, string> = {
  draft: "bg-zinc-400",
  review: "bg-amber-500",
  approved: "bg-sky-500",
  scheduled: "bg-violet-500",
  published: "bg-emerald-500",
  archived: "bg-zinc-400",
};

function StatusDot({ state }: { state: PublishState }) {
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_COLOR[state]}`} aria-hidden />;
}

const STATUS_PILL_CLS: Record<PublishState, string> = {
  draft: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  review: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  approved: "bg-sky-50 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
  scheduled: "bg-violet-50 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300",
  published: "bg-emerald-50 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
  archived: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800/60 dark:text-zinc-400",
};

function StatusPill({ state }: { state: PublishState }) {
  return (
    <span className={`inline-flex h-[22px] items-center gap-1.5 rounded-full px-2 text-[11px] font-medium ${STATUS_PILL_CLS[state]}`}>
      <StatusDot state={state} />
      <span className="capitalize">{state}</span>
    </span>
  );
}

function BulkBtn({
  onClick,
  children,
  destructive,
}: {
  onClick: () => void;
  children: React.ReactNode;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium transition-colors ${
        destructive ? "text-destructive hover:bg-destructive/10" : "text-foreground hover:bg-[color:var(--row-hover)]"
      }`}
    >
      {children}
    </button>
  );
}

function ViewBtn({
  active,
  onClick,
  label,
  icon: Icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <button
      type="button"
      role="tab"
      onClick={onClick}
      aria-selected={active}
      aria-label={label}
      title={label}
      className={`grid h-7 w-8 place-items-center rounded-md transition-colors ${
        active
          ? "bg-[color:var(--row-hover)] text-foreground shadow-[0_0_0_1px_var(--border)]"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ColumnsPopover({
  density,
  setDensity,
  listFields,
  hiddenCols,
  toggleHidden,
  showStatus,
  showUpdated,
}: {
  density: Density;
  setDensity: (d: Density) => void;
  listFields: SchemaField[];
  hiddenCols: Set<string>;
  toggleHidden: (k: string) => void;
  showStatus: boolean;
  showUpdated: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Display options"
          aria-label="Display options"
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <div className="mb-3">
          <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">Density</div>
          <div className="inline-flex w-full rounded-md border border-border bg-background p-0.5">
            {(["compact", "comfortable", "spacious"] as Density[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDensity(d)}
                className={`flex-1 rounded px-2 py-1 text-[11.5px] font-medium capitalize transition-colors ${
                  density === d
                    ? "bg-[color:var(--row-hover)] text-foreground shadow-[0_0_0_1px_var(--border)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-1.5 text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">
          Visible columns
        </div>
        <div className="space-y-0.5">
          {listFields.map((f) => (
            <ColumnRow
              key={f.name}
              label={f.label}
              checked={!hiddenCols.has(`field:${f.name}`)}
              onToggle={() => toggleHidden(`field:${f.name}`)}
            />
          ))}
          <ColumnRow label="Status" checked={showStatus} onToggle={() => toggleHidden("status")} />
          <ColumnRow label="Updated" checked={showUpdated} onToggle={() => toggleHidden("updatedAt")} />
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ColumnRow({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <label className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-[color:var(--row-hover)]">
      <span className="text-foreground">{label}</span>
      <Switch checked={checked} onCheckedChange={onToggle} />
    </label>
  );
}

function SortHeader({
  label,
  k,
  sortKey,
  sortDir,
  onSort,
  minWidth,
}: {
  label: string;
  k: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  onSort: (k: string) => void;
  minWidth?: string;
}) {
  const active = sortKey === k;
  const Arrow = sortDir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th className={`group/h border-b border-border-hairline px-3.5 py-2.5 font-medium ${minWidth ?? ""}`}>
      <button
        type="button"
        onClick={() => onSort(k)}
        className={`inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
          active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span>{label}</span>
        <Arrow className={`h-3 w-3 transition-opacity ${active ? "opacity-100" : "opacity-0 group-hover/h:opacity-50"}`} />
      </button>
    </th>
  );
}

/* =========================================================================
   Rich cells
   ========================================================================= */

function RichCell({
  field,
  value,
  ctx,
  query,
}: {
  field: SchemaField;
  value: unknown;
  entryId: string;
  ctx: { allEntries: Entry[]; collections: Collection[]; schemas: Schema[] };
  query: string;
}) {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground/40">—</span>;
  }

  if (field.type === "boolean") {
    return (
      <span
        className={`inline-flex h-[20px] items-center rounded-full px-2 text-[11px] font-medium ${
          value ? "bg-emerald-50 text-emerald-700" : "bg-[color:var(--s2)] text-muted-foreground"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }

  if (field.type === "reference" && typeof value === "string") {
    const e = ctx.allEntries.find((x) => x.id === value);
    if (!e) return <span className="text-muted-foreground/40">—</span>;
    const c = ctx.collections.find((x) => x.id === e.collectionId);
    const sch = c ? ctx.schemas.find((s) => s.id === c.schemaId) : undefined;
    const label = getReferenceLabel(e, sch);
    return (
      <span className="inline-flex max-w-[200px] items-center gap-1.5 rounded-full bg-muted/60 py-0.5 pl-1 pr-2 text-[12px] text-foreground">
        <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
          {initials(label)}
        </span>
        <span className="truncate">{label}</span>
      </span>
    );
  }

  if (field.type === "multiReference" && Array.isArray(value)) {
    return (
      <span className="text-[12px] text-muted-foreground">
        {value.length} item{value.length === 1 ? "" : "s"}
      </span>
    );
  }

  if (field.type === "image" && typeof value === "string") {
    return (
      <div className="h-7 w-10 overflow-hidden rounded bg-muted">
        <img src={value} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  if (field.type === "url" && typeof value === "string") {
    return (
      <a
        href={value}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="inline-block max-w-[240px] truncate text-[12.5px] text-primary hover:underline"
      >
        {value}
      </a>
    );
  }

  if (field.type === "date" && (typeof value === "string" || typeof value === "number")) {
    return (
      <span className="whitespace-nowrap text-[12px] text-muted-foreground" title={new Date(value).toLocaleString()}>
        {new Date(value).toLocaleDateString()}
      </span>
    );
  }

  if (field.type === "richText") {
    const plain = typeof value === "string" ? value : JSON.stringify(value);
    return (
      <span className="line-clamp-1 max-w-[320px] text-[12.5px] text-muted-foreground">
        {plain.replace(/<[^>]+>/g, "")}
      </span>
    );
  }

  const text = String(value);
  return (
    <span className="line-clamp-1 max-w-[320px] text-foreground" title={text}>
      {highlight(text, query)}
    </span>
  );
}

/* =========================================================================
   CSV helpers
   ========================================================================= */

function csvEscape(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Small CSV parser: quoted cells, escaped quotes, CRLF. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cur);
      cur = "";
    } else if (ch === "\n") {
      row.push(cur.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cur = "";
    } else {
      cur += ch;
    }
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/* =========================================================================
   Helpers
   ========================================================================= */

function highlight(text: string, q: string): React.ReactNode {
  const query = q.trim();
  if (!query) return text;
  const i = text.toLowerCase().indexOf(query.toLowerCase());
  if (i < 0) return text;
  return (
    <>
      {text.slice(0, i)}
      <mark className="rounded-sm bg-primary/15 px-0.5 text-foreground">{text.slice(i, i + query.length)}</mark>
      {text.slice(i + query.length)}
    </>
  );
}

function initials(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function sortValue(e: Entry, key: string): string | number {
  if (key === "title") return e.title.toLowerCase();
  if (key === "status") return e.status ?? "";
  if (key === "updatedAt") return e.updatedAt;
  if (key.startsWith("field:")) {
    const name = key.slice("field:".length);
    const v = e.fields[name];
    if (typeof v === "string" || typeof v === "number") return v;
    return String(v ?? "");
  }
  return "";
}

function relativeTime(ts: string | number): string {
  const t = typeof ts === "string" ? Date.parse(ts) : ts;
  const diff = Date.now() - t;
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}
