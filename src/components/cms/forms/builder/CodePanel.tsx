import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Code2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getForm } from "@/lib/forms/forms.store";
import type { FormDetail } from "@/lib/forms/types";

type Tab = "endpoint" | "html" | "fetch" | "react";

const TABS: { value: Tab; label: string }[] = [
  { value: "endpoint", label: "Endpoint" },
  { value: "html", label: "HTML" },
  { value: "fetch", label: "Fetch" },
  { value: "react", label: "React" },
];

export function CodePanel({ formId }: { formId: string }) {
  const [tab, setTab] = useState<Tab>("endpoint");
  const { data: form } = useQuery<FormDetail>({
    queryKey: ["form-detail", formId],
    queryFn: () => getForm({ data: { formId } }),
  });

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://your-site.app";
  const endpoint = `${origin}/api/public/forms/${formId}/submit`;

  const snippet = useMemo(() => {
    switch (tab) {
      case "endpoint":
        return endpoint;
      case "html":
        return htmlSnippet(endpoint, form);
      case "fetch":
        return fetchSnippet(endpoint, form);
      case "react":
        return reactSnippet(endpoint, form);
    }
  }, [tab, endpoint, form]);

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[color:var(--canvas)] p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-semibold text-foreground">Embed & API</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Drop the form into any site. The endpoint accepts JSON or form-encoded POSTs and
          works cross-origin (CORS open).
        </p>

        {!form || form.status !== "published" ? (
          <div className="mt-4 rounded-md border border-status-warning/30 bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
            This form is in draft. Publish it before sending real submissions. The endpoint
            will reject posts with a 403 until you do.
          </div>
        ) : null}

        <div className="mt-6 flex items-center gap-1 rounded-md bg-[color:var(--panel)] p-0.5">
          {TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTab(t.value)}
              className={`flex-1 rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t.value
                  ? "bg-[color:var(--card)] text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <CodeBlock code={snippet} />

        <div className="mt-6 rounded-lg border border-border bg-[color:var(--panel)] p-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Code2 className="h-3.5 w-3.5" /> Field names
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Use these as the <code className="rounded bg-muted px-1">name</code> attribute on
            inputs (or JSON keys).
          </p>
          {form?.fields.length ? (
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs">
              {form.fields.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-2 rounded bg-[color:var(--card)] px-2 py-1.5">
                  <code className="font-mono text-foreground">{f.name}</code>
                  <span className="text-muted-foreground">
                    {f.kind}
                    {f.required ? " *" : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">No fields yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative mt-4">
      <pre className="overflow-auto rounded-lg border border-border bg-[color:var(--panel)] p-4 text-xs leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <Button
        variant="outline"
        size="sm"
        className="absolute right-2 top-2"
        onClick={() => {
          navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? (
          <>
            <Check className="mr-1.5 h-3.5 w-3.5" /> Copied
          </>
        ) : (
          <>
            <Copy className="mr-1.5 h-3.5 w-3.5" /> Copy
          </>
        )}
      </Button>
    </div>
  );
}

function htmlSnippet(endpoint: string, form?: FormDetail) {
  const fields = form?.fields ?? [];
  const inputs = fields.length
    ? fields
        .map((f) => {
          const req = f.required ? " required" : "";
          const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : "";
          if (f.kind === "textarea") {
            return `  <label>${esc(f.label)}\n    <textarea name="${f.name}"${ph}${req}></textarea>\n  </label>`;
          }
          const type =
            f.kind === "email"
              ? "email"
              : f.kind === "number"
              ? "number"
              : f.kind === "url"
              ? "url"
              : f.kind === "phone"
              ? "tel"
              : f.kind === "date"
              ? "date"
              : "text";
          return `  <label>${esc(f.label)}\n    <input type="${type}" name="${f.name}"${ph}${req} />\n  </label>`;
        })
        .join("\n")
    : '  <input type="text" name="email" placeholder="you@example.com" required />';
  return `<form action="${endpoint}" method="POST">
${inputs}
  <button type="submit">Send</button>
</form>`;
}

function fetchSnippet(endpoint: string, form?: FormDetail) {
  const sample = sampleObject(form);
  return `await fetch("${endpoint}", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(${JSON.stringify(sample, null, 2)}),
});`;
}

function reactSnippet(endpoint: string, form?: FormDetail) {
  const sample = sampleObject(form);
  const keys = Object.keys(sample);
  return `import { useState } from "react";

export function ContactForm() {
  const [sent, setSent] = useState(false);
  async function onSubmit(e) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch("${endpoint}", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (res.ok) setSent(true);
  }
  if (sent) return <p>Thanks!</p>;
  return (
    <form onSubmit={onSubmit}>
${keys.map((k) => `      <input name="${k}" required />`).join("\n")}
      <button type="submit">Send</button>
    </form>
  );
}`;
}

function sampleObject(form?: FormDetail): Record<string, string> {
  if (!form?.fields.length) return { email: "you@example.com" };
  const out: Record<string, string> = {};
  for (const f of form.fields) {
    out[f.name] =
      f.kind === "email"
        ? "you@example.com"
        : f.kind === "number"
        ? "1"
        : f.kind === "consent" || f.kind === "checkbox"
        ? "true"
        : f.placeholder ?? f.label;
  }
  return out;
}

function esc(s: string) {
  return s.replace(/"/g, "&quot;");
}
