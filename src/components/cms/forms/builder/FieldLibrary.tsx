import { useDraggable } from "@dnd-kit/core";
import { FIELD_CATALOG, type FieldDef } from "./field-catalog";
import type { FieldKind } from "@/lib/forms/types";

export function FieldLibrary({ onAppend }: { onAppend?: (kind: FieldKind) => void }) {
  const groups: FieldDef["group"][] = ["Basic", "Choice", "Advanced"];
  return (
    <div className="flex h-full flex-col overflow-auto border-r border-border/60 bg-[color:var(--panel)] p-3">
      <div className="mb-3 px-1">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Fields
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Drag onto the canvas, or click to append.
        </p>
      </div>
      {groups.map((g) => (
        <div key={g} className="mb-4">
          <div className="mb-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground/80">
            {g}
          </div>
          <div className="space-y-1">
            {FIELD_CATALOG.filter((f) => f.group === g).map((f) => (
              <LibItem key={f.kind} def={f} onAppend={onAppend} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function LibItem({ def, onAppend }: { def: FieldDef; onAppend?: (kind: FieldKind) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `lib:${def.kind}`,
    data: { source: "library", kind: def.kind },
  });
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={() => onAppend?.(def.kind)}
      className={`flex w-full items-start gap-2 rounded-md border border-transparent bg-transparent p-2 text-left transition-colors hover:border-border hover:bg-[color:var(--card)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <def.icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <div className="text-xs font-medium text-foreground">{def.label}</div>
        <div className="truncate text-[11px] text-muted-foreground">{def.description}</div>
      </div>
    </button>
  );
}
