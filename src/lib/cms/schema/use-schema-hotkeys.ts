/**
 * Schema-workspace keyboard shortcuts.
 *
 *   /              → open field palette in insertion mode
 *   ⌘K / ^K        → open field palette in search mode
 *   1..4           → switch view modes
 *   Esc            → close slide-over / clear selection
 *   ⌫ / Del        → delete selected field
 *   ⌘Z / ^Z        → undo structural change
 *   ⌘⇧Z / ^⇧Z      → redo structural change
 *   ⌘J / ^J        → toggle JSON view
 *   ?              → toggle keyboard shortcuts overlay
 */
import { useEffect } from "react";

interface Opts {
  openPalette: (mode: "insert" | "search") => void;
  setView: (v: 1 | 2 | 3 | 4) => void;
  onEscape: () => void;
  onDeleteSelected: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  onToggleJson?: () => void;
  onToggleShortcuts?: () => void;
}

export function useSchemaHotkeys({
  openPalette,
  setView,
  onEscape,
  onDeleteSelected,
  onUndo,
  onRedo,
  onToggleJson,
  onToggleShortcuts,
}: Opts) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const isTyping =
        !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);

      if (e.key === "Escape") {
        onEscape();
        return;
      }
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        openPalette("search");
        return;
      }
      if (mod && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) onRedo?.();
        else onUndo?.();
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        onToggleJson?.();
        return;
      }
      if (isTyping) return;

      if (e.key === "?") {
        e.preventDefault();
        onToggleShortcuts?.();
        return;
      }
      if (e.key === "/") {
        e.preventDefault();
        openPalette("insert");
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        onDeleteSelected();
        return;
      }
      if (["1", "2", "3", "4"].includes(e.key)) {
        setView(Number(e.key) as 1 | 2 | 3 | 4);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [
    openPalette,
    setView,
    onEscape,
    onDeleteSelected,
    onUndo,
    onRedo,
    onToggleJson,
    onToggleShortcuts,
  ]);
}
