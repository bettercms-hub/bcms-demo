import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDownAZ,
  ArrowLeftRight,
  ArrowUpDown,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Clock,
  Copy,
  Database,
  Download,
  FileIcon,
  ExternalLink,
  FileText,
  Film,
  Filter as FilterIcon,
  Folder,
  Grid3x3,
  HardDrive,
  Image as ImageIcon,
  LayoutList,
  Link2,
  Link as LinkUrlIcon,
  MoreHorizontal,
  Music,
  Play,
  Plus,
  RotateCcw,
  Search,
  Shapes,
  Sparkles,
  Tag,
  Trash2,
  Upload,
  Wand2,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { media as MEDIA } from "@/lib/cms/mock-data";
import { mediaFolderActions, useCMS } from "@/lib/cms/store";
import type { MediaAsset, MediaFolder } from "@/lib/cms/types";
import { toast } from "sonner";

type ViewMode = "grid" | "list";
type SortKey = "name" | "uploaded" | "size" | "type";

type FilterKey =
  | "all"
  | "images"
  | "gifs"
  | "videos"
  | "lottie"
  | "documents"
  | "text"
  | "svg"
  | "audio"
  | "recent"
  | "favorites"
  | "unused"
  | "large";

type SmartKey =
  | "unused"
  | "recent_added"
  | "large"
  | "missing_alt"
  | "needs_compression"
  | "duplicates";

interface Props {
  projectId: string;
}

const TYPE_FILTERS: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: "images", label: "Images", icon: ImageIcon },
  { key: "gifs", label: "GIFs", icon: Play },
  { key: "videos", label: "Videos", icon: Film },
  { key: "lottie", label: "Lottie", icon: Sparkles },
  { key: "documents", label: "Documents", icon: FileText },
  { key: "text", label: "Text & Markdown", icon: FileIcon },
  { key: "svg", label: "SVG & icons", icon: Wand2 },
  { key: "audio", label: "Audio", icon: Music },
];

const STORAGE_TOTAL_GB = 100;

/* ───────────────────────────── Shell ───────────────────────────── */

export function MediaLibraryShell({ projectId }: Props) {
  const [assets, setAssets] = useState<MediaAsset[]>(() =>
    MEDIA.filter((m) => m.projectId === projectId),
  );
  const allFolders = useCMS((s) => s.mediaFolders);
  const folders = useMemo(
    () => allFolders.filter((f) => f.projectId === projectId),
    [allFolders, projectId],
  );

  const [filter, setFilter] = useState<FilterKey>("all");
  const [smart, setSmart] = useState<SmartKey | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  function createFolder(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const id = mediaFolderActions.add(projectId, trimmed);
    setFolderId(id);
    setFilter("all");
    setSmart(null);
    setNewFolderOpen(false);
    toast.success(`Folder “${trimmed}” created`);
  }
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("grid");
  const [sort, setSort] = useState<SortKey>("uploaded");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Soft delete: trashed items stay in `assets` (so storage still counts them,
  // like a real trash) but are hidden from every normal view and surfaced only
  // in Trash, where they can be restored or removed for good.
  const [trashed, setTrashed] = useState<Record<string, string>>({});
  const [viewTrash, setViewTrash] = useState(false);

  // Move-to-folder and format-conversion dialogs (single or bulk).
  const [moveIds, setMoveIds] = useState<string[] | null>(null);
  const [convertId, setConvertId] = useState<string | null>(null);

  function moveAssets(ids: string[], targetFolderId: string | null) {
    setAssets((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, folderId: targetFolderId ?? undefined } : a)));
    setMoveIds(null);
    const name = targetFolderId ? folders.find((f) => f.id === targetFolderId)?.name ?? "folder" : "the library root";
    toast.success(ids.length === 1 ? `Moved to ${name}` : `Moved ${ids.length} items to ${name}`);
  }

  const activeAssets = useMemo(() => assets.filter((a) => !trashed[a.id]), [assets, trashed]);
  const trashedAssets = useMemo(
    () => assets.filter((a) => trashed[a.id]).sort((a, b) => trashed[b.id].localeCompare(trashed[a.id])),
    [assets, trashed],
  );

  function softDelete(ids: string[]) {
    if (ids.length === 0) return;
    const now = new Date().toISOString();
    setTrashed((prev) => {
      const next = { ...prev };
      for (const id of ids) next[id] = now;
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.success(ids.length === 1 ? "Moved to Trash" : `Moved ${ids.length} items to Trash`, {
      action: {
        label: "Undo",
        onClick: () => restoreFromTrash(ids),
      },
    });
  }

  function restoreFromTrash(ids: string[]) {
    if (ids.length === 0) return;
    setTrashed((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    toast.success(ids.length === 1 ? "Restored" : `Restored ${ids.length} items`);
  }

  function permanentlyDelete(ids: string[]) {
    if (ids.length === 0) return;
    setAssets((prev) => prev.filter((a) => !ids.includes(a.id)));
    setTrashed((prev) => {
      const next = { ...prev };
      for (const id of ids) delete next[id];
      return next;
    });
    toast.success(ids.length === 1 ? "Deleted forever" : `Deleted ${ids.length} items forever`);
  }

  const dragCounter = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    let list = activeAssets;
    if (folderId) list = list.filter((m) => m.folderId === folderId);
    if (filter === "images") list = list.filter((m) => m.kind === "image" && m.mimeType !== "image/svg+xml" && m.mimeType !== "image/gif");
    if (filter === "gifs") list = list.filter((m) => m.mimeType === "image/gif");
    if (filter === "videos") list = list.filter((m) => m.kind === "video");
    if (filter === "lottie") list = list.filter((m) => m.mimeType === "application/lottie+json");
    if (filter === "documents") list = list.filter((m) => m.mimeType === "application/pdf" || m.mimeType === "application/zip");
    if (filter === "text") list = list.filter((m) => m.mimeType === "text/plain" || m.mimeType === "text/markdown");
    if (filter === "svg") list = list.filter((m) => m.mimeType === "image/svg+xml");
    if (filter === "audio") list = list.filter((m) => m.mimeType?.startsWith("audio"));
    if (filter === "favorites") list = list.filter((m) => m.favorite);
    if (smart === "unused") list = list.filter((m) => !m.referencedBy?.length);
    if (smart === "large") list = list.filter((m) => (m.sizeBytes ?? 0) > 1_000_000);
    if (smart === "missing_alt") list = list.filter((m) => m.kind === "image" && !m.altText);
    if (smart === "needs_compression") list = list.filter((m) => m.optimized === false);
    if (smart === "recent_added") list = [...list].sort((a, b) => (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "")).slice(0, 12);
    if (smart === "duplicates") list = [];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.altText?.toLowerCase().includes(q) ||
          m.tags?.some((t) => t.toLowerCase().includes(q)),
      );
    }
    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "size") return (b.sizeBytes ?? 0) - (a.sizeBytes ?? 0);
      if (sort === "type") return (a.mimeType ?? "").localeCompare(b.mimeType ?? "");
      return (b.uploadedAt ?? "").localeCompare(a.uploadedAt ?? "");
    });
  }, [activeAssets, folderId, filter, smart, search, sort]);

  const totals = useMemo(() => {
    const bytes = activeAssets.reduce((sum, m) => sum + (m.sizeBytes ?? 0), 0);
    return {
      bytes,
      gbUsed: bytes / 1_073_741_824,
      total: activeAssets.length,
    };
  }, [activeAssets]);

  const selectedAsset = selected.size === 1
    ? activeAssets.find((a) => selected.has(a.id)) ?? null
    : null;

  const handleSelect = useCallback(
    (id: string, mode: "replace" | "toggle" | "range") => {
      setSelected((prev) => {
        if (mode === "replace") return new Set([id]);
        if (mode === "toggle") {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        }
        // range
        if (!lastClickedId) return new Set([id]);
        const ids = visible.map((a) => a.id);
        const a = ids.indexOf(lastClickedId);
        const b = ids.indexOf(id);
        if (a < 0 || b < 0) return new Set([id]);
        const [lo, hi] = a < b ? [a, b] : [b, a];
        return new Set(ids.slice(lo, hi + 1));
      });
      setLastClickedId(id);
    },
    [lastClickedId, visible],
  );

  const clearSelection = useCallback(() => setSelected(new Set()), []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragOver(false);
    setUploadOpen(true);
  }, []);

  // global Esc + / shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selected.size) {
        clearSelection();
      }
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected.size, clearSelection]);

  const onSidebar = (cb: () => void) => {
    clearSelection();
    setViewTrash(false);
    cb();
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 overflow-hidden bg-background"
      onDragEnter={(e) => {
        e.preventDefault();
        dragCounter.current += 1;
        if (dragCounter.current === 1) setDragOver(true);
      }}
      onDragLeave={() => {
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setDragOver(false);
        }
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <MediaSidebar
        folders={folders}
        assets={activeAssets}
        filter={filter}
        smart={smart}
        folderId={folderId}
        storageUsedGb={totals.gbUsed}
        trashCount={trashedAssets.length}
        viewingTrash={viewTrash}
        onAll={() => onSidebar(() => { setFilter("all"); setSmart(null); setFolderId(null); })}
        onFavorites={() => onSidebar(() => { setFilter("favorites"); setSmart(null); setFolderId(null); })}
        onSmart={(k) => onSidebar(() => { setSmart(k); setFilter("all"); setFolderId(null); })}
        onFolder={(id) => onSidebar(() => { setFolderId(id); setFilter("all"); setSmart(null); })}
        onUpload={() => setUploadOpen(true)}
        onNewFolder={() => setNewFolderOpen(true)}
        onTrash={() => {
          clearSelection();
          setFolderId(null);
          setFilter("all");
          setSmart(null);
          setViewTrash(true);
        }}
      />

      {viewTrash ? (
        <TrashView
          assets={trashedAssets}
          trashedAt={trashed}
          onRestore={(id) => restoreFromTrash([id])}
          onRestoreAll={() => restoreFromTrash(trashedAssets.map((a) => a.id))}
          onDeleteForever={(id) => permanentlyDelete([id])}
          onEmptyTrash={() => permanentlyDelete(trashedAssets.map((a) => a.id))}
        />
      ) : (
        <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-background">
          <MediaToolbar
            searchRef={searchRef}
            search={search}
            onSearch={setSearch}
            view={view}
            onView={setView}
            sort={sort}
            onSort={setSort}
            filter={filter}
            smart={smart}
            onFilter={(k) => { setFilter(k); setSmart(null); }}
            onClearFilters={() => { setFilter("all"); setSmart(null); }}
            totalAssets={totals.total}
            visibleAssets={visible.length}
            onUpload={() => setUploadOpen(true)}
          />

          <div className="flex min-h-0 flex-1">
            <main className="relative min-w-0 min-h-0 flex-1 overflow-auto">
              {visible.length === 0 ? (
                <MediaEmptyState onUpload={() => setUploadOpen(true)} />
              ) : view === "grid" ? (
                <AssetGrid
                  assets={visible}
                  selected={selected}
                  onSelect={handleSelect}
                  onToggleBookmark={(id) =>
                    setAssets((prev) =>
                      prev.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)),
                    )
                  }
                  onDelete={(id) => softDelete([id])}
                  onMove={(id) => setMoveIds([id])}
                  onConvert={(id) => setConvertId(id)}
                />
              ) : (
                <AssetTable
                  assets={visible}
                  folders={folders}
                  selected={selected}
                  onSelect={handleSelect}
                  sort={sort}
                  onSort={setSort}
                />
              )}

              {selected.size > 1 && (
                <BulkActionBar
                  count={selected.size}
                  onClear={clearSelection}
                  onDelete={() => softDelete(Array.from(selected))}
                  onMove={() => setMoveIds(Array.from(selected))}
                />
              )}
            </main>

            {selectedAsset && (
              <AssetInspector
                asset={selectedAsset}
                folders={folders}
                onClose={clearSelection}
                onUpdate={(patch) =>
                  setAssets((prev) =>
                    prev.map((a) => (a.id === selectedAsset.id ? { ...a, ...patch } : a)),
                  )
                }
                onToggleBookmark={() =>
                  setAssets((prev) =>
                    prev.map((a) =>
                      a.id === selectedAsset.id ? { ...a, favorite: !a.favorite } : a,
                    ),
                  )
                }
                onDelete={() => softDelete([selectedAsset.id])}
                onMove={() => setMoveIds([selectedAsset.id])}
                onConvert={() => setConvertId(selectedAsset.id)}
              />
            )}
          </div>
        </div>
      )}

      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-background/70 backdrop-blur-sm">
          <div className="rounded-2xl border-2 border-dashed border-primary/60 bg-card px-12 py-10 text-center shadow-[var(--shadow-elevated,0_12px_40px_rgba(0,0,0,0.18))]">
            <Upload className="mx-auto h-8 w-8 text-primary" strokeWidth={1.75} />
            <div className="mt-3 text-[14px] font-semibold">Drop to upload</div>
            <div className="mt-1 text-[12.5px] text-muted-foreground">Files are added to the current folder.</div>
          </div>
        </div>
      )}

      <UploadSheet open={uploadOpen} onOpenChange={setUploadOpen} />
      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} onCreate={createFolder} />
      <MoveFolderDialog
        open={moveIds != null}
        onOpenChange={(o) => !o && setMoveIds(null)}
        count={moveIds?.length ?? 0}
        folders={folders}
        currentId={moveIds?.length === 1 ? assets.find((a) => a.id === moveIds[0])?.folderId ?? null : null}
        onMove={(folderId) => moveIds && moveAssets(moveIds, folderId)}
      />
      <ConvertDialog
        asset={convertId ? assets.find((a) => a.id === convertId) ?? null : null}
        onOpenChange={(o) => !o && setConvertId(null)}
      />
    </div>
  );
}

function NewFolderDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setName("");
      }}
    >
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>New folder</DialogTitle>
          <DialogDescription>Organize your assets. You can move files into it after.</DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onCreate(name);
            setName("");
          }}
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="new-folder-name" className="text-[12.5px]">
              Folder name
            </Label>
            <Input
              id="new-folder-name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Campaign assets"
              maxLength={48}
              className="h-9 text-[13px]"
            />
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Create folder
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Move + Convert + Tags ───────────────────────── */

function MoveFolderDialog({
  open,
  onOpenChange,
  count,
  folders,
  currentId,
  onMove,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  count: number;
  folders: MediaFolder[];
  currentId: string | null;
  onMove: (folderId: string | null) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Move {count === 1 ? "to folder" : `${count} items to folder`}</DialogTitle>
          <DialogDescription>Pick a destination. Files keep their URLs.</DialogDescription>
        </DialogHeader>
        <div className="max-h-[300px] space-y-0.5 overflow-y-auto">
          <button
            onClick={() => onMove(null)}
            className="flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] text-muted-foreground transition-colors duration-120 hover:bg-muted/50 hover:text-foreground"
          >
            <Shapes className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            Library root
          </button>
          {folders.map((f) => {
            const isCurrent = f.id === currentId;
            const depth = f.parentId ? 1 : 0;
            return (
              <button
                key={f.id}
                onClick={() => !isCurrent && onMove(f.id)}
                disabled={isCurrent}
                className={`flex h-9 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition-colors duration-120 ${
                  isCurrent
                    ? "cursor-default bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
                style={{ paddingLeft: 12 + depth * 16 }}
              >
                <Folder className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                <span className="flex-1 truncate">{f.name}</span>
                {isCurrent && <span className="text-[10.5px] text-muted-foreground">Current</span>}
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Convert an image to a modern or compatible format, with honest size estimates. */
function ConvertDialog({ asset, onOpenChange }: { asset: MediaAsset | null; onOpenChange: (o: boolean) => void }) {
  const [picked, setPicked] = useState<"webp" | "avif" | "png">("webp");
  const base = asset?.sizeBytes ?? 0;
  const options = [
    { id: "webp" as const, label: "WebP", blurb: "Best default for the web. Wide support, small files.", factor: 0.55 },
    { id: "avif" as const, label: "AVIF", blurb: "Smallest files. Great for photos, modern browsers.", factor: 0.4 },
    { id: "png" as const, label: "Compressed PNG", blurb: "Lossless and safe everywhere. Pick this for OG images.", factor: 0.82 },
  ];
  return (
    <Dialog open={asset != null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        {asset && (
          <>
            <DialogHeader>
              <DialogTitle>Convert {asset.name}</DialogTitle>
              <DialogDescription>
                A converted copy is added next to the original. Nothing is overwritten.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {options.map((o) => {
                const active = picked === o.id;
                const est = base ? formatBytes(Math.round(base * o.factor)) : "—";
                return (
                  <button
                    key={o.id}
                    onClick={() => setPicked(o.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-colors duration-120 ${
                      active ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border hover:bg-muted/40"
                    }`}
                  >
                    <span
                      className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${
                        active ? "border-primary" : "border-border"
                      }`}
                    >
                      {active && <span className="h-2 w-2 rounded-full bg-primary" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-foreground">{o.label}</span>
                      <span className="block text-[11.5px] leading-relaxed text-muted-foreground">{o.blurb}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-mono text-[12px] tabular-nums text-foreground">{est}</span>
                      <span className="block text-[10.5px] text-muted-foreground">from {asset.size ?? "—"}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const ext = picked === "png" ? "png" : picked;
                  const newName = asset.name.replace(/\.[a-z0-9]+$/i, `.${ext}`);
                  toast.success(`Converted copy saved as ${newName} (demo)`);
                  onOpenChange(false);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
              >
                Convert
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function AddTagButton({ onAdd }: { onAdd: (tag: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="inline-flex h-6 items-center gap-1 rounded-full border border-dashed border-border bg-transparent px-2 text-[11px] text-muted-foreground transition-colors duration-120 hover:border-foreground/40 hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add tag
      </button>
    );
  }
  return (
    <input
      autoFocus
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value.trim()) onAdd(value.trim().toLowerCase());
        setValue("");
        setEditing(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" && value.trim()) {
          onAdd(value.trim().toLowerCase());
          setValue("");
          setEditing(false);
        }
        if (e.key === "Escape") {
          setValue("");
          setEditing(false);
        }
      }}
      placeholder="tag name"
      className="h-6 w-24 rounded-full border border-border bg-transparent px-2 text-[11px] text-foreground outline-none focus:border-primary"
    />
  );
}

/* ───────────────────────── Trash ───────────────────────── */

function TrashView({
  assets,
  trashedAt,
  onRestore,
  onRestoreAll,
  onDeleteForever,
  onEmptyTrash,
}: {
  assets: MediaAsset[];
  trashedAt: Record<string, string>;
  onRestore: (id: string) => void;
  onRestoreAll: () => void;
  onDeleteForever: (id: string) => void;
  onEmptyTrash: () => void;
}) {
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const confirmAsset = confirmId ? assets.find((a) => a.id === confirmId) : null;

  return (
    <div className="flex min-w-0 min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
        <div>
          <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
            <Trash2 className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            Trash
          </div>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            Deleted items stay here so you can undo a mistake. Restore them or delete them forever.
          </p>
        </div>
        {assets.length > 0 && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRestoreAll}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[12.5px] font-medium text-foreground transition-colors duration-120 hover:bg-muted/50"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
              Restore all
            </button>
            <button
              onClick={() => setConfirmAll(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-3 text-[12.5px] font-medium text-destructive transition-colors duration-120 hover:bg-destructive/10"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
              Empty trash
            </button>
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {assets.length === 0 ? (
          <div className="grid h-full place-items-center px-6 py-16 text-center">
            <div>
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-muted/50">
                <Trash2 className="h-5 w-5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <div className="mt-3 text-[14px] font-semibold text-foreground">Trash is empty</div>
              <div className="mt-1 text-[12.5px] text-muted-foreground">Deleted assets show up here first.</div>
            </div>
          </div>
        ) : (
          <div className="px-6 py-4">
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              {assets.map((a, i) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted/40 opacity-70">
                    <AssetPreview asset={a} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-medium text-foreground" title={a.name}>
                      {a.name}
                    </div>
                    <div className="text-[11.5px] text-muted-foreground">
                      Deleted {formatDate(trashedAt[a.id])} · {a.size ?? "—"}
                    </div>
                  </div>
                  <button
                    onClick={() => onRestore(a.id)}
                    className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-foreground transition-colors duration-120 hover:bg-muted/60"
                  >
                    <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Restore
                  </button>
                  <button
                    onClick={() => setConfirmId(a.id)}
                    aria-label="Delete forever"
                    title="Delete forever"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors duration-120 hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <ConfirmDangerDialog
        open={confirmId != null}
        onOpenChange={(o) => !o && setConfirmId(null)}
        title="Delete forever?"
        description={
          confirmAsset
            ? `“${confirmAsset.name}” will be permanently deleted. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete forever"
        onConfirm={() => {
          if (confirmId) onDeleteForever(confirmId);
          setConfirmId(null);
        }}
      />

      <ConfirmDangerDialog
        open={confirmAll}
        onOpenChange={setConfirmAll}
        title="Empty trash?"
        description={`${assets.length} item${assets.length === 1 ? "" : "s"} will be permanently deleted. This cannot be undone.`}
        confirmLabel="Empty trash"
        onConfirm={() => {
          onEmptyTrash();
          setConfirmAll(false);
        }}
      />
    </div>
  );
}

function ConfirmDangerDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <div className="mb-1 flex items-center gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-4 w-4 text-destructive" strokeWidth={1.75} />
            </div>
            <DialogTitle>{title}</DialogTitle>
          </div>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-destructive px-4 text-[13px] font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90"
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───────────────────────── Sidebar ───────────────────────── */

function MediaSidebar({
  folders,
  assets,
  filter,
  smart,
  folderId,
  storageUsedGb,
  trashCount,
  viewingTrash,
  onAll,
  onFavorites,
  onSmart,
  onFolder,
  onUpload,
  onNewFolder,
  onTrash,
}: {
  folders: MediaFolder[];
  assets: MediaAsset[];
  filter: FilterKey;
  smart: SmartKey | null;
  folderId: string | null;
  storageUsedGb: number;
  trashCount: number;
  viewingTrash: boolean;
  onAll: () => void;
  onFavorites: () => void;
  onSmart: (k: SmartKey) => void;
  onFolder: (id: string | null) => void;
  onUpload: () => void;
  onNewFolder: () => void;
  onTrash: () => void;
}) {
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) {
      if (!a.folderId) continue;
      m.set(a.folderId, (m.get(a.folderId) ?? 0) + 1);
      const parent = folders.find((f) => f.id === a.folderId)?.parentId;
      if (parent) m.set(parent, (m.get(parent) ?? 0) + 1);
    }
    return m;
  }, [assets, folders]);

  const roots = folders.filter((f) => !f.parentId);
  const pct = Math.min(100, (storageUsedGb / STORAGE_TOTAL_GB) * 100);

  return (
    <aside className="hidden w-[240px] shrink-0 flex-col border-r border-border bg-background md:flex">
      {/* brand-light header */}
      <div className="flex items-center px-5 pb-3 pt-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          Media Library
        </div>
      </div>

      <div className="flex-1 overflow-auto px-3 pb-3">
        <SidebarGroup label="Collections">
          <SidebarItem
            icon={Shapes}
            label="All assets"
            count={assets.length}
            active={!viewingTrash && !folderId && !smart && filter === "all"}
            onClick={onAll}
          />
          <SidebarItem
            icon={Bookmark}
            label="Bookmarked"
            count={assets.filter((a) => a.favorite).length}
            active={!viewingTrash && !folderId && !smart && filter === "favorites"}
            onClick={onFavorites}
          />
          <SidebarItem
            icon={Trash2}
            label="Trash"
            count={trashCount}
            active={viewingTrash}
            onClick={onTrash}
          />
        </SidebarGroup>

        <SidebarGroup
          label="Folders"
          collapsible
          action={
            <button
              onClick={onNewFolder}
              aria-label="New folder"
              title="New folder"
              className="grid h-5 w-5 place-items-center rounded text-muted-foreground/70 transition-colors duration-120 hover:bg-muted/50 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
            </button>
          }
        >
          {roots.length === 0 ? (
            <button
              onClick={onNewFolder}
              className="flex h-8 w-full items-center gap-2 rounded-md px-3 text-[12px] text-muted-foreground/70 transition-colors duration-120 hover:bg-muted/40 hover:text-foreground"
            >
              <Plus className="h-3 w-3" />
              New folder
            </button>
          ) : (
            roots.map((r) => (
              <FolderNode
                key={r.id}
                folder={r}
                allFolders={folders}
                activeId={folderId}
                onSelect={onFolder}
                counts={counts}
              />
            ))
          )}
        </SidebarGroup>
      </div>

      {/* Storage footer */}
      <div className="border-t border-border/60 px-5 py-4">
        <button
          onClick={onUpload}
          className="group block w-full text-left transition-opacity duration-120 hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-md"
        >
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <HardDrive className="h-3 w-3" strokeWidth={1.75} />
              Storage
            </span>
            <span className="font-mono tabular-nums">
              <span className="font-semibold text-foreground">{storageUsedGb.toFixed(1)}</span>
              <span className="text-muted-foreground/70"> / {STORAGE_TOTAL_GB} GB</span>
            </span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </button>
      </div>
    </aside>
  );
}

function SidebarGroup({
  label,
  children,
  collapsible,
  action,
}: {
  label: string;
  children: React.ReactNode;
  /** Collapses long groups (folders) behind a chevron on the group header. */
  collapsible?: boolean;
  /** Small trailing control on the header, e.g. new-folder plus. */
  action?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="mb-5">
      <div className="group/hdr flex items-center justify-between pb-1.5 pl-3 pr-1">
        {collapsible ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60 transition-colors duration-120 hover:text-foreground"
            aria-expanded={open}
          >
            {label}
            <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/60">{label}</div>
        )}
        {action}
      </div>
      {(!collapsible || open) && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function SidebarItem({
  icon: Icon,
  label,
  active,
  count,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex h-8 w-full items-center gap-2.5 rounded-md px-3 text-left text-[13px] transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
        active
          ? "bg-muted text-foreground"
          : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
      }`}
    >
      {active && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />}
      <Icon className="h-[14px] w-[14px] shrink-0" strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && count > 0 && (
        <span className="font-mono tabular-nums text-[10.5px] text-muted-foreground/70">
          {count}
        </span>
      )}
    </button>
  );
}

function FolderNode({
  folder,
  allFolders,
  activeId,
  onSelect,
  counts,
  depth = 0,
}: {
  folder: MediaFolder;
  allFolders: MediaFolder[];
  activeId: string | null;
  onSelect: (id: string) => void;
  counts: Map<string, number>;
  depth?: number;
}) {
  const children = allFolders.filter((f) => f.parentId === folder.id);
  const [open, setOpen] = useState(true);
  const active = activeId === folder.id;
  const count = counts.get(folder.id) ?? 0;

  return (
    <div>
      <div className="group relative flex items-center" style={{ paddingLeft: depth * 12 }}>
        {children.length > 0 ? (
          <button
            onClick={() => setOpen((v) => !v)}
            className="grid h-6 w-5 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
            aria-label={open ? "Collapse" : "Expand"}
          >
            <ChevronRight className={`h-3 w-3 transition-transform duration-150 ${open ? "rotate-90" : ""}`} />
          </button>
        ) : (
          <span className="h-6 w-5 shrink-0" />
        )}
        <button
          onClick={() => onSelect(folder.id)}
          className={`relative flex h-8 flex-1 items-center gap-2 rounded-md pl-1 pr-2 text-left text-[13px] transition-colors duration-120 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background ${
            active
              ? "bg-muted text-foreground"
              : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
          }`}
        >
          {active && <span className="absolute inset-y-1.5 -left-0.5 w-[2px] rounded-full bg-primary" />}
          <Folder className="h-[14px] w-[14px] shrink-0" strokeWidth={1.75} />
          <span className="flex-1 truncate">{folder.name}</span>
          {count > 0 && (
            <span className="font-mono tabular-nums text-[10.5px] text-muted-foreground/60 group-hover:hidden">
              {count}
            </span>
          )}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="absolute right-1 grid h-6 w-6 place-items-center rounded text-muted-foreground opacity-0 transition-opacity duration-120 hover:bg-muted/60 hover:text-foreground group-hover:opacity-100"
              aria-label="Folder actions"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onSelect={() => toast("Rename — coming soon")}>Rename</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast("Move — coming soon")}>Move…</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => toast.success("Added to favorites")}>Bookmark</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && children.map((c) => (
        <FolderNode
          key={c.id}
          folder={c}
          allFolders={allFolders}
          activeId={activeId}
          onSelect={onSelect}
          counts={counts}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

/* ───────────────────────── Toolbar ───────────────────────── */

function MediaToolbar({
  searchRef,
  search,
  onSearch,
  view,
  onView,
  sort,
  onSort,
  filter,
  smart,
  onFilter,
  onClearFilters,
  totalAssets,
  visibleAssets,
  onUpload,
}: {
  searchRef: React.RefObject<HTMLInputElement | null>;
  search: string;
  onSearch: (v: string) => void;
  view: ViewMode;
  onView: (v: ViewMode) => void;
  sort: SortKey;
  onSort: (v: SortKey) => void;
  filter: FilterKey;
  smart: SmartKey | null;
  onFilter: (k: FilterKey) => void;
  onClearFilters: () => void;
  totalAssets: number;
  visibleAssets: number;
  onUpload: () => void;
}) {
  const sortLabel: Record<SortKey, string> = {
    name: "Name",
    uploaded: "Date added",
    size: "Size",
    type: "Type",
  };
  const activeFilter =
    filter !== "all"
      ? TYPE_FILTERS.find((t) => t.key === filter)?.label ?? null
      : null;
  const [focused, setFocused] = useState(false);

  return (
    <div className="sticky top-0 z-20 border-b border-[color:var(--border-hairline)] bg-background">
      <div className="flex h-14 items-center gap-2 px-6">
        {/* Search — flex-1, transparent → fills on focus, pink ring */}
        <div className="relative min-w-0 flex-1">
          <Search
            className={`pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 transition-colors duration-120 ${
              focused ? "text-foreground" : "text-muted-foreground"
            }`}
          />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search assets, tags, alt text…   /"
            aria-label="Search media library"
            className="h-10 w-full rounded-[10px] border border-border bg-transparent pl-9 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground/70 transition-all duration-120 hover:border-foreground/30 focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:shadow-[0_0_24px_-6px_color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />
          {search && (
            <button
              onClick={() => onSearch("")}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded text-muted-foreground transition-colors duration-120 hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 px-3 text-[13px] font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <FilterIcon className="h-3.5 w-3.5" strokeWidth={1.75} />
              Filter
              {activeFilter && (
                <Badge className="ml-1 h-5 rounded-md border-0 bg-primary/15 px-1.5 font-medium text-primary hover:bg-primary/20">
                  {activeFilter}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 pt-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">By type</div>
            {TYPE_FILTERS.map((t) => (
              <DropdownMenuItem key={t.key} onSelect={() => onFilter(t.key)}>
                <t.icon className="mr-2 h-3.5 w-3.5" strokeWidth={1.75} /> {t.label}
              </DropdownMenuItem>
            ))}
            {(activeFilter || smart) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={onClearFilters}>
                  <X className="mr-2 h-3.5 w-3.5" /> Clear filter
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 gap-1.5 px-3 text-[13px] font-normal text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <ArrowUpDown className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span className="text-foreground">{sortLabel[sort]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(sortLabel) as SortKey[]).map((k) => (
              <DropdownMenuItem key={k} onSelect={() => onSort(k)}>
                {sortLabel[k]}
                {sort === k && <span className="ml-auto text-primary">●</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* View toggle (icon only) */}
        <div className="inline-flex h-10 items-center rounded-[10px] border border-border bg-transparent p-0.5">
          <button
            onClick={() => onView("grid")}
            aria-label="Grid view"
            aria-pressed={view === "grid"}
            className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-120 ${
              view === "grid"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Grid3x3 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
          <button
            onClick={() => onView("list")}
            aria-label="List view"
            aria-pressed={view === "list"}
            className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-120 ${
              view === "list"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutList className="h-3.5 w-3.5" strokeWidth={1.75} />
          </button>
        </div>

        {/* Upload — primary CTA */}
        <Button
          size="sm"
          className="h-10 rounded-[10px] px-4 text-[13px] font-medium shadow-sm"
          onClick={onUpload}
        >
          <Upload className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} /> Upload
        </Button>
      </div>

      {/* asset count strip — quiet, single line */}
      <div className="flex h-7 items-center justify-between px-6 text-[11px] text-muted-foreground/70">
        <span>
          <span className="font-semibold tabular-nums text-foreground/80">{visibleAssets}</span>
          {visibleAssets !== totalAssets && (
            <span> of <span className="tabular-nums">{totalAssets}</span></span>
          )}
          {" "}assets
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── Asset Grid ───────────────────────── */

function AssetGrid({
  assets,
  selected,
  onSelect,
  onToggleBookmark,
  onDelete,
  onMove,
  onConvert,
}: {
  assets: MediaAsset[];
  selected: Set<string>;
  onSelect: (id: string, mode: "replace" | "toggle" | "range") => void;
  onToggleBookmark: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string) => void;
  onConvert: (id: string) => void;
}) {
  const anySelected = selected.size > 0;
  return (
    <div
      role="grid"
      className="grid grid-cols-2 gap-4 px-6 py-6 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5"
    >
      {assets.map((a) => (
        <AssetCard
          key={a.id}
          asset={a}
          selected={selected.has(a.id)}
          selectionMode={anySelected}
          onCardClick={(e) => {
            if (e.shiftKey) onSelect(a.id, "range");
            else if (e.metaKey || e.ctrlKey) onSelect(a.id, "toggle");
            else onSelect(a.id, "replace");
          }}
          onCheckboxChange={() => onSelect(a.id, "toggle")}
          onBookmark={() => onToggleBookmark(a.id)}
          onDelete={() => onDelete(a.id)}
          onMove={() => onMove(a.id)}
          onConvert={() => onConvert(a.id)}
        />
      ))}
    </div>
  );
}

function AssetCard({
  asset,
  selected,
  selectionMode,
  onCardClick,
  onCheckboxChange,
  onBookmark,
  onDelete,
  onMove,
  onConvert,
}: {
  asset: MediaAsset;
  selected: boolean;
  selectionMode: boolean;
  onCardClick: (e: React.MouseEvent) => void;
  onCheckboxChange: () => void;
  onBookmark: () => void;
  onDelete: () => void;
  onMove: () => void;
  onConvert: () => void;
}) {
  const ref = referenceCount(asset);

  return (
    <article
      role="gridcell"
      onClick={onCardClick}
      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-xl border bg-card transition-all duration-120 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elevated)] focus-visible:outline-none ${
        selected
          ? "border-primary shadow-[0_0_0_2px_var(--primary),0_8px_24px_-12px_color-mix(in_oklab,var(--primary)_60%,transparent)]"
          : "border-border/70 hover:border-border"
      }`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-muted/40">
        <div className="absolute inset-0 transition-transform duration-150 group-hover:scale-[1.02]">
          <AssetPreview asset={asset} />
        </div>

        {/* hover quick actions, bottom edge */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-gradient-to-t from-black/65 via-black/25 to-transparent px-2 pb-2 pt-7 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          {asset.mimeType === "application/pdf" && asset.url ? (
            <CardIconBtn icon={ExternalLink} label="Open in new tab" onClick={() => window.open(asset.url, "_blank", "noopener")} />
          ) : (
            <CardIconBtn icon={Search} label="Preview" onClick={() => toast("Preview — coming soon")} />
          )}
          <CardIconBtn
            icon={Copy}
            label="Copy URL"
            onClick={() => {
              navigator.clipboard?.writeText(asset.url || asset.thumbUrl || "");
              toast.success("URL copied");
            }}
          />
          <CardIconBtn icon={ArrowLeftRight} label="Replace" onClick={() => toast("Replace — coming soon")} />
          <CardIconBtn icon={Download} label="Download" onClick={() => toast("Download starting")} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                onClick={(e) => e.stopPropagation()}
                aria-label="More actions"
                className="pointer-events-auto grid h-7 w-7 place-items-center rounded-md bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors duration-120 hover:bg-background"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onSelect={() => toast("Rename — coming soon")}>Rename</DropdownMenuItem>
              <DropdownMenuItem onSelect={onMove}>Move to folder…</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => toast("Duplicate — coming soon")}>Duplicate</DropdownMenuItem>
              {asset.kind === "image" && asset.mimeType !== "image/svg+xml" && (
                <DropdownMenuItem onSelect={onConvert}>Convert format…</DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onSelect={onDelete}>
                Move to Trash
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Checkbox top-left */}
        <label
          onClick={(e) => e.stopPropagation()}
          className={`absolute left-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-md border border-border/80 bg-background/90 backdrop-blur transition-opacity duration-120 ${
            selected || selectionMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
        >
          <Checkbox checked={selected} onCheckedChange={onCheckboxChange} className="h-3 w-3" />
        </label>

        {/* Bookmark top-right */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onBookmark();
          }}
          aria-label={asset.favorite ? "Remove bookmark" : "Add bookmark"}
          className={`absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-md bg-background/85 backdrop-blur transition-all duration-120 ${
            asset.favorite
              ? "text-primary opacity-100"
              : "text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100"
          }`}
        >
          <Bookmark
            className={`h-3.5 w-3.5 ${asset.favorite ? "fill-current" : ""}`}
            strokeWidth={1.75}
          />
        </button>
      </div>

      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-foreground" title={asset.name}>
            {asset.name}
          </span>
          {ref > 0 && (
            <span className="inline-flex shrink-0 items-center gap-0.5 text-[10px] text-muted-foreground" title={`Used in ${ref} places`}>
              <Link2 className="h-2.5 w-2.5" /> {ref}
            </span>
          )}
        </div>
        <div className="mt-0.5 overflow-hidden whitespace-nowrap text-[11px] leading-4 text-muted-foreground">
          {formatTag(asset)}
          <span className="mx-1 text-muted-foreground/40">·</span>
          <span className="tabular-nums">{asset.size ?? "—"}</span>
          {asset.width && asset.height ? (
            <>
              <span className="mx-1 text-muted-foreground/40">·</span>
              <span className="tabular-nums">{asset.width}×{asset.height}</span>
            </>
          ) : asset.durationSec != null ? (
            <>
              <span className="mx-1 text-muted-foreground/40">·</span>
              <span className="tabular-nums">{formatDuration(asset.durationSec)}</span>
            </>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function CardIconBtn({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={label}
      aria-label={label}
      className="pointer-events-auto grid h-7 w-7 place-items-center rounded-md bg-background/85 text-foreground shadow-sm backdrop-blur transition-colors duration-120 hover:bg-background"
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
    </button>
  );
}

function AssetPreview({ asset }: { asset: MediaAsset }) {
  const [errored, setErrored] = useState(false);
  if (asset.kind === "image" && asset.thumbUrl && !errored) {
    return (
      <img
        src={asset.thumbUrl}
        alt={asset.altText ?? asset.name}
        loading="lazy"
        onError={() => setErrored(true)}
        className="h-full w-full object-cover"
      />
    );
  }
  if (asset.kind === "video") {
    return (
      <>
        {asset.thumbUrl && !errored && (
          <img
            src={asset.thumbUrl}
            alt=""
            onError={() => setErrored(true)}
            className="h-full w-full object-cover opacity-90"
            loading="lazy"
          />
        )}
        <div className="absolute inset-0 grid place-items-center">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-black/55 text-white backdrop-blur">
            <Play className="ml-0.5 h-4 w-4 fill-current" />
          </div>
        </div>
        {asset.durationSec != null && (
          <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10.5px] text-white">
            {formatDuration(asset.durationSec)}
          </span>
        )}
      </>
    );
  }
  // Documents, text, Lottie, audio: a clean labeled tile instead of a bare icon.
  const meta = fileTileMeta(asset);
  const TileIcon = meta.icon;
  return (
    <div className={`grid h-full w-full place-items-center ${meta.tile}`}>
      <div className="flex flex-col items-center gap-1.5">
        <TileIcon className={`h-8 w-8 ${meta.text}`} strokeWidth={1.25} />
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wider ${meta.text}`}>{meta.label}</span>
      </div>
    </div>
  );
}

/* ───────────────────────── Asset Table ───────────────────────── */

function AssetTable({
  assets,
  folders,
  selected,
  onSelect,
  sort,
  onSort,
}: {
  assets: MediaAsset[];
  folders: MediaFolder[];
  selected: Set<string>;
  onSelect: (id: string, mode: "replace" | "toggle" | "range") => void;
  sort: SortKey;
  onSort: (s: SortKey) => void;
}) {
  const folderName = (id?: string) => folders.find((f) => f.id === id)?.name ?? "—";

  const cols = "grid-cols-[28px_52px_minmax(260px,2fr)_minmax(120px,1fr)_110px_80px_80px_70px_110px]";

  return (
    <div className="px-6 py-6">
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <div style={{ minWidth: 980 }}>
        <div className={`grid ${cols} items-center gap-3 border-b border-border px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70`}>


          <div />
          <div />
          <SortHeader label="Filename" k="name" sort={sort} onSort={onSort} />
          <div>Folder</div>
          <div>Dimensions</div>
          <div>Type</div>
          <SortHeader label="Size" k="size" sort={sort} onSort={onSort} className="text-left" />
          <div>Usage</div>
          <SortHeader label="Modified" k="uploaded" sort={sort} onSort={onSort} />
        </div>
        {assets.map((a) => {
          const isSel = selected.has(a.id);
          const ref = referenceCount(a);
          return (
            <div
              key={a.id}
              onClick={(e) => {
                if (e.shiftKey) onSelect(a.id, "range");
                else if (e.metaKey || e.ctrlKey) onSelect(a.id, "toggle");
                else onSelect(a.id, "replace");
              }}
              className={`relative grid ${cols} cursor-pointer items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5 text-[12.5px] transition-colors duration-120 last:border-b-0 hover:bg-[color:var(--row-hover)] ${
                isSel ? "bg-[color:var(--row-selected)]" : ""
              }`}
            >
              {isSel && <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />}
              <div onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={isSel} onCheckedChange={() => onSelect(a.id, "toggle")} />
              </div>
              <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md bg-muted/40">
                <AssetPreview asset={a} />
              </div>
              <div className="min-w-0">
                <div className="truncate font-medium text-foreground" title={a.name}>{a.name}</div>
              </div>
              <div className="truncate text-muted-foreground">{folderName(a.folderId)}</div>
              <div className="tabular-nums text-muted-foreground">
                {a.width && a.height ? `${a.width}×${a.height}` : "—"}
              </div>
              <div className="text-muted-foreground">{formatTag(a)}</div>
              <div className="tabular-nums text-muted-foreground">{a.size ?? "—"}</div>
              <div className="text-muted-foreground">
                {ref > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Link2 className="h-3 w-3" /> {ref}
                  </span>
                ) : (
                  <span className="text-muted-foreground/50">—</span>
                )}
              </div>
              <div className="text-muted-foreground">{formatDate(a.uploadedAt)}</div>
            </div>
          );
        })}
        </div>
      </div>
    </div>
  );
}


function SortHeader({
  label,
  k,
  sort,
  onSort,
  className = "",
}: {
  label: string;
  k: SortKey;
  sort: SortKey;
  onSort: (s: SortKey) => void;
  className?: string;
}) {
  const active = sort === k;
  return (
    <button
      onClick={() => onSort(k)}
      className={`inline-flex items-center gap-1 text-left transition-colors duration-120 hover:text-foreground ${
        active ? "text-foreground" : ""
      } ${className}`}
    >
      {label}
      {active && <ArrowDownAZ className="h-3 w-3 text-primary" strokeWidth={1.75} />}
    </button>
  );
}

/* ───────────────────────── Inspector ───────────────────────── */

function AssetInspector({
  asset,
  folders,
  onClose,
  onUpdate,
  onToggleBookmark,
  onDelete,
  onMove,
  onConvert,
}: {
  asset: MediaAsset;
  folders: MediaFolder[];
  onClose: () => void;
  onUpdate: (patch: Partial<MediaAsset>) => void;
  onToggleBookmark: () => void;
  onDelete: () => void;
  onMove: () => void;
  onConvert: () => void;
}) {
  const folderName = folders.find((f) => f.id === asset.folderId)?.name ?? "—";
  const ref = referenceCount(asset);

  return (
    <aside
      key={asset.id}
      className="hidden w-[380px] min-h-0 shrink-0 flex-col border-l border-border bg-background animate-in slide-in-from-right-2 duration-180 ease-out md:flex"
      aria-live="polite"
    >
      <header className="flex h-14 items-center justify-between border-b border-border px-5">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
          Inspector
        </div>
        <div className="flex items-center gap-0.5">
          <button
            onClick={onToggleBookmark}
            aria-label={asset.favorite ? "Remove bookmark" : "Add bookmark"}
            className={`grid h-8 w-8 place-items-center rounded-md transition-colors duration-120 hover:bg-muted/60 ${
              asset.favorite ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Bookmark className={`h-4 w-4 ${asset.favorite ? "fill-current" : ""}`} strokeWidth={1.75} />
          </button>
          <button
            onClick={onClose}
            aria-label="Close inspector"
            className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors duration-120 hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-auto">
        {/* Large preview */}
        <div
          className="grid aspect-[16/10] w-full place-items-center overflow-hidden border-b border-border"
          style={{
            backgroundImage:
              "linear-gradient(45deg, color-mix(in oklab, var(--muted) 60%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in oklab, var(--muted) 60%, transparent) 75%), linear-gradient(45deg, color-mix(in oklab, var(--muted) 60%, transparent) 25%, transparent 25%, transparent 75%, color-mix(in oklab, var(--muted) 60%, transparent) 75%)",
            backgroundSize: "16px 16px",
            backgroundPosition: "0 0, 8px 8px",
            backgroundColor: "var(--background)",
          }}
        >
          <div className="relative h-full w-full">
            {asset.kind === "video" && asset.url ? (
              <video src={asset.url} poster={asset.thumbUrl} controls preload="metadata" className="h-full w-full bg-black object-contain" />
            ) : (
              <>
                <AssetPreview asset={asset} />
                {asset.mimeType === "application/pdf" && asset.url && (
                  <button
                    onClick={() => window.open(asset.url, "_blank", "noopener")}
                    className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-md bg-background/90 text-muted-foreground shadow-sm backdrop-blur transition-colors duration-120 hover:text-foreground"
                    aria-label="Open PDF in a new tab"
                    title="Open PDF in a new tab"
                  >
                    <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Filename + meta */}
        <div className="px-5 pb-3 pt-4">
          <div className="text-[14px] font-semibold tracking-tight text-foreground" title={asset.name}>
            <span className="block truncate">{asset.name}</span>
          </div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            {formatTag(asset)} · {asset.size ?? "—"}
            {asset.width && asset.height ? ` · ${asset.width}×${asset.height}` : ""}
            {!asset.width && asset.durationSec != null ? ` · ${formatDuration(asset.durationSec)}` : ""}
          </div>
        </div>

        {/* CDN URL, upfront: the most-copied thing in the library */}
        {asset.url && (
          <div className="px-5 pb-4">
            <MonoCopyRow label="CDN URL" value={asset.url} />
          </div>
        )}

        {/* Ghost quick actions */}
        <div className="grid grid-cols-5 gap-1 border-b border-border px-3 pb-4">
          <QuickAction
            icon={Copy}
            label="Copy"
            onClick={() => {
              navigator.clipboard?.writeText(asset.url || asset.thumbUrl || "");
              toast.success("URL copied");
            }}
          />
          <QuickAction icon={ArrowLeftRight} label="Replace" onClick={() => toast("Replace — coming soon")} />
          <QuickAction icon={Download} label="Download" onClick={() => toast("Download starting")} />
          {asset.kind === "image" && asset.mimeType !== "image/svg+xml" ? (
            <QuickAction icon={Zap} label="Convert" onClick={onConvert} />
          ) : asset.url ? (
            <QuickAction icon={ExternalLink} label="Open" onClick={() => window.open(asset.url, "_blank", "noopener")} />
          ) : (
            <QuickAction icon={Zap} label="Convert" onClick={onConvert} />
          )}
          <QuickAction icon={Trash2} label="Delete" onClick={onDelete} danger />
        </div>

        <Tabs defaultValue="details" className="px-0">
          <TabsList className="relative h-10 w-full justify-start gap-0 rounded-none border-b border-border bg-transparent p-0">
            {(["details", "variants", "usage", "history"] as const).map((v) => (
              <TabsTrigger
                key={v}
                value={v}
                className="relative h-10 flex-1 rounded-none border-0 bg-transparent px-2 text-[12px] font-medium capitalize text-muted-foreground transition-colors duration-120 data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none data-[state=active]:after:absolute data-[state=active]:after:bottom-0 data-[state=active]:after:left-2 data-[state=active]:after:right-2 data-[state=active]:after:h-[2px] data-[state=active]:after:rounded-full data-[state=active]:after:bg-primary"
              >
                {v}
                {v === "usage" && ref > 0 && (
                  <span className="ml-1 text-muted-foreground/70">{ref}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Details */}
          <TabsContent value="details" className="m-0 px-5 pb-8 pt-4 space-y-6">
            <InspectorSection title="General">
              <MediaField label="Alt text">
                <MediaInput
                  defaultValue={asset.altText ?? ""}
                  placeholder="Describe this asset for screen readers"
                  onBlur={(e) => onUpdate({ altText: e.target.value })}
                />
              </MediaField>
              <MediaField label="Caption">
                <MediaInput
                  defaultValue={asset.caption ?? ""}
                  placeholder="Optional caption"
                  onBlur={(e) => onUpdate({ caption: e.target.value })}
                />
              </MediaField>
              <MediaField label="Description">
                <MediaTextarea
                  defaultValue=""
                  placeholder="Add additional context"
                  rows={3}
                />
              </MediaField>
              <MediaField label="Filename">
                <MediaInput
                  defaultValue={asset.name}
                  onBlur={(e) => e.target.value.trim() && onUpdate({ name: e.target.value.trim() })}
                />
              </MediaField>
            </InspectorSection>

            <InspectorSection title="Accessibility">
              <ToggleRow label="Mark as decorative" hint="Skips alt text requirement" />
              <MediaField label="Long description">
                <MediaTextarea placeholder="Detailed description for complex images" rows={2} />
              </MediaField>
            </InspectorSection>

            <InspectorSection title="Organization">
              <MediaField label="Folder">
                <div className="flex items-center justify-between rounded-[10px] border border-border bg-transparent px-3 py-2 text-[12.5px] transition-colors duration-120 hover:border-foreground/30">
                  <span className="inline-flex items-center gap-2 text-foreground">
                    <Folder className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                    {folderName}
                  </span>
                  <button
                    onClick={onMove}
                    className="text-[11.5px] font-medium text-primary hover:underline"
                  >
                    Move
                  </button>
                </div>
              </MediaField>
              <MediaField label="Tags">
                <div className="flex flex-wrap items-center gap-1.5">
                  {(asset.tags ?? []).map((t) => (
                    <span
                      key={t}
                      className="inline-flex h-6 items-center gap-1 rounded-full border border-border bg-transparent pl-2 pr-1 text-[11px] text-foreground transition-colors duration-120 hover:border-foreground/30"
                    >
                      {t}
                      <button
                        onClick={() =>
                          onUpdate({ tags: (asset.tags ?? []).filter((x) => x !== t) })
                        }
                        aria-label={`Remove tag ${t}`}
                        className="grid h-4 w-4 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </span>
                  ))}
                  <AddTagButton
                    onAdd={(t) => {
                      const tags = asset.tags ?? [];
                      if (tags.includes(t)) return;
                      onUpdate({ tags: [...tags, t] });
                    }}
                  />
                </div>
              </MediaField>
              <MediaField label="Collections">
                <button className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-border bg-transparent px-2.5 text-[11px] text-muted-foreground hover:border-foreground/40 hover:text-foreground">
                  <Plus className="h-3 w-3" /> Add to collection
                </button>
              </MediaField>
            </InspectorSection>

            <InspectorSection title="Technical">
              <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Meta label="Dimensions" value={asset.width && asset.height ? `${asset.width}×${asset.height}` : "—"} />
                <Meta label="File size" value={asset.size ?? "—"} />
                <Meta label="Type" value={asset.mimeType ?? "—"} mono />
                <Meta label="Created" value={formatDate(asset.uploadedAt)} />
              </div>
              <div className="mt-3 space-y-2">
                <MonoCopyRow label="Checksum" value="sha256:9f2a…b41c" />
              </div>
            </InspectorSection>
          </TabsContent>

          {/* Variants */}
          <TabsContent value="variants" className="m-0 px-5 pb-8 pt-4">
            <InspectorSection title="Generated variants" first>
              <div className="overflow-hidden rounded-[10px] border border-border">
                {[
                  { label: "Original", w: asset.width ?? 0, h: asset.height ?? 0, size: asset.size ?? "—" },
                  { label: "Thumbnail", w: 320, h: 200, size: "24 KB" },
                  { label: "Mobile", w: 640, h: 400, size: "62 KB" },
                  { label: "Tablet", w: 1024, h: 640, size: "140 KB" },
                  { label: "Desktop", w: 1600, h: 1000, size: "280 KB" },
                  { label: "Retina", w: 3200, h: 2000, size: "740 KB" },
                ].map((v, i, all) => (
                  <div
                    key={v.label}
                    className={`flex items-center justify-between gap-2 px-3 py-2.5 ${
                      i < all.length - 1 ? "border-b border-border/50" : ""
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12.5px] font-medium">{v.label}</div>
                      <div className="font-mono text-[10.5px] tabular-nums text-muted-foreground">
                        {v.w}×{v.h} · {v.size}
                      </div>
                    </div>
                    <button
                      onClick={() => toast.success(`Copied ${v.label.toLowerCase()} URL`)}
                      aria-label={`Copy ${v.label} URL`}
                      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors duration-120 hover:bg-muted/60 hover:text-foreground"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </InspectorSection>

            <InspectorSection title="Convert to">
              <div className="flex flex-wrap gap-1.5">
                {["PNG", "JPEG", "WEBP", "AVIF"].map((f) => (
                  <button
                    key={f}
                    onClick={() => toast.success(`Conversion to ${f} queued`)}
                    className="h-7 rounded-full border border-border bg-transparent px-3 text-[11.5px] text-muted-foreground transition-colors duration-120 hover:border-foreground/30 hover:text-foreground"
                  >
                    {f}
                  </button>
                ))}
              </div>
            </InspectorSection>
          </TabsContent>

          {/* Usage */}
          <TabsContent value="usage" className="m-0 px-5 pb-8 pt-4">
            {ref === 0 ? (
              <div className="rounded-[10px] border border-dashed border-border px-4 py-10 text-center">
                <Database className="mx-auto h-5 w-5 text-muted-foreground/60" strokeWidth={1.5} />
                <div className="mt-2 text-[12.5px] font-medium text-foreground">Not used anywhere</div>
                <div className="mt-1 text-[11.5px] text-muted-foreground">
                  Safe to delete or move without breaking references.
                </div>
              </div>
            ) : (
              <InspectorSection title={`Referenced in ${ref} ${ref === 1 ? "location" : "locations"}`} first>
                <div className="overflow-hidden rounded-[10px] border border-border">
                  {(asset.referencedBy ?? []).map((id, i, all) => (
                    <button
                      key={id}
                      onClick={() => toast(`Open ${prettifyPageId(id)}`)}
                      className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left transition-colors duration-120 hover:bg-muted/40 ${
                        i < all.length - 1 ? "border-b border-border/50" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                        <span className="truncate text-[12.5px] font-medium">{prettifyPageId(id)}</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Page</span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Replace this asset to update every reference automatically.
                </p>
              </InspectorSection>
            )}
          </TabsContent>

          {/* History */}
          <TabsContent value="history" className="m-0 px-5 pb-8 pt-4">
            <InspectorSection title="Activity" first>
              <ol className="relative space-y-3 border-l border-border/60 pl-4">
                {[
                  { kind: "Uploaded", who: "Jane Park", when: asset.uploadedAt, v: "v1" },
                  { kind: "Optimized", who: "System", when: asset.uploadedAt, v: "v1.1" },
                  { kind: "Downloaded", who: "Alex Wu", when: asset.uploadedAt, v: "—" },
                  { kind: "Published", who: "Jane Park", when: asset.uploadedAt, v: "v2" },
                ].map((row, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -left-[18px] top-1.5 h-2 w-2 rounded-full bg-primary/70 ring-2 ring-background" />
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[12.5px] font-medium text-foreground">{row.kind}</span>
                      <span className="font-mono text-[10.5px] tabular-nums text-muted-foreground/70">{row.v}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {row.who} · <Clock className="inline h-2.5 w-2.5" /> {formatDate(row.when)}
                    </div>
                  </li>
                ))}
              </ol>
            </InspectorSection>
          </TabsContent>
        </Tabs>
      </div>
    </aside>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`group flex flex-col items-center gap-1 rounded-md bg-transparent py-2 text-[10.5px] font-medium transition-colors duration-120 ${
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
      {label}
    </button>
  );
}

function InspectorSection({
  title,
  first,
  children,
}: {
  title: string;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className={first ? "" : "border-t border-border/60 pt-5"}>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
        {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MediaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/* Universal input style — local to media library, will graduate later. */
function MediaInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return (
    <input
      {...rest}
      className={`h-10 w-full rounded-[10px] border border-border bg-transparent px-3 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 transition-all duration-120 hover:border-foreground/30 focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:shadow-[0_0_18px_-6px_color-mix(in_oklab,var(--primary)_50%,transparent)] ${className}`}
    />
  );
}

function MediaTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", rows = 3, ...rest } = props;
  return (
    <textarea
      {...rest}
      rows={rows}
      className={`w-full resize-none rounded-[10px] border border-border bg-transparent px-3 py-2 text-[12.5px] text-foreground placeholder:text-muted-foreground/60 transition-all duration-120 hover:border-foreground/30 focus:border-primary focus:bg-card focus:outline-none focus:ring-2 focus:ring-primary/40 focus:shadow-[0_0_18px_-6px_color-mix(in_oklab,var(--primary)_50%,transparent)] ${className}`}
    />
  );
}

function ToggleRow({
  label,
  hint,
  defaultChecked,
}: {
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3 rounded-md py-1">
      <div className="min-w-0">
        <div className="text-[12.5px] font-medium text-foreground">{label}</div>
        {hint && <div className="text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => setOn((v) => !v)}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
          on ? "bg-primary" : "bg-muted"
        }`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-background shadow-sm transition-transform duration-150 ${
            on ? "translate-x-[18px]" : "translate-x-0.5"
          }`}
        />
      </button>
    </label>
  );
}

function Meta({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
        {label}
      </div>
      <div className={`mt-0.5 truncate text-[12px] text-foreground ${mono ? "font-mono" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function MonoCopyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="group flex items-center justify-between gap-2 rounded-[10px] border border-border bg-transparent px-3 py-2">
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
          {label}
        </div>
        <div className="truncate font-mono text-[11.5px] text-foreground">{value}</div>
      </div>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(value).catch(() => {});
          toast.success(`${label} copied`);
        }}
        aria-label={`Copy ${label}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded text-muted-foreground transition-colors duration-120 hover:bg-muted/60 hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

/* ───────────────────────── Bulk action bar ───────────────────────── */

function BulkActionBar({
  count,
  onClear,
  onDelete,
  onMove,
}: {
  count: number;
  onClear: () => void;
  onDelete: () => void;
  onMove: () => void;
}) {
  return (
    <div className="pointer-events-none sticky bottom-5 z-30 flex justify-center px-6 pb-1">
      <div className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3 py-1.5 shadow-[var(--shadow-elevated)] backdrop-blur animate-in fade-in slide-in-from-bottom-2 duration-150">
        <div className="px-2 text-[12.5px] font-medium tabular-nums">
          {count} selected
        </div>
        <span className="h-4 w-px bg-border" />
        <BulkBtn icon={Folder} label="Move" onClick={onMove} />
        <BulkBtn icon={Tag} label="Tag" onClick={() => toast("Tag — coming soon")} />
        <BulkBtn icon={Download} label="Download" onClick={() => toast("Preparing download…")} />
        <BulkBtn icon={Trash2} label="Trash" onClick={onDelete} danger />
        <span className="h-4 w-px bg-border" />
        <button
          onClick={onClear}
          className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors duration-120 hover:bg-muted/60 hover:text-foreground"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

function BulkBtn({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: LucideIcon;
  label: string;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[12px] transition-colors duration-120 ${
        danger
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" strokeWidth={1.75} />
      {label}
    </button>
  );
}

/* ───────────────────────── Empty state ───────────────────────── */

function MediaEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <div className="grid place-items-center px-6 py-20">
      <div className="w-full max-w-md rounded-2xl border border-dashed border-[color:var(--border-hairline)] bg-card px-8 py-14 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Upload className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h3 className="mt-4 text-[15px] font-semibold tracking-tight text-foreground">
          Drop files to upload
        </h3>
        <p className="mx-auto mt-1.5 max-w-xs text-[12.5px] text-muted-foreground">
          PNG, JPG, WEBP, AVIF, SVG, MP4, MOV — up to 100 MB per file.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2">
          <Button size="sm" className="h-9 rounded-[10px] text-[13px]" onClick={onUpload}>
            <Upload className="mr-1.5 h-3.5 w-3.5" /> Upload assets
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────── Upload sheet ───────────────────────── */

function UploadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  type Queued = { id: string; name: string; size: string; progress: number; status: "uploading" | "optimizing" | "done" };
  const [queue, setQueue] = useState<Queued[]>([
    { id: "u1", name: "winter-campaign.jpg", size: "2.4 MB", progress: 100, status: "done" },
    { id: "u2", name: "explainer-final.mp4", size: "38 MB", progress: 72, status: "optimizing" },
    { id: "u3", name: "landing-mock.png", size: "1.1 MB", progress: 34, status: "uploading" },
  ]);

  const addFake = () => {
    setQueue((q) => [
      ...q,
      {
        id: `u${q.length + 1}`,
        name: `new-asset-${q.length + 1}.png`,
        size: "780 KB",
        progress: 12,
        status: "uploading",
      },
    ]);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Upload assets</SheetTitle>
          <SheetDescription>
            Drag and drop files anywhere, or choose a source below.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="computer" className="mt-5">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="computer">Computer</TabsTrigger>
            <TabsTrigger value="url">From URL</TabsTrigger>
          </TabsList>

          <TabsContent value="computer" className="pt-4">
            <button
              onClick={addFake}
              className="grid w-full place-items-center gap-2 rounded-xl border-2 border-dashed border-border bg-transparent px-6 py-10 text-center transition-colors duration-120 hover:border-primary/60"
            >
              <Upload className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
              <div className="text-[13px] font-medium text-foreground">Drop files or click to browse</div>
              <div className="text-[11.5px] text-muted-foreground">Up to 100 MB · PNG, JPG, WEBP, AVIF, GIF, SVG, MP4, MOV, PDF, TXT, MD, Lottie</div>
            </button>
          </TabsContent>

          <TabsContent value="url" className="pt-4">
            <Label className="text-[12px]">Asset URL</Label>
            <div className="mt-1.5 flex items-center gap-1.5">
              <Input placeholder="https://…" className="h-9 text-[13px]" />
              <Button size="sm" className="h-9 text-[13px]" onClick={addFake}>Import</Button>
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">We'll fetch, optimize, and store the file in your library.</p>
          </TabsContent>
        </Tabs>

        <div className="mt-6">
          <div className="mb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Upload queue
          </div>
          <div className="rounded-lg border border-border">
            {queue.map((q) => (
              <div key={q.id} className="flex items-center gap-3 border-b border-border/40 px-3 py-2.5 last:border-b-0">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-muted/40 text-muted-foreground">
                  <ImageIcon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-medium">{q.name}</span>
                    <span className="text-[10.5px] tabular-nums text-muted-foreground">{q.size}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Progress value={q.progress} className="h-1 flex-1" />
                    <span className={`text-[10.5px] uppercase tracking-wider ${q.status === "done" ? "text-emerald-500" : "text-muted-foreground"}`}>
                      {q.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* avoid unused-import warning for LinkUrlIcon */}
        <LinkUrlIcon className="hidden" />
      </SheetContent>
    </Sheet>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function referenceCount(a: MediaAsset) {
  return a.referencedBy?.length ?? 0;
}

function formatTag(a: MediaAsset) {
  if (a.mimeType === "image/svg+xml") return "SVG";
  if (a.mimeType === "video/quicktime") return "MOV";
  if (a.mimeType?.startsWith("image/")) return a.mimeType.replace("image/", "").toUpperCase();
  if (a.mimeType?.startsWith("video/")) return a.mimeType.replace("video/", "").toUpperCase();
  if (a.mimeType?.startsWith("audio/")) return a.mimeType.replace("audio/", "").toUpperCase();
  if (a.mimeType === "application/pdf") return "PDF";
  if (a.mimeType === "application/zip") return "ZIP";
  if (a.mimeType === "application/lottie+json") return "LOTTIE";
  if (a.mimeType === "text/markdown") return "MD";
  if (a.mimeType === "text/plain") return "TXT";
  return a.kind.toUpperCase();
}

/** Tile styling per non-visual file type, so documents read at a glance. */
function fileTileMeta(a: MediaAsset): { label: string; icon: LucideIcon; tile: string; text: string } {
  if (a.mimeType === "application/pdf")
    return { label: "PDF", icon: FileText, tile: "bg-rose-500/10", text: "text-rose-500" };
  if (a.mimeType === "text/markdown")
    return { label: "MD", icon: FileText, tile: "bg-sky-500/10", text: "text-sky-500" };
  if (a.mimeType === "text/plain")
    return { label: "TXT", icon: FileText, tile: "bg-slate-500/10", text: "text-slate-500" };
  if (a.mimeType === "application/lottie+json")
    return { label: "LOTTIE", icon: Sparkles, tile: "bg-violet-500/10", text: "text-violet-500" };
  if (a.mimeType?.startsWith("audio"))
    return { label: "AUDIO", icon: Music, tile: "bg-amber-500/10", text: "text-amber-500" };
  if (a.mimeType === "application/zip")
    return { label: "ZIP", icon: FileIcon, tile: "bg-slate-500/10", text: "text-slate-500" };
  if (a.mimeType === "image/svg+xml")
    return { label: "SVG", icon: Shapes, tile: "bg-emerald-500/10", text: "text-emerald-500" };
  return { label: formatTag(a), icon: FileIcon, tile: "bg-muted/40", text: "text-muted-foreground" };
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function formatDate(iso?: string) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

function prettifyPageId(id: string) {
  return id.replace(/^pg_/, "").split(/[_-]/).map((s) => s[0]?.toUpperCase() + s.slice(1)).join(" ");
}
