import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { HeadlessApiCallout } from "@/components/cms/headless/HeadlessApiCallout";
import { getProjectBySlug } from "@/lib/cms/use-cms";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/setup")({
  component: SetupGuide,
});

const HOST = "https://api.bettercms.site";

type Step = { title: string; note?: string; lang: string; code: string };
type Framework = { id: string; label: string };

const FRAMEWORKS: Framework[] = [
  { id: "nextjs", label: "Next.js" },
  { id: "astro", label: "Astro" },
  { id: "nuxt", label: "Nuxt" },
  { id: "react", label: "React" },
  { id: "html", label: "HTML / JS" },
];

function buildGuides(projectId: string): Record<string, Step[]> {
  const base = `${HOST}/api/public/projects/${projectId}`;
  return {
    nextjs: [
      {
        title: "1 · Environment variables",
        note: "Public key is safe in the browser. Keep the server key server-only.",
        lang: ".env.local",
        code: `NEXT_PUBLIC_BCMS_PROJECT=${projectId}
NEXT_PUBLIC_BCMS_PUBLIC_KEY=bcms_pub_xxx      # published content, SEO, schema, forms config
BCMS_SERVER_KEY=bcms_srv_xxx                  # form submit, analytics, protected actions`,
      },
      {
        title: "2 · Fetch content",
        lang: "lib/bettercms.ts",
        code: `const BASE = \`${HOST}/api/public/projects/\${process.env.NEXT_PUBLIC_BCMS_PROJECT}\`;
const KEY = process.env.NEXT_PUBLIC_BCMS_PUBLIC_KEY!;

export async function bcms(path: string) {
  const res = await fetch(\`\${BASE}\${path}\`, {
    headers: { Authorization: \`Bearer \${KEY}\` },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(\`BetterCMS \${res.status}\`);
  return res.json();
}`,
      },
      {
        title: "3 · SEO → render meta tags",
        note: "generateMetadata pulls the SEO record for the current path.",
        lang: "app/[...slug]/page.tsx",
        code: `import { bcms } from "@/lib/bettercms";

export async function generateMetadata({ params }) {
  const path = "/" + (params.slug?.join("/") ?? "");
  const seo = await bcms(\`/seo?path=\${path}\`);
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: seo.robots,               // e.g. "index,follow"
    openGraph: seo.openGraph,
    twitter: seo.twitter,
  };
}`,
      },
      {
        title: "4 · Structured data (JSON-LD)",
        lang: "app/[...slug]/page.tsx",
        code: `const { schema } = await bcms(\`/schema?path=\${path}\`);

return (
  <>
    {schema?.map((node, i) => (
      <script
        key={i}
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(node) }}
      />
    ))}
    {/* …page */}
  </>
);`,
      },
      {
        title: "5 · Analytics script",
        note: "Cookie-less by default. Drop this once in the root layout.",
        lang: "app/layout.tsx",
        code: `<script
  src="https://cdn.bettercms.site/analytics.js"
  data-project-id="${projectId}"
  defer
/>`,
      },
      {
        title: "6 · Submit a form",
        note: "Post to the form endpoint. Validation, spam checks, storage, email & webhooks run in BetterCMS.",
        lang: "app/contact/Form.tsx",
        code: `"use client";
export function ContactForm({ formId }) {
  async function onSubmit(e) {
    e.preventDefault();
    const fields = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(\`${HOST}/api/forms/\${formId}/submit\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: "${projectId}", pagePath: location.pathname, fields }),
    });
    const { ok, message } = await res.json();
    if (ok) alert(message);
  }
  return <form onSubmit={onSubmit}>{/* fields */}</form>;
}`,
      },
      {
        title: "7 · Redirects (middleware)",
        note: "Fetch redirect rules once, apply 301/302 at the edge.",
        lang: "middleware.ts",
        code: `import { NextResponse } from "next/server";

let cache: any[] | null = null;
async function rules() {
  if (!cache) cache = await fetch(\`${base}/redirects\`).then((r) => r.json());
  return cache;
}

export async function middleware(req) {
  const hit = (await rules()).find((r) => r.active && r.source === req.nextUrl.pathname);
  if (hit) return NextResponse.redirect(new URL(hit.destination, req.url), hit.type);
  return NextResponse.next();
}`,
      },
      {
        title: "8 · Sitemap & robots (proxy)",
        note: "Serve BetterCMS-generated files from your own domain.",
        lang: "app/sitemap.xml/route.ts",
        code: `export async function GET() {
  const xml = await fetch(\`${HOST}/projects/${projectId}/sitemap.xml\`).then((r) => r.text());
  return new Response(xml, { headers: { "Content-Type": "application/xml" } });
}
// app/robots.txt/route.ts → same pattern with /robots.txt`,
      },
    ],
    astro: [
      {
        title: "1 · Environment variables",
        lang: ".env",
        code: `BCMS_PROJECT=${projectId}
BCMS_PUBLIC_KEY=bcms_pub_xxx`,
      },
      {
        title: "2 · Fetch content + SEO",
        lang: "src/pages/[...slug].astro",
        code: `---
const base = \`${HOST}/api/public/projects/\${import.meta.env.BCMS_PROJECT}\`;
const headers = { Authorization: \`Bearer \${import.meta.env.BCMS_PUBLIC_KEY}\` };
const path = "/" + (Astro.params.slug ?? "");
const seo = await fetch(\`\${base}/seo?path=\${path}\`, { headers }).then((r) => r.json());
const { schema } = await fetch(\`\${base}/schema?path=\${path}\`, { headers }).then((r) => r.json());
---
<head>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <link rel="canonical" href={seo.canonical} />
  <meta name="robots" content={seo.robots} />
  {schema?.map((n) => <script type="application/ld+json" set:html={JSON.stringify(n)} />)}
</head>`,
      },
      {
        title: "3 · Analytics script",
        lang: "src/layouts/Base.astro",
        code: `<script src="https://cdn.bettercms.site/analytics.js" data-project-id="${projectId}" defer></script>`,
      },
      {
        title: "4 · Redirects (middleware)",
        lang: "src/middleware.ts",
        code: `import { defineMiddleware } from "astro:middleware";
const rules = await fetch(\`${base}/redirects\`).then((r) => r.json());
export const onRequest = defineMiddleware((ctx, next) => {
  const hit = rules.find((r) => r.active && r.source === ctx.url.pathname);
  return hit ? ctx.redirect(hit.destination, hit.type) : next();
});`,
      },
    ],
    nuxt: [
      {
        title: "1 · Runtime config",
        lang: "nuxt.config.ts",
        code: `export default defineNuxtConfig({
  runtimeConfig: {
    public: { bcmsProject: "${projectId}", bcmsKey: "bcms_pub_xxx" },
  },
});`,
      },
      {
        title: "2 · Fetch content + SEO + schema",
        lang: "pages/[...slug].vue",
        code: `<script setup>
const { bcmsProject, bcmsKey } = useRuntimeConfig().public;
const base = \`${HOST}/api/public/projects/\${bcmsProject}\`;
const path = "/" + (useRoute().params.slug || "");
const { data: seo } = await useFetch(\`\${base}/seo?path=\${path}\`, {
  headers: { Authorization: \`Bearer \${bcmsKey}\` },
});
useHead({
  title: seo.value.title,
  meta: [{ name: "description", content: seo.value.description }],
  link: [{ rel: "canonical", href: seo.value.canonical }],
  script: (seo.value.schema || []).map((n) => ({ type: "application/ld+json", innerHTML: JSON.stringify(n) })),
});
</script>`,
      },
      {
        title: "3 · Analytics script",
        lang: "app.vue / nuxt.config",
        code: `useHead({
  script: [{ src: "https://cdn.bettercms.site/analytics.js", "data-project-id": "${projectId}", defer: true }],
});`,
      },
      {
        title: "4 · Redirects (server middleware)",
        lang: "server/middleware/redirects.ts",
        code: `const rules = await $fetch(\`${base}/redirects\`);
export default defineEventHandler((event) => {
  const hit = rules.find((r) => r.active && r.source === event.path);
  if (hit) return sendRedirect(event, hit.destination, hit.type);
});`,
      },
    ],
    react: [
      {
        title: "1 · Fetch content + SEO (react-helmet)",
        note: "Client-rendered SPAs read the same public endpoints.",
        lang: "src/lib/bcms.ts + Page.tsx",
        code: `const BASE = "${HOST}/api/public/projects/${projectId}";
export const bcms = (p: string) =>
  fetch(BASE + p, { headers: { Authorization: "Bearer " + import.meta.env.VITE_BCMS_PUBLIC_KEY } }).then((r) => r.json());

// In a page component:
const seo = await bcms(\`/seo?path=\${location.pathname}\`);
<Helmet>
  <title>{seo.title}</title>
  <meta name="description" content={seo.description} />
  <link rel="canonical" href={seo.canonical} />
  {(seo.schema || []).map((n, i) => (
    <script key={i} type="application/ld+json">{JSON.stringify(n)}</script>
  ))}
</Helmet>`,
      },
      {
        title: "2 · Analytics script",
        lang: "index.html",
        code: `<script src="https://cdn.bettercms.site/analytics.js" data-project-id="${projectId}" defer></script>`,
      },
      {
        title: "3 · Submit a form",
        lang: "src/ContactForm.tsx",
        code: `await fetch(\`${HOST}/api/forms/\${formId}/submit\`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ projectId: "${projectId}", pagePath: location.pathname, fields }),
});`,
      },
    ],
    html: [
      {
        title: "1 · Analytics, one tag",
        note: "Cookie-less. Nothing else required for pageviews.",
        lang: "index.html",
        code: `<script src="https://cdn.bettercms.site/analytics.js" data-project-id="${projectId}" defer></script>`,
      },
      {
        title: "2 · Inject SEO meta",
        lang: "index.html",
        code: `<script>
  fetch("${base}/seo?path=" + location.pathname, {
    headers: { Authorization: "Bearer bcms_pub_xxx" },
  })
    .then((r) => r.json())
    .then((seo) => {
      document.title = seo.title;
      const m = document.createElement("meta");
      m.name = "description"; m.content = seo.description;
      document.head.appendChild(m);
    });
</script>`,
      },
      {
        title: "3 · Submit a form",
        lang: "index.html",
        code: `form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const fields = Object.fromEntries(new FormData(form));
  const res = await fetch("${HOST}/api/forms/FORM_ID/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId: "${projectId}", pagePath: location.pathname, fields }),
  });
  const { ok, message } = await res.json();
  if (ok) form.outerHTML = "<p>" + message + "</p>";
});`,
      },
    ],
  };
}

function SetupGuide() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const projectId = pr?.id ?? "pr_unknown";
  const guides = useMemo(() => buildGuides(projectId), [projectId]);

  const [fw, setFw] = useState("nextjs");
  const steps = guides[fw];

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6">
        <h1 className="text-[20px] font-semibold tracking-tight">Integration guide</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Connect {pr?.name ?? "your project"} to BetterCMS. Copy-paste setup for content, SEO, schema,
          analytics, forms, redirects, and sitemap.
        </p>
      </header>

      <HeadlessApiCallout
        path={`/api/public/projects/${projectId}/content`}
        keyType="Public"
        description="Everything below reads from the Public API using your public key."
      />

      {/* Framework picker */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {FRAMEWORKS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFw(f.id)}
            className={`h-9 rounded-lg border px-3.5 text-[13px] font-medium transition-colors ${
              fw === f.id
                ? "border-primary bg-primary/10 text-foreground"
                : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-5">
        {steps.map((s) => (
          <section key={s.title}>
            <h2 className="mb-1 text-[13.5px] font-semibold text-foreground">{s.title}</h2>
            {s.note && <p className="mb-2 text-[12px] text-muted-foreground">{s.note}</p>}
            <CodeBlock lang={s.lang} code={s.code} />
          </section>
        ))}
      </div>
    </div>
  );
}

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
      <div className="flex items-center justify-between border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">{lang}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
          className="inline-flex items-center gap-1 text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[color:var(--s1)] p-3.5 text-[12px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
    </div>
  );
}
