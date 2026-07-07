/**
 * Schema-workspace history + baseline diff.
 *
 * Observes the current schema's structural slices (fields + groups) and
 * maintains:
 *
 *   - an undo / redo stack (capped at 50 entries) of full snapshots,
 *   - a "baseline" snapshot (the last "saved" state) used to compute
 *     a coarse diff for the unsaved-changes bar.
 *
 * Snapshots are deep-cloned via `structuredClone` so later in-place
 * mutations elsewhere can never corrupt history entries.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { schemaActions, useCMS } from "@/lib/cms/store";
import type { SchemaField, SchemaFieldGroup } from "@/lib/cms/types";

export interface SchemaSnap {
  fields: SchemaField[];
  groups: SchemaFieldGroup[] | undefined;
}

export interface SchemaDiff {
  added: number;
  removed: number;
  modified: number;
  groupsChanged: boolean;
  total: number;
}

const MAX = 50;

function clone(snap: SchemaSnap): SchemaSnap {
  return {
    fields: structuredClone(snap.fields),
    groups: snap.groups ? structuredClone(snap.groups) : undefined,
  };
}

function keyOf(snap: SchemaSnap): string {
  return JSON.stringify({ f: snap.fields, g: snap.groups ?? null });
}

function diff(base: SchemaSnap | null, cur: SchemaSnap): SchemaDiff {
  if (!base) return { added: 0, removed: 0, modified: 0, groupsChanged: false, total: 0 };
  const byId = new Map(base.fields.map((f) => [f.id, f] as const));
  let added = 0;
  let modified = 0;
  for (const f of cur.fields) {
    const prev = byId.get(f.id);
    if (!prev) added++;
    else if (JSON.stringify(prev) !== JSON.stringify(f)) modified++;
    byId.delete(f.id);
  }
  const removed = byId.size;
  const groupsChanged =
    JSON.stringify(base.groups ?? null) !== JSON.stringify(cur.groups ?? null);
  return {
    added,
    removed,
    modified,
    groupsChanged,
    total: added + removed + modified + (groupsChanged ? 1 : 0),
  };
}

export function useSchemaHistory(schemaId: string) {
  const schema = useCMS((s) => s.schemas.find((sc) => sc.id === schemaId));

  const past = useRef<SchemaSnap[]>([]);
  const future = useRef<SchemaSnap[]>([]);
  const suppress = useRef(false);
  const lastKey = useRef<string>("");
  const lastSnap = useRef<SchemaSnap | null>(null);

  const [baseline, setBaseline] = useState<SchemaSnap | null>(null);
  const [, bump] = useState(0);
  const tick = useCallback(() => bump((n) => n + 1), []);

  useEffect(() => {
    if (!schema) return;
    const snap: SchemaSnap = { fields: schema.fields, groups: schema.groups };
    const key = keyOf(snap);
    if (!baseline) {
      const seed = clone(snap);
      setBaseline(seed);
      lastSnap.current = seed;
      lastKey.current = key;
      return;
    }
    if (key === lastKey.current) return;
    if (suppress.current) {
      suppress.current = false;
      lastSnap.current = clone(snap);
      lastKey.current = key;
      tick();
      return;
    }
    if (lastSnap.current) {
      past.current.push(lastSnap.current);
      if (past.current.length > MAX) past.current.shift();
    }
    future.current = [];
    lastSnap.current = clone(snap);
    lastKey.current = key;
    tick();
  }, [schema, baseline, tick]);

  const apply = useCallback(
    (snap: SchemaSnap) => {
      suppress.current = true;
      schemaActions.replaceSchema(schemaId, structuredClone(snap.fields), snap.groups ? structuredClone(snap.groups) : undefined);
    },
    [schemaId],
  );

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev || !lastSnap.current) return;
    future.current.push(lastSnap.current);
    apply(prev);
  }, [apply]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next || !lastSnap.current) return;
    past.current.push(lastSnap.current);
    apply(next);
  }, [apply]);

  const discard = useCallback(() => {
    if (!baseline) return;
    if (lastSnap.current) past.current.push(lastSnap.current);
    future.current = [];
    apply(baseline);
  }, [apply, baseline]);

  const markSaved = useCallback(() => {
    if (!lastSnap.current) return;
    setBaseline(clone(lastSnap.current));
    tick();
  }, [tick]);

  const current: SchemaSnap = useMemo(
    () =>
      schema
        ? { fields: schema.fields, groups: schema.groups }
        : { fields: [], groups: undefined },
    [schema],
  );

  const dirty = useMemo(() => diff(baseline, current), [baseline, current]);

  return {
    canUndo: past.current.length > 0,
    canRedo: future.current.length > 0,
    undo,
    redo,
    discard,
    markSaved,
    dirty,
    isDirty: dirty.total > 0,
  };
}
