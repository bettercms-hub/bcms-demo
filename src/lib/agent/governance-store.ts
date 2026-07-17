/**
 * governance-store — workspace-level AI controls.
 *
 * What admins can turn off or cap so the agent cannot be misused:
 * a monthly credit budget, a speed ceiling, per-skill and per-generator
 * switches, and whether personal API keys or external agents are allowed.
 *
 * Two rules are NOT configurable, on purpose: agent plans always need a
 * person's approval, and nothing the agent writes publishes on its own.
 * Governance narrows what the agent may do; it never removes the human.
 *
 * Enforced in runs-store (start and startGenerator return "" when blocked)
 * and reflected as disabled states across the agent surfaces.
 */
import { useSyncExternalStore } from "react";
import type { AiTier } from "@/lib/billing/pricing";

export interface AiGovernance {
  /** Monthly credit cap for the workspace. null = the plan's included amount. */
  monthlyCreditBudget: number | null;
  /** Fastest tier members may use. */
  tierCeiling: AiTier;
  /** Agent skill id -> allowed. Missing id = allowed. */
  skills: Record<string, boolean>;
  /** Page generators. */
  generators: { seo: boolean; abm: boolean; component: boolean };
  /** Members may attach their own model API keys. */
  byokAllowed: boolean;
  /** External agents (MCP clients, scoped keys) may connect. */
  externalAgentsAllowed: boolean;
}

const DEFAULTS: AiGovernance = {
  monthlyCreditBudget: null,
  tierCeiling: "max",
  skills: {},
  generators: { seo: true, abm: true, component: true },
  byokAllowed: true,
  externalAgentsAllowed: true,
};

const byWorkspace = new Map<string, AiGovernance>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function ensure(wsId: string): AiGovernance {
  let g = byWorkspace.get(wsId);
  if (!g) {
    g = structuredClone(DEFAULTS);
    byWorkspace.set(wsId, g);
  }
  return g;
}

export function useGovernance(wsId: string): AiGovernance {
  return useSyncExternalStore(
    subscribe,
    () => ensure(wsId),
    () => ensure(wsId),
  );
}
export function getGovernance(wsId: string): AiGovernance {
  return ensure(wsId);
}

export const governanceActions = {
  patch(wsId: string, patch: Partial<AiGovernance>) {
    byWorkspace.set(wsId, { ...ensure(wsId), ...patch });
    emit();
  },
  setSkill(wsId: string, skillId: string, on: boolean) {
    const g = ensure(wsId);
    byWorkspace.set(wsId, { ...g, skills: { ...g.skills, [skillId]: on } });
    emit();
  },
  setGenerator(wsId: string, kind: "seo" | "abm" | "component", on: boolean) {
    const g = ensure(wsId);
    byWorkspace.set(wsId, { ...g, generators: { ...g.generators, [kind]: on } });
    emit();
  },
};

/* ------------------------------------------------------------- checks */

const TIER_RANK: Record<AiTier, number> = { lite: 0, balanced: 1, max: 2 };

export function skillAllowed(wsId: string, skillId: string): boolean {
  return ensure(wsId).skills[skillId] !== false;
}
export function generatorAllowed(wsId: string, kind: "seo" | "abm" | "component"): boolean {
  return ensure(wsId).generators[kind];
}
/** Clamp a requested tier to the workspace ceiling. */
export function clampToCeiling(wsId: string, tier: AiTier): AiTier {
  const ceiling = ensure(wsId).tierCeiling;
  return TIER_RANK[tier] > TIER_RANK[ceiling] ? ceiling : tier;
}
