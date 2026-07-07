import type { SitePlanId, WorkspacePlanId } from "@/lib/cms/types";

/**
 * The one plan badge system, used everywhere a plan name appears:
 * workspace switcher, dashboard rows, billing pages, site plan pages.
 */

const SITE_TONE: Record<SitePlanId, string> = {
  free: "border-[color:var(--color-border)] bg-[color:var(--s2)] text-muted-foreground",
  basic: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  pro: "border-primary/35 bg-primary/10 text-primary",
  team: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  enterprise: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const WS_TONE: Record<WorkspacePlanId, string> = {
  free: SITE_TONE.free,
  company: "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  agency: "border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
  team: SITE_TONE.team,
  enterprise: SITE_TONE.enterprise,
};

const SITE_LABEL: Record<SitePlanId, string> = {
  free: "Free",
  basic: "Basic",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

const WS_LABEL: Record<WorkspacePlanId, string> = {
  free: "Free",
  company: "Company",
  agency: "Agency",
  team: "Team",
  enterprise: "Enterprise",
};

export function SitePlanBadge({ plan, className = "" }: { plan: SitePlanId; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${SITE_TONE[plan]} ${className}`}
    >
      {SITE_LABEL[plan]}
    </span>
  );
}

export function WorkspacePlanBadge({ plan, className = "" }: { plan: WorkspacePlanId; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${WS_TONE[plan]} ${className}`}
    >
      {WS_LABEL[plan]}
    </span>
  );
}
