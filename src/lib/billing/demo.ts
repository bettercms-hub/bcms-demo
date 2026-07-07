/**
 * Demo AI credit activity, deterministic per site. Feeds the credits panel
 * (balance, included amount, per action history) exactly the way the costs
 * table defines them. Tier labels only: Lite, Balanced, Max. Never a model name.
 */

import type { Project } from "@/lib/cms/types";
import { AI_ACTIONS, SITE_PLANS, type AiTier } from "./pricing";

export interface CreditEvent {
  id: string;
  when: string; // ISO date
  /** Human line, e.g. "AI page build" or "Generated 5 meta descriptions". */
  label: string;
  /** Tier chip. Image actions show "Image" instead. */
  tier: "Lite" | "Balanced" | "Max" | "Image";
  credits: number;
  actor: string;
}

function fnv(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const ACTORS = ["Owner", "Marketer seat", "Editor seat", "Developer seat"];

interface HistoryTemplate {
  actionId: string;
  tier: AiTier;
  label?: string;
  batch?: number; // e.g. "Generated 5 meta descriptions"
}

/** Realistic mixes per plan size. Costs always come from the actions table. */
const SMALL_SITE: HistoryTemplate[] = [
  { actionId: "meta", tier: "lite", batch: 5, label: "Generated 5 meta descriptions" },
  { actionId: "summary", tier: "lite", label: "Excerpt for a blog post" },
  { actionId: "rewrite", tier: "lite", label: "Simplified the about page copy" },
  { actionId: "draft", tier: "lite", label: "Draft for a new landing section" },
  { actionId: "meta", tier: "lite", batch: 3, label: "Alt text for 3 images" },
];

const MID_SITE: HistoryTemplate[] = [
  { actionId: "page", tier: "max", label: "AI page build" },
  { actionId: "section", tier: "balanced", label: "Hero section build" },
  { actionId: "rewrite", tier: "balanced", label: "Rewrote the pricing FAQ" },
  { actionId: "meta", tier: "lite", batch: 8, label: "Generated 8 meta descriptions" },
  { actionId: "schema", tier: "balanced", label: "Content model for case studies" },
  { actionId: "image", tier: "lite", label: "Generated a social image" },
  { actionId: "translate", tier: "lite", batch: 2, label: "Translated 2,000 words to German" },
  { actionId: "draft", tier: "balanced", label: "Draft for the changelog page" },
];

const BIG_SITE: HistoryTemplate[] = [
  { actionId: "aeo", tier: "max", label: "AEO agent run" },
  { actionId: "page", tier: "max", label: "AI page build" },
  { actionId: "qa", tier: "max", label: "QA and safety agent pass" },
  { actionId: "section", tier: "max", label: "Comparison table build" },
  { actionId: "page", tier: "balanced", label: "AI page build" },
  { actionId: "translate", tier: "lite", batch: 6, label: "Translated 6,000 words to French" },
  { actionId: "meta", tier: "lite", batch: 12, label: "Generated 12 meta descriptions" },
  { actionId: "schema", tier: "balanced", label: "Content model for events" },
  { actionId: "rewrite", tier: "balanced", label: "Polished the security page" },
  { actionId: "image", tier: "lite", label: "Generated a hero image" },
];

function templatesFor(project: Project): HistoryTemplate[] {
  const plan = project.sitePlan ?? "free";
  if (plan === "free" || plan === "basic") return SMALL_SITE;
  if (plan === "pro") return MID_SITE;
  return BIG_SITE;
}

const TIER_LABEL: Record<AiTier, "Lite" | "Balanced" | "Max"> = {
  lite: "Lite",
  balanced: "Balanced",
  max: "Max",
};

/** Deterministic recent credit activity for one site. */
export function creditHistory(project: Project): CreditEvent[] {
  const seed = fnv(project.id);
  const templates = templatesFor(project);
  return templates.map((t, i) => {
    const action = AI_ACTIONS.find((a) => a.id === t.actionId);
    const per = action?.costs[t.tier] ?? 0;
    const credits = per * (t.batch ?? 1);
    const day = ((seed + i * 5) % 28) + 1;
    const hour = (seed + i * 7) % 22;
    return {
      id: `${project.id}-ce-${i}`,
      when: `2026-06-${String(29 - ((day % 27) + 1)).padStart(2, "0")}T${String(hour).padStart(2, "0")}:15:00Z`,
      label: t.label ?? action?.label ?? t.actionId,
      tier: action?.isImage ? "Image" : TIER_LABEL[t.tier],
      credits,
      actor: ACTORS[(seed + i) % ACTORS.length],
    };
  });
}

/** Included monthly credits for a site, from its plan. null = custom. */
export function includedCredits(project: Project): number | null {
  return SITE_PLANS[project.sitePlan ?? "free"].limits.aiCredits;
}
