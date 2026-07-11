/**
 * presence-store — simulated multiplayer presence.
 *
 * The demo has no realtime backend, so this store plays the role of the
 * presence websocket: a handful of real workspace members (from mock data)
 * "join" the project and move around it live — browsing pages, editing
 * sections on the visual canvas, and working in collection entries. The
 * movement engine ticks only while something is subscribed, and every
 * location it emits points at REAL data (page paths, section ids, entry
 * ids, schema field names) so avatars land on actual rows and fields.
 *
 * Model notes (from the competitive study):
 * - Webflow: colored element outlines + a page-aware avatar dropdown.
 * - Sanity: presence anchored to the exact field being edited.
 * - Figma/Framer: named cursors; one accent color unifies every signal.
 * - Reviewers never appear to *edit* — activity is picked from the
 *   member's seat, matching the roles system.
 *
 * Ephemeral by design: nothing is persisted.
 */
import { useSyncExternalStore } from "react";
import { getCMSState } from "@/lib/cms/store";
import { getPages } from "@/lib/cms/pages-store";
import type { Member } from "@/lib/cms/types";

export type PresenceSurface = "pages" | "canvas" | "entry";

export interface PresencePeer {
  id: string;
  name: string;
  initials: string;
  color: string;
  seat: string;
  status: "active" | "idle";
  projectId: string;
  surface: PresenceSurface;
  /** canvas surface */
  pagePath?: string;
  pageTitle?: string;
  /** section being edited on the canvas (editors of content only) */
  sectionId?: string;
  /** cursor position as fractions of the section rect */
  cursor?: { fx: number; fy: number };
  /** entry surface */
  collectionId?: string;
  collectionName?: string;
  entryId?: string;
  entryTitle?: string;
  fieldName?: string;
  /** Which block of a rich-text field they're near (mapped to an index). */
  blockSeed?: number;
}

/** Accent palette for presence signals. Distinct from the brand pink. */
const PRESENCE_COLORS = ["#6366F1", "#0EA5E9", "#10B981", "#F59E0B", "#8B5CF6", "#14B8A6", "#F43F5E", "#84CC16"];

function initialsOf(name: string): string {
  return (
    name
      .split(/[\s.]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

let byProject: Record<string, PresencePeer[]> = {};
const EMPTY: PresencePeer[] = Object.freeze([]) as unknown as PresencePeer[];
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

export const PRESENCE_TICK_MS = 3600;

function emit() {
  listeners.forEach((l) => l());
}

/* ------------------------------------------------------------- seeding */

/** Whether this seat gets to edit content (reviewers only look). */
function canEdit(seat: string | undefined): boolean {
  return seat !== "reviewer";
}

function seatOf(m: Member): string {
  return (m as { seat?: string }).seat ?? m.role ?? "editor";
}

interface ProjectData {
  pages: { path: string; title: string; sectionIds: string[] }[];
  entries: { collectionId: string; collectionName: string; entryId: string; entryTitle: string; fieldNames: string[] }[];
}

function dataFor(projectId: string): ProjectData {
  const s = getCMSState();
  const pages = getPages(projectId).map((p) => ({
    path: p.path,
    title: p.title,
    sectionIds: p.sections.map((sec) => sec.id),
  }));
  const project = s.projects.find((p) => p.id === projectId);
  const entries: ProjectData["entries"] = [];
  for (const cid of project?.collectionIds ?? []) {
    const col = s.collections.find((c) => c.id === cid);
    if (!col) continue;
    const schema = s.schemas.find((sc) => sc.id === col.schemaId);
    const fieldNames = (schema?.fields ?? []).map((f) => f.name);
    for (const eid of col.entryIds.slice(0, 6)) {
      const entry = s.entries.find((e) => e.id === eid);
      if (entry) entries.push({ collectionId: col.id, collectionName: col.name, entryId: entry.id, entryTitle: entry.title, fieldNames });
    }
  }
  return { pages, entries };
}

function pick<T>(arr: T[], rnd: () => number): T | undefined {
  return arr.length ? arr[Math.floor(rnd() * arr.length)] : undefined;
}

/** Deterministic-ish PRNG so a fresh load feels stable but alive. */
function makeRng(seed: number) {
  let x = seed || 1;
  return () => {
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 0xffffffff;
  };
}

function seedProject(projectId: string): PresencePeer[] {
  const s = getCMSState();
  const project = s.projects.find((p) => p.id === projectId);
  if (!project) return [];
  const ws = s.workspaces.find((w) => w.id === project.workspaceId);
  if (!ws) return [];
  const rnd = makeRng(projectId.split("").reduce((a, c) => a + c.charCodeAt(0), 7));
  // Never impersonate the viewer: exclude both demo identities for "you".
  const SELF = new Set(["Himanshu Sahu", "Jane Park"]);
  const teammates = s.members.filter(
    (m) => ws.memberIds.includes(m.id) && !SELF.has(m.name) && m.status !== "invited",
  );
  const count = Math.min(teammates.length, 3 + Math.floor(rnd() * 2)); // 3-4 peers
  const chosen = [...teammates].sort(() => rnd() - 0.5).slice(0, count);
  // Keep the mix demonstrative: make sure at least one content editor is in,
  // so collection/entry presence actually shows up alongside canvas presence.
  const hasEditor = chosen.some((m) => ["editor", "marketer"].includes(seatOf(m)));
  if (!hasEditor) {
    const candidate =
      teammates.find((m) => seatOf(m) === "editor") ?? teammates.find((m) => seatOf(m) === "marketer");
    if (candidate && !chosen.includes(candidate)) chosen[chosen.length - 1] = candidate;
  }
  const data = dataFor(projectId);

  const peers = chosen.map((m, i) => {
    const peer: PresencePeer = {
      id: m.id,
      name: m.name,
      initials: initialsOf(m.name),
      color: PRESENCE_COLORS[i % PRESENCE_COLORS.length],
      seat: seatOf(m),
      status: "active",
      projectId,
      surface: "pages",
    };
    placeSomewhere(peer, data, rnd);
    return peer;
  });
  // Seed one editor into a blog-post entry so per-paragraph presence is
  // visible the moment you open it (they still wander off over time).
  const firstEntry = data.entries.find((e) => /post|blog|article/i.test(e.collectionName)) ?? data.entries[0];
  const editorPeer = peers.find((p) => canEdit(p.seat));
  if (firstEntry && editorPeer) {
    editorPeer.status = "active";
    editorPeer.surface = "entry";
    editorPeer.collectionId = firstEntry.collectionId;
    editorPeer.collectionName = firstEntry.collectionName;
    editorPeer.entryId = firstEntry.entryId;
    editorPeer.entryTitle = firstEntry.entryTitle;
    editorPeer.fieldName = firstEntry.fieldNames.find((n) => /body|content/i.test(n)) ?? firstEntry.fieldNames[0];
    editorPeer.blockSeed = 4;
    editorPeer.pagePath = undefined;
    editorPeer.cursor = undefined;
  }
  return peers;
}

/** Drop a peer onto a plausible location given their seat. */
function placeSomewhere(peer: PresencePeer, data: ProjectData, rnd: () => number) {
  const editor = canEdit(peer.seat);
  const roll = rnd();
  if (editor && data.entries.length && (peer.seat === "editor" ? roll < 0.6 : roll < 0.35)) {
    const e = pick(data.entries, rnd)!;
    peer.surface = "entry";
    peer.collectionId = e.collectionId;
    peer.collectionName = e.collectionName;
    peer.entryId = e.entryId;
    peer.entryTitle = e.entryTitle;
    peer.fieldName = pick(e.fieldNames, rnd);
    peer.blockSeed = Math.floor(rnd() * 997);
    peer.pagePath = undefined;
    peer.pageTitle = undefined;
    peer.sectionId = undefined;
    peer.cursor = undefined;
  } else if (data.pages.length && roll < 0.9) {
    // Weight the home page so the surface you look at first feels alive.
    const home = data.pages.find((p) => p.path === "/");
    const pg = home && rnd() < 0.5 ? home : pick(data.pages, rnd)!;
    peer.surface = "canvas";
    peer.pagePath = pg.path;
    peer.pageTitle = pg.title;
    peer.sectionId = editor ? pick(pg.sectionIds, rnd) : undefined;
    peer.cursor = { fx: 0.15 + rnd() * 0.7, fy: 0.2 + rnd() * 0.6 };
    peer.collectionId = undefined;
    peer.collectionName = undefined;
    peer.entryId = undefined;
    peer.entryTitle = undefined;
    peer.fieldName = undefined;
  } else {
    peer.surface = "pages";
    peer.pagePath = undefined;
    peer.pageTitle = undefined;
    peer.sectionId = undefined;
    peer.cursor = undefined;
    peer.entryId = undefined;
    peer.fieldName = undefined;
  }
}

/* ------------------------------------------------------------ movement */

function tick() {
  let changed = false;
  const next: Record<string, PresencePeer[]> = {};
  for (const [projectId, peers] of Object.entries(byProject)) {
    const data = dataFor(projectId);
    next[projectId] = peers.map((old) => {
      const peer: PresencePeer = { ...old };
      const rnd = Math.random;

      if (peer.status === "idle") {
        if (rnd() < 0.35) peer.status = "active";
        else return peer;
      } else if (rnd() < 0.03) {
        peer.status = "idle";
        changed = true;
        return peer;
      }

      if (peer.surface === "canvas") {
        const roll = rnd();
        const page = data.pages.find((p) => p.path === peer.pagePath);
        if (roll < 0.08 || !page) {
          placeSomewhere(peer, data, rnd); // wander off entirely
        } else if (roll < 0.28 && canEdit(peer.seat) && page.sectionIds.length) {
          peer.sectionId = pick(page.sectionIds, rnd); // move to another section
          peer.cursor = { fx: 0.15 + rnd() * 0.7, fy: 0.2 + rnd() * 0.6 };
        } else {
          // drift the cursor within the current section
          const c = peer.cursor ?? { fx: 0.5, fy: 0.5 };
          peer.cursor = {
            fx: Math.min(0.95, Math.max(0.03, c.fx + (rnd() - 0.5) * 0.45)),
            fy: Math.min(0.95, Math.max(0.05, c.fy + (rnd() - 0.5) * 0.5)),
          };
        }
      } else if (peer.surface === "entry") {
        const roll = rnd();
        const home = data.entries.filter((e) => e.entryId === peer.entryId);
        const bodyField = home[0]?.fieldNames.find((n) => /body|content/i.test(n));
        const onBody = !!peer.fieldName && /body|content/i.test(peer.fieldName);
        if (roll < 0.06 || !home.length) {
          placeSomewhere(peer, data, rnd); // wander off entirely
        } else if (onBody) {
          // Stay in the body most of the time, hopping between paragraphs so the
          // per-paragraph avatar keeps moving; occasionally dip into a field.
          if (roll < 0.86) {
            peer.blockSeed = ((peer.blockSeed ?? 0) + (rnd() < 0.5 ? 1 : -1) + 997) % 997;
          } else {
            peer.fieldName = pick(home[0].fieldNames, rnd);
          }
        } else {
          // In a structured field — likely to come back to writing the body.
          if (roll < 0.5 && bodyField) {
            peer.fieldName = bodyField;
            peer.blockSeed = Math.floor(rnd() * 997);
          } else if (roll < 0.75) {
            peer.fieldName = pick(home[0].fieldNames, rnd);
          }
        }
      } else if (rnd() < 0.4) {
        placeSomewhere(peer, data, rnd); // stop browsing, do something
      }

      changed = true;
      return peer;
    });
  }
  if (changed) {
    byProject = next;
    emit();
  }
}

function startEngine() {
  if (timer) return;
  timer = setInterval(tick, PRESENCE_TICK_MS);
}
function stopEngine() {
  if (timer && listeners.size === 0) {
    clearInterval(timer);
    timer = null;
  }
}

function subscribe(l: () => void) {
  listeners.add(l);
  startEngine();
  return () => {
    listeners.delete(l);
    stopEngine();
  };
}

/* ---------------------------------------------------------------- API */

/** Projects we've already seeded, so a legitimately-empty project doesn't
 *  re-seed on every render. */
const seededProjects = new Set<string>();

export function ensurePresence(projectId: string) {
  if (typeof window === "undefined") return;
  if (seededProjects.has(projectId)) return;
  // The CMS store hydrates a beat after first paint. Seeding before its data
  // is ready yields zero teammates and would cache an empty list forever, so
  // hold off until members exist.
  if (getCMSState().members.length === 0) return;
  seededProjects.add(projectId);
  byProject = { ...byProject, [projectId]: seedProject(projectId) };
}

/** Everyone active in a project. Stable EMPTY when unknown. */
export function useProjectPresence(projectId: string | undefined): PresencePeer[] {
  return useSyncExternalStore(
    subscribe,
    () => {
      if (!projectId) return EMPTY;
      ensurePresence(projectId);
      return byProject[projectId] ?? EMPTY;
    },
    () => EMPTY,
  );
}

/** Human-readable "where they are" line for tooltips and the popover. */
export function peerLocationLabel(peer: PresencePeer): string {
  if (peer.status === "idle") return "Away";
  if (peer.surface === "canvas") return peer.sectionId ? `Editing ${peer.pageTitle ?? peer.pagePath}` : `Viewing ${peer.pageTitle ?? peer.pagePath}`;
  if (peer.surface === "entry") return `Editing ${peer.entryTitle ?? "an entry"}${peer.collectionName ? ` in ${peer.collectionName}` : ""}`;
  return "Browsing pages";
}
