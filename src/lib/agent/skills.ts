/**
 * Agent skills — the catalog of jobs the agent can run.
 *
 * Six skills, all real against the demo stores: three write paths
 * (draft, backfill, migrate) and three read-only reports (audit, AEO,
 * internal links). Free-form prompts route to the closest skill.
 */
import { FileText, Globe, Link2, Radar, Replace, ScanSearch, Search, type LucideIcon } from "lucide-react";
import type { AiTier } from "@/lib/billing/pricing";

export interface AgentSkill {
  id: string;
  /** Slash command, e.g. "/draft". */
  command: string;
  label: string;
  blurb: string;
  icon: LucideIcon;
  /** Which AI_ACTIONS id drives the credit estimate. */
  actionId: "draft" | "meta" | "summary" | "page" | "aeo";
  /** Whether the skill needs a collection context to run. */
  needsCollection?: boolean;
  /** Lowest tier the skill runs on; plan-gated in the UI. */
  minTier?: AiTier;
  /** Prefill for the composer when launched from a suggestion. */
  suggestion: string;
}

export const AGENT_SKILLS: AgentSkill[] = [
  {
    id: "draft",
    command: "/draft",
    label: "Draft an entry",
    blurb: "Write a full draft into a collection, key fields filled",
    icon: FileText,
    actionId: "draft",
    needsCollection: true,
    suggestion: "Draft a post about how structured content speeds up publishing",
  },
  {
    id: "backfill",
    command: "/backfill",
    label: "Backfill SEO metadata",
    blurb: "Find pages missing titles or descriptions and write them",
    icon: ScanSearch,
    actionId: "meta",
    suggestion: "Backfill missing meta titles and descriptions across this site",
  },
  {
    id: "rename",
    command: "/rename",
    label: "Rename across content",
    blurb: "Find every mention of a name and update it, quoted context left alone",
    icon: Replace,
    actionId: "meta",
    suggestion: 'Rename "headless CMS" to "content platform" across the site',
  },
  {
    id: "audit",
    command: "/audit",
    label: "Audit content",
    blurb: "Read-only scan for gaps and risks, nothing is changed",
    icon: Search,
    actionId: "summary",
    suggestion: "Audit this site for missing metadata and stale drafts",
  },
  {
    id: "links",
    command: "/links",
    label: "Internal linking pass",
    blurb: "Suggest links between related pages and entries, read only",
    icon: Link2,
    actionId: "summary",
    suggestion: "Suggest internal links between my pages and blog posts",
  },
  {
    id: "aeo",
    command: "/aeo",
    label: "AEO readiness pass",
    blurb: "How ready this site is for AI answer engines, read only",
    icon: Radar,
    actionId: "aeo",
    minTier: "max",
    suggestion: "Check how ready this site is for AI answer engines",
  },
  {
    id: "migrate",
    command: "/migrate",
    label: "Migrate pages from a URL",
    blurb: "Rebuild landing pages as drafts composed from your sections",
    icon: Globe,
    actionId: "page",
    suggestion: "Migrate the landing pages from https://example.com",
  },
];

export function agentSkill(id: string): AgentSkill | undefined {
  return AGENT_SKILLS.find((s) => s.id === id);
}

/** Skills that only read and report. They never enter proposal review. */
export const READ_ONLY_SKILLS = new Set(["audit", "aeo", "links"]);

/** Route a free-form prompt to the closest skill. Fallback is audit (read-only). */
export function skillFromPrompt(prompt: string): AgentSkill {
  const p = prompt.toLowerCase();
  const by = (id: string) => AGENT_SKILLS.find((s) => s.id === id)!;
  if (/(aeo|answer engine|ai search|ai overview)/.test(p)) return by("aeo");
  if (/(rename|renaming|changing (its|their) name|change the name|replace .* with|find and replace)/.test(p)) return by("rename");
  if (/(migrate|import site|rebuild|https?:\/\/)/.test(p)) return by("migrate");
  if (/(internal link|linking|link pass)/.test(p)) return by("links");
  // An explicit ask to look before touching wins over the write skills.
  if (/(audit|scan|check|review|find issues|health)/.test(p)) return by("audit");
  if (/(draft|write|create|post|article|entry)/.test(p)) return by("draft");
  if (/(meta|seo|alt text|description|backfill|title)/.test(p)) return by("backfill");
  return by("audit");
}
