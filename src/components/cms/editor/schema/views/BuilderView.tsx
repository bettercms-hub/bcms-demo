/**
 * BuilderView — default Schema Builder canvas: groups → field rows.
 * Owns the drag-and-drop state across groups and reorders via
 * `schemaActions.moveFieldTo` on drop. Also accepts new-field drops
 * from the Field Library (NEW_FIELD_MIME), and group-reorder drags
 * (GROUP_MIME) for moving whole groups.
 */
import { useEffect, useMemo, useState } from "react";
import { ChevronsDownUp, ChevronsUpDown, Plus } from "lucide-react";
import type { Schema, SchemaField, SchemaFieldType } from "@/lib/cms/types";
import { schemaActions, useCMS } from "@/lib/cms/store";
import { GroupSection } from "../GroupSection";
import { FieldPickerPopover } from "../FieldPickerPopover";
import { SuggestedFieldsBanner } from "../SuggestedFieldsBanner";
import {
  GROUP_MIME,
  NEW_FIELD_MIME,
  makeDragGhost,
  type FieldDragState,
  useDragAutoScroll,
} from "@/lib/cms/schema/use-field-dnd";

const RECENT_KEY = "bcms.schema.recent-fields";

function pushRecent(t: SchemaFieldType) {
  try {
    const prev: SchemaFieldType[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    const next = [t, ...prev.filter((x) => x !== t)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

interface Props {
  schema: Schema;
  selectedFieldId: string | null;
  activeGroupId: string | null;
  onSelectField: (id: string) => void;
  onSetActiveGroup: (id: string | null) => void;
  onRequestAddField: () => void;
}

type GroupDragState = {
  groupId: string;
  overIndex: number | null;
} | null;

export function BuilderView({
  schema,
  selectedFieldId,
  activeGroupId,
  onSelectField,
  onSetActiveGroup,
  onRequestAddField,
}: Props) {
  const groups = schema.groups ?? [];
  const ungroupedFields = useMemo(
    () =>
      schema.fields.filter(
        (f) => !f.groupId || !groups.some((g) => g.id === f.groupId),
      ),
    [schema.fields, groups],
  );

  const [dragState, setDragState] = useState<FieldDragState>(null);
  const [groupDrag, setGroupDrag] = useState<GroupDragState>(null);
  useDragAutoScroll(dragState !== null || groupDrag !== null);

  // Per-group open/collapse map — controlled here so Collapse/Expand all works.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({});
  const isOpen = (id: string) => openMap[id] ?? true;
  const toggleOpen = (id: string, next: boolean) =>
    setOpenMap((m) => ({ ...m, [id]: next }));
  const setAll = (next: boolean) => {
    const m: Record<string, boolean> = {};
    for (const g of groups) m[g.id] = next;
    m["__ungrouped__"] = next;
    setOpenMap(m);
  };

  // Detect drags originating from the Field Library and synthesize a
  // dragState so the same drop-indicator UI lights up.
  useEffect(() => {
    const onStart = (e: DragEvent) => {
      const types = e.dataTransfer ? Array.from(e.dataTransfer.types) : [];
      if (types.includes(NEW_FIELD_MIME)) {
        setDragState({
          fieldId: "__new__",
          fromGroupId: null,
          overGroupId: null,
          overIndex: null,
          isNew: true,
        });
      }
    };
    const onEnd = () => {
      setDragState((s) => (s?.isNew ? null : s));
      setGroupDrag(null);
    };
    window.addEventListener("dragstart", onStart);
    window.addEventListener("dragend", onEnd);
    window.addEventListener("drop", onEnd);
    return () => {
      window.removeEventListener("dragstart", onStart);
      window.removeEventListener("dragend", onEnd);
      window.removeEventListener("drop", onEnd);
    };
  }, []);

  function handleDragStart(field: SchemaField) {
    const fromGroupId =
      field.groupId && groups.some((g) => g.id === field.groupId)
        ? field.groupId
        : null;
    setDragState({
      fieldId: field.id,
      fromGroupId,
      overGroupId: fromGroupId,
      overIndex: null,
    });
  }

  function handleDragEnd() {
    setDragState(null);
  }

  function handleDragOverIndex(groupId: string | null, index: number) {
    setDragState((prev) =>
      prev && (prev.overGroupId !== groupId || prev.overIndex !== index)
        ? { ...prev, overGroupId: groupId, overIndex: index }
        : prev,
    );
  }

  function handleDrop(
    groupId: string | null,
    payload?: { newFieldType?: SchemaFieldType },
  ) {
    const targetIndex = dragState?.overIndex ?? 0;
    if (payload?.newFieldType) {
      const fid = schemaActions.addField(schema.id, payload.newFieldType);
      if (groupId) {
        schemaActions.setFieldGroup(schema.id, fid, groupId);
      }
      schemaActions.moveFieldTo(schema.id, fid, groupId, targetIndex);
      pushRecent(payload.newFieldType);
      onSetActiveGroup(groupId);
      onSelectField(fid);
      setDragState(null);
      return;
    }
    if (!dragState) return;
    schemaActions.moveFieldTo(schema.id, dragState.fieldId, groupId, targetIndex);
    setDragState(null);
  }

  // --- Group reorder DnD ---
  function startGroupDrag(groupId: string, label: string, e: React.DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData(GROUP_MIME, groupId); } catch { /* ignore */ }
    makeDragGhost(e, label, "var(--primary)");
    setGroupDrag({ groupId, overIndex: null });
  }
  function overGroupSlot(index: number, e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes(GROUP_MIME)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setGroupDrag((prev) => (prev ? { ...prev, overIndex: index } : prev));
  }
  function dropGroupSlot(index: number, e: React.DragEvent) {
    if (!Array.from(e.dataTransfer.types).includes(GROUP_MIME)) return;
    e.preventDefault();
    const gid = e.dataTransfer.getData(GROUP_MIME) || groupDrag?.groupId;
    if (!gid) return;
    const from = groups.findIndex((g) => g.id === gid);
    let to = index;
    if (from !== -1 && from < index) to = index - 1;
    schemaActions.reorderGroups(schema.id, gid, to);
    setGroupDrag(null);
  }

  if (schema.fields.length === 0 && groups.length === 0) {
    return (
      <div className="mx-auto max-w-[640px] py-24 text-center">
        <div className="text-[15px] font-semibold tracking-tight">
          Start your schema
        </div>
        <div className="mt-1.5 text-[13px] text-muted-foreground">
          Pick a field type, press{" "}
          <kbd className="rounded bg-[color:var(--row-hover)] px-1.5 py-0.5 font-mono text-[11px]">/</kbd>
          , or open the library.
        </div>
        <FieldPickerPopover
          schemaId={schema.id}
          groupId={null}
          onCreated={(fid) => onSelectField(fid)}
          align="center"
        >
          <button
            type="button"
            className="mt-5 inline-flex h-9 items-center gap-1.5 rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background hover:opacity-90"
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </FieldPickerPopover>
      </div>
    );
  }

  return (
    <BuilderViewContent
      schema={schema}
      groups={groups}
      ungroupedFields={ungroupedFields}
      selectedFieldId={selectedFieldId}
      activeGroupId={activeGroupId}
      onSelectField={onSelectField}
      onSetActiveGroup={onSetActiveGroup}
      isOpen={isOpen}
      toggleOpen={toggleOpen}
      setAll={setAll}
      dragState={dragState}
      groupDrag={groupDrag}
      handleDragStart={handleDragStart}
      handleDragEnd={handleDragEnd}
      handleDragOverIndex={handleDragOverIndex}
      handleDrop={handleDrop}
      startGroupDrag={startGroupDrag}
      setGroupDrag={setGroupDrag}
      overGroupSlot={overGroupSlot}
      dropGroupSlot={dropGroupSlot}
    />
  );
}

interface ContentProps {
  schema: Schema;
  groups: NonNullable<Schema["groups"]>;
  ungroupedFields: SchemaField[];
  selectedFieldId: string | null;
  activeGroupId: string | null;
  onSelectField: (id: string) => void;
  onSetActiveGroup: (id: string | null) => void;
  isOpen: (id: string) => boolean;
  toggleOpen: (id: string, next: boolean) => void;
  setAll: (next: boolean) => void;
  dragState: FieldDragState;
  groupDrag: GroupDragState;
  handleDragStart: (field: SchemaField) => void;
  handleDragEnd: () => void;
  handleDragOverIndex: (groupId: string | null, index: number) => void;
  handleDrop: (groupId: string | null, payload?: { newFieldType?: SchemaFieldType }) => void;
  startGroupDrag: (groupId: string, label: string, e: React.DragEvent) => void;
  setGroupDrag: (g: GroupDragState) => void;
  overGroupSlot: (index: number, e: React.DragEvent) => void;
  dropGroupSlot: (index: number, e: React.DragEvent) => void;
}

function BuilderViewContent({
  schema, groups, ungroupedFields, selectedFieldId, activeGroupId,
  onSelectField, onSetActiveGroup, isOpen, toggleOpen, setAll,
  dragState, groupDrag, handleDragStart, handleDragEnd, handleDragOverIndex,
  handleDrop, startGroupDrag, setGroupDrag, overGroupSlot, dropGroupSlot,
}: ContentProps) {
  const owner = useCMS((s) => {
    const c = s.collections.find((cc) => cc.schemaId === schema.id);
    if (c) return c.name;
    const co = s.components.find((cc) => cc.schemaId === schema.id);
    return co?.name ?? "Schema";
  });
  const showSuggestions = schema.fields.length < 2;

  return (
    <div className="mx-auto max-w-[900px] px-10 py-10">
      {showSuggestions && (
        <SuggestedFieldsBanner
          schema={schema}
          ownerName={owner}
          onInserted={(fid) => onSelectField(fid)}
        />
      )}
      {groups.length > 1 && (
        <div className="mb-3 flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => setAll(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
            title="Expand all groups"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" /> Expand all
          </button>
          <button
            type="button"
            onClick={() => setAll(false)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[11.5px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
            title="Collapse all groups"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" /> Collapse all
          </button>
        </div>
      )}

      <div className="space-y-4">
        {groups.map((g, gi) => {
          const fields = schema.fields.filter((f) => f.groupId === g.id);
          return (
            <div key={g.id}>
              <GroupInsertSlot
                active={groupDrag !== null && groupDrag.overIndex === gi}
                onDragOver={(e) => overGroupSlot(gi, e)}
                onDrop={(e) => dropGroupSlot(gi, e)}
              />
              <GroupSection
                schema={schema}
                group={g}
                fields={fields}
                selectedFieldId={selectedFieldId}
                selected={false}
                isActiveTarget={activeGroupId === g.id}
                open={isOpen(g.id)}
                onToggleOpen={(v) => toggleOpen(g.id, v)}
                onSelectField={onSelectField}
                onSelectGroup={() => onSetActiveGroup(g.id)}
                onSetActiveTarget={() => onSetActiveGroup(g.id)}
                dragState={dragState}
                onDragStartField={(field) => handleDragStart(field)}
                onDragEndField={handleDragEnd}
                onDragOverIndex={(i) => handleDragOverIndex(g.id, i)}
                onDropIntoGroup={(payload) => handleDrop(g.id, payload)}
                onGroupDragStart={(e) => startGroupDrag(g.id, g.label, e)}
                onGroupDragEnd={() => setGroupDrag(null)}
                isGroupDragging={groupDrag?.groupId === g.id}
              />
            </div>
          );
        })}
        <GroupInsertSlot
          active={groupDrag !== null && groupDrag.overIndex === groups.length}
          onDragOver={(e) => overGroupSlot(groups.length, e)}
          onDrop={(e) => dropGroupSlot(groups.length, e)}
        />

        <GroupSection
          schema={schema}
          group={null}
          fields={ungroupedFields}
          selectedFieldId={selectedFieldId}
          selected={false}
          isActiveTarget={activeGroupId === null}
          open={isOpen("__ungrouped__")}
          onToggleOpen={(v) => toggleOpen("__ungrouped__", v)}
          onSelectField={onSelectField}
          onSelectGroup={() => onSetActiveGroup(null)}
          onSetActiveTarget={() => onSetActiveGroup(null)}
          dragState={dragState}
          onDragStartField={(field) => handleDragStart(field)}
          onDragEndField={handleDragEnd}
          onDragOverIndex={(i) => handleDragOverIndex(null, i)}
          onDropIntoGroup={(payload) => handleDrop(null, payload)}
        />
      </div>

      <div className="flex items-center justify-center gap-2 pt-4">
        <FieldPickerPopover
          schemaId={schema.id}
          groupId={activeGroupId}
          onCreated={(fid) => onSelectField(fid)}
          align="center"
          side="top"
        >
          <button
            type="button"
            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" /> Add field
          </button>
        </FieldPickerPopover>
        <span className="text-[11px] text-muted-foreground/70">or press /</span>
        <button
          type="button"
          onClick={() => {
            const id = schemaActions.addGroup(schema.id, "New group");
            onSetActiveGroup(id);
          }}
          className="ml-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" /> Add group
        </button>
      </div>
    </div>
  );
}

function GroupInsertSlot({
  active,
  onDragOver,
  onDrop,
}: {
  active: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  return (
    <div
      onDragEnter={onDragOver}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="relative h-2"
    >
      <div
        className={`pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 rounded-full bg-primary transition-all duration-150 ease-out ${
          active ? "scale-x-100 opacity-90 shadow-[0_0_0_3px_color-mix(in_srgb,var(--primary)_18%,transparent)]" : "scale-x-0 opacity-0"
        }`}
        style={{ transformOrigin: "center" }}
      />
    </div>
  );
}
