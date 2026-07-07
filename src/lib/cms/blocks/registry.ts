/**
 * Block registry — single source of truth for block kinds, default props,
 * editing fields, container behaviour, and library presentation.
 *
 * Consumed by: BlockLibrary modal, inspector BlockList + field form, and
 * the preview BlockRenderer.
 */
import type { ComponentType } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlignLeft, AlignStartHorizontal, Box, Code2, Columns2, Columns3, Columns4,
  CreditCard, FileCode, Frame, Grid3x3, Heading1, Image as ImageIcon,
  Layers, LayoutGrid, Link2, List as ListIcon, ListTree, MessageSquareQuote,
  MousePointerClick, PanelTop, PlaySquare, Quote, Rows3, Type as TypeIcon, Video,
} from "lucide-react";
import type { Block, BlockKind, ID, SchemaField } from "../types";

export type { Block, BlockKind } from "../types";

export type BlockGroup =
  | "Content" | "Media" | "Action" | "Layout" | "Interactive" | "Advanced";

export interface BlockDefinition {
  kind: BlockKind;
  label: string;
  group: BlockGroup;
  description: string;
  icon: LucideIcon;
  isContainer?: boolean;
  defaults: () => Record<string, unknown>;
  fields: SchemaField[];
  /** Field names that should render in the always-visible Essentials section
   *  of an expanded block row. All others go behind the Advanced disclosure. */
  essentialFields?: string[];
  initialChildren?: () => Block[];
}

const f = (
  name: string,
  label: string,
  type: SchemaField["type"],
  extra: Partial<SchemaField> = {},
): SchemaField => ({ id: `bf_${name}`, name, label, type, ...extra });

// ID generator shared with operations; avoids store coupling.
let _bc = 0;
export const newBlockId = (): ID =>
  `bk_${Date.now().toString(36)}_${(_bc++).toString(36)}`;

const child = (kind: BlockKind, props: Record<string, unknown> = {}): Block => ({
  id: newBlockId(), kind, props,
});

export const BLOCK_REGISTRY: Record<BlockKind, BlockDefinition> = {
  // ----- Content -----
  heading: {
    kind: "heading", group: "Content", label: "Heading",
    description: "A title from H1 to H6.", icon: Heading1,
    defaults: () => ({ text: "Heading", level: "2" }),
    essentialFields: ["text", "level", "align"],
    fields: [
      f("text", "Text", "text", { placeholder: "Heading text" }),
      f("level", "Level", "select", {
        options: ["1", "2", "3", "4", "5", "6"],
        defaultValue: "2",
        ui: "segmented",
        optionLabels: { "1": "H1", "2": "H2", "3": "H3", "4": "H4", "5": "H5", "6": "H6" },
      }),
      f("align", "Alignment", "select", {
        options: ["left", "center", "right"],
        defaultValue: "left",
        ui: "icons",
        icons: { left: "AlignLeft", center: "AlignCenter", right: "AlignRight" },
      }),
    ],
  },
  paragraph: {
    kind: "paragraph", group: "Content", label: "Paragraph",
    description: "A block of plain text.", icon: TypeIcon,
    defaults: () => ({ text: "Write a short paragraph…" }),
    essentialFields: ["text", "align"],
    fields: [
      f("text", "Text", "text", { placeholder: "Paragraph copy" }),
      f("align", "Alignment", "select", {
        options: ["left", "center", "right", "justify"],
        defaultValue: "left",
        ui: "icons",
        icons: { left: "AlignLeft", center: "AlignCenter", right: "AlignRight", justify: "AlignJustify" },
      }),
      f("muted", "Subtle style", "boolean", { description: "Render in a softer, lower-emphasis tone." }),
    ],
  },
  richText: {
    kind: "richText", group: "Content", label: "Rich Text",
    description: "Formatted body with inline styles.",
    icon: AlignLeft,
    defaults: () => ({ html: "" }),
    essentialFields: ["html"],
    fields: [f("html", "Body", "richText")],
  },
  quote: {
    kind: "quote", group: "Content", label: "Quote",
    description: "A pull quote with attribution.", icon: Quote,
    defaults: () => ({ text: "A great quote goes here.", cite: "" }),
    essentialFields: ["text", "cite"],
    fields: [
      f("text", "Quote", "text"),
      f("cite", "Attribution", "text", { placeholder: "— Author" }),
    ],
  },
  list: {
    kind: "list", group: "Content", label: "List",
    description: "Bulleted or numbered list.", icon: ListIcon,
    defaults: () => ({ items: "Item one\nItem two\nItem three", ordered: false }),
    essentialFields: ["items", "ordered"],
    fields: [
      f("items", "Items", "code", { description: "One item per line." }),
      f("ordered", "Numbered", "boolean"),
    ],
  },
  code: {
    kind: "code", group: "Content", label: "Code Block",
    description: "Monospaced code snippet.", icon: Code2,
    defaults: () => ({ code: "// your code", language: "ts" }),
    essentialFields: ["code"],
    fields: [
      f("code", "Code", "code"),
      f("language", "Language", "text", { placeholder: "ts" }),
    ],
  },

  // ----- Media -----
  image: {
    kind: "image", group: "Media", label: "Image",
    description: "Single image with caption.", icon: ImageIcon,
    defaults: () => ({ src: "", alt: "", caption: "", ratio: "16/9" }),
    essentialFields: ["src", "alt"],
    fields: [
      f("src", "Source", "image"),
      f("alt", "Alt text", "text"),
      f("caption", "Caption", "text"),
      f("ratio", "Aspect ratio", "select", {
        options: ["16/9", "4/3", "1/1", "3/4", "9/16"],
        defaultValue: "16/9",
        ui: "chips",
      }),
    ],
  },
  video: {
    kind: "video", group: "Media", label: "Video",
    description: "Embedded video player.", icon: Video,
    defaults: () => ({ src: "", poster: "" }),
    essentialFields: ["src"],
    fields: [
      f("src", "Video URL", "url"),
      f("poster", "Poster image", "image"),
    ],
  },

  // ----- Action -----
  button: {
    kind: "button", group: "Action", label: "Button",
    description: "Call to action link.", icon: MousePointerClick,
    defaults: () => ({ label: "Get started", href: "#", variant: "primary" }),
    essentialFields: ["label", "href", "variant"],
    fields: [
      f("label", "Label", "text"),
      f("href", "URL", "url"),
      f("variant", "Variant", "select", {
        options: ["primary", "secondary", "ghost", "outline"],
        defaultValue: "primary",
        ui: "segmented",
      }),
    ],
  },
  "cta-group": {
    kind: "cta-group", group: "Action", label: "CTA Group",
    description: "A pair of action buttons side by side.", icon: Link2,
    isContainer: true,
    defaults: () => ({ align: "left" }),
    essentialFields: ["align"],
    fields: [
      f("align", "Alignment", "select", {
        options: ["left", "center", "right"],
        defaultValue: "left",
        ui: "icons",
        icons: { left: "AlignLeft", center: "AlignCenter", right: "AlignRight" },
      }),
    ],
    initialChildren: () => [
      child("button", { label: "Primary action", href: "#", variant: "primary" }),
      child("button", { label: "Learn more", href: "#", variant: "ghost" }),
    ],
  },

  // ----- Layout -----
  container: {
    kind: "container", group: "Layout", label: "Container",
    description: "Bounded width wrapper with padding.", icon: Frame,
    isContainer: true,
    defaults: () => ({ maxWidth: "lg", padding: "md" }),
    essentialFields: ["maxWidth", "padding"],
    fields: [
      f("maxWidth", "Max width", "select", {
        options: ["sm", "md", "lg", "xl", "full"],
        defaultValue: "lg",
        ui: "chips",
      }),
      f("padding", "Padding", "select", {
        options: ["none", "sm", "md", "lg"],
        defaultValue: "md",
        ui: "chips",
      }),
    ],
  },
  stack: {
    kind: "stack", group: "Layout", label: "Stack",
    description: "Flex layout with gap. Horizontal or vertical.", icon: Rows3,
    isContainer: true,
    defaults: () => ({ direction: "row", gap: "md", align: "center", wrap: true }),
    essentialFields: ["direction", "gap", "align", "wrap"],
    fields: [
      f("direction", "Direction", "select", {
        options: ["row", "column"], defaultValue: "row", ui: "segmented",
      }),
      f("gap", "Gap", "select", {
        options: ["xs", "sm", "md", "lg"], defaultValue: "md", ui: "chips",
      }),
      f("align", "Alignment", "select", {
        options: ["start", "center", "end", "stretch"],
        defaultValue: "center",
        ui: "segmented",
      }),
      f("wrap", "Wrap", "boolean"),
    ],
  },
  grid: {
    kind: "grid", group: "Layout", label: "Grid",
    description: "Responsive multi-column grid.", icon: Grid3x3,
    isContainer: true,
    defaults: () => ({ columns: 3, gap: "md" }),
    essentialFields: ["columns", "gap"],
    fields: [
      f("columns", "Columns", "number", {
        defaultValue: 3,
        ui: "stepper",
        validation: { min: 1, max: 6 },
      }),
      f("gap", "Gap", "select", {
        options: ["xs", "sm", "md", "lg"], defaultValue: "md", ui: "chips",
      }),
    ],
    initialChildren: () => [
      child("card", { title: "Card one", body: "Short description." }),
      child("card", { title: "Card two", body: "Short description." }),
      child("card", { title: "Card three", body: "Short description." }),
    ],
  },
  columns: {
    kind: "columns", group: "Layout", label: "Columns",
    description: "Fixed 2/3/4 column layout.", icon: Columns3,
    isContainer: true,
    defaults: () => ({ count: "2", gap: "md" }),
    essentialFields: ["count", "gap"],
    fields: [
      f("count", "Count", "select", {
        options: ["2", "3", "4"], defaultValue: "2", ui: "segmented",
      }),
      f("gap", "Gap", "select", {
        options: ["xs", "sm", "md", "lg"], defaultValue: "md", ui: "chips",
      }),
    ],
    initialChildren: () => [
      child("stack", { gap: "sm" }),
      child("stack", { gap: "sm" }),
    ],
  },
  "card-group": {
    kind: "card-group", group: "Layout", label: "Card Group",
    description: "A horizontal row of cards.", icon: LayoutGrid,
    isContainer: true,
    defaults: () => ({ gap: "md" }),
    essentialFields: ["gap"],
    fields: [
      f("gap", "Gap", "select", {
        options: ["xs", "sm", "md", "lg"], defaultValue: "md", ui: "chips",
      }),
    ],
    initialChildren: () => [
      child("card", { title: "Card", body: "Body" }),
      child("card", { title: "Card", body: "Body" }),
    ],
  },
  card: {
    kind: "card", group: "Layout", label: "Card",
    description: "A bordered card with title, body, and slot.", icon: CreditCard,
    isContainer: true,
    defaults: () => ({ title: "Card title", body: "Short description.", padded: true }),
    essentialFields: ["title", "body"],
    fields: [
      f("title", "Title", "text"),
      f("body", "Body", "text"),
      f("padded", "Inner padding", "boolean"),
    ],
  },

  // ----- Interactive (visual placeholder this phase) -----
  accordion: {
    kind: "accordion", group: "Interactive", label: "Accordion",
    description: "Collapsible Q&A list.", icon: ListTree,
    defaults: () => ({
      items: "What is BetterCMS?|A composable headless CMS.\nIs it free?|Yes, during preview.",
    }),
    essentialFields: ["items"],
    fields: [
      f("items", "Items", "code", { description: "One per line, in the form Question|Answer." }),
    ],
  },
  tabs: {
    kind: "tabs", group: "Interactive", label: "Tabs",
    description: "Tabbed content panels.", icon: PanelTop,
    defaults: () => ({ labels: "Overview, Features, Pricing", body: "Tab body…" }),
    essentialFields: ["labels", "body"],
    fields: [
      f("labels", "Tabs", "text", { description: "Comma separated labels." }),
      f("body", "Body", "text"),
    ],
  },

  // ----- Advanced -----
  embed: {
    kind: "embed", group: "Advanced", label: "Embed",
    description: "External iframe embed.", icon: PlaySquare,
    defaults: () => ({ url: "" }),
    essentialFields: ["url"],
    fields: [f("url", "URL", "url")],
  },
  html: {
    kind: "html", group: "Advanced", label: "HTML",
    description: "Raw HTML snippet.", icon: FileCode,
    defaults: () => ({ html: "<div>Custom HTML</div>" }),
    essentialFields: ["html"],
    fields: [f("html", "HTML", "code")],
  },

  // ----- Site chrome (Phase 2 migration) -----
  "nav-bar": {
    kind: "nav-bar", group: "Layout", label: "Nav bar",
    description: "Horizontal navigation container.", icon: PanelTop,
    isContainer: true,
    defaults: () => ({ justify: "between", sticky: false }),
    essentialFields: ["justify", "sticky"],
    fields: [
      f("justify", "Layout", "select", {
        options: ["between", "start", "end"],
        defaultValue: "between",
        ui: "segmented",
      }),
      f("sticky", "Sticky", "boolean"),
    ],
  },
  "nav-logo": {
    kind: "nav-logo", group: "Content", label: "Logo",
    description: "Brand text or uploaded logo image (light/dark).", icon: Box,
    defaults: () => ({ text: "Brand", mark: true, lightSrc: "", darkSrc: "", imageAlt: "", height: "md" }),
    essentialFields: ["lightSrc", "darkSrc", "imageAlt", "height", "text", "mark"],
    fields: [
      f("lightSrc", "Logo (light mode)", "image", { description: "SVG or PNG shown on light backgrounds." }),
      f("darkSrc", "Logo (dark mode)", "image", { description: "Optional. Falls back to the light-mode logo." }),
      f("imageAlt", "Alt text", "text"),
      f("height", "Logo size", "select", {
        options: ["sm", "md", "lg"], defaultValue: "md", ui: "segmented",
      }),
      f("text", "Text fallback", "text", { description: "Shown when no image is uploaded." }),
      f("mark", "Show gradient mark", "boolean"),
    ],
  },
  "nav-links": {
    kind: "nav-links", group: "Content", label: "Nav links",
    description: "Inline navigation links.", icon: ListIcon,
    defaults: () => ({ items: "Product|/product\nPricing|/pricing\nDocs|/docs" }),
    essentialFields: ["items"],
    fields: [
      f("items", "Items", "code", { description: "One per line, in the form Label|/href." }),
    ],
  },
  "nav-search": {
    kind: "nav-search", group: "Interactive", label: "Search",
    description: "Search trigger with a shortcut hint.", icon: Layers,
    defaults: () => ({ placeholder: "Search…", shortcut: "⌘K" }),
    essentialFields: ["placeholder", "shortcut"],
    fields: [
      f("placeholder", "Placeholder", "text"),
      f("shortcut", "Shortcut hint", "text"),
    ],
  },
  "footer-bar": {
    kind: "footer-bar", group: "Layout", label: "Footer bar",
    description: "Horizontal footer container.", icon: PanelTop,
    isContainer: true,
    defaults: () => ({ justify: "between" }),
    essentialFields: ["justify"],
    fields: [
      f("justify", "Layout", "select", {
        options: ["between", "start", "end"],
        defaultValue: "between",
        ui: "segmented",
      }),
    ],
  },
};

export const ALL_BLOCK_KINDS: BlockKind[] = Object.keys(BLOCK_REGISTRY) as BlockKind[];

export const BLOCK_GROUPS: BlockGroup[] = [
  "Content", "Media", "Action", "Layout", "Interactive", "Advanced",
];

export function isContainer(kind: BlockKind): boolean {
  return !!BLOCK_REGISTRY[kind]?.isContainer;
}

export type BlockRendererProps<T extends Record<string, unknown> = Record<string, unknown>> = {
  block: Block;
  props: T;
  children?: React.ReactNode;
};

export type BlockRendererMap = Partial<
  Record<BlockKind, ComponentType<BlockRendererProps>>
>;

// keep import side-effect-friendly
void Box; void AlignStartHorizontal; void Layers; void MessageSquareQuote;
void Columns2; void Columns4;
