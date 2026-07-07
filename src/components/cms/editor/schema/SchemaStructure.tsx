/**
 * SchemaStructure — middle "layers" column of the Schema Builder.
 * Figma-Layers-style tree: groups collapse, fields are leaves.
 * Click a group to focus / set the active insertion target; click a field
 * to open the slide-over field editor.
 */
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderPlus,
  Plus,
  Search,
} from "lucide-react";
import { schemaActions } from "@/lib/cms/store";
import type { Schema, SchemaField, SchemaFieldGroup } from "@/lib/cms/types";
import { FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";

interface Props {
  schema: Schema;
  activeGroupId: string | null;
  selectedFieldId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onSelectField: (fieldId: string) => void;
  onAddFieldRequest: () => void;
}

export function SchemaStructure({
  schema,
  activeGroupId,
  selectedFieldId,
  onSelectGroup,
  onSelectField,
  onAddFieldRequest,
}: Props) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) =>
    setCollapsed((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const groups = schema.groups ?? [];
  const ungroupedFields = useMemo(
    () =>
      schema.fields.filter(
        (f) => !f.groupId || !groups.some((g) => g.id === f.groupId),
      ),
    [schema.fields, groups],
  );

  const matchField = (f: SchemaField) =>
    !query ||
    f.label.toLowerCase().includes(query) ||
    f.name.toLowerCase().includes(query);

  return (
    <div className="flex h-full flex-col bg-[color:var(--canvas)]">
      <div className="flex items-center gap-1 px-2.5 pt-3 pb-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fields"
            className="h-8 w-full rounded-md border border-transparent bg-transparent pl-7 pr-2 text-[12px] placeholder:text-muted-foreground/60 hover:bg-[color:var(--row-hover)] focus:border-primary/40 focus:bg-[color:var(--row-hover)] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            const id = schemaActions.addGroup(schema.id, "New group");
            onSelectGroup(id);
          }}
          title="Add group"
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={onAddFieldRequest}
          title="Add field (/)"
          className="grid h-7 w-7 place-items-center rounded text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-3">
        {groups.map((g) => {
          const fields = schema.fields.filter(
            (f) => f.groupId === g.id && matchField(f),
          );
          const isOpen = !collapsed.has(g.id);
          return (
            <GroupNode
              key={g.id}
              schemaId={schema.id}
              group={g}
              fields={fields}
              isOpen={isOpen}
              active={activeGroupId === g.id}
              selectedFieldId={selectedFieldId}
              onToggle={() => toggle(g.id)}
              onSelectGroup={() => onSelectGroup(g.id)}
              onSelectField={onSelectField}
            />
          );
        })}

        {/* Ungrouped */}
        <GroupNode
          schemaId={schema.id}
          group={null}
          fields={ungroupedFields.filter(matchField)}
          isOpen={!collapsed.has("__ungrouped__")}
          active={activeGroupId === null}
          selectedFieldId={selectedFieldId}
          onToggle={() => toggle("__ungrouped__")}
          onSelectGroup={() => onSelectGroup(null)}
          onSelectField={onSelectField}
        />
      </div>
    </div>
  );
}

function GroupNode({
  group,
  fields,
  isOpen,
  active,
  selectedFieldId,
  onToggle,
  onSelectGroup,
  onSelectField,
}: {
  schemaId: string;
  group: SchemaFieldGroup | null;
  fields: SchemaField[];
  isOpen: boolean;
  active: boolean;
  selectedFieldId: string | null;
  onToggle: () => void;
  onSelectGroup: () => void;
  onSelectField: (id: string) => void;
}) {
  const isUngrouped = group === null;
  const accent = group?.color ?? "var(--muted-foreground)";
  return (
    <div>
      <div
        className={`group/grow flex items-center gap-1 rounded-md px-1.5 py-1 text-[12.5px] transition-colors ${
          active
            ? "bg-[color:var(--row-selected)] text-foreground"
            : "hover:bg-[color:var(--row-hover)]"
        }`}
      >
        <button
          type="button"
          onClick={onToggle}
          className="grid h-4 w-4 shrink-0 place-items-center text-muted-foreground hover:text-foreground"
          aria-label={isOpen ? "Collapse" : "Expand"}
        >
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: accent, opacity: isUngrouped ? 0.4 : 1 }}
        />
        <button
          type="button"
          onClick={onSelectGroup}
          className={`flex-1 truncate text-left font-medium tracking-tight ${
            isUngrouped ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {isUngrouped ? "Ungrouped" : group!.label}
        </button>
        <span className="text-[10.5px] tabular-nums text-muted-foreground">
          {fields.length}
        </span>
      </div>
      {isOpen && (
        <ul className="ml-5 mt-0.5 space-y-px border-l border-border/30 pl-1">
          {fields.map((f) => {
            const meta = FIELD_TYPE_META[f.type];
            const Icon = meta?.icon;
            const sel = selectedFieldId === f.id;
            return (
              <li key={f.id}>
                <button
                  type="button"
                  onClick={() => onSelectField(f.id)}
                  className={`flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] transition-colors ${
                    sel
                      ? "bg-[color:var(--row-selected)] text-foreground"
                      : "text-foreground/75 hover:bg-[color:var(--row-hover)] hover:text-foreground"
                  }`}
                >
                  {Icon && <Icon className="h-3 w-3 shrink-0 opacity-70" />}
                  <span className="truncate">{f.label}</span>
                  <span className="ml-auto truncate font-mono text-[10px] opacity-50">
                    {f.name}
                  </span>
                </button>
              </li>
            );
          })}
          {fields.length === 0 && (
            <li className="px-2 py-1 text-[11px] text-muted-foreground/70">
              No fields
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
