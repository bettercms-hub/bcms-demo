/**
 * BetterCMS pricing model. Single source of truth.
 *
 * Two separate layers, never merged:
 * - Workspace plan: the team container. Projects + people. Free Workspace, Company, Agency.
 * - Site plan: powers one live site. Free (Starter), Basic, Pro, Team, Enterprise.
 *
 * Seats live at the workspace level. Viewer and reviewer seats are always free
 * and unlimited. Only editor-type seats are paid, priced by role.
 * AI credits live at the site plan level, plus top up packs.
 *
 * All numbers here come from the finalized pricing doc. Do not tweak them here
 * without changing the doc first.
 *
 * Copy rules for anything user facing: plain language, no em dashes, never an
 * AI model name. Users only ever see Lite, Balanced and Max.
 */

import type { Member, Project, SeatRole, SitePlanId, Workspace, WorkspacePlanId } from "@/lib/cms/types";

export type BillingCycle = "monthly" | "yearly";
export type AiTier = "lite" | "balanced" | "max";

/* ─────────────────────────── Site plans ─────────────────────────── */

export interface SitePlanDef {
  id: SitePlanId;
  name: string;
  /** Short qualifier shown next to the name where useful, e.g. Starter. */
  subName?: string;
  /** null = not self serve (Team is annual contract, Enterprise is custom). */
  monthly: number | null;
  /** Per month when billed yearly. null = custom. */
  yearly: number | null;
  /** e.g. "from $1,500" for Team. */
  priceNote?: string;
  bestFor: string;
  limits: {
    bandwidthGB: number | null; // null = custom
    storageGB: number | null;
    apiRequests: number | null;
    aiCredits: number | null;
    locales: number | null; // 0 = not available
    formSubmissions: number | null; // null = unlimited
  };
}

export const SITE_PLANS: Record<SitePlanId, SitePlanDef> = {
  free: {
    id: "free",
    name: "Free",
    subName: "Starter",
    monthly: 0,
    yearly: 0,
    bestFor: "Trying it out and personal projects",
    limits: { bandwidthGB: 10, storageGB: 10, apiRequests: 50_000, aiCredits: 100, locales: 0, formSubmissions: 50 },
  },
  basic: {
    id: "basic",
    name: "Basic",
    monthly: 20,
    yearly: 15,
    bestFor: "One real production site",
    limits: { bandwidthGB: 200, storageGB: 100, apiRequests: 500_000, aiCredits: 1_000, locales: 2, formSubmissions: null },
  },
  pro: {
    id: "pro",
    name: "Pro",
    monthly: 35,
    yearly: 25,
    bestFor: "A team's production site that needs to grow",
    limits: { bandwidthGB: 500, storageGB: 300, apiRequests: 1_000_000, aiCredits: 3_000, locales: 5, formSubmissions: null },
  },
  team: {
    id: "team",
    name: "Team",
    monthly: null,
    yearly: 1_500,
    priceNote: "from $1,500/mo, annual only",
    bestFor: "One high scale site with a full team and governance",
    limits: { bandwidthGB: 30_000, storageGB: 2_000, apiRequests: 10_000_000, aiCredits: 40_000, locales: 10, formSubmissions: null },
  },
  enterprise: {
    id: "enterprise",
    name: "Enterprise",
    monthly: null,
    yearly: null,
    priceNote: "Custom",
    bestFor: "Large organizations",
    limits: { bandwidthGB: null, storageGB: null, apiRequests: null, aiCredits: null, locales: null, formSubmissions: null },
  },
};

export const SITE_PLAN_ORDER: SitePlanId[] = ["free", "basic", "pro", "team", "enterprise"];

/** Yearly is the default shown everywhere. */
export const YEARLY_HEADLINE = "Save up to 30% with yearly billing";

/* ─────────────────────────── Workspace plans ─────────────────────────── */

export interface WorkspacePlanDef {
  id: WorkspacePlanId;
  name: string;
  monthly: number | null;
  yearly: number | null;
  includes: string[];
  /** Team and Enterprise are managed showcases, not self serve workspace plans. */
  managed?: boolean;
}

export const WORKSPACE_PLANS: Record<WorkspacePlanId, WorkspacePlanDef> = {
  free: {
    id: "free",
    name: "Free Workspace",
    monthly: 0,
    yearly: 0,
    includes: ["Up to 10 projects", "Unlimited free viewer and reviewer seats"],
  },
  company: {
    id: "company",
    name: "Company",
    monthly: 25,
    yearly: 20,
    includes: ["Unlimited projects", "Roles", "Custom roles"],
  },
  agency: {
    id: "agency",
    name: "Agency",
    monthly: 38,
    yearly: 30,
    includes: [
      "Everything in Company",
      "Guest into client workspaces",
      "Bring your whole team into client work",
      "White-label",
    ],
  },
  // Presented as account level deals inside their own workspace with managed billing.
  team: { id: "team", name: "Team", monthly: null, yearly: null, includes: [], managed: true },
  enterprise: { id: "enterprise", name: "Enterprise", monthly: null, yearly: null, includes: [], managed: true },
};

/* ─────────────────────────── Seats ─────────────────────────── */

export interface SeatDef {
  role: SeatRole;
  label: string;
  what: string;
  monthly: number; // 0 = free, unlimited
}

export const SEATS: Record<SeatRole, SeatDef> = {
  viewer: { role: "viewer", label: "Viewer", what: "Read only access to content and previews", monthly: 0 },
  reviewer: { role: "reviewer", label: "Reviewer", what: "View, comment, suggest, approve", monthly: 0 },
  editor: { role: "editor", label: "Content Editor", what: "Create and edit content", monthly: 10 },
  marketer: { role: "marketer", label: "Marketer", what: "Content, SEO, AEO, analytics, A/B tests, publishing", monthly: 15 },
  developer: { role: "developer", label: "Developer", what: "Schema, API, deploys, integrations, branching", monthly: 20 },
};

export const SEAT_ORDER: SeatRole[] = ["viewer", "reviewer", "editor", "marketer", "developer"];
export const PAID_SEAT_ROLES: SeatRole[] = ["editor", "marketer", "developer"];

export function isPaidSeat(role: SeatRole | undefined): boolean {
  return role === "editor" || role === "marketer" || role === "developer";
}

/* ─────────────────────────── Pro scaling ─────────────────────────── */

export type ProScalableKey = "bandwidth" | "storage" | "api" | "aiCredits" | "locales";

export interface ProScalingDef {
  key: ProScalableKey;
  label: string;
  unit: string;
  base: number;
  stepAmount: number;
  stepPrice: number;
  ceiling: number;
  format: (v: number) => string;
}

export const PRO_SCALING: Record<ProScalableKey, ProScalingDef> = {
  bandwidth: {
    key: "bandwidth", label: "Bandwidth", unit: "GB",
    base: 500, stepAmount: 250, stepPrice: 9, ceiling: 5_000,
    format: (v) => (v >= 1_000 ? `${v / 1_000} TB` : `${v} GB`),
  },
  storage: {
    key: "storage", label: "Asset storage", unit: "GB",
    base: 300, stepAmount: 250, stepPrice: 8, ceiling: 1_000,
    format: (v) => (v >= 1_000 ? `${v / 1_000} TB` : `${v} GB`),
  },
  api: {
    key: "api", label: "API requests", unit: "per month",
    base: 1_000_000, stepAmount: 5_000_000, stepPrice: 19, ceiling: 20_000_000,
    format: (v) => fmtCompact(v),
  },
  aiCredits: {
    key: "aiCredits", label: "AI credits", unit: "per month",
    base: 3_000, stepAmount: 2_000, stepPrice: 16, ceiling: 20_000,
    format: (v) => fmtCompact(v),
  },
  locales: {
    key: "locales", label: "Locales", unit: "",
    base: 5, stepAmount: 1, stepPrice: 4, ceiling: 20,
    format: (v) => String(v),
  },
};

export const TEAM_NUDGE = "Scaling several of these? Team starts at $1,500/mo and covers all of it.";

export interface ScalingOption {
  value: number;
  extraMonthly: number;
  label: string;
}

/** Dropdown options for a Pro scaling resource. Partial final steps round up to a full step. */
export function proScalingOptions(key: ProScalableKey): ScalingOption[] {
  const def = PRO_SCALING[key];
  const out: ScalingOption[] = [{ value: def.base, extraMonthly: 0, label: `${def.format(def.base)} (included)` }];
  let v = def.base + def.stepAmount;
  let steps = 1;
  while (v < def.ceiling) {
    out.push({ value: v, extraMonthly: steps * def.stepPrice, label: `${def.format(v)} (+${fmtUSD(steps * def.stepPrice)}/mo)` });
    v += def.stepAmount;
    steps += 1;
  }
  const ceilSteps = Math.ceil((def.ceiling - def.base) / def.stepAmount);
  out.push({
    value: def.ceiling,
    extraMonthly: ceilSteps * def.stepPrice,
    label: `${def.format(def.ceiling)} (+${fmtUSD(ceilSteps * def.stepPrice)}/mo)`,
  });
  // De-duplicate in case the loop landed exactly on the ceiling.
  return out.filter((o, i, a) => a.findIndex((x) => x.value === o.value) === i);
}

/* ─────────────────────────── Add ons and credit packs ─────────────────────────── */

export interface AddonDef {
  id: string;
  label: string;
  price: string;
  max?: string;
}

export const ADDONS: AddonDef[] = [
  { id: "bandwidth", label: "Extra bandwidth", price: "$9 per 250 GB", max: "up to 5 TB on Pro" },
  { id: "storage", label: "Extra asset storage", price: "$8 per 250 GB", max: "up to 1 TB on Pro" },
  { id: "locale", label: "Extra locale", price: "$4 each", max: "up to 20 on Pro" },
  { id: "ab-testing", label: "A/B testing", price: "$15 per 500k events" },
];

export interface CreditPack {
  credits: number;
  price: number;
  perCredit: number;
}

export const CREDIT_PACKS: CreditPack[] = [
  { credits: 1_000, price: 8, perCredit: 0.008 },
  { credits: 3_000, price: 22, perCredit: 0.0073 },
  { credits: 5_000, price: 35, perCredit: 0.007 },
  { credits: 8_000, price: 54, perCredit: 0.0068 },
  { credits: 10_000, price: 64, perCredit: 0.0064 },
  { credits: 15_000, price: 90, perCredit: 0.006 },
];

export const OVERAGE_PROMISE =
  "Overage never cuts off mid month. It bills at the add on rate, and a hard cap is available so there is never a surprise bill.";

/* ─────────────────────────── AI tiers and action costs ─────────────────────────── */

export const AI_TIERS: Record<AiTier, { id: AiTier; label: string; bestAt: string }> = {
  lite: { id: "lite", label: "Lite", bestAt: "Meta, alt text, translation, summaries, bulk drafts, simple edits" },
  balanced: { id: "balanced", label: "Balanced", bestAt: "Rewriting, polish, schema generation, section builds" },
  max: { id: "max", label: "Max", bestAt: "Full page and site builds, AEO agent, QA agent, anything agentic" },
};

export const AI_TIER_ORDER: AiTier[] = ["lite", "balanced", "max"];

export interface AiActionDef {
  id: string;
  label: string;
  /** Credit cost per tier. Missing tier = not offered for this action. */
  costs: Partial<Record<AiTier, number>>;
  /** Rendered as an image action, not a tier label. */
  isImage?: boolean;
}

export const AI_ACTIONS: AiActionDef[] = [
  { id: "meta", label: "Meta description, title or alt text", costs: { lite: 1 } },
  { id: "translate", label: "Translate, per 1,000 words", costs: { lite: 6 } },
  { id: "summary", label: "Summary or excerpt", costs: { lite: 2 } },
  { id: "schema", label: "Schema or content model", costs: { balanced: 20 } },
  { id: "draft", label: "Content draft, about 1,000 words", costs: { lite: 8, balanced: 20, max: 40 } },
  { id: "rewrite", label: "Rewrite or edit, about 800 words", costs: { lite: 5, balanced: 12, max: 25 } },
  { id: "section", label: "Section or block build", costs: { lite: 15, balanced: 30, max: 60 } },
  { id: "page", label: "Full page build", costs: { lite: 50, balanced: 90, max: 180 } },
  { id: "seo-page", label: "SEO page generation, per page", costs: { balanced: 12 } },
  { id: "abm-page", label: "ABM page build", costs: { balanced: 60 } },
  { id: "image", label: "Standard image (1024)", costs: { lite: 30 }, isImage: true },
  { id: "qa", label: "QA and safety agent pass", costs: { max: 120 } },
  { id: "aeo", label: "AEO agent run", costs: { max: 400 } },
];

export function aiAction(id: string): AiActionDef | undefined {
  return AI_ACTIONS.find((a) => a.id === id);
}

/** On Basic, Balanced is allowed only for selected tasks. */
export const BASIC_BALANCED_ACTIONS = ["schema", "rewrite", "seo-page"];

/** Which tiers a site plan can run, for a given action. The builder defaults to Balanced. */
export function tierAllowed(plan: SitePlanId, tier: AiTier, actionId?: string): boolean {
  if (tier === "lite") return true;
  if (tier === "max") return plan === "pro" || plan === "team" || plan === "enterprise";
  // balanced
  if (plan === "pro" || plan === "team" || plan === "enterprise") return true;
  if (plan === "basic") return actionId ? BASIC_BALANCED_ACTIONS.includes(actionId) : false;
  return false;
}

/** One line explaining why a tier is not available, plan aware. */
export function tierGateNote(plan: SitePlanId, tier: AiTier): string {
  if (tier === "max") return "Max is available on Pro and above.";
  if (tier === "balanced" && plan === "free") return "Balanced is available on Basic for selected tasks, and everywhere on Pro.";
  if (tier === "balanced" && plan === "basic") return "On Basic, Balanced is available for selected tasks.";
  return "";
}

/* ─────────────────────────── Feature matrix (4.6) ─────────────────────────── */

export type FeatureValue = boolean | string;

export interface FeatureRow {
  key: string;
  label: string;
  values: Record<SitePlanId, FeatureValue>;
}

const F = (free: FeatureValue, basic: FeatureValue, pro: FeatureValue, team: FeatureValue, enterprise: FeatureValue) =>
  ({ free, basic, pro, team, enterprise });

export const FEATURE_MATRIX: FeatureRow[] = [
  { key: "sites", label: "Sites", values: F("1", "1", "1", "1", "Custom") },
  { key: "bandwidth", label: "Bandwidth", values: F("10 GB", "200 GB", "500 GB, up to 5 TB on add on", "30 TB", "Custom") },
  { key: "storage", label: "Asset storage", values: F("10 GB", "100 GB", "300 GB, up to 1 TB on add on", "2 TB", "Custom") },
  { key: "api", label: "API requests per month", values: F("50k", "500k", "1M, scalable", "10M", "Custom") },
  { key: "ai-credits", label: "AI credits per month", values: F("100 to try", "1,000, scalable", "3,000, scalable", "40,000", "Custom") },
  { key: "records", label: "Content models and records", values: F("Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited") },
  { key: "locales", label: "Locales", values: F(false, "2, scalable", "5, scalable", "10", "Custom") },
  { key: "forms", label: "Form submissions", values: F("50", "Unlimited", "Unlimited", "Unlimited", "Unlimited") },
  { key: "free-seats", label: "Free viewer and reviewer seats", values: F("Unlimited", "Unlimited", "Unlimited", "Unlimited", "Unlimited") },
  { key: "paid-seats", label: "Paid editor seats", values: F("Via workspace", "Via workspace", "Via workspace", "15 included", "Custom") },
  { key: "ai-tiers", label: "AI builder quality tiers", values: F("Lite", "Lite, plus Balanced on select tasks", "Lite, Balanced, Max", "All", "All") },
  { key: "api-sdk", label: "Content API and SDKs", values: F(true, true, true, true, true) },
  { key: "mcp", label: "MCP server, agents read and write", values: F(true, true, true, true, true) },
  { key: "byo-model", label: "Bring your own AI model key", values: F(true, true, true, true, true) },
  { key: "custom-domain", label: "Custom domain and SSL", values: F(false, true, true, true, true) },
  { key: "branching", label: "Native branching", values: F(false, false, true, true, true) },
  { key: "workflows", label: "Publishing workflows", values: F(false, false, true, true, true) },
  { key: "audit", label: "Site activity log and audit", values: F(false, false, "Log", "Full", "Full") },
  { key: "form-files", label: "Form file upload and well-known files", values: F(false, true, true, true, true) },
  { key: "seo", label: "SEO and AEO built in", values: F(false, true, true, true, true) },
  { key: "search", label: "Site search", values: F(false, true, true, true, true) },
  { key: "analytics", label: "Analytics", values: F(false, "Basic", "Advanced", "Advanced", "Advanced") },
  { key: "ai-traffic", label: "AI traffic insights", values: F(false, false, true, true, true) },
  { key: "aeo-agents", label: "AEO agents", values: F(false, false, "Coming soon", true, true) },
  { key: "ab-testing", label: "A/B testing", values: F(false, false, "Add on", true, true) },
  { key: "cloud-hosting", label: "BetterCMS Cloud hosting", values: F(true, true, true, true, true) },
  { key: "headless", label: "Host your own frontend, headless", values: F(true, true, true, true, true) },
  { key: "byo-cdn", label: "Bring your own CDN and storage keys", values: F(false, false, true, true, true) },
  { key: "own-cloud", label: "Deploy to your own cloud or VPS", values: F(false, false, false, true, true) },
  { key: "multi-region", label: "Multi-region and data residency", values: F(false, false, false, false, true) },
  { key: "roles", label: "Roles and permissions", values: F(false, false, "Basic", "Granular", "Custom") },
  { key: "custom-roles", label: "Custom roles", values: F(false, false, false, true, true) },
  { key: "governance", label: "Foundational governance", values: F(false, false, false, true, true) },
  { key: "security", label: "Enhanced security and compliance", values: F(false, false, false, true, true) },
  { key: "sso", label: "SSO and SAML", values: F(false, false, false, true, true) },
  { key: "scim", label: "SCIM provisioning", values: F(false, false, false, false, true) },
  { key: "uptime", label: "Uptime guarantee", values: F(false, false, false, true, "SLA") },
  { key: "account-manager", label: "Dedicated account manager", values: F(false, false, false, false, true) },
  { key: "support", label: "Support", values: F("Community", "Email", "Priority", "Priority plus", "Dedicated") },
];

export function featureRow(key: string): FeatureRow | undefined {
  return FEATURE_MATRIX.find((r) => r.key === key);
}

/** Truthy when the plan has the feature at all (string values count as yes). */
export function siteHas(plan: SitePlanId, key: string): boolean {
  const row = featureRow(key);
  if (!row) return false;
  const v = row.values[plan];
  return v !== false;
}

/** First plan (in order) that has the feature. Used by locked-state copy. */
export function firstPlanWith(key: string): SitePlanId | undefined {
  return SITE_PLAN_ORDER.find((p) => siteHas(p, key));
}

/* ─────────────────────────── Enterprise tiers (sales facing) ─────────────────────────── */

export interface EnterpriseTier {
  name: string;
  internal: string;
  startingPrice: string;
  adds: string;
}

export const ENTERPRISE_TIERS: EnterpriseTier[] = [
  {
    name: "Team", internal: "Tier 1", startingPrice: "from $1,500/mo",
    adds: "Up to 30 TB bandwidth, up to 2 TB storage, 10M API, 40k credits, 10 locales, 15 seats, custom roles, granular permissions, foundational governance, enhanced security, deploy to your own cloud, priority support",
  },
  {
    name: "Business", internal: "Tier 2", startingPrice: "from about $3,000/mo",
    adds: "Higher limits, SCIM, full audit log, data residency and region pinning, dedicated support and SLA",
  },
  {
    name: "Enterprise", internal: "Tier 3", startingPrice: "Custom",
    adds: "Dedicated isolated environment, custom SLA and uptime, account manager and solutions engineer, custom configurations",
  },
];

/* ─────────────────────────── Formatting ─────────────────────────── */

export function fmtUSD(n: number): string {
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: n % 1 === 0 ? 0 : 2 })}`;
}

export function fmtCompact(n: number): string {
  if (n >= 1_000_000) return `${+(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${+(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function fmtGB(gb: number): string {
  if (gb >= 1_000) return `${+(gb / 1_000).toFixed(1)} TB`;
  return `${+gb.toFixed(1)} GB`;
}

/* ─────────────────────────── Usage states ─────────────────────────── */

export type UsageState = "healthy" | "approaching" | "over";

/** Informative, not scary. Approaching kicks in at 80%. Over means billed at the add on rate, never cut off. */
export function usageState(used: number, limit: number | null): UsageState {
  if (limit == null || limit <= 0) return "healthy";
  const r = used / limit;
  if (r > 1) return "over";
  if (r >= 0.8) return "approaching";
  return "healthy";
}

export const USAGE_STATE_NOTE: Record<UsageState, string> = {
  healthy: "",
  approaching: "Getting close to the included amount.",
  over: "Past the included amount. Billed at the add on rate, never cut off.",
};

/* ─────────────────────────── Prices per cycle ─────────────────────────── */

export function sitePlanPrice(plan: SitePlanId, cycle: BillingCycle): number | null {
  const def = SITE_PLANS[plan];
  return cycle === "yearly" ? def.yearly : def.monthly;
}

export function workspacePlanPrice(plan: WorkspacePlanId, cycle: BillingCycle): number | null {
  const def = WORKSPACE_PLANS[plan];
  return cycle === "yearly" ? def.yearly : def.monthly;
}

/* ─────────────────────────── Workspace bill ─────────────────────────── */

export interface BillLine {
  id: string;
  kind: "workspace" | "site" | "seats" | "addon" | "contract";
  label: string;
  detail?: string;
  /** null = custom / talk to us. */
  amount: number | null;
}

export interface WorkspaceBill {
  lines: BillLine[];
  /** Sum of numeric lines. null when the whole bill is custom. */
  monthlyTotal: number | null;
  cycle: BillingCycle;
  managed: boolean;
  /** e.g. "$1,260 billed yearly" for self serve yearly workspaces. */
  cycleNote?: string;
}

export function seatCounts(members: Member[]): Record<SeatRole, number> {
  const counts: Record<SeatRole, number> = { viewer: 0, reviewer: 0, editor: 0, marketer: 0, developer: 0 };
  for (const m of members) if (m.seat) counts[m.seat] += 1;
  return counts;
}

export function paidSeatsMonthly(members: Member[]): number {
  const counts = seatCounts(members);
  return PAID_SEAT_ROLES.reduce((sum, r) => sum + counts[r] * SEATS[r].monthly, 0);
}

/**
 * The one clear itemized total: workspace plan + every site plan + paid seats + add ons.
 * Team and Enterprise workspaces are managed contracts and return contract lines instead.
 */
export function computeWorkspaceBill(ws: Workspace, wsProjects: Project[], wsMembers: Member[]): WorkspaceBill {
  const plan = ws.workspacePlan ?? "free";
  const cycle: BillingCycle = ws.billing?.cycle ?? "yearly";
  const def = WORKSPACE_PLANS[plan];

  if (def.managed) {
    const site = wsProjects.find((p) => p.sitePlan === "team" || p.sitePlan === "enterprise");
    const isTeam = plan === "team";
    const lines: BillLine[] = [
      {
        id: "contract",
        kind: "contract",
        label: isTeam ? "Team plan, annual contract" : "Enterprise agreement",
        detail: site ? `${site.domain ?? site.name}` : undefined,
        amount: isTeam ? 1_500 : null,
      },
    ];
    return {
      lines,
      monthlyTotal: isTeam ? 1_500 : null,
      cycle: "yearly",
      managed: true,
      cycleNote: isTeam ? "from $1,500/mo on an annual contract, invoice based" : "Custom annual contract, invoice or PO",
    };
  }

  const lines: BillLine[] = [];
  const wsPrice = workspacePlanPrice(plan, cycle) ?? 0;
  lines.push({
    id: "workspace",
    kind: "workspace",
    label: `${def.name} workspace`,
    detail: cycle === "yearly" && wsPrice > 0 ? "billed yearly" : undefined,
    amount: wsPrice,
  });

  for (const p of wsProjects) {
    const sp = p.sitePlan ?? "free";
    const price = sitePlanPrice(sp, cycle);
    lines.push({
      id: `site-${p.id}`,
      kind: "site",
      label: p.domain ?? p.name,
      detail: `${SITE_PLANS[sp].name} site`,
      amount: price,
    });
  }

  const counts = seatCounts(wsMembers);
  for (const role of PAID_SEAT_ROLES) {
    const n = counts[role];
    if (n > 0) {
      lines.push({
        id: `seats-${role}`,
        kind: "seats",
        label: `${n} ${SEATS[role].label}${n > 1 ? " seats" : " seat"}`,
        detail: `${fmtUSD(SEATS[role].monthly)}/mo each`,
        amount: n * SEATS[role].monthly,
      });
    }
  }

  const numeric = lines.filter((l) => l.amount != null);
  const monthlyTotal = numeric.reduce((s, l) => s + (l.amount ?? 0), 0);
  return {
    lines,
    monthlyTotal,
    cycle,
    managed: false,
    cycleNote:
      cycle === "yearly" && monthlyTotal > 0
        ? `${fmtUSD(monthlyTotal)}/mo, billed yearly (${fmtUSD(monthlyTotal * 12)}/year)`
        : undefined,
  };
}

/* ─────────────────────────── Plan badges ─────────────────────────── */

export const SITE_PLAN_BADGE: Record<SitePlanId, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

export const WORKSPACE_PLAN_BADGE: Record<WorkspacePlanId, string> = {
  free: "Free",
  company: "Company",
  agency: "Agency",
  team: "Team",
  enterprise: "Enterprise",
};
