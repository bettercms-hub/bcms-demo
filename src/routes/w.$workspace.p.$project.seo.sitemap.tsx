import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useSeoPages, useSitemapConfig } from "@/lib/seo/site-pages";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/sitemap")({
  component: SitemapPage,
});

function SitemapPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const [pages] = useSeoPages(pr.id, pr.name);
  const [cfg, setCfg] = useSitemapConfig(pr.id);
  const headless = pr.kind === "headless";
  const origin = headless ? `https://${pr.slug}.bettercms.site` : `https://${pr.slug}.com`;

  const autoXml = useMemo(() => {
    const statics = pages.filter((p) => p.kind === "static" && p.index);
    const lines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
      ...statics.map(
        (p) =>
          `  <url>\n    <loc>${origin}${p.slug}</loc>\n    <changefreq>weekly</changefreq>\n    <priority>${p.slug === "/" ? "1.0" : "0.7"}</priority>\n  </url>`,
      ),
      ...pages
        .filter((p) => p.kind === "cms" && p.index)
        .map((p) => `  <!-- ${p.slug} expands to every ${p.name} entry -->`),
      `</urlset>`,
    ];
    return lines.join("\n");
  }, [pages, origin]);

  const [draft, setDraft] = useState(() => cfg.customXml || autoXml);

  function setMode(mode: "auto" | "custom") {
    if (mode === "custom" && !cfg.customXml) setDraft(autoXml);
    setCfg((c) => ({ ...c, mode }));
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight">Sitemap</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Tell search engines which URLs to crawl. Auto-generated from your pages, or take full control with a custom
          sitemap.
        </p>
      </header>

      {/* URL row */}
      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3.5 py-2.5">
        <span className="text-[12px] font-medium text-muted-foreground">
          {headless ? "Sitemap API" : "Sitemap URL"}
        </span>
        <code className="flex-1 truncate font-mono text-[12px] text-foreground">
          {headless ? `https://api.bettercms.site/projects/${pr.id}/sitemap.xml` : `${origin}/sitemap.xml`}
        </code>
        <CopyBtn text={headless ? `https://api.bettercms.site/projects/${pr.id}/sitemap.xml` : `${origin}/sitemap.xml`} />
      </div>

      {/* mode switch */}
      <div className="mb-4 inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] p-0.5">
        {(["auto", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`h-8 rounded-md px-3.5 text-[12.5px] font-medium transition-colors ${
              cfg.mode === m ? "bg-[color:var(--card)] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "auto" ? "Auto-generated" : "Custom"}
          </button>
        ))}
      </div>

      {cfg.mode === "auto" ? (
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
          <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Generated from {pages.filter((p) => p.index).length} indexed pages
            </span>
            <div className="flex items-center gap-3">
              <CopyBtn text={autoXml} label />
              <button
                type="button"
                onClick={() => toast.success("Sitemap regenerated")}
                className="text-[11.5px] font-medium text-primary hover:underline"
              >
                Regenerate
              </button>
            </div>
          </div>
          <pre className="max-h-[420px] overflow-auto bg-[color:var(--s1)] p-3.5 text-[11.5px] leading-relaxed text-foreground">
            <code>{autoXml}</code>
          </pre>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3.5 py-2.5 text-[12px] text-muted-foreground">
            <span className="font-medium text-foreground">Custom sitemap is served instead of the auto one.</span> You own
            it now — new pages won't be added automatically.
          </div>
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
            <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Custom sitemap.xml</span>
              <button
                type="button"
                onClick={() => {
                  setDraft(autoXml);
                  toast.success("Reset to auto-generated");
                }}
                className="text-[11.5px] font-medium text-primary hover:underline"
              >
                Reset to auto
              </button>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={18}
              spellCheck={false}
              className="w-full resize-y bg-[color:var(--s1)] p-3.5 font-mono text-[11.5px] leading-relaxed text-foreground outline-none"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => {
                setCfg((c) => ({ ...c, customXml: draft }));
                toast.success("Custom sitemap saved");
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              Save custom sitemap
            </button>
          </div>
        </div>
      )}

    </>
  );
}

function CopyBtn({ text, label }: { text: string; label?: boolean }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1200);
      }}
      className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Copy"
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
      {label && (done ? "Copied" : "Copy")}
    </button>
  );
}

