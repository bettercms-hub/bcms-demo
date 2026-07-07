/** Tiny typed pub-sub for cross-component editor events. */

export type EditorEvent =
  | { type: "editor:set-mode"; mode: "content" | "split" | "preview" }
  | { type: "editor:toggle-panel"; side: "left" | "right" }
  | { type: "editor:focus-tree" }
  | { type: "editor:rename-selected" }
  | { type: "editor:set-preview-source"; source: "draft" | "published" | "compare" }
  | { type: "editor:set-preview-device"; device: "desktop" | "tablet" | "mobile" }
  | { type: "editor:refresh-preview" }
  | { type: "editor:open-cheatsheet" }
  | { type: "editor:collapse-all" }
  | { type: "editor:expand-all" }
  | { type: "editor:toggle-flag"; flag: "show-metadata" | "show-summaries"; value: boolean }
  | { type: "editor:request-publish" }
  | { type: "editor:hover-section"; sectionId: string | undefined }
  | { type: "editor:open-block-library"; sectionId: string };

type Listener = (e: EditorEvent) => void;
const listeners = new Set<Listener>();

export const editorBus = {
  emit(e: EditorEvent) {
    listeners.forEach((l) => l(e));
  },
  on(l: Listener): () => void {
    listeners.add(l);
    return () => { listeners.delete(l); };
  },
};
