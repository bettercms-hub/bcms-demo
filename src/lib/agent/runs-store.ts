/**
 * Agent runs store — run lifecycle, per project.
 *
 * planning -> awaiting_approval -> applying -> review -> done
 *                    |                              (audit skips review)
 *                    -> rejected
 *
 * The store simulates streamed steps with timers so the UX is real and
 * demoable. In production the backend drives the same status machine
 * over SSE; this store's API does not change.
 */
import { useSyncExternalStore } from "react";
import { getCMSState, recordAgentAudit } from "@/lib/cms/store";
import { aiAction, tierAllowed, type AiTier } from "@/lib/billing/pricing";
import { getPages, pagesActions } from "@/lib/cms/pages-store";
import { hasBrandVoice } from "@/lib/brand/brand-store";
import { canEditContent, effectiveRoleFor } from "@/lib/workspace/my-role";
import { clampToCeiling, generatorAllowed, getGovernance, skillAllowed } from "./governance-store";
import { buildAbmPages, buildSeoPages, type AbmGenerateConfig, type SeoGenerateConfig } from "./generate";
import { READ_ONLY_SKILLS, agentSkill, skillFromPrompt, type AgentSkill } from "./skills";
import {
  applyProposals,
  buildAeoFindings,
  buildFindings,
  buildLinkFindings,
  buildPlan,
  buildProposals,
  projectCollections,
  revertRun,
} from "./simulate";
import type { AgentRun, ContextRef, ProposalStatus, RunStep } from "./types";

const byProject = new Map<string, AgentRun[]>();
const timers = new Map<string, ReturnType<typeof setTimeout>[]>();
const listeners = new Set<() => void>();
const EMPTY: AgentRun[] = [];

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAgentRuns(projectId: string): AgentRun[] {
  return useSyncExternalStore(
    subscribe,
    () => byProject.get(projectId) ?? EMPTY,
    () => byProject.get(projectId) ?? EMPTY,
  );
}

let seq = 0;
const newRunId = () => `run_${Date.now().toString(36)}${(seq++).toString(36)}`;
const newStepId = () => `step_${Date.now().toString(36)}${(seq++).toString(36)}`;

function patchRun(runId: string, fn: (r: AgentRun) => AgentRun) {
  for (const [projectId, runs] of byProject) {
    if (runs.some((r) => r.id === runId)) {
      byProject.set(
        projectId,
        runs.map((r) => (r.id === runId ? fn(r) : r)),
      );
      emit();
      return;
    }
  }
}

function getRun(runId: string): AgentRun | undefined {
  for (const runs of byProject.values()) {
    const r = runs.find((x) => x.id === runId);
    if (r) return r;
  }
  return undefined;
}

function schedule(runId: string, delay: number, fn: () => void) {
  if (typeof window === "undefined") return;
  const t = setTimeout(fn, delay);
  const list = timers.get(runId) ?? [];
  list.push(t);
  timers.set(runId, list);
}

function clearRunTimers(runId: string) {
  for (const t of timers.get(runId) ?? []) clearTimeout(t);
  timers.delete(runId);
}

/** Add a running step; mark the previous one done. */
function pushStep(runId: string, label: string, detail?: string) {
  patchRun(runId, (r) => ({
    ...r,
    steps: [
      ...r.steps.map((s) => ({ ...s, status: "done" as const })),
      { id: newStepId(), label, status: "running" as const, detail },
    ],
  }));
}

function finishSteps(runId: string) {
  patchRun(runId, (r) => ({
    ...r,
    steps: r.steps.map((s) => ({ ...s, status: "done" as const })),
  }));
}

function siteNameFor(projectId: string): string {
  return getCMSState().projects.find((p) => p.id === projectId)?.name ?? "your site";
}

/** Store-level permission guard: the UI hides controls, this enforces them. */
function roleCanAct(projectId: string): boolean {
  const s = getCMSState();
  const project = s.projects.find((p) => p.id === projectId);
  const ws = s.workspaces.find((w) => w.id === project?.workspaceId);
  if (!ws) return false;
  return canEditContent(effectiveRoleFor(ws.slug));
}

/** The workspace that owns a project, for governance checks. */
function workspaceIdFor(projectId: string): string {
  return getCMSState().projects.find((p) => p.id === projectId)?.workspaceId ?? "";
}

/** Clamp a requested tier to the plan, then to the workspace ceiling. */
function clampTier(projectId: string, tier: AiTier): AiTier {
  const plan = getCMSState().projects.find((p) => p.id === projectId)?.sitePlan ?? "free";
  const byPlan = tierAllowed(plan, tier) ? tier : tierAllowed(plan, "balanced") ? "balanced" : "lite";
  return clampToCeiling(workspaceIdFor(projectId), byPlan);
}

/* -------------------------------------------------------------- actions */

export interface StartRunInput {
  projectId: string;
  prompt: string;
  tier: AiTier;
  context: ContextRef[];
  skillId?: string;
  /** BYOK model name; when set the run bills to the user's key. */
  model?: string;
  /** Named agent from the roster running this task. */
  agentId?: string;
  agentName?: string;
}

export const agentRunActions = {
  start({ projectId, prompt, tier, context, skillId, model, agentId, agentName }: StartRunInput): string {
    if (!roleCanAct(projectId)) return "";
    const skill: AgentSkill = (skillId ? agentSkill(skillId) : undefined) ?? skillFromPrompt(prompt);
    // Workspace governance: blocked skills and disallowed personal keys stop here.
    const wsId = workspaceIdFor(projectId);
    if (!skillAllowed(wsId, skill.id)) return "";
    if (model && !getGovernance(wsId).byokAllowed) return "";
    const id = newRunId();
    const run: AgentRun = {
      id,
      projectId,
      skillId: skill.id,
      title: agentName ? `${agentName}: ${skill.label}` : skill.label,
      prompt,
      tier: clampTier(projectId, tier),
      model,
      agentId,
      agentName,
      context,
      status: "planning",
      steps: [],
      proposals: [],
      findings: [],
      creditsSpent: 0,
      appliedCount: 0,
      createdAt: Date.now(),
    };
    byProject.set(projectId, [run, ...(byProject.get(projectId) ?? [])]);
    emit();

    const pages = getPages(projectId).length;
    const cols = projectCollections(projectId).length;

    schedule(id, 250, () => pushStep(id, "Reading project structure"));
    schedule(id, 950, () => pushStep(id, "Checking pages and collections", `${pages} pages, ${cols} collections`));
    schedule(id, 1750, () => pushStep(id, "Preparing a plan"));
    schedule(id, 2500, () => {
      finishSteps(id);
      const plan = buildPlan({ projectId, skill, prompt, tier, context });
      patchRun(id, (r) => ({ ...r, plan, status: "awaiting_approval" }));
    });
    return id;
  },

  /**
   * Generator runs: the wizard already collected and confirmed the config,
   * so there is no plan-approval step. Pages land as drafts with an undo
   * journal; the run shows up in history and the audit trail like any other.
   */
  startGenerator(input: { projectId: string; kind: "seo"; config: SeoGenerateConfig } | { projectId: string; kind: "abm"; config: AbmGenerateConfig }): string {
    const { projectId, kind } = input;
    if (!roleCanAct(projectId)) return "";
    if (!generatorAllowed(workspaceIdFor(projectId), kind)) return "";
    const plan = getCMSState().projects.find((p) => p.id === projectId)?.sitePlan ?? "free";
    const actionId = kind === "seo" ? "seo-page" : "abm-page";
    if (!tierAllowed(plan, "balanced", actionId)) return "";

    const perPage = aiAction(actionId)?.costs.balanced ?? 0;
    const count = kind === "seo" ? input.config.rows.length : input.config.accounts.length;
    const credits = perPage * count;
    const id = newRunId();
    const title =
      kind === "seo"
        ? `SEO pages: ${count} from keywords`
        : count === 1
          ? `ABM page: ${input.config.accounts[0]?.account.trim() || "target account"}`
          : `ABM pages: ${count} accounts`;
    const voiceLine = hasBrandVoice(projectId) ? "Follows the brand voice" : "Uses a neutral, factual voice";

    const run: AgentRun = {
      id,
      projectId,
      skillId: kind === "seo" ? "generate-seo" : "generate-abm",
      title,
      prompt:
        kind === "seo"
          ? `Generate ${count} SEO pages from keywords`
          : count === 1
            ? `Generate a page for ${input.config.accounts[0]?.account}`
            : `Generate pages for ${count} target accounts`,
      tier: "balanced",
      context: [],
      status: "applying",
      steps: [],
      proposals: [],
      findings: [],
      plan: {
        goal: title,
        items:
          kind === "seo"
            ? [`One draft page per keyword, ${count} total`, "URL, title and meta description from your patterns", "Composed from your section catalog"]
            : [
                count === 1 ? "One draft page personalized for the account" : `One draft page per account, ${count} total`,
                input.config.mode === "ai" ? "Composed from your prompt, brand kit and section catalog" : "Composed from your page template",
                "Set to noindex, these pages are for the accounts, not for search",
              ],
        boundaries: ["Creates drafts only, nothing publishes", voiceLine, "One click undo while drafts are untouched"],
        estimate: { min: credits, max: credits },
      },
      creditsSpent: 0,
      appliedCount: 0,
      createdAt: Date.now(),
    };
    byProject.set(projectId, [run, ...(byProject.get(projectId) ?? [])]);
    emit();

    schedule(id, 300, () => pushStep(id, "Reading the brand kit and section catalog"));
    schedule(id, 1300, () => pushStep(id, count === 1 ? "Writing the copy" : `Writing copy for ${count} pages`));
    schedule(id, 2300, () => pushStep(id, "Composing sections and metadata"));
    schedule(id, 3100, () => {
      finishSteps(id);
      // Build at write time so path uniqueness is checked against live state.
      const pages = kind === "seo" ? buildSeoPages(projectId, input.config, id) : buildAbmPages(projectId, input.config, id);
      for (const pg of pages) pagesActions.add(projectId, pg);
      patchRun(id, (r) => ({
        ...r,
        proposals: pages.map((pg) => ({
          id: `prop_${pg.id}`,
          operation: "page.generate",
          targetType: "page" as const,
          targetId: pg.path,
          targetLabel: pg.title,
          after: pg.seoDescription ?? pg.title,
          reason: kind === "seo" ? `Keyword: ${pg.generatedFor}` : `Personalized for ${pg.generatedFor}`,
          risk: "low" as const,
          status: "applied" as const,
        })),
        status: "done",
        creditsSpent: credits,
        appliedCount: pages.length,
        undo: pages.map((pg) => ({ kind: "removePage" as const, path: pg.path, label: pg.title })),
        finishedAt: Date.now(),
      }));
      recordAgentAudit(
        projectId,
        "agent.changes_applied",
        `Generator created ${pages.length} draft ${pages.length === 1 ? "page" : "pages"} (${title})`,
        id,
      );
    });
    return id;
  },

  approvePlan(runId: string) {
    const run = getRun(runId);
    if (!run || run.status !== "awaiting_approval" || !roleCanAct(run.projectId)) return;
    patchRun(runId, (r) => ({ ...r, status: "applying" }));

    const skill = agentSkill(run.skillId) ?? skillFromPrompt(run.prompt);
    const input = { projectId: run.projectId, skill, prompt: run.prompt, tier: run.tier, context: run.context };
    // BYOK runs bill to the user's key, not to credits.
    const spend = run.model ? 0 : run.plan ? Math.round((run.plan.estimate.min + run.plan.estimate.max) / 2) : 0;

    if (READ_ONLY_SKILLS.has(skill.id)) {
      const scanLabels: Record<string, [string, string]> = {
        audit: ["Scanning pages", "Scanning collections and entries"],
        aeo: ["Reading pages and sections", "Checking answer coverage"],
        links: ["Reading pages and entries", "Matching related topics"],
      };
      const [a, b] = scanLabels[skill.id] ?? scanLabels.audit;
      schedule(runId, 300, () => pushStep(runId, a));
      schedule(runId, 1100, () => pushStep(runId, b));
      schedule(runId, 2000, () => {
        finishSteps(runId);
        const findings =
          skill.id === "aeo"
            ? buildAeoFindings(run.projectId)
            : skill.id === "links"
              ? buildLinkFindings(run.projectId)
              : buildFindings(run.projectId);
        patchRun(runId, (r) => ({
          ...r,
          findings,
          status: "done",
          creditsSpent: spend,
          finishedAt: Date.now(),
        }));
      });
      return;
    }

    const writeLabels: Record<string, [string, string, string]> = {
      draft: ["Writing the draft", "Filling schema fields", "Writing metadata"],
      backfill: ["Reading page metadata", "Writing meta titles", "Writing meta descriptions"],
      migrate: ["Reading the source site", "Mapping to your section catalog", "Composing draft pages"],
    };
    const labels = writeLabels[skill.id] ?? writeLabels.backfill;
    schedule(runId, 300, () => pushStep(runId, labels[0]));
    schedule(runId, 1200, () => pushStep(runId, labels[1]));
    schedule(runId, 2100, () => pushStep(runId, labels[2]));
    schedule(runId, 2900, () => {
      finishSteps(runId);
      const proposals = buildProposals(input, siteNameFor(run.projectId)).map((p) => ({
        ...p,
        status: "accepted" as ProposalStatus,
      }));
      patchRun(runId, (r) => ({
        ...r,
        proposals,
        status: proposals.length > 0 ? "review" : "done",
        creditsSpent: spend,
        finishedAt: proposals.length > 0 ? undefined : Date.now(),
      }));
    });
  },

  rejectPlan(runId: string) {
    clearRunTimers(runId);
    patchRun(runId, (r) => ({ ...r, status: "rejected", finishedAt: Date.now() }));
  },

  setProposal(runId: string, proposalId: string, status: ProposalStatus) {
    patchRun(runId, (r) => {
      const target = r.proposals.find((p) => p.id === proposalId);
      if (!target) return r;
      return {
        ...r,
        proposals: r.proposals.map((p) => {
          if (p.id === proposalId) return { ...p, status };
          // Field patches depend on their entry creation: rejecting the
          // create rejects its patches, accepting a patch accepts the create.
          const sibling = p.targetType === "entry" && p.targetId === target.targetId;
          if (!sibling || p.status === "applied") return p;
          if (status === "rejected" && target.operation === "content.generate" && p.operation === "content.patch") {
            return { ...p, status: "rejected" };
          }
          if (status === "accepted" && target.operation === "content.patch" && p.operation === "content.generate") {
            return { ...p, status: "accepted" };
          }
          return p;
        }),
      };
    });
  },

  setAllProposals(runId: string, status: ProposalStatus) {
    patchRun(runId, (r) => ({
      ...r,
      proposals: r.proposals.map((p) => (p.status === "applied" ? p : { ...p, status })),
    }));
  },

  /** Apply accepted proposals through real store actions and finish the run. */
  apply(runId: string) {
    const run = getRun(runId);
    if (!run || run.status !== "review" || !roleCanAct(run.projectId)) return;
    const { appliedIds, undo } = applyProposals(run.projectId, run.proposals);
    const applied = new Set(appliedIds);
    patchRun(runId, (r) => ({
      ...r,
      // Only changes that actually wrote get the applied label; accepted
      // ones that were skipped (page deleted, field edited meanwhile) do not.
      proposals: r.proposals.map((p) =>
        applied.has(p.id) ? { ...p, status: "applied" } : p.status === "accepted" ? { ...p, status: "rejected" } : p,
      ),
      status: "done",
      appliedCount: applied.size,
      undo,
      finishedAt: Date.now(),
    }));
    if (applied.size > 0) {
      recordAgentAudit(
        run.projectId,
        "agent.changes_applied",
        `${run.agentName ?? "Agent"} applied ${applied.size} ${applied.size === 1 ? "change" : "changes"} (${run.title})`,
        runId,
      );
    }
  },

  /** Instant undo: reverse the run's applied changes. */
  undo(runId: string) {
    const run = getRun(runId);
    if (!run || !run.undo || run.reverted || !roleCanAct(run.projectId)) return { reverted: 0, skipped: 0 };
    const result = revertRun(run.projectId, run.undo);
    if (result.reverted > 0) {
      patchRun(runId, (r) => ({ ...r, reverted: true }));
      recordAgentAudit(
        run.projectId,
        "agent.changes_reverted",
        `Reverted ${result.reverted} ${result.reverted === 1 ? "change" : "changes"} from ${run.title}`,
        runId,
      );
    }
    return result;
  },

  /** Steps for the run currently displayed. Cheap convenience. */
  get(runId: string): AgentRun | undefined {
    return getRun(runId);
  },
};

/** A run is live while the agent still owes the user something. */
export function runIsActive(r: AgentRun): boolean {
  return r.status === "planning" || r.status === "awaiting_approval" || r.status === "applying" || r.status === "review";
}
