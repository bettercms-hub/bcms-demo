/** Draft-vs-published snapshot helpers (mock layer). */
import type {
  Entry,
  EntryPublishedSnapshot,
  Page,
  PagePublishedSnapshot,
  Section,
} from "./types";

export interface PageDiff {
  /** Section ids that exist in both but differ. */
  changedIds: Set<string>;
  /** Section ids present in draft but not snapshot. */
  addedIds: Set<string>;
  /** Section ids present in snapshot but not draft. */
  removedIds: Set<string>;
  /** True if the same set of section ids exists in a different order. */
  orderChanged: boolean;
}

export interface EntryDiff {
  changedFields: Set<string>;
}

export function diffPage(
  draft: { sections: Section[] },
  snapshot: { sections: Section[] } | null | undefined,
): PageDiff {
  const empty: PageDiff = {
    changedIds: new Set(),
    addedIds: new Set(),
    removedIds: new Set(),
    orderChanged: false,
  };
  if (!snapshot) {
    return { ...empty, addedIds: new Set(draft.sections.map((s) => s.id)) };
  }
  const draftMap = new Map(draft.sections.map((s) => [s.id, s]));
  const snapMap = new Map(snapshot.sections.map((s) => [s.id, s]));
  const changedIds = new Set<string>();
  const addedIds = new Set<string>();
  const removedIds = new Set<string>();
  for (const [id, d] of draftMap) {
    const s = snapMap.get(id);
    if (!s) {
      addedIds.add(id);
      continue;
    }
    if (
      s.kind !== d.kind ||
      JSON.stringify(s.props) !== JSON.stringify(d.props) ||
      JSON.stringify(s.blocks ?? []) !== JSON.stringify(d.blocks ?? []) ||
      JSON.stringify(s.overrides ?? {}) !== JSON.stringify(d.overrides ?? {}) ||
      s.name !== d.name
    ) {
      changedIds.add(id);
    }
  }
  for (const id of snapMap.keys()) if (!draftMap.has(id)) removedIds.add(id);
  let orderChanged = false;
  if (addedIds.size === 0 && removedIds.size === 0) {
    const a = draft.sections.map((s) => s.id);
    const b = snapshot.sections.map((s) => s.id);
    orderChanged = a.length === b.length && a.some((id, i) => id !== b[i]);
  }
  return { changedIds, addedIds, removedIds, orderChanged };
}

export function diffEntry(
  draft: { fields: Record<string, unknown> },
  snapshot: { entry: { fields: Record<string, unknown> } } | null | undefined,
): EntryDiff {
  if (!snapshot) {
    return { changedFields: new Set(Object.keys(draft.fields)) };
  }
  const out = new Set<string>();
  const a = draft.fields;
  const b = snapshot.entry.fields;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) out.add(k);
  }
  return { changedFields: out };
}

export function summarizeDiff(diff: PageDiff | EntryDiff | null | undefined): string {
  if (!diff) return "";
  if ("changedFields" in diff) {
    const n = diff.changedFields.size;
    return n === 0 ? "No changes since last publish" : `${n} field${n === 1 ? "" : "s"} changed`;
  }
  const parts: string[] = [];
  if (diff.changedIds.size) parts.push(`${diff.changedIds.size} changed`);
  if (diff.addedIds.size) parts.push(`${diff.addedIds.size} added`);
  if (diff.removedIds.size) parts.push(`${diff.removedIds.size} removed`);
  if (diff.orderChanged) parts.push("reordered");
  return parts.length === 0 ? "No changes since last publish" : parts.join(" · ");
}

export function pageDiffCount(diff: PageDiff | null | undefined): number {
  if (!diff) return 0;
  return diff.changedIds.size + diff.addedIds.size + diff.removedIds.size + (diff.orderChanged ? 1 : 0);
}

/** Build a fresh page snapshot from current data (used by publishNode). */
export function buildPageSnapshot(page: Page, sections: Section[]): PagePublishedSnapshot {
  const { publishedSnapshot: _ignore, ...pageCore } = page;
  void _ignore;
  return {
    capturedAt: new Date().toISOString(),
    page: pageCore,
    sections: sections.map(({ publishedSnapshot: _s, ...rest }) => {
      void _s;
      return rest as Section;
    }),
  };
}

export function buildEntrySnapshot(entry: Entry): EntryPublishedSnapshot {
  const { publishedSnapshot: _ignore, ...entryCore } = entry;
  void _ignore;
  return { capturedAt: new Date().toISOString(), entry: entryCore };
}

export function relativeTime(iso?: string): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}
