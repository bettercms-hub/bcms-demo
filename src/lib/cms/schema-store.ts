/**
 * schema-store — the content models behind a project, per project.
 *
 * A model is a named set of fields. Three kinds:
 * - "page":       a routed page type. Can hold a section zone (which sections
 *                 marketers may compose with) plus fixed fields.
 * - "collection": repeatable entries served over the API (posts, authors).
 * - "block":      a reusable group of fields embedded in other models.
 *
 * The visual schema builder and the Schema API write the same shape; this
 * in-memory store stands in for the backend. Fields support nesting through
 * the "group" type; ordering is the array order.
 */
import { useSyncExternalStore } from "react";

export type ModelKind = "page" | "collection" | "block";

export type FieldType =
  | "text"
  | "longtext"
  | "richtext"
  | "slug"
  | "number"
  | "toggle"
  | "date"
  | "image"
  | "file"
  | "link"
  | "email"
  | "phone"
  | "select"
  | "reference"
  | "multireference"
  | "color"
  | "json"
  | "group"
  | "sections";

export interface ModelField {
  id: string;
  label: string;
  apiId: string;
  type: FieldType;
  required?: boolean;
  help?: string;
  /** select */
  options?: string[];
  /** reference + multireference: the collection this points at */
  refModelId?: string;
  /** sections zone: allowed section types (SectionSystem type keys) */
  allowedSections?: string[];
  /** group children */
  fields?: ModelField[];
}

export interface SchemaModel {
  id: string;
  kind: ModelKind;
  name: string;
  apiId: string;
  description?: string;
  fields: ModelField[];
  updatedAt: number;
}

/* ------------------------------------------------------------------ store */

const byProject = new Map<string, SchemaModel[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function ensure(projectId: string): SchemaModel[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed();
    byProject.set(projectId, arr);
  }
  return arr;
}

export function useModels(projectId: string): SchemaModel[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}

let seq = 0;
export function newFieldId() {
  return `fld_${Date.now().toString(36)}${(seq++).toString(36)}`;
}
export function newModelId() {
  return `mdl_${Date.now().toString(36)}${(seq++).toString(36)}`;
}

/** "Meta title" -> "metaTitle" */
export function toApiId(label: string): string {
  const words = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return "field";
  return words[0] + words.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
}

export const modelActions = {
  add(projectId: string, model: SchemaModel) {
    byProject.set(projectId, [...ensure(projectId), model]);
    emit();
  },
  remove(projectId: string, id: string) {
    byProject.set(
      projectId,
      ensure(projectId).filter((m) => m.id !== id),
    );
    emit();
  },
  update(projectId: string, id: string, patch: (m: SchemaModel) => SchemaModel) {
    byProject.set(
      projectId,
      ensure(projectId).map((m) => (m.id === id ? { ...patch(m), updatedAt: Date.now() } : m)),
    );
    emit();
  },
};

/* ------------------------------------------------ immutable field helpers */

export function mapField(fields: ModelField[], id: string, fn: (f: ModelField) => ModelField): ModelField[] {
  return fields.map((f) => {
    if (f.id === id) return fn(f);
    if (f.fields) return { ...f, fields: mapField(f.fields, id, fn) };
    return f;
  });
}
export function removeFieldById(fields: ModelField[], id: string): ModelField[] {
  return fields.filter((f) => f.id !== id).map((f) => (f.fields ? { ...f, fields: removeFieldById(f.fields, id) } : f));
}
/** Insert at the end of the root list, or at the end of a group's children. */
export function insertField(fields: ModelField[], groupId: string | null, field: ModelField): ModelField[] {
  if (!groupId) return [...fields, field];
  return fields.map((f) => {
    if (f.id === groupId) return { ...f, fields: [...(f.fields ?? []), field] };
    if (f.fields) return { ...f, fields: insertField(f.fields, groupId, field) };
    return f;
  });
}
/** Move a field up/down within whichever list contains it. */
export function moveFieldById(fields: ModelField[], id: string, dir: -1 | 1): ModelField[] {
  const i = fields.findIndex((f) => f.id === id);
  if (i >= 0) {
    const j = i + dir;
    if (j < 0 || j >= fields.length) return fields;
    const next = [...fields];
    const [f] = next.splice(i, 1);
    next.splice(j, 0, f);
    return next;
  }
  return fields.map((f) => (f.fields ? { ...f, fields: moveFieldById(f.fields, id, dir) } : f));
}
export function countFields(fields: ModelField[]): number {
  return fields.reduce((n, f) => n + 1 + (f.fields ? countFields(f.fields) : 0), 0);
}
/** Pull a field (and its subtree) out of the tree. */
export function extractFieldById(fields: ModelField[], id: string): { rest: ModelField[]; found?: ModelField } {
  let found: ModelField | undefined;
  const rest = fields
    .filter((f) => {
      if (f.id === id) {
        found = f;
        return false;
      }
      return true;
    })
    .map((f) => {
      if (found || !f.fields) return f;
      const inner = extractFieldById(f.fields, id);
      if (inner.found) found = inner.found;
      return { ...f, fields: inner.rest };
    });
  return { rest, found };
}
/** Insert relative to a target: before/after it, or inside it (append to its group). */
export function insertRelativeTo(fields: ModelField[], targetId: string, pos: "before" | "after" | "inside", field: ModelField): ModelField[] {
  const out: ModelField[] = [];
  for (const f of fields) {
    if (f.id === targetId) {
      if (pos === "before") out.push(field, f);
      else if (pos === "after") out.push(f, field);
      else out.push({ ...f, fields: [...(f.fields ?? []), field] });
      continue;
    }
    out.push(f.fields ? { ...f, fields: insertRelativeTo(f.fields, targetId, pos, field) } : f);
  }
  return out;
}
/** Is `id` inside this field's subtree (used to block dropping a group into itself)? */
export function isDescendant(field: ModelField, id: string): boolean {
  return (field.fields ?? []).some((c) => c.id === id || isDescendant(c, id));
}
/** Deep copy with fresh ids, for duplicate. */
export function cloneFieldDeep(f: ModelField): ModelField {
  return {
    ...f,
    id: newFieldId(),
    options: f.options ? [...f.options] : undefined,
    allowedSections: f.allowedSections ? [...f.allowedSections] : undefined,
    fields: f.fields ? f.fields.map(cloneFieldDeep) : undefined,
  };
}

/* ------------------------------------------------------------------- seed */

export function makeField(label: string, type: FieldType, extra: Partial<ModelField> = {}): ModelField {
  return { id: newFieldId(), label, apiId: toApiId(label), type, ...extra };
}
const f = makeField;

/* -------------------------------------------------------- schema templates */

export interface SchemaTemplate {
  id: string;
  name: string;
  blurb: string;
  kind: ModelKind;
  make: () => ModelField[];
}

/** Ready-made model shapes shown on the New model page. */
export const SCHEMA_TEMPLATES: SchemaTemplate[] = [
  {
    id: "blog",
    name: "Blog post",
    blurb: "Articles with author, cover and SEO",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Cover", "image"),
      f("Excerpt", "longtext"),
      f("Body", "richtext"),
      f("Published", "toggle"),
      f("SEO", "group", { fields: [f("Meta title", "text"), f("Meta description", "longtext")] }),
    ],
  },
  {
    id: "testimonial",
    name: "Testimonial",
    blurb: "Customer quotes with attribution",
    kind: "collection",
    make: () => [
      f("Quote", "longtext", { required: true }),
      f("Author name", "text", { required: true }),
      f("Author role", "text"),
      f("Company", "text"),
      f("Avatar", "image"),
      f("Rating", "number", { help: "1 to 5" }),
    ],
  },
  {
    id: "author",
    name: "Author",
    blurb: "People who write on the site",
    kind: "collection",
    make: () => [
      f("Name", "text", { required: true }),
      f("Role", "text"),
      f("Avatar", "image"),
      f("Bio", "longtext"),
      f("Email", "email"),
      f("Website", "link"),
    ],
  },
  {
    id: "case-study",
    name: "Case study",
    blurb: "Customer stories with results",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Client", "text"),
      f("Industry", "select", { options: ["SaaS", "Fintech", "Ecommerce", "Healthcare"] }),
      f("Hero image", "image"),
      f("Challenge", "richtext"),
      f("Results", "richtext"),
      f("Metrics", "group", { fields: [f("Stat 1", "text"), f("Stat 2", "text"), f("Stat 3", "text")] }),
      f("Published", "toggle"),
    ],
  },
  {
    id: "glossary",
    name: "Glossary term",
    blurb: "Definitions that build topical authority",
    kind: "collection",
    make: () => [
      f("Term", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Definition", "richtext"),
      f("Synonyms", "text", { help: "Comma separated" }),
    ],
  },
  {
    id: "whitepaper",
    name: "White paper",
    blurb: "Gated reports with a PDF asset",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Cover", "image"),
      f("Summary", "longtext"),
      f("PDF", "file", { required: true }),
      f("Gated", "toggle", { help: "Require a form before download" }),
      f("Topics", "select", { options: ["Content operations", "SEO", "Design systems"] }),
    ],
  },
];

function seed(): SchemaModel[] {
  const author: SchemaModel = {
    id: newModelId(),
    kind: "collection",
    name: "Author",
    apiId: "author",
    description: "People who write on the blog.",
    updatedAt: Date.now(),
    fields: [
      f("Name", "text", { required: true }),
      f("Role", "text"),
      f("Avatar", "image"),
      f("Bio", "longtext"),
    ],
  };
  const category: SchemaModel = {
    id: newModelId(),
    kind: "collection",
    name: "Category",
    apiId: "category",
    description: "Topic buckets used to group posts.",
    updatedAt: Date.now(),
    fields: [f("Name", "text", { required: true }), f("Slug", "slug", { required: true }), f("Description", "longtext")],
  };
  const post: SchemaModel = {
    id: newModelId(),
    kind: "collection",
    name: "Blog post",
    apiId: "blogPost",
    description: "Articles served over the content API.",
    updatedAt: Date.now(),
    fields: [
      f("Title", "text", { required: true }),
      f("Slug", "text", { required: true, help: "URL segment, lowercase, hyphenated." }),
      f("Cover", "image"),
      f("Body", "richtext"),
      f("Author", "reference", { refModelId: author.id, help: "Points at one author." }),
      f("Categories", "multireference", { refModelId: category.id, help: "Editors can link more than one category." }),
      f("Published", "toggle"),
      f("SEO", "group", {
        fields: [f("Meta title", "text"), f("Meta description", "longtext")],
      }),
    ],
  };
  const page: SchemaModel = {
    id: newModelId(),
    kind: "page",
    name: "Marketing page",
    apiId: "marketingPage",
    description: "The default page type marketers compose from sections.",
    updatedAt: Date.now(),
    fields: [
      f("Title", "text", { required: true }),
      f("Path", "text", { required: true, help: "Route of the page, like /pricing." }),
      f("Sections", "sections", {
        help: "Which sections marketers can add to this page.",
        allowedSections: ["hero", "features", "logos", "testimonial", "cta", "pricing", "faq", "contact"],
      }),
      f("SEO", "group", {
        fields: [f("Meta title", "text"), f("Meta description", "longtext"), f("No index", "toggle")],
      }),
    ],
  };
  const cta: SchemaModel = {
    id: newModelId(),
    kind: "block",
    name: "Call to action",
    apiId: "callToAction",
    description: "A reusable conversion block.",
    updatedAt: Date.now(),
    fields: [f("Heading", "text", { required: true }), f("Button label", "text"), f("Button link", "link")],
  };
  return [page, post, author, category, cta];
}
