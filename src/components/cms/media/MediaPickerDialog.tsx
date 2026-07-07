import { useEffect, useMemo, useRef, useState } from "react";
import { Check, FolderOpen, ImageIcon, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCMS } from "@/lib/cms/store";
import type { MediaAsset } from "@/lib/cms/types";

const PAGE_SIZE = 12;

/**
 * Compact media library picker. Opens over any "choose an image" surface
 * (OG/social image, avatars, covers) and returns the selected asset's URL.
 * Reads the project's own media hub — folders on the left so you can browse
 * even when you don't remember a file's name, and the grid loads more as you
 * scroll instead of dumping everything at once.
 */
export function MediaPickerDialog({
  open,
  onOpenChange,
  projectId,
  onSelect,
  title = "Choose from media",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  onSelect: (url: string) => void;
  title?: string;
}) {
  const allMedia = useCMS((s) => s.media);
  const allFolders = useCMS((s) => s.mediaFolders);
  const [q, setQ] = useState("");
  const [folderId, setFolderId] = useState<string | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const scrollRef = useRef<HTMLDivElement>(null);

  const folders = useMemo(() => allFolders.filter((f) => f.projectId === projectId), [allFolders, projectId]);

  const allImages = useMemo(
    () => allMedia.filter((m) => m.projectId === projectId && m.kind === "image" && (m.thumbUrl || m.url)),
    [allMedia, projectId],
  );

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of allImages) if (a.folderId) m.set(a.folderId, (m.get(a.folderId) ?? 0) + 1);
    return m;
  }, [allImages]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    return allImages.filter(
      (m) =>
        (!folderId || m.folderId === folderId) &&
        (!query || m.name.toLowerCase().includes(query) || (m.tags ?? []).some((t) => t.includes(query))),
    );
  }, [allImages, folderId, q]);

  const images = filtered.slice(0, visible);
  const hasMore = visible < filtered.length;

  // Reset the reveal window whenever the folder or search narrows the set.
  useEffect(() => {
    setVisible(PAGE_SIZE);
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [folderId, q]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el || !hasMore) return;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) {
      setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
    }
  }

  function confirm(asset: MediaAsset) {
    onSelect(asset.url || asset.thumbUrl || "");
    onOpenChange(false);
    reset();
  }

  function reset() {
    setPicked(null);
    setQ("");
    setFolderId(null);
    setVisible(PAGE_SIZE);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-[760px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Browse by folder or search this project's media hub.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 gap-4">
          {/* Folder rail */}
          <div className="w-40 shrink-0 space-y-0.5 overflow-y-auto border-r border-[color:var(--border-hairline)] pr-3">
            <button
              type="button"
              onClick={() => setFolderId(null)}
              className={`flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                folderId === null
                  ? "bg-[color:var(--color-row-selected)] font-medium text-foreground"
                  : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              }`}
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">All images</span>
              </span>
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">{allImages.length}</span>
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFolderId(f.id)}
                className={`flex w-full items-center justify-between gap-1.5 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors ${
                  folderId === f.id
                    ? "bg-[color:var(--color-row-selected)] font-medium text-foreground"
                    : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                  {counts.get(f.id) ?? 0}
                </span>
              </button>
            ))}
          </div>

          {/* Results */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="relative shrink-0">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search media by name or tag"
                className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] pl-8 pr-3 text-[13px] text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
              />
            </div>

            {filtered.length === 0 ? (
              <div className="grid flex-1 place-items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] py-12 text-center">
                <ImageIcon className="h-6 w-6 text-muted-foreground" />
                <div className="text-[13px] text-muted-foreground">
                  {q ? `No images match "${q}".` : "No images here yet."}
                </div>
              </div>
            ) : (
              <div ref={scrollRef} onScroll={onScroll} className="grid max-h-[360px] grid-cols-3 gap-2 overflow-y-auto p-0.5 sm:grid-cols-4">
                {images.map((m) => {
                  const src = m.thumbUrl || m.url;
                  const active = picked === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPicked(m.id)}
                      onDoubleClick={() => confirm(m)}
                      title={m.name}
                      className={`group relative aspect-[4/3] overflow-hidden rounded-lg border transition-shadow ${
                        active ? "border-primary ring-2 ring-primary/40" : "border-[color:var(--border-hairline)] hover:ring-2 hover:ring-primary/20"
                      }`}
                    >
                      <img src={src} alt={m.altText ?? m.name} className="h-full w-full object-cover" loading="lazy" />
                      {active && (
                        <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground">
                          <Check className="h-3 w-3" />
                        </span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] text-white/90">
                        {m.name}
                      </span>
                    </button>
                  );
                })}
                {hasMore && (
                  <div className="col-span-3 grid place-items-center py-2 text-[11px] text-muted-foreground sm:col-span-4">
                    Loading more…
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between pt-1">
          <span className="text-[11.5px] text-muted-foreground">
            {images.length} of {filtered.length} image{filtered.length === 1 ? "" : "s"} · double-click to pick
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!picked}
              onClick={() => {
                const asset = images.find((m) => m.id === picked);
                if (asset) confirm(asset);
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Use image
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
