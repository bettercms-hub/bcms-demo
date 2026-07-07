/**
 * Backfill `Section.blocks` from legacy `Section.props` so the new
 * block-based renderer has content to show for mock data. Runs once at
 * store init time and is a no-op for sections that already declare `blocks`.
 */
import type { Section } from "../types";
import { createBlock, type BlockPath } from "./operations";
import { newBlockId, type Block, type BlockKind } from "./registry";

const block = (kind: BlockKind, props: Record<string, unknown>, children?: Block[]): Block => ({
  id: newBlockId(),
  kind,
  props,
  children,
});

function strProp(s: Section, key: string): string | undefined {
  const v = s.props?.[key];
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

function numProp(s: Section, key: string, fallback: number): number {
  const v = Number(s.props?.[key]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

function ctaGroup(s: Section): Block | null {
  const label = strProp(s, "ctaText") ?? strProp(s, "buttonLabel");
  if (!label) return null;
  const href = strProp(s, "ctaHref") ?? "#";
  return block("cta-group", { align: strProp(s, "align") ?? "left" }, [
    block("button", { label, href, variant: "primary" }),
  ]);
}

function seedHero(s: Section): Block[] {
  const out: Block[] = [];
  const eyebrow = strProp(s, "eyebrow");
  if (eyebrow) out.push(block("paragraph", { text: eyebrow, muted: true, align: "center" }));
  out.push(block("heading", { text: strProp(s, "heading") ?? "Hero headline", level: "1", align: "center" }));
  const sub = strProp(s, "subheading");
  if (sub) {
    out.push(/<\w+/.test(sub)
      ? block("richText", { html: sub })
      : block("paragraph", { text: sub, muted: true, align: "center" }));
  } else {
    out.push(block("paragraph", { text: "Short supporting line to explain the value.", align: "center" }));
  }
  const cta = ctaGroup(s) ?? block("cta-group", { align: "center" }, [
    block("button", { label: "Get started", href: "#", variant: "primary" }),
    block("button", { label: "Learn more", href: "#", variant: "ghost" }),
  ]);
  out.push(cta);
  const img = strProp(s, "image");
  if (img) out.push(block("image", { src: img, alt: "", ratio: "16/9" }));
  return out;
}


function seedFeatures(s: Section): Block[] {
  const out: Block[] = [];
  out.push(block("heading", { text: strProp(s, "heading") ?? "Features", level: 2 }));
  const sub = strProp(s, "subheading");
  if (sub) out.push(block("paragraph", { text: sub, muted: true }));
  const body = strProp(s, "body");
  if (body) out.push(block("richText", { html: body }));
  const cols = numProp(s, "columns", 3);
  const cards: Block[] = Array.from({ length: cols }).map((_, i) =>
    block("card", { title: `Feature ${i + 1}`, body: "A short description of this feature.", padded: true }),
  );
  out.push(block("grid", { columns: cols, gap: "md" }, cards));
  return out;
}

function seedPricing(s: Section): Block[] {
  const out: Block[] = [];
  out.push(block("heading", { text: strProp(s, "heading") ?? "Pricing", level: 2 }));
  const plans = numProp(s, "plans", 3);
  const cards: Block[] = Array.from({ length: plans }).map((_, i) =>
    block("card", { title: `Plan ${i + 1}`, body: `$${(i + 1) * 19}/mo · Feature A · Feature B · Feature C`, padded: true }),
  );
  out.push(block("grid", { columns: plans, gap: "md" }, cards));
  return out;
}

function seedTestimonials(s: Section): Block[] {
  return [
    block("heading", { text: strProp(s, "heading") ?? "Loved by teams", level: 2 }),
    block("grid", { columns: 3, gap: "md" }, [
      block("quote", { text: "This product changed how our team ships.", cite: "— Customer 1" }),
      block("quote", { text: "An incredible improvement.", cite: "— Customer 2" }),
      block("quote", { text: "Highly recommended.", cite: "— Customer 3" }),
    ]),
  ];
}

function seedLogos(s: Section): Block[] {
  const heading = strProp(s, "heading");
  const out: Block[] = [];
  if (heading) out.push(block("paragraph", { text: heading, muted: true, align: "center" }));
  out.push(block("paragraph", { text: "[ logo · logo · logo · logo · logo · logo ]", muted: true, align: "center" }));
  return out;
}

function seedCta(s: Section): Block[] {
  const out: Block[] = [
    block("heading", { text: strProp(s, "heading") ?? "Ready to start?", level: 2 }),
  ];
  const sub = strProp(s, "subheading");
  if (sub) out.push(block("paragraph", { text: sub, muted: true }));
  const cta = ctaGroup(s);
  if (cta) out.push(cta);
  return out;
}

function seedFaq(s: Section): Block[] {
  const out: Block[] = [
    block("heading", { text: strProp(s, "heading") ?? "Frequently asked questions", level: 2 }),
  ];
  const body = strProp(s, "body");
  if (body) out.push(block("richText", { html: body }));
  const items = numProp(s, "items", 6);
  const lines = Array.from({ length: items }).map((_, i) => `Question ${i + 1}|Answer ${i + 1}`).join("\n");
  out.push(block("accordion", { items: lines }));
  return out;
}

function seedContent(s: Section): Block[] {
  const out: Block[] = [];
  const h = strProp(s, "heading");
  if (h) out.push(block("heading", { text: h, level: 2 }));
  const body = strProp(s, "body");
  if (body) out.push(block("richText", { html: body }));
  return out;
}

function seedHeader(s: Section): Block[] {
  const items = (strProp(s, "links") ?? "Product, Pricing, About")
    .split(",").map((x) => x.trim()).filter(Boolean)
    .map((label) => `${label}|#`).join("\n");
  const children: Block[] = [
    block("nav-logo", { text: strProp(s, "logo") ?? "Brand", mark: true }),
    block("nav-links", { items }),
  ];
  const ctaText = strProp(s, "ctaText");
  if (ctaText) {
    children.push(block("button", {
      label: ctaText,
      href: strProp(s, "ctaHref") ?? "#",
      variant: "primary",
    }));
  } else {
    children.push(block("button", { label: "Sign in", href: "/signin", variant: "ghost" }));
  }
  return [block("nav-bar", { justify: "between" }, children)];
}

function seedNavigation(s: Section): Block[] {
  const items = (strProp(s, "links") ?? "Product, Pricing, Docs, Blog")
    .split(",").map((x) => x.trim()).filter(Boolean)
    .map((label) => `${label}|#`).join("\n");
  const right: Block[] = [
    block("nav-search", { placeholder: "Search…", shortcut: "⌘K" }),
    block("button", {
      label: strProp(s, "ctaText") ?? "Start free",
      href: strProp(s, "ctaHref") ?? "/signup",
      variant: "primary",
    }),
  ];
  return [
    block("nav-bar", { justify: "between" }, [
      block("nav-logo", { text: strProp(s, "logo") ?? "Northwind AI", mark: true }),
      block("nav-links", { items }),
      block("stack", { direction: "row", gap: "sm", align: "center", wrap: true }, right),
    ]),
  ];
}

function seedFooter(s: Section): Block[] {
  return [
    block("footer-bar", { justify: "between" }, [
      block("paragraph", { text: strProp(s, "tagline") ?? "Built with BetterCMS.", muted: true }),
      block("paragraph", { text: strProp(s, "copyright") ?? "© 2026", muted: true }),
    ]),
  ];
}

const SEEDERS: Record<string, (s: Section) => Block[]> = {
  hero: seedHero,
  features: seedFeatures,
  pricing: seedPricing,
  testimonials: seedTestimonials,
  logos: seedLogos,
  cta: seedCta,
  faq: seedFaq,
  content: seedContent,
  header: seedHeader,
  footer: seedFooter,
  navigation: seedNavigation,
};


export function seedBlocksFromProps(section: Section): Block[] {
  const seeder = SEEDERS[section.kind] ?? seedContent;
  try { return seeder(section); } catch { return []; }
}

// Re-export commonly used path type so callers don't reach into operations.
export type { BlockPath };
// Make the unused createBlock import escape lint.
void createBlock;
