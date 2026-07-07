import { useEffect, useState } from "react";

/* ──────────────────────────────────────────────────────────────────────────
 * Shared SEO site model — powers both the Pages meta table and the Schema
 * mapping builder, in managed AND headless projects. Prototype-local: seeded
 * with realistic dummy pages and persisted to localStorage per project.
 * ────────────────────────────────────────────────────────────────────────── */

export type SitePageKind = "static" | "cms";

export type SitePage = {
  id: string;
  name: string;
  slug: string; // "/", "/pricing", "/blog/:slug"
  kind: SitePageKind;
  /** CMS templates expose dynamic fields you can bind meta + schema to. */
  fields?: string[];
  metaTitle: string;
  metaDescription: string;
  /** "" · gradient preset · http(s) URL · {{token}} for CMS templates */
  ogImage: string;
  index: boolean;
};

export type SchemaBinding = { key: string; value: string };

export type SchemaMapping = {
  id: string;
  /** SitePage.id, or "global" for site-wide. */
  targetId: string;
  type: string;
  fields: SchemaBinding[];
  /** "guided" builds from fields; "custom" uses raw pasted JSON-LD. */
  mode?: "guided" | "custom";
  raw?: string;
};

/* Social-image presets — gradients stand in for uploaded brand images. */
export const OG_PRESETS = [
  "linear-gradient(135deg,#6366f1,#a855f7)",
  "linear-gradient(135deg,#ec4899,#f43f5e)",
  "linear-gradient(135deg,#06b6d4,#3b82f6)",
  "linear-gradient(135deg,#f59e0b,#ef4444)",
  "linear-gradient(135deg,#10b981,#14b8a6)",
  "linear-gradient(135deg,#0ea5e9,#6366f1)",
];

export const SCHEMA_TYPES = [
  "Organization",
  "WebSite",
  "WebPage",
  "Article",
  "BlogPosting",
  "Product",
  "FAQPage",
  "HowTo",
  "BreadcrumbList",
  "Event",
  "LocalBusiness",
  "JobPosting",
  "VideoObject",
  "SoftwareApplication",
  "Person",
  "Review",
];

export function isDynamic(v: string) {
  return /\{\{[^}]+\}\}/.test(v);
}

export function isGradient(v: string) {
  return v.startsWith("linear-gradient");
}

function brand(projectName?: string) {
  return (projectName ?? "").trim() || "Acme";
}

export function seedPages(projectName?: string): SitePage[] {
  const b = brand(projectName);
  return [
    {
      id: "pg_home",
      name: "Home",
      slug: "/",
      kind: "static",
      index: true,
      metaTitle: `${b} — The AI workspace for modern product teams`,
      metaDescription: `${b} lets teams model content once and deliver it everywhere. Fast, headless, and built to scale.`,
      ogImage: OG_PRESETS[0],
    },
    {
      id: "pg_pricing",
      name: "Pricing",
      slug: "/pricing",
      kind: "static",
      index: true,
      metaTitle: `Pricing — ${b}`,
      metaDescription: "Simple, transparent pricing. Start free and upgrade as you grow — no hidden fees.",
      ogImage: OG_PRESETS[2],
    },
    {
      id: "pg_about",
      name: "About",
      slug: "/about",
      kind: "static",
      index: true,
      metaTitle: `About ${b} — our mission`,
      metaDescription: "We're building the future of content infrastructure for developers and editors alike.",
      ogImage: "",
    },
    {
      id: "pg_features",
      name: "Features",
      slug: "/features",
      kind: "static",
      index: true,
      metaTitle: `Features — ${b}`,
      metaDescription: "Visual editing, a flexible content API, SEO, forms and analytics — all in one place.",
      ogImage: OG_PRESETS[4],
    },
    {
      id: "pg_contact",
      name: "Contact",
      slug: "/contact",
      kind: "static",
      index: true,
      metaTitle: `Contact ${b}`,
      metaDescription: "Questions about plans, migrations, or a custom setup? Talk to our team.",
      ogImage: "",
    },
    {
      id: "pg_blog",
      name: "Blog",
      slug: "/blog",
      kind: "static",
      index: true,
      metaTitle: `Blog — ${b}`,
      metaDescription: `Product updates, engineering deep-dives, and content strategy from the ${b} team.`,
      ogImage: OG_PRESETS[5],
    },
    {
      id: "tpl_post",
      name: "Blog post",
      slug: "/blog/:slug",
      kind: "cms",
      index: true,
      fields: ["title", "excerpt", "author.name", "author.avatar", "publishedAt", "updatedAt", "coverImage", "category", "readingTime"],
      metaTitle: `{{title}} — ${b} Blog`,
      metaDescription: "{{excerpt}}",
      ogImage: "{{coverImage}}",
    },
    {
      id: "tpl_author",
      name: "Author",
      slug: "/authors/:slug",
      kind: "cms",
      index: true,
      fields: ["name", "role", "bio", "avatar", "twitter"],
      metaTitle: `{{name}} — Author at ${b}`,
      metaDescription: "{{bio}}",
      ogImage: "{{avatar}}",
    },
  ];
}

export function seedSchemas(projectName?: string): SchemaMapping[] {
  const b = brand(projectName);
  return [
    {
      id: "sch_org",
      targetId: "global",
      type: "Organization",
      fields: [
        { key: "name", value: b },
        { key: "url", value: "https://your-site.com" },
        { key: "logo", value: "https://your-site.com/logo.png" },
      ],
    },
    {
      id: "sch_website",
      targetId: "global",
      type: "WebSite",
      fields: [
        { key: "name", value: b },
        { key: "url", value: "https://your-site.com" },
      ],
    },
    {
      id: "sch_post",
      targetId: "tpl_post",
      type: "BlogPosting",
      fields: [
        { key: "headline", value: "{{title}}" },
        { key: "description", value: "{{excerpt}}" },
        { key: "image", value: "{{coverImage}}" },
        { key: "author.name", value: "{{author.name}}" },
        { key: "datePublished", value: "{{publishedAt}}" },
        { key: "dateModified", value: "{{updatedAt}}" },
      ],
    },
  ];
}

/* ── persistence ── */

const pagesKey = (pid: string) => `bettercms.seo-pages.v1.${pid}`;
const schemaKey = (pid: string) => `bettercms.seo-schemas.v1.${pid}`;

function load<T>(key: string, fallback: () => T): T {
  if (typeof window === "undefined") return fallback();
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback();
}

function persist(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export function useSeoPages(projectId: string, projectName?: string) {
  const [pages, setPages] = useState<SitePage[]>(() => load(pagesKey(projectId), () => seedPages(projectName)));
  useEffect(() => {
    persist(pagesKey(projectId), pages);
  }, [projectId, pages]);
  return [pages, setPages] as const;
}

export function useSeoSchemas(projectId: string, projectName?: string) {
  const [schemas, setSchemas] = useState<SchemaMapping[]>(() =>
    load(schemaKey(projectId), () => seedSchemas(projectName)),
  );
  useEffect(() => {
    persist(schemaKey(projectId), schemas);
  }, [projectId, schemas]);
  return [schemas, setSchemas] as const;
}

export type Redirect = { id: string; from: string; to: string; code: number };

const redirectsKey = (pid: string) => `bettercms.seo-redirects.v1.${pid}`;

function seedRedirects(): Redirect[] {
  return [
    { id: "rd_1", from: "/old-pricing", to: "/pricing", code: 301 },
    { id: "rd_2", from: "/blog/2023-recap", to: "/blog", code: 301 },
    { id: "rd_3", from: "/promo", to: "/pricing", code: 302 },
  ];
}

export function useSeoRedirects(projectId: string) {
  const [rows, setRows] = useState<Redirect[]>(() => load(redirectsKey(projectId), seedRedirects));
  useEffect(() => {
    persist(redirectsKey(projectId), rows);
  }, [projectId, rows]);
  return [rows, setRows] as const;
}

export type SitemapConfig = {
  mode: "auto" | "custom";
  customXml: string;
  rssEnabled: boolean;
  rssSources: string[]; // SitePage ids (CMS templates)
  /** RSS feed presentation, edited on the dedicated RSS Feed tab. */
  rssTitle?: string;
  rssDescription?: string;
  rssItemCount?: number;
  rssFullContent?: boolean;
};

const sitemapKey = (pid: string) => `bettercms.seo-sitemap.v1.${pid}`;

export function useSitemapConfig(projectId: string) {
  const [config, setConfig] = useState<SitemapConfig>(() =>
    load(sitemapKey(projectId), () => ({ mode: "auto", customXml: "", rssEnabled: false, rssSources: ["tpl_post"] })),
  );
  useEffect(() => {
    persist(sitemapKey(projectId), config);
  }, [projectId, config]);
  return [config, setConfig] as const;
}

/* ── JSON-LD preview builder (supports dotted keys → nested objects) ── */

export function buildJsonLd(type: string, fields: SchemaBinding[]) {
  const obj: Record<string, unknown> = { "@context": "https://schema.org", "@type": type };
  for (const f of fields) {
    if (!f.key.trim()) continue;
    const parts = f.key.split(".");
    let cur = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      const p = parts[i];
      if (typeof cur[p] !== "object" || cur[p] == null) cur[p] = {};
      cur = cur[p] as Record<string, unknown>;
    }
    cur[parts[parts.length - 1]] = f.value;
  }
  return obj;
}
