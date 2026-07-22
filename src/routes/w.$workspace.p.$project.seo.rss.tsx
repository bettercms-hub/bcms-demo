import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy, Rss } from "lucide-react";
import { toast } from "sonner";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { Switch } from "@/components/ui/switch";
import { useSeoPages, useSitemapConfig } from "@/lib/seo/site-pages";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/rss")({
  component: RssPage,
});

const ITEM_COUNTS = [10, 20, 50];

function RssPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const [pages] = useSeoPages(pr.id, pr.name);
  const [cfg, setCfg] = useSitemapConfig(pr.id);
  const headless = pr.kind === "headless";
  const origin = headless ? `https://${pr.slug}.bettercms.site` : `https://${pr.slug}.com`;

  const cmsTemplates = pages.filter((p) => p.kind === "cms");
  const feedUrl = headless ? `https://api.bettercms.site/projects/${pr.id}/rss.xml` : `${origin}/rss.xml`;

  const title = cfg.rssTitle ?? pr.name;
  const description = cfg.rssDescription ?? `The latest updates from ${pr.name}.`;
  const itemCount = cfg.rssItemCount ?? 20;
  const fullContent = cfg.rssFullContent ?? false;

  const headSnippet = `<link rel="alternate" type="application/rss+xml" title="${escapeAttr(title)}" href="${feedUrl}" />`;

  const previewXml = useMemo(() => {
    const sampleItems = [
      { t: "Introducing our new pricing", s: "how-we-rebuilt-pricing", d: "Fri, 04 Jul 2026 09:00:00 GMT" },
      { t: "Changelog: June 2026", s: "changelog-june-2026", d: "Tue, 01 Jul 2026 14:30:00 GMT" },
    ];
    const body = fullContent
      ? "<![CDATA[<p>Full article HTML is included in the feed…</p>]]>"
      : "A short summary of the entry.";
    const lines = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">`,
      `  <channel>`,
      `    <title>${escapeXml(title)}</title>`,
      `    <link>${origin}</link>`,
      `    <description>${escapeXml(description)}</description>`,
      `    <language>en</language>`,
      `    <atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />`,
      ...sampleItems.map((it) =>
        [
          `    <item>`,
          `      <title>${escapeXml(it.t)}</title>`,
          `      <link>${origin}/blog/${it.s}</link>`,
          `      <guid>${origin}/blog/${it.s}</guid>`,
          `      <pubDate>${it.d}</pubDate>`,
          `      <description>${body}</description>`,
          `    </item>`,
        ].join("\n"),
      ),
      `    <!-- up to ${itemCount} most recent entries from the included collections -->`,
      `  </channel>`,
      `</rss>`,
    ];
    return lines.join("\n");
  }, [title, description, origin, feedUrl, fullContent, itemCount]);

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight">RSS feed</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Publish an RSS 2.0 feed so readers and aggregators can subscribe to new entries.
        </p>
      </header>

      {/* Enable card */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-orange-500/10">
              <Rss className="h-4 w-4 text-orange-500" />
            </span>
            <div>
              <div className="text-[14px] font-semibold text-foreground">
                {cfg.rssEnabled ? "RSS feed is live" : "Enable RSS feed"}
              </div>
              <div className="text-[12.5px] text-muted-foreground">
                {cfg.rssEnabled
                  ? "New entries in the included collections appear in the feed automatically."
                  : "Turn this on to generate a feed at a public URL."}
              </div>
            </div>
          </div>
          <Switch
            checked={cfg.rssEnabled}
            onCheckedChange={(on) => {
              setCfg((c) => ({ ...c, rssEnabled: on }));
              toast.success(`RSS feed ${on ? "enabled" : "disabled"}`);
            }}
            aria-label="Toggle RSS feed"
          />
        </div>
      </div>

      {!cfg.rssEnabled ? (
        <div className="mt-4 rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s1)] px-4 py-8 text-center">
          <Rss className="mx-auto h-7 w-7 text-muted-foreground/60" />
          <p className="mx-auto mt-2 max-w-md text-[12.5px] text-muted-foreground">
            Once enabled, you can choose which collections to include, set the feed title and description, and copy the
            feed URL to share.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Feed URL */}
          <Section title="Feed URL" hint="Share this, or add it to your site's head for auto-discovery.">
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2">
              <span className="text-[12px] font-medium text-muted-foreground">{headless ? "Feed API" : "URL"}</span>
              <code className="flex-1 truncate font-mono text-[12px] text-foreground">{feedUrl}</code>
              <CopyBtn text={feedUrl} label />
            </div>
            <div className="mt-2 overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
              <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Auto-discovery {"<head>"} tag
                </span>
                <CopyBtn text={headSnippet} label />
              </div>
              <pre className="overflow-auto bg-[color:var(--s1)] p-3 text-[11.5px] leading-relaxed text-foreground">
                <code>{headSnippet}</code>
              </pre>
            </div>
          </Section>

          {/* Feed details */}
          <Section title="Feed details">
            <div className="space-y-3">
              <Field label="Title">
                <input
                  defaultValue={title}
                  placeholder={pr.name}
                  onBlur={(e) => setCfg((c) => ({ ...c, rssTitle: e.target.value.trim() || undefined }))}
                  className="h-9 w-full rounded-md border border-[color:var(--color-border)] bg-transparent px-3 text-[13px] text-foreground outline-none focus:border-primary"
                />
              </Field>
              <Field label="Description">
                <textarea
                  defaultValue={description}
                  rows={2}
                  onBlur={(e) => setCfg((c) => ({ ...c, rssDescription: e.target.value.trim() || undefined }))}
                  className="w-full resize-y rounded-md border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-[13px] text-foreground outline-none focus:border-primary"
                />
              </Field>
            </div>
          </Section>

          {/* Included collections */}
          <Section title="Included collections" hint="Entries from these collections are published to the feed.">
            <div className="flex flex-wrap gap-1.5">
              {cmsTemplates.length === 0 && (
                <span className="text-[12px] text-muted-foreground">No CMS collections yet.</span>
              )}
              {cmsTemplates.map((t) => {
                const on = cfg.rssSources.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setCfg((c) => ({
                        ...c,
                        rssSources: on ? c.rssSources.filter((x) => x !== t.id) : [...c.rssSources, t.id],
                      }))
                    }
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors ${
                      on
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]"
                    }`}
                  >
                    {on && <Check className="h-3 w-3 text-primary" />}
                    {t.name}
                  </button>
                );
              })}
            </div>
          </Section>

          {/* Options */}
          <Section title="Options">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3.5 py-2.5">
                <div>
                  <div className="text-[13px] font-medium text-foreground">Items per feed</div>
                  <div className="text-[11.5px] text-muted-foreground">How many recent entries to include.</div>
                </div>
                <div className="inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] p-0.5">
                  {ITEM_COUNTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setCfg((c) => ({ ...c, rssItemCount: n }))}
                      className={`h-7 rounded-md px-3 text-[12.5px] font-medium tabular-nums transition-colors ${
                        itemCount === n
                          ? "bg-[color:var(--card)] text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-3.5 py-2.5">
                <div>
                  <div className="text-[13px] font-medium text-foreground">Full content</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    Include the whole article, not just a summary.
                  </div>
                </div>
                <Switch
                  checked={fullContent}
                  onCheckedChange={(on) => setCfg((c) => ({ ...c, rssFullContent: on }))}
                  aria-label="Toggle full content"
                />
              </div>
            </div>
          </Section>

          {/* Preview */}
          <Section title="Preview">
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
              <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">rss.xml</span>
                <CopyBtn text={previewXml} label />
              </div>
              <pre className="max-h-[420px] overflow-auto bg-[color:var(--s1)] p-3.5 text-[11.5px] leading-relaxed text-foreground">
                <code>{previewXml}</code>
              </pre>
            </div>
          </Section>
        </div>
      )}
    </>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-[13px] font-semibold text-foreground">{title}</h2>
        {hint && <p className="text-[12px] text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="block text-[12px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
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
      {done ? <Check className="h-3.5 w-3.5 text-status-success" /> : <Copy className="h-3.5 w-3.5" />}
      {label && (done ? "Copied" : "Copy")}
    </button>
  );
}

function escapeXml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return escapeXml(s).replace(/"/g, "&quot;");
}
