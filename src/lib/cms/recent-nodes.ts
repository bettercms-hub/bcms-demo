/** Tracks recently opened tree nodes per project, persisted to localStorage. */

const LS_KEY = "bettercms.recent.nodes";
const MAX = 8;

export interface RecentEntry {
  workspace: string;
  project: string;
  scope: "pages" | "collections" | "components";
  nodeId: string;
  label: string;
  at: number;
}

function read(): RecentEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as RecentEntry[]) : [];
  } catch {
    return [];
  }
}

function write(items: RecentEntry[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(items));
  } catch {
    /* noop */
  }
}

export function pushRecent(entry: RecentEntry) {
  const items = read().filter((r) => !(r.workspace === entry.workspace && r.project === entry.project && r.nodeId === entry.nodeId));
  items.unshift(entry);
  write(items.slice(0, MAX));
}

export function listRecent(workspace?: string, project?: string): RecentEntry[] {
  const all = read();
  if (!workspace || !project) return all;
  return all.filter((r) => r.workspace === workspace && r.project === project);
}
