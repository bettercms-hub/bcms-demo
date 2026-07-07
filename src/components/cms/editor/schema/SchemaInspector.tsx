/**
 * SchemaInspector — right pane.
 * Renders one of three modes based on selection:
 *   - schema   : metadata for the whole schema (collection/component info)
 *   - group    : group editing (rename, color, description, member fields)
 *   - field    : per-field tabbed config (General, Validation, Appearance, Advanced)
 */
import { useState } from "react";
import {
  AlignVerticalSpaceAround, Copy, Eye,
  EyeOff, Folder, Hash, KeyRound, Languages, Lock, MoreHorizontal, Settings2, Shuffle, Sliders,
  Sparkles, Trash2, Type as TypeIcon,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { schemaActions, useCMS } from "@/lib/cms/store";
import type { Schema, SchemaField, SchemaFieldGroup, SchemaFieldType } from "@/lib/cms/types";
import type { SchemaOwnerKind } from "@/lib/cms/center-bus";
import { CATEGORY_ACCENT, FIELD_TYPE_META } from "@/lib/cms/schema/field-meta";
import type { InspectorSelection } from "./SchemaWorkspace";
import { RelationshipPicker } from "./RelationshipsGraph";


type FieldTab = "general" | "validation" | "appearance" | "advanced";

interface Props {
  schema: Schema;
  selection: InspectorSelection;
  ownerKind: SchemaOwnerKind;
  ownerId: string;
  onSelectionClear: () => void;
}

export function SchemaInspector({ schema, selection, ownerKind, ownerId, onSelectionClear }: Props) {
  if (selection.kind === "field") {
    const field = schema.fields.find((f) => f.id === selection.id);
    if (!field) return <EmptyInspector message="Field was removed." onClear={onSelectionClear} />;
    return <FieldInspector schema={schema} field={field} />;
  }
  if (selection.kind === "group") {
    if (selection.id === null) return <UngroupedInspector schema={schema} />;
    const group = (schema.groups ?? []).find((g) => g.id === selection.id);
    if (!group) return <EmptyInspector message="Group was removed." onClear={onSelectionClear} />;
    return <GroupInspector schema={schema} group={group} />;
  }
  return <SchemaMetaInspector schema={schema} ownerKind={ownerKind} ownerId={ownerId} />;
}

function EmptyInspector({ message, onClear }: { message: string; onClear: () => void }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 bg-[color:var(--inspector)] p-6 text-center text-[12px] text-muted-foreground">
      <div>{message}</div>
      <button onClick={onClear} className="text-foreground underline">Show schema overview</button>
    </div>
  );
}

/* ----------------------------- Field inspector ---------------------------- */

function FieldInspector({ schema, field }: { schema: Schema; field: SchemaField }) {
  const [tab, setTab] = useState<FieldTab>("general");
  const meta = FIELD_TYPE_META[field.type];
  const Icon = meta?.icon;
  const accent = meta ? CATEGORY_ACCENT[meta.category] : "var(--accent-content)";

  return (
    <div className="flex h-full flex-col bg-[color:var(--inspector)]">
      {/* Header */}
      <div className="flex items-center gap-2.5 bg-[color:var(--panel)] px-4 py-3">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px]"
          style={{
            background: `color-mix(in srgb, ${accent} 14%, transparent)`,
            color: `color-mix(in srgb, ${accent} 85%, var(--color-foreground))`,
          }}
        >
          {Icon && <Icon className="h-3.5 w-3.5" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
            {meta?.label ?? field.type}
          </div>
          <input
            value={field.label}
            onChange={(e) => schemaActions.updateField(schema.id, field.id, { label: e.target.value })}
            className="-mx-1 w-[calc(100%+0.5rem)] rounded border border-transparent bg-transparent px-1 text-[14px] font-semibold tracking-tight focus:border-primary/40 focus:outline-none"
          />
        </div>
        <FieldActionsMenu schema={schema} field={field} />
      </div>

      {/* Live preview chip */}
      <div className="border-y border-[color:var(--border-hairline,var(--border))] bg-[color:var(--canvas)] px-4 py-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Live preview</span>
          <span className="font-mono text-[10px] text-muted-foreground/80">{field.name || "—"}</span>
        </div>
        <FieldPreviewChip field={field} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0.5 bg-[color:var(--panel)] px-3">
        {(["general", "validation", "appearance", "advanced"] as FieldTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`relative inline-flex h-8 items-center px-2 text-[11px] font-medium uppercase tracking-[0.06em] transition-colors ${
              tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t}
            {tab === t && <span className="absolute bottom-0 left-2 right-2 h-px bg-foreground" />}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {tab === "general" && <GeneralTab schema={schema} field={field} />}
        {tab === "validation" && <ValidationTab schema={schema} field={field} />}
        {tab === "appearance" && <AppearanceTab schema={schema} field={field} />}
        {tab === "advanced" && <AdvancedTab schema={schema} field={field} />}
      </div>
    </div>
  );
}

/* --------------------------- Field actions menu --------------------------- */

/** Type families that share a storage shape — safe to convert between. */
const CONVERT_FAMILIES: SchemaFieldType[][] = [
  ["text", "richText", "url", "email"],
  ["number"],
  ["date"],
  ["color"],
  ["image", "file"],
  ["json", "code"],
  ["boolean"],
  ["select"],
];

function compatibleTypes(t: SchemaFieldType): SchemaFieldType[] {
  const fam = CONVERT_FAMILIES.find((f) => f.includes(t)) ?? [t];
  return fam.filter((x) => x !== t);
}

function FieldActionsMenu({ schema, field }: { schema: Schema; field: SchemaField }) {
  const alts = compatibleTypes(field.type);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Field actions"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--row-hover,rgba(0,0,0,0.04))] hover:text-foreground"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
          Field
        </DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => schemaActions.duplicateField(schema.id, field.id)}>
          <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={alts.length === 0}>
            <Shuffle className="mr-2 h-3.5 w-3.5" /> Convert type
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-44">
            {alts.length === 0 ? (
              <DropdownMenuItem disabled>No compatible types</DropdownMenuItem>
            ) : alts.map((t) => {
              const m = FIELD_TYPE_META[t];
              const TIcon = m?.icon;
              return (
                <DropdownMenuItem
                  key={t}
                  onSelect={() => schemaActions.updateField(schema.id, field.id, { type: t })}
                >
                  {TIcon && <TIcon className="mr-2 h-3.5 w-3.5" />} {m?.label ?? t}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={() => schemaActions.removeField(schema.id, field.id)}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete field
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* ----------------------------- Preview chip ------------------------------- */

function FieldPreviewChip({ field }: { field: SchemaField }) {
  const label = field.label || "Untitled";
  const placeholder = field.placeholder || `Enter ${label.toLowerCase()}…`;
  const baseInput =
    "h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[12px] text-foreground/90 placeholder:text-muted-foreground/70";

  let control: React.ReactNode;
  switch (field.type) {
    case "boolean":
      control = (
        <div className="flex items-center gap-2">
          <span className="relative h-4 w-7 rounded-full bg-primary">
            <span className="absolute top-0.5 left-0.5 h-3 w-3 translate-x-3.5 rounded-full bg-background" />
          </span>
          <span className="text-[12px] text-muted-foreground">Off / On</span>
        </div>
      );
      break;
    case "richText":
      control = <div className={`${baseInput} h-16 py-1.5`}>{placeholder}</div>;
      break;
    case "number":
      control = <input className={baseInput} placeholder="0" readOnly />;
      break;
    case "date":
      control = <input className={baseInput} placeholder="YYYY-MM-DD" readOnly />;
      break;
    case "color":
      control = (
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-md border border-border/60" style={{ background: "var(--primary)" }} />
          <input className={baseInput} placeholder="#3b82f6" readOnly />
        </div>
      );
      break;
    case "select": {
      const opts = (field.options ?? []).slice(0, 4);
      if (field.ui === "chips" || field.ui === "segmented") {
        control = (
          <div className="flex flex-wrap gap-1">
            {(opts.length ? opts : ["Option"]).map((o) => (
              <span key={o} className="rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px]">
                {(field.optionLabels ?? {})[o] ?? o}
              </span>
            ))}
          </div>
        );
      } else {
        control = (
          <div className={`${baseInput} flex items-center justify-between`}>
            <span>{opts[0] ?? "Choose…"}</span>
            <span className="text-muted-foreground">▾</span>
          </div>
        );
      }
      break;
    }
    case "image":
    case "file":
      control = (
        <div className="flex h-16 items-center justify-center rounded-md border border-dashed border-border/60 bg-background text-[11px] text-muted-foreground">
          {field.type === "image" ? "Drop image or browse" : "Choose file"}
        </div>
      );
      break;
    case "reference":
      control = <div className={`${baseInput} flex items-center justify-between`}><span>Pick entry…</span><span className="text-muted-foreground">↗</span></div>;
      break;
    case "multiReference":
      control = (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px]">Entry A</span>
          <span className="rounded-md border border-border/60 bg-background px-2 py-0.5 text-[11px]">Entry B</span>
          <span className="rounded-md border border-dashed border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">+ add</span>
        </div>
      );
      break;
    case "componentRef":
      control = (
        <div className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-[11px] text-muted-foreground">
          Embedded component preview
        </div>
      );
      break;
    case "json":
    case "code":
      control = (
        <pre className="rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
{field.type === "json" ? "{ }" : "// code"}
        </pre>
      );
      break;
    default:
      control = <input className={baseInput} placeholder={placeholder} readOnly />;
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-foreground/90">
        {label}
        {field.required && <span className="text-destructive">*</span>}
      </div>
      {control}
      {field.description && (
        <div className="mt-1 text-[10.5px] text-muted-foreground">{field.description}</div>
      )}
    </div>
  );
}


function GeneralTab({ schema, field }: { schema: Schema; field: SchemaField }) {
  const ownerName = useCMS((s) => {
    const list = schema.ownerType === "collection" ? s.collections : s.components;
    return list.find((o) => o.id === schema.ownerId)?.name ?? "Schema";
  });
  const isTitle = schema.titleFieldName === field.name;
  const inList = (schema.listFieldNames ?? []).includes(field.name);

  return (
    <div className="space-y-4">
      <Group title="Identity">
        <Row label="Label" icon={TypeIcon}>
          <Input
            value={field.label}
            onChange={(v) => schemaActions.updateField(schema.id, field.id, { label: v })}
          />
        </Row>
        <Row label="API name" icon={KeyRound}>
          <Input
            mono
            value={field.name}
            onChange={(v) => schemaActions.updateField(schema.id, field.id, { name: v.replace(/\s+/g, "_") })}
          />
        </Row>
        <Row label="Description">
          <Textarea
            value={field.description ?? ""}
            onChange={(v) => schemaActions.updateField(schema.id, field.id, { description: v })}
            placeholder="What is this field for?"
          />
        </Row>
        <Row label="Placeholder">
          <Input
            value={field.placeholder ?? ""}
            onChange={(v) => schemaActions.updateField(schema.id, field.id, { placeholder: v })}
          />
        </Row>
      </Group>

      <Group title="Behavior">
        <Row label="Group" icon={Folder}>
          <Select
            value={field.groupId ?? ""}
            onChange={(v) => schemaActions.setFieldGroup(schema.id, field.id, v || null)}
            options={[
              { value: "", label: "Ungrouped" },
              ...(schema.groups ?? []).map((g) => ({ value: g.id, label: g.label })),
            ]}
          />
        </Row>
        <SwitchRow
          icon={AlignVerticalSpaceAround}
          label="Required"
          desc="Must have a value to save the entry."
          checked={!!field.required}
          onChange={(v) => schemaActions.updateField(schema.id, field.id, { required: v })}
        />
        <SwitchRow
          icon={Lock}
          label="Unique"
          desc="Reject duplicate values across all entries."
          checked={!!field.unique}
          onChange={(v) => schemaActions.updateField(schema.id, field.id, { unique: v })}
        />
        <SwitchRow
          icon={Languages}
          label="Localized"
          desc="Different value per locale."
          checked={!!field.localized}
          onChange={(v) => schemaActions.updateField(schema.id, field.id, { localized: v })}
        />
      </Group>

      <Group title="Listing">
        <SwitchRow
          icon={Sparkles}
          label="Title field"
          desc="Use this field as the entry title in lists."
          checked={isTitle}
          onChange={() => schemaActions.setTitleField(schema.id, field.name)}
        />
        <SwitchRow
          icon={Eye}
          label="Show in list"
          desc="Add as a column on the collection table."
          checked={inList}
          onChange={(v) => schemaActions.setListField(schema.id, field.name, v)}
        />
      </Group>

      {(field.type === "reference" || field.type === "multiReference") && (
        <Group title="Reference">
          <RelationshipPicker
            schemaId={schema.id}
            field={field}
            kind="collection"
            sourceLabel={ownerName}
          />
        </Group>
      )}

      {field.type === "componentRef" && (
        <Group title="Component">
          <RelationshipPicker
            schemaId={schema.id}
            field={field}
            kind="component"
            sourceLabel={ownerName}
          />
        </Group>
      )}

      {field.type === "select" && (
        <Group title="Options">
          <Row label="Comma-separated">
            <Input
              value={(field.options ?? []).join(", ")}
              onChange={(v) => schemaActions.setFieldOptions(schema.id, field.id, v.split(",").map((s) => s.trim()).filter(Boolean))}
              placeholder="draft, review, published"
            />
          </Row>
        </Group>
      )}
    </div>
  );
}

function ValidationTab({ schema, field }: { schema: Schema; field: SchemaField }) {
  const v = field.validation ?? {};
  const setV = (patch: typeof v) => schemaActions.setFieldValidation(schema.id, field.id, { ...v, ...patch });

  const isTexty = field.type === "text" || field.type === "richText" || field.type === "url" || field.type === "email";
  const isNum = field.type === "number";

  return (
    <div className="space-y-4">
      <Group title="Required / Unique">
        <SwitchRow
          label="Required"
          checked={!!field.required}
          onChange={(c) => schemaActions.updateField(schema.id, field.id, { required: c })}
        />
        <SwitchRow
          label="Unique"
          checked={!!field.unique}
          onChange={(c) => schemaActions.updateField(schema.id, field.id, { unique: c })}
        />
      </Group>

      {isTexty && (
        <Group title="Length">
          <div className="flex gap-2">
            <NumberInput
              label="Min"
              value={v.minLength ?? ""}
              onChange={(n) => setV({ minLength: n })}
            />
            <NumberInput
              label="Max"
              value={v.maxLength ?? ""}
              onChange={(n) => setV({ maxLength: n })}
            />
          </div>
        </Group>
      )}

      {isNum && (
        <Group title="Value">
          <div className="flex gap-2">
            <NumberInput label="Min" value={v.min ?? ""} onChange={(n) => setV({ min: n })} />
            <NumberInput label="Max" value={v.max ?? ""} onChange={(n) => setV({ max: n })} />
          </div>
        </Group>
      )}

      {isTexty && (
        <Group title="Pattern">
          <Row label="Regex">
            <Input
              mono
              value={v.pattern ?? ""}
              onChange={(s) => setV({ pattern: s })}
              placeholder="^[a-z0-9-]+$"
            />
          </Row>
          <RegexTester pattern={v.pattern} />
        </Group>
      )}

      {(field.type === "image" || field.type === "file") && (
        <Group title="File restrictions">
          <div className="text-[12px] text-muted-foreground">
            Coming soon — accepted MIME types and max upload size.
          </div>
        </Group>
      )}

      {(field.type === "reference" || field.type === "multiReference") && (
        <Group title="Reference limits">
          <div className="text-[12px] text-muted-foreground">
            Coming soon — min / max referenced entries.
          </div>
        </Group>
      )}
    </div>
  );
}

function RegexTester({ pattern }: { pattern: string | undefined }) {
  const [test, setTest] = useState("");
  if (!pattern) return null;
  let matches = false;
  let error = "";
  try {
    matches = new RegExp(pattern).test(test);
  } catch (e) {
    error = (e as Error).message;
  }
  return (
    <div className="mt-1 space-y-1">
      <input
        value={test}
        onChange={(e) => setTest(e.target.value)}
        placeholder="Test a value…"
        className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-[12px] focus:border-primary/40 focus:outline-none"
      />
      <div className="text-[11px]">
        {error ? (
          <span className="text-destructive">Invalid regex: {error}</span>
        ) : test === "" ? (
          <span className="text-muted-foreground">Type to test.</span>
        ) : matches ? (
          <span className="text-emerald-500">Matches.</span>
        ) : (
          <span className="text-amber-500">No match.</span>
        )}
      </div>
    </div>
  );
}

function AppearanceTab({ schema, field }: { schema: Schema; field: SchemaField }) {
  const supportsUI = ["select", "boolean"].includes(field.type);
  return (
    <div className="space-y-4">
      <Group title="Control">
        <Row label="UI hint" icon={Sliders}>
          <Select
            value={field.ui ?? ""}
            onChange={(v) => schemaActions.updateField(schema.id, field.id, { ui: (v || undefined) as SchemaField["ui"] })}
            options={[
              { value: "", label: "Default" },
              { value: "segmented", label: "Segmented" },
              { value: "icons", label: "Icons" },
              { value: "chips", label: "Chips" },
              { value: "switch", label: "Switch" },
              { value: "stepper", label: "Stepper" },
              { value: "select", label: "Select" },
            ]}
          />
        </Row>
        {!supportsUI && (
          <div className="text-[11px] text-muted-foreground">
            UI hints have the most effect on select and boolean fields.
          </div>
        )}
      </Group>

      {field.type === "select" && (
        <Group title="Option labels">
          <div className="space-y-1.5">
            {(field.options ?? []).map((opt) => (
              <div key={opt} className="flex items-center gap-2">
                <span className="w-1/3 truncate font-mono text-[11px] text-muted-foreground">{opt}</span>
                <Input
                  value={(field.optionLabels ?? {})[opt] ?? ""}
                  onChange={(v) => schemaActions.updateField(schema.id, field.id, {
                    optionLabels: { ...(field.optionLabels ?? {}), [opt]: v },
                  })}
                  placeholder="Display label"
                />
              </div>
            ))}
            {(field.options ?? []).length === 0 && (
              <div className="text-[11px] text-muted-foreground">Add options in the General tab first.</div>
            )}
          </div>
        </Group>
      )}
    </div>
  );
}

function AdvancedTab({ schema, field }: { schema: Schema; field: SchemaField }) {
  return (
    <div className="space-y-4">
      <Group title="Metadata">
        <Meta label="Field ID" value={field.id} mono />
        <Meta label="Type" value={field.type} mono />
        <Meta label="Group ID" value={field.groupId ?? "—"} mono />
      </Group>
      <Group title="Visibility">
        <SwitchRow
          icon={EyeOff}
          label="Hidden in list"
          desc="Never show this field on the collection table."
          checked={!!field.hiddenInList}
          onChange={(v) => schemaActions.updateField(schema.id, field.id, { hiddenInList: v })}
        />
      </Group>
      <Group title="JSON">
        <pre className="max-h-[200px] overflow-auto rounded-md bg-[color:var(--canvas)] p-2 font-mono text-[10px] text-muted-foreground">
{JSON.stringify(field, null, 2)}
        </pre>
      </Group>
    </div>
  );
}

/* ----------------------------- Group inspector ---------------------------- */

function GroupInspector({ schema, group }: { schema: Schema; group: SchemaFieldGroup }) {
  const count = schema.fields.filter((f) => f.groupId === group.id).length;
  return (
    <div className="flex h-full flex-col bg-[color:var(--inspector)]">
      <div className="flex items-center gap-2.5 bg-[color:var(--panel)] px-4 py-3">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: group.color ?? "var(--primary)" }} />
        <div className="min-w-0 flex-1">
          <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Group</div>
          <input
            value={group.label}
            onChange={(e) => schemaActions.renameGroup(schema.id, group.id, e.target.value)}
            className="w-full bg-transparent text-[14px] font-semibold tracking-tight focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Group title="Details">
          <Row label="Description">
            <Textarea
              value={group.description ?? ""}
              onChange={(v) => schemaActions.updateGroup(schema.id, group.id, { description: v })}
              placeholder="What lives in this group?"
            />
          </Row>
        </Group>


        <Group title="Color">
          <div className="flex flex-wrap gap-1.5">
            {["var(--primary)", "#f97316", "#22c55e", "#06b6d4", "#a855f7", "#f43f5e", "#eab308"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => schemaActions.setGroupColor(schema.id, group.id, c)}
                className={`h-5 w-5 rounded-full ring-1 transition-all ${group.color === c ? "ring-foreground" : "ring-border hover:ring-foreground/60"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        </Group>

        <Group title="Contents">
          <Meta label="Fields" value={String(count)} />
        </Group>

        <button
          type="button"
          onClick={() => schemaActions.removeGroup(schema.id, group.id)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/10 px-2.5 text-[12px] font-medium text-destructive hover:bg-destructive/20"
        >
          Delete group
        </button>
      </div>
    </div>
  );
}

function UngroupedInspector({ schema }: { schema: Schema }) {
  const count = schema.fields.filter((f) => !f.groupId || !schema.groups?.some((g) => g.id === f.groupId)).length;
  return (
    <div className="flex h-full flex-col bg-[color:var(--inspector)]">
      <div className="bg-[color:var(--panel)] px-4 py-3">
        <div className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground">Group</div>
        <div className="text-[14px] font-semibold tracking-tight">Ungrouped</div>
      </div>
      <div className="px-4 py-4 space-y-3 text-[12px] text-muted-foreground">
        <p>Fields that don't belong to a group land here. Move them into a named group to organize large schemas.</p>
        <Meta label="Fields" value={String(count)} />
      </div>
    </div>
  );
}

/* ----------------------------- Schema inspector --------------------------- */

function SchemaMetaInspector({ schema, ownerKind, ownerId }: { schema: Schema; ownerKind: SchemaOwnerKind; ownerId: string }) {
  const owner = useCMS((s) =>
    ownerKind === "collection"
      ? s.collections.find((c) => c.id === ownerId)
      : s.components.find((c) => c.id === ownerId),
  );
  return (
    <div className="flex h-full flex-col bg-[color:var(--inspector)]">
      <div className="flex items-center gap-2 bg-[color:var(--panel)] px-4 py-3">
        <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
        <div className="text-[14px] font-semibold tracking-tight">Schema metadata</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Group title="Identity">
          <Meta label="Schema ID" value={schema.id} mono />
          <Meta label="Owner" value={ownerKind} />
          <Meta label="Owner ID" value={ownerId} mono />
          <Meta label="Owner name" value={(owner as { name?: string } | undefined)?.name ?? "—"} />
        </Group>
        <Group title="Counts">
          <Meta label="Fields" value={String(schema.fields.length)} />
          <Meta label="Groups" value={String(schema.groups?.length ?? 0)} />
          <Meta label="Title field" value={schema.titleFieldName ?? "—"} mono />
          <Meta label="List fields" value={(schema.listFieldNames ?? []).join(", ") || "—"} mono />
        </Group>
        <Group title="API">
          <Meta
            label="REST endpoint"
            value={ownerKind === "collection" ? `/api/${ownerId}` : `/api/components/${ownerId}`}
            mono
          />
          <div className="text-[11px] text-muted-foreground">
            Open the API preview from the toolbar to inspect the JSON shape.
          </div>
        </Group>
        <Group title="Permissions">
          <div className="text-[12px] text-muted-foreground">Coming soon — role-based per-field access.</div>
        </Group>
      </div>
    </div>
  );
}

/* ------------------------------- Primitives ------------------------------- */

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Hash className="h-2.5 w-2.5 opacity-60" />
        {title}
      </div>
      <div className="space-y-2.5 rounded-lg bg-[color:var(--panel)]/40 p-3">{children}</div>
    </section>
  );
}

function Row({ label, icon: Icon, children }: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {Icon && <Icon className="h-2.5 w-2.5" />} {label}
      </div>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder, mono }: {
  value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-8 w-full rounded-md border border-border/50 bg-background px-2 text-[12px] focus:border-primary/40 focus:outline-none ${mono ? "font-mono" : ""}`}
    />
  );
}

function Textarea({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="min-h-[60px] w-full resize-y rounded-md border border-border/50 bg-background px-2 py-1.5 text-[12px] focus:border-primary/40 focus:outline-none"
    />
  );
}

function Select({ value, onChange, options }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 w-full rounded-md border border-border/50 bg-background px-2 text-[12px] focus:border-primary/40 focus:outline-none"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function NumberInput({ label, value, onChange }: {
  label: string;
  value: number | "";
  onChange: (v: number | undefined) => void;
}) {
  return (
    <label className="flex-1">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
        className="h-8 w-full rounded-md border border-border/50 bg-background px-2 text-[12px] focus:border-primary/40 focus:outline-none"
      />
    </label>
  );
}

function SwitchRow({ icon: Icon, label, desc, checked, onChange }: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  desc?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      {Icon && <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-medium">{label}</div>
        {desc && <div className="text-[11px] text-muted-foreground">{desc}</div>}
      </div>
      <button
        type="button"
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${checked ? "bg-primary" : "bg-border"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-background transition-transform ${checked ? "translate-x-3.5" : "translate-x-0.5"}`}
        />
      </button>
    </label>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] uppercase tracking-[0.06em] text-muted-foreground">{label}</span>
      <span className={`truncate text-[12px] ${mono ? "font-mono text-muted-foreground" : ""}`}>{value}</span>
    </div>
  );
}
