/**
 * my-role — the signed-in user's role per workspace, plus the cascading
 * "view as" model.
 *
 * Roles cascade DOWN: you can preview the app as any role below your own,
 * never above. Owner > Developer > Marketer > Content editor > Reviewer.
 * The whole app (project nav, editors, publish actions) reads the EFFECTIVE
 * role: your actual role clamped by the view-as selection.
 *
 * Demo data: role per workspace is a static map here. In production this is
 * the seat on your workspace membership.
 */
import { useSyncExternalStore } from "react";
import { Code2, Eye, Megaphone, ShieldCheck, SquarePen, type LucideIcon } from "lucide-react";

export type WorkspaceRole = "owner" | "developer" | "marketer" | "editor" | "reviewer";

export const ROLE_ORDER: WorkspaceRole[] = ["owner", "developer", "marketer", "editor", "reviewer"];

export const ROLE_INFO: Record<WorkspaceRole, { label: string; blurb: string; icon: LucideIcon; rank: number }> = {
  owner: { label: "Admin", blurb: "Full control of the workspace and billing", icon: ShieldCheck, rank: 5 },
  developer: { label: "Developer", blurb: "Defines sections in code and composes pages", icon: Code2, rank: 4 },
  marketer: { label: "Marketer", blurb: "Builds and publishes pages from templates", icon: Megaphone, rank: 3 },
  editor: { label: "Content editor", blurb: "Edits content inline, no layout changes", icon: SquarePen, rank: 2 },
  reviewer: { label: "Reviewer", blurb: "Reviews pages and leaves comments", icon: Eye, rank: 1 },
};

/** The signed-in user's seat per demo workspace. Unknown workspaces = owner (you created them). */
const MY_WORKSPACE_ROLE: Record<string, WorkspaceRole> = {
  flowtrix: "owner",
  atlas: "developer",
  northwind: "marketer",
  pixelforge: "editor",
  wayground: "reviewer",
  aarav: "owner",
};

export function myRole(wsSlug: string): WorkspaceRole {
  return MY_WORKSPACE_ROLE[wsSlug] ?? "owner";
}

export function canViewAs(actual: WorkspaceRole, target: WorkspaceRole): boolean {
  return ROLE_INFO[target].rank <= ROLE_INFO[actual].rank;
}

/* ------------------------------------------------- view-as (global store) */

let viewAs: WorkspaceRole | null = null;
const listeners = new Set<() => void>();

export function setViewAs(role: WorkspaceRole | null) {
  viewAs = role;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function snapshot() {
  return viewAs;
}

/** The role the app should behave as: actual role clamped by view-as. */
export function useEffectiveRole(wsSlug: string): { actual: WorkspaceRole; effective: WorkspaceRole; viewAs: WorkspaceRole | null } {
  const v = useSyncExternalStore(subscribe, snapshot, snapshot);
  const actual = myRole(wsSlug);
  const effective = v && canViewAs(actual, v) ? v : actual;
  return { actual, effective, viewAs: v };
}

/** Non-hook read of the effective role, for store-level permission guards. */
export function effectiveRoleFor(wsSlug: string): WorkspaceRole {
  const actual = myRole(wsSlug);
  return viewAs && canViewAs(actual, viewAs) ? viewAs : actual;
}

/* ------------------------------------------------------------ permissions */

/** Project nav tabs visible per role. Keys match ProjectNav tab keys. */
const ALL_TABS = new Set([
  "content", "schema", "media", "visual", "agent", "seo", "forms", "search", "analytics", "hosting", "settings",
  "pages", "collections", "components", "publishing", "workflow",
]);
// Lower roles get explicit allow-lists so their workspace stays minimal.
// Marketer: builds and measures pages. No forms, publishing ops, or settings.
const MARKETER_TABS = new Set(["content", "pages", "collections", "workflow", "visual", "agent", "media", "seo", "analytics"]);
// Content editor: writes and reviews entries, nothing structural.
const EDITOR_TABS = new Set(["collections", "workflow", "visual", "media", "agent"]);
// Reviewer: reads and comments; the board is where review work queues up.
const REVIEWER_TABS = new Set(["collections", "workflow", "visual"]);

export function visibleTabs(role: WorkspaceRole): Set<string> {
  if (role === "owner" || role === "developer") return ALL_TABS;
  if (role === "marketer") return MARKETER_TABS;
  if (role === "editor") return EDITOR_TABS;
  return REVIEWER_TABS;
}

/** See developer/technical surfaces: schema, API, webhooks, custom code, hosting. */
export function canSeeDeveloper(role: WorkspaceRole): boolean {
  return ROLE_INFO[role].rank >= ROLE_INFO.developer.rank;
}
/** Compose pages from sections, create pages and templates. */
export function canCompose(role: WorkspaceRole): boolean {
  return ROLE_INFO[role].rank >= ROLE_INFO.marketer.rank;
}
/** Edit content (inline or form). Reviewers cannot. */
export function canEditContent(role: WorkspaceRole): boolean {
  return role !== "reviewer";
}
/** Publish to production. Marketer and up. */
export function canPublish(role: WorkspaceRole): boolean {
  return ROLE_INFO[role].rank >= ROLE_INFO.marketer.rank;
}
