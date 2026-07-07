/**
 * MetadataView — developer-first surface listing every field as a
 * key/value metadata card.
 */
import type { Schema, SchemaField } from "@/lib/cms/types";
import { FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";

interface Props {
  schema: Schema;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
}

export function MetadataView({ schema, selectedFieldId, onSelectField }: Props) {
  return (
    <div className="mx-auto max-w-[920px] space-y-4 px-8 py-7">
      {schema.fields.map((f) => {
        const meta = FIELD_TYPE_META[f.type];
        const Icon = meta?.icon;
        const sel = selectedFieldId === f.id;
        return (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelectField(f.id)}
            className={`block w-full rounded-lg border px-4 py-3 text-left transition-colors ${
              sel
                ? "border-primary/50 bg-[color:var(--row-selected)]"
                : "border-border/30 hover:bg-[color:var(--row-hover)]"
            }`}
          >
            <div className="flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5 opacity-70" />}
              <span className="text-[13.5px] font-semibold tracking-tight">{f.label}</span>
              <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                {meta?.label ?? f.type}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px] sm:grid-cols-3">
              <Pair k="API name" v={f.name} mono />
              <Pair k="Required" v={f.required ? "true" : "false"} />
              <Pair k="Unique" v={f.unique ? "true" : "false"} />
              <Pair k="Localized" v={f.localized ? "true" : "false"} />
              <Pair k="Hidden in list" v={f.hiddenInList ? "true" : "false"} />
              <Pair k="Default" v={defaultPreview(f)} mono />
              <Pair k="Min" v={asStr(f.validation?.min ?? f.validation?.minLength)} />
              <Pair k="Max" v={asStr(f.validation?.max ?? f.validation?.maxLength)} />
              <Pair k="Regex" v={f.validation?.pattern ?? "—"} mono />
              {f.description && (
                <div className="col-span-full">
                  <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
                    Description
                  </span>
                  <div className="mt-0.5 text-[12px] text-foreground/80">{f.description}</div>
                </div>
              )}
            </dl>
          </button>
        );
      })}
      {schema.fields.length === 0 && (
        <div className="py-16 text-center text-[12px] text-muted-foreground">
          No fields yet.
        </div>
      )}
    </div>
  );
}

function Pair({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">{k}</span>
      <span className={`truncate ${mono ? "font-mono text-[11.5px]" : ""}`}>{v}</span>
    </div>
  );
}

function asStr(v: unknown): string {
  return v === undefined || v === null || v === "" ? "—" : String(v);
}

function defaultPreview(f: SchemaField): string {
  if (f.defaultValue === undefined || f.defaultValue === null || f.defaultValue === "") return "—";
  const s = typeof f.defaultValue === "string" ? f.defaultValue : JSON.stringify(f.defaultValue);
  return s.length > 40 ? s.slice(0, 37) + "…" : s;
}
