/**
 * Connected agents — outside tools (Claude Code, Cursor, VS Code, any
 * MCP client) that drive this project through the same operation layer
 * as the in-app agent.
 *
 * The trust model mirrors the in-app agent exactly: project-scoped,
 * staging-only writes, revocable at any time, every action audited.
 * Demo: grants live in memory; the token is generated client side and
 * shown once, like a real key flow.
 */
import { useSyncExternalStore } from "react";

export interface AgentGrant {
  id: string;
  client: string;
  /** Masked for display; the raw token is shown once at creation. */
  maskedToken: string;
  scopes: string[];
  createdAt: number;
  lastUsedAt?: number;
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
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;

export function useAgentGrants(projectId: string): AgentGrant[] {
  return useSyncExternalStore(
    subscribe,
    () => byProject.get(projectId) ?? EMPTY,
    () => byProject.get(projectId) ?? EMPTY,
  );
}

function randomToken(): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "bcms_agent_";
  for (let i = 0; i < 32; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export const agentGrantActions = {
  /** Creates a grant and returns the raw token. Shown once, never stored. */
  create(projectId: string, client: string): { grant: AgentGrant; token: string } {
    const token = randomToken();
    const grant: AgentGrant = {
      id: `grant_${Date.now().toString(36)}${(seq++).toString(36)}`,
      client,
      maskedToken: `${token.slice(0, 11)}...${token.slice(-4)}`,
      scopes: [...DEFAULT_SCOPES],
      createdAt: Date.now(),
    };
    byProject.set(projectId, [grant, ...(byProject.get(projectId) ?? [])]);
    emit();
    return { grant, token };
  },
  revoke(projectId: string, grantId: string) {
    byProject.set(
      projectId,
      (byProject.get(projectId) ?? []).filter((g) => g.id !== grantId),
    );
    emit();
  },
};
