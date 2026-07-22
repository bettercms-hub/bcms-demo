/**
 * Project-wide SEO issue scanner.
 *
 * Walks all pages of a project and produces grouped issues. Pure
 * function over the existing mock CMS state — no DB, no network.
 */
import type { Page } from "@/lib/cms/types";

export type Severity = "critical" | "high" | "medium" | "low";

export interface SeoIssue {
  id: string;
  severity: Severity;
  code: string;
  title: string;
  problem: string;
  impact: string;
  fix: string;
  pageIds: string[];
}

export function scanIssues(pages: Page[]): SeoIssue[] {
  const issues: SeoIssue[] = [];

  // Missing title
  const missingTitle = pages.filter((p) => !(p.metaTitle ?? p.title)?.trim());
  if (missingTitle.length) {
    issues.push({
      id: "missing-title",
      severity: "critical",
      code: "title.missing",
      title: "Pages missing a title",
      problem: "These pages have no <title> set. Search results have nothing to show.",
      impact: "Cripples ranking and click-through. Browsers and crawlers see 'Untitled'.",
      fix: "Open each page and set a descriptive title between 30 and 60 characters.",
      pageIds: missingTitle.map((p) => p.id),
    });
  }

  // Duplicate titles
  const byTitle = new Map<string, Page[]>();
  for (const p of pages) {
    const t = (p.metaTitle ?? p.title ?? "").trim().toLowerCase();
    if (!t) continue;
    if (!byTitle.has(t)) byTitle.set(t, []);
    byTitle.get(t)!.push(p);
  }
  const dups = Array.from(byTitle.values()).filter((g) => g.length > 1);
  if (dups.length) {
    issues.push({
      id: "duplicate-title",
      severity: "high",
      code: "title.duplicate",
      title: "Duplicate page titles",
      problem: `${dups.length} sets of pages share the same title.`,
      impact: "Search engines cluster duplicates and pick a winner — not always the one you want.",
      fix: "Make each title unique. Add the section name or year to disambiguate.",
      pageIds: dups.flat().map((p) => p.id),
    });
  }

  // Missing description
  const missingDesc = pages.filter(
    (p) => !(p.metaDescription ?? p.seoDescription)?.trim(),
  );
  if (missingDesc.length) {
    issues.push({
      id: "missing-description",
      severity: "high",
      code: "description.missing",
      title: "Pages missing a meta description",
      problem: "Google auto-generates a description when none is provided.",
      impact: "Auto-generated snippets often miss your value proposition.",
      fix: "Write a 120–160 character description focused on the page's main benefit.",
      pageIds: missingDesc.map((p) => p.id),
    });
  }

  // Title too long
  const longTitle = pages.filter((p) => (p.metaTitle ?? p.title ?? "").length > 60);
  if (longTitle.length) {
    issues.push({
      id: "title-too-long",
      severity: "medium",
      code: "title.length",
      title: "Title exceeds 60 characters",
      problem: "Long titles get truncated in search results.",
      impact: "Readers lose the end of your headline — usually the most compelling part.",
      fix: "Tighten the title to 60 characters or fewer.",
      pageIds: longTitle.map((p) => p.id),
    });
  }

  // Description too long
  const longDesc = pages.filter(
    (p) => (p.metaDescription ?? p.seoDescription ?? "").length > 160,
  );
  if (longDesc.length) {
    issues.push({
      id: "desc-too-long",
      severity: "low",
      code: "description.length",
      title: "Description exceeds 160 characters",
      problem: "Descriptions get truncated in search snippets.",
      impact: "Trailing words disappear behind '…'.",
      fix: "Tighten to under 160 characters; lead with the value.",
      pageIds: longDesc.map((p) => p.id),
    });
  }

  // No canonical
  const noCanon = pages.filter((p) => !p.canonical?.trim());
  if (noCanon.length) {
    issues.push({
      id: "no-canonical",
      severity: "low",
      code: "canonical.missing",
      title: "Pages without an explicit canonical URL",
      problem: "Pages fall back to the request URL for canonical.",
      impact: "Duplicate-URL situations (tracking params, alternate paths) can dilute ranking.",
      fix: "Set a canonical when this page can be reached from multiple URLs.",
      pageIds: noCanon.map((p) => p.id),
    });
  }

  // Noindex pages — informational
  const noindex = pages.filter((p) => p.indexing === "noindex");
  if (noindex.length) {
    issues.push({
      id: "noindex-pages",
      severity: "medium",
      code: "indexing.noindex",
      title: "Pages hidden from search by noindex",
      problem: "These pages will not appear in Google or Bing.",
      impact: "Intentional for staging/admin — risky if applied to marketing pages by mistake.",
      fix: "Confirm each is meant to be hidden. Switch to Indexed otherwise.",
      pageIds: noindex.map((p) => p.id),
    });
  }

  // No OG image
  const noOg = pages.filter((p) => !p.ogImage?.trim());
  if (noOg.length) {
    issues.push({
      id: "missing-og-image",
      severity: "medium",
      code: "og.image.missing",
      title: "No social image (Open Graph)",
      problem: "Link previews on Slack, X, LinkedIn, iMessage render as plain text.",
      impact: "Lower click-through on shared links.",
      fix: "Add a 1200×630 OG image per page or fall back to the project default.",
      pageIds: noOg.map((p) => p.id),
    });
  }

  // No structured data
  const noSchema = pages.filter((p) => !p.structuredData?.trim());
  if (noSchema.length) {
    issues.push({
      id: "missing-schema",
      severity: "medium",
      code: "schema.missing",
      title: "Pages without Schema.org structured data",
      problem: "No JSON-LD describing the page to crawlers or AI search.",
      impact: "Lower eligibility for rich results, AI Overviews, and answer engines.",
      fix: "Add an Article, Product, FAQ, or other schema in the SEO workspace.",
      pageIds: noSchema.map((p) => p.id),
    });
  }

  return issues.sort((a, b) => {
    const order: Severity[] = ["critical", "high", "medium", "low"];
    return order.indexOf(a.severity) - order.indexOf(b.severity);
  });
}

export function severityColor(s: Severity): string {
  // V2 status tokens (dark-safe via the .dark token block).
  switch (s) {
    case "critical":
      return "text-destructive bg-destructive/12 border-destructive/30";
    case "high":
      return "text-status-warning bg-status-warning/15 border-status-warning/35";
    case "medium":
      return "text-status-warning bg-status-warning/8 border-status-warning/25";
    case "low":
      return "text-status-preview bg-status-preview/10 border-status-preview/30";
  }
}
