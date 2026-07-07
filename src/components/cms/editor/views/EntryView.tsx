/**
 * EntryView — Notion-style document layout for a single entry.
 *
 * Title (huge) → Cover (if any) → Slug / Summary (if any) → Content
 * (block editor for the primary richText field) → collapsible Details
 * panel for the remaining structured fields.
 *
 * Non-content settings (status / publishing / SEO / history / comments)
 * live in the surrounding EntrySlideOver tabs.
 */
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Image as ImageIcon, X } from "lucide-react";
import { entryActions, useCMS } from "@/lib/cms/store";
import type { Entry, Schema, SchemaField } from "@/lib/cms/types";
import { FieldControl, validateField } from "../fields/FieldControl";
import { BlockEditor } from "../document/BlockEditor";

export function EntryView({ entryId }: { entryId: string }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  const collection = useCMS((s) =>
    entry ? s.collections.find((c) => c.id === entry.collectionId) : undefined,
  );
  const schema = useCMS((s) =>
    collection ? s.schemas.find((sc) => sc.id === collection.schemaId) : undefined,
  );

  const layout = useMemo(() => resolveLayout(schema), [schema]);
  // Structured fields stay visible: hiding them behind a closed accordion made
  // editors miss required fields entirely. Collapse is still there if wanted.
  const [detailsOpen, setDetailsOpen] = useState(true);

  if (!entry || !schema) return null;

  const titleFieldName = schema.titleFieldName ?? layout.titleField?.name;
  const titleValue =
    titleFieldName && typeof entry.fields[titleFieldName] === "string"
      ? (entry.fields[titleFieldName] as string)
      : entry.title;
  const setTitle = (v: string) => {
    if (titleFieldName) entryActions.setField(entry.id, titleFieldName, v);
    entryActions.update(entry.id, { title: v });
  };

  const coverValue = layout.coverField
    ? (entry.fields[layout.coverField.name] as string | undefined)
    : undefined;
  const slugValue = layout.slugField
    ? (entry.fields[layout.slugField.name] as string | undefined)
    : undefined;
  const summaryValue = layout.summaryField
    ? (entry.fields[layout.summaryField.name] as string | undefined)
    : undefined;

  return (
    <div
      className="mx-auto w-full"
      style={{ maxWidth: "var(--doc-max-width, 720px)", paddingLeft: "var(--doc-gutter-x-sm, 24px)", paddingRight: "var(--doc-gutter-x-sm, 24px)", paddingTop: 32, paddingBottom: 96 }}
    >
      {/* Cover */}
      {layout.coverField && (
        <CoverField
          value={coverValue}
          onChange={(v) => entryActions.setField(entry.id, layout.coverField!.name, v)}
        />
      )}

      {/* Title */}
      <input
        type="text"
        value={titleValue}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Untitled"
        aria-label="Title"
        className="block w-full border-none bg-transparent text-[40px] font-semibold leading-[1.1] tracking-tight text-foreground outline-none placeholder:text-muted-foreground/40"
      />

      {/* Slug + Summary */}
      <div className="mt-3 space-y-2">
        {layout.slugField && (
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <span className="opacity-60">/</span>
            <input
              type="text"
              value={(slugValue ?? "") as string}
              placeholder={layout.slugField.placeholder ?? "slug"}
              onChange={(e) =>
                entryActions.setField(entry.id, layout.slugField!.name, e.target.value)
              }
              className="block w-full bg-transparent text-[13px] outline-none placeholder:text-muted-foreground/40"
            />
          </div>
        )}
        {layout.summaryField && (
          <input
            type="text"
            value={(summaryValue ?? "") as string}
            placeholder={layout.summaryField.placeholder ?? "Write a short summary…"}
            onChange={(e) =>
              entryActions.setField(entry.id, layout.summaryField!.name, e.target.value)
            }
            className="block w-full bg-transparent text-[15px] text-muted-foreground outline-none placeholder:text-muted-foreground/40"
          />
        )}
      </div>

      {/* Content (block editor) */}
      <div className="mt-8" style={{ display: "flex", flexDirection: "column", gap: "var(--doc-block-gap, 12px)" }}>
        {layout.contentField ? (
          <div className="pl-2">
            <BlockEditor
              value={entry.fields[layout.contentField.name]}
              onChange={(next) =>
                entryActions.setField(entry.id, layout.contentField!.name, next)
              }
              placeholder="Press '/' for blocks, or just start writing…"
            />
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card px-5 py-6 text-[13px] text-muted-foreground">
            Add a rich-text field to this collection to start writing content here.
          </div>
        )}
      </div>

      {/* Fields — always visible, collapsible if the writer wants focus */}
      {layout.detailFields.length > 0 && (
        <section className="mt-10 border-t border-border/60 pt-5" aria-label="Entry fields">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-foreground">Fields</h2>
            <span className="text-[11.5px] text-muted-foreground">
              {layout.detailFields.length} {layout.detailFields.length === 1 ? "field" : "fields"}
            </span>
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? "Collapse fields" : "Expand fields"}
              className="ml-auto grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
            >
              {detailsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </button>
          </div>
          {detailsOpen && (
            <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">
              {layout.detailFields.map((f) => (
                <FieldRow key={f.id} field={f} entry={entry} />
              ))}
            </div>
          )}
        </section>
      )}

      <div className="mt-12 text-[11px] text-muted-foreground/70">
        Last updated {new Date(entry.updatedAt).toLocaleString()}
      </div>
    </div>
  );
}

/* =========================================================================
   Layout resolution
   ========================================================================= */

interface DocLayout {
  titleField?: SchemaField;
  coverField?: SchemaField;
  slugField?: SchemaField;
  summaryField?: SchemaField;
  contentField?: SchemaField;
  detailFields: SchemaField[];
}

const TITLE_HINTS = ["title", "name", "heading"];
const SLUG_HINTS = ["slug", "path", "permalink"];
const SUMMARY_HINTS = ["summary", "excerpt", "subtitle", "tagline", "description"];
const COVER_HINTS = ["cover", "hero", "thumbnail", "image"];
const CONTENT_HINTS = ["body", "content", "article", "post"];

function resolveLayout(schema?: Schema): DocLayout {
  if (!schema) {
    return { detailFields: [] };
  }
  const fields = schema.fields;
  const used = new Set<string>();
  const pick = (predicate: (f: SchemaField) => boolean) => {
    const f = fields.find((x) => !used.has(x.name) && predicate(x));
    if (f) used.add(f.name);
    return f;
  };

  const titleField = schema.titleFieldName
    ? fields.find((f) => f.name === schema.titleFieldName)
    : pick((f) => f.type === "text" && hintMatch(f, TITLE_HINTS)) ?? pick((f) => f.type === "text");
  if (titleField) used.add(titleField.name);

  const coverField = pick((f) => f.type === "image" && hintMatch(f, COVER_HINTS)) ?? pick((f) => f.type === "image");
  const slugField = pick((f) => f.type === "text" && hintMatch(f, SLUG_HINTS));
  const summaryField =
    pick((f) => f.type === "text" && hintMatch(f, SUMMARY_HINTS)) ??
    pick((f) => (f.type === "text" && (f.placeholder?.length ?? 0) > 0));

  const contentField =
    pick((f) => f.type === "richText" && hintMatch(f, CONTENT_HINTS)) ??
    pick((f) => f.type === "richText");

  const detailFields = fields.filter((f) => !used.has(f.name));
  return { titleField, coverField, slugField, summaryField, contentField, detailFields };
}

function hintMatch(field: SchemaField, hints: string[]): boolean {
  const hay = `${field.name} ${field.label}`.toLowerCase();
  return hints.some((h) => hay.includes(h));
}

/* =========================================================================
   Cover field
   ========================================================================= */

function CoverField({
  value,
  onChange,
}: {
  value?: string;
  onChange: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  if (value) {
    return (
      <div className="group relative -mx-4 mb-6 overflow-hidden rounded-lg bg-muted sm:-mx-6">
        <img src={value} alt="" className="block max-h-[280px] w-full object-cover" />
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md bg-background/70 text-foreground opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100 hover:bg-background"
          aria-label="Remove cover"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }
  return (
    <div className="mb-4">
      {editing ? (
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
          <ImageIcon className="h-3.5 w-3.5 text-muted-foreground" />
          <input
            autoFocus
            type="url"
            placeholder="Paste an image URL…"
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v) onChange(v);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              if (e.key === "Escape") setEditing(false);
            }}
            className="flex-1 bg-transparent text-[13px] outline-none"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="-mx-2 flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted-foreground/60 transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          Add cover
        </button>
      )}
    </div>
  );
}

/* =========================================================================
   Detail field row (Details accordion)
   ========================================================================= */

function FieldRow({ field, entry }: { field: SchemaField; entry: Entry }) {
  const value = entry.fields[field.name];
  const error = validateField(field, value);
  return (
    <div>
      <div className="mb-1 flex items-baseline gap-2">
        <label className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {field.label}
        </label>
        {field.required && <span className="text-[10px] text-primary">required</span>}
      </div>
      <FieldControl
        field={field}
        value={value}
        onChange={(v) => entryActions.setField(entry.id, field.name, v)}
      />
      {field.description && !error && (
        <div className="mt-1 text-[11px] text-muted-foreground">{field.description}</div>
      )}
      {error && <div className="mt-1 text-[11px] text-destructive">{error}</div>}
    </div>
  );
}
