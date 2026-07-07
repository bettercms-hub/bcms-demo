import { useState } from "react";
import {
  ChevronDown, ChevronRight, ChevronUp, GripVertical, Plus, Settings2, Star, Trash2,
} from "lucide-react";
import { schemaActions, useCMS } from "@/lib/cms/store";
import type { SchemaField } from "@/lib/cms/types";
import { FieldTypePicker } from "../fields/FieldTypePicker";
import { CATEGORY_ACCENT, FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";

const UNGROUPED = "__ungrouped__";

export function SchemaEditor({ schemaId }: { schemaId: string }) {
  const schema = useCMS((s) => s.schemas.find((sc) => sc.id === schemaId));
  const [activeGroup, setActiveGroup] = useState<string>(UNGROUPED);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (!schema) return null;

  const groups = schema.groups ?? [];
  const groupExists = activeGroup === UNGROUPED || groups.some((g) => g.id === activeGroup);
  const currentGroup = groupExists ? activeGroup : (groups[0]?.id ?? UNGROUPED);

  const fieldsInGroup = schema.fields.filter((f) => {
    if (currentGroup === UNGROUPED) return !f.groupId || !groups.some((g) => g.id === f.groupId);
    return f.groupId === currentGroup;
  });

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          Schema · {schema.fields.length} {schema.fields.length === 1 ? "field" : "fields"} · {groups.length} groups
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1 rounded-[6px] border border-border bg-background px-2 py-1 text-[12px] font-medium hover:bg-muted"
        >
          <Plus className="h-3 w-3" /> Add field
        </button>
      </div>

      <div className="grid grid-cols-[200px_1fr] gap-3">
        {/* Groups rail */}
        <div className="rounded-[8px] border border-border bg-background p-1">
          <GroupRow
            label="Ungrouped"
            active={currentGroup === UNGROUPED}
            onClick={() => setActiveGroup(UNGROUPED)}
            count={schema.fields.filter((f) => !f.groupId || !groups.some((g) => g.id === f.groupId)).length}
          />
          {groups.map((g, i) => (
            <GroupRow
              key={g.id}
              label={g.label}
              active={currentGroup === g.id}
              onClick={() => setActiveGroup(g.id)}
              count={schema.fields.filter((f) => f.groupId === g.id).length}
              onRename={(label) => schemaActions.renameGroup(schemaId, g.id, label)}
              onRemove={() => schemaActions.removeGroup(schemaId, g.id)}
              onMoveUp={i > 0 ? () => schemaActions.moveGroup(schemaId, g.id, -1) : undefined}
              onMoveDown={i < groups.length - 1 ? () => schemaActions.moveGroup(schemaId, g.id, 1) : undefined}
            />
          ))}
          <button
            type="button"
            onClick={() => {
              const id = schemaActions.addGroup(schemaId, "New group");
              setActiveGroup(id);
            }}
            className="mt-1 flex w-full items-center gap-1 rounded-[6px] px-2 py-1.5 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> New group
          </button>
        </div>

        {/* Fields pane */}
        <div className="rounded-[8px] border border-border bg-background">
          {fieldsInGroup.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-muted-foreground">
              No fields in this group. Use <span className="font-medium text-foreground">Add field</span> to create one.
            </div>
          ) : (
            <ul>
              {fieldsInGroup.map((f, i) => (
                <FieldRow
                  key={f.id}
                  schemaId={schemaId}
                  field={f}
                  isTitle={schema.titleFieldName === f.name}
                  inList={(schema.listFieldNames ?? []).includes(f.name)}
                  groups={groups}
                  onMoveUp={i > 0 ? () => schemaActions.moveField(schemaId, f.id, -1) : undefined}
                  onMoveDown={i < fieldsInGroup.length - 1 ? () => schemaActions.moveField(schemaId, f.id, 1) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      </div>

      <p className="mt-3 font-mono text-[10px] text-muted-foreground">
        id {schema.id} · owner {schema.ownerType}/{schema.ownerId}
      </p>

      <FieldTypePicker
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(type) => {
          const fid = schemaActions.addField(schemaId, type);
          if (currentGroup !== UNGROUPED) schemaActions.setFieldGroup(schemaId, fid, currentGroup);
        }}
      />
    </div>
  );
}

function GroupRow({
  label, active, onClick, count, onRename, onRemove, onMoveUp, onMoveDown,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  count: number;
  onRename?: (v: string) => void;
  onRemove?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(label);
  return (
    <div
      className={`group flex items-center gap-1 rounded-[6px] px-2 py-1.5 text-[12px] ${
        active ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/60"
      }`}
    >
      <button type="button" onClick={onClick} className="flex-1 truncate text-left">
        {editing ? (
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => { onRename?.(draft); setEditing(false); }}
            onKeyDown={(e) => { if (e.key === "Enter") { onRename?.(draft); setEditing(false); } }}
            className="w-full bg-transparent text-foreground outline-none"
          />
        ) : (
          <span onDoubleClick={() => onRename && setEditing(true)}>{label}</span>
        )}
      </button>
      <span className="text-[10px] text-muted-foreground">{count}</span>
      {onMoveUp && (
        <button onClick={onMoveUp} className="opacity-0 transition-opacity group-hover:opacity-100"><ChevronUp className="h-3 w-3" /></button>
      )}
      {onMoveDown && (
        <button onClick={onMoveDown} className="opacity-0 transition-opacity group-hover:opacity-100"><ChevronDown className="h-3 w-3" /></button>
      )}
      {onRemove && (
        <button onClick={onRemove} className="opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive">
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function FieldRow({
  schemaId, field, isTitle, inList, groups, onMoveUp, onMoveDown,
}: {
  schemaId: string;
  field: SchemaField;
  isTitle: boolean;
  inList: boolean;
  groups: { id: string; label: string }[];
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const collections = useCMS((s) => s.collections);
  const components = useCMS((s) => s.components);

  const meta = FIELD_TYPE_META[field.type];
  const TypeIcon = meta?.icon;
  const accent = meta ? CATEGORY_ACCENT[meta.category] : "var(--accent-content)";

  return (
    <li className="border-t border-border first:border-t-0">
      <div className="group/field flex items-center gap-2 px-2 py-2 hover:bg-muted/30">
        <button
          className="text-muted-foreground/40 opacity-0 transition-opacity group-hover/field:opacity-100"
          title="Drag (visual only)"
        >
          <GripVertical className="h-3.5 w-3.5 cursor-grab" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground"
          aria-label={open ? "Collapse field" : "Expand field"}
        >
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Type pill: category-tinted icon + label */}
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
          style={{
            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
            color: `color-mix(in srgb, ${accent} 80%, var(--color-foreground))`,
          }}
          title={meta?.category}
        >
          {TypeIcon && <TypeIcon className="h-3 w-3" />}
          {meta?.label ?? field.type}
        </span>

        <input
          value={field.label}
          onChange={(e) => schemaActions.updateField(schemaId, field.id, { label: e.target.value })}
          className="h-7 w-[180px] rounded-[6px] border border-transparent bg-transparent px-1.5 text-[13px] font-medium hover:border-border focus:border-primary focus:outline-none"
          placeholder="Label"
        />
        <input
          value={field.name}
          onChange={(e) => schemaActions.updateField(schemaId, field.id, { name: e.target.value.replace(/\s+/g, "_") })}
          className="h-7 w-[150px] rounded-[6px] border border-transparent bg-transparent px-1.5 font-mono text-[12px] text-muted-foreground hover:border-border focus:border-primary focus:outline-none"
          placeholder="field_name"
        />

        {field.required && (
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">required</span>
        )}
        {field.unique && (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">unique</span>
        )}
        {field.type === "reference" && field.refCollectionId && (
          <span className="truncate text-[11px] text-muted-foreground">
            → {collections.find((c) => c.id === field.refCollectionId)?.name ?? "?"}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => schemaActions.setTitleField(schemaId, field.name)}
            className={`grid h-6 w-6 place-items-center rounded ${
              isTitle ? "text-amber-500" : "text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover/field:opacity-100"
            }`}
            title={isTitle ? "Title field" : "Use as title"}
          >
            <Star className={`h-3.5 w-3.5 ${isTitle ? "fill-current" : ""}`} />
          </button>
          <label
            className={`flex items-center gap-1 px-1 text-[11px] transition-opacity ${
              inList ? "text-foreground" : "text-muted-foreground opacity-0 group-hover/field:opacity-100"
            }`}
            title="Show in collection list view"
          >
            <input
              type="checkbox"
              checked={inList}
              onChange={(e) => schemaActions.setListField(schemaId, field.name, e.target.checked)}
              className="h-3 w-3 accent-[color:var(--primary)]"
            />
            list
          </label>
          <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/field:opacity-100 focus-within:opacity-100">
            {onMoveUp && (
              <button onClick={onMoveUp} className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground" title="Move up">
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
            {onMoveDown && (
              <button onClick={onMoveDown} className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground" title="Move down">
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => setOpen((v) => !v)}
              className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-foreground"
              title="Configure"
            >
              <Settings2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => schemaActions.removeField(schemaId, field.id)}
              className="grid h-6 w-6 place-items-center text-muted-foreground hover:text-destructive"
              title="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {open && (
        <div className="border-t border-border bg-surface/40 px-3 py-3">
          <div className="grid grid-cols-2 gap-3">
            <Cfg label="Description">
              <input
                value={field.description ?? ""}
                onChange={(e) => schemaActions.updateField(schemaId, field.id, { description: e.target.value })}
                className="cfg-input"
              />
            </Cfg>
            <Cfg label="Placeholder">
              <input
                value={field.placeholder ?? ""}
                onChange={(e) => schemaActions.updateField(schemaId, field.id, { placeholder: e.target.value })}
                className="cfg-input"
              />
            </Cfg>
            <Cfg label="Group">
              <select
                value={field.groupId ?? ""}
                onChange={(e) => schemaActions.setFieldGroup(schemaId, field.id, e.target.value || null)}
                className="cfg-input"
              >
                <option value="">Ungrouped</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </Cfg>
            <Cfg label="Required / Unique">
              <div className="flex h-8 items-center gap-3 text-[12px]">
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={!!field.required} onChange={(e) => schemaActions.updateField(schemaId, field.id, { required: e.target.checked })} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  required
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={!!field.unique} onChange={(e) => schemaActions.updateField(schemaId, field.id, { unique: e.target.checked })} className="h-3.5 w-3.5 accent-[color:var(--primary)]" />
                  unique
                </label>
              </div>
            </Cfg>

            {(field.type === "reference" || field.type === "multiReference") && (
              <Cfg label="Reference collection">
                <select
                  value={field.refCollectionId ?? ""}
                  onChange={(e) => schemaActions.setFieldReference(schemaId, field.id, { refCollectionId: e.target.value || undefined })}
                  className="cfg-input"
                >
                  <option value="">— pick a collection —</option>
                  {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Cfg>
            )}

            {field.type === "componentRef" && (
              <Cfg label="Component">
                <select
                  value={field.refComponentId ?? ""}
                  onChange={(e) => schemaActions.setFieldReference(schemaId, field.id, { refComponentId: e.target.value || undefined })}
                  className="cfg-input"
                >
                  <option value="">— pick a component —</option>
                  {components.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Cfg>
            )}

            {field.type === "select" && (
              <Cfg label="Options (comma-separated)">
                <input
                  value={(field.options ?? []).join(", ")}
                  onChange={(e) =>
                    schemaActions.setFieldOptions(
                      schemaId,
                      field.id,
                      e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    )
                  }
                  className="cfg-input"
                />
              </Cfg>
            )}

            {(field.type === "text" || field.type === "richText") && (
              <Cfg label="Length min / max">
                <div className="flex gap-2">
                  <input
                    type="number"
                    placeholder="min"
                    value={field.validation?.minLength ?? ""}
                    onChange={(e) => schemaActions.setFieldValidation(schemaId, field.id, { ...field.validation, minLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="cfg-input"
                  />
                  <input
                    type="number"
                    placeholder="max"
                    value={field.validation?.maxLength ?? ""}
                    onChange={(e) => schemaActions.setFieldValidation(schemaId, field.id, { ...field.validation, maxLength: e.target.value === "" ? undefined : Number(e.target.value) })}
                    className="cfg-input"
                  />
                </div>
              </Cfg>
            )}

            {field.type === "number" && (
              <Cfg label="Value min / max">
                <div className="flex gap-2">
                  <input type="number" placeholder="min" value={field.validation?.min ?? ""} onChange={(e) => schemaActions.setFieldValidation(schemaId, field.id, { ...field.validation, min: e.target.value === "" ? undefined : Number(e.target.value) })} className="cfg-input" />
                  <input type="number" placeholder="max" value={field.validation?.max ?? ""} onChange={(e) => schemaActions.setFieldValidation(schemaId, field.id, { ...field.validation, max: e.target.value === "" ? undefined : Number(e.target.value) })} className="cfg-input" />
                </div>
              </Cfg>
            )}
          </div>
        </div>
      )}
      <style>{`.cfg-input { height: 32px; width: 100%; border-radius: 6px; border: 1px solid var(--border); background: var(--background); padding: 0 .5rem; font-size: 13px; }`}</style>
    </li>
  );
}

function Cfg({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
