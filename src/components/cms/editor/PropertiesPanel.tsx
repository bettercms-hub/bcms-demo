import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Entry, Page, Section, TreeNode } from "@/lib/cms/types";
import {
  componentActions,
  entryActions,
  pageActions,
  sectionActions,
  useCMS,
} from "@/lib/cms/store";
import { InspectorAccordion } from "./inspector/Accordion";

import { FieldControl } from "./fields/FieldControl";
import { getVisibleSectionSchema } from "@/lib/cms/section-schema";
import { openSchemaEditor } from "./center/SchemaEditorWorkspace";
import { OverrideForm } from "./inspector/OverrideForm";
import { PublishingPanel } from "./inspector/PublishingPanel";
import { SeoDashboard } from "./inspector/SeoDashboard";
import { NODE_KIND_ICON, ICON_STROKE } from "@/lib/cms/icons";


export function PropertiesPanel({ node }: { node?: TreeNode }) {
  const Icon = node ? NODE_KIND_ICON[node.kind] : undefined;
  return (
    <div className="flex h-full flex-col bg-[color:var(--inspector)]">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border/40 px-3.5">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Inspector
        </span>
        {node && (
          <>
            <span className="text-muted-foreground/40" aria-hidden>·</span>
            {Icon ? (
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                strokeWidth={ICON_STROKE}
              />
            ) : null}
            <span className="min-w-0 truncate text-[12.5px] font-semibold text-foreground">
              {node.label}
            </span>
            <span
              className="ml-auto shrink-0 truncate font-mono text-[10px] text-muted-foreground/70"
              title={node.id}
            >
              {node.id.length > 18 ? `…${node.id.slice(-16)}` : node.id}
            </span>
          </>
        )}
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        {!node ? (
          <div className="px-4 py-6 text-[12px] text-muted-foreground">Nothing selected.</div>
        ) : (
          <NodeInspector node={node} />
        )}
      </div>
    </div>
  );
}


// ============ Canonical card stack ============

// Phase-3 inspector: three top-level tabs (Content · Design · Publishing)
// each containing a stack of collapsible cards. The card set per kind stays
// the same; only the surfacing changes. Removes the old long-flat list of
// seven tabs that made the inspector feel like a settings panel.
export type CardId =
  | "content"
  | "appearance"
  | "layout"
  | "visibility"
  | "seo"
  | "publishing"
  | "advanced";

type TabId = "content" | "design" | "publishing";

const TAB_CARDS: Record<TabId, { id: CardId; title: string; defaultOpen?: boolean }[]> = {
  content: [
    { id: "content", title: "Fields", defaultOpen: true },
  ],
  design: [
    { id: "appearance", title: "Appearance", defaultOpen: true },
    { id: "layout",     title: "Spacing & layout", defaultOpen: false },
    { id: "visibility", title: "Visibility", defaultOpen: false },
  ],
  publishing: [
    { id: "seo",        title: "SEO",        defaultOpen: true },
    { id: "publishing", title: "Publishing", defaultOpen: true },
    { id: "advanced",   title: "Advanced",   defaultOpen: false },
  ],
};

const TAB_LABELS: { id: TabId; label: string }[] = [
  { id: "content",    label: "Content" },
  { id: "design",     label: "Design" },
  { id: "publishing", label: "Publishing" },
];

type Cards = Partial<Record<CardId, () => ReactNode>>;

function CardStack({ scopeKey, cards }: { scopeKey: string; cards: Cards }) {
  const tabStorageKey = `bettercms.inspector.tab.${scopeKey}`;
  const [activeTab, setActiveTab] = useState<TabId>(() => {
    if (typeof window === "undefined") return "content";
    const v = window.localStorage.getItem(tabStorageKey) as TabId | null;
    return v === "design" || v === "publishing" || v === "content" ? v : "content";
  });
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(tabStorageKey, activeTab);
    }
  }, [activeTab, tabStorageKey]);

  // Hide tabs whose cards are all empty for this selection.
  const tabHasContent = (tab: TabId) => TAB_CARDS[tab].some((c) => cards[c.id]);
  const visibleTabs = TAB_LABELS.filter((t) => tabHasContent(t.id));
  const effectiveTab: TabId =
    visibleTabs.find((t) => t.id === activeTab)?.id ?? visibleTabs[0]?.id ?? "content";
  const visibleCards = TAB_CARDS[effectiveTab].filter((c) => cards[c.id]);

  return (
    <div className="flex h-full flex-col">
      <div
        role="tablist"
        className="flex shrink-0 items-center gap-0.5 border-b border-border/60 px-3 pt-2"
      >
        {visibleTabs.map((t) => {
          const active = t.id === effectiveTab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setActiveTab(t.id)}
              className={`relative h-7 rounded-md px-2.5 text-[11.5px] font-medium tracking-tight transition-colors ${
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-[1.5px] rounded-full bg-[color:var(--primary)]"
                />
              )}
            </button>
          );
        })}
      </div>
      <div className="flex-1 overflow-auto px-3.5 py-2">
        {visibleCards.length === 0 ? (
          <Empty>Nothing to configure here yet.</Empty>
        ) : (
          visibleCards.map((c) => (
            <InspectorAccordion
              key={c.id}
              title={c.title}
              defaultOpen={c.defaultOpen ?? false}
              storageKey={`${scopeKey}.${c.id}`}
            >
              {cards[c.id]!()}
            </InspectorAccordion>
          ))
        )}
      </div>
    </div>
  );
}


// ============ Field primitives ============

function Field({
  label,
  hint,
  description,
  error,
  children,
}: {
  label: string;
  hint?: string;
  description?: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {label}
      </label>
      {description && !error && (
        <div className="mb-1.5 text-[10.5px] leading-snug text-muted-foreground/80">
          {description}
        </div>
      )}
      <div aria-invalid={error ? true : undefined}>{children}</div>
      {error && (
        <div
          role="alert"
          className="mt-1 text-[10.5px] font-medium text-destructive"
        >
          {error}
        </div>
      )}
      {hint && !error && (
        <div className="mt-1 text-[11px] text-muted-foreground/80">{hint}</div>
      )}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  mono,
  readOnly,
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  mono?: boolean;
  readOnly?: boolean;
  placeholder?: string;
}) {
  return (
    <input
      readOnly={readOnly || !onChange}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`h-8 w-full rounded-[6px] border border-border bg-transparent px-2.5 text-[12.5px] text-foreground transition-[box-shadow,background-color,border-color] duration-120 hover:bg-[color:var(--color-row-hover)] hover:border-border-strong focus:bg-[color:var(--surface-focused)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)] ${
        mono ? "font-mono text-[12px]" : ""
      } ${readOnly ? "text-muted-foreground" : ""}`}
    />
  );
}

function TextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
  mono,
}: {
  value: string;
  onChange?: (v: string) => void;
  rows?: number;
  placeholder?: string;
  mono?: boolean;
}) {
  return (
    <textarea
      readOnly={!onChange}
      value={value}
      rows={rows}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className={`w-full rounded-[6px] border border-border bg-transparent px-2.5 py-1.5 text-[12.5px] text-foreground transition-[box-shadow,background-color,border-color] duration-120 hover:bg-[color:var(--color-row-hover)] hover:border-border-strong focus:bg-[color:var(--surface-focused)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)] ${
        mono ? "font-mono text-[12px]" : ""
      }`}
    />
  );
}

function Select<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-8 w-full rounded-[6px] border border-border bg-transparent px-2 text-[12.5px] text-foreground transition-[box-shadow,background-color,border-color] duration-120 hover:bg-[color:var(--color-row-hover)] hover:border-border-strong focus:bg-[color:var(--surface-focused)] focus:border-[color:var(--primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)]"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}


function Empty({ children }: { children: ReactNode }) {
  return <div className="px-1 py-2 text-[12px] text-muted-foreground">{children}</div>;
}

// ============ Per-kind inspectors ============

function NodeInspector({ node }: { node: TreeNode }) {
  const refId = node.refId;
  const kind = node.kind;

  const page = useCMS((s) => (kind === "page" && refId ? s.pages.find((p) => p.id === refId) : undefined));
  const blockSectionId =
    kind === "block" ? node.id.split(":")[1] : undefined;
  const section = useCMS((s) =>
    kind === "section" && refId
      ? s.sections.find((x) => x.id === refId)
      : blockSectionId
        ? s.sections.find((x) => x.id === blockSectionId)
        : undefined,
  );
  const entry = useCMS((s) => (kind === "entry" && refId ? s.entries.find((e) => e.id === refId) : undefined));
  const entryCollection = useCMS((s) =>
    entry ? s.collections.find((c) => c.id === entry.collectionId) : undefined,
  );
  const entrySchema = useCMS((s) =>
    entryCollection ? s.schemas.find((sc) => sc.id === entryCollection.schemaId) : undefined,
  );
  const collection = useCMS((s) =>
    kind === "collection" && refId ? s.collections.find((c) => c.id === refId) : undefined,
  );
  const colSchema = useCMS((s) =>
    collection ? s.schemas.find((sc) => sc.id === collection.schemaId) : undefined,
  );
  const component = useCMS((s) =>
    kind === "component" && refId ? s.components.find((c) => c.id === refId) : undefined,
  );
  const compSchema = useCMS((s) =>
    component?.schemaId ? s.schemas.find((sc) => sc.id === component.schemaId) : undefined,
  );
  const media = useCMS((s) => (kind === "media" && refId ? s.media.find((m) => m.id === refId) : undefined));

  if (kind === "page" && page) return <PageInspector page={page} />;
  if ((kind === "section" || kind === "block") && section) return <SectionInspector section={section} />;
  if (kind === "entry" && entry)
    return (
      <EntryInspector
        entry={entry}
        collectionName={entryCollection?.name ?? ""}
        fields={entrySchema?.fields ?? []}
      />
    );
  if (kind === "collection" && collection)
    return (
      <CollectionInspector
        name={collection.name}
        slug={collection.slug}
        id={collection.id}
        entryCount={collection.entryIds.length}
        fieldCount={colSchema?.fields.length ?? 0}
        schemaId={collection.schemaId}
      />
    );
  if (kind === "component" && component)
    return (
      <ComponentInspector
        componentId={component.id}
        schemaId={component.schemaId}
        schemaFieldCount={compSchema?.fields.length ?? 0}
      />
    );
  if (kind === "media" && media)
    return (
      <CardStack
        scopeKey="media"
        cards={{
          content: () => (
            <>
              <Field label="Name"><TextInput value={media.name} readOnly /></Field>
              <Field label="Kind"><TextInput value={media.kind} readOnly /></Field>
              <Field label="Size"><TextInput value={media.size ?? ""} readOnly /></Field>
            </>
          ),
          advanced: () => (
            <Field label="ID"><TextInput value={media.id} mono readOnly /></Field>
          ),
        }}
      />
    );

  return <Empty>No inspector for this node.</Empty>;
}

// ===== Page =====

function PageInspector({ page }: { page: Page }) {
  const titleError =
    !page.title || page.title.trim().length === 0 ? "Title is required." : undefined;
  const slugError =
    !page.slug || page.slug.trim().length === 0
      ? "Slug is required."
      : /\s/.test(page.slug)
        ? "Slug cannot contain spaces."
        : undefined;

  const cards: Cards = useMemo(
    () => ({
      content: () => (
        <>
          <Field label="Title" error={titleError}>
            <TextInput
              value={page.title}
              onChange={(v) => pageActions.update(page.id, { title: v })}
            />
          </Field>
          <Field
            label="Slug"
            description="Where this page lives in the URL."
            error={slugError}
          >
            <TextInput
              value={page.slug}
              mono
              onChange={(v) => pageActions.update(page.id, { slug: v })}
            />
          </Field>
          <Field label="Page type">
            <Select
              value={page.type ?? "static"}
              options={[
                { value: "static", label: "Static" },
                { value: "dynamic", label: "Dynamic" },
                { value: "template", label: "Template" },
              ]}
              onChange={(v) => pageActions.update(page.id, { type: v })}
            />
          </Field>
        </>
      ),
      appearance: () => (
        <Field
          label="Theme override"
          description="Inherits from the project theme unless overridden."
        >
          <Select
            value={(page as unknown as { theme?: string }).theme ?? "inherit"}
            options={[
              { value: "inherit", label: "Inherit from project" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
            onChange={() => {
              /* theme override is metadata-only in this pass */
            }}
          />
        </Field>
      ),
      layout: () => (
        <Empty>
          Page-level layout (max width, header/footer toggle) lives at the
          template level. Switch the Page type to <em>Template</em> to edit.
        </Empty>
      ),
      seo: () => (
        <>
          <Field
            label="Meta title"
            description="Falls back to the page title if empty."
          >
            <TextInput
              value={page.metaTitle ?? ""}
              onChange={(v) => pageActions.update(page.id, { metaTitle: v })}
            />
          </Field>
          <Field label="Meta description">
            <TextArea
              value={page.metaDescription ?? page.seoDescription ?? ""}
              rows={2}
              onChange={(v) =>
                pageActions.update(page.id, { metaDescription: v })
              }
            />
          </Field>
          <SeoDashboard page={page} />
        </>
      ),
      publishing: () => <PublishingPanel kind="page" ownerId={page.id} />,
      advanced: () => (
        <>
          <Field label="ID">
            <TextInput value={page.id} mono readOnly />
          </Field>
          <Field label="Sections">
            <TextInput value={String(page.sectionIds.length)} readOnly />
          </Field>
          <Field
            label="Canonical URL"
            description="Override the canonical link. Leave empty to use the page slug."
          >
            <TextInput
              value={page.canonical ?? ""}
              mono
              onChange={(v) => pageActions.update(page.id, { canonical: v })}
            />
          </Field>
        </>
      ),
    }),
    [page, titleError, slugError],
  );

  return <CardStack scopeKey="page" cards={cards} />;
}


// ===== Section =====

function SectionInspector({ section }: { section: Section }) {
  const components = useCMS((s) => s.components);
  const boundComponent = components.find((c) => c.id === section.componentId);
  const boundSchema = useCMS((s) =>
    boundComponent?.schemaId ? s.schemas.find((sc) => sc.id === boundComponent.schemaId) : undefined,
  );
  const sectionSchema = useMemo(() => getVisibleSectionSchema(section.kind, section.props), [section.kind, section.props]);
  const isBound = !!boundComponent;

  const cards: Cards = useMemo(
    () => ({
      content: () => (
        <>
          <Field label="Name">
            <TextInput
              value={section.name}
              onChange={(v) => sectionActions.update(section.id, { name: v })}
            />
          </Field>
          <Field label="Kind"><TextInput value={section.kind} readOnly /></Field>
          {isBound ? (
            <div className="mt-2">
              <OverrideForm section={section} schema={boundSchema} />
            </div>
          ) : sectionSchema.length === 0 ? null : (
            <div className="mt-2 space-y-2">
              {sectionSchema.map((f) => (
                <Field key={f.id} label={f.label} hint={f.description}>
                  <FieldControl
                    field={f}
                    value={section.props[f.name]}
                    onChange={(v) => sectionActions.setProp(section.id, f.name, v)}
                  />
                </Field>
              ))}
            </div>
          )}
        </>
      ),
      ...(isBound
        ? {}
        : {
            appearance: () => (
              <Field label="Background">
                <Select
                  value={(section.props.background as string) ?? "default"}
                  options={[
                    { value: "default", label: "Default" },
                    { value: "muted", label: "Muted" },
                    { value: "inverse", label: "Inverse" },
                    { value: "accent", label: "Accent" },
                  ]}
                  onChange={(v) => sectionActions.setProp(section.id, "background", v)}
                />
              </Field>
            ),
            layout: () => (
              <>
                <Field label="Spacing">
                  <Select
                    value={(section.props.spacing as string) ?? "comfortable"}
                    options={[
                      { value: "compact", label: "Compact" },
                      { value: "comfortable", label: "Comfortable" },
                      { value: "spacious", label: "Spacious" },
                    ]}
                    onChange={(v) => sectionActions.setProp(section.id, "spacing", v)}
                  />
                </Field>
                <Field label="Alignment">
                  <Select
                    value={(section.props.align as string) ?? "left"}
                    options={[
                      { value: "left", label: "Left" },
                      { value: "center", label: "Center" },
                      { value: "right", label: "Right" },
                    ]}
                    onChange={(v) => sectionActions.setProp(section.id, "align", v)}
                  />
                </Field>
              </>
            ),
            visibility: () => (
              <Field label="Hidden">
                <Select
                  value={section.props.hidden ? "true" : "false"}
                  options={[
                    { value: "false", label: "Visible" },
                    { value: "true", label: "Hidden" },
                  ]}
                  onChange={(v) => sectionActions.setProp(section.id, "hidden", v === "true")}
                />
              </Field>
            ),
          }),
      publishing: () => (
        <Empty>Section-level publishing arrives in a later phase. Publish from the parent page.</Empty>
      ),
      advanced: () => (
        <>
          <Field label="ID"><TextInput value={section.id} mono readOnly /></Field>
          {isBound && (
            <>
              <Field label="Component">
                <TextInput value={boundComponent!.name} readOnly />
              </Field>
              <Field label="Master ID">
                <TextInput value={boundComponent!.id} mono readOnly />
              </Field>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() =>
                    boundComponent!.schemaId &&
                    openSchemaEditor("component", boundComponent!.id, boundComponent!.schemaId)
                  }
                  className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium hover:border-border-strong"
                >
                  Edit schema
                </button>
                <button
                  type="button"
                  onClick={() => sectionActions.detachFromComponent(section.id)}
                  className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:border-border-strong"
                >
                  Detach
                </button>
              </div>
            </>
          )}
          {!isBound && (
            <Field label="Bind to component">
              <select
                value=""
                onChange={(e) => e.target.value && sectionActions.bindComponent(section.id, e.target.value)}
                className="h-8 w-full rounded-[6px] border border-border bg-surface px-2 text-[13px] text-foreground hover:border-border-strong focus:border-primary focus:outline-none"
              >
                <option value="">— pick a component —</option>
                {components.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </Field>
          )}
        </>
      ),
    }),
    [section, components, boundComponent, boundSchema, sectionSchema, isBound],
  );

  return <CardStack scopeKey="section" cards={cards} />;
}



// ===== Entry =====

function EntryInspector({
  entry,
  collectionName,
  fields,
}: {
  entry: Entry;
  collectionName: string;
  fields: { id: string; name: string; label: string; type: string; required?: boolean }[];
}) {
  const seoFieldNames = new Set([
    "seoTitle",
    "seoDescription",
    "ogTitle",
    "ogDescription",
    "ogImage",
    "twitterImage",
    "canonical",
  ]);
  const seoFields = fields.filter((f) => seoFieldNames.has(f.name));

  const cards: Cards = useMemo(
    () => ({
      content: () => (
        <>
          <Field label="Title">
            <TextInput
              value={entry.title}
              onChange={(v) => entryActions.update(entry.id, { title: v })}
            />
          </Field>
          <Field label="Collection"><TextInput value={collectionName} readOnly /></Field>
        </>
      ),
      ...(seoFields.length > 0 && {
        seo: () => (
          <>
            {seoFields.map((f) => (
              <Field key={f.id} label={f.label}>
                <TextInput
                  value={String(entry.fields[f.name] ?? "")}
                  onChange={(v) => entryActions.setField(entry.id, f.name, v)}
                />
              </Field>
            ))}
          </>
        ),
      }),
      publishing: () => <PublishingPanel kind="entry" ownerId={entry.id} />,
      advanced: () => (
        <>
          <Field label="ID"><TextInput value={entry.id} mono readOnly /></Field>
          <Field label="Updated">
            <TextInput value={new Date(entry.updatedAt).toLocaleString()} readOnly />
          </Field>
          <Field label="Schema fields">
            <TextInput value={String(fields.length)} readOnly />
          </Field>
        </>
      ),
    }),
    [entry, collectionName, fields, seoFields],
  );

  return <CardStack scopeKey="entry" cards={cards} />;
}

// ===== Collection =====

function CollectionInspector({
  name,
  slug,
  id,
  entryCount,
  fieldCount,
  schemaId,
}: {
  name: string;
  slug: string;
  id: string;
  entryCount: number;
  fieldCount: number;
  schemaId: string;
}) {
  const cards: Cards = useMemo(
    () => ({
      content: () => (
        <>
          <Field label="Name"><TextInput value={name} readOnly /></Field>
          <Field label="Slug"><TextInput value={slug} mono readOnly /></Field>
          <Field label="Fields"><TextInput value={String(fieldCount)} readOnly /></Field>
          <Field label="Entries"><TextInput value={String(entryCount)} readOnly /></Field>
          <button
            type="button"
            onClick={() => openSchemaEditor("collection", id, schemaId)}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium hover:border-border-strong"
          >
            Edit schema
          </button>
        </>
      ),
      advanced: () => (
        <Field label="ID"><TextInput value={id} mono readOnly /></Field>
      ),
    }),
    [name, slug, id, entryCount, fieldCount, schemaId],
  );

  return <CardStack scopeKey="collection" cards={cards} />;
}

// ===== Component =====

function ComponentInspector({
  componentId,
  schemaId,
  schemaFieldCount,
}: {
  componentId: string;
  schemaId?: string;
  schemaFieldCount: number;
}) {
  const component = useCMS((s) => s.components.find((c) => c.id === componentId));

  const cards: Cards = useMemo(() => {
    if (!component) return {};
    return {
      content: () => (
        <>
          <Field label="Name">
            <TextInput
              value={component.name}
              onChange={(v) => componentActions.rename(component.id, v)}
            />
          </Field>
          <Field label="Schema fields">
            <TextInput value={String(schemaFieldCount)} readOnly />
          </Field>
          <Field label="Variants">
            <TextInput value={String(component.variantIds.length)} readOnly />
          </Field>
          <button
            type="button"
            disabled={!schemaId}
            onClick={() => schemaId && openSchemaEditor("component", component.id, schemaId)}
            className="mt-2 inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium hover:border-border-strong disabled:opacity-40"
          >
            Edit schema
          </button>
        </>
      ),
      advanced: () => (
        <>
          <Field label="ID"><TextInput value={component.id} mono readOnly /></Field>
          <Field label="States">
            <TextInput
              value={(component.states ?? []).join(", ") || "—"}
              readOnly
            />
          </Field>
          <div className="pt-2">
            <Field label="Custom CSS">
              <TextArea value={component.customCss ?? ""} rows={4} mono />
            </Field>
          </div>
          <Field label="Custom JS">
            <TextArea value={component.customJs ?? ""} rows={4} mono />
          </Field>
        </>
      ),
    };
  }, [component, schemaFieldCount, schemaId]);

  if (!component) return null;
  return <CardStack scopeKey="component" cards={cards} />;
}
