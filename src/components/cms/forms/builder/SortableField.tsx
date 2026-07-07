import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Copy, GripVertical, Trash2 } from "lucide-react";
import type { FormField } from "@/lib/forms/types";
import { FieldRenderer } from "./FieldRenderer";
import { fieldDef } from "./field-catalog";

interface Props {
  field: FormField;
  selected: boolean;
  isLast?: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

export function SortableField({
  field,
  selected,
  isLast,
  onSelect,
  onDuplicate,
  onDelete,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: field.id, data: { source: "canvas", fieldId: field.id } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const def = fieldDef(field.kind);
  const revealed = selected; // when selected, controls always visible

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`group relative cursor-pointer pl-12 pr-8 py-6 transition-colors duration-150 ${
        isLast ? "" : "border-b border-border/40"
      } ${selected ? "bg-muted/30" : "hover:bg-muted/20"} ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      {/* Left accent bar — selected */}
      <div
        className={`pointer-events-none absolute inset-y-0 left-0 w-[2px] bg-primary transition-opacity duration-150 ${
          selected ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Drag handle — reserved gutter, no layout shift */}
      <div className="absolute left-2 top-1/2 -translate-y-1/2">
        <button
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className={`cursor-grab rounded p-1 text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground active:cursor-grabbing ${
            revealed
              ? "opacity-100 translate-x-0"
              : "opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0"
          }`}
          title="Drag to reorder"
          tabIndex={revealed ? 0 : -1}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      </div>

      {/* Meta row: kind + actions (actions reserve space via invisible) */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <div
          className={`flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider transition-colors duration-150 ${
            selected
              ? "text-primary"
              : "text-muted-foreground/50 group-hover:text-muted-foreground"
          }`}
        >
          <def.icon className="h-3 w-3" />
          {def.label}
        </div>
        <div
          className={`flex items-center gap-1 transition-opacity duration-150 ${
            revealed
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100 focus-within:opacity-100"
          }`}
          aria-hidden={!revealed}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDuplicate();
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Duplicate"
            tabIndex={revealed ? 0 : -1}
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title="Delete"
            tabIndex={revealed ? 0 : -1}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <FieldRenderer field={field} />
    </div>
  );
}
