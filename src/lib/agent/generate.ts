/**
 * generate — programmatic page generation, the engine behind the two
 * generators (SEO pages from keywords, ABM page for an account).
 *
 * Deterministic in the demo: pages are composed from the section catalog
 * and the chosen template, copy is filled from the keyword or account
 * context, and the brand voice shapes tone lines. In production the same
 * config feeds the generation backend; the shapes here do not change.
 *
 * Everything lands as DRAFTS. Publishing stays with a person.
 */
import { instantiateTemplate, PAGE_TEMPLATES, type PageTemplate } from "@/components/cms/editor/sections/SectionSystem";
import { getBrandKit, hasBrandVoice } from "@/lib/brand/brand-store";
import { getPages, newPageId, type PageDoc } from "@/lib/cms/pages-store";
import { getCMSState } from "@/lib/cms/store";

/* ------------------------------------------------------------ keywords */

export interface KeywordRow {
  keyword: string;
  /** Extra CSV columns, by header name. Available as {{column}} tokens. */
  tokens: Record<string, string>;
}

/** One keyword per line. Blank lines and duplicates dropped. */
export function parseKeywordLines(text: string): KeywordRow[] {
  const seen = new Set<string>();
  const rows: KeywordRow[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const kw = raw.trim().replace(/^["']|["']$/g, "");
    const key = kw.toLowerCase();
    if (!kw || seen.has(key)) continue;
    seen.add(key);
    rows.push({ keyword: kw, tokens: {} });
  }
  return rows;
}

/**
 * CSV: first column is the keyword (header row optional, detected when the
 * first cell reads like "keyword"). Extra columns become tokens.
 */
export function parseKeywordCsv(text: string): KeywordRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) =>
    line
      .split(",")
      .map((c) => c.trim().replace(/^["']|["']$/g, ""));

  const first = split(lines[0]);
  const hasHeader = /^(keyword|kw|term|query)s?$/i.test(first[0] ?? "");
  const headers = hasHeader ? first.map((h) => h.toLowerCase()) : first.map((_, i) => (i === 0 ? "keyword" : `col${i}`));
  const body = hasHeader ? lines.slice(1) : lines;

  const seen = new Set<string>();
  const rows: KeywordRow[] = [];
  for (const line of body) {
    const cells = split(line);
    const kw = cells[0] ?? "";
    const key = kw.toLowerCase();
    if (!kw || seen.has(key)) continue;
    seen.add(key);
    const tokens: Record<string, string> = {};
    headers.slice(1).forEach((h, i) => {
      const v = cells[i + 1];
      if (h && v) tokens[h] = v;
    });
    rows.push({ keyword: kw, tokens });
  }
  return rows;
}

export const SAMPLE_KEYWORDS_CSV = ["keyword,city", "Car rental in Paris,Paris", "Car rental in Lyon,Lyon", "Car rental in Nice,Nice"].join("\n");

export function slugifyKeyword(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Fill {{keyword}} and {{column}} tokens in a pattern. */
export function fillTokens(pattern: string, row: KeywordRow): string {
  return pattern
    .replace(/\{\{\s*keyword\s*\}\}/gi, row.keyword)
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (m, name: string) => row.tokens[name.toLowerCase()] ?? m);
}

/* ------------------------------------------------------------ seo pages */

export interface SeoGenerateConfig {
  rows: KeywordRow[];
  templateId: string;
  /** Path prefix, e.g. "/lp". Slug comes from the keyword. */
  pathPrefix: string;
  /** Patterns take {{keyword}} plus any CSV column as {{column}}. */
  titlePattern: string;
  descriptionPattern: string;
}

export function seoTemplate(templateId: string): PageTemplate {
  return PAGE_TEMPLATES.find((t) => t.id === templateId) ?? PAGE_TEMPLATES[0];
}

function uniquePath(projectId: string, base: string, taken: Set<string>): string {
  let path = base;
  let n = 1;
  const exists = (p: string) => taken.has(p) || getPages(projectId).some((x) => x.path === p);
  while (exists(path)) path = `${base}-${++n}`;
  taken.add(path);
  return path;
}

function siteNameFor(projectId: string): string {
  return getCMSState().projects.find((p) => p.id === projectId)?.name ?? "our site";
}

/** Compose one draft page per keyword from the chosen template. */
export function buildSeoPages(projectId: string, config: SeoGenerateConfig, batchId: string): PageDoc[] {
  const template = seoTemplate(config.templateId);
  const site = siteNameFor(projectId);
  const prefix = config.pathPrefix.replace(/\/+$/, "");
  const taken = new Set<string>();

  return config.rows.map((row) => {
    const kw = row.keyword;
    const heading = titleCase(kw);
    const sections = instantiateTemplate(template).map((s) => {
      if (s.type === "hero") {
        return {
          ...s,
          content: {
            ...s.content,
            badge: row.tokens.city ?? row.tokens.category ?? "Guide",
            headline: heading,
            subheadline: `Compare options, see what is included, and get started with ${kw.toLowerCase()} in minutes.`,
            primaryCta: "Get started",
            secondaryCta: "See pricing",
          },
        };
      }
      if (s.type === "features") {
        return {
          ...s,
          content: {
            ...s.content,
            heading: `Why choose ${site} for ${kw.toLowerCase()}`,
            item1: "Transparent pricing",
            item2: "Instant confirmation",
            item3: "Support that answers",
          },
        };
      }
      if (s.type === "faq") {
        return {
          ...s,
          content: {
            ...s.content,
            heading: "Frequently asked questions",
            q1: `How does ${kw.toLowerCase()} work?`,
            a1: "Pick what fits, confirm the details, and you are set. Changes are free up to 24 hours before.",
            q2: "What does it cost?",
            a2: "Prices are shown up front with no hidden fees. What you see is what you pay.",
          },
        };
      }
      if (s.type === "cta") {
        return {
          ...s,
          content: {
            ...s.content,
            heading: `Ready for ${kw.toLowerCase()}?`,
            subtext: "It takes about two minutes to get set up.",
            ctaLabel: "Get started",
          },
        };
      }
      return s;
    });

    return {
      id: newPageId(),
      path: uniquePath(projectId, `${prefix}/${slugifyKeyword(kw)}`, taken),
      title: heading,
      state: "draft" as const,
      sections,
      updatedAt: Date.now(),
      seoTitle: fillTokens(config.titlePattern, row) || heading,
      seoDescription: fillTokens(config.descriptionPattern, row),
      indexing: "index" as const,
      batchId,
      generatedFor: kw,
    };
  });
}

/* ------------------------------------------------------------- abm page */

export interface AbmAccount {
  account: string;
  /** Who this page is for and what we should know about them. */
  context: string;
}

export type AbmMotion = "breakin" | "expand" | "accelerate" | "reengage";
export type AbmBuildMode = "template" | "ai";

export interface AbmGenerateConfig {
  /** One account, or many from a CSV. One page per account. */
  accounts: AbmAccount[];
  /** The sales motion this page supports; shapes headline and CTA copy. */
  motion: AbmMotion;
  /** "template" composes from a chosen page template; "ai" composes from
   *  the prompt plus the brand kit and section catalog. */
  mode: AbmBuildMode;
  /** AI Builder prompt. Used when mode is "ai". */
  prompt?: string;
  templateId: string;
}

export const ABM_MOTIONS: { id: AbmMotion; label: string; blurb: string }[] = [
  { id: "breakin", label: "Break into a new account", blurb: "First touch. Prove relevance fast" },
  { id: "expand", label: "Expand an existing customer", blurb: "New teams or products for a current account" },
  { id: "accelerate", label: "Accelerate an open opportunity", blurb: "Answer the evaluation, remove blockers" },
  { id: "reengage", label: "Re-engage a closed or lost account", blurb: "What changed since they last looked" },
];

const MOTION_COPY: Record<AbmMotion, { headline: (site: string, a: string) => string; primaryCta: string; ctaHeading: (a: string) => string; ctaSub: string }> = {
  breakin: {
    headline: (site, a) => `${site}, built around how ${a} works`,
    primaryCta: "Book a walkthrough",
    ctaHeading: (a) => `Ready when ${a} is`,
    ctaSub: "A tailored walkthrough takes 30 minutes.",
  },
  expand: {
    headline: (site, a) => `More of ${site} for more of ${a}`,
    primaryCta: "Talk to your account team",
    ctaHeading: (a) => `The next step for ${a}`,
    ctaSub: "Your account team already knows the context.",
  },
  accelerate: {
    headline: (site, a) => `The answers ${a} needs to decide`,
    primaryCta: "Get the evaluation kit",
    ctaHeading: (a) => `Everything ${a} asked for, in one place`,
    ctaSub: "Security review, rollout plan and pricing, ready to share.",
  },
  reengage: {
    headline: (site, a) => `What changed at ${site} since ${a} last looked`,
    primaryCta: "See what is new",
    ctaHeading: (a) => `Worth a second look for ${a}`,
    ctaSub: "The gaps from last time are closed.",
  },
};

export const SAMPLE_ACCOUNTS_CSV = [
  "account,context",
  "Lumina,300-rep sales team moving off spreadsheets. VP Sales wants deal-risk scoring before Q3.",
  "Harborline,Logistics platform consolidating five brand sites. SEO team of two.",
  "Vantage Labs,Developer tools startup. Docs and changelog are the whole marketing site.",
].join("\n");

/** CSV: first column account name, second context. Header row optional. */
export function parseAccountsCsv(text: string): AbmAccount[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];
  const split = (line: string) => {
    // Split on the FIRST comma only: context freely contains commas.
    const i = line.indexOf(",");
    return i === -1 ? [line.trim(), ""] : [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
  };
  const first = split(lines[0]);
  const hasHeader = /^(account|company|name)$/i.test(first[0]);
  const body = hasHeader ? lines.slice(1) : lines;
  const seen = new Set<string>();
  const out: AbmAccount[] = [];
  for (const line of body) {
    const [account, context] = split(line);
    const key = account.toLowerCase();
    if (!account || seen.has(key)) continue;
    seen.add(key);
    out.push({ account, context });
  }
  return out;
}

/** First sentence of the context, trimmed to a subheadline length. */
function contextLead(context: string): string {
  const first = context.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  const clean = first.replace(/\s+/g, " ");
  return clean.length > 140 ? `${clean.slice(0, 137)}...` : clean;
}

/** What each section will say, shown in the wizard before generating. */
export function abmPersonalizationPlan(projectId: string, config: AbmGenerateConfig): { section: string; note: string }[] {
  const template = seoTemplate(config.templateId);
  const site = siteNameFor(projectId);
  const many = config.accounts.length > 1;
  const a = many ? "each account" : config.accounts[0]?.account || "the account";
  const motion = MOTION_COPY[config.motion];
  const notes: Record<string, string> = {
    hero: `Headline and intro speak to ${a} directly, framed for "${ABM_MOTIONS.find((m) => m.id === config.motion)?.label.toLowerCase()}"`,
    logos: "Proof stays as is, familiar names build trust",
    features: `Reframed as what ${a} gets on day one`,
    testimonial: "Closest customer story to their situation",
    cta: `"${motion.primaryCta}" framing instead of a generic signup`,
    faq: "Answers the objections in your account context",
    pricing: "Kept as is, pricing stays canonical",
    contact: `Form headed for the ${site} team, tagged with the account`,
  };
  return template.sections
    .map((s) => ({ section: s.type, note: notes[s.type] ?? "Kept from the template" }))
    .filter((x, i, arr) => arr.findIndex((y) => y.section === x.section) === i);
}

/** Compose the personalized draft pages, one per account. Always noindex:
 *  these pages are for the accounts, not for search engines. */
export function buildAbmPages(projectId: string, config: AbmGenerateConfig, batchId: string): PageDoc[] {
  const template = seoTemplate(config.templateId);
  const site = siteNameFor(projectId);
  const voice = hasBrandVoice(projectId) ? getBrandKit(projectId).voice.tone : "";
  const motion = MOTION_COPY[config.motion];
  // AI Builder: the prompt's first sentence colors the supporting copy.
  const promptLead = config.mode === "ai" && config.prompt ? contextLead(config.prompt) : "";
  const taken = new Set<string>();

  return config.accounts.map(({ account, context }) => {
    const a = account.trim() || "your team";
    const lead = contextLead(context);

    const sections = instantiateTemplate(template).map((s) => {
      if (s.type === "hero") {
        return {
          ...s,
          content: {
            ...s.content,
            badge: `For ${a}`,
            headline: motion.headline(site, a),
            subheadline: lead
              ? `${lead} This page shows how teams like yours get there.`
              : promptLead || `A walkthrough of ${site}, put together for ${a}.`,
            primaryCta: motion.primaryCta,
            secondaryCta: "See pricing",
          },
        };
      }
      if (s.type === "features") {
        return {
          ...s,
          content: {
            ...s.content,
            heading: `What ${a} gets on day one`,
            item1: "Guided onboarding with your data",
            item2: "Security review, ready to send",
            item3: "A named contact, not a queue",
          },
        };
      }
      if (s.type === "cta") {
        return {
          ...s,
          content: {
            ...s.content,
            heading: motion.ctaHeading(a),
            subtext: voice ? `${motion.ctaSub} Tone: ${voice}.` : motion.ctaSub,
            ctaLabel: motion.primaryCta,
          },
        };
      }
      return s;
    });

    return {
      id: newPageId(),
      path: uniquePath(projectId, `/for/${slugifyKeyword(a)}`, taken),
      title: `${site} for ${a}`,
      state: "draft" as const,
      sections,
      updatedAt: Date.now(),
      seoTitle: `${site} for ${a}`,
      seoDescription: lead || `How ${site} fits the way ${a} works.`,
      indexing: "noindex" as const,
      batchId,
      generatedFor: a,
    };
  });
}
