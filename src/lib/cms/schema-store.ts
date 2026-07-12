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
  | "sections"
  | "faq"
  | "schema"
  | "embed";

export interface ModelField {
  id: string;
  label: string;
  apiId: string;
  type: FieldType;
  required?: boolean;
  /** Include this field in site search (see SEARCH_PLAN.md). */
  searchable?: boolean;
  help?: string;
  /** select */
  options?: string[];
  /** reference + multireference: the collection this points at */
  refModelId?: string;
  /** sections zone: allowed section types (SectionSystem type keys) */
  allowedSections?: string[];
  /** group children */
  fields?: ModelField[];
  /** faq: auto-emit FAQPage JSON-LD from the questions (on by default) */
  emitFaqSchema?: boolean;
  /** faq: sample/default question-answer pairs (the field is repeatable) */
  faqItems?: FaqItem[];
  /** schema: the schema.org @type to generate, or "Custom" for pasted JSON-LD */
  schemaType?: string;
  /** schema: raw JSON-LD when schemaType is "Custom" */
  schemaCustom?: string;
  /** image: fall back to the entry's main image when no custom image is set */
  ogFallback?: boolean;
  /** link (canonical): default to the page's own URL unless overridden */
  useSiteDefault?: boolean;
}

/** A schema.org type the structured-data field can generate, with the model
 *  fields it maps each property from (shown so authors see it is automatic). */
export interface SchemaTypeDef {
  type: string;
  label: string;
  props: { name: string; from: string }[];
}

/** The structured-data types offered in the schema-markup picker. The `from`
 *  labels are the typical field each property is populated from per entry. */
export const SCHEMA_TYPES: SchemaTypeDef[] = [
  {
    type: "BlogPosting",
    label: "Blog posting",
    props: [
      { name: "headline", from: "Title" },
      { name: "image", from: "Cover" },
      { name: "author", from: "Author" },
      { name: "datePublished", from: "Published at" },
      { name: "description", from: "Excerpt" },
    ],
  },
  {
    type: "Article",
    label: "Article",
    props: [
      { name: "headline", from: "Title" },
      { name: "image", from: "Cover" },
      { name: "author", from: "Author" },
      { name: "datePublished", from: "Published at" },
    ],
  },
  {
    type: "NewsArticle",
    label: "News article",
    props: [
      { name: "headline", from: "Title" },
      { name: "image", from: "Cover" },
      { name: "datePublished", from: "Published at" },
    ],
  },
  {
    type: "Product",
    label: "Product",
    props: [
      { name: "name", from: "Name" },
      { name: "image", from: "Featured image" },
      { name: "description", from: "Description" },
      { name: "offers.price", from: "Price" },
      { name: "sku", from: "SKU" },
    ],
  },
  {
    type: "Recipe",
    label: "Recipe",
    props: [
      { name: "name", from: "Title" },
      { name: "image", from: "Photo" },
      { name: "recipeIngredient", from: "Ingredients" },
      { name: "recipeInstructions", from: "Instructions" },
      { name: "totalTime", from: "Cook time" },
    ],
  },
  {
    type: "Event",
    label: "Event",
    props: [
      { name: "name", from: "Name" },
      { name: "startDate", from: "Starts at" },
      { name: "endDate", from: "Ends at" },
      { name: "location", from: "Location" },
    ],
  },
  {
    type: "Course",
    label: "Course",
    props: [
      { name: "name", from: "Title" },
      { name: "description", from: "Description" },
      { name: "provider", from: "Instructor" },
    ],
  },
  {
    type: "VideoObject",
    label: "Video",
    props: [
      { name: "name", from: "Title" },
      { name: "thumbnailUrl", from: "Thumbnail" },
      { name: "contentUrl", from: "Video URL" },
      { name: "uploadDate", from: "Published at" },
    ],
  },
  {
    type: "Organization",
    label: "Organization",
    props: [
      { name: "name", from: "Name" },
      { name: "logo", from: "Logo" },
      { name: "url", from: "Website" },
    ],
  },
  {
    type: "Person",
    label: "Person",
    props: [
      { name: "name", from: "Name" },
      { name: "image", from: "Avatar" },
      { name: "jobTitle", from: "Role" },
    ],
  },
];

/** A single question-and-answer pair inside a `faq` field. */
export interface FaqItem {
  q: string;
  a: string;
}

/**
 * Build valid FAQPage JSON-LD from a list of question/answer pairs. This is the
 * automation behind the FAQ field: marketers author the questions, and the CMS
 * emits Google-ready structured data (rich results) with zero hand-written schema.
 */
export function faqPageJsonLd(items: FaqItem[]): string {
  const clean = items.filter((i) => i.q.trim());
  return JSON.stringify(
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: clean.map((i) => ({
        "@type": "Question",
        name: i.q.trim(),
        acceptedAnswer: { "@type": "Answer", text: i.a.trim() },
      })),
    },
    null,
    2,
  );
}

/** Demo question/answer pairs so a new FAQ field renders something real. */
export const SAMPLE_FAQ: FaqItem[] = [
  {
    q: "How does BetterCMS handle FAQ schema?",
    a: "Add a FAQ field and we generate valid FAQPage JSON-LD from your questions automatically, no hand-written markup.",
  },
  {
    q: "Can I write answers with rich text?",
    a: "Yes. Each answer supports formatting, and the schema uses its plain text so Google always gets clean data.",
  },
];

/**
 * A strong, reusable SEO field group: titles, canonical, an OG image picked from
 * the media library, and a JSON-LD escape hatch. Shared by templates + seeds so
 * every model gets the same solid SEO surface.
 */
export function seoFields(opts: { index?: boolean; schemaType?: string } = {}): ModelField[] {
  const out = [
    f("Meta title", "text", { help: "Around 60 characters" }),
    f("Meta description", "longtext", { help: "Around 155 characters" }),
    f("Canonical URL", "link", { useSiteDefault: true, help: "Defaults to this page's own URL" }),
    f("OG image", "image", { ogFallback: true, help: "The social share image" }),
    f("Schema markup", "schema", { schemaType: opts.schemaType, help: "Structured data for rich results" }),
  ];
  if (opts.index) out.push(f("No index", "toggle", { help: "Hide this page from search engines" }));
  return out;
}

/* --------------------------------------------------------- searchability */

/** Field types whose content can be indexed for site search (so the toggle is
 *  worth showing). Binary/structural types carry no searchable text. */
const SEARCHABLE_TYPES = new Set<FieldType>([
  "text", "longtext", "richtext", "slug", "email", "phone", "number", "date",
  "select", "link", "reference", "multireference", "faq", "json", "schema", "embed",
]);
/** Code/structured types default to NOT searchable — indexing raw JSON or an
 *  embed snippet is noise. Everything else defaults to searchable ON. */
const NON_SEARCHABLE_BY_DEFAULT = new Set<FieldType>(["json", "schema", "embed"]);

/** Whether the Searchable toggle should be offered for this field type. */
export function isSearchableEligible(type: FieldType): boolean {
  return SEARCHABLE_TYPES.has(type);
}
/** The default Searchable state for a field type when the author hasn't set one:
 *  ON for real content, OFF for code (JSON / schema / embed). */
export function defaultSearchable(type: FieldType): boolean {
  return SEARCHABLE_TYPES.has(type) && !NON_SEARCHABLE_BY_DEFAULT.has(type);
}
/** Effective searchable value: the author's explicit choice, else the default. */
export function fieldSearchable(field: ModelField): boolean {
  return field.searchable ?? defaultSearchable(field.type);
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
      f("SEO", "group", { fields: seoFields() }),
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
  {
    id: "product",
    name: "Product",
    blurb: "Catalog items with price and stock",
    kind: "collection",
    make: () => [
      f("Name", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Tagline", "text"),
      f("Description", "richtext"),
      f("Featured image", "image"),
      f("Price", "number"),
      f("Currency", "select", { options: ["USD", "EUR", "GBP", "INR", "AUD", "CAD"] }),
      f("Compare at price", "number", { help: "Original price, for a strikethrough" }),
      f("SKU", "text"),
      f("In stock", "toggle"),
      f("Categories", "text", { help: "Comma separated" }),
      f("Specifications", "json", { help: "Open key and value pairs" }),
      f("SEO", "group", { fields: seoFields() }),
    ],
  },
  {
    id: "job",
    name: "Job posting",
    blurb: "Open roles with details and apply link",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Department", "select", {
        options: ["Engineering", "Design", "Product", "Marketing", "Sales", "Operations", "People", "Finance"],
      }),
      f("Location", "text"),
      f("Remote", "toggle"),
      f("Employment type", "select", { options: ["Full time", "Part time", "Contract", "Internship", "Temporary"] }),
      f("Seniority", "select", { options: ["Intern", "Junior", "Mid", "Senior", "Lead", "Staff", "Principal"] }),
      f("Description", "richtext"),
      f("Responsibilities", "richtext", { help: "One per line" }),
      f("Requirements", "richtext", { help: "One per line" }),
      f("Salary range", "group", {
        fields: [f("Minimum", "number"), f("Maximum", "number"), f("Currency", "select", { options: ["USD", "EUR", "GBP", "INR"] })],
      }),
      f("Apply link", "link"),
      f("Open", "toggle", { help: "Show while the role is accepting applicants" }),
    ],
  },
  {
    id: "event",
    name: "Event",
    blurb: "Conferences, meetups and sessions",
    kind: "collection",
    make: () => [
      f("Name", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Summary", "longtext"),
      f("Description", "richtext"),
      f("Cover", "image"),
      f("Starts at", "date", { required: true }),
      f("Ends at", "date"),
      f("Timezone", "text", { help: "Like Europe/London" }),
      f("Online", "toggle"),
      f("Location", "group", {
        fields: [f("Venue", "text"), f("Address", "text"), f("City", "text"), f("Country", "text")],
      }),
      f("Host", "text"),
      f("Capacity", "number"),
      f("Price", "number", { help: "Leave empty for free events" }),
      f("Registration link", "link"),
    ],
  },
  {
    id: "documentation",
    name: "Documentation",
    blurb: "Flexible guides, tutorials and references",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Category", "select", { options: ["Getting started", "Guides", "Tutorials", "Reference", "FAQ", "Release notes"] }),
      f("Summary", "longtext"),
      f("Body", "richtext"),
      f("Version", "text", { help: "Docs version this applies to, like 2.1" }),
      f("Order", "number", { help: "Sort order in the sidebar" }),
      f("Related", "multireference", { help: "Link to sibling docs" }),
      f("Metadata", "json", { help: "Open field for anything the page needs" }),
      f("Last reviewed", "date"),
      f("FAQ", "faq", { help: "Common questions, auto-emitted as FAQ schema", emitFaqSchema: true, faqItems: SAMPLE_FAQ }),
      f("SEO", "group", { fields: seoFields() }),
    ],
  },
  {
    id: "api-reference",
    name: "API reference",
    blurb: "Endpoint docs with parameters and samples",
    kind: "collection",
    make: () => [
      f("Name", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Summary", "longtext"),
      f("HTTP method", "select", { options: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] }),
      f("Path", "text", { help: "Endpoint path, like /v1/orders/{id}" }),
      f("Description", "richtext"),
      f("Authentication", "select", { options: ["None", "API key", "Bearer token", "OAuth 2.0", "Basic"] }),
      f("Path parameters", "richtext", { help: "One per line: name, type, description" }),
      f("Query parameters", "richtext", { help: "One per line: name, type, description" }),
      f("Request body", "json", { help: "Example request payload" }),
      f("Responses", "richtext", { help: "Status codes and response shapes" }),
      f("Code samples", "richtext", { help: "cURL, JavaScript, Python and more" }),
      f("Rate limit", "text"),
      f("Version", "text"),
      f("Deprecated", "toggle"),
    ],
  },
  {
    id: "course",
    name: "Course",
    blurb: "Lessons, curriculum and enrollment",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Subtitle", "text"),
      f("Description", "richtext"),
      f("Cover", "image"),
      f("Level", "select", { options: ["Beginner", "Intermediate", "Advanced", "All levels"] }),
      f("Duration", "text", { help: "Total length, like 6 hours" }),
      f("Instructor", "text"),
      f("Price", "number"),
      f("Free", "toggle"),
      f("What you will learn", "richtext", { help: "One outcome per line" }),
      f("Curriculum", "richtext", { help: "Modules and lessons" }),
      f("Requirements", "longtext"),
      f("Certificate", "toggle", { help: "Offer a certificate on completion" }),
    ],
  },
  {
    id: "recipe",
    name: "Recipe",
    blurb: "Ingredients, steps and nutrition",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Description", "longtext"),
      f("Photo", "image"),
      f("Cuisine", "select", {
        options: ["Italian", "Mexican", "Indian", "Chinese", "Japanese", "Thai", "French", "Mediterranean", "American"],
      }),
      f("Course", "select", { options: ["Breakfast", "Lunch", "Dinner", "Appetizer", "Dessert", "Snack", "Drink"] }),
      f("Prep time", "number", { help: "Minutes" }),
      f("Cook time", "number", { help: "Minutes" }),
      f("Servings", "number"),
      f("Difficulty", "select", { options: ["Easy", "Medium", "Hard"] }),
      f("Ingredients", "richtext", { help: "One per line" }),
      f("Instructions", "richtext", { help: "Numbered steps" }),
      f("Nutrition", "group", {
        fields: [f("Calories", "number"), f("Protein", "number"), f("Carbs", "number"), f("Fat", "number")],
      }),
      f("Dietary", "text", { help: "Comma separated, like vegan, gluten free" }),
    ],
  },
  {
    id: "video",
    name: "Video",
    blurb: "Hosted videos with a thumbnail",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Description", "richtext"),
      f("Thumbnail", "image"),
      f("Video URL", "link", { help: "Hosted file or embed URL" }),
      f("Duration", "text", { help: "Like 12:34" }),
      f("Category", "select", { options: ["Tutorial", "Product", "Interview", "Webinar", "Vlog", "Announcement"] }),
      f("Channel", "text"),
      f("Published at", "date"),
      f("Transcript", "richtext"),
      f("Tags", "text", { help: "Comma separated" }),
    ],
  },
  {
    id: "podcast",
    name: "Podcast episode",
    blurb: "Audio episodes with show notes",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Episode number", "number"),
      f("Season", "number"),
      f("Summary", "longtext"),
      f("Show notes", "richtext"),
      f("Cover", "image"),
      f("Audio URL", "link", { help: "MP3 or hosted audio" }),
      f("Duration", "text", { help: "Like 48:20" }),
      f("Guests", "text"),
      f("Published at", "date"),
      f("Transcript", "richtext"),
    ],
  },
  {
    id: "music",
    name: "Music track",
    blurb: "A music library with artist and audio",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Artist", "text", { required: true }),
      f("Album", "text"),
      f("Cover art", "image"),
      f("Audio URL", "link"),
      f("Duration", "text", { help: "Like 3:45" }),
      f("Genre", "select", {
        options: ["Pop", "Rock", "Hip hop", "Electronic", "Jazz", "Classical", "Folk", "R and B", "Metal"],
      }),
      f("Release date", "date"),
      f("Explicit", "toggle"),
      f("Lyrics", "longtext"),
    ],
  },
  {
    id: "portfolio",
    name: "Portfolio project",
    blurb: "Showcase work with client and results",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Client", "text"),
      f("Summary", "longtext"),
      f("Description", "richtext"),
      f("Cover", "image"),
      f("Role", "text", { help: "Your role on the project" }),
      f("Services", "text", { help: "Comma separated" }),
      f("Year", "text"),
      f("Project link", "link"),
      f("Featured", "toggle"),
    ],
  },
  {
    id: "webinar",
    name: "Webinar",
    blurb: "Live sessions with registration",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Summary", "longtext"),
      f("Description", "richtext"),
      f("Cover", "image"),
      f("Starts at", "date", { required: true }),
      f("Duration", "text", { help: "Like 60 minutes" }),
      f("Host", "text"),
      f("Speakers", "richtext", { help: "One per line: name, role" }),
      f("Registration link", "link"),
      f("Recording URL", "link", { help: "Available after the session" }),
      f("On demand", "toggle"),
    ],
  },
  {
    id: "comparison",
    name: "Comparison page",
    blurb: "Side by side of two options",
    kind: "collection",
    make: () => [
      f("Title", "text", { required: true }),
      f("Slug", "slug", { required: true }),
      f("Intro", "longtext"),
      f("Option A", "text", { required: true }),
      f("Option B", "text", { required: true }),
      f("Overview", "richtext"),
      f("Criteria", "richtext", { help: "One row per criterion, with how each option does" }),
      f("Verdict", "richtext"),
      f("Questions", "faq", { help: "Common comparison questions", emitFaqSchema: true, faqItems: SAMPLE_FAQ }),
      f("SEO", "group", { fields: seoFields() }),
    ],
  },
  {
    id: "faq",
    name: "FAQ",
    blurb: "Accordion questions that auto-emit FAQ schema",
    kind: "block",
    make: () => [
      f("Heading", "text", { help: "Optional title above the questions" }),
      f("Questions", "faq", {
        required: true,
        emitFaqSchema: true,
        faqItems: SAMPLE_FAQ,
        help: "Each question renders in an accordion and feeds the FAQ schema",
      }),
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
      f("FAQ", "faq", { help: "Post FAQs, auto-emitted as FAQ schema", emitFaqSchema: true, faqItems: SAMPLE_FAQ }),
      f("SEO", "group", { fields: seoFields({ schemaType: "BlogPosting" }) }),
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
      f("SEO", "group", { fields: seoFields({ index: true }) }),
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
