/**
 * Agent dock store — open state plus the run the dock is showing.
 * Lives outside React so the header button and the dock stay in sync.
 */
import { useSyncExternalStore } from "react";

interface DockState {
  open: boolean;
  activeRunId: string | null;
}

let state: DockState = { open: false, activeRunId: null };
const listeners = new Set<() => void>();

function set(next: DockState) {
  state = next;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useAgentDock(): DockState {
  return useSyncExternalStore(subscribe, () => state, () => state);
}

export const agentDock = {
  open: () => set({ ...state, open: true }),
  close: () => set({ ...state, open: false }),
  toggle: () => set({ ...state, open: !state.open }),
  show: (runId: string | null) => set({ open: true, activeRunId: runId }),
  setRun: (runId: string | null) => set({ ...state, activeRunId: runId }),
};
