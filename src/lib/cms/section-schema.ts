/** Per-section-kind field definitions powering both the inspector and preview. */
import type { SchemaField, SectionKind } from "./types";

const f = (name: string, label: string, type: SchemaField["type"], extra: Partial<SchemaField> = {}): SchemaField => ({
  id: `sf_${name}`, name, label, type, ...extra,
});

const COMMON_CTA: SchemaField[] = [
  f("ctaText", "Call-to-action label", "text", { placeholder: "Get started" }),
  f("ctaHref", "Call-to-action URL", "url", { placeholder: "/signup" }),
];

const SCHEMAS: Record<SectionKind, SchemaField[]> = {
  hero: [
    f("eyebrow", "Eyebrow", "text", { placeholder: "New" }),
    f("heading", "Heading", "text", { required: true, placeholder: "Hero headline" }),
    f("subheading", "Subheading", "richText", { placeholder: "Short supporting copy" }),
    ...COMMON_CTA,
    f("image", "Background image", "image"),
  ],
  features: [
    f("heading", "Heading", "text", { placeholder: "Features" }),
    f("subheading", "Subheading", "text"),
    f("columns", "Columns", "number", { defaultValue: 3 }),
    f("body", "Body", "richText"),
  ],
  pricing: [
    f("heading", "Heading", "text", { placeholder: "Pricing" }),
    f("subheading", "Subheading", "text"),
    f("plans", "Number of plans", "number", { defaultValue: 3 }),
  ],
  testimonials: [
    f("heading", "Heading", "text", { placeholder: "Loved by teams" }),
    f("layout", "Layout", "select", { options: ["grid", "carousel", "stacked"], defaultValue: "grid" }),
  ],
  logos: [
    f("heading", "Heading", "text", { placeholder: "Trusted by" }),
    f("count", "Logo count", "number", { defaultValue: 6 }),
  ],
  cta: [
    f("heading", "Heading", "text", { required: true, placeholder: "Ready to start?" }),
    f("subheading", "Subheading", "text" ),
    ...COMMON_CTA,
  ],
  faq: [
    f("heading", "Heading", "text", { placeholder: "Frequently asked questions" }),
    f("body", "Intro", "richText"),
    f("items", "Item count", "number", { defaultValue: 6 }),
  ],
  content: [
    f("heading", "Heading", "text" ),
    f("body", "Body", "richText"),
  ],
  header: [
    f("logo", "Logo text", "text", { placeholder: "Brand" }),
    f("links", "Nav links (comma separated)", "text", { placeholder: "Product, Pricing, About" }),
    ...COMMON_CTA,
  ],
  footer: [
    f("tagline", "Tagline", "text" ),
    f("copyright", "Copyright", "text", { placeholder: "© 2026" }),
  ],
  navigation: [
    f("logo", "Logo text", "text", { placeholder: "Northwind AI" }),
    f("linksMode", "Primary links source", "select", {
      options: ["auto", "manual"],
      defaultValue: "auto",
      description: "Auto pulls top pages from this project. Manual lets you list labels by hand.",
    }),
    f("linksLimit", "Max links (auto)", "number", { defaultValue: 5 }),
    f("links", "Primary links (comma separated)", "text", { placeholder: "Product, Pricing, Docs" }),
    f("menuMode", "Mega menu source", "select", {
      options: ["current-page-sections", "page-sections", "manual"],
      defaultValue: "current-page-sections",
    }),
    f("menuSourcePageId", "Mega menu source page", "text", { placeholder: "pg_home" }),
    f("menuLabel", "Mega menu label", "text", { placeholder: "On this page" }),
    f("menuItems", "Mega menu items (comma separated)", "text", { placeholder: "Engineering, Design, Sales" }),
    f("showSearch", "Show search", "boolean", { defaultValue: true }),
    f("language", "Language", "select", { options: ["EN", "DE", "FR", "JP"], defaultValue: "EN" }),
    ...COMMON_CTA,
  ],

  workflow: [
    f("heading", "Heading", "text", { placeholder: "How it works" }),
    f("subheading", "Subheading", "text" ),
    f("steps", "Number of steps", "number", { defaultValue: 4 }),
  ],
  integrations: [
    f("heading", "Heading", "text", { placeholder: "Connect everything" }),
    f("subheading", "Subheading", "text" ),
    f("count", "Integration count", "number", { defaultValue: 12 }),
  ],
  stats: [
    f("heading", "Heading", "text", { placeholder: "Trusted at scale" }),
    f("count", "Stat count", "number", { defaultValue: 4 }),
  ],
  blog: [
    f("heading", "Heading", "text", { placeholder: "From the blog" }),
    f("subheading", "Subheading", "text" ),
    f("count", "Posts to show", "number", { defaultValue: 3 }),
  ],
  docs: [
    f("heading", "Heading", "text", { placeholder: "Documentation" }),
    f("count", "Cards", "number", { defaultValue: 6 }),
  ],
  contact: [
    f("heading", "Heading", "text", { placeholder: "Talk to us" }),
    f("subheading", "Subheading", "text" ),
    ...COMMON_CTA,
  ],
};

export function getSectionSchema(kind: SectionKind): SchemaField[] {
  return SCHEMAS[kind] ?? [];
}

/**
 * Field visibility predicates per section kind. Hides fields that don't
 * apply given the current prop values (e.g. manual `links` is hidden when
 * `linksMode === 'auto'`). Keeps the inspector tight without changing the
 * underlying SchemaField type.
 */
const VISIBILITY: Partial<Record<SectionKind, (props: Record<string, unknown>, fieldName: string) => boolean>> = {
  navigation: (props, name) => {
    const linksMode = (props.linksMode as string) ?? "auto";
    const menuMode = (props.menuMode as string) ?? "current-page-sections";
    if (name === "linksLimit") return linksMode === "auto";
    if (name === "links") return linksMode === "manual";
    if (name === "menuSourcePageId") return menuMode === "page-sections";
    if (name === "menuItems") return menuMode === "manual";
    return true;
  },
};

export function getVisibleSectionSchema(
  kind: SectionKind,
  props: Record<string, unknown>,
): SchemaField[] {
  const all = getSectionSchema(kind);
  const pred = VISIBILITY[kind];
  return pred ? all.filter((f) => pred(props, f.name)) : all;
}

/** Field-name set that the layout/visibility groups own — excluded from content tab. */
export const LAYOUT_PROP_KEYS = ["background", "spacing", "align", "hidden", "showFrom", "showUntil"];

/* ------------------------------------------------------- design controls */

/**
 * The design knobs a marketer can turn on a section, keyed so developers
 * can trim the set per section kind (the way you'd only expose the spacing
 * variables you actually want a client to use). Everything is token-based:
 * values travel through the API as structured data, never raw CSS, so a
 * headless frontend maps tokens to its own styles.
 */
export type DesignControlKey =
  | "background"      // surface / muted / accent / inverse / custom color
  | "backgroundImage" // image URL + conditional overlay
  | "theme"           // section-scoped light / dark
  | "typography"      // text tone + font scale
  | "shape"           // radius, shadow, borders
  | "width"           // container width preset
  | "align"           // horizontal alignment
  | "padding"         // vertical + horizontal padding tokens
  | "gap"             // gap between blocks
  | "columns"         // grid column count (grid kinds only)
  | "fullHeight";     // stretch to viewport height

const DESIGN_DEFAULT: DesignControlKey[] = [
  "background", "backgroundImage", "theme", "typography", "shape",
  "width", "align", "padding", "gap", "columns",
];

/** Per-kind overrides. Chrome sections own their own width/padding, so they
 * only expose surface-level knobs; heroes and CTAs may go full-viewport. */
const DESIGN_OVERRIDES: Partial<Record<SectionKind, DesignControlKey[]>> = {
  hero: [...DESIGN_DEFAULT, "fullHeight"],
  cta: [...DESIGN_DEFAULT, "fullHeight"],
  navigation: ["background", "theme", "typography"],
  header: ["background", "theme", "typography"],
  footer: ["background", "theme", "typography"],
};

export function sectionDesignControls(kind: SectionKind): Set<DesignControlKey> {
  return new Set(DESIGN_OVERRIDES[kind] ?? DESIGN_DEFAULT);
}

