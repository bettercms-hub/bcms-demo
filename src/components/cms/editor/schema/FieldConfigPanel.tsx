/**
 * FieldConfigPanel — permanent contextual right panel in the Schema Workspace.
 *
 * Shows configuration for the currently-selected field. If nothing is
 * selected, shows a calm empty state. Reuses SchemaInspector internals
 * for the field-edit form so behavior remains identical to the legacy
 * slide-over sheet.
 */
import { PanelRightClose, Maximize2 } from "lucide-react";
import type { Schema } from "@/lib/cms/types";
import type { SchemaOwnerKind } from "@/lib/cms/center-bus";
import { SchemaInspector } from "./SchemaInspector";

interface Props {
  schema: Schema;
  ownerKind: SchemaOwnerKind;
  ownerId: string;
  selectedFieldId: string | null;
  onClose: () => void;
  onExpand: () => void;
}

export function FieldConfigPanel({
  schema,
  ownerKind,
  ownerId,
  selectedFieldId,
  onClose,
  onExpand,
}: Props) {
  const field = selectedFieldId
    ? schema.fields.find((f) => f.id === selectedFieldId)
    : null;

  return (
    <div className="flex h-full min-h-0 flex-col bg-[color:var(--card)]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border/30 px-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
          {field ? "Field" : "Configuration"}
        </div>
        <div className="flex items-center gap-0.5">
          {field && (
            <button
              type="button"
              onClick={onExpand}
              title="Open in full editor"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Close panel"
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            <PanelRightClose className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {field ? (
          <SchemaInspector
            schema={schema}
            selection={{ kind: "field", id: field.id }}
            ownerKind={ownerKind}
            ownerId={ownerId}
            onSelectionClear={onClose}
          />
        ) : (
          <EmptyConfig />
        )}
      </div>
    </div>
  );
}

function EmptyConfig() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 py-12 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-lg bg-[color:var(--row-hover)] text-muted-foreground">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-5 w-5">
          <rect x="3" y="5" width="18" height="4" rx="1" />
          <rect x="3" y="11" width="12" height="4" rx="1" />
          <rect x="3" y="17" width="8" height="2" rx="1" />
        </svg>
      </div>
      <div className="text-[13px] font-medium text-foreground">
        Select a field to configure
      </div>
      <div className="max-w-[220px] text-[12px] leading-relaxed text-muted-foreground">
        Click any field on the canvas, or drag one in from the library.
      </div>
    </div>
  );
}
