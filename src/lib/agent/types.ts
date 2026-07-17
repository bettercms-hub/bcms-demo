/**
 * Agent types — the shared shapes for the BetterCMS agent system.
 *
 * The trust model, in one place:
 * - Every run plans first, and a person approves the plan.
 * - Every write is a ProposedChange the person can accept or reject.
 * - Accepted changes apply as DRAFTS through the normal store actions.
 * - Nothing publishes. Publishing stays in the publish menus, human only.
 */
import type { AiTier } from "@/lib/billing/pricing";

/* ------------------------------------------------------------- context */

export type ContextRefKind =
  | "page"
  | "collection"
  | "entry"
  | "section"
  | "component"
  | "media"
  | "form"
  | "project"
  | "file";

/** A thing the user pointed the agent at: an @ mention or an attachment. */
export interface ContextRef {
  kind: ContextRefKind;
  id: string;
  label: string;
}

/* ------------------------------------------------------------ proposals */

export type ProposalStatus = "pending" | "accepted" | "rejected" | "applied";
export type ProposalRisk = "low" | "medium";

/** One staged change. Never applied until a person accepts it. */
export interface ProposedChange {
  id: string;
  /** Operation id, e.g. "content.generate", "seo.meta". */
  operation: string;
  targetType: "page" | "entry";
  targetId: string;
  targetLabel: string;
  /** Field being changed, e.g. "seoTitle". Empty for whole-entry creation. */
  fieldPath?: string;
  before?: string;
  after: string;
  reason: string;
  risk: ProposalRisk;
  status: ProposalStatus;
}

/* ----------------------------------------------------------------- plan */

export interface AgentPlan {
  goal: string;
  /** What the agent will touch, in plain language. */
  items: string[];
  /** What it will not do. Always includes the no-publish line. */
  boundaries: string[];
  estimate: { min: number; max: number };
}

/* ---------------------------------------------------------------- steps */

export interface RunStep {
  id: string;
  label: string;
  status: "running" | "done";
  /** Small trailing detail, e.g. "3 pages". */
  detail?: string;
}

/* --------------------------------------------------------------- findings */

/** Read-only audit output. Findings inform, fixes go through proposals. */
export interface AuditFinding {
  id: string;
  severity: "note" | "warn";
  label: string;
  detail: string;
  targetLabel: string;
  /** True when the backfill skill can fix this finding. */
  fixable: boolean;
}

/* ----------------------------------------------------------------- runs */

export type RunStatus =
  | "planning"
  | "awaiting_approval"
  | "applying"
  | "review"
  | "done"
  | "rejected"
  | "failed";

/* ----------------------------------------------------------------- undo */

/** One reversible write, captured at apply time so a run can be undone fast. */
export type UndoOp =
  | { kind: "removeEntry"; entryId: string; label: string }
  | { kind: "removePage"; path: string; label: string }
  | { kind: "removeComponent"; componentId: string; label: string }
  | { kind: "restorePageField"; path: string; field: "seoTitle" | "seoDescription"; before: string; after: string; label: string }
  | { kind: "restoreEntryField"; entryId: string; field: string; before: string; after: string; label: string }
  | { kind: "restoreSectionField"; path: string; sectionId: string; field: string; before: string; after: string; label: string };

/* ----------------------------------------------------------------- runs */

export interface AgentRun {
  id: string;
  projectId: string;
  skillId: string;
  title: string;
  prompt: string;
  tier: AiTier;
  /** Set when the run uses the workspace's own API key; billed there, not to credits. */
  model?: string;
  /** Set when a named agent from the roster ran this task. */
  agentId?: string;
  agentName?: string;
  /** Names of the workspace instructions (skills and rules) this run follows. */
  instructions?: string[];
  context: ContextRef[];
  status: RunStatus;
  steps: RunStep[];
  plan?: AgentPlan;
  proposals: ProposedChange[];
  /** Short agent aside shown above the change set, e.g. what it left out. */
  note?: string;
  findings: AuditFinding[];
  creditsSpent: number;
  /** Count of proposals applied, set when the run completes. */
  appliedCount: number;
  /** Reversible ops captured at apply time, for one-click undo. */
  undo?: UndoOp[];
  /** True once the run's changes have been undone. */
  reverted?: boolean;
  createdAt: number;
  finishedAt?: number;
}
