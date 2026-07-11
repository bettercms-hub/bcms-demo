/**
 * Site search — per-project config, a working in-browser index, and query
 * analytics for the prototype.
 *
 * Mirrors the Forms pattern: everything a real backend would own lives here
 * behind action functions, so productionizing = swapping this module for the
 * Typesense-backed service while keeping the same shapes (see SEARCH_PLAN.md).
 *
 * The index is REAL in the demo: it's built from the project's live pages
 * (pages-store) and collection entries (CMS store), honors the per-field
 * searchable config, and powers the playground with ranked, highlighted
 * results. Only the infrastructure (Typesense, scoped keys, sync jobs) is
 * simulated.
 */
import { useMemo, useSyncExternalStore } from "react";
import { getPages } from "@/lib/cms/pages-store";
import { getCMSState, useCMSVersion } from "@/lib/cms/store";
import { docToPlainText, type DocValue } from "@/lib/cms/blocks/doc";
import type { SchemaField } from "@/lib/cms/types";

/* ------------------------------------------------------------- config */

export interface SearchConfig {
  enabled: boolean;
  /** Index the project's pages (titles, section copy, meta description). */
  includePages: boolean;
  /** Per-page opt-outs, keyed by page id = true. Lets you index the home
   *  page but exclude the about page, etc. (only applies when includePages). */
  pageOff: Record<string, boolean>;
  /** Collections opted into the index, keyed by collection id. */
  collections: Record<string, boolean>;
  /** Per-field opt-outs, keyed by `${collectionId}.${fieldName}` = false. */
  fieldOff: Record<string, boolean>;
  /** Plan-gated hybrid keyword + semantic mode (adds typo tolerance here). */
  aiSearch: boolean;
  /** Public search-only key (scoped, safe for browsers). */
  publicKey: string;
  enabledAt?: string;
}

export interface SearchQueryLogRow {
  q: string;
  hits: number;
  at: number;
}

interface SearchDb {
  configs: Record<string, SearchConfig>; // by projectId
  logs: Record<string, SearchQueryLogRow[]>; // by projectId, newest first
}

const LS_KEY = "bettercms.search.v1";
let db: SearchDb = { configs: {}, logs: {} };
let version = 0;
const listeners = new Set<() => void>();

function load() {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    if (raw) db = { configs: {}, logs: {}, ...JSON.parse(raw) };
  } catch {
    /* keep defaults */
  }
}
load();

function persist() {
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(db));
  } catch {
    /* storage full or unavailable; in-memory still works */
  }
}
function emit() {
  version++;
  persist();
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function newKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "bcms_search_";
  for (let i = 0; i < 24; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/** Field types that carry searchable text. */
const TEXTY: SchemaField["type"][] = ["text", "richText", "select", "url"];

export function defaultConfig(projectId: string): SearchConfig {
  const s = getCMSState();
  const project = s.projects.find((p) => p.id === projectId);
  const collections: Record<string, boolean> = {};
  for (const cid of project?.collectionIds ?? []) collections[cid] = true;
  return {
    enabled: false,
    includePages: true,
    pageOff: {},
    collections,
    fieldOff: {},
    aiSearch: false,
    publicKey: newKey(),
  };
}

export function getSearchConfig(projectId: string): SearchConfig {
  const stored = db.configs[projectId];
  // Back-fill fields added after a config was first persisted.
  if (stored) return { ...stored, pageOff: stored.pageOff ?? {} };
  return defaultConfig(projectId);
}

export function useSearchConfig(projectId: string): SearchConfig {
  useSyncExternalStore(subscribe, () => version, () => version);
  return getSearchConfig(projectId);
}

export const searchActions = {
  patch(projectId: string, patch: Partial<SearchConfig>) {
    const cur = getSearchConfig(projectId);
    const next = { ...cur, ...patch };
    if (patch.enabled && !cur.enabled) next.enabledAt = new Date().toISOString();
    db.configs = { ...db.configs, [projectId]: next };
    emit();
  },
  setPage(projectId: string, pageId: string, on: boolean) {
    const cur = getSearchConfig(projectId);
    const pageOff = { ...cur.pageOff };
    if (on) delete pageOff[pageId];
    else pageOff[pageId] = true;
    db.configs = { ...db.configs, [projectId]: { ...cur, pageOff } };
    emit();
  },
  setPagesBulk(projectId: string, pageIds: string[], on: boolean) {
    const cur = getSearchConfig(projectId);
    const pageOff = { ...cur.pageOff };
    for (const id of pageIds) {
      if (on) delete pageOff[id];
      else pageOff[id] = true;
    }
    db.configs = { ...db.configs, [projectId]: { ...cur, pageOff } };
    emit();
  },
  setCollection(projectId: string, collectionId: string, on: boolean) {
    const cur = getSearchConfig(projectId);
    db.configs = {
      ...db.configs,
      [projectId]: { ...cur, collections: { ...cur.collections, [collectionId]: on } },
    };
    emit();
  },
  setField(projectId: string, collectionId: string, fieldName: string, on: boolean) {
    const cur = getSearchConfig(projectId);
    const key = `${collectionId}.${fieldName}`;
    const fieldOff = { ...cur.fieldOff };
    if (on) delete fieldOff[key];
    else fieldOff[key] = true;
    db.configs = { ...db.configs, [projectId]: { ...cur, fieldOff } };
    emit();
  },
  regenerateKey(projectId: string) {
    const cur = getSearchConfig(projectId);
    db.configs = { ...db.configs, [projectId]: { ...cur, publicKey: newKey() } };
    emit();
  },
  logQuery(projectId: string, q: string, hits: number) {
    const query = q.trim().toLowerCase();
    if (!query) return;
    const rows = db.logs[projectId] ?? [];
    db.logs = { ...db.logs, [projectId]: [{ q: query, hits, at: Date.now() }, ...rows].slice(0, 500) };
    emit();
  },
};

/** Aggregated playground/search analytics: top queries + no-result queries. */
export function useSearchAnalytics(projectId: string) {
  useSyncExternalStore(subscribe, () => version, () => version);
  const rows = db.logs[projectId] ?? [];
  const byQuery = new Map<string, { q: string; count: number; hits: number; last: number }>();
  for (const r of rows) {
    const cur = byQuery.get(r.q) ?? { q: r.q, count: 0, hits: r.hits, last: r.at };
    cur.count += 1;
    cur.hits = r.hits; // latest result count
    cur.last = Math.max(cur.last, r.at);
    byQuery.set(r.q, cur);
  }
  const all = [...byQuery.values()].sort((a, b) => b.count - a.count || b.last - a.last);
  return {
    total: rows.length,
    top: all.slice(0, 8),
    noResults: all.filter((r) => r.hits === 0).slice(0, 8),
  };
}

/* -------------------------------------------------------------- index */

export interface SearchDoc {
  id: string;
  kind: "page" | "entry";
  title: string;
  /** Where a click should land: page path or collection/entry label. */
  where: string;
  collectionId?: string;
  collectionName?: string;
  /** Flattened searchable text per field (field name → text). */
  fields: Record<string, string>;
}

function flatten(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (typeof value === "object" && (value as DocValue).version === 1 && Array.isArray((value as DocValue).blocks)) {
    return docToPlainText(value as DocValue);
  }
  if (Array.isArray(value)) return value.map(flatten).filter(Boolean).join(" ");
  return "";
}

/** Build the project's live index from pages + entries, honoring config. */
export function useSearchIndex(projectId: string, config: SearchConfig): SearchDoc[] {
  const cmsV = useCMSVersion();
  // pages-store has no version hook; page edits also bump on re-render cycles,
  // and the playground re-runs per keystroke anyway, so cmsV + config suffice.
  return useMemo(() => {
    const docs: SearchDoc[] = [];
    if (config.includePages) {
      for (const p of getPages(projectId)) {
        if (config.pageOff?.[p.id]) continue; // excluded from the index
        const fields: Record<string, string> = { title: p.title, path: p.path };
        if (p.seoDescription) fields.description = p.seoDescription;
        const copy: string[] = [];
        for (const sec of p.sections) for (const v of Object.values(sec.content)) copy.push(flatten(v));
        fields.body = copy.filter(Boolean).join(" ");
        docs.push({ id: `page_${p.id}`, kind: "page", title: p.title, where: p.path, fields });
      }
    }
    const s = getCMSState();
    const project = s.projects.find((pr) => pr.id === projectId);
    for (const cid of project?.collectionIds ?? []) {
      if (!config.collections[cid]) continue;
      const col = s.collections.find((c) => c.id === cid);
      if (!col) continue;
      const schema = s.schemas.find((sc) => sc.id === col.schemaId);
      const searchableFields = (schema?.fields ?? []).filter(
        (f) => TEXTY.includes(f.type) && !config.fieldOff[`${cid}.${f.name}`],
      );
      for (const eid of col.entryIds) {
        const entry = s.entries.find((e) => e.id === eid);
        if (!entry) continue;
        const fields: Record<string, string> = { title: entry.title };
        for (const f of searchableFields) {
          const text = flatten(entry.fields[f.name]);
          if (text) fields[f.name] = text;
        }
        docs.push({
          id: `entry_${entry.id}`,
          kind: "entry",
          title: entry.title,
          where: col.name,
          collectionId: cid,
          collectionName: col.name,
          fields,
        });
      }
    }
    return docs;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, cmsV, config]);
}

/* -------------------------------------------------------------- query */

export interface SearchHit {
  doc: SearchDoc;
  score: number;
  /** Field the best match came from. */
  field: string;
  /** Snippet parts: [before, match, after]. */
  snippet: [string, string, string];
}

function tokenize(q: string): string[] {
  return q.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 0);
}

/** Levenshtein distance capped at 2, for AI-mode typo tolerance. */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 3;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}

/** Rank docs for a query. Weighting: title > named fields > body. */
export function searchDocs(docs: SearchDoc[], query: string, opts?: { fuzzy?: boolean; limit?: number }): SearchHit[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];
  const fuzzy = opts?.fuzzy ?? false;
  const hits: SearchHit[] = [];

  for (const doc of docs) {
    let score = 0;
    let bestField = "";
    let bestPos = -1;
    let bestText = "";
    let matchLen = 0;
    let matchedTokens = 0;

    for (const token of tokens) {
      let tokenMatched = false;
      for (const [field, text] of Object.entries(doc.fields)) {
        const lower = text.toLowerCase();
        const pos = lower.indexOf(token);
        let weight = field === "title" ? 10 : field === "body" ? 2 : 5;
        let found = pos >= 0;
        let foundPos = pos;
        let foundLen = token.length;
        if (!found && fuzzy && token.length >= 4) {
          // typo tolerance: compare against words in the text
          for (const m of lower.matchAll(/[a-z0-9]{3,}/g)) {
            if (editDistance(token, m[0]) <= 1) {
              found = true;
              foundPos = m.index ?? 0;
              foundLen = m[0].length;
              weight = Math.max(1, weight - 1);
              break;
            }
          }
        }
        if (found) {
          tokenMatched = true;
          // earlier matches in titles rank a touch higher
          score += weight + (field === "title" && foundPos === 0 ? 2 : 0);
          if (bestPos < 0 || weight > (bestField === "title" ? 10 : bestField === "body" ? 2 : 5)) {
            bestField = field;
            bestPos = foundPos;
            bestText = text;
            matchLen = foundLen;
          }
        }
      }
      if (tokenMatched) matchedTokens++;
    }

    if (matchedTokens === tokens.length && bestPos >= 0) {
      const start = Math.max(0, bestPos - 44);
      const end = Math.min(bestText.length, bestPos + matchLen + 76);
      hits.push({
        doc,
        score,
        field: bestField,
        snippet: [
          (start > 0 ? "…" : "") + bestText.slice(start, bestPos),
          bestText.slice(bestPos, bestPos + matchLen),
          bestText.slice(bestPos + matchLen, end) + (end < bestText.length ? "…" : ""),
        ],
      });
    }
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, opts?.limit ?? 10);
}
