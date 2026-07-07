/**
 * SuggestedFieldsBanner — appears at the top of an empty/near-empty canvas.
 * Click a chip to insert that field (auto-creating its group if absent).
 */
import { Sparkles, Plus } from "lucide-react";
import { schemaActions } from "@/lib/cms/store";
import type { Schema } from "@/lib/cms/types";
import { FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";
import { suggestFor } from "@/lib/cms/schema/field-suggestions";

interface Props {
  schema: Schema;
  ownerName: string;
  onInserted?: (fieldId: string) => void;
}

export function SuggestedFieldsBanner({ schema, ownerName, onInserted }: Props) {
  const preset = suggestFor(ownerName);

  const insert = (label: string, type: string, groupName?: string) => {
    let groupId: string | null = null;
    if (groupName) {
      const existing = (schema.groups ?? []).find(
        (g) => g.label.toLowerCase() === groupName.toLowerCase(),
      );
      groupId = existing ? existing.id : schemaActions.addGroup(schema.id, groupName);
    }
    const fid = schemaActions.addField(schema.id, type as never);
    schemaActions.updateField(schema.id, fid, { label });
    if (groupId) schemaActions.setFieldGroup(schema.id, fid, groupId);
    onInserted?.(fid);
  };

  return (
    <div className="mb-6 rounded-xl border border-border/40 bg-[color:var(--card)] px-5 py-4">
      <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span>
          Suggested fields for{" "}
          <span className="font-medium text-foreground">{preset.label}</span>
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {preset.fields.map((f) => {
          const meta = FIELD_TYPE_META[f.type];
          const Icon = meta?.icon;
          return (
            <button
              key={`${f.label}-${f.type}`}
              type="button"
              onClick={() => insert(f.label, f.type, f.group)}
              className="group inline-flex items-center gap-1.5 rounded-full border border-border/50 bg-[color:var(--card)] px-2.5 py-1 text-[12px] text-foreground transition-colors hover:border-primary/40 hover:bg-[color:var(--row-hover)]"
            >
              {Icon && <Icon className="h-3 w-3 text-muted-foreground group-hover:text-primary" />}
              {f.label}
              <Plus className="h-3 w-3 text-muted-foreground/60" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
