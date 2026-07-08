/**
 * FolderDialog — create or edit a folder.
 *
 * A folder is either a URL folder (carries a slug, becomes part of the paths
 * of pages created inside it) or an organizer (no slug, pure grouping).
 * Folders can nest, respecting the depth cap.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Folder as FolderIcon, FolderTree, Link2, X } from "lucide-react";
import { toast } from "sonner";
import {
  eligibleParents,
  folderActions,
  folderTrail,
  folderUrlPrefix,
  slugifySegment,
  useFolders,
  type Folder,
} from "@/lib/cms/folders-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function FolderDialog({
  projectId,
  folder,
  defaultParentId,
  onClose,
}: {
  projectId: string;
  /** Editing an existing folder, or null to create one. */
  folder: Folder | null;
  defaultParentId?: string | null;
  onClose: () => void;
}) {
  const folders = useFolders(projectId);
  const [name, setName] = useState(folder?.name ?? "");
  const [kind, setKind] = useState<"url" | "organizer">(folder ? (folder.slug ? "url" : "organizer") : "url");
  const [slug, setSlug] = useState(folder?.slug ?? "");
  const [parentId, setParentId] = useState<string | null>(folder?.parentId ?? defaultParentId ?? null);
  const [slugEdited, setSlugEdited] = useState(!!folder?.slug);

  const parents = eligibleParents(folders, folder?.id);
  const effectiveSlug = kind === "url" ? (slug.trim() ? slugifySegment(slug) : slugifySegment(name || "folder")) : "";
  const prefix = folderUrlPrefix(folders, parentId);
  const valid = name.trim().length >= 1;

  function submit() {
    if (!valid) return;
    if (folder) {
      folderActions.update(projectId, folder.id, { name, slug: effectiveSlug, parentId });
      toast.success("Folder saved");
    } else {
      folderActions.add(projectId, { name, slug: effectiveSlug, parentId });
      toast.success(`Folder "${name.trim()}" created`);
    }
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div role="dialog" aria-modal="true" aria-label={folder ? "Edit folder" : "New folder"} className="absolute left-1/2 top-[12vh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <FolderIcon className="h-4 w-4" />
          </span>
          <div className="flex-1 text-[14px] font-semibold text-foreground">{folder ? "Edit folder" : "New folder"}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3.5 p-4">
          <label className="block">
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Folder name</div>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugEdited) setSlug(slugifySegment(e.target.value));
              }}
              autoFocus
              placeholder="Solutions"
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </label>

          {/* kind */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "url" as const, icon: Link2, label: "URL folder", blurb: "Adds to the path of pages inside it" },
                { id: "organizer" as const, icon: FolderTree, label: "Organizer", blurb: "Just for grouping, no URL" },
              ]
            ).map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
                className={cn(
                  "flex items-start gap-2 rounded-lg border p-2.5 text-left transition-colors",
                  kind === k.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <k.icon className={cn("mt-0.5 h-4 w-4 shrink-0", kind === k.id ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-[12.5px] font-semibold text-foreground">{k.label}</span>
                  <span className="block text-[10.5px] leading-snug text-muted-foreground">{k.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          {kind === "url" && (
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">URL segment</div>
              <div className="flex items-center rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 focus-within:border-[color:var(--primary)]">
                <span className="shrink-0 font-mono text-[12px] text-muted-foreground">{prefix}/</span>
                <input
                  value={slug}
                  onChange={(e) => {
                    setSlug(e.target.value);
                    setSlugEdited(true);
                  }}
                  placeholder="solutions"
                  className="h-9 w-full bg-transparent px-1 font-mono text-[12.5px] outline-none"
                />
              </div>
            </label>
          )}

          {parents.length > 0 && (
            <label className="block">
              <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Inside</div>
              <select
                value={parentId ?? ""}
                onChange={(e) => setParentId(e.target.value || null)}
                className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-card px-2.5 text-[13px] text-foreground outline-none transition-colors focus:border-[color:var(--primary)]"
              >
                <option value="">Top level</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>{folderTrail(folders, p.id)}</option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="sm" disabled={!valid} onClick={submit}>{folder ? "Save folder" : "Create folder"}</Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
