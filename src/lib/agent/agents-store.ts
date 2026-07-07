/**
 * Named agents — the roster of agent teammates, per project.
 *
 * Each agent is a focused identity over the same run engine: a name, a
 * job (skill focus), a tier, and a cadence. Several can work at once
 * because every run executes independently. All of them obey the same
 * trust model: proposals and drafts only, a person publishes.
 *
 * Schedules are simulated in the skeleton: "Run now" fires a real run,
 * and the cadence shows when the next one would fire in production.
 */
import { useSyncExternalStore } from "react";
import type { AiTier } from "@/lib/billing/pricing";

export type AgentSchedule = "manual" | "daily" | "weekly" | "on_publish";

export const SCHEDULE_LABEL: Record<AgentSchedule, string> = {
  manual: "Manual",
  daily: "Every day",
  weekly: "Every Monday",
  on_publish: "After each publish",
};

export interface NamedAgent {
  id: string;
  projectId: string;
  name: string;
  /** Single emoji used as the avatar. */
  emoji: string;
  purpose: string;
  /** The skill this agent runs. */
  skillId: string;
  /** The prompt it runs with. */
  instructions: string;
  tier: AiTier;
  schedule: AgentSchedule;
  status: "active" | "paused";
  lastRunAt?: number;
  lastRunId?: string;
}

const byProject = new Map<string, NamedAgent[]>();
const listeners = new Set<() => void>();
const EMPTY: NamedAgent[] = [];

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newAgentId = () => `agt_${Date.now().toString(36)}${(seq++).toString(36)}`;

function seed(projectId: string): NamedAgent[] {
  return [
    {
      id: newAgentId(),
      projectId,
      name: "Content agent",
      emoji: "✍️",
      purpose: "Drafts entries from briefs so writing never starts from zero",
      skillId: "draft",
      instructions: "Draft a post about the topic in the brief, matching the site's voice",
      tier: "balanced",
      schedule: "manual",
      status: "active",
    },
    {
      id: newAgentId(),
      projectId,
      name: "SEO agent",
      emoji: "🔍",
      purpose: "Keeps every page's metadata complete and sharp",
      skillId: "backfill",
      instructions: "Backfill missing meta titles and descriptions across this site",
      tier: "lite",
      schedule: "weekly",
      status: "active",
    },
    {
      id: newAgentId(),
      projectId,
      name: "Site auditor",
      emoji: "🩺",
      purpose: "Watches for stale drafts, gaps, and risks before they ship",
      skillId: "audit",
      instructions: "Audit this site for missing metadata, stale drafts, and empty collections",
      tier: "lite",
      schedule: "weekly",
      status: "active",
    },
  ];
}

function ensure(projectId: string): NamedAgent[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed(projectId);
    byProject.set(projectId, arr);
  }
  return arr;
}

export function useNamedAgents(projectId: string): NamedAgent[] {
  return useSyncExternalStore(
    subscribe,
    () => (byProject.has(projectId) ? byProject.get(projectId)! : ensure(projectId)),
    () => (byProject.has(projectId) ? byProject.get(projectId)! : ensure(projectId)),
  );
}

export const namedAgentActions = {
  add(projectId: string, input: Omit<NamedAgent, "id" | "projectId" | "status">): NamedAgent {
    const agent: NamedAgent = { ...input, id: newAgentId(), projectId, status: "active" };
    byProject.set(projectId, [...ensure(projectId), agent]);
    emit();
    return agent;
  },
  update(projectId: string, id: string, patch: Partial<NamedAgent>) {
    byProject.set(
      projectId,
      ensure(projectId).map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
    emit();
  },
  remove(projectId: string, id: string) {
    byProject.set(
      projectId,
      ensure(projectId).filter((a) => a.id !== id),
    );
    emit();
  },
  recordRun(projectId: string, id: string, runId: string) {
    byProject.set(
      projectId,
      ensure(projectId).map((a) => (a.id === id ? { ...a, lastRunAt: Date.now(), lastRunId: runId } : a)),
    );
    emit();
  },
};
