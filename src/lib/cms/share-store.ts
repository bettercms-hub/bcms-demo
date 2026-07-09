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
 * The token SELF-ENCODES { projectId, kind, cloneEnabled } so a link works
 * in any browser — the recipient is usually a different browser, where a
 * localStorage registry wouldn't help. (Seeded projects exist in every
 * browser; a freshly created project only resolves in the tab that made it,
 * an accepted demo limitation.) The per-project map below just remembers
 * which links the owner has turned on, for the Share dialog UI.
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
const listeners = new Set<() => void>();

/* --------------------------------------------------- token codec */

function b64urlEncode(s: string): string {
  const b64 = typeof btoa !== "undefined" ? btoa(s) : Buffer.from(s, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  return typeof atob !== "undefined" ? atob(b64) : Buffer.from(b64, "base64").toString("utf8");
}

function encodeToken(projectId: string, kind: ShareKind, cloneEnabled: boolean): string {
  const prefix = kind === "template" ? "t" : "p";
  const payload = b64urlEncode(JSON.stringify({ p: projectId, k: kind, c: cloneEnabled }));
  return `${prefix}_${payload}`;
}

/** Decode a token straight into a link — no registry needed, so any browser resolves it. */
export function resolveShare(token: string): ShareLink | undefined {
  try {
    const payload = token.slice(2); // drop the "p_" / "t_" prefix
    const data = JSON.parse(b64urlDecode(payload)) as { p: string; k: ShareKind; c?: boolean };
    if (!data.p || (data.k !== "preview" && data.k !== "template")) return undefined;
    const owner = byProject[data.p]?.[data.k];
    return {
      token,
      projectId: data.p,
      kind: data.k,
      cloneEnabled: data.k === "template" ? data.c !== false : false,
      createdAt: owner?.createdAt ?? "",
      views: owner?.views ?? 0,
    };
  } catch {
    return undefined;
  }
}

/* --------------------------------------------------- persistence */

function hydrate() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) byProject = JSON.parse(raw) as Record<string, ProjectShares>;
  } catch {
    byProject = {};
  }
}
hydrate();

function persist() {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(byProject));
    } catch {
      /* quota — ignore in the demo */
    }
  }
  listeners.forEach((l) => l());
}

function makeLink(projectId: string, kind: ShareKind, cloneEnabled: boolean): ShareLink {
  return { token: encodeToken(projectId, kind, cloneEnabled), projectId, kind, cloneEnabled, createdAt: new Date().toISOString(), views: 0 };
}

/* --------------------------------------------------------------- reads */

// Stable reference for "no shares": a fresh {} each read would make
// useSyncExternalStore think the snapshot changed every render (infinite loop).
const EMPTY: ProjectShares = Object.freeze({});

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

/* ------------------------------------------------------------- actions */

export const shareActions = {
  enablePreview(projectId: string): ShareLink {
    const cur = byProject[projectId] ?? {};
    const link = cur.preview ?? makeLink(projectId, "preview", false);
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
    const link = cur.template ?? makeLink(projectId, "template", true);
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
  /** Cloning is baked into the token, so toggling it re-mints the template link. */
  setCloneEnabled(projectId: string, cloneEnabled: boolean) {
    const cur = byProject[projectId];
    if (!cur?.template) return;
    const link: ShareLink = { ...cur.template, cloneEnabled, token: encodeToken(projectId, "template", cloneEnabled) };
    byProject = { ...byProject, [projectId]: { ...cur, template: link } };
    persist();
  },
  recordView(token: string) {
    const decoded = resolveShare(token);
    if (!decoded) return;
    const cur = byProject[decoded.projectId];
    const link = cur?.[decoded.kind];
    if (!link) return; // only the owner's browser counts views (no backend)
    byProject = { ...byProject, [decoded.projectId]: { ...cur, [decoded.kind]: { ...link, views: link.views + 1 } } };
    persist();
  },
};

/** Build the absolute share URL for a token. */
export function shareUrl(token: string): string {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}/p/${token}`;
}
