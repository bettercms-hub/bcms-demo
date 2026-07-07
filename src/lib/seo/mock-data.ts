/**
 * Deterministic mock data for the Analytics + SEO workspace.
 *
 * Single source of truth so charts, tables, and per-page cards stay
 * coherent. Seeded on a string (project slug) so each project shows
 * stable numbers between renders.
 */

function hash(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export interface TrafficPoint {
  date: string; // ISO date
  visitors: number;
  sessions: number;
  pageviews: number;
  conversions: number;
}

export function trafficSeries(projectSlug: string, days = 30): TrafficPoint[] {
  const r = rng(hash(projectSlug + ":traffic"));
  const out: TrafficPoint[] = [];
  const today = new Date("2026-06-18");
  const baseV = 800 + Math.floor(r() * 1200);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    const weekend = dow === 0 || dow === 6 ? 0.7 : 1;
    const noise = 0.75 + r() * 0.5;
    const v = Math.round(baseV * weekend * noise);
    const s = Math.round(v * (1.15 + r() * 0.2));
    out.push({
      date: d.toISOString().slice(0, 10),
      visitors: v,
      sessions: s,
      pageviews: Math.round(s * (2.1 + r() * 0.8)),
      conversions: Math.round(v * (0.018 + r() * 0.02)),
    });
  }
  return out;
}

export interface MetricSummary {
  visitors: number;
  sessions: number;
  pageviews: number;
  conversions: number;
  bounceRate: number;
  avgEngagement: number;
  realtime: number;
  prevVisitors: number;
  prevSessions: number;
  prevConversions: number;
}

export function metricsSummary(projectSlug: string): MetricSummary {
  const r = rng(hash(projectSlug + ":metrics"));
  const series = trafficSeries(projectSlug, 30);
  const prev = trafficSeries(projectSlug + "-prev", 30);
  const sum = (k: keyof TrafficPoint) =>
    series.reduce((a, b) => a + (b[k] as number), 0);
  const sumP = (k: keyof TrafficPoint) =>
    prev.reduce((a, b) => a + (b[k] as number), 0);
  return {
    visitors: sum("visitors"),
    sessions: sum("sessions"),
    pageviews: sum("pageviews"),
    conversions: sum("conversions"),
    bounceRate: 0.32 + r() * 0.18,
    avgEngagement: 95 + Math.floor(r() * 80),
    realtime: Math.floor(r() * 40) + 6,
    prevVisitors: sumP("visitors"),
    prevSessions: sumP("sessions"),
    prevConversions: sumP("conversions"),
  };
}

export interface TopRow {
  label: string;
  value: number;
  delta?: number;
}

const TRAFFIC_SOURCES = [
  "Google",
  "Direct",
  "GitHub",
  "Twitter / X",
  "LinkedIn",
  "Reddit",
  "Hacker News",
  "Newsletter",
];

const DEVICES = ["Desktop", "Mobile", "Tablet"];
const BROWSERS = ["Chrome", "Safari", "Firefox", "Edge", "Brave", "Arc"];
const COUNTRIES = [
  "United States",
  "Germany",
  "United Kingdom",
  "France",
  "Canada",
  "Brazil",
  "India",
  "Japan",
  "Australia",
];

function distribute(seed: string, labels: string[]): TopRow[] {
  const r = rng(hash(seed));
  const raw = labels.map(() => r() * r());
  const total = raw.reduce((a, b) => a + b, 0);
  const visitors = metricsSummary(seed.split(":")[0] ?? "x").visitors;
  return labels
    .map((l, i) => ({
      label: l,
      value: Math.round((raw[i] / total) * visitors),
      delta: Math.round((r() - 0.5) * 40),
    }))
    .sort((a, b) => b.value - a.value);
}

export function trafficSources(projectSlug: string) {
  return distribute(projectSlug + ":sources", TRAFFIC_SOURCES);
}
export function deviceBreakdown(projectSlug: string) {
  return distribute(projectSlug + ":devices", DEVICES);
}
export function browserBreakdown(projectSlug: string) {
  return distribute(projectSlug + ":browsers", BROWSERS);
}
export function countryBreakdown(projectSlug: string) {
  return distribute(projectSlug + ":countries", COUNTRIES);
}

export interface KeywordRow {
  term: string;
  rank: number;
  prevRank: number;
  traffic: number;
  difficulty: number;
  opportunity: "high" | "medium" | "low";
  trend: "up" | "down" | "flat";
}

const KEYWORDS = [
  "headless cms",
  "best cms 2026",
  "structured content management",
  "next.js cms",
  "content modeling tool",
  "open source cms",
  "cms for marketing teams",
  "ai content management",
  "page builder cms",
  "cms for developers",
  "form builder cms",
  "cms with analytics",
];

export function keywordRows(projectSlug: string): KeywordRow[] {
  const r = rng(hash(projectSlug + ":kw"));
  return KEYWORDS.map((term) => {
    const rank = Math.max(1, Math.round(1 + r() * 60));
    const prev = Math.max(1, rank + Math.round((r() - 0.5) * 12));
    const trend: KeywordRow["trend"] =
      rank < prev ? "up" : rank > prev ? "down" : "flat";
    const opp = r();
    const opportunity: KeywordRow["opportunity"] =
      opp > 0.66 ? "high" : opp > 0.33 ? "medium" : "low";
    return {
      term,
      rank,
      prevRank: prev,
      traffic: Math.round(50 + r() * 1800),
      difficulty: Math.round(20 + r() * 70),
      opportunity,
      trend,
    };
  }).sort((a, b) => a.rank - b.rank);
}

export interface CoreWebVitals {
  lcp: number; // seconds
  inp: number; // ms
  cls: number;
  ttfb: number; // ms
  fcp: number; // seconds
}

export function coreWebVitals(projectSlug: string): CoreWebVitals {
  const r = rng(hash(projectSlug + ":cwv"));
  return {
    lcp: +(1.4 + r() * 1.6).toFixed(2),
    inp: Math.round(80 + r() * 220),
    cls: +(r() * 0.18).toFixed(3),
    ttfb: Math.round(120 + r() * 380),
    fcp: +(0.9 + r() * 0.9).toFixed(2),
  };
}

export interface PagePerf {
  pageId: string;
  views: number;
  avgTime: number; // seconds
  bounce: number; // 0-1
  conversions: number;
  ctr: number; // 0-1
  position: number;
  freshness: number; // days since update
}

export function pagePerf(projectSlug: string, pageIds: string[]): PagePerf[] {
  return pageIds.map((id) => {
    const r = rng(hash(projectSlug + ":" + id));
    return {
      pageId: id,
      views: Math.round(120 + r() * 9000),
      avgTime: Math.round(40 + r() * 240),
      bounce: +(0.25 + r() * 0.45).toFixed(2),
      conversions: Math.round(r() * 80),
      ctr: +(0.02 + r() * 0.12).toFixed(3),
      position: +(1 + r() * 40).toFixed(1),
      freshness: Math.round(r() * 120),
    };
  });
}
