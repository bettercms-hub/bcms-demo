/**
 * doc-clipboard — Copy document / Paste document for collection entries.
 *
 * Copying serializes the entry (title + fields + source schema) into an
 * in-app clipboard so Paste works across collections: fields are matched
 * by name against the target schema and anything that doesn't fit is
 * reported rather than silently dropped. A JSON copy also lands on the
 * system clipboard for interop.
 */
import { useSyncExternalStore } from "react";
import { getCMSState } from "./store";
import type { Entry } from "./types";

export interface CopiedDoc {
  sourceEntryId: string;
  sourceCollectionId: string;
  sourceCollectionName: string;
  title: string;
  fields: Record<string, unknown>;
  copiedAt: number;
}

let doc: CopiedDoc | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCopiedDoc(): CopiedDoc | null {
  return useSyncExternalStore(subscribe, () => doc, () => null);
}

export function getCopiedDoc(): CopiedDoc | null {
  return doc;
}

export function copyDocument(entry: Entry): CopiedDoc {
  const s = getCMSState();
  const col = s.collections.find((c) => c.id === entry.collectionId);
  doc = {
    sourceEntryId: entry.id,
    sourceCollectionId: entry.collectionId,
    sourceCollectionName: col?.name ?? "Collection",
    title: entry.title,
    fields: structuredClone(entry.fields),
    copiedAt: Date.now(),
  };
  // Best-effort system-clipboard copy for interop; the in-app doc drives Paste.
  try {
    void navigator.clipboard?.writeText(JSON.stringify({ _bettercms: "document", title: doc.title, fields: doc.fields }, null, 2));
  } catch {
    /* clipboard unavailable */
  }
  emit();
  return doc;
}

export function clearCopiedDoc() {
  doc = null;
  emit();
}
