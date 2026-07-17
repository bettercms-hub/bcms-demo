/**
 * Connected agents — outside tools (Claude Code, ChatGPT, Cursor, Windsurf,
 * any MCP client) that drive this project through the same operation layer
 * as the in-app agent.
 *
 * Trust model, mirroring where the market landed (Webflow's OAuth site
 * authorization, Sanity/Contentful token scoping):
 * - Access is GRANTED per capability, chosen by the person connecting.
 * - Publishing is never grantable. Drafts and staging only, always.
 * - A key is scoped to one project or one workspace, never across
 *   workspaces. The agent connects like a guest: no seat, no billing.
 * - A connection starts pending and only works after a person authorizes
 *   it. Grant, authorize and revoke are all audited.
 *
 * Demo: grants live in memory; the token is generated client side and
 * shown once, like a real key flow.
 */
import { useSyncExternalStore } from "react";
import { recordAgentAudit } from "@/lib/cms/store";

export type AccessKey =
  | "content.read"
  | "content.write"
  | "media"
  | "components"
  | "schema"
  | "seo";

export interface AccessOption {
  key: AccessKey;
  label: string;
  hint: string;
  /** On by default in the connect flow. */
  suggested: boolean;
  /** The baseline; a connection without read access is useless. */
  locked?: boolean;
}

export const ACCESS_OPTIONS: AccessOption[] = [
  { key: "content.read", label: "Read content", hint: "Pages, entries and collections, read only", suggested: true, locked: true },
  { key: "content.write", label: "Write content drafts", hint: "Create and edit pages and entries, drafts only", suggested: true },
  { key: "media", label: "Media library", hint: "Browse assets and upload new ones", suggested: true },
  { key: "components", label: "Components", hint: "Draft new section components in the hub", suggested: false },
  { key: "schema", label: "Schema", hint: "Propose content model changes, as drafts", suggested: false },
  { key: "seo", label: "SEO surfaces", hint: "Meta, redirects, llms.txt and markdown delivery", suggested: false },
];

export const accessLabel = (k: AccessKey) => ACCESS_OPTIONS.find((o) => o.key === k)?.label ?? k;

/**
 * Where a key reaches:
 * - "projects"   — a hand-picked set of projects inside its home workspace.
 * - "workspace"  — every project in the home workspace, future ones included.
 * - "workspaces" — whole workspaces, for the agency/org case. Broadest blast
 *   radius; the connect flow warns and requires admin on each.
 */
export type GrantScopeKind = "projects" | "workspace" | "workspaces";
export type GrantStatus = "pending" | "active";

export interface AgentGrant {
  id: string;
  client: string;
  /** Masked for display; the raw token is shown once at creation. */
  maskedToken: string;
  /** Human-readable labels, kept for older list surfaces. */
  scopes: string[];
  access: AccessKey[];
  scopeKind: GrantScopeKind;
  /** The workspace the key was minted in; the anchor for its reach. */
  homeWorkspaceId: string;
  /** scopeKind "projects": the exact projects it may touch. */
  projectIds?: string[];
  /** scopeKind "workspaces": the whole workspaces it spans (home included). */
  workspaceIds?: string[];
  status: GrantStatus;
  createdAt: number;
  /** Keys expire; rotation is a feature, not a chore. */
  expiresAt: number;
  authorizedAt?: number;
  lastUsedAt?: number;
}

/** Count of distinct targets a grant reaches, for compact chips. */
export function grantReach(g: AgentGrant): { kind: GrantScopeKind; count: number } {
  if (g.scopeKind === "projects") return { kind: "projects", count: g.projectIds?.length ?? 1 };
  if (g.scopeKind === "workspaces") return { kind: "workspaces", count: g.workspaceIds?.length ?? 1 };
  return { kind: "workspace", count: 1 };
}

export const EXTERNAL_CLIENTS = [
  { id: "claude-code", label: "Claude Code", hint: "Terminal and IDE" },
  { id: "cursor", label: "Cursor", hint: "IDE" },
  { id: "vscode", label: "VS Code", hint: "IDE" },
  { id: "custom", label: "Custom MCP client", hint: "Any MCP-compatible tool" },
] as const;

export const DEFAULT_SCOPES = ["Read content", "Write drafts to staging", "Run read-only audits"];

const byProject = new Map<string, AgentGrant[]>();
const listeners = new Set<() => void>();
const EMPTY: AgentGrant[] = [];

function emit() {
  version++;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
let version = 0;

export function useAgentGrants(projectId: string): AgentGrant[] {
  return useSyncExternalStore(
    subscribe,
    () => byProject.get(projectId) ?? EMPTY,
    () => byProject.get(projectId) ?? EMPTY,
  );
}

/** Non-hook read, for cross-project summaries (workspace Connected agents). */
export function getAgentGrants(projectId: string): AgentGrant[] {
  return byProject.get(projectId) ?? EMPTY;
}

/** Re-render on any grant change; pair with getAgentGrants across projects. */
export function useGrantsVersion(): number {
  return useSyncExternalStore(
    subscribe,
    () => version,
    () => version,
  );
}

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "bcms_agent_";
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const agentGrantActions = {
  /**
   * Creates a PENDING grant and returns the raw token (shown once, never
   * stored). The connection only serves requests after authorize().
   */
  create(
    projectId: string,
    client: string,
    opts?: {
      access?: AccessKey[];
      scopeKind?: GrantScopeKind;
      homeWorkspaceId: string;
      projectIds?: string[];
      workspaceIds?: string[];
    },
  ): { grant: AgentGrant; token: string } {
    const token = randomToken();
    const access = opts?.access?.length ? opts.access : (["content.read", "content.write", "media"] as AccessKey[]);
    const scopeKind = opts?.scopeKind ?? "projects";
    const grant: AgentGrant = {
      id: `grant_${Date.now().toString(36)}${(seq++).toString(36)}`,
      client,
      maskedToken: `${token.slice(0, 11)}...${token.slice(-4)}`,
      scopes: access.map(accessLabel),
      access,
      scopeKind,
      homeWorkspaceId: opts?.homeWorkspaceId ?? "",
      projectIds: scopeKind === "projects" ? (opts?.projectIds?.length ? opts.projectIds : [projectId]) : undefined,
      workspaceIds: scopeKind === "workspaces" ? opts?.workspaceIds : undefined,
      status: "pending",
      createdAt: Date.now(),
      expiresAt: Date.now() + 30 * 86400000,
    };
    byProject.set(projectId, [grant, ...(byProject.get(projectId) ?? [])]);
    emit();
    const { count, kind } = grantReach(grant);
    const reach = kind === "workspace" ? "whole workspace" : `${count} ${kind === "workspaces" ? (count === 1 ? "workspace" : "workspaces") : count === 1 ? "project" : "projects"}`;
    recordAgentAudit(projectId, "agent.external_key_created", `${client} connection key created (${access.length} permissions, ${reach}), awaiting authorization`, grant.id);
    return { grant, token };
  },
  /** The human moment: nothing serves until a person authorizes it. */
  authorize(projectId: string, grantId: string) {
    byProject.set(
      projectId,
      (byProject.get(projectId) ?? []).map((g) => (g.id === grantId ? { ...g, status: "active" as const, authorizedAt: Date.now() } : g)),
    );
    emit();
    const g = (byProject.get(projectId) ?? []).find((x) => x.id === grantId);
    if (g) recordAgentAudit(projectId, "agent.external_authorized", `${g.client} connection authorized (${g.access.map(accessLabel).join(", ")})`, grantId);
  },
  revoke(projectId: string, grantId: string) {
    const g = (byProject.get(projectId) ?? []).find((x) => x.id === grantId);
    byProject.set(
      projectId,
      (byProject.get(projectId) ?? []).filter((x) => x.id !== grantId),
    );
    emit();
    if (g) recordAgentAudit(projectId, "agent.external_revoked", `${g.client} access revoked`, grantId);
  },
};
