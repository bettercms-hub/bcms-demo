import { useSyncExternalStore } from "react";
import type { AnchorKind, AnchorRef, CommentSurface, Viewport } from "@/lib/comments/types";

export interface PendingPin {
  surface: CommentSurface;
  pageId?: string;
  anchorKind: AnchorKind;
  anchorRef: AnchorRef;
  viewport?: Viewport;
  /** Viewport pixel coords of the originating click; used to anchor the composer popover Figma-style. */
  clientPoint?: { x: number; y: number };
  selectionText?: string;
}

export interface CommentsUiState {
  modeOn: boolean;
  sidebarOpen: boolean;
  activeThreadId: string | null;
  hoverThreadId: string | null;
  pending: PendingPin | null;
  filter:
    | "all"
    | "open"
    | "resolved"
    | "mine"
    | "ai"
    | "unread"
    | "priority";
  search: string;
  surfaceFilter: CommentSurface | "all";
}

type Listener = () => void;

const state: CommentsUiState = {
  modeOn: false,
  sidebarOpen: false,
  activeThreadId: null,
  hoverThreadId: null,
  pending: null,
  filter: "open",
  search: "",
  surfaceFilter: "all",
};

const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}

function snapshot(): CommentsUiState {
  return state;
}

export const commentsUi = {
  get: snapshot,
  toggleMode() {
    state.modeOn = !state.modeOn;
    if (!state.modeOn) state.pending = null;
    emit();
  },
  setMode(on: boolean) {
    state.modeOn = on;
    if (!on) state.pending = null;
    emit();
  },
  setSidebarOpen(open: boolean) {
    state.sidebarOpen = open;
    emit();
  },
  toggleSidebar() {
    state.sidebarOpen = !state.sidebarOpen;
    emit();
  },
  setActive(id: string | null) {
    state.activeThreadId = id;
    if (id) state.sidebarOpen = true;
    emit();
  },
  setHover(id: string | null) {
    state.hoverThreadId = id;
    emit();
  },
  setPending(p: PendingPin | null) {
    state.pending = p;
    emit();
  },
  setFilter(f: CommentsUiState["filter"]) {
    state.filter = f;
    emit();
  },
  setSearch(s: string) {
    state.search = s;
    emit();
  },
  setSurfaceFilter(s: CommentSurface | "all") {
    state.surfaceFilter = s;
    emit();
  },
};

export function useCommentsUi<T>(selector: (s: CommentsUiState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}
