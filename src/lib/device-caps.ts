/**
 * device-caps — what each viewport tier is allowed to do.
 *
 * The product decision (Webflow-style): desktop is the full workbench,
 * tablet keeps everything including developer mode (iPads stand in for
 * laptops), phones get a focused editor — pages, content entries, media
 * and the settings people genuinely need on the go (team invites, plan,
 * billing, account). Builder-grade surfaces (schema, SEO engine, forms
 * builder, hosting, analytics, agent) wait for a bigger screen.
 *
 * Mirrors the role allow-list pattern in workspace/my-role.ts: navs filter
 * their items through these sets, and AppShell renders the LargerScreen
 * interstitial when a blocked surface is reached by URL directly.
 */
import type { ViewportTier } from "./device";

/** Project tab keys usable on a phone. Everything else needs tablet+. */
const MOBILE_PROJECT_TABS = new Set([
  "content", // Pages list
  "collections", // Content entries
  "media",
  "visual", // opens in content (form) mode on phones
  "settings",
]);

export function deviceVisibleTabs(tier: ViewportTier): Set<string> | null {
  return tier === "mobile" ? MOBILE_PROJECT_TABS : null; // null = no device filter
}

/** Workspace sidebar labels usable on a phone. */
const MOBILE_WORKSPACE_ITEMS = new Set(["Projects", "General settings", "Team", "Plans", "Billing"]);

export function deviceAllowsWorkspaceItem(tier: ViewportTier, label: string): boolean {
  return tier === "mobile" ? MOBILE_WORKSPACE_ITEMS.has(label) : true;
}

/**
 * Project URL segments that need a bigger screen than a phone, with the
 * human name the interstitial uses. Order matters: first match wins.
 */
const MOBILE_BLOCKED_PROJECT: Array<{ test: RegExp; feature: string }> = [
  { test: /\/schema(\/|$)/, feature: "The schema builder" },
  { test: /\/seo(\/|$)/, feature: "The SEO workspace" },
  { test: /\/forms(\/|$)/, feature: "The form builder" },
  { test: /\/search(\/|$)/, feature: "Site search" },
  { test: /\/analytics(\/|$)/, feature: "Analytics" },
  { test: /\/hosting(\/|$)/, feature: "Hosting" },
  { test: /\/agent$/, feature: "The agent workspace" },
  { test: /\/brand(\/|$)/, feature: "The brand kit" },
  { test: /\/workflow(\/|$)/, feature: "The workflow board" },
  { test: /\/settings\/publishing(\/|$)/, feature: "Publishing controls" },
];

/** Workspace-level paths blocked on phones. */
const MOBILE_BLOCKED_WORKSPACE: Array<{ test: RegExp; feature: string }> = [
  { test: /\/agent$/, feature: "The agent workspace" },
  { test: /\/settings\/usage(\/|$)/, feature: "The usage dashboard" },
  { test: /\/settings\/domains(\/|$)/, feature: "Domain management" },
  { test: /\/roles(\/|$)/, feature: "The roles builder" },
];

export function blockedFeatureFor(tier: ViewportTier, pathname: string, inProject: boolean): string | null {
  if (tier !== "mobile") return null;
  const list = inProject ? MOBILE_BLOCKED_PROJECT : MOBILE_BLOCKED_WORKSPACE;
  for (const { test, feature } of list) {
    if (test.test(pathname)) return feature;
  }
  return null;
}
