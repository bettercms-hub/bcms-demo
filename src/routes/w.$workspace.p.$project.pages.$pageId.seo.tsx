import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScoreGauge } from "@/components/cms/seo/ScoreGauge";
import { SerpPreview } from "@/components/cms/seo/SerpPreview";
import { AiAnswerPreview } from "@/components/cms/seo/AiAnswerPreview";
import { pages as allPages } from "@/lib/cms/mock-data";
import { auditPage } from "@/lib/cms/seo-audit";
import { aeoScores, faqFor, keyTakeawaysFor, summaryFor, entitiesFor, topicsFor } from "@/lib/seo/aeo";
import { useSeoPage, useSaveSeoPage } from "@/lib/seo/queries";
import { SeoPageVersionHistory } from "@/components/cms/seo/SeoPageVersionHistory";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/w/$workspace/p/$project/pages/$pageId/seo")({
  beforeLoad: ({ params }) => {
    if (!allPages.find((p) => p.id === params.pageId)) throw notFound();
  },
  component: PageSeoEditor,
});

type Tab = "google" | "bing" | "ai-overview" | "chatgpt" | "perplexity" | "claude" | "gemini";

type FormState = {
  meta_title: string;
  meta_description: string;
  slug: string;
  canonical: string;
  og_title: string;
  og_description: string;
  og_image: string;
  twitter_image: string;
  structured_data: string;
  indexing: string;
  ai_summary: string;
  key_takeaways: string[];
  faqs: { q: string; a: string }[];
  entities: { name: string; type: string }[];
  topics: { topic: string; covered: boolean }[];
};

function PageSeoEditor() {
  const { workspace, project, pageId } = Route.useParams();
  const page = allPages.find((p) => p.id === pageId)!;
  const scope = { workspace, project };
  const saved = useSeoPage(scope, pageId);
  const save = useSaveSeoPage(scope, pageId);
  const [tab, setTab] = useState<Tab>("google");

  const initial = useMemo<FormState>(() => {
    const row = saved.data;
    return {
      meta_title: row?.meta_title ?? page.metaTitle ?? page.title ?? "",
      meta_description: row?.meta_description ?? page.metaDescription ?? page.seoDescription ?? "",
      slug: row?.slug ?? page.slug ?? "",
      canonical: row?.canonical ?? page.canonical ?? "",
      og_title: row?.og_title ?? page.ogTitle ?? "",
      og_description: row?.og_description ?? page.ogDescription ?? "",
      og_image: row?.og_image ?? page.ogImage ?? "",
      twitter_image: row?.twitter_image ?? page.twitterImage ?? "",
      structured_data: row?.structured_data ?? page.structuredData ?? "",
      indexing: row?.indexing ?? page.indexing ?? "index",
      ai_summary: row?.ai_summary ?? summaryFor(page),
      key_takeaways: (row?.key_takeaways as string[] | null) ?? keyTakeawaysFor(page),
      faqs: (row?.faqs as { q: string; a: string }[] | null) ?? faqFor(page),
      entities: (row?.entities as { name: string; type: string }[] | null) ?? entitiesFor(page),
      topics: (row?.topics as { topic: string; covered: boolean }[] | null) ?? topicsFor(page),
    };
  }, [saved.data, page]);

  const [form, setForm] = useState<FormState>(initial);
  useEffect(() => setForm(initial), [initial]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const draftPage = {
    ...page,
    metaTitle: form.meta_title,
    metaDescription: form.meta_description,
    slug: form.slug,
    canonical: form.canonical,
    ogTitle: form.og_title,
    ogDescription: form.og_description,
    ogImage: form.og_image,
    twitterImage: form.twitter_image,
    structuredData: form.structured_data,
    indexing: form.indexing,
  };
  const audit = auditPage(draftPage as typeof page, { baseUrl: "https://example.com" });
  const aeo = aeoScores(draftPage as typeof page, page.sectionIds.length, 600);

  const handleSave = async () => {
    await save.mutateAsync({
      ...form,
      seo_score: audit.score,
      aeo_score: aeo.overall,
      aeo_breakdown: aeo as unknown as Record<string, number>,
    });
    toast.success("SEO saved");
  };

  const regenerateAi = () => {
    setForm((f) => ({
      ...f,
      ai_summary: summaryFor(page),
      key_takeaways: keyTakeawaysFor(page),
      faqs: faqFor(page),
      entities: entitiesFor(page),
      topics: topicsFor(page),
    }));
    toast.message("Regenerated AEO content (not saved yet)");
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "google", label: "Google" },
    { id: "bing", label: "Bing" },
    { id: "ai-overview", label: "AI Overview" },
    { id: "chatgpt", label: "ChatGPT" },
    { id: "perplexity", label: "Perplexity" },
    { id: "claude", label: "Claude" },
    { id: "gemini", label: "Gemini" },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-6 py-8">
      <Link
        to="/w/$workspace/p/$project/seo/pages"
        params={{ workspace, project }}
        className="mb-4 inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Back to SEO Pages
      </Link>
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">{page.title} — SEO</h1>
          <div className="mt-1 font-mono text-[12px] text-muted-foreground">{form.slug}</div>
          {saved.data?.updated_at && (
            <div className="mt-1 text-[11px] text-muted-foreground">
              Last saved {new Date(saved.data.updated_at).toLocaleString()}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SeoPageVersionHistory scope={scope} pageId={pageId} current={saved.data ?? null} />
          <button
            onClick={handleSave}
            disabled={save.isPending}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground disabled:opacity-60"
          >
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save SEO
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title="Basic">
            <Field label="Title"><Input value={form.meta_title} onChange={(e) => set("meta_title", e.target.value)} /></Field>
            <Field label="Description"><Textarea rows={3} value={form.meta_description} onChange={(e) => set("meta_description", e.target.value)} /></Field>
            <Field label="Slug"><Input value={form.slug} onChange={(e) => set("slug", e.target.value)} /></Field>
            <Field label="Canonical URL"><Input placeholder="https://example.com/..." value={form.canonical} onChange={(e) => set("canonical", e.target.value)} /></Field>
          </Section>

          <Section title="Social">
            <Field label="OG title"><Input value={form.og_title} onChange={(e) => set("og_title", e.target.value)} placeholder="Falls back to title" /></Field>
            <Field label="OG description"><Textarea rows={2} value={form.og_description} onChange={(e) => set("og_description", e.target.value)} placeholder="Falls back to description" /></Field>
            <Field label="OG image URL"><Input value={form.og_image} onChange={(e) => set("og_image", e.target.value)} placeholder="https://.../og.png" /></Field>
            <Field label="Twitter image"><Input value={form.twitter_image} onChange={(e) => set("twitter_image", e.target.value)} /></Field>
          </Section>

          <Section title="Advanced">
            <Field label="Structured data (JSON-LD)">
              <Textarea rows={6} className="font-mono text-[12px]" value={form.structured_data} onChange={(e) => set("structured_data", e.target.value)} placeholder='{ "@context": "https://schema.org" }' />
            </Field>
            <Field label="Indexing">
              <select value={form.indexing} onChange={(e) => set("indexing", e.target.value)} className="h-9 rounded-md border border-input bg-background px-3 text-[13px]">
                <option value="index">Indexed</option>
                <option value="noindex">No-index</option>
              </select>
            </Field>
          </Section>

          <Section title="Search & AI preview">
            <div className="mb-3 flex flex-wrap gap-1">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`h-7 rounded-md px-2.5 text-[12px] ${
                    tab === t.id ? "bg-[color:var(--color-row-selected)] text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {tab === "google" || tab === "bing" ? (
              <SerpPreview title={audit.preview.title} description={audit.preview.description} url={audit.preview.url} engine={tab} />
            ) : (
              <AiAnswerPreview engine={tab} title={audit.preview.title} description={audit.preview.description} url={audit.preview.url} />
            )}
          </Section>

          <Section title="AEO content" right={
            <button onClick={regenerateAi} className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-[12px] hover:bg-[color:var(--color-row-hover)]">
              <RefreshCw className="h-3 w-3" /> Regenerate
            </button>
          }>
            <Field label="AI summary">
              <Textarea rows={3} value={form.ai_summary} onChange={(e) => set("ai_summary", e.target.value)} />
            </Field>
            <Field label="Key takeaways">
              <ul className="space-y-1 text-[13px]">
                {form.key_takeaways.map((k, i) => (
                  <li key={i} className="rounded border border-border bg-background px-3 py-1.5">• {k}</li>
                ))}
              </ul>
            </Field>
            <Field label="FAQ">
              <ul className="space-y-2">
                {form.faqs.map((f, i) => (
                  <li key={i} className="rounded border border-border bg-background p-3">
                    <div className="text-[13px] font-medium">{f.q}</div>
                    <div className="mt-1 text-[12px] text-muted-foreground">{f.a}</div>
                  </li>
                ))}
              </ul>
            </Field>
            <Field label="Entities detected">
              <div className="flex flex-wrap gap-1.5">
                {form.entities.map((e) => (
                  <span key={e.name} className="inline-flex items-center gap-1 rounded border border-border bg-background px-2 py-0.5 text-[11px]">
                    <strong className="font-semibold">{e.name}</strong>
                    <span className="text-muted-foreground">{e.type}</span>
                  </span>
                ))}
              </div>
            </Field>
            <Field label="Topic coverage">
              <ul className="space-y-1 text-[13px]">
                {form.topics.map((t) => (
                  <li key={t.topic} className="flex items-center justify-between rounded border border-border bg-background px-3 py-1.5">
                    <span>{t.topic}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${t.covered ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                      {t.covered ? "covered" : "missing"}
                    </span>
                  </li>
                ))}
              </ul>
            </Field>
          </Section>
        </div>

        <aside className="space-y-4">
          <div className="rounded-lg border border-border bg-background p-5">
            <h3 className="mb-4 text-center text-[13px] font-semibold">Scores</h3>
            <div className="flex justify-around">
              <ScoreGauge value={audit.score} label="SEO" size={92} />
              <ScoreGauge value={aeo.overall} label="AEO" size={92} />
            </div>
          </div>
          <div className="rounded-lg border border-border bg-background p-5">
            <h3 className="mb-3 text-[13px] font-semibold">AEO breakdown</h3>
            <ul className="space-y-1.5 text-[12px]">
              {[
                ["Answer score", aeo.answerScore],
                ["Content completeness", aeo.contentCompleteness],
                ["Entity coverage", aeo.entityCoverage],
                ["Topic depth", aeo.topicDepth],
                ["Question coverage", aeo.questionCoverage],
                ["Semantic relationships", aeo.semanticRelationships],
                ["Readability", aeo.readability],
                ["AI confidence", aeo.aiConfidence],
              ].map(([label, val]) => (
                <li key={label as string} className="flex items-center gap-2">
                  <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${val}%` }} />
                  </div>
                  <span className="w-6 text-right tabular-nums">{val as number}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-lg border border-border bg-background p-5">
            <h3 className="mb-3 text-[13px] font-semibold">Issues</h3>
            <ul className="space-y-1.5 text-[12px]">
              {audit.checks.map((c) => (
                <li key={c.id} className="flex items-start gap-2">
                  <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${c.status === "pass" ? "bg-emerald-500" : c.status === "warn" ? "bg-amber-500" : "bg-red-500"}`} />
                  <div>
                    <div className="font-medium">{c.label}</div>
                    <div className="text-muted-foreground">{c.detail}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        {right}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <label className="text-[12px] font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
