/**
 * Schema builder — the developer surface for content models.
 *
 * Design intent (vs Prismic / Sanity / Contentful):
 * - Notion-style property rows with real drag physics: drag to reorder, drop
 *   INTO a group to nest, drop out to un-nest. Inline settings, no modal-hell.
 * - Webflow-style hideable "Editor preview" panel showing exactly what
 *   marketers and content editors will see for this model.
 * - Full-page template gallery for new models (no clunky modal): Blog post,
 *   Testimonial, Author, Case study, Glossary term, White paper, or blank.
 * - Color-coded field types and model kinds for fast scanning; API-first with
 *   the endpoint + live JSON one click away. Save / Save as draft on top.
 *
 * Developer and Admin only; other roles get a calm locked screen.
 */
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { createFileRoute } from "@tanstack/react-router";
import {
  AlignLeft,
  ArrowLeft,
  Boxes,
  Braces,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  CopyPlus,
  Database,
  Eye,
  File,
  FileJson,
  Folder,
  FolderPlus,
  GripVertical,
  Hash,
  Image as ImageIcon,
  LayoutTemplate,
  Link2,
  List,
  Lock,
  Mail,
  MoreHorizontal,
  Palette,
  Phone,
  Pilcrow,
  Plus,
  Save,
  Search,
  Settings2,
  Slash,
  Sparkles,
  ToggleLeft,
  Trash2,
  Type,
  X,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";
import { SECTION_DEFS } from "@/components/cms/editor/sections/SectionSystem";
import {
  SCHEMA_TEMPLATES,
  cloneFieldDeep,
  countFields,
  extractFieldById,
  insertField,
  insertRelativeTo,
  isDescendant,
  mapField,
  modelActions,
  moveFieldById,
  newFieldId,
  newModelId,
  removeFieldById,
  toApiId,
  useModels,
  type FieldType,
  type ModelField,
  type ModelKind,
  type SchemaModel,
  type SchemaTemplate,
} from "@/lib/cms/schema-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/w/$workspace/p/$project/schema")({
  component: SchemaBuilder,
});

/* ------------------------------------------------------------- field meta */

const FIELD_TYPES: { type: FieldType; label: string; blurb: string; icon: LucideIcon; tint: string }[] = [
  { type: "text", label: "Text", blurb: "Short single-line text", icon: Type, tint: "bg-sky-50 text-sky-600" },
  { type: "longtext", label: "Long text", blurb: "Multi-line plain text", icon: AlignLeft, tint: "bg-blue-50 text-blue-600" },
  { type: "richtext", label: "Rich text", blurb: "Formatted text with links", icon: Pilcrow, tint: "bg-violet-50 text-violet-600" },
  { type: "slug", label: "Slug", blurb: "URL-safe identifier", icon: Slash, tint: "bg-slate-100 text-slate-600" },
  { type: "number", label: "Number", blurb: "Integer or decimal", icon: Hash, tint: "bg-amber-50 text-amber-600" },
  { type: "toggle", label: "Toggle", blurb: "True or false", icon: ToggleLeft, tint: "bg-emerald-50 text-emerald-600" },
  { type: "date", label: "Date", blurb: "Date and time", icon: CalendarDays, tint: "bg-teal-50 text-teal-600" },
  { type: "image", label: "Image", blurb: "Asset from the media library", icon: ImageIcon, tint: "bg-pink-50 text-pink-600" },
  { type: "file", label: "File", blurb: "PDF or any downloadable asset", icon: File, tint: "bg-stone-100 text-stone-600" },
  { type: "link", label: "Link", blurb: "URL or internal page", icon: Link2, tint: "bg-cyan-50 text-cyan-600" },
  { type: "email", label: "Email", blurb: "Validated email address", icon: Mail, tint: "bg-rose-50 text-rose-600" },
  { type: "phone", label: "Phone", blurb: "Validated phone number", icon: Phone, tint: "bg-green-50 text-green-600" },
  { type: "select", label: "Select", blurb: "One value from a fixed list", icon: List, tint: "bg-purple-50 text-purple-600" },
  { type: "reference", label: "Reference", blurb: "Links to one entry in a collection", icon: Database, tint: "bg-indigo-50 text-indigo-600" },
  { type: "multireference", label: "Multi-reference", blurb: "Links to many entries in a collection", icon: Boxes, tint: "bg-indigo-100 text-indigo-700" },
  { type: "color", label: "Color", blurb: "Hex color value", icon: Palette, tint: "bg-red-50 text-red-600" },
  { type: "json", label: "JSON", blurb: "Raw structured data", icon: FileJson, tint: "bg-zinc-100 text-zinc-600" },
  { type: "group", label: "Group", blurb: "Nest related fields together", icon: Folder, tint: "bg-orange-50 text-orange-600" },
  { type: "sections", label: "Section zone", blurb: "Which sections marketers can compose with", icon: LayoutTemplate, tint: "bg-fuchsia-50 text-fuchsia-600" },
];
const typeMeta = (t: FieldType) => FIELD_TYPES.find((x) => x.type === t)!;

const KIND_META: Record<ModelKind, { label: string; plural: string; blurb: string; icon: LucideIcon; tint: string }> = {
  page: { label: "Page type", plural: "Page types", blurb: "A routed page with fixed fields and a section zone", icon: LayoutTemplate, tint: "bg-fuchsia-50 text-fuchsia-600" },
  collection: { label: "Collection", plural: "Collections", blurb: "Repeatable entries served over the API", icon: Database, tint: "bg-sky-50 text-sky-600" },
  block: { label: "Block", plural: "Blocks", blurb: "A reusable group of fields embedded in other models", icon: Braces, tint: "bg-amber-50 text-amber-600" },
};

type DropSpot = { id: string; pos: "before" | "after" | "inside" };

/* ------------------------------------------------------------------ route */

function SchemaBuilder() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const { effective } = useEffectiveRole(workspace);
  const models = useModels(pr.id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [panel, setPanel] = useState<"preview" | "json" | null>(null);
  const [creating, setCreating] = useState(false);
  const [dirty, setDirty] = useState<Set<string>>(new Set());
  const [drafts, setDrafts] = useState<Set<string>>(new Set());

  const model = models.find((m) => m.id === selectedId) ?? models[0];

  function markDirty(id: string) {
    setDirty((s) => new Set(s).add(id));
  }
  function save(id: string, asDraft: boolean) {
    setDirty((s) => {
      const n = new Set(s);
      n.delete(id);
      return n;
    });
    setDrafts((s) => {
      const n = new Set(s);
      if (asDraft) n.add(id);
      else n.delete(id);
      return n;
    });
    toast.success(asDraft ? "Saved as draft. Not live on the API yet." : "Schema saved. Live on the content API.");
  }

  if (!canSeeDeveloper(effective)) {
    return (
      <div className="grid flex-1 place-items-center p-8">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-[color:var(--s2)] text-muted-foreground">
            <Lock className="h-5 w-5" />
          </span>
          <h2 className="mt-3 text-[15px] font-semibold text-foreground">Schema is a developer surface</h2>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
            Content models are managed by Developers and Admins. You can edit content and pages without touching schema.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      {/* models rail */}
      <div className="flex w-60 shrink-0 flex-col border-r border-border bg-background">
        <div className="flex items-center justify-between px-3 pb-1 pt-3">
          <span className="text-[12.5px] font-semibold text-foreground">Models</span>
          <button
            type="button"
            onClick={() => setCreating(true)}
            title="New model"
            aria-label="New model"
            className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {(Object.keys(KIND_META) as ModelKind[]).map((kind) => {
            const items = models.filter((m) => m.kind === kind);
            if (items.length === 0) return null;
            return (
              <div key={kind} className="mt-3">
                <div className="px-1.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {KIND_META[kind].plural}
                </div>
                {items.map((m) => {
                  const Icon = KIND_META[m.kind].icon;
                  const active = m.id === model?.id && !creating;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setSelectedId(m.id);
                        setCreating(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors",
                        active ? "bg-[color:var(--s2)]" : "hover:bg-[color:var(--color-row-hover)]",
                      )}
                    >
                      <span className={cn("grid h-5 w-5 shrink-0 place-items-center rounded", KIND_META[m.kind].tint)}>
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className={cn("flex-1 truncate text-[12.5px]", active ? "font-medium text-foreground" : "text-foreground/80")}>
                        {m.name}
                      </span>
                      {dirty.has(m.id) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" />}
                      <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">{countFields(m.fields)}</span>
                    </button>
                  );
                })}
              </div>
            );
          })}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[12.5px] font-medium text-primary transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Plus className="h-3.5 w-3.5" /> New model
          </button>
        </div>
        <div className="border-t border-[color:var(--border-hairline)] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
            <Code2 className="h-3.5 w-3.5 text-primary" /> API first
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
            Models can also be defined in code. The builder and the API write the same JSON.
          </p>
        </div>
      </div>

      {/* main pane */}
      {model ? (
        <ModelEditor
          key={model.id}
          projectId={pr.id}
          model={model}
          models={models}
          panel={panel}
          onPanel={setPanel}
          isDirty={dirty.has(model.id)}
          isDraft={drafts.has(model.id)}
          onDirty={() => markDirty(model.id)}
          onSave={(asDraft) => save(model.id, asDraft)}
          onDeleted={() => setSelectedId(null)}
        />
      ) : (
        <div className="grid flex-1 place-items-center">
          <div className="text-center">
            <p className="text-[13.5px] font-semibold text-foreground">No models yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Create your first content model.</p>
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[12.5px] font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]"
            >
              <Plus className="h-3.5 w-3.5" /> New model
            </button>
          </div>
        </div>
      )}

      {/* right panels */}
      {panel === "json" && model && <JsonPanel model={model} models={models} onClose={() => setPanel(null)} />}
      {panel === "preview" && model && <PreviewPanel model={model} models={models} onClose={() => setPanel(null)} />}

      {creating && (
        <NewModelDialog
          onClose={() => setCreating(false)}
          onCreate={(kind, name, fields) => {
            const m: SchemaModel = { id: newModelId(), kind, name, apiId: toApiId(name), fields, updatedAt: Date.now() };
            modelActions.add(pr.id, m);
            setSelectedId(m.id);
            setCreating(false);
            toast.success(`${KIND_META[kind].label} "${name}" created`);
          }}
        />
      )}
    </div>
  );
}

/* ----------------------------------------------------------- model editor */

function ModelEditor({
  projectId,
  model,
  models,
  panel,
  onPanel,
  isDirty,
  isDraft,
  onDirty,
  onSave,
  onDeleted,
}: {
  projectId: string;
  model: SchemaModel;
  models: SchemaModel[];
  panel: "preview" | "json" | null;
  onPanel: (p: "preview" | "json" | null) => void;
  isDirty: boolean;
  isDraft: boolean;
  onDirty: () => void;
  onSave: (asDraft: boolean) => void;
  onDeleted: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pickerFor, setPickerFor] = useState<string | null | false>(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropSpot | null>(null);
  const [groupModal, setGroupModal] = useState(false);
  const kind = KIND_META[model.kind];

  function addGroup(name: string, description: string) {
    const flat = JSON.stringify(model.fields);
    let label = name.trim();
    let n = 2;
    while (flat.includes(`"label":"${label}"`)) label = `${name.trim()} ${n++}`;
    const field: ModelField = {
      id: newFieldId(),
      label,
      apiId: toApiId(label),
      type: "group",
      help: description.trim() || undefined,
      fields: [],
    };
    patch((m) => ({ ...m, fields: [...m.fields, field] }));
    setGroupModal(false);
    setExpandedId(field.id);
    toast.success(`Group "${label}" added`);
  }

  const patch = (fn: (m: SchemaModel) => SchemaModel) => {
    modelActions.update(projectId, model.id, fn);
    onDirty();
  };

  function addField(type: FieldType, groupId: string | null) {
    const meta = typeMeta(type);
    const flat = JSON.stringify(model.fields);
    let label = meta.label;
    let n = 2;
    while (flat.includes(`"label":"${label}"`)) label = `${meta.label} ${n++}`;
    const field: ModelField = {
      id: newFieldId(),
      label,
      apiId: toApiId(label),
      type,
      ...(type === "select" ? { options: ["Option A", "Option B"] } : {}),
      ...(type === "group" ? { fields: [] } : {}),
      ...(type === "sections" ? { allowedSections: SECTION_DEFS.map((s) => s.type) } : {}),
    };
    patch((m) => ({ ...m, fields: insertField(m.fields, groupId, field) }));
    setPickerFor(false);
    setExpandedId(field.id);
  }

  function performDrop(target: DropSpot) {
    if (!dragId || dragId === target.id) return;
    const dragged = findField(model.fields, dragId);
    const targetField = findField(model.fields, target.id);
    if (!dragged || !targetField) return;
    // No dropping a group into its own subtree; groups and section zones stay top level.
    if (isDescendant(dragged, target.id)) return;
    if (target.pos === "inside" && (dragged.type === "group" || dragged.type === "sections")) return;
    patch((m) => {
      const { rest, found } = extractFieldById(m.fields, dragId);
      if (!found) return m;
      return { ...m, fields: insertRelativeTo(rest, target.id, target.pos, found) };
    });
  }

  const endpoint = `api.bettercms.site/v1/content/${model.apiId}`;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[760px] px-8 py-8">
        {/* header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium", kind.tint)}>
            <kind.icon className="h-3 w-3" /> {kind.label}
          </span>
          <span className="text-[11px] text-muted-foreground">{countFields(model.fields)} fields</span>

          <div className="ml-auto flex items-center gap-1.5">
            {/* save state */}
            <span className="hidden items-center gap-1.5 pr-1 text-[11.5px] sm:inline-flex">
              {isDirty ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="text-amber-600">Unsaved changes</span>
                </>
              ) : isDraft ? (
                <>
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
                  <span className="text-muted-foreground">Draft</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                  <span className="text-muted-foreground">Saved</span>
                </>
              )}
            </span>
            <div className="flex items-center">
              <button
                type="button"
                onClick={() => onSave(false)}
                disabled={!isDirty && !isDraft}
                className="inline-flex h-7 items-center gap-1.5 rounded-l-md bg-primary px-2.5 text-[11.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" /> Save
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label="Save options"
                    disabled={!isDirty}
                    className="grid h-7 w-6 place-items-center rounded-r-md border-l border-white/25 bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-[160px]">
                  <DropdownMenuItem className="text-[12.5px]" onSelect={() => onSave(true)}>
                    Save as draft
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <PanelBtn icon={Eye} label="Preview" active={panel === "preview"} onClick={() => onPanel(panel === "preview" ? null : "preview")} />
            <PanelBtn icon={Braces} label="JSON" active={panel === "json"} onClick={() => onPanel(panel === "json" ? null : "json")} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Model actions" className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--color-border)] text-muted-foreground transition-colors hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[170px]">
                <DropdownMenuItem
                  className="text-[13px]"
                  onSelect={() => {
                    const copy: SchemaModel = {
                      ...model,
                      id: newModelId(),
                      name: `${model.name} copy`,
                      apiId: `${model.apiId}Copy`,
                      fields: model.fields.map(cloneFieldDeep),
                      updatedAt: Date.now(),
                    };
                    modelActions.add(projectId, copy);
                    toast.success("Model duplicated");
                  }}
                >
                  <Copy className="mr-2 h-3.5 w-3.5" /> Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-[13px] text-destructive focus:text-destructive"
                  onSelect={() => {
                    modelActions.remove(projectId, model.id);
                    onDeleted();
                    toast.success(`“${model.name}” deleted`);
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete model
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <input
          value={model.name}
          onChange={(e) => patch((m) => ({ ...m, name: e.target.value }))}
          aria-label="Model name"
          className="mt-2 w-full bg-transparent text-[24px] font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/50"
          placeholder="Untitled model"
        />
        <input
          value={model.description ?? ""}
          onChange={(e) => patch((m) => ({ ...m, description: e.target.value }))}
          aria-label="Model description"
          placeholder="Add a description…"
          className="mt-0.5 w-full bg-transparent text-[13px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />

        {/* API bar */}
        <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-2.5 py-1.5">
          <span className="rounded bg-[color:var(--card)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-emerald-600">GET</span>
          <span className="truncate font-mono text-[11.5px] text-foreground">{endpoint}</span>
          <button
            type="button"
            title="Copy endpoint"
            onClick={() => {
              navigator.clipboard?.writeText(`https://${endpoint}`).catch(() => {});
              toast.success("Endpoint copied");
            }}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* fields header */}
        <div className="mt-5 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-foreground">Fields</span>
          <button
            type="button"
            onClick={() => setGroupModal(true)}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <FolderPlus className="h-3.5 w-3.5 text-muted-foreground" /> Add group
          </button>
        </div>

        {/* fields */}
        <div className="mt-2 overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
          {model.fields.length === 0 && (
            <div className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No fields yet. Add the first one below.</div>
          )}
          {model.fields.map((field, i) => (
            <FieldRow
              key={field.id}
              field={field}
              first={i === 0}
              last={i === model.fields.length - 1}
              depth={0}
              expandedId={expandedId}
              dragId={dragId}
              drop={drop}
              onDragStart={setDragId}
              onDragHover={setDrop}
              onDropAt={(t) => {
                performDrop(t);
                setDragId(null);
                setDrop(null);
              }}
              onDragDone={() => {
                setDragId(null);
                setDrop(null);
              }}
              onToggle={(id) => setExpandedId((cur) => (cur === id ? null : id))}
              onPatch={(id, fn) => patch((m) => ({ ...m, fields: mapField(m.fields, id, fn) }))}
              onRemove={(id) => {
                patch((m) => ({ ...m, fields: removeFieldById(m.fields, id) }));
                toast.success("Field removed");
              }}
              onMove={(id, dir) => patch((m) => ({ ...m, fields: moveFieldById(m.fields, id, dir) }))}
              onDuplicate={(id) => {
                const src = findField(model.fields, id);
                if (!src) return;
                const copy = cloneFieldDeep(src);
                copy.label = `${src.label} copy`;
                copy.apiId = toApiId(copy.label);
                patch((m) => ({ ...m, fields: insertRelativeTo(m.fields, id, "after", copy) }));
              }}
              onAddToGroup={(gid) => setPickerFor(gid)}
            />
          ))}

          {/* add field */}
          <div className="border-t border-[color:var(--border-hairline)]">
            {pickerFor !== false ? (
              <TypePicker
                groupName={typeof pickerFor === "string" ? (findField(model.fields, pickerFor)?.label ?? "group") : undefined}
                onPick={(t) => addField(t, typeof pickerFor === "string" ? pickerFor : null)}
                onClose={() => setPickerFor(false)}
              />
            ) : (
              <button
                type="button"
                onClick={() => setPickerFor(null)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left text-[12.5px] font-medium text-primary transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                <Plus className="h-3.5 w-3.5" /> Add field
              </button>
            )}
          </div>
        </div>

        <p className="mt-3 text-[11px] text-muted-foreground">
          Drag fields to reorder, or drop one onto a group to nest it. Click a field to edit its settings.
        </p>
      </div>

      {groupModal && <CreateGroupDialog onClose={() => setGroupModal(false)} onCreate={addGroup} />}
    </div>
  );
}

/* ---------------------------------------------------- create group dialog */

function CreateGroupDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (name: string, description: string) => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const canCreate = name.trim().length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Create group"
        className="relative w-full max-w-[440px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canCreate) onCreate(name, description);
        }}
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-50 text-indigo-600">
            <FolderPlus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">Create group</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Bundle related fields under one heading for editors.</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          <div>
            <label className="text-[12px] font-medium text-foreground">
              Group name <span className="text-primary">*</span>
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SEO and metadata"
              className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
            />
          </div>
          <div>
            <label className="text-[12px] font-medium text-foreground">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional. What belongs in this group?"
              className="mt-1.5 w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">Shown under the group heading to guide collaborators.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => onCreate(name, description)}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Create group
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PanelBtn({ icon: Icon, label, active, onClick }: { icon: LucideIcon; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-[11.5px] font-medium transition-colors",
        active
          ? "border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
          : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function findField(fields: ModelField[], id: string): ModelField | undefined {
  for (const f of fields) {
    if (f.id === id) return f;
    if (f.fields) {
      const hit = findField(f.fields, id);
      if (hit) return hit;
    }
  }
  return undefined;
}

/* -------------------------------------------------------------- field row */

function FieldRow({
  field,
  first,
  last,
  depth,
  expandedId,
  dragId,
  drop,
  onDragStart,
  onDragHover,
  onDropAt,
  onDragDone,
  onToggle,
  onPatch,
  onRemove,
  onMove,
  onDuplicate,
  onAddToGroup,
}: {
  field: ModelField;
  first: boolean;
  last: boolean;
  depth: number;
  expandedId: string | null;
  dragId: string | null;
  drop: DropSpot | null;
  onDragStart: (id: string | null) => void;
  onDragHover: (spot: DropSpot | null) => void;
  onDropAt: (spot: DropSpot) => void;
  onDragDone: () => void;
  onToggle: (id: string) => void;
  onPatch: (id: string, fn: (f: ModelField) => ModelField) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDuplicate: (id: string) => void;
  onAddToGroup: (groupId: string) => void;
}) {
  const meta = typeMeta(field.type);
  const expanded = expandedId === field.id;
  const isGroup = field.type === "group";
  const dragging = dragId === field.id;
  const dropHere = drop?.id === field.id ? drop : null;

  return (
    <div className={cn("relative", !first && depth === 0 && "border-t border-[color:var(--border-hairline)]")}>
      {/* drop indicators */}
      {dropHere?.pos === "before" && <div className="pointer-events-none absolute inset-x-2 top-0 z-10 h-[2px] rounded-full bg-primary" />}
      {dropHere?.pos === "after" && <div className="pointer-events-none absolute inset-x-2 bottom-0 z-10 h-[2px] rounded-full bg-primary" />}

      <div
        role="button"
        tabIndex={0}
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", field.id);
          onDragStart(field.id);
        }}
        onDragEnd={onDragDone}
        onDragOver={(e) => {
          if (!dragId || dragId === field.id) return;
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
          const r = e.currentTarget.getBoundingClientRect();
          const frac = (e.clientY - r.top) / r.height;
          const pos: DropSpot["pos"] = isGroup && frac > 0.3 && frac < 0.7 ? "inside" : frac < 0.5 ? "before" : "after";
          onDragHover({ id: field.id, pos });
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node) && drop?.id === field.id) onDragHover(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (dropHere) onDropAt(dropHere);
        }}
        onClick={() => onToggle(field.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle(field.id);
          }
        }}
        aria-expanded={expanded}
        className={cn(
          "group flex w-full cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]",
          dragging && "opacity-40",
          dropHere?.pos === "inside" && "bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)] ring-2 ring-inset ring-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]",
        )}
        style={{ paddingLeft: 12 + depth * 28 }}
      >
        <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" aria-hidden />
        <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", meta.tint)}>
          <meta.icon className="h-3.5 w-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-[13px] font-medium text-foreground">
            <span className="truncate">{field.label}</span>
            {field.required && <span className="text-primary" title="Required">*</span>}
          </span>
          <span className="block truncate font-mono text-[10.5px] text-muted-foreground">{field.apiId}</span>
        </span>
        <span className="hidden shrink-0 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground sm:inline">
          {meta.label}
        </span>
        <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <RowBtn label="Move up" disabled={first} onClick={(e) => { e.stopPropagation(); onMove(field.id, -1); }}>
            <ChevronDown className="h-3.5 w-3.5 rotate-180" />
          </RowBtn>
          <RowBtn label="Move down" disabled={last} onClick={(e) => { e.stopPropagation(); onMove(field.id, 1); }}>
            <ChevronDown className="h-3.5 w-3.5" />
          </RowBtn>
          <RowBtn label="Duplicate field" onClick={(e) => { e.stopPropagation(); onDuplicate(field.id); }}>
            <CopyPlus className="h-3.5 w-3.5" />
          </RowBtn>
          <RowBtn label="Field settings" onClick={(e) => { e.stopPropagation(); onToggle(field.id); }}>
            <Settings2 className="h-3.5 w-3.5" />
          </RowBtn>
          <RowBtn label="Delete field" danger onClick={(e) => { e.stopPropagation(); onRemove(field.id); }}>
            <Trash2 className="h-3.5 w-3.5" />
          </RowBtn>
        </span>
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform", expanded && "rotate-90")} />
      </div>

      {expanded && <FieldSettings field={field} depth={depth} onPatch={onPatch} />}

      {/* group children */}
      {isGroup && (
        <div className="border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40">
          {(field.fields ?? []).map((child, i) => (
            <FieldRow
              key={child.id}
              field={child}
              first={i === 0}
              last={i === (field.fields?.length ?? 0) - 1}
              depth={depth + 1}
              expandedId={expandedId}
              dragId={dragId}
              drop={drop}
              onDragStart={onDragStart}
              onDragHover={onDragHover}
              onDropAt={onDropAt}
              onDragDone={onDragDone}
              onToggle={onToggle}
              onPatch={onPatch}
              onRemove={onRemove}
              onMove={onMove}
              onDuplicate={onDuplicate}
              onAddToGroup={onAddToGroup}
            />
          ))}
          {(field.fields ?? []).length === 0 && (
            <div className="py-2 text-[11.5px] text-muted-foreground" style={{ paddingLeft: 12 + (depth + 1) * 28 }}>
              Empty group. Drop fields here or add one below.
            </div>
          )}
          <button
            type="button"
            onClick={() => onAddToGroup(field.id)}
            className="flex w-full items-center gap-2 py-2 text-left text-[12px] font-medium text-primary transition-colors hover:bg-[color:var(--color-row-hover)]"
            style={{ paddingLeft: 12 + (depth + 1) * 28 }}
          >
            <Plus className="h-3 w-3" /> Add field to {field.label}
          </button>
        </div>
      )}
    </div>
  );
}

function RowBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: (e: React.MouseEvent) => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid h-6 w-6 place-items-center rounded transition-colors disabled:cursor-not-allowed disabled:opacity-30",
        danger ? "text-rose-500 hover:bg-rose-50" : "text-muted-foreground hover:bg-[color:var(--s2)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/* --------------------------------------------------------- field settings */

function FieldSettings({
  field,
  depth,
  onPatch,
}: {
  field: ModelField;
  depth: number;
  onPatch: (id: string, fn: (f: ModelField) => ModelField) => void;
}) {
  const set = (patch: Partial<ModelField>) => onPatch(field.id, (f) => ({ ...f, ...patch }));

  return (
    <div className="border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/60 px-4 py-3.5" style={{ paddingLeft: 16 + depth * 28 }}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SettingsField label="Label">
          <input
            value={field.label}
            onChange={(e) => set({ label: e.target.value, apiId: toApiId(e.target.value) || field.apiId })}
            className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
          />
        </SettingsField>
        <SettingsField label="API ID" hint="Key in the API response.">
          <input
            value={field.apiId}
            onChange={(e) => set({ apiId: e.target.value.replace(/[^a-zA-Z0-9_]/g, "") })}
            className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 font-mono text-[12px] outline-none focus:border-[color:var(--primary)]"
          />
        </SettingsField>
        <SettingsField
          label={field.type === "group" ? "Description" : "Help text"}
          hint={field.type === "group" ? "Shown under the group heading." : "Shown to editors under the field."}
          className="sm:col-span-2"
        >
          <input
            value={field.help ?? ""}
            onChange={(e) => set({ help: e.target.value || undefined })}
            placeholder="Optional"
            className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
          />
        </SettingsField>

        {field.type === "select" && (
          <SettingsField label="Options" hint="Comma separated." className="sm:col-span-2">
            <input
              value={(field.options ?? []).join(", ")}
              onChange={(e) => set({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
              className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
            />
          </SettingsField>
        )}

        {(field.type === "reference" || field.type === "multireference") && (
          <RefTargetField field={field} set={set} />
        )}

        {field.type === "sections" && (
          <SettingsField label="Allowed sections" hint="Marketers can only add these to the page." className="sm:col-span-2">
            <div className="flex flex-wrap gap-1.5">
              {SECTION_DEFS.map((s) => {
                const on = (field.allowedSections ?? []).includes(s.type);
                return (
                  <button
                    key={s.type}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set({
                        allowedSections: on
                          ? (field.allowedSections ?? []).filter((t) => t !== s.type)
                          : [...(field.allowedSections ?? []), s.type],
                      })
                    }
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors",
                      on
                        ? "border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary"
                        : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {s.name}
                  </button>
                );
              })}
            </div>
          </SettingsField>
        )}

        {field.type !== "group" && field.type !== "sections" && (
          <label className="flex items-center gap-2 text-[12.5px] text-foreground">
            <button
              type="button"
              role="switch"
              aria-checked={!!field.required}
              onClick={() => set({ required: !field.required })}
              className={cn("relative h-5 w-9 rounded-full transition-colors", field.required ? "bg-primary" : "bg-[color:var(--s3)]")}
            >
              <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all", field.required ? "left-[18px]" : "left-0.5")} />
            </button>
            Required
          </label>
        )}
      </div>
    </div>
  );
}

function RefTargetField({ field, set }: { field: ModelField; set: (p: Partial<ModelField>) => void }) {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  const models = useModels(pr.id);
  const refTargets = models.filter((m) => m.kind === "collection");
  const many = field.type === "multireference";
  return (
    <SettingsField
      label="References"
      hint={many ? "Editors can link many entries from this collection." : "Editors link one entry from this collection."}
      className="sm:col-span-2"
    >
      <select
        value={field.refModelId ?? ""}
        onChange={(e) => set({ refModelId: e.target.value || undefined })}
        className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
      >
        <option value="">Choose a collection…</option>
        {refTargets.map((m) => (
          <option key={m.id} value={m.id}>{m.name}</option>
        ))}
      </select>
    </SettingsField>
  );
}

function SettingsField({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <div className="mb-1 text-[11.5px] font-medium text-foreground">{label}</div>
      {children}
      {hint && <div className="mt-0.5 text-[10.5px] text-muted-foreground">{hint}</div>}
    </label>
  );
}

/* ------------------------------------------------------------ type picker */

function TypePicker({ groupName, onPick, onClose }: { groupName?: string; onPick: (t: FieldType) => void; onClose: () => void }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const shown = FIELD_TYPES.filter(
    (t) =>
      !(groupName && (t.type === "group" || t.type === "sections")) &&
      (!query || t.label.toLowerCase().includes(query) || t.blurb.toLowerCase().includes(query)),
  );

  return (
    <div className="bg-[color:var(--s2)]/60 p-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "Enter" && shown[0]) onPick(shown[0].type);
            }}
            placeholder={groupName ? `Add a field to ${groupName}…` : "Choose a field type…"}
            aria-label="Search field types"
            className="h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] pl-8 pr-2 text-[12.5px] outline-none focus:border-[color:var(--primary)]"
          />
        </div>
        <button type="button" onClick={onClose} aria-label="Close field picker" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
        {shown.map((t) => (
          <button
            key={t.type}
            type="button"
            onClick={() => onPick(t.type)}
            className="flex items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 text-left transition-colors hover:border-[color:var(--color-border)] hover:bg-[color:var(--card)]"
          >
            <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-md", t.tint)}>
              <t.icon className="h-3.5 w-3.5" />
            </span>
            <span className="min-w-0">
              <span className="block text-[12.5px] font-medium text-foreground">{t.label}</span>
              <span className="block truncate text-[10.5px] text-muted-foreground">{t.blurb}</span>
            </span>
          </button>
        ))}
        {shown.length === 0 && <div className="col-span-2 px-2 py-3 text-center text-[12px] text-muted-foreground">No field types match.</div>}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------- editor preview */

/**
 * PreviewPanel — Webflow-style: exactly what marketers and content editors see
 * when they open an entry of this model. Hideable, purely visual.
 */
function PreviewPanel({ model, models, onClose }: { model: SchemaModel; models: SchemaModel[]; onClose: () => void }) {
  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border bg-background animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-3 py-2.5">
        <Eye className="h-3.5 w-3.5 text-primary" />
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] font-semibold text-foreground">Editor preview</div>
          <div className="truncate text-[10.5px] text-muted-foreground">What marketers and editors see</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Close preview" className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto bg-[color:var(--s2)]/50 p-3">
        <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-3.5">
          <div className="mb-3 border-b border-[color:var(--border-hairline)] pb-2">
            <div className="text-[13px] font-semibold text-foreground">New {model.name.toLowerCase()}</div>
            <div className="text-[10.5px] text-muted-foreground">Entry form generated from this schema</div>
          </div>
          <div className="space-y-3.5">
            {model.fields.map((f) => (
              <PreviewField key={f.id} field={f} models={models} />
            ))}
            {model.fields.length === 0 && <p className="py-4 text-center text-[11.5px] text-muted-foreground">Add fields to see the form.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

const previewInput = "h-8 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 text-[12px] text-muted-foreground outline-none";

function PreviewField({ field, models }: { field: ModelField; models: SchemaModel[] }) {
  const control = () => {
    switch (field.type) {
      case "text":
        return <input readOnly tabIndex={-1} placeholder={field.label} className={previewInput} />;
      case "slug":
        return (
          <div className={cn(previewInput, "flex items-center gap-1 font-mono")}>
            <span className="text-muted-foreground/70">/</span>
            <span className="text-muted-foreground/70">{toApiId(field.label)}</span>
          </div>
        );
      case "phone":
        return <input readOnly tabIndex={-1} placeholder="+1 555 0134" className={previewInput} />;
      case "email":
        return <input readOnly tabIndex={-1} placeholder="name@company.com" className={previewInput} />;
      case "longtext":
        return <textarea readOnly tabIndex={-1} rows={2} placeholder={field.label} className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 py-1.5 text-[12px] text-muted-foreground outline-none" />;
      case "richtext":
        return (
          <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)]">
            <div className="flex items-center gap-1 border-b border-[color:var(--border-hairline)] px-2 py-1 text-[10px] font-semibold text-muted-foreground">
              <span className="font-bold">B</span>
              <span className="italic">I</span>
              <span className="underline">U</span>
              <Link2 className="h-2.5 w-2.5" />
            </div>
            <div className="space-y-1 p-2">
              <div className="h-1.5 w-4/5 rounded bg-[color:var(--s2)]" />
              <div className="h-1.5 w-3/5 rounded bg-[color:var(--s2)]" />
            </div>
          </div>
        );
      case "number":
        return <input readOnly tabIndex={-1} placeholder="0" className={cn(previewInput, "w-24")} />;
      case "toggle":
        return (
          <span className="relative inline-block h-5 w-9 rounded-full bg-[color:var(--s3)]">
            <span className="absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm" />
          </span>
        );
      case "date":
        return (
          <div className={cn(previewInput, "flex items-center justify-between")}>
            <span>Jul 6, 2026</span>
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        );
      case "image":
        return (
          <div className="grid h-16 place-items-center rounded-md border border-dashed border-[color:var(--color-border)] bg-[color:var(--card)] text-muted-foreground">
            <span className="flex items-center gap-1.5 text-[11px]"><ImageIcon className="h-3.5 w-3.5" /> Choose from media library</span>
          </div>
        );
      case "file":
        return (
          <div className="flex items-center gap-1.5 rounded-md border border-dashed border-[color:var(--color-border)] bg-[color:var(--card)] px-2 py-2 text-[11px] text-muted-foreground">
            <File className="h-3.5 w-3.5" /> Upload a file
          </div>
        );
      case "link":
        return (
          <div className={cn(previewInput, "flex items-center gap-1.5")}>
            <Link2 className="h-3 w-3 text-muted-foreground/60" /> Paste a URL or pick a page
          </div>
        );
      case "select":
        return (
          <div className={cn(previewInput, "flex items-center justify-between")}>
            <span>{field.options?.[0] ?? "Choose…"}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
          </div>
        );
      case "reference": {
        const target = models.find((m) => m.id === field.refModelId);
        return (
          <div className={cn(previewInput, "flex items-center gap-1.5")}>
            <Search className="h-3 w-3 text-muted-foreground/60" /> Choose {target ? `a ${target.name.toLowerCase()}` : "an entry"}…
          </div>
        );
      }
      case "multireference": {
        const target = models.find((m) => m.id === field.refModelId);
        const noun = target ? target.name.toLowerCase() : "entries";
        return (
          <div className="flex min-h-8 flex-wrap items-center gap-1 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-1">
            {[1, 2].map((n) => (
              <span key={n} className="inline-flex items-center gap-1 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">
                {target ? `${target.name} ${n}` : `Entry ${n}`}
                <X className="h-2.5 w-2.5 text-indigo-400" />
              </span>
            ))}
            <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[11px] font-medium text-primary">
              <Plus className="h-3 w-3" /> Add {noun}
            </span>
          </div>
        );
      }
      case "color":
        return (
          <div className={cn(previewInput, "flex items-center gap-1.5 font-mono")}>
            <span className="h-3.5 w-3.5 rounded ring-1 ring-black/10" style={{ background: "#EF037F" }} /> #EF037F
          </div>
        );
      case "json":
        return <div className={cn(previewInput, "font-mono")}>{"{ }"}</div>;
      case "group":
        return (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)]/40 p-2.5">
            <div className="space-y-3">
              {(field.fields ?? []).map((c) => (
                <PreviewField key={c.id} field={c} models={models} />
              ))}
              {(field.fields ?? []).length === 0 && <p className="text-[10.5px] text-muted-foreground">Empty group</p>}
            </div>
          </div>
        );
      case "sections":
        return (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5">
            <div className="flex flex-wrap gap-1">
              {(field.allowedSections ?? []).map((t) => {
                const def = SECTION_DEFS.find((s) => s.type === t);
                return def ? (
                  <span key={t} className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{def.name}</span>
                ) : null;
              })}
            </div>
            <div className="mt-2 flex items-center justify-center gap-1 rounded-md border border-dashed border-[color:var(--color-border)] py-1.5 text-[10.5px] font-medium text-muted-foreground">
              <Plus className="h-3 w-3" /> Add section
            </div>
          </div>
        );
    }
  };

  const isGroup = field.type === "group";
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-[11.5px] font-medium text-foreground">
        {field.label}
        {field.required && <span className="text-primary">*</span>}
      </div>
      {isGroup && field.help && <p className="-mt-0.5 mb-1.5 text-[10px] text-muted-foreground">{field.help}</p>}
      {control()}
      {!isGroup && field.help && <p className="mt-0.5 text-[10px] text-muted-foreground">{field.help}</p>}
    </div>
  );
}

/* ------------------------------------------------------------- json panel */

function JsonPanel({ model, models, onClose }: { model: SchemaModel; models: SchemaModel[]; onClose: () => void }) {
  const json = useMemo(() => {
    const refApiId = (id?: string) => (id ? (models.find((m) => m.id === id)?.apiId ?? id) : undefined);
    const clean = (fs: ModelField[]): unknown[] =>
      fs.map((f) => ({
        id: f.apiId,
        label: f.label,
        type: f.type,
        ...(f.required ? { required: true } : {}),
        ...(f.help ? { help: f.help } : {}),
        ...(f.options ? { options: f.options } : {}),
        ...(f.refModelId ? { ref: refApiId(f.refModelId), many: f.type === "multireference" } : {}),
        ...(f.allowedSections ? { sections: f.allowedSections } : {}),
        ...(f.fields ? { fields: clean(f.fields) } : {}),
      }));
    return JSON.stringify({ id: model.apiId, name: model.name, kind: model.kind, fields: clean(model.fields) }, null, 2);
  }, [model, models]);

  return (
    <div className="flex w-[340px] shrink-0 flex-col border-l border-border bg-background animate-in slide-in-from-right-4 fade-in duration-200">
      <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-3 py-2.5">
        <Braces className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12.5px] font-semibold text-foreground">Model JSON</span>
        <button
          type="button"
          title="Copy JSON"
          onClick={() => {
            navigator.clipboard?.writeText(json).catch(() => {});
            toast.success("JSON copied");
          }}
          className="ml-auto grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <button type="button" onClick={onClose} aria-label="Close JSON" className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <pre className="min-h-0 flex-1 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-foreground/90">{json}</pre>
      <div className="border-t border-[color:var(--border-hairline)] px-3 py-2 text-[10.5px] text-muted-foreground">
        The same shape the Schema API accepts. PUT it back to update the model.
      </div>
    </div>
  );
}

/* -------------------------------------------------------- new model dialog */

type StartChoice = { mode: "blank" } | { mode: "template"; template: SchemaTemplate };

/**
 * NewModelDialog — a focused two-step modal. Step one picks a starting point
 * (blank or a template); step two names it and confirms. One decision per
 * screen, so the flow never dumps everything at once.
 */
function NewModelDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (kind: ModelKind, name: string, fields: ModelField[]) => void;
}) {
  const [choice, setChoice] = useState<StartChoice | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ModelKind>("collection");

  function pick(next: StartChoice) {
    setChoice(next);
    setName(next.mode === "template" ? next.template.name : "");
    if (next.mode === "template") setKind(next.template.kind);
  }
  function back() {
    setChoice(null);
  }
  function create() {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (choice?.mode === "template") onCreate(choice.template.kind, trimmed, choice.template.make());
    else onCreate(kind, trimmed, [{ id: newFieldId(), label: "Title", apiId: "title", type: "text", required: true }]);
  }

  const previewFields = choice?.mode === "template" ? choice.template.make() : [];

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-start justify-center overflow-y-auto p-4 sm:pt-[8vh]">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New model"
        className="relative w-full max-w-[500px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)] animate-in fade-in zoom-in-95 duration-150"
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {/* header */}
        <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-5 py-3.5">
          {choice && (
            <button
              type="button"
              aria-label="Back"
              onClick={back}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">
              {choice ? (choice.mode === "template" ? "Name your model" : "Name your model") : "New model"}
            </h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              {choice ? "You can change everything after it is created." : "Pick a starting point."}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* step one: choose */}
        {!choice && (
          <div className="max-h-[62vh] overflow-y-auto px-3 py-3">
            <button
              type="button"
              onClick={() => pick({ mode: "blank" })}
              className="flex w-full items-center gap-3 rounded-lg border border-[color:var(--color-border)] px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-muted-foreground">
                <Plus className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-medium text-foreground">Blank model</span>
                <span className="block text-[11.5px] text-muted-foreground">Start from scratch and add your own fields.</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>

            <div className="mt-3 flex items-center gap-1.5 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" /> Templates
            </div>
            <div className="mt-1.5 space-y-1">
              {SCHEMA_TEMPLATES.map((t) => {
                const km = KIND_META[t.kind];
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => pick({ mode: "template", template: t })}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
                  >
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", km.tint)}>
                      <km.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-foreground">{t.name}</span>
                      <span className="block truncate text-[11.5px] text-muted-foreground">{t.blurb}</span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* step two: configure */}
        {choice && (
          <div className="px-5 py-4">
            {/* what you picked */}
            <div className="flex items-center gap-2.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-3 py-2.5">
              <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md", KIND_META[kind].tint)}>
                {choice.mode === "template" ? (
                  (() => {
                    const KIcon = KIND_META[choice.template.kind].icon;
                    return <KIcon className="h-4 w-4" />;
                  })()
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-foreground">
                  {choice.mode === "template" ? choice.template.name : "Blank model"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {choice.mode === "template"
                    ? `${KIND_META[choice.template.kind].label} · ${previewFields.length} fields to start`
                    : "Choose a type below"}
                </div>
              </div>
            </div>

            {/* blank: kind picker */}
            {choice.mode === "blank" && (
              <div className="mt-4">
                <label className="text-[12px] font-medium text-foreground">Type</label>
                <div className="mt-1.5 grid grid-cols-3 gap-2">
                  {(Object.keys(KIND_META) as ModelKind[]).map((k) => {
                    const m = KIND_META[k];
                    const on = kind === k;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKind(k)}
                        aria-pressed={on}
                        className={cn(
                          "flex flex-col items-start gap-1.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                          on
                            ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                            : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]",
                        )}
                      >
                        <span className={cn("grid h-6 w-6 place-items-center rounded", m.tint)}>
                          <m.icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="flex items-center gap-1 text-[12px] font-medium text-foreground">
                          {m.label}
                          {on && <Check className="h-3 w-3 text-primary" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-[11px] text-muted-foreground">{KIND_META[kind].blurb}.</p>
              </div>
            )}

            {/* name */}
            <div className="mt-4">
              <label className="text-[12px] font-medium text-foreground">
                Name <span className="text-primary">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") create();
                }}
                placeholder={choice.mode === "template" ? choice.template.name : "e.g. Landing page"}
                className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
              />
              {name.trim() && (
                <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-mono text-emerald-600">GET</span>
                  <span className="font-mono">api.bettercms.site/v1/content/{toApiId(name)}</span>
                </p>
              )}
            </div>

            {/* template preview */}
            {choice.mode === "template" && (
              <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Starts with</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {previewFields.map((f) => {
                    const fm = typeMeta(f.type);
                    return (
                      <span
                        key={f.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2 py-1 text-[11px] text-foreground"
                      >
                        <span className={cn("grid h-4 w-4 place-items-center rounded", fm.tint)}>
                          <fm.icon className="h-2.5 w-2.5" />
                        </span>
                        {f.label}
                        {f.required && <span className="text-primary">*</span>}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* footer (step two only) */}
        {choice && (
          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
            <button
              type="button"
              onClick={back}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </button>
            <button
              type="button"
              disabled={!name.trim()}
              onClick={create}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" /> Create model
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
