/**
 * Delivery model. One content core, pluggable delivery.
 *
 * Every project owns the same content core: schemas, entries, pages as block
 * trees, media, SEO records. Delivery decides who renders and serves it:
 * - hosted: BetterCMS Cloud renders and hosts the site (domains, publishing).
 * - api: the Content Delivery API serves the same content to any frontend.
 *
 * Modes are presets over those two switches:
 * - Hosted site: hosted on, api off
 * - Headless:    hosted off, api on
 * - Hybrid:      both on (hosted site plus the API for apps and other frontends)
 *
 * Switching modes never moves or converts content. It only changes which
 * delivery adapters are active. See docs/adr/0001-content-delivery.md.
 */

import type { Project, ProjectDelivery } from "./types";

export type DeliveryMode = "hosted" | "headless" | "hybrid";

/** Resolve a project's delivery, deriving from legacy `kind` when unset. */
export function getDelivery(pr: Pick<Project, "delivery" | "kind"> | undefined | null): ProjectDelivery {
  if (pr?.delivery) return pr.delivery;
  if (pr?.kind === "headless") return { hosted: false, api: true };
  return { hosted: true, api: false };
}

export function deliveryMode(d: ProjectDelivery): DeliveryMode {
  if (d.hosted && d.api) return "hybrid";
  if (d.hosted) return "hosted";
  return "headless";
}

export function modeOf(pr: Pick<Project, "delivery" | "kind"> | undefined | null): DeliveryMode {
  return deliveryMode(getDelivery(pr));
}

export const DELIVERY_MODES: Record<
  DeliveryMode,
  {
    id: DeliveryMode;
    label: string;
    tagline: string;
    delivery: ProjectDelivery;
    /** What is on in this mode, in plain words. */
    includes: string[];
    /** Who renders the site. */
    renderer: string;
  }
> = {
  hosted: {
    id: "hosted",
    label: "Hosted site",
    tagline: "BetterCMS renders, hosts and publishes the site for you.",
    delivery: { hosted: true, api: false },
    includes: ["Page builder and publishing", "Domains, SSL and redirects", "Hosting on BetterCMS Cloud"],
    renderer: "BetterCMS Cloud",
  },
  headless: {
    id: "headless",
    label: "Headless",
    tagline: "Your own frontend fetches content over the API and renders it.",
    delivery: { hosted: false, api: true },
    includes: [
      "Content Delivery API and SDKs",
      "Scoped keys and webhooks",
      "Host the frontend anywhere, or on BetterCMS Hosting",
    ],
    renderer: "Your frontend (Next.js, Astro, anything)",
  },
  hybrid: {
    id: "hybrid",
    label: "Hybrid",
    tagline: "Hosted site and the API at the same time, from one content core.",
    includes: ["Everything in Hosted site", "Everything in Headless", "One content core feeds both"],
    delivery: { hosted: true, api: true },
    renderer: "BetterCMS Cloud, plus any API consumer",
  },
};

export const DELIVERY_MODE_ORDER: DeliveryMode[] = ["hosted", "headless", "hybrid"];

/** Plain-words summary of what changes when moving between two modes. */
export function switchSummary(from: DeliveryMode, to: DeliveryMode): string[] {
  const f = DELIVERY_MODES[from].delivery;
  const t = DELIVERY_MODES[to].delivery;
  const lines: string[] = [];
  if (!f.hosted && t.hosted) lines.push("Hosting turns on: page builder, publishing, domains and redirects appear.");
  if (f.hosted && !t.hosted) lines.push("Hosting turns off: publishing and domains hide. Your frontend takes over rendering.");
  if (!f.api && t.api) lines.push("The Content Delivery API turns on: endpoints, keys, webhooks and the integration guide appear.");
  if (f.api && !t.api) lines.push("The Content Delivery API turns off: endpoints stop serving and API surfaces hide.");
  lines.push("Content, media, SEO, forms and analytics never move. Switch back any time.");
  return lines;
}
