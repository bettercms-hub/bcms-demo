/** Reference-resolution helpers shared by EntryView, CollectionView, and pickers. */
import type { Entry, Schema } from "./types";
import { select } from "./store";

export function resolveReference(entryId: unknown): Entry | undefined {
  if (typeof entryId !== "string" || !entryId) return undefined;
  return select.entry(entryId);
}

export function resolveMultiReference(ids: unknown): Entry[] {
  if (!Array.isArray(ids)) return [];
  return ids
    .map((id) => (typeof id === "string" ? select.entry(id) : undefined))
    .filter((e): e is Entry => !!e);
}

/** Pick the display title for an entry, preferring the schema's titleFieldName. */
export function getReferenceLabel(entry: Entry, schema?: Schema): string {
  if (schema?.titleFieldName) {
    const v = entry.fields[schema.titleFieldName];
    if (typeof v === "string" && v.trim()) return v;
  }
  return entry.title;
}

export function findEntriesByCollection(collectionId: string): Entry[] {
  return select.entriesForCollection(collectionId);
}
