/**
 * AEO (Answer Engine Optimization) heuristics + mocked AI outputs.
 *
 * No real AI calls — derives stable, plausible-looking scores from page
 * content. Replace `summaryFor`, `faqFor`, `entitiesFor` with real model
 * calls in Phase 2 (Lovable AI Gateway).
 */
import type { Page } from "@/lib/cms/types";

export interface AeoScores {
  answerScore: number;
  contentCompleteness: number;
  entityCoverage: number;
  topicDepth: number;
  questionCoverage: number;
  semanticRelationships: number;
  readability: number;
  aiConfidence: number;
  overall: number;
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function aeoScores(page: Page, sections: number, words: number): AeoScores {
  const titleLen = (page.metaTitle ?? page.title ?? "").length;
  const descLen = (page.metaDescription ?? page.seoDescription ?? "").length;
  const hasOg = Boolean(page.ogImage);
  const hasSchema = Boolean(page.structuredData);

  const answerScore = clamp(
    40 + (descLen > 80 ? 18 : 0) + (sections > 3 ? 18 : 0) + (hasSchema ? 14 : 0),
  );
  const contentCompleteness = clamp(45 + sections * 7 + (words > 500 ? 18 : 0));
  const entityCoverage = clamp(35 + (titleLen > 25 ? 18 : 0) + (hasSchema ? 25 : 5));
  const topicDepth = clamp(30 + sections * 9 + (words > 800 ? 22 : 0));
  const questionCoverage = clamp(28 + sections * 8 + (descLen > 100 ? 14 : 0));
  const semanticRelationships = clamp(40 + (hasSchema ? 28 : 0) + sections * 4);
  const readability = clamp(60 + (descLen > 60 && descLen < 180 ? 18 : -10) + (words > 200 ? 10 : 0));
  const aiConfidence = clamp(
    35 + (hasSchema ? 22 : 0) + (hasOg ? 10 : 0) + (descLen > 100 ? 18 : 0),
  );
  const overall = clamp(
    (answerScore +
      contentCompleteness +
      entityCoverage +
      topicDepth +
      questionCoverage +
      semanticRelationships +
      readability +
      aiConfidence) /
      8,
  );
  return {
    answerScore,
    contentCompleteness,
    entityCoverage,
    topicDepth,
    questionCoverage,
    semanticRelationships,
    readability,
    aiConfidence,
    overall,
  };
}

export function summaryFor(page: Page): string {
  const title = page.metaTitle ?? page.title;
  return `${title} explains how teams can use this section of the site to accomplish their goals. The page outlines the key benefits, walks through the workflow, and links to deeper resources for readers who want to go further.`;
}

export function keyTakeawaysFor(page: Page): string[] {
  const t = page.metaTitle ?? page.title;
  return [
    `${t} is positioned as a fast, modern alternative to legacy tools.`,
    "Setup takes under five minutes with no migration scripts required.",
    "Built-in analytics surface the metrics that matter without extra services.",
    "AI features are opt-in and respect content ownership.",
  ];
}

export function faqFor(page: Page): { q: string; a: string }[] {
  const t = page.metaTitle ?? page.title;
  return [
    {
      q: `What is ${t}?`,
      a: `${t} is the page in this project that introduces the concept to new visitors and links them to deeper documentation.`,
    },
    {
      q: `Who is ${t} for?`,
      a: "Marketing teams, content editors, and developers who collaborate on the same site.",
    },
    {
      q: "How does pricing work?",
      a: "Plans scale with team size and traffic. A free tier is available for evaluation.",
    },
    {
      q: "Is there an API?",
      a: "Yes — a typed REST API and webhooks are available on every plan.",
    },
  ];
}

export function entitiesFor(page: Page): { name: string; type: string }[] {
  const t = page.metaTitle ?? page.title;
  return [
    { name: t, type: "WebPage" },
    { name: "BetterCMS", type: "Product" },
    { name: "Content Modeling", type: "Concept" },
    { name: "Marketing Teams", type: "Audience" },
    { name: "Developers", type: "Audience" },
  ];
}

export function topicsFor(page: Page): { topic: string; covered: boolean }[] {
  const t = page.metaTitle ?? page.title;
  return [
    { topic: `What is ${t}?`, covered: true },
    { topic: "How does it work?", covered: true },
    { topic: "Who is it for?", covered: false },
    { topic: "Pricing & plans", covered: false },
    { topic: "Comparison with alternatives", covered: false },
    { topic: "Frequently asked questions", covered: true },
  ];
}
