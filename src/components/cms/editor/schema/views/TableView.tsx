/**
 * TableView — Airtable-style review surface for the schema.
 * Field · Type · Required · Unique · Localized · Default · API name
 */
import { Check, Minus } from "lucide-react";
import type { Schema } from "@/lib/cms/types";
import { FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";

interface Props {
  schema: Schema;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
}

export function TableView({ schema, selectedFieldId, onSelectField }: Props) {
  return (
    <div className="mx-auto max-w-[1100px] px-8 py-7">
      <div className="overflow-hidden rounded-lg border border-border/40">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="bg-[color:var(--panel)] text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
              <Th>Field</Th>
              <Th>Type</Th>
              <Th>Required</Th>
              <Th>Unique</Th>
              <Th>Localized</Th>
              <Th>Default</Th>
              <Th>API name</Th>
            </tr>
          </thead>
          <tbody>
            {schema.fields.map((f) => {
              const meta = FIELD_TYPE_META[f.type];
              const Icon = meta?.icon;
              const sel = selectedFieldId === f.id;
              return (
                <tr
                  key={f.id}
                  onClick={() => onSelectField(f.id)}
                  className={`cursor-pointer border-t border-border/30 transition-colors ${
                    sel
                      ? "bg-[color:var(--row-selected)]"
                      : "hover:bg-[color:var(--row-hover)]"
                  }`}
                >
                  <Td>
                    <div className="flex items-center gap-2">
                      {Icon && <Icon className="h-3.5 w-3.5 opacity-60" />}
                      <span className="font-medium">{f.label}</span>
                    </div>
                  </Td>
                  <Td>
                    <span className="text-muted-foreground">{meta?.label ?? f.type}</span>
                  </Td>
                  <Td><Bool on={!!f.required} /></Td>
                  <Td><Bool on={!!f.unique} /></Td>
                  <Td><Bool on={!!f.localized} /></Td>
                  <Td>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {f.defaultValue !== undefined && f.defaultValue !== ""
                        ? String(f.defaultValue)
                        : "—"}
                    </span>
                  </Td>
                  <Td>
                    <span className="font-mono text-[11px] text-muted-foreground">{f.name}</span>
                  </Td>
                </tr>
              );
            })}
            {schema.fields.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-[12px] text-muted-foreground">
                  No fields yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 font-semibold">{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-2.5">{children}</td>;
}
function Bool({ on }: { on: boolean }) {
  return on ? (
    <Check className="h-3.5 w-3.5 text-emerald-500" />
  ) : (
    <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
  );
}
