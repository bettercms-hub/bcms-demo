/**
 * serialize — structured content to Markdown.
 *
 * The design position, borrowed from how Sanity and the docs platforms frame
 * it: when content is structured, markdown is just another output format.
 * Pages and entries are never stored as markdown; they are serialized on
 * request. Agents reading markdown get the same content as browsers reading
 * HTML, at a fraction of the tokens.
 *
 * Three delivery surfaces build on these serializers:
 * - {path}.md twins plus Accept: text/markdown on the canonical URL
 * - /llms.txt, a markdown index of the site (llmstxt.org shape)
 * - /llms-full.txt, the full corpus inlined (heavy, off by default)
 */
import { getSectionDef, type SectionInstance } from "@/components/cms/editor/sections/SectionSystem";
import type { PageDoc } from "@/lib/cms/pages-store";
import type { Collection, Entry, Schema } from "@/lib/cms/types";

/** Rich text fields hold inline HTML; markdown output wants plain text. */
function plain(s: unknown): string {
  if (typeof s !== "string") return "";
  return s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function frontmatter(pairs: [string, string | undefined][]): string {
  const lines = pairs.filter(([, v]) => v && v.length > 0).map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lines.join("\n")}\n---`;
}

/* ------------------------------------------------------------ sections */

function sectionToMarkdown(s: SectionInstance): string {
  const c = (k: string) => plain(s.content?.[k]);
  const items = () =>
    Object.keys(s.content ?? {})
      .filter((k) => /^item\d+$/.test(k))
      .sort()
      .map((k) => c(k))
      .filter(Boolean);

  switch (s.type) {
    case "hero": {
      const out = [c("headline") && `# ${c("headline")}`, c("subheadline")];
      const ctas = [c("primaryCta"), c("secondaryCta")].filter(Boolean);
      if (ctas.length) out.push(ctas.map((x) => `**${x}**`).join(" · "));
      return out.filter(Boolean).join("\n\n");
    }
    case "features": {
      const out = [c("heading") && `## ${c("heading")}`];
      const list = items();
      if (list.length) out.push(list.map((x) => `- ${x}`).join("\n"));
      return out.filter(Boolean).join("\n\n");
    }
    case "faq": {
      const out = [c("heading") && `## ${c("heading")}`];
      for (let i = 1; i <= 6; i++) {
        const q = c(`q${i}`);
        const a = c(`a${i}`);
        if (q) out.push(`### ${q}${a ? `\n\n${a}` : ""}`);
      }
      return out.filter(Boolean).join("\n\n");
    }
    case "testimonial": {
      const quote = c("quote");
      if (!quote) return "";
      const by = [c("author"), c("role")].filter(Boolean).join(", ");
      return `> ${quote}${by ? `\n>\n> ${by}` : ""}`;
    }
    case "cta":
    case "pricing":
    case "contact": {
      return [c("heading") && `## ${c("heading")}`, c("subtext")].filter(Boolean).join("\n\n");
    }
    case "logos":
      return "";
    default: {
      // Unknown section: emit its text content with field labels as context.
      const def = getSectionDef(s.type);
      const parts = (def?.fields ?? []).map((f) => plain(s.content?.[f.key])).filter(Boolean);
      return parts.join("\n\n");
    }
  }
}

/* ------------------------------------------------------------ pages */

export function pageToMarkdown(site: { name: string; domain: string }, page: PageDoc): string {
  const body = page.sections
    .map(sectionToMarkdown)
    .filter((x) => x.length > 0)
    .join("\n\n");
  return [
    frontmatter([
      ["title", page.title],
      ["description", page.seoDescription],
      ["url", `https://${site.domain}${page.path === "/" ? "" : page.path}`],
      ["updated", new Date(page.updatedAt).toISOString().slice(0, 10)],
    ]),
    body,
  ].join("\n\n");
}

/* ------------------------------------------------------------ entries */

export function entryToMarkdown(collection: Collection, schema: Schema | undefined, entry: Entry): string {
  const short: string[] = [];
  const long: string[] = [];
  for (const f of schema?.fields ?? []) {
    const v = entry.fields[f.name];
    const text = plain(typeof v === "number" || typeof v === "boolean" ? String(v) : v);
    if (!text || f.name === schema?.titleFieldName) continue;
    if (text.length > 120 || text.includes("\n")) long.push(`## ${f.label}\n\n${text}`);
    else short.push(`- **${f.label}:** ${text}`);
  }
  return [
    frontmatter([
      ["title", entry.title],
      ["collection", collection.name],
      ["description", entry.metaDescription],
      ["updated", entry.updatedAt.slice(0, 10)],
    ]),
    `# ${entry.title}`,
    short.join("\n"),
    long.join("\n\n"),
  ]
    .filter((x) => x.length > 0)
    .join("\n\n");
}

/* ------------------------------------------------------------ llms.txt */

export interface LlmsInput {
  site: { name: string; domain: string; description?: string };
  pages: PageDoc[];
  collections: { collection: Collection; schema?: Schema; entries: Entry[] }[];
  files: { path: string; title: string }[];
}

/** The llms.txt shape: H1, blockquote summary, H2 link sections. */
export function llmsTxt(input: LlmsInput): string {
  const { site } = input;
  const base = `https://${site.domain}`;
  const out: string[] = [
    `# ${site.name}`,
    `> ${site.description ?? `Content on ${site.name}, served as markdown for agents and answer engines.`}`,
  ];

  const pages = input.pages.filter((p) => p.state === "published" || p.state === "modified");
  if (pages.length) {
    out.push("## Pages");
    out.push(
      pages
        .map((p) => `- [${p.title}](${base}${p.path === "/" ? "/index" : p.path}.md)${p.seoDescription ? `: ${p.seoDescription}` : ""}`)
        .join("\n"),
    );
  }

  for (const group of input.collections) {
    const published = group.entries.filter((e) => (e.status ?? "published") !== "draft");
    if (published.length === 0) continue;
    out.push(`## ${group.collection.name}`);
    out.push(published.map((e) => `- [${e.title}](${base}/${group.collection.slug}/${e.id}.md)`).join("\n"));
  }

  if (input.files.length) {
    out.push("## Files");
    out.push(input.files.map((f) => `- [${f.title}](${base}${f.path})`).join("\n"));
  }

  return out.join("\n\n");
}

export function llmsFullTxt(input: LlmsInput, fileBodies: { path: string; title: string; body: string }[]): string {
  const parts: string[] = [`# ${input.site.name}, full content`];
  for (const p of input.pages.filter((x) => x.state === "published" || x.state === "modified")) {
    parts.push(pageToMarkdown(input.site, p));
  }
  for (const g of input.collections) {
    for (const e of g.entries.filter((x) => (x.status ?? "published") !== "draft")) {
      parts.push(entryToMarkdown(g.collection, g.schema, e));
    }
  }
  for (const f of fileBodies) parts.push(f.body);
  return parts.join("\n\n---\n\n");
}
