import type { Schema, Section } from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import { FieldControl } from "../fields/FieldControl";

/**
 * Schema-driven override editor used in the right inspector's Content tab
 * when a section is bound to a component master.
 */
export function OverrideForm({
  section,
  schema,
}: {
  section: Section;
  schema: Schema | undefined;
}) {
  if (!schema || schema.fields.length === 0) {
    return (
      <div className="px-1 py-2 text-[12px] text-muted-foreground">
        This component has no schema fields. Add fields in the component’s schema
        editor to expose override controls here.
      </div>
    );
  }
  const overrides = section.overrides ?? {};
  return (
    <div className="space-y-3">
      {schema.fields.map((f) => {
        const dirty = Object.prototype.hasOwnProperty.call(overrides, f.name);
        return (
          <div key={f.id}>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[12px] text-muted-foreground">{f.label}</label>
              {dirty && (
                <button
                  type="button"
                  onClick={() => sectionActions.clearOverride(section.id, f.name)}
                  className="text-[10px] uppercase tracking-wide text-muted-foreground hover:text-foreground"
                >
                  Reset
                </button>
              )}
            </div>
            <FieldControl
              field={f}
              value={overrides[f.name] ?? f.defaultValue ?? ""}
              onChange={(v) => sectionActions.setOverride(section.id, f.name, v)}
            />
            {f.description && (
              <div className="mt-1 text-[11px] text-muted-foreground">{f.description}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
