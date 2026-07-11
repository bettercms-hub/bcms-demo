/**
 * SearchHub — the project's site-search product (SEARCH_PLAN.md).
 *
 * Like Forms, search is a content-adjacent primitive: configure what's
 * searchable here, try it in the playground (a REAL index over this
 * project's live pages and entries), then install it on a hosted site
 * (embed) or a headless frontend (API + React hook). Powered by Typesense
 * in production; the index and analytics in this prototype run in-browser.
 */
import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import {
  BarChart3,
  Check,
  Copy,
  Database,
  FileText,
  KeySquare,
  Lock,
  Plug,
  RefreshCw,
  Search as SearchIcon,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { getCMSState, useCMSVersion } from "@/lib/cms/store";
import { firstPlanWith, siteHas, SITE_PLANS } from "@/lib/billing/pricing";
import {
  searchActions,
  searchDocs,
  useSearchAnalytics,
  useSearchConfig,
  useSearchIndex,
  type SearchHit,
} from "@/lib/search/search-store";

type Tab = "overview" | "content" | "playground" | "install" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "content", label: "Searchable content" },
  { id: "playground", label: "Playground" },
  { id: "install", label: "Install" },
  { id: "analytics", label: "Analytics" },
];

export function SearchHub() {
  const { workspace, project } = useParams({ strict: false }) as { workspace: string; project: string };
  const pr = getProjectBySlug(workspace, project);
  const [tab, setTab] = useState<Tab>("overview");

  const projectId = pr?.id ?? "";
  const config = useSearchConfig(projectId);
  const docs = useSearchIndex(projectId, config);

  if (!pr) return null;
  const plan = pr.sitePlan ?? "free";
  const hasSearch = siteHas(plan, "search");
  const hasAi = siteHas(plan, "ai-search");

  if (!hasSearch) {
    const needed = firstPlanWith("search");
    const planName = needed ? SITE_PLANS[needed].name : "Basic";
    return (
      <div className="mx-auto w-full max-w-[720px] px-6 py-16 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[color:var(--s2)] text-muted-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <h1 className="mt-4 text-[20px] font-semibold text-foreground">Site search needs the {planName} plan</h1>
        <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-muted-foreground">
          Give visitors instant, typo-tolerant search across your pages and content. Available from the {planName} site plan.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[880px] px-6 py-8">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="text-[20px] font-semibold tracking-tight text-foreground">Search</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Instant site search over your pages and content. Powered by Typesense, open source.
          </p>
        </div>
        <EnablePill projectId={projectId} enabled={config.enabled} />
      </div>

      {/* tabs */}
      <div className="mt-6 flex items-center gap-1 border-b border-[color:var(--border-hairline)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "relative -mb-px h-9 px-3 text-[12.5px] font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "overview" && <OverviewTab projectId={projectId} docs={docs.length} hasAi={hasAi} />}
        {tab === "content" && <ContentTab projectId={projectId} />}
        {tab === "playground" && <PlaygroundTab projectId={projectId} />}
        {tab === "install" && <InstallTab projectId={projectId} />}
        {tab === "analytics" && <AnalyticsTab projectId={projectId} />}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ overview */

function EnablePill({ projectId, enabled }: { projectId: string; enabled: boolean }) {
  return (
    <button
      type="button"
      onClick={() => {
        searchActions.patch(projectId, { enabled: !enabled });
        toast.success(enabled ? "Search turned off" : "Search turned on", {
          description: enabled ? "The endpoint stops answering queries." : "The index is live for this project.",
        });
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-semibold transition-colors",
        enabled
          ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
          : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", enabled ? "bg-emerald-500" : "bg-muted-foreground/50")} />
      {enabled ? "Search is on" : "Turn on search"}
    </button>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-[20px] font-semibold tabular-nums text-foreground">{value}</div>
      {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function OverviewTab({ projectId, docs, hasAi }: { projectId: string; docs: number; hasAi: boolean }) {
  const config = useSearchConfig(projectId);
  const collectionsOn = Object.values(config.collections).filter(Boolean).length;
  const copy = (v: string, label: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast.success(`${label} copied`);
  };
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Documents" value={String(docs)} hint="pages + entries in the index" />
        <StatCard label="Collections" value={String(collectionsOn)} hint="opted into search" />
        <StatCard label="Pages" value={config.includePages ? "On" : "Off"} hint="site pages indexed" />
        <StatCard label="Last synced" value={config.enabled ? "Live" : "Paused"} hint="reindexes on publish (demo)" />
      </div>

      {/* AI search */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-medium text-foreground">AI search</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
              Hybrid keyword + semantic ranking with typo tolerance. Visitors find "pricing" even when they type "prcing" or "how much does it cost".
            </p>
          </div>
          {hasAi ? (
            <button
              type="button"
              role="switch"
              aria-checked={config.aiSearch}
              onClick={() => searchActions.patch(projectId, { aiSearch: !config.aiSearch })}
              className={cn(
                "relative mt-1 h-5 w-9 shrink-0 rounded-full transition-colors",
                config.aiSearch ? "bg-primary" : "bg-[color:var(--color-border)]",
              )}
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", config.aiSearch ? "left-[18px]" : "left-0.5")} />
            </button>
          ) : (
            <span className="mt-1 inline-flex shrink-0 items-center gap-1 rounded-full bg-[color:var(--s2)] px-2 py-1 text-[10.5px] font-semibold text-muted-foreground">
              <Lock className="h-3 w-3" /> {(() => { const p = firstPlanWith("ai-search"); return p ? SITE_PLANS[p].name : "Pro"; })()}+
            </span>
          )}
        </div>
      </div>

      {/* public key */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3.5">
        <div className="flex items-center gap-2">
          <KeySquare className="h-4 w-4 shrink-0 text-muted-foreground" />
          <p className="text-[13px] font-medium text-foreground">Public search key</p>
          <span className="text-[11px] text-muted-foreground">search-only, safe for browsers, scoped to this project</span>
        </div>
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-[color:var(--s2)] px-3 py-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">{config.publicKey}</code>
          <button type="button" onClick={() => copy(config.publicKey, "Key")} aria-label="Copy key" className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => { searchActions.regenerateKey(projectId); toast.success("Key regenerated", { description: "The old key stops working." }); }}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground"
          >
            <RefreshCw className="h-3 w-3" /> Regenerate
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- content */

function ContentTab({ projectId }: { projectId: string }) {
  const config = useSearchConfig(projectId);
  // Derive via version + memo: building fresh objects inside a useCMS
  // selector defeats its shallow-compare and loops the snapshot.
  const cmsV = useCMSVersion();
  const data = useMemo(() => {
    const s = getCMSState();
    const project = s.projects.find((p) => p.id === projectId);
    return (project?.collectionIds ?? [])
      .map((cid) => {
        const col = s.collections.find((c) => c.id === cid);
        const schema = col ? s.schemas.find((sc) => sc.id === col.schemaId) : undefined;
        return col
          ? {
              id: col.id,
              name: col.name,
              entries: col.entryIds.length,
              fields: (schema?.fields ?? [])
                .filter((f) => ["text", "richText", "select", "url"].includes(f.type))
                .map((f) => ({ name: f.name, label: f.label })),
            }
          : null;
      })
      .filter(Boolean) as { id: string; name: string; entries: number; fields: { name: string; label: string }[] }[];
  }, [projectId, cmsV]);

  return (
    <div className="space-y-3">
      {/* pages row */}
      <div className="flex items-center gap-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3">
        <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-foreground">Site pages</p>
          <p className="text-[11.5px] text-muted-foreground">Titles, section copy, and meta descriptions.</p>
        </div>
        <MiniSwitch checked={config.includePages} onChange={(v) => searchActions.patch(projectId, { includePages: v })} label="Index site pages" />
      </div>

      {data.map((col) => {
        const on = !!config.collections[col.id];
        return (
          <div key={col.id} className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3">
            <div className="flex items-center gap-3">
              <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-foreground">{col.name}</p>
                <p className="text-[11.5px] text-muted-foreground">{col.entries} {col.entries === 1 ? "entry" : "entries"}</p>
              </div>
              <MiniSwitch checked={on} onChange={(v) => searchActions.setCollection(projectId, col.id, v)} label={`Index ${col.name}`} />
            </div>
            {on && col.fields.length > 0 && (
              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[color:var(--border-hairline)] pt-2.5">
                {col.fields.map((f) => {
                  const fieldOn = !config.fieldOff[`${col.id}.${f.name}`];
                  return (
                    <button
                      key={f.name}
                      type="button"
                      onClick={() => searchActions.setField(projectId, col.id, f.name, !fieldOn)}
                      aria-pressed={fieldOn}
                      title={fieldOn ? "Searchable. Click to exclude." : "Excluded from the index."}
                      className={cn(
                        "inline-flex h-6.5 items-center gap-1 rounded-full border px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                        fieldOn
                          ? "border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)] text-foreground"
                          : "border-[color:var(--color-border)] text-muted-foreground/70 line-through",
                      )}
                    >
                      {fieldOn && <Check className="h-3 w-3 text-primary" />}
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
      <p className="px-1 text-[11.5px] text-muted-foreground">
        Only searchable fields leave the CMS. Anything excluded here never reaches the index, so it can't leak through the search endpoint.
      </p>
    </div>
  );
}

function MiniSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors", checked ? "bg-primary" : "bg-[color:var(--color-border)]")}
    >
      <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", checked ? "left-[18px]" : "left-0.5")} />
    </button>
  );
}

/* ---------------------------------------------------------- playground */

function PlaygroundTab({ projectId }: { projectId: string }) {
  const config = useSearchConfig(projectId);
  const docs = useSearchIndex(projectId, config);
  const [q, setQ] = useState("");
  const hits = useMemo(() => searchDocs(docs, q, { fuzzy: config.aiSearch, limit: 8 }), [docs, q, config.aiSearch]);

  return (
    <div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) searchActions.logQuery(projectId, q, hits.length);
          }}
          placeholder={`Search ${docs.length} documents the way a visitor would…`}
          className="h-11 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] pl-10 pr-24 text-[14px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10.5px] font-medium text-muted-foreground">
          {config.aiSearch ? "AI mode" : "Keyword"} · Enter logs it
        </span>
      </div>

      <div className="mt-4 space-y-2">
        {q.trim() === "" ? (
          <p className="px-1 py-6 text-center text-[12.5px] text-muted-foreground">
            This searches your real content: {docs.length} documents from pages and collections, honoring the searchable-fields config.
          </p>
        ) : hits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[color:var(--color-border)] px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-foreground">No results for "{q.trim()}"</p>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {config.aiSearch ? "Even with typo tolerance on, nothing matched." : "Try AI search for typo tolerance, or check the searchable fields."}
            </p>
          </div>
        ) : (
          hits.map((h) => <HitRow key={h.doc.id} hit={h} />)
        )}
      </div>
    </div>
  );
}

function HitRow({ hit }: { hit: SearchHit }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-4 py-3 transition-colors hover:border-[color:var(--color-border-strong,var(--color-border))]">
      <div className="flex items-center gap-2">
        <span className="min-w-0 truncate text-[13.5px] font-semibold text-foreground">{hit.doc.title}</span>
        <span className="shrink-0 rounded-full bg-[color:var(--s2)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          {hit.doc.kind === "page" ? "Page" : hit.doc.collectionName}
        </span>
        <span className="ml-auto shrink-0 font-mono text-[10.5px] text-muted-foreground/70">{hit.doc.where}</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
        {hit.snippet[0]}
        <mark className="rounded-sm bg-amber-200/70 px-0.5 text-foreground dark:bg-amber-400/30">{hit.snippet[1]}</mark>
        {hit.snippet[2]}
      </p>
      <p className="mt-1 text-[10.5px] text-muted-foreground/70">matched in {hit.field}</p>
    </div>
  );
}

/* -------------------------------------------------------------- install */

function InstallTab({ projectId }: { projectId: string }) {
  const config = useSearchConfig(projectId);
  const [mode, setMode] = useState<"embed" | "api" | "react">("embed");
  const endpoint = `https://search.bettercms.site/v1/projects/${projectId}/search`;
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).catch(() => {});
    toast.success("Copied");
  };

  const embed = `<!-- BetterCMS search: one tag, works anywhere on your site -->
<script
  src="https://cdn.bettercms.site/search.js"
  data-project="${projectId}"
  data-key="${config.publicKey}"
  defer
></script>
<!-- Adds a search overlay on Cmd/Ctrl+K and to any element with data-bcms-search-trigger -->`;

  const api = `curl "${endpoint}?q=pricing&per_page=8" \\
  -H "X-Search-Key: ${config.publicKey}"

# → { "hits": [{ "title", "url", "snippet", "collection" }], "found": 3, "took_ms": 4 }`;

  const react = `import { useSearch, SearchBox } from "@bettercms-ai/search-react";

function SiteSearch() {
  const search = useSearch({
    searchKey: "${config.publicKey}",
    queryBy: ["title", "body", "excerpt"],
  });
  return (
    <SearchBox.Root search={search}>
      <SearchBox.Input placeholder="Search…" />
      <SearchBox.Empty>No results.</SearchBox.Empty>
      <SearchBox.HitList>
        {(hit) => <SearchBox.HitSnippet key={hit.id} hit={hit} />}
      </SearchBox.HitList>
    </SearchBox.Root>
  );
}`;

  const current = mode === "embed" ? embed : mode === "api" ? api : react;

  return (
    <div>
      <div className="flex gap-1.5">
        {([
          ["embed", "Hosted embed"],
          ["api", "REST API"],
          ["react", "React"],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(id)}
            aria-pressed={mode === id}
            className={cn(
              "inline-flex h-8 items-center rounded-md border px-3 text-[12.5px] font-medium transition-colors",
              mode === id
                ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="mt-2 px-0.5 text-[12px] text-muted-foreground">
        {mode === "embed"
          ? "For sites hosted on BetterCMS Cloud: paste once, get a ready search overlay."
          : mode === "api"
            ? "For any stack: a scoped, search-only endpoint. The key can read the index and nothing else."
            : "Headless React primitives, unstyled and composable, with built-in highlighting."}
      </p>
      <div className="group relative mt-3 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--s2)]">
        <pre className="overflow-x-auto px-4 py-3.5 pr-12 font-mono text-[11.5px] leading-relaxed text-foreground"><code>{current}</code></pre>
        <button type="button" onClick={() => copy(current)} aria-label="Copy snippet" className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground">
          <Copy className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-3 flex items-center gap-1.5 px-0.5 text-[11px] text-muted-foreground">
        <Plug className="h-3 w-3" /> Endpoint: <code className="font-mono">{endpoint}</code>
      </p>
    </div>
  );
}

/* ------------------------------------------------------------ analytics */

function AnalyticsTab({ projectId }: { projectId: string }) {
  const a = useSearchAnalytics(projectId);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Queries" value={String(a.total)} hint="logged from the playground (demo)" />
        <StatCard label="Distinct searches" value={String(a.top.length)} />
        <StatCard label="No-result searches" value={String(a.noResults.length)} hint="content gaps to fill" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <QueryTable title="Top searches" rows={a.top} empty="Run a few searches in the playground and they show up here." />
        <QueryTable title="Searches without results" rows={a.noResults} empty="None yet. That's a good sign." tone="warn" />
      </div>
      <p className="flex items-center gap-1.5 px-1 text-[11.5px] text-muted-foreground">
        <BarChart3 className="h-3 w-3" /> In production this logs every visitor query at the search endpoint.
      </p>
    </div>
  );
}

function QueryTable({ title, rows, empty, tone }: { title: string; rows: { q: string; count: number; hits: number }[]; empty: string; tone?: "warn" }) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
      <div className="border-b border-[color:var(--border-hairline)] px-4 py-2.5 text-[12px] font-semibold text-foreground">{title}</div>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <div>
          {rows.map((r) => (
            <div key={r.q} className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-4 py-2 last:border-b-0">
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{r.q}</span>
              {tone === "warn" ? (
                <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10.5px] font-semibold text-amber-600 dark:text-amber-400">0 results</span>
              ) : (
                <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{r.hits} results</span>
              )}
              <span className="w-10 shrink-0 text-right text-[11px] font-medium tabular-nums text-muted-foreground">×{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
