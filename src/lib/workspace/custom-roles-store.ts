/**
 * Custom roles — granular, per-project access, for Team and Enterprise.
 *
 * A custom role starts from a built-in base (marketer, editor, reviewer),
 * toggles capabilities, and then narrows SCOPE: which collections, which
 * pages, and, on Enterprise, which section types the seat may touch.
 * A scope of "all" means no restriction; a list means only those items.
 *
 * Plan gating:
 * - Custom roles exist on Team and Enterprise site plans.
 * - Section-level (element) scoping is Enterprise only.
 */
import { useSyncExternalStore } from "react";
import { getCMSState } from "@/lib/cms/store";
import type { SitePlanId } from "@/lib/cms/types";

export type BaseRole = "marketer" | "editor" | "reviewer";
export type RoleScope = "all" | string[];

export interface CustomRole {
  id: string;
  projectId: string;
  name: string;
  description: string;
  base: BaseRole;
  capabilities: {
    edit: boolean;
    publish: boolean;
    seo: boolean;
    agent: boolean;
    /** Page generators: SEO pages and ABM pages. */
    generate: boolean;
    /** Markdown delivery: llms.txt, .md files and serve toggles. */
    markdown: boolean;
  };
  scope: {
    /** Collection ids, or "all". */
    collections: RoleScope;
    /** Page paths, or "all". */
    pages: RoleScope;
    /** Section types, or "all". Enterprise depth. */
    sections: RoleScope;
  };
  members: number;
  createdAt: number;
}

export const BASE_ROLE_META: Record<BaseRole, { label: string; blurb: string }> = {
  marketer: { label: "Marketer", blurb: "Composes pages and publishes" },
  editor: { label: "Content editor", blurb: "Writes and edits content" },
  reviewer: { label: "Reviewer", blurb: "Reads and comments only" },
};

export function customRolesAllowed(plan: SitePlanId): boolean {
  return plan === "team" || plan === "enterprise";
}

export function sectionDepthAllowed(plan: SitePlanId): boolean {
  return plan === "enterprise";
}

/* ------------------------------------------------------------- store */

const byProject = new Map<string, CustomRole[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newRoleId = () => `crl_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Team and Enterprise projects ship with one example so the feature reads instantly. */
function seed(projectId: string): CustomRole[] {
  const s = getCMSState();
  const project = s.projects.find((p) => p.id === projectId);
  if (!project || !customRolesAllowed(project.sitePlan ?? "free")) return [];
  const firstCollection = s.collections.find((c) => c.projectId === projectId);
  return [
    {
      id: newRoleId(),
      projectId,
      name: "Blog author",
      description: "Writes posts in one collection. Cannot publish or touch pages.",
      base: "editor",
      capabilities: { edit: true, publish: false, seo: false, agent: true, generate: false, markdown: false },
      scope: {
        collections: firstCollection ? [firstCollection.id] : "all",
        pages: [],
        sections: "all",
      },
      members: 2,
      createdAt: Date.now() - 12 * 86_400_000,
    },
  ];
}

function ensure(projectId: string): CustomRole[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed(projectId);
    byProject.set(projectId, arr);
  }
  return arr;
}

export function useCustomRoles(projectId: string): CustomRole[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}

export const customRoleActions = {
  add(projectId: string, input: Omit<CustomRole, "id" | "projectId" | "members" | "createdAt">): CustomRole {
    const role: CustomRole = { ...input, id: newRoleId(), projectId, members: 0, createdAt: Date.now() };
    byProject.set(projectId, [...ensure(projectId), role]);
    emit();
    return role;
  },
  remove(projectId: string, id: string) {
    byProject.set(
      projectId,
      ensure(projectId).filter((r) => r.id !== id),
    );
    emit();
  },
};

/** "All collections", "1 collection", "3 pages"... for scope chips. */
export function scopeLabel(scope: RoleScope, noun: string): string {
  if (scope === "all") return `All ${noun}s`;
  if (scope.length === 0) return `No ${noun}s`;
  return `${scope.length} ${scope.length === 1 ? noun : `${noun}s`}`;
}
