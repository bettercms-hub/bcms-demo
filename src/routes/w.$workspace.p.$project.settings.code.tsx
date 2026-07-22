import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState, type ReactNode } from "react";
import { Check, Copy, Expand, Maximize2, Plus, Shrink, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, SettingsSection, StatusDot } from "@/components/cms/SettingsSubNav";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useCMS, select } from "@/lib/cms/store";
import { getDelivery } from "@/lib/cms/delivery";
import { useSeoPages } from "@/lib/seo/site-pages";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/code")({
  component: CustomCode,
});

interface PageOverride {
  pageId: string;
  name: string;
  slug: string;
  code: string;
  enabled: boolean;
}

function CustomCode() {
  const { workspace, project } = Route.useParams();
  const pr = select.projectBySlug(workspace, project)!;
  const blocks = useCMS((s) => s.customCode.filter((b) => b.projectId === pr.id && b.scope === "site"));
  const [pages] = useSeoPages(pr.id, pr.name);
  const staticPages = pages.filter((p) => p.kind === "static");

  const d = getDelivery(pr);
  const headBlock = blocks.find((b) => b.location === "head");
  const bodyStart = blocks.find((b) => b.location === "bodyStart");
  const bodyEnd = blocks.find((b) => b.location === "bodyEnd");

  // Per-page body injection. Seeded with one example so the feature is legible.
  const [overrides, setOverrides] = useState<PageOverride[]>(() => {
    const pricing = staticPages.find((p) => p.slug === "/pricing");
    return pricing
      ? [
          {
            pageId: pricing.id,
            name: pricing.name,
            slug: pricing.slug,
            code: '<script>\n  // Runs only on /pricing — e.g. a plan-comparison widget\n  window.plancompare?.init({ page: "pricing" });\n</script>',
            enabled: true,
          },
        ]
      : [];
  });
  const [addPageId, setAddPageId] = useState("");

  const available = useMemo(
    () => staticPages.filter((p) => !overrides.some((o) => o.pageId === p.id)),
    [staticPages, overrides],
  );

  function addOverride() {
    const p = staticPages.find((x) => x.id === addPageId);
    if (!p) return;
    setOverrides((cur) => [...cur, { pageId: p.id, name: p.name, slug: p.slug, code: "", enabled: true }]);
    setAddPageId("");
    toast.success(`Page code added for ${p.name}`);
  }
  function removeOverride(pageId: string) {
    setOverrides((cur) => cur.filter((o) => o.pageId !== pageId));
  }

  const endpoint = `https://api.bettercms.site/v1/projects/${pr.id}/code-injection`;

  return (
    <>
      <PageHeader
        title="Custom code"
        description="Inject scripts and markup site-wide or on a single page. Served to your frontend over the Content Delivery API."
      />

      {/* ── API delivery ── */}
      <ApiCard endpoint={endpoint} headless={d.api && !d.hosted} hosted={d.hosted} />

      {/* ── Site-wide ── */}
      <div className="mb-2 mt-8 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
        Site-wide
      </div>

      <SettingsSection title="<head>" description="Loaded before the page renders. Fonts, meta tags, analytics, verification.">
        <CodeCard
          enabled={headBlock?.enabled ?? true}
          tabs={[
            { id: "html", label: "HTML", content: headBlock?.content ?? "", placeholder: "<!-- HTML, <script>, <link>, <style> -->" },
            { id: "css", label: "CSS", content: "", placeholder: "/* CSS */" },
            { id: "js", label: "JS", content: "", placeholder: "// JavaScript" },
          ]}
        />
      </SettingsSection>

      <SettingsSection title="<body> start" description="Injected immediately after <body> opens. Best for pixels and consent.">
        <CodeCard
          enabled={bodyStart?.enabled ?? false}
          tabs={[{ id: "html", label: "HTML", content: bodyStart?.content ?? "", placeholder: "<!-- e.g. a tracking pixel -->" }]}
        />
      </SettingsSection>

      <SettingsSection title="<body> end" description="Injected just before </body>. Best for non-blocking scripts and widgets.">
        <CodeCard
          enabled={bodyEnd?.enabled ?? false}
          tabs={[{ id: "html", label: "HTML", content: bodyEnd?.content ?? "", placeholder: "<!-- e.g. a chat widget -->" }]}
        />
      </SettingsSection>

      {/* ── Per-page ── */}
      <div className="mb-2 mt-8 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">Page code</span>
        <span className="text-[12px] text-muted-foreground">Merged after the site-wide code, only on that page.</span>
      </div>

      <SettingsSection title="Add page code" description="Inject code into the <body> of a single page.">
        <div className="flex flex-wrap items-center gap-2 py-1">
          <select
            value={addPageId}
            onChange={(e) => setAddPageId(e.target.value)}
            className="h-9 min-w-[240px] flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="">Choose a page…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.slug})
              </option>
            ))}
          </select>
          <Button size="sm" className="h-9 gap-1.5" disabled={!addPageId} onClick={addOverride}>
            <Plus className="h-3.5 w-3.5" /> Add page
          </Button>
        </div>
        {available.length === 0 && overrides.length > 0 && (
          <p className="pt-1 text-[12px] text-muted-foreground">Every page already has code. Remove one to add another.</p>
        )}
      </SettingsSection>

      {overrides.map((o) => (
        <SettingsSection
          key={o.pageId}
          title={o.name}
          description={`${o.slug} · injected before </body> on this page only`}
          action={
            <button
              type="button"
              onClick={() => removeOverride(o.pageId)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              title="Remove page code"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          }
        >
          <CodeCard
            enabled={o.enabled}
            tabs={[{ id: "html", label: "HTML", content: o.code, placeholder: "<!-- Runs only on this page -->" }]}
          />
        </SettingsSection>
      ))}
    </>
  );
}

/* ── API card ── */

function ApiCard({ endpoint, headless, hosted }: { endpoint: string; headless: boolean; hosted: boolean }) {
  const [copied, setCopied] = useState(false);
  const behavior =
    hosted && headless
      ? "BetterCMS injects this automatically on the hosted site. Your other frontends fetch it over the API and inject it themselves."
      : hosted
      ? "BetterCMS injects this automatically at the edge on every response. It is also readable over the API."
      : "Your frontend fetches this per path and injects it into the document head and body.";

  return (
    <div className="rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-4">
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-status-success/30 bg-status-success/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-status-success">
          Public key
        </span>
        <span className="text-[13px] font-medium text-foreground">Managed over the API</span>
      </div>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">{behavior}</p>
      <div className="mt-3 flex items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3 py-2">
        <span className="rounded bg-status-success/10 px-1.5 py-0.5 font-mono text-[10.5px] font-semibold text-status-success">
          GET
        </span>
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-foreground">{endpoint}?path=/</code>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(`${endpoint}?path=/`);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {"→ { head, bodyStart, bodyEnd }"} · site-wide code merged with the page at <span className="text-foreground">path</span>.
      </p>
    </div>
  );
}

/* ── code editor ── */

function CodeCard({
  enabled: initialEnabled,
  tabs,
}: {
  enabled: boolean;
  tabs: { id: string; label: string; content: string; placeholder: string }[];
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [active, setActive] = useState(tabs[0].id);
  const [contents, setContents] = useState<Record<string, string>>(() =>
    Object.fromEntries(tabs.map((t) => [t.id, t.content])),
  );
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const current = tabs.find((t) => t.id === active)!;
  const value = contents[active] ?? "";
  const setValue = (v: string) => setContents((c) => ({ ...c, [active]: v }));

  function copy() {
    navigator.clipboard?.writeText(value);
    toast.success("Code copied");
  }

  return (
    <div className="-mx-5 -my-px">
      <div className="flex items-center justify-between border-b border-border px-5 py-2.5">
        <div className="flex items-center gap-3">
          <StatusDot tone={enabled ? "success" : "muted"} />
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
            {enabled ? "Active" : "Disabled"}
          </span>
          <Tabs value={active} onValueChange={setActive}>
            <TabsList className="h-7">
              {tabs.map((t) => (
                <TabsTrigger key={t.id} value={t.id} className="text-[11px] font-mono">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {tabs.map((t) => (
              <TabsContent key={t.id} value={t.id} className="m-0" />
            ))}
          </Tabs>
        </div>
        <div className="flex items-center gap-1.5">
          <IconBtn title="Copy" onClick={copy}><Copy className="h-3.5 w-3.5" /></IconBtn>
          <IconBtn title={expanded ? "Collapse" : "Expand"} onClick={() => setExpanded((v) => !v)}>
            {expanded ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
          </IconBtn>
          <IconBtn title="Fullscreen" onClick={() => setFullscreen(true)}><Maximize2 className="h-3.5 w-3.5" /></IconBtn>
          <div className="ml-2 flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">Enabled</span>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
        </div>
      </div>

      <CodeEditor value={value} onChange={setValue} placeholder={current.placeholder} rows={expanded ? 28 : 12} />

      <div className="flex items-center justify-between border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
        <span>Validation: OK</span>
        <span>{current.label} · UTF-8</span>
      </div>

      {fullscreen && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-6" onClick={() => setFullscreen(false)}>
          <div
            className="flex h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-card shadow-[var(--shadow-3)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-3">
                <StatusDot tone={enabled ? "success" : "muted"} />
                <Tabs value={active} onValueChange={setActive}>
                  <TabsList className="h-7">
                    {tabs.map((t) => (
                      <TabsTrigger key={t.id} value={t.id} className="text-[11px] font-mono">
                        {t.label}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {tabs.map((t) => (
                    <TabsContent key={t.id} value={t.id} className="m-0" />
                  ))}
                </Tabs>
              </div>
              <div className="flex items-center gap-1.5">
                <IconBtn title="Copy" onClick={copy}><Copy className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="Exit fullscreen" onClick={() => setFullscreen(false)}><X className="h-4 w-4" /></IconBtn>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              <CodeEditor value={value} onChange={setValue} placeholder={current.placeholder} fill />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeEditor({
  value,
  onChange,
  placeholder,
  rows = 12,
  fill = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  rows?: number;
  fill?: boolean;
}) {
  const lineCount = Math.max(rows, value.split("\n").length);
  return (
    <div className={`relative flex bg-[color:var(--canvas)] font-mono text-[12px] ${fill ? "h-full" : ""}`}>
      <pre
        aria-hidden
        className={`select-none overflow-hidden border-r border-border px-3 py-3 text-right leading-[20px] text-muted-foreground/60 ${
          fill ? "overflow-y-auto" : ""
        }`}
      >
        {Array.from({ length: lineCount }, (_, i) => (i + 1).toString().padStart(2, " ")).join("\n")}
      </pre>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`flex-1 resize-none border-0 bg-transparent font-mono text-[12px] leading-[20px] focus-visible:ring-0 ${
          fill ? "h-full" : "min-h-[240px]"
        }`}
      />
    </div>
  );
}

function IconBtn({ children, title, onClick }: { children: ReactNode; title: string; onClick?: () => void }) {
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" title={title} onClick={onClick}>
      {children}
    </Button>
  );
}
