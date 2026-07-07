/**
 * GroupSection — collapsible group container in the schema canvas.
 * `group === null` renders the implicit Ungrouped section.
 *
 * Drag-and-drop:
 * - The whole section acts as a drop target for fields.
 * - Insertion indicator slots appear between rows (and after the last row).
 * - When the section is the active drop target, it gets a primary ring + tint.
 */
import { useState } from "react";
import {
  ChevronDown, ChevronRight, Copy, GripVertical, MoreHorizontal, Plus, Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { schemaActions } from "@/lib/cms/store";
import type { Schema, SchemaField, SchemaFieldGroup } from "@/lib/cms/types";
import { FieldCard } from "./FieldCard";
import { FieldPickerPopover } from "./FieldPickerPopover";
import { CATEGORY_ACCENT, FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";
import {
  GROUP_MIME,
  NEW_FIELD_MIME,
  makeDragGhost,
  type FieldDragState,
} from "@/lib/cms/schema/use-field-dnd";
import type { SchemaFieldType } from "@/lib/cms/types";

const GROUP_COLORS = [
  "var(--primary)",
  "#f97316", "#22c55e", "#06b6d4", "#a855f7", "#f43f5e", "#eab308",
];

interface Props {
  schema: Schema;
  group: SchemaFieldGroup | null;
  fields: SchemaField[];
  selectedFieldId: string | null;
  selected: boolean;
  isActiveTarget: boolean;
  /** When provided, the group's open state is controlled by the parent. */
  open?: boolean;
  onToggleOpen?: (next: boolean) => void;
  onSelectField: (id: string) => void;
  onSelectGroup: () => void;
  onSetActiveTarget: () => void;
  dragState: FieldDragState;
  onDragStartField: (field: SchemaField, e: React.DragEvent) => void;
  onDragEndField: () => void;
  onDragOverIndex: (index: number) => void;
  onDropIntoGroup: (payload?: { newFieldType?: SchemaFieldType }) => void;
  /** Group-reorder DnD (only meaningful when `group` is not null). */
  onGroupDragStart?: (e: React.DragEvent) => void;
  onGroupDragEnd?: () => void;
  isGroupDragging?: boolean;
}

export function GroupSection({
  schema, group, fields, selectedFieldId, selected, isActiveTarget,
  open: openProp, onToggleOpen,
  onSelectField, onSelectGroup, onSetActiveTarget,
  dragState, onDragStartField, onDragEndField, onDragOverIndex, onDropIntoGroup,
  onGroupDragStart, onGroupDragEnd, isGroupDragging,
}: Props) {
  const [openLocal, setOpenLocal] = useState(true);
  const open = openProp ?? openLocal;
  const setOpen = (next: boolean) => {
    if (onToggleOpen) onToggleOpen(next);
    else setOpenLocal(next);
  };
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(group?.label ?? "");
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState(group?.description ?? "");

  const accent = group?.color ?? "var(--muted-foreground)";
  const isUngrouped = group === null;
  const targetGroupId = group?.id ?? null;

  const dragging = dragState !== null;
  const isDropTarget = dragging && dragState?.overGroupId === targetGroupId;
  const overIndex = isDropTarget ? dragState?.overIndex ?? null : null;

  const isLibraryDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer.types).includes(NEW_FIELD_MIME);

  function handleDragEnter(e: React.DragEvent) {
    if (!dragState && !isLibraryDrag(e)) return;
    e.preventDefault();
    onSetActiveTarget();
  }

  function handleDragOver(e: React.DragEvent) {
    if (!dragState && !isLibraryDrag(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = isLibraryDrag(e) ? "copy" : "move";
  }

  function handleDrop(e: React.DragEvent) {
    if (isLibraryDrag(e)) {
      e.preventDefault();
      const t = e.dataTransfer.getData(NEW_FIELD_MIME) as SchemaFieldType;
      if (t) onDropIntoGroup({ newFieldType: t });
      return;
    }
    if (!dragState) return;
    e.preventDefault();
    onDropIntoGroup();
  }

  return (
    <section
      onClick={(e) => {
        e.stopPropagation();
        onSetActiveTarget();
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`group/section overflow-hidden rounded-xl bg-[color:var(--panel)] transition-all duration-150 ${
        isGroupDragging ? "opacity-40" : ""
      } ${
        isDropTarget
          ? "ring-1 ring-primary/50 bg-[color-mix(in_srgb,var(--primary)_5%,var(--panel))]"
          : selected
            ? "outline outline-2 outline-primary/60 outline-offset-[-2px]"
            : isActiveTarget
              ? "ring-1 ring-primary/30"
              : ""
      }`}
    >
      {/* Header */}
      <header
        className="flex items-center gap-2 px-3.5 py-2.5"
        onClick={(e) => { e.stopPropagation(); onSelectGroup(); onSetActiveTarget(); }}
      >
        {group && onGroupDragStart ? (
          <span
            draggable
            onDragStart={(e) => {
              e.stopPropagation();
              onGroupDragStart(e);
            }}
            onDragEnd={() => onGroupDragEnd?.()}
            onClick={(e) => e.stopPropagation()}
            className="grid h-5 w-4 cursor-grab place-items-center text-muted-foreground/40 hover:text-muted-foreground active:cursor-grabbing"
            title="Drag to reorder group"
            aria-label="Reorder group"
          >
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="h-5 w-4" />
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
          className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse group" : "Expand group"}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>


        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent, opacity: isUngrouped ? 0.4 : 1 }}
        />

        {renaming && group ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={() => { schemaActions.renameGroup(schema.id, group.id, draft.trim() || group.label); setRenaming(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { (e.target as HTMLInputElement).blur(); }
              if (e.key === "Escape") { setDraft(group.label); setRenaming(false); }
            }}
            className="h-6 rounded border border-primary/40 bg-background px-1.5 text-[13px] font-semibold focus:outline-none"
          />
        ) : (
          <span
            className={`truncate text-[13px] font-semibold tracking-tight ${isUngrouped ? "text-muted-foreground" : ""}`}
            onDoubleClick={(e) => { if (!isUngrouped) { e.stopPropagation(); setRenaming(true); } }}
          >
            {isUngrouped ? "Ungrouped" : group.label}
          </span>
        )}

        <span className="ml-1 text-[11px] tabular-nums text-muted-foreground">
          {fields.length}
        </span>

        <div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/section:opacity-100">
          <FieldPickerPopover
            schemaId={schema.id}
            groupId={group?.id ?? null}
            index={fields.length}
            onCreated={(fid) => onSelectField(fid)}
            align="end"
          >
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
              title="Add field to this group"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </FieldPickerPopover>

          {group && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  onClick={(e) => e.stopPropagation()}
                  className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                  aria-label="Group actions"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => setRenaming(true)}>Rename</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => { setDescDraft(group.description ?? ""); setEditingDesc(true); }}>
                  {group.description ? "Edit description" : "Add description"}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => schemaActions.duplicateGroup(schema.id, group.id)}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5">
                  <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Color</div>
                  <div className="flex flex-wrap gap-1">
                    {GROUP_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={(e) => { e.preventDefault(); schemaActions.setGroupColor(schema.id, group.id, c); }}
                        className="h-4 w-4 rounded-full ring-1 ring-border hover:ring-foreground/60"
                        style={{ background: c }}
                        aria-label={`Set color ${c}`}
                      />
                    ))}
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => schemaActions.removeGroup(schema.id, group.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete group
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {group && (editingDesc || group.description) && (
        <div className="px-3.5 pb-2 pl-[2.625rem] -mt-1.5">
          {editingDesc ? (
            <input
              autoFocus
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onBlur={() => {
                schemaActions.updateGroup(schema.id, group.id, { description: descDraft.trim() || undefined });
                setEditingDesc(false);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                if (e.key === "Escape") { setDescDraft(group.description ?? ""); setEditingDesc(false); }
              }}
              placeholder="Describe this group…"
              className="h-6 w-full rounded border border-primary/30 bg-background px-1.5 text-[12px] text-muted-foreground focus:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDescDraft(group.description ?? ""); setEditingDesc(true); }}
              className="text-left text-[12px] text-muted-foreground hover:text-foreground"
            >
              {group.description}
            </button>
          )}
        </div>
      )}


      {open && (
        <div className="px-2 pb-2">
          {fields.length === 0 ? (
            <div
              onDragEnter={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(0); } }}
              onDragOver={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(0); } }}
              className={`rounded-lg border border-dashed px-3 py-5 text-center text-[11px] transition-colors ${
                isDropTarget
                  ? "border-primary/60 bg-primary/[0.06] text-primary"
                  : "border-border/40 text-muted-foreground"
              }`}
            >
              {isDropTarget
                ? "Drop here"
                : <>Drop a field here from the library, or click <span className="font-medium text-foreground">+</span> above.</>}
            </div>
          ) : (
            <ul className="space-y-1">
              {fields.map((f, i) => {
                const isBeingDragged = dragState?.fieldId === f.id;
                const meta = FIELD_TYPE_META[f.type];
                const fieldAccent = meta ? CATEGORY_ACCENT[meta.category] : "var(--accent-content)";
                return (
                  <div key={f.id}>
                    <InsertSlot
                      active={overIndex === i}
                      onDragEnter={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(i); } }}
                      onDragOver={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(i); } }}
                    />
                    <div
                      onDragEnter={(e) => {
                        if (!dragState) return;
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const after = e.clientY > r.top + r.height / 2;
                        onDragOverIndex(after ? i + 1 : i);
                      }}
                      onDragOver={(e) => {
                        if (!dragState) return;
                        e.preventDefault();
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const after = e.clientY > r.top + r.height / 2;
                        onDragOverIndex(after ? i + 1 : i);
                      }}
                    >
                      <FieldCard
                        schema={schema}
                        field={f}
                        selected={selectedFieldId === f.id}
                        isFirst={i === 0}
                        isLast={i === fields.length - 1}
                        onSelect={() => onSelectField(f.id)}
                        draggable
                        isDragging={isBeingDragged}
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = "move";
                          makeDragGhost(e, f.label || f.name, fieldAccent);
                          onDragStartField(f, e);
                        }}
                        onDragEnd={onDragEndField}
                      />
                    </div>
                  </div>
                );
              })}
              <InsertSlot
                active={overIndex === fields.length}
                onDragEnter={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(fields.length); } }}
                onDragOver={(e) => { if (dragState) { e.preventDefault(); onDragOverIndex(fields.length); } }}
              />
            </ul>
          )}
          {fields.length > 0 && (
            <FieldPickerPopover
              schemaId={schema.id}
              groupId={group?.id ?? null}
              index={fields.length}
              onCreated={(fid) => onSelectField(fid)}
              align="start"
            >
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground/70 opacity-0 transition-opacity hover:bg-[color:var(--row-hover)] hover:text-foreground group-hover/section:opacity-100"
              >
                <Plus className="h-3.5 w-3.5" /> Add field
              </button>
            </FieldPickerPopover>
          )}
        </div>
      )}
    </section>
  );
}

function InsertSlot({
  active,
  onDragEnter,
  onDragOver,
}: {
  active: boolean;
  onDragEnter: (e: React.DragEvent) => void;
  onDragOver: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      className="relative h-1.5"
    >
      <div
        className={`pointer-events-none absolute inset-x-2 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary transition-all duration-150 ease-out ${
          active ? "scale-x-100 opacity-90 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]" : "scale-x-0 opacity-0"
        }`}
        style={{ transformOrigin: "center" }}
      />
    </div>
  );
}
