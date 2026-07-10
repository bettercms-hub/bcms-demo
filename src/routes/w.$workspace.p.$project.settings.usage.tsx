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
import { Cpu, Download, ExternalLink, HardDrive, Gauge, Server, Sparkles, Globe, Zap } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import {
  DateRangePicker,
  compareLabel,
  daysInRange,
  defaultRange,
  type RangeValue,
} from "@/components/cms/analytics/DateRangePicker";
import { useCMS } from "@/lib/cms/store";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { getDelivery } from "@/lib/cms/delivery";
import { media as MEDIA } from "@/lib/cms/mock-data";
import { creditHistory, type CreditEvent } from "@/lib/billing/demo";
import { SITE_PLANS, fmtCompact, fmtGB, usageState } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/usage")({
  component: Usage,
});

type ResourceKey = "bandwidth" | "storage" | "api" | "ai" | "locales" | "cpu" | "compute";

interface Asset {
  id: string;
  name: string;
  type: string;
  kind: string;
  url: string;
  storage: number;
  requests: number;
  bandwidth: number;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}
function fmtBytes(n: number): string {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${n} B`;
}
function download(name: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((c) => (/[",\n]/.test(String(c)) ? `"${String(c).replace(/"/g, '""')}"` : String(c))).join(","))
    .join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Usage() {
  const { workspace, project } = Route.useParams();
  const ws = getWorkspaceBySlug(workspace);
  const pr = useCMS((s) => s.projects.find((p) => p.slug === project && (ws ? p.workspaceId === ws.id : true)));
  const [active, setActive] = useState<ResourceKey>("bandwidth");
  const [range, setRange] = useState<RangeValue>(() => defaultRange("mtd", "off"));

  const plan: SitePlanId = pr?.sitePlan ?? "free";
  const def = SITE_PLANS[plan];
  const usage = pr?.usage;

  // Per-asset breakdown from the media library (real S3-style storage) with
  // deterministic request/bandwidth estimates so numbers are stable.
  const assets = useMemo<Asset[]>(() => {
    if (!pr) return [];
    return MEDIA.filter((m) => m.projectId === pr.id).map((m) => {
      const storage = m.sizeBytes ?? 0;
      const requests = 200 + (hash(m.id) % 9800);
      const bandwidth = storage * requests;
      const type =
        m.kind === "video" ? "Video" : m.kind === "image" ? (m.mimeType === "image/svg+xml" ? "SVG" : "Image") : "Document";
      return { id: m.id, name: m.name, type, kind: m.kind, url: m.url ?? "", storage, requests, bandwidth };
    });
  }, [pr]);

  const events = useMemo(() => (pr ? creditHistory(pr) : []), [pr]);

  if (!pr) {
    return (
      <>
        <SettingsHeader title="Usage" description="Live consumption for this site." />
        <p className="text-[13px] text-muted-foreground">Project not found.</p>
      </>
    );
  }

  const domain = pr.domain ?? pr.name;
  const creditsUsed = usage?.aiCreditsUsed ?? 0;
  const days = daysInRange(range.start, range.end);
  const comparing = range.compare !== "off";

  // Compute (CPU + function requests) only exists for sites we actually run on
  // BetterCMS Cloud — managed hosting, or a headless frontend hosted with us.
  const onCloud = getDelivery(pr).hosted || pr.hosting?.mode === "bettercms";
  const cpuMinutes = onCloud ? 40 + (hash(pr.slug + "cpu") % 900) : 0;
  const computeReqs = onCloud ? Math.round((usage?.apiRequests ?? 0) * 0.7) : 0;

  type Card = { key: ResourceKey; label: string; icon: typeof Gauge; used: number; limit: number | null; fmt: (n: number) => string };
  const deliveryCards: Card[] = [
    { key: "bandwidth", label: "Bandwidth", icon: Gauge, used: usage?.bandwidthGB ?? 0, limit: def.limits.bandwidthGB, fmt: fmtGB },
    { key: "storage", label: "Asset storage", icon: HardDrive, used: usage?.storageGB ?? 0, limit: def.limits.storageGB, fmt: fmtGB },
    { key: "api", label: "API requests", icon: Server, used: usage?.apiRequests ?? 0, limit: def.limits.apiRequests, fmt: fmtCompact },
    { key: "ai", label: "AI credits", icon: Sparkles, used: creditsUsed, limit: def.limits.aiCredits, fmt: (n) => n.toLocaleString("en-US") },
    { key: "locales", label: "Locales", icon: Globe, used: usage?.localesUsed ?? 0, limit: def.limits.locales, fmt: String },
  ];
  const computeCards: Card[] = onCloud
    ? [
        { key: "cpu", label: "CPU time", icon: Cpu, used: cpuMinutes, limit: null, fmt: (n) => `${n.toLocaleString("en-US")} min` },
        { key: "compute", label: "Compute requests", icon: Zap, used: computeReqs, limit: null, fmt: fmtCompact },
      ]
    : [];
  const cards = [...deliveryCards, ...computeCards];

  return (
    <>
      <SettingsHeader
        title="Usage"
        description={`This billing period for ${domain}. Select a metric for detail.`}
        action={
          <div className="flex items-center gap-2.5">
            <DateRangePicker value={range} onChange={setRange} />
            <button
              type="button"
              onClick={() => {
                download(`${pr.slug}-usage.csv`, [
                  ["metric", "used", "included"],
                  ...cards.map((c) => [c.label, c.fmt(c.used), c.limit == null ? "unlimited" : c.fmt(c.limit)]),
                ]);
                toast.success("Usage summary exported");
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-transparent px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Download className="h-3.5 w-3.5" /> Export
            </button>
          </div>
        }
      />

      {/* Delivery (CDN) metrics — click to drill in */}
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
        Delivery {comparing && <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/60">· {compareLabel(range.compare)}</span>}
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {deliveryCards.map((c) => (
          <MetricCard key={c.key} card={c} active={active === c.key} onClick={() => setActive(c.key)} />
        ))}
      </div>

      {onCloud && (
        <>
          <div className="mb-1.5 flex items-center gap-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
            Compute · BetterCMS Cloud
            <span className="font-normal normal-case tracking-normal text-muted-foreground/60">separate from CDN bandwidth</span>
          </div>
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
            {computeCards.map((c) => (
              <MetricCard key={c.key} card={c} active={active === c.key} onClick={() => setActive(c.key)} />
            ))}
          </div>
        </>
      )}

      {/* Drill-down detail */}
      {active === "bandwidth" && <BandwidthDetail slug={pr.slug} totalGB={usage?.bandwidthGB ?? 0} assets={assets} days={days} />}
      {active === "storage" && <StorageDetail slug={pr.slug} assets={assets} totalGB={usage?.storageGB ?? 0} />}
      {active === "api" && <ApiDetail slug={pr.slug} total={usage?.apiRequests ?? 0} days={days} />}
      {active === "ai" && <AiDetail events={events} used={creditsUsed} slug={pr.slug} />}
      {active === "locales" && <LocalesDetail count={usage?.localesUsed ?? 0} />}
      {(active === "cpu" || active === "compute") && (
        <ComputeDetail slug={pr.slug} cpuMinutes={cpuMinutes} computeReqs={computeReqs} days={days} focus={active} />
      )}
    </>
  );
}

/* ─────────────────────────── metric card ──────────────────────────────── */

function MetricCard({
  card,
  active,
  onClick,
}: {
  card: { label: string; icon: typeof Gauge; used: number; limit: number | null; fmt: (n: number) => string };
  active: boolean;
  onClick: () => void;
}) {
  const Icon = card.icon;
  const pct = card.limit != null ? Math.min(100, (card.used / Math.max(1, card.limit)) * 100) : 0;
  const state = card.limit != null ? usageState(card.used, card.limit) : "healthy";
  const bar = state === "approaching" ? "bg-amber-500" : "bg-sky-500";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border bg-card p-4 text-left transition-colors ${
        active ? "border-primary ring-1 ring-primary/30" : "border-[color:var(--border-hairline)] hover:border-foreground/25"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {card.label}
      </div>
      <div className="mt-2 text-[19px] font-semibold tabular-nums text-foreground">{card.fmt(card.used)}</div>
      <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
        {card.limit == null ? "no cap" : `of ${card.fmt(card.limit)}`}
      </div>
      {card.limit != null && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </button>
  );
}

/* ─────────────────────────── bandwidth ────────────────────────────────── */

function dailySeries(seed: string, totalGB: number, days = 30): { date: string; gb: number }[] {
  // Deterministic per-day values that sum to totalGB, with a mild upward trend.
  const raw = Array.from({ length: days }, (_, i) => {
    const h = hash(`${seed}-${i}`);
    return 0.6 + (h % 100) / 100 + i * 0.02; // weight + trend
  });
  const sum = raw.reduce((a, b) => a + b, 0);
  return raw.map((w, i) => ({ date: `Day ${i + 1}`, gb: Math.round((w / sum) * totalGB * 100) / 100 }));
}

function BandwidthDetail({
  slug,
  totalGB,
  assets,
  days,
}: {
  slug: string;
  totalGB: number;
  assets: Asset[];
  days: number;
}) {
  const data = useMemo(() => dailySeries(slug, totalGB, days), [slug, totalGB, days]);
  const rows = [...assets].sort((a, b) => b.bandwidth - a.bandwidth);
  const peak = data.reduce((m, d) => (d.gb > m.gb ? d : m), data[0]);

  return (
    <>
      <SettingsSection title="Bandwidth over time" description="Daily egress this billing period.">
        <div className="py-2">
          <div className="mb-3 flex flex-wrap gap-6 text-[12px]">
            <Stat label="Total" value={`${totalGB.toFixed(0)} GB`} />
            <Stat label="Avg / day" value={`${(totalGB / data.length).toFixed(2)} GB`} />
            <Stat label="Peak day" value={`${peak.gb.toFixed(2)} GB`} />
          </div>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="bw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={4} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={32} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="gb" stroke="var(--primary)" fill="url(#bw)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SettingsSection>

      <AssetTable
        title="Bandwidth by asset"
        description="Which files are driving egress. Sorted by bandwidth served."
        rows={rows}
        metric="bandwidth"
        slug={slug}
      />
    </>
  );
}

/* ─────────────────────────── storage ──────────────────────────────────── */

function StorageDetail({
  slug,
  assets,
  totalGB,
}: {
  slug: string;
  assets: Asset[];
  totalGB: number;
}) {
  const rows = [...assets].sort((a, b) => b.storage - a.storage);
  const byType = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of assets) m.set(a.type, (m.get(a.type) ?? 0) + a.storage);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [assets]);
  const maxType = Math.max(...byType.map(([, v]) => v), 1);

  return (
    <>
      <SettingsSection title="Storage by type" description={`${totalGB} GB of assets in object storage.`}>
        <div className="space-y-2.5 py-2">
          {byType.map(([type, bytes]) => (
            <div key={type}>
              <div className="mb-1 flex items-center justify-between text-[12px]">
                <span className="text-foreground">{type}</span>
                <span className="tabular-nums text-muted-foreground">{fmtBytes(bytes)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${(bytes / maxType) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </SettingsSection>
      <AssetTable
        title="Storage by asset"
        description="Which files occupy the most object storage."
        rows={rows}
        metric="storage"
        slug={slug}
      />
    </>
  );
}

/* ─────────────────────────── asset table ──────────────────────────────── */

function AssetTable({
  title,
  description,
  rows,
  metric,
  slug,
}: {
  title: string;
  description: string;
  rows: Asset[];
  metric: "bandwidth" | "storage";
  slug: string;
}) {
  const [filter, setFilter] = useState<string>("all");
  const shown = filter === "all" ? rows : rows.filter((r) => r.kind === filter);
  const filters = [
    { key: "all", label: "All" },
    { key: "image", label: "Images" },
    { key: "video", label: "Videos" },
    { key: "file", label: "Documents" },
  ];

  return (
    <SettingsSection
      title={title}
      description={description}
      flush
      action={
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-lg bg-[color:var(--s3)] p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`h-6 rounded-md px-2 text-[11.5px] font-medium transition-colors ${
                  filter === f.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              download(`${slug}-${metric}-by-asset.csv`, [
                ["asset", "type", "storage_bytes", "bandwidth_bytes", "requests"],
                ...shown.map((r) => [r.name, r.type, r.storage, r.bandwidth, r.requests]),
              ]);
              toast.success("Exported to CSV");
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        </div>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
            <tr>
              <th className="px-5 py-2.5 text-left font-medium">Asset</th>
              <th className="px-3 py-2.5 text-left font-medium">Type</th>
              <th className="px-3 py-2.5 text-right font-medium">Storage</th>
              <th className="px-3 py-2.5 text-right font-medium">Bandwidth</th>
              <th className="px-5 py-2.5 text-right font-medium">Requests</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b border-[color:var(--border-hairline)] last:border-b-0 hover:bg-[color:var(--color-row-hover)]">
                <td className="max-w-[280px] px-5 py-2.5">
                  <div className="group/asset flex items-center gap-1.5">
                    <span className="truncate font-medium text-foreground" title={r.name}>{r.name}</span>
                    {r.url && (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        title="Open file in a new tab"
                        aria-label={`Open ${r.name}`}
                        className="shrink-0 text-muted-foreground opacity-0 transition-opacity hover:text-primary group-hover/asset:opacity-100"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2.5 text-muted-foreground">{r.type}</td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${metric === "storage" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {fmtBytes(r.storage)}
                </td>
                <td className={`px-3 py-2.5 text-right tabular-nums ${metric === "bandwidth" ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                  {fmtBytes(r.bandwidth)}
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{r.requests.toLocaleString("en-US")}</td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-[12.5px] text-muted-foreground">
                  No assets of this type.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </SettingsSection>
  );
}

/* ─────────────────────────── API ──────────────────────────────────────── */

const API_ENDPOINTS = [
  { path: "GET /api/public/content", share: 0.42 },
  { path: "GET /api/public/collections/:id", share: 0.24 },
  { path: "POST /api/forms/:id/submit", share: 0.13 },
  { path: "GET /api/public/media", share: 0.1 },
  { path: "GET /api/public/sitemap.xml", share: 0.06 },
  { path: "GET /api/public/rss.xml", share: 0.05 },
];

function ApiDetail({ slug, total, days }: { slug: string; total: number; days: number }) {
  const data = useMemo(
    () => dailySeries(slug + "-api", total, days).map((d) => ({ ...d, reqs: Math.round(d.gb) })),
    [slug, total, days],
  );
  const rows = API_ENDPOINTS.map((e) => ({ ...e, count: Math.round(total * e.share) }));

  return (
    <>
      <SettingsSection title="API requests over time" description="Content Delivery API calls this billing period.">
        <div className="h-[200px] py-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="api" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={4} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={40} tickFormatter={(v) => fmtCompact(v)} />
              <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
              <Area type="monotone" dataKey="reqs" name="requests" stroke="var(--primary)" fill="url(#api)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </SettingsSection>

      <SettingsSection
        title="Requests by endpoint"
        description="Where your API traffic goes."
        flush
        action={
          <button
            type="button"
            onClick={() => {
              download(`${slug}-api-by-endpoint.csv`, [["endpoint", "requests"], ...rows.map((r) => [r.path, r.count])]);
              toast.success("Exported to CSV");
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        }
      >
        <table className="w-full text-[13px]">
          <tbody>
            {rows.map((r) => (
              <tr key={r.path} className="border-b border-[color:var(--border-hairline)] last:border-b-0">
                <td className="px-5 py-2.5 font-mono text-[12px] text-foreground">{r.path}</td>
                <td className="w-[40%] px-3 py-2.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${r.share * 100}%` }} />
                  </div>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">{r.count.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsSection>
    </>
  );
}

/* ─────────────────────────── AI credits ───────────────────────────────── */

const TIER_CHIP: Record<CreditEvent["tier"], string> = {
  Lite: "border-slate-500/25 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Balanced: "border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Max: "border-violet-500/30 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Image: "border-amber-500/35 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function AiDetail({ events, used, slug }: { events: CreditEvent[]; used: number; slug: string }) {
  const [shown, setShown] = useState(8);
  const rows = events.slice(0, shown);
  const hasMore = shown < events.length;

  return (
    <SettingsSection
      title="AI credit activity"
      description={`${used.toLocaleString("en-US")} credits used this period. Tiers are Lite, Balanced and Max.`}
      flush
      action={
        <button
          type="button"
          onClick={() => {
            download(`${slug}-ai-activity.csv`, [
              ["action", "actor", "when", "tier", "credits"],
              ...events.map((e) => [e.label, e.actor, e.when, e.tier, e.credits]),
            ]);
            toast.success("Exported to CSV");
          }}
          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
        >
          <Download className="h-3 w-3" /> Export CSV
        </button>
      }
    >
      <table className="w-full text-[13px]">
        <thead className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
          <tr>
            <th className="px-5 py-2.5 text-left font-medium">Action</th>
            <th className="px-3 py-2.5 text-left font-medium">Actor</th>
            <th className="px-3 py-2.5 text-left font-medium">Tier</th>
            <th className="px-3 py-2.5 text-left font-medium">Date</th>
            <th className="px-5 py-2.5 text-right font-medium">Credits</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((e) => (
            <tr key={e.id} className="border-b border-[color:var(--border-hairline)] last:border-b-0">
              <td className="max-w-[320px] truncate px-5 py-2.5 text-foreground">{e.label}</td>
              <td className="px-3 py-2.5 text-muted-foreground">{e.actor}</td>
              <td className="px-3 py-2.5">
                <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold leading-none ${TIER_CHIP[e.tier]}`}>
                  {e.tier}
                </span>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                {new Date(e.when).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </td>
              <td className="px-5 py-2.5 text-right tabular-nums text-foreground">-{e.credits.toLocaleString("en-US")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between px-5 py-3">
        <span className="text-[12px] text-muted-foreground">
          Showing {rows.length} of {events.length}
        </span>
        {hasMore && (
          <button
            type="button"
            onClick={() => setShown((s) => s + 8)}
            className="inline-flex h-8 items-center rounded-lg border border-border bg-transparent px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Load more
          </button>
        )}
      </div>
    </SettingsSection>
  );
}

/* ─────────────────────────── compute ──────────────────────────────────── */

const COMPUTE_ROUTES = [
  { path: "SSR · / (home)", share: 0.34 },
  { path: "SSR · /blog/[slug]", share: 0.28 },
  { path: "ISR · revalidate", share: 0.16 },
  { path: "Edge middleware", share: 0.12 },
  { path: "API route · /og image", share: 0.1 },
];

function ComputeDetail({
  slug,
  cpuMinutes,
  computeReqs,
  days,
  focus,
}: {
  slug: string;
  cpuMinutes: number;
  computeReqs: number;
  days: number;
  focus: "cpu" | "compute";
}) {
  const isCpu = focus === "cpu";
  const total = isCpu ? cpuMinutes : computeReqs;
  const unit = isCpu ? "min" : "req";
  const data = useMemo(
    () => dailySeries(`${slug}-${focus}`, total, days).map((d) => ({ date: d.date, v: Math.round(d.gb) })),
    [slug, focus, total, days],
  );
  const peak = data.reduce((m, d) => (d.v > m.v ? d : m), data[0] ?? { date: "", v: 0 });
  const routeRows = COMPUTE_ROUTES.map((r) => ({ ...r, value: Math.round(total * r.share) }));

  return (
    <>
      <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-3">
        <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-[12.5px] leading-relaxed text-muted-foreground">
          <span className="font-medium text-foreground">Compute runs your site on BetterCMS Cloud.</span> CPU time and
          function requests are billed here, separate from CDN bandwidth. Only sites we host consume compute. Pure
          static delivery does not.
        </p>
      </div>

      <SettingsSection
        title={isCpu ? "CPU time over time" : "Compute requests over time"}
        description="Serverless and edge execution for this site."
      >
        <div className="py-2">
          <div className="mb-3 flex flex-wrap gap-6 text-[12px]">
            <Stat label="Total" value={`${total.toLocaleString("en-US")} ${unit}`} />
            <Stat label="Avg / day" value={`${Math.round(total / Math.max(1, days)).toLocaleString("en-US")} ${unit}`} />
            <Stat label="Peak day" value={`${peak.v.toLocaleString("en-US")} ${unit}`} />
          </div>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="cpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" interval={4} />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={36} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12 }} />
                <Area type="monotone" dataKey="v" name={unit} stroke="var(--primary)" fill="url(#cpu)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection
        title="By function"
        description="Where compute is spent across your rendered routes and functions."
        flush
        action={
          <button
            type="button"
            onClick={() => {
              download(`${slug}-compute-by-function.csv`, [
                ["function", isCpu ? "cpu_minutes" : "requests"],
                ...routeRows.map((r) => [r.path, r.value]),
              ]);
              toast.success("Exported to CSV");
            }}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Download className="h-3 w-3" /> Export CSV
          </button>
        }
      >
        <table className="w-full text-[13px]">
          <tbody>
            {routeRows.map((r) => (
              <tr key={r.path} className="border-b border-[color:var(--border-hairline)] last:border-b-0">
                <td className="px-5 py-2.5 font-mono text-[12px] text-foreground">{r.path}</td>
                <td className="w-[40%] px-3 py-2.5">
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary/70" style={{ width: `${r.share * 100}%` }} />
                  </div>
                </td>
                <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                  {r.value.toLocaleString("en-US")} {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SettingsSection>
    </>
  );
}

/* ─────────────────────────── locales ──────────────────────────────────── */

const ALL_LOCALES = [
  { code: "en", name: "English", primary: true },
  { code: "fr", name: "Français", primary: false },
  { code: "de", name: "Deutsch", primary: false },
  { code: "es", name: "Español", primary: false },
  { code: "ja", name: "日本語", primary: false },
];

function LocalesDetail({ count }: { count: number }) {
  const active = ALL_LOCALES.slice(0, Math.max(1, count));
  return (
    <SettingsSection title="Locales in use" description={`${active.length} of your included locales are active.`} flush>
      <table className="w-full text-[13px]">
        <tbody>
          {active.map((l) => (
            <tr key={l.code} className="border-b border-[color:var(--border-hairline)] last:border-b-0">
              <td className="px-5 py-2.5 font-medium text-foreground">
                {l.name} <span className="font-mono text-[11px] text-muted-foreground">({l.code})</span>
              </td>
              <td className="px-5 py-2.5 text-right">
                {l.primary ? (
                  <span className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                    Primary
                  </span>
                ) : (
                  <span className="text-[12px] text-muted-foreground">Secondary</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </SettingsSection>
  );
}

/* ─────────────────────────── bits ─────────────────────────────────────── */

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold tabular-nums text-foreground">{value}</div>
    </div>
  );
}
