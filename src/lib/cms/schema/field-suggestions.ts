/**
 * Heuristic "suggested fields" for a freshly-created schema.
 * Matched against the collection / component name. Pure data — no React.
 */
import type { SchemaFieldType } from "@/lib/cms/types";

export interface SuggestedField {
  type: SchemaFieldType;
  label: string;
  group?: string;
}

export interface SuggestionPreset {
  id: string;
  label: string;
  fields: SuggestedField[];
}

const BLOG: SuggestionPreset = {
  id: "blog",
  label: "Blog post",
  fields: [
    { type: "text", label: "Title", group: "General" },
    { type: "text", label: "Slug", group: "General" },
    { type: "richText", label: "Body", group: "General" },
    { type: "image", label: "Cover image", group: "Media" },
    { type: "reference", label: "Author", group: "General" },
    { type: "date", label: "Published at", group: "Publishing" },
    { type: "text", label: "SEO title", group: "SEO" },
    { type: "text", label: "SEO description", group: "SEO" },
  ],
};

const PRODUCT: SuggestionPreset = {
  id: "product",
  label: "Product",
  fields: [
    { type: "text", label: "Name", group: "General" },
    { type: "text", label: "Slug", group: "General" },
    { type: "richText", label: "Description", group: "General" },
    { type: "number", label: "Price", group: "Commerce" },
    { type: "image", label: "Gallery", group: "Media" },
    { type: "boolean", label: "In stock", group: "Commerce" },
    { type: "reference", label: "Category", group: "General" },
  ],
};

const PAGE: SuggestionPreset = {
  id: "page",
  label: "Page",
  fields: [
    { type: "text", label: "Title", group: "General" },
    { type: "text", label: "Slug", group: "General" },
    { type: "richText", label: "Body", group: "General" },
    { type: "text", label: "SEO title", group: "SEO" },
    { type: "text", label: "SEO description", group: "SEO" },
  ],
};

const AUTHOR: SuggestionPreset = {
  id: "author",
  label: "Author",
  fields: [
    { type: "text", label: "Name", group: "General" },
    { type: "image", label: "Avatar", group: "Media" },
    { type: "richText", label: "Bio", group: "General" },
    { type: "url", label: "Website", group: "General" },
    { type: "email", label: "Email", group: "General" },
  ],
};

const EVENT: SuggestionPreset = {
  id: "event",
  label: "Event",
  fields: [
    { type: "text", label: "Name", group: "General" },
    { type: "date", label: "Starts at", group: "General" },
    { type: "date", label: "Ends at", group: "General" },
    { type: "text", label: "Location", group: "General" },
    { type: "image", label: "Cover", group: "Media" },
    { type: "richText", label: "Details", group: "General" },
  ],
};

const FALLBACK: SuggestionPreset = {
  id: "general",
  label: "Common fields",
  fields: [
    { type: "text", label: "Title", group: "General" },
    { type: "text", label: "Slug", group: "General" },
    { type: "richText", label: "Body", group: "General" },
    { type: "image", label: "Cover", group: "Media" },
  ],
};

const PRESETS: SuggestionPreset[] = [BLOG, PRODUCT, PAGE, AUTHOR, EVENT];

export function suggestFor(name: string): SuggestionPreset {
  const n = (name || "").toLowerCase();
  if (/blog|post|article|news/.test(n)) return BLOG;
  if (/product|shop|item|sku/.test(n)) return PRODUCT;
  if (/page|landing/.test(n)) return PAGE;
  if (/author|user|profile|team|member/.test(n)) return AUTHOR;
  if (/event|session|webinar/.test(n)) return EVENT;
  return FALLBACK;
}

export { PRESETS };
