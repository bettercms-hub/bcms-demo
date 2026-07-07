/**
 * SEO audit for pages.
 *
 * Pure functions: take a `Page` and return a checks array + an overall
 * score. Used by the inspector SEO dashboard. No store coupling — easy
 * to test and to reuse in the SEO settings route later.
 */
import type { Page } from "@/lib/cms/types";

export type CheckStatus = "pass" | "warn" | "fail";

export interface SeoCheck {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Optional remediation hint surfaced in the recommendations list. */
  fix?: string;
}

export interface SeoAudit {
  /** 0–100 overall score, weighted by check importance. */
  score: number;
  checks: SeoCheck[];
  /** Effective preview values used by Search / OG / Twitter cards. */
  preview: {
    title: string;
    description: string;
    url: string;
    image?: string;
  };
}

const WEIGHT: Record<CheckStatus, number> = { pass: 1, warn: 0.5, fail: 0 };

interface AuditOptions {
  baseUrl?: string;
}

export function auditPage(page: Page, opts: AuditOptions = {}): SeoAudit {
  const base = (opts.baseUrl ?? "").replace(/\/$/, "");
  const path = page.slug.startsWith("/") ? page.slug : `/${page.slug}`;
  const url = `${base}${path}`;

  const effectiveTitle = (page.metaTitle ?? page.title ?? "").trim();
  const effectiveDescription = (page.metaDescription ?? page.seoDescription ?? "").trim();
  const effectiveImage = page.ogImage?.trim() || undefined;

  const checks: SeoCheck[] = [];

  // Title
  if (!effectiveTitle) {
    checks.push({
      id: "title",
      label: "Page title",
      status: "fail",
      detail: "No title set — search results have nothing to display.",
      fix: "Set a descriptive page title.",
    });
  } else if (effectiveTitle.length < 20) {
    checks.push({
      id: "title",
      label: "Page title",
      status: "warn",
      detail: `Only ${effectiveTitle.length} characters — aim for 30–60.`,
      fix: "Expand the title with the page's main topic.",
    });
  } else if (effectiveTitle.length > 60) {
    checks.push({
      id: "title",
      label: "Page title",
      status: "warn",
      detail: `${effectiveTitle.length} characters — Google truncates around 60.`,
      fix: "Shorten the title to 60 characters or fewer.",
    });
  } else {
    checks.push({
      id: "title",
      label: "Page title",
      status: "pass",
      detail: `${effectiveTitle.length} characters — fits search results.`,
    });
  }

  // Description
  if (!effectiveDescription) {
    checks.push({
      id: "description",
      label: "Meta description",
      status: "fail",
      detail: "No description — Google generates one from page content.",
      fix: "Write a meta description that summarises the page.",
    });
  } else if (effectiveDescription.length < 70) {
    checks.push({
      id: "description",
      label: "Meta description",
      status: "warn",
      detail: `Only ${effectiveDescription.length} characters — aim for 120–160.`,
      fix: "Expand the description with a clear value proposition.",
    });
  } else if (effectiveDescription.length > 160) {
    checks.push({
      id: "description",
      label: "Meta description",
      status: "warn",
      detail: `${effectiveDescription.length} characters — Google truncates around 160.`,
      fix: "Tighten the description to 160 characters or fewer.",
    });
  } else {
    checks.push({
      id: "description",
      label: "Meta description",
      status: "pass",
      detail: `${effectiveDescription.length} characters — fits search snippets.`,
    });
  }

  // Slug
  if (!page.slug || page.slug === "/") {
    checks.push({
      id: "slug",
      label: "URL slug",
      status: "pass",
      detail: "Root path — fine for the homepage.",
    });
  } else if (/[^a-z0-9/\-]/i.test(page.slug)) {
    checks.push({
      id: "slug",
      label: "URL slug",
      status: "warn",
      detail: "Slug contains characters search engines may encode awkwardly.",
      fix: "Use lowercase letters, numbers, and hyphens.",
    });
  } else {
    checks.push({
      id: "slug",
      label: "URL slug",
      status: "pass",
      detail: "Clean, readable URL.",
    });
  }

  // Canonical
  checks.push(
    page.canonical?.trim()
      ? {
          id: "canonical",
          label: "Canonical URL",
          status: "pass",
          detail: "Canonical set — duplicates won't dilute ranking.",
        }
      : {
          id: "canonical",
          label: "Canonical URL",
          status: "warn",
          detail: "No canonical — falls back to the page URL.",
          fix: "Set a canonical when this page can be reached from multiple URLs.",
        },
  );

  // Indexing
  if (page.indexing === "noindex") {
    checks.push({
      id: "indexing",
      label: "Indexing",
      status: "warn",
      detail: "Hidden from search by `noindex`.",
      fix: "Switch indexing to Indexed if this page should appear in search.",
    });
  } else {
    checks.push({
      id: "indexing",
      label: "Indexing",
      status: "pass",
      detail: "Indexed by search engines.",
    });
  }

  // OG image
  checks.push(
    effectiveImage
      ? {
          id: "ogImage",
          label: "Social image",
          status: "pass",
          detail: "OG image set — link previews will render with a card.",
        }
      : {
          id: "ogImage",
          label: "Social image",
          status: "warn",
          detail: "No OG image — link previews fall back to plain text.",
          fix: "Add a 1200×630 image to og:image.",
        },
  );

  // OG description
  if (!page.ogDescription?.trim() && effectiveDescription) {
    checks.push({
      id: "ogDescription",
      label: "Social description",
      status: "pass",
      detail: "Falls back to meta description.",
    });
  } else if (page.ogDescription?.trim()) {
    checks.push({
      id: "ogDescription",
      label: "Social description",
      status: "pass",
      detail: "Custom OG description set.",
    });
  } else {
    checks.push({
      id: "ogDescription",
      label: "Social description",
      status: "warn",
      detail: "No description for social cards.",
      fix: "Add a meta or OG description.",
    });
  }

  const score = Math.round(
    (checks.reduce((acc, c) => acc + WEIGHT[c.status], 0) / checks.length) * 100,
  );

  return {
    score,
    checks,
    preview: {
      title: effectiveTitle || page.title || "Untitled",
      description: effectiveDescription,
      url,
      image: effectiveImage,
    },
  };
}

export function scoreTone(score: number): "good" | "warn" | "bad" {
  if (score >= 85) return "good";
  if (score >= 60) return "warn";
  return "bad";
}
