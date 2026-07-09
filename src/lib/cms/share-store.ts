/**
 * share-store — public share links for a project, per project.
 *
 * Two kinds, both read-only for the visitor (no auth, no editing, no
 * settings):
 * - preview:  a sandbox link to review the build — pages, content model
 *   and collections — great for sharing internally.
 * - template: the same read-only sandbox plus an optional "Clone" button
 *   that duplicates the project into the visitor's workspace. Cloning can
 *   be turned off so a template stays look-only.
 *
 * Persisted to localStorage so a link opened in a fresh tab still resolves
 * to its project (seeded + created projects both exist in every tab).
 */
import { useSyncExternalStore } from "react";

export type ShareKind = "preview" | "template";

export interface ShareLink {
  token: string;
  projectId: string;
  kind: ShareKind;
  /** Template only: whether the Clone button is offered. */
  cloneEnabled: boolean;
  createdAt: string;
  views: number;
}

interface ProjectShares {
  preview?: ShareLink;
  template?: ShareLink;
}

const STORAGE_KEY = "bettercms.shares.v1";

let byProject: Record<string, ProjectShares> = {};
let byToken: Record<string, { projectId: string; kind: ShareKind }> = {};
const listeners = new Set<() => void>();

function reindex() {
  byToken = {};
  for (const [projectId, shares] of Object.entries(byProject)) {
    for (const link of [shares.preview, shares.template]) {
      if (link) byToken[link.token] = { projectId, kind: link.kind };
    }
  }
}

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) byProject = JSON.parse(raw) as Record<string, ProjectShares>;
  } catch {
    byProject = {};
  }
  reindex();
}
hydrate();

function persist() {
  reindex();
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byProject));
    } catch {
      /* quota — ignore in the demo */
    }
  }
  listeners.forEach((l) => l());
}

let seq = 0;
function newToken(kind: ShareKind): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${kind === "template" ? "t" : "p"}_${Date.now().toString(36)}${(seq++).toString(36)}${rand}`;
}

// Stable reference for "no shares": returning a fresh {} each read would make
// useSyncExternalStore think the snapshot changed every render (infinite loop).
const EMPTY: ProjectShares = Object.freeze({});

/* --------------------------------------------------------------- reads */

export function useShare(projectId: string): ProjectShares {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => byProject[projectId] ?? EMPTY,
    () => byProject[projectId] ?? EMPTY,
  );
}

/** Resolve a share token to its project + link (fresh reads, no hook). */
export function resolveShare(token: string): ShareLink | undefined {
  const hit = byToken[token];
  if (!hit) return undefined;
  return byProject[hit.projectId]?.[hit.kind];
}

/* ------------------------------------------------------------- actions */

export const shareActions = {
  enablePreview(projectId: string): ShareLink {
    const cur = byProject[projectId] ?? {};
    const link: ShareLink = cur.preview ?? {
      token: newToken("preview"),
      projectId,
      kind: "preview",
      cloneEnabled: false,
      createdAt: new Date().toISOString(),
      views: 0,
    };
    byProject = { ...byProject, [projectId]: { ...cur, preview: link } };
    persist();
    return link;
  },
  disablePreview(projectId: string) {
    const cur = byProject[projectId];
    if (!cur) return;
    byProject = { ...byProject, [projectId]: { ...cur, preview: undefined } };
    persist();
  },
  enableTemplate(projectId: string): ShareLink {
    const cur = byProject[projectId] ?? {};
    const link: ShareLink = cur.template ?? {
      token: newToken("template"),
      projectId,
      kind: "template",
      cloneEnabled: true,
      createdAt: new Date().toISOString(),
      views: 0,
    };
    byProject = { ...byProject, [projectId]: { ...cur, template: link } };
    persist();
    return link;
  },
  disableTemplate(projectId: string) {
    const cur = byProject[projectId];
    if (!cur) return;
    byProject = { ...byProject, [projectId]: { ...cur, template: undefined } };
    persist();
  },
  setCloneEnabled(projectId: string, cloneEnabled: boolean) {
    const cur = byProject[projectId];
    if (!cur?.template) return;
    byProject = { ...byProject, [projectId]: { ...cur, template: { ...cur.template, cloneEnabled } } };
    persist();
  },
  /** New token, invalidating the old link. */
  regenerate(projectId: string, kind: ShareKind) {
    const cur = byProject[projectId];
    const link = cur?.[kind];
    if (!link) return;
    byProject = { ...byProject, [projectId]: { ...cur, [kind]: { ...link, token: newToken(kind), views: 0 } } };
    persist();
  },
  recordView(token: string) {
    const hit = byToken[token];
    if (!hit) return;
    const cur = byProject[hit.projectId];
    const link = cur?.[hit.kind];
    if (!link) return;
    byProject = { ...byProject, [hit.projectId]: { ...cur, [hit.kind]: { ...link, views: link.views + 1 } } };
    persist();
  },
};

/** Build the absolute share URL for a token. */
export function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/p/${token}`;
}
