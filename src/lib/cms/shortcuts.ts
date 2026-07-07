/** Keyboard shortcut parsing + a React hook to bind global shortcuts. */
import { useEffect, useRef } from "react";

export interface ParsedShortcut {
  key: string;       // normalized lowercase key (e.g. "k", "enter", "arrowup", "1")
  mod: boolean;      // cmd on mac, ctrl elsewhere
  shift: boolean;
  alt: boolean;
}

export function parseShortcut(spec: string): ParsedShortcut {
  const parts = spec.toLowerCase().split("+").map((s) => s.trim());
  const key = parts.pop() ?? "";
  return {
    key: normalizeKey(key),
    mod: parts.includes("mod") || parts.includes("cmd") || parts.includes("ctrl"),
    shift: parts.includes("shift"),
    alt: parts.includes("alt") || parts.includes("option"),
  };
}

function normalizeKey(k: string): string {
  if (k === "up") return "arrowup";
  if (k === "down") return "arrowdown";
  if (k === "left") return "arrowleft";
  if (k === "right") return "arrowright";
  if (k === "del" || k === "delete") return "delete";
  if (k === "backspace") return "backspace";
  if (k === "return") return "enter";
  if (k === "space") return " ";
  if (k === "\\") return "\\";
  return k;
}

export function matchEvent(e: KeyboardEvent, s: ParsedShortcut): boolean {
  const modPressed = e.metaKey || e.ctrlKey;
  if (s.mod !== modPressed) return false;
  if (s.shift !== e.shiftKey) return false;
  if (s.alt !== e.altKey) return false;
  const k = e.key.toLowerCase();
  if (k !== s.key) return false;
  return true;
}

export function isEditableTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (t.isContentEditable) return true;
  return false;
}

export interface ShortcutBinding {
  keys: string;                  // e.g. "mod+shift+enter"
  run: (e: KeyboardEvent) => void;
  when?: () => boolean;
  allowInInput?: boolean;
}

/** Sequence binding for vim-style chords like "g p". */
export interface SequenceBinding {
  keys: string;                  // space-separated, e.g. "g p"
  run: () => void;
  when?: () => boolean;
}

export function useShortcuts(bindings: ShortcutBinding[], sequences: SequenceBinding[] = []) {
  const parsed = useRef<{ b: ShortcutBinding; p: ParsedShortcut }[]>([]);
  const seqMap = useRef<SequenceBinding[]>([]);
  parsed.current = bindings.map((b) => ({ b, p: parseShortcut(b.keys) }));
  seqMap.current = sequences;

  useEffect(() => {
    let pending: string | null = null;
    let pendingTimer: ReturnType<typeof setTimeout> | null = null;

    const clearPending = () => {
      pending = null;
      if (pendingTimer) clearTimeout(pendingTimer);
      pendingTimer = null;
    };

    const onKey = (e: KeyboardEvent) => {
      const editable = isEditableTarget(e.target);
      // Combo bindings first
      for (const { b, p } of parsed.current) {
        if (editable && !b.allowInInput) continue;
        if (!matchEvent(e, p)) continue;
        if (b.when && !b.when()) continue;
        e.preventDefault();
        b.run(e);
        clearPending();
        return;
      }
      // Sequence bindings: only single-character keys, no modifier
      if (editable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k.length !== 1) return;
      if (pending) {
        const combo = `${pending} ${k}`;
        const match = seqMap.current.find((s) => s.keys === combo && (!s.when || s.when()));
        clearPending();
        if (match) {
          e.preventDefault();
          match.run();
        }
        return;
      }
      // Begin a sequence if any binding starts with this key
      if (seqMap.current.some((s) => s.keys.startsWith(`${k} `))) {
        pending = k;
        pendingTimer = setTimeout(clearPending, 900);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      clearPending();
    };
  });
}

/** Pretty-print a shortcut spec as kbd-able tokens. */
export function formatShortcut(spec: string, isMac = detectMac()): string[] {
  const parts = spec.toLowerCase().split("+").map((s) => s.trim());
  const out: string[] = [];
  for (const p of parts) {
    if (p === "mod" || p === "cmd") out.push(isMac ? "⌘" : "Ctrl");
    else if (p === "ctrl") out.push("Ctrl");
    else if (p === "shift") out.push(isMac ? "⇧" : "Shift");
    else if (p === "alt" || p === "option") out.push(isMac ? "⌥" : "Alt");
    else if (p === "enter" || p === "return") out.push("⏎");
    else if (p === "up") out.push("↑");
    else if (p === "down") out.push("↓");
    else if (p === "left") out.push("←");
    else if (p === "right") out.push("→");
    else if (p === "backspace") out.push("⌫");
    else if (p === "delete" || p === "del") out.push("Del");
    else if (p === "escape" || p === "esc") out.push("Esc");
    else if (p.length === 1) out.push(p.toUpperCase());
    else out.push(p[0].toUpperCase() + p.slice(1));
  }
  return out;
}

function detectMac(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Mac|iPhone|iPad/.test(navigator.platform);
}

/** Catalog used by both the palette and the cheatsheet. */
export interface ShortcutDoc {
  group: string;
  keys: string;
  label: string;
}

export const SHORTCUTS: ShortcutDoc[] = [
  { group: "General", keys: "mod+k", label: "Open command palette" },
  { group: "General", keys: "?", label: "Show keyboard shortcuts" },
  { group: "Navigate", keys: "g p", label: "Go to Pages" },
  { group: "Navigate", keys: "g c", label: "Go to Collections" },
  { group: "Navigate", keys: "g m", label: "Go to Components" },
  { group: "Navigate", keys: "g i", label: "Go to Media" },
  { group: "Create", keys: "mod+n", label: "New (page / entry / component)" },
  { group: "Editor mode", keys: "mod+1", label: "Content mode" },
  { group: "Editor mode", keys: "mod+2", label: "Split mode" },
  { group: "Editor mode", keys: "mod+3", label: "Preview mode" },
  { group: "Panels", keys: "[", label: "Toggle left panel" },
  { group: "Panels", keys: "]", label: "Toggle right panel" },
  { group: "Panels", keys: "mod+\\", label: "Focus content tree" },
  { group: "Section", keys: "mod+d", label: "Duplicate selected section" },
  { group: "Section", keys: "backspace", label: "Delete selected section" },
  { group: "Section", keys: "alt+up", label: "Move section up" },
  { group: "Section", keys: "alt+down", label: "Move section down" },
  { group: "Publish", keys: "mod+shift+enter", label: "Publish current page" },
  { group: "Preview", keys: "mod+shift+d", label: "Preview Draft" },
  { group: "Preview", keys: "mod+shift+l", label: "Preview Published" },
  { group: "Preview", keys: "mod+shift+k", label: "Preview Compare" },
];

export function shortcutByKeys(keys: string): ShortcutDoc | undefined {
  return SHORTCUTS.find((s) => s.keys === keys);
}
