/**
 * Curated multi-block templates for common section kinds.
 * A template returns a freshly-id'd block tree ready to drop into a Section.
 */
import type { Block, BlockKind, SectionKind } from "../types";
import { newBlockId } from "./registry";

const b = (kind: BlockKind, props: Record<string, unknown> = {}, children?: Block[]): Block => ({
  id: newBlockId(), kind, props, children,
});

export interface SectionTemplate {
  id: string;
  name: string;
  description: string;
  sectionKind: Extract<SectionKind, "hero" | "features" | "pricing" | "faq">;
  /** Visual hint for the thumbnail renderer. */
  thumb: "hero-centered" | "hero-split" | "hero-dual-cta"
       | "features-grid" | "features-rows" | "features-4up"
       | "pricing-3tier" | "pricing-highlight" | "pricing-2up"
       | "faq-single" | "faq-two-col" | "faq-intro-cta";
  build: () => Block[];
}

// ---------- HERO ----------

const heroCentered = (): Block[] => [
  b("paragraph", { text: "NEW", muted: true, align: "center" }),
  b("heading", { text: "Build beautiful sites, faster.", level: 1, align: "center" }),
  b("paragraph", { text: "A flexible content platform for modern teams.", muted: true, align: "center" }),
  b("cta-group", { align: "center" }, [
    b("button", { label: "Get started", href: "#", variant: "primary" }),
    b("button", { label: "Learn more", href: "#", variant: "ghost" }),
  ]),
];

const heroSplit = (): Block[] => [
  b("grid", { columns: 2, gap: "lg" }, [
    b("stack", { gap: "md", align: "start" }, [
      b("heading", { text: "Ship content without a redeploy.", level: 1, align: "left" }),
      b("paragraph", { text: "Block-based authoring with live preview.", muted: true, align: "left" }),
      b("cta-group", { align: "left" }, [
        b("button", { label: "Start free", href: "#", variant: "primary" }),
        b("button", { label: "Book a demo", href: "#", variant: "outline" }),
      ]),
    ]),
    b("image", { src: "", alt: "", ratio: "4/3", caption: "" }),
  ]),
];

const heroDualCta = (): Block[] => [
  b("paragraph", { text: "INTRODUCING BETTERCMS", muted: true, align: "center" }),
  b("heading", { text: "Composable content. Visual editing.", level: 1, align: "center" }),
  b("paragraph", { text: "Model, compose, preview, and publish — all in one place.", muted: true, align: "center" }),
  b("cta-group", { align: "center" }, [
    b("button", { label: "Try it free", href: "#", variant: "primary" }),
    b("button", { label: "Talk to sales", href: "#", variant: "secondary" }),
  ]),
];

// ---------- FEATURES ----------

const featuresGrid = (): Block[] => [
  b("heading", { text: "Everything you need", level: 2, align: "center" }),
  b("paragraph", { text: "Powerful primitives for building real products.", muted: true, align: "center" }),
  b("grid", { columns: 3, gap: "md" }, [
    b("card", { title: "Composable blocks", body: "Build any layout from reusable pieces.", padded: true }),
    b("card", { title: "Live preview", body: "See changes in context as you edit.", padded: true }),
    b("card", { title: "Headless API", body: "Deliver content to any frontend.", padded: true }),
  ]),
];

const featuresRows = (): Block[] => [
  b("heading", { text: "How it works", level: 2, align: "left" }),
  b("grid", { columns: 2, gap: "lg" }, [
    b("stack", { gap: "sm" }, [
      b("heading", { text: "1. Model your content", level: 3 }),
      b("paragraph", { text: "Define collections, fields, and references visually.", muted: true }),
    ]),
    b("image", { src: "", alt: "", ratio: "4/3" }),
  ]),
  b("grid", { columns: 2, gap: "lg" }, [
    b("image", { src: "", alt: "", ratio: "4/3" }),
    b("stack", { gap: "sm" }, [
      b("heading", { text: "2. Compose with blocks", level: 3 }),
      b("paragraph", { text: "Drag, nest, and rearrange building blocks.", muted: true }),
    ]),
  ]),
];

const features4up = (): Block[] => [
  b("heading", { text: "Built for teams", level: 2, align: "center" }),
  b("grid", { columns: 4, gap: "md" }, [
    b("card", { title: "Roles & access", body: "Granular permissions.", padded: true }),
    b("card", { title: "Workflow", body: "Draft, review, publish.", padded: true }),
    b("card", { title: "Localization", body: "Translate any field.", padded: true }),
    b("card", { title: "Webhooks", body: "Sync with anything.", padded: true }),
  ]),
];

// ---------- PRICING ----------

const pricing3tier = (): Block[] => [
  b("heading", { text: "Simple, transparent pricing", level: 2, align: "center" }),
  b("paragraph", { text: "Pick the plan that fits your team.", muted: true, align: "center" }),
  b("grid", { columns: 3, gap: "md" }, [
    b("card", { title: "Starter — $0", body: "For individuals exploring the platform.", padded: true }),
    b("card", { title: "Pro — $29/mo", body: "For teams shipping production sites.", padded: true }),
    b("card", { title: "Business — $99/mo", body: "Advanced workflow and roles.", padded: true }),
  ]),
];

const pricingHighlight = (): Block[] => [
  b("heading", { text: "One plan. Everything included.", level: 2, align: "center" }),
  b("card", { title: "Pro — $29/mo", body: "Unlimited content · Live preview · Webhooks · Roles · Priority support.", padded: true }),
  b("cta-group", { align: "center" }, [
    b("button", { label: "Start 14-day trial", href: "#", variant: "primary" }),
  ]),
];

const pricing2up = (): Block[] => [
  b("heading", { text: "Free vs Pro", level: 2, align: "center" }),
  b("grid", { columns: 2, gap: "md" }, [
    b("card", { title: "Free", body: "Up to 3 projects · Community support.", padded: true }),
    b("card", { title: "Pro — $29/mo", body: "Unlimited projects · Roles · Webhooks.", padded: true }),
  ]),
];

// ---------- FAQ ----------

const faqSingle = (): Block[] => [
  b("heading", { text: "Frequently asked questions", level: 2, align: "center" }),
  b("accordion", {
    items: [
      "What is BetterCMS?|A composable, block-based headless CMS.",
      "Can I bring my own frontend?|Yes — query content via the headless API.",
      "Is there a free plan?|Yes, Starter is free forever.",
      "How does pricing work?|Simple per-seat pricing with no hidden fees.",
    ].join("\n"),
  }),
];

const faqTwoCol = (): Block[] => [
  b("heading", { text: "Questions, answered", level: 2, align: "left" }),
  b("grid", { columns: 2, gap: "md" }, [
    b("accordion", { items: "What is BetterCMS?|A composable headless CMS.\nIs it free?|Starter is free." }),
    b("accordion", { items: "Do you support i18n?|Yes, per-field localization.\nCan I self-host?|On Business plan." }),
  ]),
];

const faqIntroCta = (): Block[] => [
  b("heading", { text: "Still have questions?", level: 2, align: "center" }),
  b("paragraph", { text: "Find quick answers below, or get in touch with our team.", muted: true, align: "center" }),
  b("accordion", {
    items: [
      "How long does setup take?|Most teams are live in under an hour.",
      "Do you offer migrations?|Yes, on Business plan.",
      "What about uptime?|99.95% historical uptime.",
    ].join("\n"),
  }),
  b("cta-group", { align: "center" }, [
    b("button", { label: "Contact sales", href: "#", variant: "primary" }),
  ]),
];

export const SECTION_TEMPLATES: SectionTemplate[] = [
  { id: "hero-centered", sectionKind: "hero", thumb: "hero-centered", name: "Centered hero with CTA", description: "Eyebrow, headline, supporting copy, and dual CTAs centered.", build: heroCentered },
  { id: "hero-split", sectionKind: "hero", thumb: "hero-split", name: "Hero with image right", description: "Headline and copy on the left, image on the right.", build: heroSplit },
  { id: "hero-dual-cta", sectionKind: "hero", thumb: "hero-dual-cta", name: "Eyebrow + heading + dual CTA", description: "Centered intro with primary and secondary actions.", build: heroDualCta },

  { id: "features-grid", sectionKind: "features", thumb: "features-grid", name: "3-column icon grid", description: "Three feature cards in a responsive grid.", build: featuresGrid },
  { id: "features-rows", sectionKind: "features", thumb: "features-rows", name: "Alternating feature rows", description: "Image + text rows that alternate sides.", build: featuresRows },
  { id: "features-4up", sectionKind: "features", thumb: "features-4up", name: "4-up feature cards", description: "Four-column card grid for compact feature lists.", build: features4up },

  { id: "pricing-3tier", sectionKind: "pricing", thumb: "pricing-3tier", name: "3-tier comparison", description: "Starter, Pro, and Business pricing cards.", build: pricing3tier },
  { id: "pricing-highlight", sectionKind: "pricing", thumb: "pricing-highlight", name: "Single highlighted plan", description: "One featured plan with a clear primary CTA.", build: pricingHighlight },
  { id: "pricing-2up", sectionKind: "pricing", thumb: "pricing-2up", name: "Free vs Pro", description: "Two-column comparison of Free and Pro.", build: pricing2up },

  { id: "faq-single", sectionKind: "faq", thumb: "faq-single", name: "Single-column accordion", description: "Classic stacked FAQ list.", build: faqSingle },
  { id: "faq-two-col", sectionKind: "faq", thumb: "faq-two-col", name: "Two-column FAQ", description: "Two accordions side-by-side for denser pages.", build: faqTwoCol },
  { id: "faq-intro-cta", sectionKind: "faq", thumb: "faq-intro-cta", name: "FAQ with intro + CTA", description: "Intro copy, accordion, and a contact CTA.", build: faqIntroCta },
];

export const TEMPLATE_SECTION_KINDS = ["hero", "features", "pricing", "faq"] as const;
export type TemplateSectionKind = (typeof TEMPLATE_SECTION_KINDS)[number];

export function getTemplatesForKind(kind: TemplateSectionKind): SectionTemplate[] {
  return SECTION_TEMPLATES.filter((t) => t.sectionKind === kind);
}
