/**
 * change-set — group a run's flat proposals into per-document change cards
 * and build a live preview of each target with the changed fields resolved.
 *
 * The runs store keeps proposals flat (one before→after per field). The
 * review UI wants them grouped the way a person thinks: "these 3 documents
 * change, here is each one with the exact field diff." This module is the
 * pure bridge — no React, reads live page/entry state so the preview shows
 * the document as it really is, with the agent's edits overlaid.
 */
import { getPages } from "@/lib/cms/pages-store";
import { getCMSState } from "@/lib/cms/store";
import { getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import type { AgentRun, ProposedChange } from "./types";

export type ChangeDocKind = "entry" | "page" | "newEntry";

export interface ChangeDoc {
  key: string;
  kind: ChangeDocKind;
  targetType: "page" | "entry";
  /** entryId | page path | collectionId (for a new entry). */
  docId: string;
  /** The document's own name, e.g. "Satellites" or "Home". */
  label: string;
  /** Where it lives, e.g. the collection name or the page path. */
  context?: string;
  changes: ProposedChange[];
}

/** Group a run's proposals into the documents they touch, first-seen order. */
export function groupChanges(run: AgentRun): ChangeDoc[] {
  const order: string[] = [];
  const byKey = new Map<string, ChangeDoc>();

  for (const p of run.proposals) {
    let key: string;
    let kind: ChangeDocKind;
    if (p.operation === "entry.patch") {
      key = `entry:${p.targetId}`;
      kind = "entry";
    } else if (p.operation === "content.generate" || p.operation === "content.patch") {
      key = `newentry:${p.targetId}`;
      kind = "newEntry";
    } else {
      key = `page:${p.targetId}`;
      kind = "page";
    }

    let doc = byKey.get(key);
    if (!doc) {
      const [head, tail] = p.targetLabel.split(" / ");
      doc = {
        key,
        kind,
        targetType: p.targetType,
        docId: p.targetId,
        label: kind === "page" ? p.targetLabel : (tail ?? head),
        context: kind === "page" ? p.targetId : tail ? head : undefined,
        changes: [],
      };
      byKey.set(key, doc);
      order.push(key);
    }
    doc.changes.push(p);
  }

  return order.map((k) => byKey.get(k)!);
}

/** A document is accepted when every open change under it is accepted. */
export function docAccepted(doc: ChangeDoc): boolean {
  return (
    doc.changes.some((c) => c.status === "accepted" || c.status === "applied") &&
    doc.changes.every((c) => c.status === "accepted" || c.status === "applied")
  );
}

export function docApplied(doc: ChangeDoc): boolean {
  return doc.changes.every((c) => c.status === "applied");
}

/* --------------------------------------------------------------- preview */

export interface PreviewField {
  id: string;
  label: string;
  /** Section type or field area, e.g. "Hero section". */
  context?: string;
  before?: string;
  after: string;
  changed: boolean;
  added: boolean;
  multiline: boolean;
  status: ProposedChange["status"];
}

export interface DocPreview {
  kind: ChangeDocKind;
  title: string;
  typeLabel: string;
  meta: string[];
  fields: PreviewField[];
}

function humanize(key: string): string {
  const map: Record<string, string> = {
    title: "Title",
    seoTitle: "Meta title",
    seoDescription: "Meta description",
    body: "Body",
    excerpt: "Excerpt",
    slug: "Slug",
    bio: "Bio",
    name: "Name",
  };
  if (map[key]) return map[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());
}

function isMultiline(s: string): boolean {
  return s.length > 90 || s.includes("\n") || /<\/?(p|br|ul|li|h[1-6])/i.test(s);
}

/** Build the live preview for one document: what it looks like with the edits. */
export function buildDocPreview(run: AgentRun, doc: ChangeDoc): DocPreview {
  const s = getCMSState();

  if (doc.kind === "page") {
    const page = getPages(run.projectId).find((p) => p.path === doc.docId);
    const fields: PreviewField[] = doc.changes.map((c) => {
      let label = humanize(c.fieldPath ?? "");
      let context: string | undefined;
      if (c.operation === "page.section" && c.fieldPath) {
        const [sectionId, key] = [c.fieldPath.slice(0, c.fieldPath.indexOf(".")), c.fieldPath.slice(c.fieldPath.indexOf(".") + 1)];
        label = humanize(key);
        const sec = page?.sections.find((x) => x.id === sectionId);
        context = sec ? `${getSectionDef(sec.type)?.name ?? sec.type} section` : "Section";
      }
      return {
        id: c.id,
        label,
        context,
        before: c.before,
        after: c.after,
        changed: (c.before ?? "") !== "",
        added: !c.before,
        multiline: isMultiline(c.after),
        status: c.status,
      };
    });
    return {
      kind: "page",
      title: page?.title ?? doc.label,
      typeLabel: "Page",
      meta: [doc.docId, `${page?.sections.length ?? 0} sections`, page?.state ?? "draft"],
      fields,
    };
  }

  if (doc.kind === "newEntry") {
    const col = s.collections.find((c) => c.id === doc.docId);
    const gen = doc.changes.find((c) => c.operation === "content.generate");
    const fields: PreviewField[] = doc.changes
      .filter((c) => c.operation === "content.patch")
      .map((c) => ({
        id: c.id,
        label: humanize(c.fieldPath ?? ""),
        before: undefined,
        after: c.after,
        changed: false,
        added: true,
        multiline: isMultiline(c.after),
        status: c.status,
      }));
    return {
      kind: "newEntry",
      title: gen?.after ?? doc.label,
      typeLabel: "New entry",
      meta: [col?.name ?? "Collection", "New draft"],
      fields,
    };
  }

  // Existing entry
  const entry = s.entries.find((e) => e.id === doc.docId);
  const col = s.collections.find((c) => c.id === entry?.collectionId);
  const fields: PreviewField[] = doc.changes.map((c) => ({
    id: c.id,
    label: humanize(c.fieldPath ?? ""),
    before: c.before,
    after: c.after,
    changed: (c.before ?? "") !== "",
    added: !c.before,
    multiline: isMultiline(c.after),
    status: c.status,
  }));
  return {
    kind: "entry",
    title: entry?.title ?? doc.label,
    typeLabel: "Entry",
    meta: [col?.name ?? doc.context ?? "Collection", entry?.status ?? "draft"],
    fields,
  };
}

/* ------------------------------------------------------- inline diff */

export interface DiffPart {
  text: string;
  changed: boolean;
}

/**
 * Character-level diff of a single before→after value: common prefix and
 * suffix stay plain, the middle is the change. Good enough to spotlight
 * exactly what a rename touched inside a longer field.
 */
export function diffParts(before: string, after: string): { before: DiffPart[]; after: DiffPart[] } {
  if (!before) return { before: [], after: [{ text: after, changed: true }] };
  let p = 0;
  const max = Math.min(before.length, after.length);
  while (p < max && before[p] === after[p]) p++;
  let suf = 0;
  while (suf < before.length - p && suf < after.length - p && before[before.length - 1 - suf] === after[after.length - 1 - suf]) suf++;
  const bMid = before.slice(p, before.length - suf);
  const aMid = after.slice(p, after.length - suf);
  const pre = after.slice(0, p);
  const post = after.slice(after.length - suf);
  const mk = (mid: string): DiffPart[] =>
    [
      pre && { text: pre, changed: false },
      mid && { text: mid, changed: true },
      post && { text: post, changed: false },
    ].filter(Boolean) as DiffPart[];
  return { before: mk(bMid), after: mk(aMid) };
}
