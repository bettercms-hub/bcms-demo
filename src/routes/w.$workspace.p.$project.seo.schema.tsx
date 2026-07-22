import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Braces, Code2, Globe, Plus, Trash2, Zap } from "lucide-react";
import { toast } from "sonner";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { HeadlessApiCallout } from "@/components/cms/headless/HeadlessApiCallout";
import { TokenField, prettifyToken, useTokenFieldStyles } from "@/components/cms/seo/TokenField";
import {
  SCHEMA_TYPES,
  buildJsonLd,
  isDynamic,
  useSeoPages,
  useSeoSchemas,
  type SchemaMapping,
  type SitePage,
} from "@/lib/seo/site-pages";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/schema")({
  component: SchemaPage,
});

function SchemaPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const [pages] = useSeoPages(pr.id, pr.name);
  const [schemas, setSchemas] = useSeoSchemas(pr.id, pr.name);
  const [activeId, setActiveId] = useState<string | null>(schemas[0]?.id ?? null);

  const active = schemas.find((s) => s.id === activeId) ?? schemas[0] ?? null;

  function patch(id: string, p: Partial<SchemaMapping>) {
    setSchemas((cur) => cur.map((s) => (s.id === id ? { ...s, ...p } : s)));
  }
  function add() {
    const id = `sch_${Date.now().toString(36)}`;
    setSchemas((cur) => [
      ...cur,
      { id, targetId: "global", type: "WebPage", fields: [{ key: "name", value: "" }] },
    ]);
    setActiveId(id);
  }
  function remove(id: string) {
    setSchemas((cur) => cur.filter((s) => s.id !== id));
    if (activeId === id) setActiveId(schemas.find((s) => s.id !== id)?.id ?? null);
  }

  return (
    <>
      <header className="mb-5">
        <h1 className="text-[20px] font-semibold tracking-tight">Schema markup</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">
          Add JSON-LD structured data so search engines and AI answer engines can read your pages.
        </p>
      </header>

      {pr.kind === "headless" && (
        <HeadlessApiCallout
          path={`/api/public/projects/${pr.id}/schema?path=/pricing`}
          keyType="Public"
          description="Resolved JSON-LD for a given path is returned by the API so your frontend can render it inside the page head."
        />
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_1fr]">
        {/* mapping list */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Schemas ({schemas.length})
            </span>
            <button
              type="button"
              onClick={add}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> New
            </button>
          </div>
          <div className="space-y-1">
            {schemas.map((s) => {
              const target = targetLabel(s.targetId, pages);
              const dyn = s.fields.some((f) => isDynamic(f.value));
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setActiveId(s.id)}
                  className={`flex w-full items-center gap-2 rounded-lg border px-2.5 py-2 text-left transition-colors ${
                    active?.id === s.id
                      ? "border-primary/40 bg-primary/5"
                      : "border-[color:var(--border-hairline)] hover:bg-[color:var(--color-row-hover)]"
                  }`}
                >
                  <Braces className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12.5px] font-medium text-foreground">{s.type}</div>
                    <div className="flex items-center gap-1 truncate font-mono text-[10.5px] text-muted-foreground">
                      {target.global && <Globe className="h-2.5 w-2.5" />}
                      {target.label}
                    </div>
                  </div>
                  {dyn && <Zap className="h-3 w-3 shrink-0 text-violet-500" />}
                </button>
              );
            })}
            {schemas.length === 0 && (
              <div className="rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-6 text-center text-[12px] text-muted-foreground">
                No schemas yet.
              </div>
            )}
          </div>
        </div>

        {/* editor */}
        {active ? (
          <SchemaEditor
            key={active.id}
            mapping={active}
            pages={pages}
            onPatch={(p) => patch(active.id, p)}
            onRemove={() => remove(active.id)}
          />
        ) : (
          <div className="grid place-items-center rounded-xl border border-dashed border-[color:var(--color-border)] py-16 text-[13px] text-muted-foreground">
            Select or create a schema to edit.
          </div>
        )}
      </div>
    </>
  );
}

function SchemaEditor({
  mapping,
  pages,
  onPatch,
  onRemove,
}: {
  mapping: SchemaMapping;
  pages: SitePage[];
  onPatch: (p: Partial<SchemaMapping>) => void;
  onRemove: () => void;
}) {
  const target = pages.find((p) => p.id === mapping.targetId);
  const cms = target?.kind === "cms";
  useTokenFieldStyles();
  const fieldOptions = (target?.fields ?? []).map((f) => ({ token: f, label: prettifyToken(f) }));
  const jsonLd = useMemo(() => buildJsonLd(mapping.type, mapping.fields), [mapping.type, mapping.fields]);

  function setField(i: number, p: Partial<{ key: string; value: string }>) {
    onPatch({ fields: mapping.fields.map((f, idx) => (idx === i ? { ...f, ...p } : f)) });
  }
  function addField() {
    onPatch({ fields: [...mapping.fields, { key: "", value: "" }] });
  }
  function removeField(i: number) {
    onPatch({ fields: mapping.fields.filter((_, idx) => idx !== i) });
  }

  const mode = mapping.mode ?? "guided";
  const raw = mapping.raw ?? "";
  function switchMode(next: "guided" | "custom") {
    if (next === "custom" && !mapping.raw) onPatch({ mode: "custom", raw: JSON.stringify(jsonLd, null, 2) });
    else onPatch({ mode: next });
  }
  function validateCustom() {
    try {
      JSON.parse(raw.replace(/<\/?script[^>]*>/gi, "").trim());
      toast.success("Valid JSON-LD");
    } catch (e) {
      toast.error("Invalid JSON: " + (e as Error).message);
    }
  }
  const previewText =
    mode === "custom"
      ? /<script/i.test(raw)
        ? raw
        : `<script type="application/ld+json">\n${raw}\n</script>`
      : `<script type="application/ld+json">\n${JSON.stringify(jsonLd, null, 2)}\n</script>`;

  return (
    <div className="space-y-4">
      {/* mode */}
      <div className="inline-flex rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] p-0.5">
        {(["guided", "custom"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`h-8 rounded-md px-3.5 text-[12.5px] font-medium transition-colors ${
              mode === m ? "bg-[color:var(--card)] text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "guided" ? "Guided builder" : "Custom JSON-LD"}
          </button>
        ))}
      </div>

      {/* target + type */}
      <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <div className="mb-1.5 text-[12px] font-medium text-foreground">Deploy on</div>
            <Select value={mapping.targetId} onValueChange={(v) => onPatch({ targetId: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">All pages (site-wide)</SelectItem>
                {pages.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name} · {p.slug}
                    {p.kind === "cms" ? "  (CMS)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <label className="block">
            <div className="mb-1.5 text-[12px] font-medium text-foreground">Type</div>
            <Select value={mapping.type} onValueChange={(v) => onPatch({ type: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SCHEMA_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
        {cms && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-violet-500/25 bg-violet-500/5 px-3 py-2 text-[12px] text-muted-foreground">
            <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-500" />
            <span>
              This is a CMS template. Bind fields to dynamic content with{" "}
              <code className="font-mono">{"{{tokens}}"}</code>. Each field resolves per item at request time.
            </span>
          </div>
        )}
      </div>

      {mode === "guided" ? (
        /* fields */
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Fields</span>
          <button
            type="button"
            onClick={addField}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-[color:var(--color-border)] px-2 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </div>
        <div className="space-y-2">
          {mapping.fields.map((f, i) => (
            <div key={i}>
              <div className="flex items-center gap-2">
                <input
                  value={f.key}
                  onChange={(e) => setField(i, { key: e.target.value })}
                  placeholder="property (e.g. author.name)"
                  className="h-8 w-[38%] rounded-md border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2 font-mono text-[12px] text-foreground outline-none focus:border-primary"
                />
                {cms && fieldOptions.length > 0 ? (
                  <div className="flex-1">
                    <TokenField
                      value={f.value}
                      onChange={(v) => setField(i, { value: v })}
                      fields={fieldOptions}
                      placeholder="value or a field"
                    />
                  </div>
                ) : (
                  <input
                    value={f.value}
                    onChange={(e) => setField(i, { value: e.target.value })}
                    placeholder="value"
                    className="h-8 flex-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2 text-[12px] text-foreground outline-none focus:border-primary"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeField(i)}
                  aria-label="Remove field"
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
          {mapping.fields.length === 0 && (
            <div className="py-4 text-center text-[12px] text-muted-foreground">No fields yet. Add one to begin.</div>
          )}
        </div>
      </div>
      ) : (
        /* custom JSON-LD */
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Custom JSON-LD</span>
            <button
              type="button"
              onClick={validateCustom}
              className="text-[11.5px] font-medium text-primary hover:underline"
            >
              Validate
            </button>
          </div>
          <p className="mb-2.5 text-[12px] text-muted-foreground">
            Paste or write your own markup. Generate it with ChatGPT, drop it here, and we inject it as-is.
            {cms ? " You can still use {{field}} tokens." : ""}
          </p>
          <textarea
            value={raw}
            onChange={(e) => onPatch({ raw: e.target.value })}
            rows={12}
            spellCheck={false}
            placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  "name": "…"\n}'}
            className="w-full resize-y rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] p-2.5 font-mono text-[12px] text-foreground outline-none focus:border-primary"
          />
        </div>
      )}

      {/* preview */}
      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)]">
        <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2">
          <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Injected into &lt;head&gt;
          </span>
        </div>
        <pre className="overflow-x-auto bg-[color:var(--s1)] p-3.5 text-[11.5px] leading-relaxed text-foreground">
          <code>{previewText}</code>
        </pre>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onRemove}
          className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground transition-colors hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete schema
        </button>
        <button
          type="button"
          onClick={() => toast.success("Schema saved")}
          className="inline-flex h-8 items-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          Save
        </button>
      </div>
    </div>
  );
}

function targetLabel(targetId: string, pages: SitePage[]) {
  if (targetId === "global") return { global: true, label: "All pages" };
  const p = pages.find((x) => x.id === targetId);
  return { global: false, label: p ? p.slug : "—" };
}
