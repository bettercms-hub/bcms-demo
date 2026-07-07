import { useEffect, useState } from "react";

export type Appearance = "dark" | "light" | "system";

const KEY = "bettercms.appearance.v2";

function readStored(): Appearance {
  if (typeof window === "undefined") return "light";
  try {
    const v = window.localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* ignore */
  }
  return "light";
}

function resolveSystem(): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyClass(mode: Appearance) {
  if (typeof document === "undefined") return;
  const effective = mode === "system" ? resolveSystem() : mode;
  const root = document.documentElement;
  root.classList.toggle("dark", effective === "dark");
  root.dataset.appearance = effective;
}

const listeners = new Set<(a: Appearance) => void>();

export function setAppearance(mode: Appearance) {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* ignore */
  }
  applyClass(mode);
  listeners.forEach((fn) => fn(mode));
}

export function getAppearance(): Appearance {
  return readStored();
}

export function useAppearance(): [Appearance, (m: Appearance) => void] {
  const [mode, setMode] = useState<Appearance>(() => readStored());
  useEffect(() => {
    const fn = (m: Appearance) => setMode(m);
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  }, []);
  useEffect(() => {
    if (mode !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [mode]);
  return [mode, setAppearance];
}

/** Inline script string that runs before React hydrates to prevent FOUC. */
export const appearanceBootScript = `
(function(){try{var v=localStorage.getItem('${KEY}')||'light';var m=v==='system'?(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):v;var r=document.documentElement;if(m==='dark')r.classList.add('dark');else r.classList.remove('dark');r.dataset.appearance=m;}catch(e){document.documentElement.dataset.appearance='light';}})();
`;
