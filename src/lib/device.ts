/**
 * device — viewport tiers for the capability model.
 *
 * BetterCMS is desktop-first (like Webflow), but smaller screens get a
 * focused editor experience instead of a broken squeeze:
 * - mobile  (<768px): content work only — pages, entries, media, the
 *   settings people actually need on the go (team invites, plan, account).
 * - tablet  (768-1279px): the full product, compressed. iPads often stand
 *   in for laptops, so developer surfaces (schema, hosting) stay available.
 * - desktop (>=1280px): everything, unchanged.
 *
 * A phone held sideways reports a tablet-ish width but has no vertical
 * room, so short landscape viewports (<500px tall) are treated as mobile.
 */
import { useSyncExternalStore } from "react";

export type ViewportTier = "mobile" | "tablet" | "desktop";

const QUERIES = {
  tabletUp: "(min-width: 768px)",
  desktopUp: "(min-width: 1280px)",
  shortLandscape: "(max-height: 499px) and (orientation: landscape)",
} as const;

function computeTier(): ViewportTier {
  if (typeof window === "undefined") return "desktop"; // SSR: render the full app, gate on hydrate
  if (window.matchMedia(QUERIES.shortLandscape).matches) return "mobile";
  if (window.matchMedia(QUERIES.desktopUp).matches) return "desktop";
  if (window.matchMedia(QUERIES.tabletUp).matches) return "tablet";
  return "mobile";
}

let current: ViewportTier = computeTier();
const listeners = new Set<() => void>();
let wired = false;

function wire() {
  if (wired || typeof window === "undefined") return;
  wired = true;
  for (const q of Object.values(QUERIES)) {
    window.matchMedia(q).addEventListener("change", () => {
      const next = computeTier();
      if (next !== current) {
        current = next;
        listeners.forEach((l) => l());
      }
    });
  }
}

export function useViewportTier(): ViewportTier {
  return useSyncExternalStore(
    (l) => {
      wire();
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
    () => "desktop" as ViewportTier,
  );
}

export function getViewportTier(): ViewportTier {
  return computeTier();
}
