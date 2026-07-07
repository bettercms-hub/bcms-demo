import { useCMS } from "@/lib/cms/store";
import { getReferenceLabel, resolveMultiReference, resolveReference } from "@/lib/cms/references";
import type { SchemaField } from "@/lib/cms/types";
import { PublishBadge } from "@/components/cms/ui/StatusBadge";

export function EntryPreview({ entryId }: { entryId: string }) {
  const entry = useCMS((s) => s.entries.find((e) => e.id === entryId));
  const collection = useCMS((s) => entry ? s.collections.find((c) => c.id === entry.collectionId) : undefined);
  const schema = useCMS((s) => collection ? s.schemas.find((sc) => sc.id === collection.schemaId) : undefined);
  const media = useCMS((s) => s.media);

  if (!entry) return null;
  const titleField = schema?.titleFieldName;
  const title = titleField && typeof entry.fields[titleField] === "string" ? entry.fields[titleField] as string : entry.title;
  const cover = schema?.fields.find((f) => f.type === "image");
  const coverId = cover ? entry.fields[cover.name] : undefined;
  const coverUrl = typeof coverId === "string" ? media.find((m) => m.id === coverId)?.url : undefined;

  return (
    <article className="mx-auto max-w-3xl bg-white px-10 py-12">
      <div className="mb-3 flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{collection?.name}</span>
        {entry.status && <PublishBadge state={entry.status} />}
      </div>
      <h1 className="text-4xl font-semibold tracking-tight">{title || "Untitled"}</h1>
      {coverUrl && (
        <div className="mt-6 overflow-hidden rounded-[8px] border border-border">
          <img src={coverUrl} alt="" className="w-full" />
        </div>
      )}
      <div className="mt-8 space-y-6">
        {(schema?.fields ?? [])
          .filter((f) => f.name !== titleField && f.type !== "image")
          .map((f) => <FieldRender key={f.id} field={f} value={entry.fields[f.name]} />)}
      </div>
    </article>
  );
}

function FieldRender({ field, value }: { field: SchemaField; value: unknown }) {
  if (value == null || value === "" || (Array.isArray(value) && value.length === 0)) return null;
  if (field.type === "richText" && typeof value === "string") {
    return <section><div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{field.label}</div><div className="bcms-prose" dangerouslySetInnerHTML={{ __html: value }} /></section>;
  }
  if (field.type === "reference") {
    const e = resolveReference(value);
    if (!e) return null;
    return <FieldBlock label={field.label}><span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[12px]">{getReferenceLabel(e)}</span></FieldBlock>;
  }
  if (field.type === "multiReference") {
    const items = resolveMultiReference(value);
    if (!items.length) return null;
    return <FieldBlock label={field.label}><div className="flex flex-wrap gap-1.5">{items.map((e) => <span key={e.id} className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[12px]">{getReferenceLabel(e)}</span>)}</div></FieldBlock>;
  }
  if (field.type === "boolean") {
    return <FieldBlock label={field.label}><span className="text-[13px]">{value ? "Yes" : "No"}</span></FieldBlock>;
  }
  if (field.type === "url" || field.type === "email") {
    return <FieldBlock label={field.label}><a className="text-[13px] text-primary underline" href={String(value)}>{String(value)}</a></FieldBlock>;
  }
  return <FieldBlock label={field.label}><div className="text-[14px] text-foreground">{String(value)}</div></FieldBlock>;
}

function FieldBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </section>
  );
}
