/**
 * SectionSystem — the "slice" model for BetterCMS, designed marketer-first.
 *
 * The contract:
 * - DEVELOPERS register sections in code (this catalog stands in for that API).
 *   A section = name + category + variants (layouts) + a small field schema +
 *   defaults + a real React renderer. New registrations appear in the library
 *   automatically; marketers never see schema complexity.
 * - MARKETERS compose pages from these sections in the visual editor: browse the
 *   library (live previews, not screenshots), insert between sections, reorder,
 *   duplicate, swap layout, delete. Every text field stays inline-editable.
 * - CONTENT EDITORS only edit text inline; page structure is not exposed to them.
 *
 * A page is just an ordered list of SectionInstance. Field ids are
 * `${sectionId}.${fieldKey}`, which the comment system and form panel reuse.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  Code2,
  CreditCard,
  FileText,
  HelpCircle,
  LayoutGrid,
  LayoutTemplate,
  Mail,
  Megaphone,
  Newspaper,
  PanelsTopLeft,
  Plus,
  Quote,
  Search,
  Sparkles,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ types */

export interface FieldDef {
  key: string;
  label: string;
  multiline?: boolean;
}
export interface SectionVariant {
  id: string;
  name: string;
}
export interface RenderProps {
  c: Record<string, string>;
  variant: string;
  editable: boolean;
  onEdit: (key: string, value: string) => void;
  /** Field id for comment/form anchoring; undefined in previews. */
  fid: (key: string) => string | undefined;
  label: (key: string) => string | undefined;
}
export interface SectionDef {
  type: string;
  name: string;
  blurb: string;
  category: string;
  icon: LucideIcon;
  variants: SectionVariant[];
  fields: FieldDef[];
  defaults: Record<string, string>;
  render: (p: RenderProps) => ReactNode;
}
/** Spacing scale shared by the design padding controls. */
export const SPACE_TOKENS = ["none", "xs", "sm", "md", "lg", "xl", "2xl", "3xl"] as const;
export type SpaceToken = (typeof SPACE_TOKENS)[number];
/** Short labels for the spacing slider stops. */
export const SPACE_LABELS: Record<SpaceToken, string> = {
  none: "0", xs: "XS", sm: "S", md: "M", lg: "L", xl: "XL", "2xl": "2XL", "3xl": "3XL",
};

/** Marketer-set, token-based design overrides on a section instance. Stored
 *  as structured tokens (never raw CSS) so a headless frontend maps them and
 *  managed hosting renders them with the maps below. */
export interface SectionDesign {
  theme?: "inherit" | "light" | "dark";
  background?: "default" | "surface" | "muted" | "accent" | "inverse" | "custom";
  /** Custom hex/CSS color when background is "custom". */
  backgroundColor?: string;
  backgroundImage?: string;
  /** 0-100 dark scrim over the background image, for legibility. */
  overlayOpacity?: number;
  /** 0-100 opacity of the whole section. */
  opacity?: number;
  /** Independent inner padding on the spacing scale. */
  paddingTop?: SpaceToken;
  paddingBottom?: SpaceToken;
  paddingX?: SpaceToken;
  /** Constrain and position the content column. */
  maxWidth?: "full" | "wide" | "default" | "narrow";
  align?: "left" | "center" | "right";
  radius?: "none" | "sm" | "md" | "lg" | "xl" | "2xl";
  shadow?: "none" | "sm" | "md" | "lg" | "xl";
  borderTop?: boolean;
  borderBottom?: boolean;
  fullHeight?: boolean;
}

export interface SectionInstance {
  id: string;
  type: string;
  variant: string;
  content: Record<string, string>;
  /** Optional per-section design overrides (spacing, theme, background…). */
  design?: SectionDesign;
}

const D_PT: Record<SpaceToken, string> = { none: "pt-0", xs: "pt-3", sm: "pt-6", md: "pt-10", lg: "pt-16", xl: "pt-24", "2xl": "pt-32", "3xl": "pt-40" };
const D_PB: Record<SpaceToken, string> = { none: "pb-0", xs: "pb-3", sm: "pb-6", md: "pb-10", lg: "pb-16", xl: "pb-24", "2xl": "pb-32", "3xl": "pb-40" };
const D_PX: Record<SpaceToken, string> = { none: "px-0", xs: "px-3", sm: "px-6", md: "px-10", lg: "px-16", xl: "px-24", "2xl": "px-32", "3xl": "px-40" };
const D_BG: Record<string, string> = { default: "", surface: "bg-slate-50", muted: "bg-slate-100", accent: "bg-indigo-50", inverse: "bg-slate-900", custom: "" };
const D_MAXW: Record<string, string> = { full: "max-w-none", wide: "max-w-6xl", default: "max-w-4xl", narrow: "max-w-2xl" };
const D_RADIUS: Record<string, string> = { none: "", sm: "rounded-md", md: "rounded-lg", lg: "rounded-xl", xl: "rounded-2xl", "2xl": "rounded-3xl" };
const D_SHADOW: Record<string, string> = { none: "", sm: "shadow-sm", md: "shadow-md", lg: "shadow-lg", xl: "shadow-xl" };

/** A dark surface needs the light-text scope so headings don't vanish. */
export function isDarkSurface(d?: SectionDesign): boolean {
  return d?.theme === "dark" || d?.background === "inverse";
}

/** Has the marketer set anything that changes how the section paints? */
export function sectionHasDesign(d?: SectionDesign): boolean {
  if (!d) return false;
  return !!(
    (d.theme && d.theme !== "inherit") ||
    (d.background && d.background !== "default") ||
    d.backgroundImage || d.paddingTop || d.paddingBottom || d.paddingX ||
    (d.maxWidth && d.maxWidth !== "full") || (d.align && d.align !== "left") ||
    (d.radius && d.radius !== "none") || (d.shadow && d.shadow !== "none") ||
    d.borderTop || d.borderBottom || d.fullHeight ||
    (d.opacity != null && d.opacity < 100)
  );
}

/** Token → Tailwind classes for the OUTER design wrapper on the canvas. */
export function sectionDesignClass(d?: SectionDesign): string {
  if (!d) return "";
  const cls: string[] = [];
  if (d.theme === "dark") cls.push("bg-slate-950 text-slate-100");
  else if (d.theme === "light") cls.push("bg-white text-slate-900");
  else if (d.background && d.background !== "default" && d.background !== "custom") cls.push(D_BG[d.background] ?? "");
  if (isDarkSurface(d)) cls.push("bcms-sec-dark text-slate-100");
  if (d.paddingTop) cls.push(D_PT[d.paddingTop]);
  if (d.paddingBottom) cls.push(D_PB[d.paddingBottom]);
  if (d.paddingX) cls.push(D_PX[d.paddingX]);
  if (d.radius && d.radius !== "none") cls.push(D_RADIUS[d.radius], "overflow-hidden");
  if (d.shadow && d.shadow !== "none") cls.push(D_SHADOW[d.shadow]);
  if (d.borderTop) cls.push("border-t border-slate-200");
  if (d.borderBottom) cls.push("border-b border-slate-200");
  if (d.fullHeight) cls.push("min-h-screen flex flex-col justify-center");
  return cls.filter(Boolean).join(" ");
}

/** Inner content-column classes (max width + horizontal alignment). */
export function sectionInnerClass(d?: SectionDesign): string {
  if (!d) return "";
  const hasWidth = d.maxWidth && d.maxWidth !== "full";
  const hasAlign = d.align && d.align !== "left";
  if (!hasWidth && !hasAlign) return "";
  const cls: string[] = [];
  if (hasWidth) cls.push(D_MAXW[d.maxWidth!] ?? "");
  cls.push(d.align === "center" ? "mx-auto" : d.align === "right" ? "ml-auto" : "mr-auto");
  return cls.filter(Boolean).join(" ");
}

export function sectionDesignStyle(d?: SectionDesign): React.CSSProperties | undefined {
  if (!d) return undefined;
  const style: React.CSSProperties = {};
  if (d.background === "custom" && d.backgroundColor) style.backgroundColor = d.backgroundColor;
  if (d.backgroundImage) {
    style.backgroundImage = `url(${d.backgroundImage})`;
    style.backgroundSize = "cover";
    style.backgroundPosition = "center";
  }
  if (d.opacity != null && d.opacity < 100) style.opacity = Math.max(0, d.opacity) / 100;
  return Object.keys(style).length ? style : undefined;
}

/** 0..1 scrim opacity, only when a background image is set. */
export function sectionOverlay(d?: SectionDesign): number {
  return d?.backgroundImage ? Math.max(0, Math.min(100, d.overlayOpacity ?? 0)) / 100 : 0;
}

export const SECTION_CATEGORIES = ["Hero", "Content", "Social proof", "Conversion"];

let seq = 0;
export function createSection(type: string, variant?: string): SectionInstance {
  const def = getSectionDef(type);
  return {
    id: `sec_${Date.now().toString(36)}${(seq++).toString(36)}`,
    type,
    variant: variant ?? def?.variants[0]?.id ?? "default",
    content: { ...(def?.defaults ?? {}) },
  };
}
export function getSectionDef(type: string): SectionDef | undefined {
  return SECTION_DEFS.find((d) => d.type === type);
}

/* ------------------------------------------------------- inline text field */

/** Inline click-to-edit text. Uncontrolled while focused to keep the caret stable. */
export function InlineText({
  value,
  onCommit,
  as: Tag = "span",
  className,
  editable,
  multiline,
  rich,
  dataField,
  dataLabel,
}: {
  value: string;
  onCommit: (v: string) => void;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  editable: boolean;
  multiline?: boolean;
  /** Preserve inline formatting (bold/italic/links) via innerHTML. */
  rich?: boolean;
  /** Tag this element as a commentable content field. */
  dataField?: string;
  dataLabel?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const editing = useRef(false);

  useEffect(() => {
    if (editing.current || !ref.current) return;
    if (rich) {
      if (ref.current.innerHTML !== value) ref.current.innerHTML = value;
    } else if (ref.current.textContent !== value) {
      ref.current.textContent = value;
    }
  });

  return (
    <Tag
      ref={ref as never}
      data-field={dataField}
      data-field-label={dataLabel}
      contentEditable={editable}
      suppressContentEditableWarning
      role={editable ? "textbox" : undefined}
      tabIndex={editable ? 0 : undefined}
      onFocus={() => (editing.current = true)}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        editing.current = false;
        const next = rich ? e.currentTarget.innerHTML : e.currentTarget.textContent ?? "";
        if (next !== value) onCommit(next);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (!multiline && e.key === "Enter") {
          e.preventDefault();
          (e.currentTarget as HTMLElement).blur();
        }
      }}
      className={cn(
        className,
        editable &&
          "cursor-text rounded-[3px] outline-none transition-shadow hover:shadow-[0_0_0_1.5px_rgba(99,102,241,0.4)] focus:shadow-[0_0_0_2px_rgba(99,102,241,0.9)]",
      )}
    />
  );
}

/** Shorthand used by section renderers. */
function Txt({
  p,
  k,
  as = "span",
  className,
  multiline,
  rich,
}: {
  p: RenderProps;
  k: string;
  as?: "span" | "h1" | "h2" | "h3" | "p" | "div";
  className?: string;
  multiline?: boolean;
  rich?: boolean;
}) {
  return (
    <InlineText
      as={as}
      value={p.c[k] ?? ""}
      onCommit={(v) => p.onEdit(k, v)}
      editable={p.editable}
      multiline={multiline}
      rich={rich}
      dataField={p.fid(k)}
      dataLabel={p.label(k)}
      className={className}
    />
  );
}

/* ---------------------------------------------------------------- catalog */

const LOGOS = ["Northwind", "Vertex", "Alpine", "Quartz", "Halcyon"];
const PLANS = [
  { name: "Starter", price: "$0", blurb: "For side projects", featured: false },
  { name: "Growth", price: "$29", blurb: "For growing teams", featured: true },
  { name: "Scale", price: "$99", blurb: "For serious traffic", featured: false },
];

export const SECTION_DEFS: SectionDef[] = [
  {
    type: "hero",
    name: "Hero",
    blurb: "Big opening statement with calls to action",
    category: "Hero",
    icon: PanelsTopLeft,
    variants: [
      { id: "centered", name: "Centered" },
      { id: "split", name: "Split with media" },
    ],
    fields: [
      { key: "badge", label: "Badge" },
      { key: "headline", label: "Headline", multiline: true },
      { key: "subheadline", label: "Subheadline", multiline: true },
      { key: "primaryCta", label: "Primary CTA" },
      { key: "secondaryCta", label: "Secondary CTA" },
    ],
    defaults: {
      badge: "New",
      headline: "A better way to build your site",
      subheadline: "Compose pages from sections your team already approved.",
      primaryCta: "Get started",
      secondaryCta: "Learn more",
    },
    render: (p) =>
      p.variant === "split" ? (
        <div className="grid grid-cols-1 items-center gap-8 px-8 pb-12 pt-10 md:grid-cols-2">
          <div>
            <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
              <Txt p={p} k="badge" />
            </span>
            <Txt p={p} k="headline" as="h1" multiline rich className="mt-4 block text-[28px] font-bold leading-[1.12] tracking-tight text-slate-900" />
            <Txt p={p} k="subheadline" as="p" multiline rich className="mt-3 block text-[14px] leading-relaxed text-slate-500" />
            <div className="mt-5 flex items-center gap-3">
              <span className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white">
                <Txt p={p} k="primaryCta" />
              </span>
              <span className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700">
                <Txt p={p} k="secondaryCta" />
              </span>
            </div>
          </div>
          <div className="h-56 rounded-xl bg-gradient-to-br from-indigo-100 via-white to-fuchsia-100 ring-1 ring-slate-200" />
        </div>
      ) : (
        <div className="px-8 pb-10 pt-8 text-center">
          <span className="inline-block rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-indigo-600">
            <Txt p={p} k="badge" />
          </span>
          <Txt p={p} k="headline" as="h1" multiline rich className="mx-auto mt-4 block max-w-2xl text-[30px] font-bold leading-[1.1] tracking-tight text-slate-900" />
          <Txt p={p} k="subheadline" as="p" multiline rich className="mx-auto mt-4 block max-w-xl text-[14px] leading-relaxed text-slate-500" />
          <div className="mt-6 flex items-center justify-center gap-3">
            <span className="rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white">
              <Txt p={p} k="primaryCta" />
            </span>
            <span className="rounded-lg border border-slate-200 px-4 py-2 text-[13px] font-medium text-slate-700">
              <Txt p={p} k="secondaryCta" />
            </span>
          </div>
          <div className="mx-auto mt-8 h-40 max-w-2xl rounded-xl bg-gradient-to-br from-indigo-100 via-white to-fuchsia-100 ring-1 ring-slate-200" />
        </div>
      ),
  },
  {
    type: "features",
    name: "Feature grid",
    blurb: "Three column grid of highlights",
    category: "Content",
    icon: LayoutGrid,
    variants: [{ id: "grid", name: "Three columns" }],
    fields: [
      { key: "heading", label: "Heading" },
      { key: "item1", label: "Feature 1" },
      { key: "item2", label: "Feature 2" },
      { key: "item3", label: "Feature 3" },
    ],
    defaults: {
      heading: "Everything you need",
      item1: "Composable content",
      item2: "Realtime preview",
      item3: "Ship anywhere",
    },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-10">
        <Txt p={p} k="heading" as="h2" className="block text-center text-[20px] font-bold tracking-tight text-slate-900" />
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {(["item1", "item2", "item3"] as const).map((k) => (
            <div key={k} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500" />
              <Txt p={p} k={k} as="div" className="mt-3 block text-[13.5px] font-semibold text-slate-900" />
              <div className="mt-1 text-[12px] leading-relaxed text-slate-500">
                Everything your team needs to build and ship content faster.
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    type: "logos",
    name: "Logo cloud",
    blurb: "Row of customer logos",
    category: "Social proof",
    icon: Building2,
    variants: [{ id: "row", name: "Single row" }],
    fields: [{ key: "caption", label: "Caption" }],
    defaults: { caption: "Trusted by teams at" },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-8 text-center">
        <Txt p={p} k="caption" as="p" className="block text-[11px] font-semibold uppercase tracking-wide text-slate-400" />
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {LOGOS.map((n) => (
            <span key={n} className="text-[15px] font-bold tracking-tight text-slate-300">
              {n}
            </span>
          ))}
        </div>
      </div>
    ),
  },
  {
    type: "testimonial",
    name: "Testimonial",
    blurb: "Quote from a happy customer",
    category: "Social proof",
    icon: Quote,
    variants: [{ id: "quote", name: "Single quote" }],
    fields: [
      { key: "quote", label: "Quote", multiline: true },
      { key: "author", label: "Author" },
      { key: "role", label: "Author role" },
    ],
    defaults: {
      quote: "We shipped our new marketing site in a week. The team edits everything without waiting on engineering.",
      author: "Maya Chen",
      role: "Head of Growth, Northwind",
    },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-12">
        <div className="mx-auto max-w-2xl text-center">
          <Quote className="mx-auto h-5 w-5 text-indigo-300" aria-hidden />
          <Txt p={p} k="quote" as="p" multiline rich className="mt-3 block text-[19px] font-medium leading-snug tracking-tight text-slate-900" />
          <div className="mt-5 flex items-center justify-center gap-2.5">
            <span className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-fuchsia-400" />
            <div className="text-left">
              <Txt p={p} k="author" as="div" className="block text-[12.5px] font-semibold text-slate-900" />
              <Txt p={p} k="role" as="div" className="block text-[11.5px] text-slate-500" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    type: "cta",
    name: "Call to action",
    blurb: "Conversion banner with one action",
    category: "Conversion",
    icon: Megaphone,
    variants: [
      { id: "banner", name: "Banner" },
      { id: "split", name: "Text on left" },
    ],
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", multiline: true },
      { key: "ctaLabel", label: "Button label" },
    ],
    defaults: {
      heading: "Ready to ship faster?",
      subtext: "Start free and publish your first page today.",
      ctaLabel: "Start building",
    },
    render: (p) =>
      p.variant === "split" ? (
        <div className="px-8 py-10">
          <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-7 py-7 sm:flex-row sm:items-center">
            <div>
              <Txt p={p} k="heading" as="h2" className="block text-[18px] font-bold tracking-tight text-slate-900" />
              <Txt p={p} k="subtext" as="p" multiline className="mt-1 block text-[13px] text-slate-500" />
            </div>
            <span className="shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-[13px] font-semibold text-white">
              <Txt p={p} k="ctaLabel" />
            </span>
          </div>
        </div>
      ) : (
        <div className="px-8 py-10">
          <div className="rounded-2xl bg-gradient-to-r from-indigo-600 to-fuchsia-600 px-8 py-10 text-center">
            <Txt p={p} k="heading" as="h2" className="block text-[22px] font-bold tracking-tight text-white" />
            <Txt p={p} k="subtext" as="p" multiline className="mx-auto mt-2 block max-w-md text-[13px] leading-relaxed text-white/80" />
            <span className="mt-5 inline-block rounded-lg bg-white px-4 py-2 text-[13px] font-semibold text-indigo-700">
              <Txt p={p} k="ctaLabel" />
            </span>
          </div>
        </div>
      ),
  },
  {
    type: "pricing",
    name: "Pricing",
    blurb: "Three plan cards with a heading",
    category: "Conversion",
    icon: CreditCard,
    variants: [{ id: "three", name: "Three plans" }],
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", multiline: true },
    ],
    defaults: {
      heading: "Simple, transparent pricing",
      subtext: "Start free, scale as you grow.",
    },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-10">
        <Txt p={p} k="heading" as="h2" className="block text-center text-[20px] font-bold tracking-tight text-slate-900" />
        <Txt p={p} k="subtext" as="p" multiline className="mx-auto mt-1.5 block max-w-md text-center text-[13px] text-slate-500" />
        <div className="mx-auto mt-6 grid max-w-3xl grid-cols-1 gap-4 sm:grid-cols-3">
          {PLANS.map((pl) => (
            <div key={pl.name} className={cn("rounded-xl border p-5", pl.featured ? "border-indigo-600 ring-1 ring-indigo-600" : "border-slate-200")}>
              <div className="flex items-center justify-between">
                <div className="text-[13px] font-semibold text-slate-900">{pl.name}</div>
                {pl.featured && <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">Popular</span>}
              </div>
              <div className="mt-2 text-[24px] font-bold tracking-tight text-slate-900">
                {pl.price}
                <span className="text-[12px] font-medium text-slate-400">/mo</span>
              </div>
              <div className="mt-1 text-[12px] text-slate-500">{pl.blurb}</div>
              <div className={cn("mt-4 rounded-lg py-1.5 text-center text-[12px] font-semibold", pl.featured ? "bg-indigo-600 text-white" : "border border-slate-200 text-slate-700")}>
                Choose {pl.name}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    type: "faq",
    name: "FAQ",
    blurb: "Questions and answers list",
    category: "Content",
    icon: HelpCircle,
    variants: [{ id: "list", name: "Stacked list" }],
    fields: [
      { key: "heading", label: "Heading" },
      { key: "q1", label: "Question 1" },
      { key: "a1", label: "Answer 1", multiline: true },
      { key: "q2", label: "Question 2" },
      { key: "a2", label: "Answer 2", multiline: true },
    ],
    defaults: {
      heading: "Frequently asked questions",
      q1: "Can I change plans later?",
      a1: "Yes. Upgrades apply right away and downgrades take effect at the next billing cycle.",
      q2: "Is there a free trial?",
      a2: "Every site starts free. Paid plans add bandwidth, locales, and AI credits.",
    },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-10">
        <Txt p={p} k="heading" as="h2" className="block text-center text-[20px] font-bold tracking-tight text-slate-900" />
        <div className="mx-auto mt-6 max-w-xl space-y-3">
          {(["1", "2"] as const).map((n) => (
            <div key={n} className="rounded-xl border border-slate-100 bg-slate-50/60 p-4">
              <Txt p={p} k={`q${n}`} as="div" className="block text-[13.5px] font-semibold text-slate-900" />
              <Txt p={p} k={`a${n}`} as="p" multiline className="mt-1 block text-[12.5px] leading-relaxed text-slate-500" />
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    type: "contact",
    name: "Contact",
    blurb: "Simple contact form with a message box",
    category: "Conversion",
    icon: Mail,
    variants: [{ id: "simple", name: "Simple" }],
    fields: [
      { key: "heading", label: "Heading" },
      { key: "subtext", label: "Subtext", multiline: true },
      { key: "buttonLabel", label: "Button label" },
    ],
    defaults: {
      heading: "Talk to us",
      subtext: "Tell us about your project.",
      buttonLabel: "Send message",
    },
    render: (p) => (
      <div className="border-t border-slate-100 px-8 py-10">
        <div className="mx-auto max-w-md">
          <Txt p={p} k="heading" as="h2" className="block text-center text-[20px] font-bold tracking-tight text-slate-900" />
          <Txt p={p} k="subtext" as="p" multiline className="mt-1.5 block text-center text-[13px] text-slate-500" />
          <div className="mt-5 space-y-2.5">
            <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-[12.5px] text-slate-400">Your name</div>
            <div className="flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-[12.5px] text-slate-400">Work email</div>
            <div className="flex h-20 items-start rounded-md border border-slate-200 bg-white px-3 pt-2 text-[12.5px] text-slate-400">How can we help?</div>
            <div className="rounded-lg bg-indigo-600 py-2 text-center text-[13px] font-semibold text-white">
              <Txt p={p} k="buttonLabel" />
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

/* --------------------------------------------------------------- renderer */

export function SectionRenderer({
  section,
  editable,
  onEdit,
}: {
  section: SectionInstance;
  editable: boolean;
  onEdit: (key: string, value: string) => void;
}) {
  const def = getSectionDef(section.type);
  if (!def) return null;
  const p: RenderProps = {
    c: { ...def.defaults, ...section.content },
    variant: section.variant,
    editable,
    onEdit,
    fid: (k) => `${section.id}.${k}`,
    label: (k) => def.fields.find((f) => f.key === k)?.label,
  };
  return <>{def.render(p)}</>;
}

/** Live scaled preview of a section, rendered from its defaults. */
export function SectionPreview({ def, variant }: { def: SectionDef; variant: string }) {
  const p: RenderProps = {
    c: def.defaults,
    variant,
    editable: false,
    onEdit: () => {},
    fid: () => undefined,
    label: () => undefined,
  };
  return (
    <div className="pointer-events-none h-36 select-none overflow-hidden bg-white [mask-image:linear-gradient(to_bottom,black_78%,transparent)]" aria-hidden>
      <div style={{ width: 1000, transform: "scale(0.34)", transformOrigin: "top left" }}>{def.render(p)}</div>
    </div>
  );
}

/* ---------------------------------------------------------------- library */

/**
 * SectionLibrary — the marketer-facing browser. Searchable, categorized, with
 * LIVE previews (the actual section components scaled down, not screenshots).
 */
export function SectionLibrary({
  open,
  onClose,
  onAdd,
}: {
  open: boolean;
  onClose: () => void;
  onAdd: (type: string, variant: string) => void;
}) {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [sel, setSel] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCat("All");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const query = q.trim().toLowerCase();
  const filtered = SECTION_DEFS.filter((d) => {
    if (cat !== "All" && d.category !== cat) return false;
    return !query || d.name.toLowerCase().includes(query) || d.blurb.toLowerCase().includes(query) || d.category.toLowerCase().includes(query);
  });
  const variantTotal = SECTION_DEFS.reduce((n, d) => n + d.variants.length, 0);

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Section library"
        className="absolute left-1/2 top-[6vh] flex max-h-[86vh] w-[min(980px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        {/* header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <Plus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Add a section</div>
            <div className="truncate text-[11.5px] text-slate-500">
              {SECTION_DEFS.length} sections, {variantTotal} layouts. Defined by your developers, always on brand.
            </div>
          </div>
          <div className="relative w-56 shrink-0">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search sections…"
              aria-label="Search sections"
              className="h-8 w-full rounded-md border border-slate-200 pl-8 pr-2 text-[12.5px] outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* body */}
        <div className="flex min-h-0 flex-1">
          {/* categories rail */}
          <div className="flex w-48 shrink-0 flex-col gap-0.5 border-r border-slate-100 p-2">
            {["All", ...SECTION_CATEGORIES].map((c) => {
              const count = c === "All" ? SECTION_DEFS.length : SECTION_DEFS.filter((d) => d.category === c).length;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCat(c)}
                  aria-pressed={cat === c}
                  className={cn(
                    "flex items-center justify-between rounded-md px-2.5 py-1.5 text-left text-[12.5px] font-medium transition-colors",
                    cat === c ? "bg-slate-100 text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-700",
                  )}
                >
                  {c === "All" ? "All sections" : c}
                  <span className="text-[11px] text-slate-400">{count}</span>
                </button>
              );
            })}
            <div className="mt-auto rounded-lg bg-slate-50 p-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                <Code2 className="h-3.5 w-3.5 text-indigo-500" /> Built in code
              </div>
              <p className="mt-1 text-[10.5px] leading-snug text-slate-500">
                Sections are components your developers register through the API. New ones show up here automatically.
              </p>
            </div>
          </div>

          {/* cards */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-[12.5px] text-slate-400">No sections match “{q}”.</div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {filtered.map((def) => {
                  const variant = sel[def.type] ?? def.variants[0].id;
                  return (
                    <div key={def.type} className="group overflow-hidden rounded-xl border border-slate-200 transition-all hover:border-indigo-300 hover:shadow-[0_8px_30px_-12px_rgba(79,70,229,0.35)]">
                      <button
                        type="button"
                        onClick={() => onAdd(def.type, variant)}
                        aria-label={`Add ${def.name}, ${def.variants.find((v) => v.id === variant)?.name ?? variant} layout`}
                        className="relative block w-full text-left"
                      >
                        <SectionPreview def={def} variant={variant} />
                        <span className="pointer-events-none absolute inset-0 grid place-items-center bg-indigo-600/0 transition-colors group-hover:bg-indigo-600/[0.04]">
                          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            <Plus className="h-3.5 w-3.5" /> Add section
                          </span>
                        </span>
                      </button>
                      <div className="border-t border-slate-100 px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                            <def.icon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[12.5px] font-semibold text-slate-900">{def.name}</div>
                            <div className="truncate text-[11px] text-slate-500">{def.blurb}</div>
                          </div>
                        </div>
                        {def.variants.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {def.variants.map((v) => (
                              <button
                                key={v.id}
                                type="button"
                                onClick={() => setSel((m) => ({ ...m, [def.type]: v.id }))}
                                aria-pressed={variant === v.id}
                                className={cn(
                                  "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors",
                                  variant === v.id
                                    ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                                    : "border-slate-200 text-slate-500 hover:bg-slate-50",
                                )}
                              >
                                {variant === v.id && <Check className="h-3 w-3" />}
                                {v.name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ---------------------------------------------------------- page templates */

/**
 * PageTemplate — a reusable stack of sections. Built-in templates ship with
 * the site; marketers and developers can save any page as a new template.
 * Content editors and reviewers never see this surface.
 */
export interface PageTemplate {
  id: string;
  name: string;
  blurb: string;
  icon: LucideIcon;
  custom?: boolean;
  sections: { type: string; variant?: string; content?: Record<string, string> }[];
}

export function instantiateTemplate(t: PageTemplate): SectionInstance[] {
  return t.sections.map((s) => {
    const inst = createSection(s.type, s.variant);
    return { ...inst, content: { ...inst.content, ...(s.content ?? {}) } };
  });
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: "landing",
    name: "Landing page",
    blurb: "Full marketing page with proof and conversion",
    icon: LayoutTemplate,
    sections: [
      { type: "hero", variant: "centered" },
      { type: "logos" },
      { type: "features" },
      { type: "testimonial" },
      { type: "cta", variant: "banner" },
    ],
  },
  {
    id: "case-study",
    name: "Case study",
    blurb: "Customer story with results and a quote",
    icon: Briefcase,
    sections: [
      {
        type: "hero",
        variant: "split",
        content: {
          badge: "Case study",
          headline: "How Northwind grew organic traffic 3x",
          subheadline: "From quarterly releases to shipping pages every week.",
          primaryCta: "Read the story",
          secondaryCta: "Talk to us",
        },
      },
      {
        type: "features",
        content: { heading: "Results at a glance", item1: "3x organic traffic", item2: "2x faster publishing", item3: "40% more leads" },
      },
      { type: "testimonial" },
      { type: "cta", variant: "split", content: { heading: "Want results like these?", subtext: "Start free and see for yourself.", ctaLabel: "Get started" } },
    ],
  },
  {
    id: "event",
    name: "Event page",
    blurb: "Webinar or event with agenda and registration",
    icon: CalendarDays,
    sections: [
      {
        type: "hero",
        variant: "centered",
        content: {
          badge: "Webinar",
          headline: "The future of content operations",
          subheadline: "A live session on shipping pages without engineering bottlenecks.",
          primaryCta: "Register free",
          secondaryCta: "Add to calendar",
        },
      },
      {
        type: "features",
        content: { heading: "What you will learn", item1: "Composable pages", item2: "Team workflows", item3: "Publishing at scale" },
      },
      {
        type: "faq",
        content: {
          heading: "Good to know",
          q1: "Will there be a recording?",
          a1: "Yes. Everyone who registers gets the recording by email.",
          q2: "Is it free?",
          a2: "Yes, registration is free.",
        },
      },
      { type: "cta", variant: "banner", content: { heading: "Save your seat", subtext: "Live on Thursday, 11am ET.", ctaLabel: "Register now" } },
    ],
  },
  {
    id: "whitepaper",
    name: "White paper",
    blurb: "Gated report with a download form",
    icon: FileText,
    sections: [
      {
        type: "hero",
        variant: "split",
        content: {
          badge: "Report",
          headline: "The state of content 2026",
          subheadline: "What 500 marketing teams told us about shipping content.",
          primaryCta: "Download the report",
          secondaryCta: "Preview inside",
        },
      },
      {
        type: "features",
        content: { heading: "Inside the report", item1: "Benchmarks by team size", item2: "Tooling trends", item3: "What top teams do" },
      },
      { type: "contact", content: { heading: "Get the full report", subtext: "We will email you the PDF.", buttonLabel: "Send me the report" } },
    ],
  },
  {
    id: "blog-post",
    name: "Blog post",
    blurb: "Story layout with a pull quote and subscribe",
    icon: Newspaper,
    sections: [
      {
        type: "hero",
        variant: "centered",
        content: {
          badge: "Blog",
          headline: "Write a headline that earns the click",
          subheadline: "A short standfirst that sets up the story and why it matters.",
          primaryCta: "Share",
          secondaryCta: "Follow",
        },
      },
      { type: "testimonial", content: { quote: "Pull the sharpest line of the article out here to keep readers moving.", author: "Editor's note", role: "Acme Blog" } },
      { type: "cta", variant: "split", content: { heading: "Enjoyed this post?", subtext: "Get the next one in your inbox.", ctaLabel: "Subscribe" } },
    ],
  },
];

/** Live stacked preview of a template's sections. */
function TemplateStackPreview({ template }: { template: PageTemplate }) {
  return (
    <div className="pointer-events-none h-44 select-none overflow-hidden bg-white [mask-image:linear-gradient(to_bottom,black_75%,transparent)]" aria-hidden>
      <div style={{ width: 1000, transform: "scale(0.27)", transformOrigin: "top left" }}>
        {template.sections.map((s, i) => {
          const def = getSectionDef(s.type);
          if (!def) return null;
          const p: RenderProps = {
            c: { ...def.defaults, ...(s.content ?? {}) },
            variant: s.variant ?? def.variants[0].id,
            editable: false,
            onEdit: () => {},
            fid: () => undefined,
            label: () => undefined,
          };
          return <div key={i}>{def.render(p)}</div>;
        })}
      </div>
    </div>
  );
}

/**
 * TemplatePicker — the "Create a page" dialog. Start blank or from a template
 * (built-in or saved by your team). Marketer and developer roles only.
 */
export function TemplatePicker({
  open,
  onClose,
  customTemplates,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  customTemplates: PageTemplate[];
  onPick: (template: PageTemplate | null) => void;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  if (!open) return null;

  const groups: { title: string; items: PageTemplate[] }[] = [
    ...(customTemplates.length ? [{ title: "Your templates", items: customTemplates }] : []),
    { title: "Templates", items: PAGE_TEMPLATES },
  ];

  return createPortal(
    <div className="fixed inset-0 z-[90]">
      <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create a page"
        className="absolute left-1/2 top-[6vh] flex max-h-[86vh] w-[min(880px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Create a page</div>
            <div className="truncate text-[11.5px] text-slate-500">
              Start blank or from a template. Templates are section stacks your team can reuse.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onPick(null)}
              className="flex h-44 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 transition-colors hover:border-indigo-300 hover:text-indigo-600"
            >
              <Plus className="h-6 w-6" />
              <span className="text-[12.5px] font-semibold">Blank page</span>
              <span className="px-4 text-center text-[11px]">Compose from scratch in the section library</span>
            </button>
          </div>
          {groups.map((g) => (
            <div key={g.title} className="mt-5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{g.title}</div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {g.items.map((t) => (
                  <div key={t.id} className="group overflow-hidden rounded-xl border border-slate-200 transition-all hover:border-indigo-300 hover:shadow-[0_8px_30px_-12px_rgba(79,70,229,0.35)]">
                    <button type="button" onClick={() => onPick(t)} aria-label={`Create page from ${t.name} template`} className="relative block w-full text-left">
                      <TemplateStackPreview template={t} />
                      <span className="pointer-events-none absolute inset-0 grid place-items-center bg-indigo-600/0 transition-colors group-hover:bg-indigo-600/[0.04]">
                        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 px-3 py-1.5 text-[12px] font-semibold text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                          Use template
                        </span>
                      </span>
                    </button>
                    <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2.5">
                      <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-500">
                        <t.icon className="h-3.5 w-3.5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12.5px] font-semibold text-slate-900">{t.name}</div>
                        <div className="truncate text-[11px] text-slate-500">{t.blurb}</div>
                      </div>
                      <span className="shrink-0 text-[10.5px] font-medium text-slate-400">{t.sections.length} sections</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
