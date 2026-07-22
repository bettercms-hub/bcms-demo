import type { SitePlanId, WorkspacePlanId } from "@/lib/cms/types";

/**
 * The one plan badge system, used everywhere a plan name appears:
 * workspace switcher, dashboard rows, billing pages, site plan pages.
 *
 * V2: plan chips are the single rounded-full exception — outlined pills in
 * the plan blue (`--plan-fg` / `--plan-border`). Free stays neutral.
 */

const PLAN_PILL =
  "border-[color:var(--plan-border)] bg-transparent text-[color:var(--plan-fg)]";
const FREE_PILL =
  "border-[color:var(--color-border)] bg-transparent text-muted-foreground";

const SITE_TONE: Record<SitePlanId, string> = {
  free: FREE_PILL,
  basic: PLAN_PILL,
  pro: PLAN_PILL,
  team: PLAN_PILL,
  enterprise: PLAN_PILL,
};

const WS_TONE: Record<WorkspacePlanId, string> = {
  free: FREE_PILL,
  company: PLAN_PILL,
  agency: PLAN_PILL,
  team: PLAN_PILL,
  enterprise: PLAN_PILL,
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
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${SITE_TONE[plan]} ${className}`}
    >
      {SITE_LABEL[plan]}
    </span>
  );
}

export function WorkspacePlanBadge({ plan, className = "" }: { plan: WorkspacePlanId; className?: string }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-none ${WS_TONE[plan]} ${className}`}
    >
      {WS_LABEL[plan]}
    </span>
  );
}
