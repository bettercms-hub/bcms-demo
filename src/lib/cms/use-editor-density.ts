/**
 * Editor density — per-user preference for how much content the page
 * editor renders by default. Persisted to localStorage; broadcast to all
 * PageView instances via a CustomEvent so the toggle anywhere updates
 * every open page editor.
 */
import { useEffect, useState } from "react";

export type EditorDensity = "compact" | "comfortable" | "expanded";

const STORAGE_KEY = "bettercms.editor.density";
const EVENT = "bettercms:density-change";

export function readDensity(): EditorDensity {
  if (typeof window === "undefined") return "comfortable";
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === "compact" || v === "comfortable" || v === "expanded") return v;
  return "comfortable";
}

export function writeDensity(d: EditorDensity) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, d);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: d }));
}

export function useEditorDensity(): {
  density: EditorDensity;
  setDensity: (d: EditorDensity) => void;
} {
  const [density, setLocal] = useState<EditorDensity>(() => readDensity());
  useEffect(() => {
    const onChange = (e: Event) => {
      const d = (e as CustomEvent<EditorDensity>).detail;
      if (d) setLocal(d);
    };
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
  return {
    density,
    setDensity: (d) => {
      writeDensity(d);
      setLocal(d);
    },
  };
}
