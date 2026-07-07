/**
 * BYOK store — bring your own API key, per workspace.
 *
 * With a key added, the composer's model menu grows a "Your models"
 * section where the user picks the exact model. BYOK runs bill to the
 * user's key, not to credits. Managed runs stay on Lite, Balanced, Max
 * and never show a model name; showing names here is fine because the
 * models belong to the user.
 *
 * Demo: keys live in memory only and never leave the browser.
 */
import { useSyncExternalStore } from "react";

export interface ByokConfig {
  provider: string;
  /** Masked for display, e.g. "sk-...x4F2". The raw key is never kept. */
  maskedKey: string;
  models: string[];
  /** Currently selected model, or null when running on managed tiers. */
  activeModel: string | null;
}

export const BYOK_PROVIDERS: { id: string; label: string; models: string[] }[] = [
  { id: "openai", label: "OpenAI", models: ["gpt-5.5", "gpt-5.5-mini", "gpt-4.2"] },
  { id: "anthropic", label: "Anthropic", models: ["claude-fable-5", "claude-opus-4-8", "claude-haiku-4-5"] },
  { id: "google", label: "Google", models: ["gemini-3-pro", "gemini-3-flash"] },
  { id: "openrouter", label: "OpenRouter", models: ["auto-router", "llama-4-405b"] },
];

const byWorkspace = new Map<string, ByokConfig>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useByok(wsSlug: string): ByokConfig | null {
  return useSyncExternalStore(
    subscribe,
    () => byWorkspace.get(wsSlug) ?? null,
    () => byWorkspace.get(wsSlug) ?? null,
  );
}

export const byokActions = {
  saveKey(wsSlug: string, providerId: string, rawKey: string) {
    const provider = BYOK_PROVIDERS.find((p) => p.id === providerId);
    if (!provider || rawKey.trim().length < 8) return;
    const tail = rawKey.trim().slice(-4);
    byWorkspace.set(wsSlug, {
      provider: provider.label,
      maskedKey: `${rawKey.trim().slice(0, 3)}...${tail}`,
      models: provider.models,
      activeModel: byWorkspace.get(wsSlug)?.activeModel ?? null,
    });
    emit();
  },
  setModel(wsSlug: string, model: string | null) {
    const cfg = byWorkspace.get(wsSlug);
    if (!cfg) return;
    byWorkspace.set(wsSlug, { ...cfg, activeModel: model });
    emit();
  },
  removeKey(wsSlug: string) {
    byWorkspace.delete(wsSlug);
    emit();
  },
};
