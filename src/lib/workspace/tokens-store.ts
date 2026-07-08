/**
 * tokens-store — workspace API tokens and webhook endpoints.
 *
 * Real key UX in the demo: creating a token returns the raw value exactly
 * once (the reveal dialog), the list only ever shows a masked form, and
 * revoking is immediate. Webhook endpoints carry a signing secret with the
 * same shown-once rule. In-memory per workspace; production persists.
 */
import { useSyncExternalStore } from "react";

export type TokenKind = "personal" | "machine";

export interface ApiToken {
  id: string;
  kind: TokenKind;
  name: string;
  masked: string;
  createdAt: number;
  lastUsedAt?: number;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: number;
}

export const WEBHOOK_EVENTS = [
  { id: "page.published", label: "Page published" },
  { id: "entry.published", label: "Entry published" },
  { id: "form.submission", label: "Form submission" },
  { id: "agent.applied", label: "Agent changes applied" },
  { id: "member.invited", label: "Member invited" },
];

interface WsDevState {
  tokens: ApiToken[];
  webhooks: WebhookEndpoint[];
}

const byWorkspace = new Map<string, WsDevState>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}
function ensure(wsId: string): WsDevState {
  let s = byWorkspace.get(wsId);
  if (!s) {
    s = { tokens: [], webhooks: [] };
    byWorkspace.set(wsId, s);
  }
  return s;
}

export function useWsDev(wsId: string): WsDevState {
  return useSyncExternalStore(
    subscribe,
    () => ensure(wsId),
    () => ensure(wsId),
  );
}

let seq = 0;
const rand = (n: number) => {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < n; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const tokenActions = {
  /** Returns the raw token exactly once; only the mask is stored. */
  create(wsId: string, kind: TokenKind, name: string): { token: ApiToken; raw: string } {
    const prefix = kind === "personal" ? "bcms_pat" : "bcms_mt";
    const raw = `${prefix}_${rand(32)}`;
    const token: ApiToken = {
      id: `tok_${Date.now().toString(36)}${(seq++).toString(36)}`,
      kind,
      name: name.trim(),
      masked: `${raw.slice(0, prefix.length + 5)}...${raw.slice(-4)}`,
      createdAt: Date.now(),
    };
    const s = ensure(wsId);
    byWorkspace.set(wsId, { ...s, tokens: [token, ...s.tokens] });
    emit();
    return { token, raw };
  },
  revoke(wsId: string, tokenId: string) {
    const s = ensure(wsId);
    byWorkspace.set(wsId, { ...s, tokens: s.tokens.filter((t) => t.id !== tokenId) });
    emit();
  },
};

export const webhookActions = {
  /** Returns the endpoint plus its signing secret, shown once. */
  add(wsId: string, url: string, events: string[]): { endpoint: WebhookEndpoint; secret: string } {
    const endpoint: WebhookEndpoint = {
      id: `wh_${Date.now().toString(36)}${(seq++).toString(36)}`,
      url: url.trim(),
      events,
      active: true,
      createdAt: Date.now(),
    };
    const s = ensure(wsId);
    byWorkspace.set(wsId, { ...s, webhooks: [endpoint, ...s.webhooks] });
    emit();
    return { endpoint, secret: `whsec_${rand(32)}` };
  },
  setActive(wsId: string, id: string, active: boolean) {
    const s = ensure(wsId);
    byWorkspace.set(wsId, { ...s, webhooks: s.webhooks.map((w) => (w.id === id ? { ...w, active } : w)) });
    emit();
  },
  remove(wsId: string, id: string) {
    const s = ensure(wsId);
    byWorkspace.set(wsId, { ...s, webhooks: s.webhooks.filter((w) => w.id !== id) });
    emit();
  },
};
