/**
 * folders-store — explicit folders for organizing pages, per project.
 *
 * Two kinds, distinguished only by whether they carry a URL segment:
 * - URL folder (slug set): contributes to the paths of pages created inside
 *   it, e.g. a "Solutions" folder with slug "solutions" prefixes new pages
 *   with /solutions/...
 * - Organizer (slug empty): pure grouping, no effect on any URL. For tidying
 *   the list without touching the site structure.
 *
 * Folders nest up to MAX_DEPTH levels. Pages reference a folder by id
 * (PageDoc.folderId); moving a page between folders is organizational and
 * never rewrites its path on its own.
 *
 * In-memory for the demo, per project in the backend for production.
 */
import { useSyncExternalStore } from "react";

export const MAX_FOLDER_DEPTH = 4;

export interface Folder {
  id: string;
  projectId: string;
  name: string;
  /** URL segment. Empty string means an organizer folder (no URL). */
  slug: string;
  /** Parent folder id, or null for a root-level folder. */
  parentId: string | null;
}

const byProject = new Map<string, Folder[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newFolderId = () => `fld_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Deterministic id for a seeded folder, so other seeds (e.g. a collection
 *  placed in a folder) can reference it without ordering coupling. */
export const seedFolderId = (projectId: string, key: string) => `fld_seed_${projectId}_${key}`;

/** Every project starts with two example folders so the feature reads: a
 *  "Solutions" URL folder for marketing pages, and a "Resources" URL folder
 *  that a collection is seeded into to demo nested collection URLs. */
function seed(projectId: string): Folder[] {
  return [
    { id: seedFolderId(projectId, "solutions"), projectId, name: "Solutions", slug: "solutions", parentId: null },
    { id: seedFolderId(projectId, "resources"), projectId, name: "Resources", slug: "resources", parentId: null },
  ];
}

function ensure(projectId: string): Folder[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed(projectId);
    byProject.set(projectId, arr);
  }
  return arr;
}

export function useFolders(projectId: string): Folder[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}
export function getFolders(projectId: string): Folder[] {
  return ensure(projectId);
}

export function slugifySegment(s: string): string {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^-+|-+$/g, "") || "folder"
  );
}

/* ------------------------------------------------------------- helpers */

/** Depth of a folder in the tree, 0 for root-level. */
export function folderDepth(folders: Folder[], id: string | null): number {
  let depth = -1;
  let cur = id;
  const byId = new Map(folders.map((f) => [f.id, f]));
  while (cur) {
    depth++;
    cur = byId.get(cur)?.parentId ?? null;
    if (depth > MAX_FOLDER_DEPTH + 2) break; // cycle guard
  }
  return depth;
}

/** The URL prefix a folder contributes, from URL-folder ancestors only. */
export function folderUrlPrefix(folders: Folder[], id: string | null): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const segs: string[] = [];
  let cur = id;
  let guard = 0;
  while (cur && guard++ < 12) {
    const f = byId.get(cur);
    if (!f) break;
    if (f.slug) segs.unshift(f.slug);
    cur = f.parentId;
  }
  return segs.length ? `/${segs.join("/")}` : "";
}

/** The dynamic route a collection serves at: the URL-folder prefix of its
 *  folder + its own slug segment. The rendered page pattern appends `/:slug`.
 *  A collection in an organizer folder (or none) keeps its short `/slug`. */
export function collectionUrlBase(folders: Folder[], folderId: string | null | undefined, collectionSlug: string): string {
  const prefix = folderUrlPrefix(folders, folderId ?? null);
  return `${prefix}/${collectionSlug}`;
}

/** Human breadcrumb of folder names, e.g. "Solutions / Enterprise". */
export function folderTrail(folders: Folder[], id: string | null): string {
  const byId = new Map(folders.map((f) => [f.id, f]));
  const names: string[] = [];
  let cur = id;
  let guard = 0;
  while (cur && guard++ < 12) {
    const f = byId.get(cur);
    if (!f) break;
    names.unshift(f.name);
    cur = f.parentId;
  }
  return names.join(" / ");
}

/** All descendant folder ids of a folder, for cascade delete / cycle checks. */
export function descendantIds(folders: Folder[], id: string): Set<string> {
  const out = new Set<string>();
  const walk = (pid: string) => {
    for (const f of folders) {
      if (f.parentId === pid && !out.has(f.id)) {
        out.add(f.id);
        walk(f.id);
      }
    }
  };
  walk(id);
  return out;
}

/** Folders eligible as a parent for a subtree, respecting the depth cap. */
export function eligibleParents(folders: Folder[], movingId?: string, childHeight = 0): Folder[] {
  const blocked = movingId ? new Set([movingId, ...descendantIds(folders, movingId)]) : new Set<string>();
  return folders.filter((f) => !blocked.has(f.id) && folderDepth(folders, f.id) + 1 + childHeight <= MAX_FOLDER_DEPTH - 1);
}

/* -------------------------------------------------------------- actions */

function patch(projectId: string, next: Folder[]) {
  byProject.set(projectId, next);
  emit();
}

export const folderActions = {
  add(projectId: string, input: { name: string; slug?: string; parentId?: string | null }): Folder {
    const folder: Folder = {
      id: newFolderId(),
      projectId,
      name: input.name.trim(),
      slug: input.slug?.trim() ? slugifySegment(input.slug) : "",
      parentId: input.parentId ?? null,
    };
    patch(projectId, [...ensure(projectId), folder]);
    return folder;
  },
  update(projectId: string, id: string, input: Partial<Pick<Folder, "name" | "slug" | "parentId">>) {
    patch(
      projectId,
      ensure(projectId).map((f) =>
        f.id === id
          ? { ...f, ...input, name: input.name?.trim() ?? f.name, slug: input.slug !== undefined ? (input.slug.trim() ? slugifySegment(input.slug) : "") : f.slug }
          : f,
      ),
    );
  },
  /** Remove a folder and all its descendants. Pages inside fall back to root
   *  (the caller clears their folderId). */
  remove(projectId: string, id: string): string[] {
    const all = ensure(projectId);
    const gone = new Set([id, ...descendantIds(all, id)]);
    patch(projectId, all.filter((f) => !gone.has(f.id)));
    return [...gone];
  },
};
