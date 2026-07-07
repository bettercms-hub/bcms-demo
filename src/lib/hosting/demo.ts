/**
 * BetterCMS Hosting demo data. Deterministic deployment history plus the
 * fake build log used by the live deploy simulation. Prototype only; the
 * real build/deploy services replace this behind the same shapes.
 */

import type { Project } from "@/lib/cms/types";

export type DeployStatus =
  | "queued"
  | "installing"
  | "building"
  | "deploying"
  | "live"
  | "failed"
  | "cancelled"
  | "superseded";

export type DeployEnv = "production" | "preview";

export interface Deployment {
  id: string;
  env: DeployEnv;
  branch: string;
  commit: string; // short sha
  message: string;
  author: string;
  status: DeployStatus;
  when: string; // ISO
  durationSec?: number;
  /** Where this deployment answers. Previews get branch URLs. */
  url: string;
}

export const DEPLOY_STATUS_META: Record<DeployStatus, { label: string; tone: string; dot: string }> = {
  queued: { label: "Queued", tone: "bg-[color:var(--s2)] text-muted-foreground", dot: "bg-muted-foreground/60" },
  installing: { label: "Installing", tone: "bg-sky-500/10 text-sky-600 dark:text-sky-400", dot: "bg-sky-400" },
  building: { label: "Building", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400", dot: "bg-amber-400" },
  deploying: { label: "Deploying", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400", dot: "bg-violet-400" },
  live: { label: "Live", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-400" },
  failed: { label: "Failed", tone: "bg-rose-500/10 text-rose-600 dark:text-rose-400", dot: "bg-rose-400" },
  cancelled: { label: "Cancelled", tone: "bg-[color:var(--s2)] text-muted-foreground", dot: "bg-muted-foreground/40" },
  superseded: { label: "Superseded", tone: "bg-[color:var(--s2)] text-muted-foreground", dot: "bg-muted-foreground/40" },
};

export function previewUrl(branch: string, projectSlug: string) {
  const branchSlug = branch.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return `${branchSlug}-${projectSlug}.bettercms.site`;
}

/** Deterministic recent deployment history for a connected project. */
export function seedDeployments(pr: Project): Deployment[] {
  const slug = pr.slug;
  const prod = `${slug}.bettercms.site`;
  return [
    {
      id: `${pr.id}-dep-1`,
      env: "production",
      branch: pr.hosting?.branch ?? "main",
      commit: "9f2c41a",
      message: "Ship pricing page copy pass",
      author: "Rohan Iyer",
      status: "live",
      when: "2026-07-02T09:42:00Z",
      durationSec: 74,
      url: prod,
    },
    {
      id: `${pr.id}-dep-2`,
      env: "preview",
      branch: "feat/changelog",
      commit: "d81e02b",
      message: "Changelog index and entry pages",
      author: "Elena Costa",
      status: "live",
      when: "2026-07-01T16:08:00Z",
      durationSec: 68,
      url: previewUrl("feat/changelog", slug),
    },
    {
      id: `${pr.id}-dep-3`,
      env: "production",
      branch: pr.hosting?.branch ?? "main",
      commit: "5b77c90",
      message: "Fix OG images on blog posts",
      author: "Himanshu Sahu",
      status: "superseded",
      when: "2026-06-30T11:25:00Z",
      durationSec: 71,
      url: prod,
    },
    {
      id: `${pr.id}-dep-4`,
      env: "preview",
      branch: "feat/docs-search",
      commit: "1acd339",
      message: "Docs search spike",
      author: "Elena Costa",
      status: "failed",
      when: "2026-06-29T14:52:00Z",
      durationSec: 41,
      url: previewUrl("feat/docs-search", slug),
    },
    {
      id: `${pr.id}-dep-5`,
      env: "production",
      branch: pr.hosting?.branch ?? "main",
      commit: "c3901de",
      message: "Homepage hero animation",
      author: "Rohan Iyer",
      status: "superseded",
      when: "2026-06-27T10:03:00Z",
      durationSec: 77,
      url: prod,
    },
    {
      id: `${pr.id}-dep-6`,
      env: "preview",
      branch: "chore/deps",
      commit: "77aa514",
      message: "Bump framework to latest",
      author: "Himanshu Sahu",
      status: "cancelled",
      when: "2026-06-26T08:19:00Z",
      url: previewUrl("chore/deps", slug),
    },
  ];
}

/** Fake build log, streamed line by line during the deploy simulation. */
export function buildLogLines(pr: Project): string[] {
  const h = pr.hosting;
  return [
    `Cloning github.com/${h?.repo ?? "org/repo"} (branch: ${h?.branch ?? "main"}, commit: 4e19abc)`,
    "Cloned in 612ms",
    `Detected framework: Next.js · package manager: ${h?.packageManager ?? "bun"} · node ${h?.nodeVersion ?? "20"}`,
    `Running "${h?.installCommand ?? "bun install"}"`,
    "412 packages installed in 3.1s",
    "Injecting BetterCMS environment: BETTERCMS_PROJECT_ID, BETTERCMS_PUBLIC_API_KEY, BETTERCMS_API_URL, BETTERCMS_SITE_URL, BETTERCMS_ENVIRONMENT",
    "Server-only secrets kept out of the client bundle: BETTERCMS_PREVIEW_API_KEY, BETTERCMS_SERVER_API_KEY",
    `Running "${h?.buildCommand ?? "bun run build"}"`,
    "Creating an optimized production build...",
    "Compiled successfully",
    "Collecting page data · 24 routes",
    "Generating static pages (24/24)",
    `Build output ready in ${h?.outputDir ?? ".next"}`,
    "Uploading build artifacts to the edge network...",
    "Warming CDN caches in 3 regions",
    "Running post-deploy checks: sitemap ok · robots ok · redirects ok",
    "Deployment is live",
  ];
}

/** Env vars we inject at build time. Secrets never reach the browser bundle. */
export function injectedEnv(pr: Project): { name: string; value: string; secret: boolean }[] {
  return [
    { name: "BETTERCMS_PROJECT_ID", value: pr.id, secret: false },
    { name: "BETTERCMS_PUBLIC_API_KEY", value: "bcms_pub_************", secret: false },
    { name: "BETTERCMS_PREVIEW_API_KEY", value: "encrypted at rest", secret: true },
    { name: "BETTERCMS_SERVER_API_KEY", value: "encrypted at rest", secret: true },
    { name: "BETTERCMS_API_URL", value: `https://api.bettercms.site/v1/${pr.id}`, secret: false },
    { name: "BETTERCMS_SITE_URL", value: `https://${pr.domain ?? `${pr.slug}.bettercms.site`}`, secret: false },
    { name: "BETTERCMS_ENVIRONMENT", value: "production | preview per deploy", secret: false },
  ];
}
