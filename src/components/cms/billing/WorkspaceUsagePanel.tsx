import { Link } from "@tanstack/react-router";
import { SettingsSection } from "@/components/cms/SettingsSubNav";
import { MetricGrid, MetricTile } from "@/components/cms/ui/MetricTile";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import {
  OVERAGE_PROMISE,
  SITE_PLANS,
  USAGE_STATE_NOTE,
  fmtCompact,
  fmtGB,
  usageState,
} from "@/lib/billing/pricing";
import type { Project, Workspace } from "@/lib/cms/types";

/**
 * Per-site usage for every project in a workspace: a summed roll-up on top,
 * then one card per site with meters against what its plan includes.
 *
 * Usage states are calm on purpose: healthy is emerald, approaching is amber,
 * over is sky. Never red. Enterprise sites have custom limits and render a
 * quiet neutral bar with no percentage.
 */

interface PanelProps {
  workspace: Workspace;
  projects: Project[];
  showHeader?: boolean;
}

export function WorkspaceUsagePanel({ workspace, projects, showHeader = false }: PanelProps) {
  const totals = projects.reduce(
    (acc, p) => {
      acc.bandwidthGB += p.usage?.bandwidthGB ?? 0;
      acc.storageGB += p.usage?.storageGB ?? 0;
      acc.apiRequests += p.usage?.apiRequests ?? 0;
      acc.aiCreditsUsed += p.usage?.aiCreditsUsed ?? 0;
      return acc;
    },
    { bandwidthGB: 0, storageGB: 0, apiRequests: 0, aiCreditsUsed: 0 },
  );

  const siteCount = `${projects.length} ${projects.length === 1 ? "site" : "sites"}, this period`;

  return (
    <div>
      {showHeader && (
        <div className="mb-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Usage</h2>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">
            What each site is using this period, against what its plan includes.
          </p>
        </div>
      )}

      {/* Roll-up across every site in the workspace */}
      <div className="mb-6">
        <MetricGrid cols={4}>
          <MetricTile label="Bandwidth" value={fmtGB(totals.bandwidthGB)} sublabel={siteCount} />
          <MetricTile label="Storage" value={fmtGB(totals.storageGB)} sublabel={siteCount} />
          <MetricTile label="API requests" value={fmtCompact(totals.apiRequests)} sublabel={siteCount} />
          <MetricTile label="AI credits used" value={fmtCompact(totals.aiCreditsUsed)} sublabel={siteCount} />
        </MetricGrid>
      </div>

      {projects.map((p) => (
        <SiteUsageCard key={p.id} workspace={workspace} project={p} />
      ))}

      <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">{OVERAGE_PROMISE}</p>
    </div>
  );
}

/* ─────────────────────────── One site ─────────────────────────── */

const TRIAL_CREDITS_NOTE =
  "Trial credits are nearly used. Paid plans include monthly credits that reset.";

function SiteUsageCard({ workspace, project }: { workspace: Workspace; project: Project }) {
  const plan = project.sitePlan ?? "free";
  const def = SITE_PLANS[plan];
  const u = project.usage;

  // 0 means the plan has no locales; null means custom, which still shows a meter.
  const showLocales = def.limits.locales == null || def.limits.locales > 0;

  const creditLimit = def.limits.aiCredits;
  const nearTrialEnd =
    plan === "free" && creditLimit != null && creditLimit > 0 && (u?.aiCreditsUsed ?? 0) / creditLimit >= 0.5;

  return (
    <SettingsSection
      title={project.domain ?? project.name}
      description={`${project.name} · ${def.name} site`}
      action={
        <div className="flex items-center gap-3">
          <SitePlanBadge plan={plan} />
          <Link
            // The site plan page ships alongside this panel; the generated route
            // tree may not include it yet, so the path is passed as a plain string.
            to={`/w/${workspace.slug}/p/${project.slug}/settings/plan` as never}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            Plan and usage
          </Link>
        </div>
      }
    >
      <div className="divide-y divide-[color:var(--border-hairline)]">
        <UsageMeter label="Bandwidth" used={u?.bandwidthGB ?? 0} limit={def.limits.bandwidthGB} format={fmtGB} />
        <UsageMeter label="Storage" used={u?.storageGB ?? 0} limit={def.limits.storageGB} format={fmtGB} />
        <UsageMeter label="API requests" used={u?.apiRequests ?? 0} limit={def.limits.apiRequests} format={fmtCompact} />
        <UsageMeter
          label="AI credits"
          used={u?.aiCreditsUsed ?? 0}
          limit={def.limits.aiCredits}
          format={fmtCompact}
          extraNote={nearTrialEnd ? TRIAL_CREDITS_NOTE : undefined}
        />
        {showLocales && (
          <UsageMeter
            label="Locales"
            used={u?.localesUsed ?? 0}
            limit={def.limits.locales}
            format={(n) => String(n)}
          />
        )}
      </div>
    </SettingsSection>
  );
}

/* ─────────────────────────── One meter ─────────────────────────── */

function UsageMeter({
  label,
  used,
  limit,
  format,
  extraNote,
}: {
  label: string;
  used: number;
  limit: number | null;
  format: (n: number) => string;
  extraNote?: string;
}) {
  // null limit = custom plan (Enterprise): quiet neutral bar, no percentage.
  const custom = limit == null;
  const state = usageState(used, limit);
  const pct = custom || limit <= 0 ? 0 : Math.round((used / limit) * 100);
  const barWidth = custom ? 100 : Math.min(100, pct);
  const barTone = custom
    ? "bg-muted-foreground/20"
    : state === "over"
      ? "bg-sky-500"
      : state === "approaching"
        ? "bg-amber-500"
        : "bg-emerald-500";
  const note = custom ? "" : USAGE_STATE_NOTE[state];
  const noteTone =
    state === "over"
      ? "text-sky-600 dark:text-sky-400"
      : state === "approaching"
        ? "text-amber-600 dark:text-amber-400"
        : "text-muted-foreground";

  return (
    <div className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] font-medium text-foreground">{label}</span>
        <span className="text-[12px] tabular-nums text-muted-foreground">
          {custom ? format(used) : `${format(used)} of ${format(limit)} · ${pct}%`}
        </span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${barTone}`} style={{ width: `${barWidth}%` }} />
      </div>
      {custom && (
        <div className="mt-1.5 text-[12px] text-muted-foreground">Custom limits, no hard caps</div>
      )}
      {!custom && note && <div className={`mt-1.5 text-[12px] ${noteTone}`}>{note}</div>}
      {extraNote && <div className="mt-1.5 text-[12px] text-muted-foreground">{extraNote}</div>}
    </div>
  );
}
