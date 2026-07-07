import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDown, ArrowUp, Circle } from "lucide-react";
import { PageShell, Section } from "@/components/cms/layout";
import {
  DateRangePicker,
  daysInRange,
  defaultRange,
  type RangeValue,
} from "@/components/cms/analytics/DateRangePicker";
import { HeadlessApiCallout } from "@/components/cms/headless/HeadlessApiCallout";
import { InlinePlanHint, LockedFeature } from "@/components/cms/billing/FeatureGate";
import { siteHas } from "@/lib/billing/pricing";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import {
  browserBreakdown,
  countryBreakdown,
  deviceBreakdown,
  keywordRows,
  metricsSummary,
  trafficSeries,
  trafficSources,
  type TopRow,
} from "@/lib/seo/mock-data";

export const Route = createFileRoute("/w/$workspace/p/$project/analytics")({
  component: AnalyticsPage,
});

/* ─────────────────────────── date range model ─────────────────────────── */

/* ─────────────────────────────── page ─────────────────────────────────── */

function AnalyticsPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const [range, setRange] = useState<RangeValue>(defaultRange);

  const days = daysInRange(range.start, range.end);
  const comparing = range.compare !== "off";
  const compareLabel = range.compare === "year" ? "vs previous year" : "vs previous period";

  const series = useMemo(() => trafficSeries(pr.slug, Math.min(days, 180)), [pr.slug, days]);
  const chartData = useMemo(
    () =>
      series.map((d, i) => ({
        ...d,
        prev: comparing ? Math.round(d.visitors * (0.78 + (i % 6) * 0.035)) : undefined,
      })),
    [series, comparing],
  );
  const m = useMemo(() => metricsSummary(pr.slug), [pr.slug]);
  const sources = useMemo(() => trafficSources(pr.slug), [pr.slug]);
  const devices = useMemo(() => deviceBreakdown(pr.slug), [pr.slug]);
  const browsers = useMemo(() => browserBreakdown(pr.slug), [pr.slug]);
  const countries = useMemo(() => countryBreakdown(pr.slug), [pr.slug]);
  const kws = useMemo(() => keywordRows(pr.slug).slice(0, 6), [pr.slug]);

  const delta = (curr: number, prev: number) => (prev > 0 ? ((curr - prev) / prev) * 100 : 0);
  const d = (curr: number, prev: number) => (comparing ? delta(curr, prev) : undefined);

  const plan = pr.sitePlan ?? "free";

  if (!siteHas(plan, "analytics")) {
    return (
      <PageShell
        breadcrumbs={[
          { label: workspace, to: "/w/$workspace", params: { workspace } },
          { label: pr.name, to: "/w/$workspace/p/$project/editor", params: { workspace, project } },
          { label: "Analytics" },
        ]}
        title="Analytics"
        description={`Website health and content performance for ${pr.name}.`}
        width="full"
      >
        <LockedFeature
          featureKey="analytics"
          title="Analytics"
          blurb="Traffic, sources, devices and content performance."
          wsSlug={workspace}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumbs={[
        { label: workspace, to: "/w/$workspace", params: { workspace } },
        { label: pr.name, to: "/w/$workspace/p/$project/editor", params: { workspace, project } },
        { label: "Analytics" },
      ]}
      title="Analytics"
      description={`Traffic and audience insights for ${pr.name}.`}
      width="full"
      actions={<DateRangePicker value={range} onChange={setRange} />}
    >
      {plan === "basic" && (
        <div className="mb-6">
          <InlinePlanHint text="Basic analytics. Advanced views are available on Pro." />
        </div>
      )}
      {pr.kind === "headless" && (
        <div className="mb-6">
          <HeadlessApiCallout
            path={`/api/private/projects/${pr.id}/analytics`}
            method="GET"
            keyType="Server"
            description="Cookie-less analytics collected from your frontend via the tracking script. Read aggregated stats server-side."
          />
        </div>
      )}
      <Section title="Overview" meta={comparing ? compareLabel : "no comparison"}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
          <MetricCard label="Visitors" value={m.visitors.toLocaleString()} delta={d(m.visitors, m.prevVisitors)} />
          <MetricCard label="Sessions" value={m.sessions.toLocaleString()} delta={d(m.sessions, m.prevSessions)} />
          <MetricCard label="Pageviews" value={m.pageviews.toLocaleString()} />
          <MetricCard label="Conversions" value={m.conversions.toLocaleString()} delta={d(m.conversions, m.prevConversions)} />
          <MetricCard label="Bounce rate" value={`${Math.round(m.bounceRate * 100)}%`} />
          <MetricCard
            label="Real-time"
            value={String(m.realtime)}
            suffix={
              <span className="ml-1 flex items-center gap-1 text-[10px] text-emerald-500">
                <Circle className="h-1.5 w-1.5 fill-current" />
                live
              </span>
            }
          />
        </div>
      </Section>

      <Section title="Traffic" meta={comparing ? compareLabel : undefined}>
        <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card p-5">
          <div className="mb-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" /> Current period
            </span>
            {comparing && (
              <span className="flex items-center gap-1.5">
                <span className="h-0 w-3.5 border-t-2 border-dashed border-muted-foreground" /> {compareLabel.replace("vs ", "")}
              </span>
            )}
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <Tooltip
                  contentStyle={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area type="monotone" dataKey="visitors" name="Current" stroke="var(--primary)" fill="url(#v)" strokeWidth={2} />
                {comparing && (
                  <Area
                    type="monotone"
                    dataKey="prev"
                    name="Previous"
                    stroke="var(--muted-foreground)"
                    fill="none"
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </Section>

      <Section title="Breakdowns">
        <div className="grid gap-4 lg:grid-cols-2">
          <TopList title="Traffic sources" rows={sources} />
          <TopList title="Top keywords" rows={kws.map((k) => ({ label: k.term, value: k.traffic, delta: k.prevRank - k.rank }))} />
          <TopList title="Devices" rows={devices} />
          <TopList title="Browsers" rows={browsers} />
          <TopList title="Countries" rows={countries} />
        </div>
      </Section>
    </PageShell>
  );
}

/* ───────────────────────── date range picker ──────────────────────────── */

/* ───────────────────────────── pieces ─────────────────────────────────── */

function MetricCard({
  label,
  value,
  delta,
  suffix,
}: {
  label: string;
  value: string;
  delta?: number;
  suffix?: React.ReactNode;
}) {
  const up = (delta ?? 0) > 0;
  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card p-4">
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">{label}</div>
      <div className="mt-1.5 flex items-baseline gap-1">
        <div className="text-[22px] font-semibold tabular-nums">{value}</div>
        {suffix}
      </div>
      {delta !== undefined && (
        <div className={`mt-1 flex items-center gap-0.5 text-[11px] tabular-nums ${up ? "text-emerald-500" : "text-red-500"}`}>
          {up ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}%
        </div>
      )}
    </div>
  );
}

function TopList({ title, rows }: { title: string; rows: TopRow[] }) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card p-5">
      <h3 className="mb-3 text-[13px] font-semibold">{title}</h3>
      <ul className="space-y-2">
        {rows.slice(0, 6).map((r) => (
          <li key={r.label} className="relative">
            <div className="flex items-center justify-between text-[12px]">
              <span className="truncate text-foreground">{r.label}</span>
              <span className="tabular-nums text-muted-foreground">{r.value.toLocaleString()}</span>
            </div>
            <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary/70" style={{ width: `${(r.value / max) * 100}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
