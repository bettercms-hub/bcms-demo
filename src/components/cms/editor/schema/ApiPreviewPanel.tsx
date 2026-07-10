/**
 * ApiPreviewPanel — slide-over right sheet showing the serialized schema
 * in three flavors: JSON, REST sample, and generated TypeScript types.
 */
import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import type { Schema, SchemaField } from "@/lib/cms/types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: Schema;
  ownerName: string;
}

type Tab = "json" | "rest" | "types" | "graphql";

export function ApiPreviewPanel({ open, onOpenChange, schema, ownerName }: Props) {
  const [tab, setTab] = useState<Tab>("json");
  const [copied, setCopied] = useState(false);

  const slug = useMemo(() => ownerName.toLowerCase().replace(/[^a-z0-9]+/g, "-"), [ownerName]);

  const jsonOut = useMemo(() => JSON.stringify(serializeSchema(schema, ownerName), null, 2), [schema, ownerName]);
  const restOut = useMemo(() => JSON.stringify(sampleRest(schema, slug), null, 2), [schema, slug]);
  const typesOut = useMemo(() => generateTypes(schema, ownerName), [schema, ownerName]);

  const current = tab === "json" ? jsonOut : tab === "rest" ? restOut : tab === "types" ? typesOut : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(current);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch { /* noop */ }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[560px] sm:max-w-[560px]">
        <SheetHeader>
          <SheetTitle className="text-[15px]">API preview</SheetTitle>
          <SheetDescription className="text-[12px]">
            Inspect how the schema will be exposed to your app.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center gap-0.5 border-b border-border/40">
          {(["json", "rest", "types", "graphql"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              disabled={t === "graphql"}
              onClick={() => setTab(t)}
              className={`relative inline-flex h-8 items-center px-3 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors disabled:opacity-40 ${
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "graphql" ? "GraphQL · soon" : t}
              {tab === t && <span className="absolute bottom-0 left-3 right-3 h-px bg-foreground" />}
            </button>
          ))}
          <button
            type="button"
            onClick={copy}
            className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border/50 bg-background px-2 text-[11px] hover:border-border"
          >
            {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <pre className="mt-3 max-h-[70vh] overflow-auto rounded-md bg-[color:var(--canvas)] p-3 font-mono text-[11px] leading-relaxed">
{current}
        </pre>
      </SheetContent>
    </Sheet>
  );
}

function serializeSchema(schema: Schema, name: string) {
  return {
    name,
    titleField: schema.titleFieldName,
    listFields: schema.listFieldNames ?? [],
    groups: (schema.groups ?? []).map((g) => ({ id: g.id, label: g.label })),
    fields: schema.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: !!f.required,
      unique: !!f.unique,
      group: f.groupId ?? null,
      refCollectionId: f.refCollectionId,
      refComponentId: f.refComponentId,
      options: f.options,
      validation: f.validation,
    })),
  };
}

function sampleRest(schema: Schema, slug: string) {
  const sample: Record<string, unknown> = { id: "entry_abc123" };
  for (const f of schema.fields) sample[f.name] = sampleValue(f);
  return {
    endpoint: `GET /api/${slug}/:id`,
    response: sample,
  };
}

function sampleValue(f: SchemaField): unknown {
  switch (f.type) {
    case "text": return `Example ${f.label.toLowerCase()}`;
    case "richText": return "<p>Sample content</p>";
    case "number": return 42;
    case "boolean": return true;
    case "date": return new Date().toISOString();
    case "image":
    case "file": return "https://your-site.com/asset.jpg";
    case "url": return "https://your-site.com";
    case "email": return "user@example.com";
    case "color": return "#3b82f6";
    case "select": return (f.options ?? ["option_a"])[0];
    case "reference": return "entry_xyz789";
    case "multiReference": return ["entry_xyz789", "entry_qrs456"];
    case "componentRef": return { component: "cmp_id", props: {} };
    case "json": return { hello: "world" };
    case "code": return "console.log('hi')";
  }
}

function generateTypes(schema: Schema, name: string): string {
  const tsName = name.replace(/[^A-Za-z0-9]+/g, "");
  const lines: string[] = [`export interface ${tsName} {`, `  id: string;`];
  for (const f of schema.fields) {
    const opt = f.required ? "" : "?";
    lines.push(`  ${f.name}${opt}: ${tsTypeFor(f)};`);
  }
  lines.push(`}`);
  return lines.join("\n");
}

function tsTypeFor(f: SchemaField): string {
  switch (f.type) {
    case "text":
    case "richText":
    case "url":
    case "email":
    case "color":
    case "code": return "string";
    case "number": return "number";
    case "boolean": return "boolean";
    case "date": return "string /* ISO date */";
    case "image":
    case "file": return "string /* asset url */";
    case "select": return (f.options ?? []).length ? f.options!.map((o) => `"${o}"`).join(" | ") : "string";
    case "reference": return "string /* entry id */";
    case "multiReference": return "string[] /* entry ids */";
    case "componentRef": return "{ component: string; props: Record<string, unknown> }";
    case "json": return "Record<string, unknown>";
  }
}
