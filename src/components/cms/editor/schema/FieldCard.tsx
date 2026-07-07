/**
 * FieldCard — one card in the schema canvas (v5.4).
 *
 * Two-row scannable layout:
 *   ┌─────────────────────────────────────────────────┐
 *   │  📝   Title                       Required      │
 *   │       Text · title                Unique        │
 *   │       Short description.                        │
 *   └─────────────────────────────────────────────────┘
 *
 * Soft border, no shadow. Click selects; hover reveals row actions.
 */
import { Copy, FolderInput, GripVertical, MoreHorizontal, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { schemaActions } from "@/lib/cms/store";
import type { Schema, SchemaField } from "@/lib/cms/types";
import { CATEGORY_ACCENT, FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";
import { useCMS } from "@/lib/cms/store";

interface Props {
  schema: Schema;
  field: SchemaField;
  selected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  draggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

export function FieldCard({
  schema, field, selected, onSelect,
  draggable, isDragging, onDragStart, onDragEnd,
}: Props) {
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta?.icon;
  const accent = meta ? CATEGORY_ACCENT[meta.category] : "var(--accent-content)";

  const isTitle = schema.titleFieldName === field.name;
  const inList = (schema.listFieldNames ?? []).includes(field.name);

  const refLabel = useCMS((s) => {
    if (field.type === "reference" || field.type === "multiReference") {
      if (!field.refCollectionId) return null;
      return s.collections.find((c) => c.id === field.refCollectionId)?.name ?? null;
    }
    if (field.type === "componentRef") {
      if (!field.refComponentId) return null;
      return s.components.find((c) => c.id === field.refComponentId)?.name ?? null;
    }
    return null;
  });

  return (
    <li
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={isDragging ? "opacity-40" : ""}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(); }
        }}
        className={`group/card relative flex w-full items-start gap-3 rounded-lg border bg-[color:var(--card)] px-4 py-3 text-left transition-colors ${
          selected
            ? "border-primary/60 bg-[color-mix(in_srgb,var(--primary)_4%,var(--card))]"
            : "border-border/40 hover:border-border hover:bg-[color:var(--row-hover)]"
        } ${isDragging ? "cursor-grabbing" : "cursor-pointer"}`}
      >
        {/* Drag affordance */}
        <span
          className={`grid h-5 w-4 shrink-0 place-items-center pt-0.5 text-muted-foreground/30 transition-opacity group-hover/card:text-muted-foreground/70 ${
            draggable ? "cursor-grab active:cursor-grabbing" : ""
          }`}
          aria-hidden
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>

        {/* Type icon chip */}
        <span
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            color: `color-mix(in srgb, ${accent} 80%, var(--color-foreground))`,
          }}
          title={meta?.label}
        >
          {Icon && <Icon className="h-4 w-4" />}
        </span>

        {/* Main content — label, meta, description */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[14px] font-medium tracking-tight text-foreground">
              {field.label || field.name}
            </span>
            {isTitle && (
              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/12 px-1.5 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
                <Star className="h-2.5 w-2.5" /> title
              </span>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[11.5px] text-muted-foreground/80">
            <span>{meta?.label ?? field.type}</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="truncate font-mono">{field.name}</span>
            {refLabel && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span className="truncate">→ {refLabel}</span>
              </>
            )}
          </div>
          {field.description && (
            <div className="mt-1.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted-foreground">
              {field.description}
            </div>
          )}
        </div>

        {/* Chips column */}
        <div className="flex shrink-0 flex-col items-end gap-1 pt-0.5">
          <div className="flex items-center gap-1">
            {field.required && <Chip tone="primary">Required</Chip>}
            {field.unique && <Chip tone="muted">Unique</Chip>}
            {field.localized && <Chip tone="muted">i18n</Chip>}
            {inList && <Chip tone="muted">List</Chip>}
          </div>
        </div>

        {/* Hover row actions */}
        <div
          className="flex shrink-0 items-start gap-0.5 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {(schema.groups?.length ?? 0) > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Move to group"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
                >
                  <FolderInput className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Move to group
                </DropdownMenuLabel>
                {(schema.groups ?? []).map((g) => (
                  <DropdownMenuItem
                    key={g.id}
                    disabled={field.groupId === g.id}
                    onSelect={() => schemaActions.setFieldGroup(schema.id, field.id, g.id)}
                  >
                    <span
                      className="mr-2 inline-block h-2 w-2 rounded-full"
                      style={{ background: g.color ?? "var(--muted-foreground)" }}
                    />
                    {g.label}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={!field.groupId}
                  onSelect={() => schemaActions.setFieldGroup(schema.id, field.id, null)}
                >
                  Ungroup
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Field actions"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={() => schemaActions.duplicateField(schema.id, field.id)}>
                <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => schemaActions.removeField(schema.id, field.id)}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </li>
  );
}

function Chip({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "primary" | "muted";
}) {
  const cls =
    tone === "primary"
      ? "bg-primary/10 text-primary"
      : "bg-[color:var(--row-hover)] text-muted-foreground";
  return (
    <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
      {children}
    </span>
  );
}
