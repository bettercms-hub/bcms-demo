import { useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  DragOverlay,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { ArrowLeft, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  getForm,
  updateForm,
  createField,
  updateField,
  deleteField,
  duplicateField,
  reorderFields,
  recordSubmission,
} from "@/lib/forms/forms.store";
import type { FormDetail, FormField, FieldKind } from "@/lib/forms/types";
import { formBuilderLink } from "@/lib/forms/nav";
import { FieldLibrary } from "./FieldLibrary";
import { FormCanvas } from "./FormCanvas";
import { FormInspector } from "./FormInspector";
import { FormPreviewDialog } from "./FormPreviewDialog";
import { SubmissionsPanel } from "./SubmissionsPanel";
import { IntegrationsPanel } from "./IntegrationsPanel";
import { CodePanel } from "./CodePanel";
import { fieldDef } from "./field-catalog";

type Tab = "build" | "submissions" | "integrations" | "code";

interface Props {
  formId: string;
  tab: Tab;
}

export function FormBuilder({ formId, tab }: Props) {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  const navigate = useNavigate();
  const qc = useQueryClient();
  const queryKey = useMemo(() => ["form-detail", formId], [formId]);

  const { data: form, isLoading, error, refetch } = useQuery<FormDetail>({
    queryKey,
    queryFn: () => getForm({ data: { formId } }),
    retry: false,
  });

  const updFormFn = updateForm;
  const createFn = createField;
  const updFn = updateField;
  const delFn = deleteField;
  const dupFn = duplicateField;
  const reorderFn = reorderFields;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeDrag, setActiveDrag] = useState<{ source: string; kind?: FieldKind } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const formMut = useMutation({
    mutationFn: (patch: Record<string, unknown>) => updFormFn({ data: { formId, patch } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      qc.invalidateQueries({ queryKey: ["forms-dashboard", project] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const fieldUpdateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Record<string, unknown> }) =>
      updFn({ data: { fieldId: id, patch } }),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData<FormDetail>(queryKey);
      if (prev) {
        qc.setQueryData<FormDetail>(queryKey, {
          ...prev,
          fields: prev.fields.map((f) =>
            f.id === id ? { ...f, ...patchToField(patch) } : f,
          ),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKey, ctx.prev);
      toast.error("Failed to save field");
    },
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  const createMut = useMutation({
    mutationFn: ({ kind, afterFieldId }: { kind: FieldKind; afterFieldId?: string | null }) =>
      createFn({ data: { formId, kind, afterFieldId: afterFieldId ?? null } }),
    onSuccess: (newField) => {
      qc.invalidateQueries({ queryKey });
      setSelectedId(newField.id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { fieldId: id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setSelectedId(null);
    },
  });

  const dupMut = useMutation({
    mutationFn: (id: string) => dupFn({ data: { fieldId: id } }),
    onSuccess: (f) => {
      qc.invalidateQueries({ queryKey });
      setSelectedId(f.id);
    },
  });

  const reorderMut = useMutation({
    mutationFn: (orderedIds: string[]) => reorderFn({ data: { formId, orderedIds } }),
    onSettled: () => qc.invalidateQueries({ queryKey }),
  });

  function handleDragStart(e: DragStartEvent) {
    const data = e.active.data.current as { source: string; kind?: FieldKind } | undefined;
    setActiveDrag(data ?? null);
  }

  function handleDragEnd(e: DragEndEvent) {
    setActiveDrag(null);
    if (!form) return;
    const { active, over } = e;
    if (!over) return;
    const aData = active.data.current as { source: string; kind?: FieldKind; fieldId?: string };
    const oData = over.data.current as { source: string; fieldId?: string } | undefined;

    if (aData.source === "library" && aData.kind) {
      // append, or insert after target field
      const afterFieldId = oData?.fieldId ?? null;
      createMut.mutate({ kind: aData.kind, afterFieldId });
      return;
    }
    if (aData.source === "canvas" && oData?.source === "canvas" && active.id !== over.id) {
      const oldIndex = form.fields.findIndex((f) => f.id === active.id);
      const newIndex = form.fields.findIndex((f) => f.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return;
      const next = arrayMove(form.fields, oldIndex, newIndex);
      qc.setQueryData<FormDetail>(queryKey, { ...form, fields: next.map((f, i) => ({ ...f, position: i })) });
      reorderMut.mutate(next.map((f) => f.id));
    }
  }

  function changeTab(next: Tab) {
    navigate(formBuilderLink({ workspace, project, formId, tab: next }));
  }

  if (isLoading) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[color:var(--canvas)]">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex h-full flex-1 items-center justify-center bg-[color:var(--canvas)] p-10">
        <div className="max-w-sm rounded-lg border border-dashed border-border bg-[color:var(--panel)] p-8 text-center">
          <h3 className="text-sm font-semibold text-foreground">Form not found</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {error?.message ?? "This form may have been deleted, or the link is incorrect."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
            <Button asChild size="sm" variant="ghost">
              <Link
                to="/w/$workspace/p/$project/forms"
                params={{ workspace, project }}
              >
                Back to forms
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const selectedField = form.fields.find((f) => f.id === selectedId) ?? null;
  const isPublished = form.status === "published";

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-[color:var(--canvas)]">
      {/* Toolbar */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/60 bg-[color:var(--panel)] px-3">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            to="/w/$workspace/p/$project/forms"
            params={{ workspace, project }}
            className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <input
            defaultValue={form.name}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== form.name) formMut.mutate({ name: v });
            }}
            className="min-w-0 max-w-[280px] truncate rounded border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground hover:border-border focus:border-border focus:outline-none"
          />
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
              isPublished
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {form.status}
          </span>
        </div>
        <div className="flex items-center gap-0.5 rounded-lg bg-[color:var(--surface-3)] p-1">
          {(["build", "submissions", "integrations", "code"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => changeTab(t)}
              className={`flex h-7 items-center rounded-md px-3.5 text-[12.5px] font-medium capitalize leading-none transition-colors ${
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPreviewOpen(true)}>
            <Eye className="mr-1.5 h-3.5 w-3.5" /> Preview
          </Button>
          <Button
            size="sm"
            variant={isPublished ? "secondary" : "default"}
            onClick={() =>
              formMut.mutate({ status: isPublished ? "draft" : "published" })
            }
          >
            {isPublished ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1">
        {tab === "build" ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="w-[240px] shrink-0">
              <FieldLibrary onAppend={(kind) => createMut.mutate({ kind, afterFieldId: selectedId })} />
            </div>
            <FormCanvas
              form={form}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onDuplicate={(id) => dupMut.mutate(id)}
              onDelete={(id) => delMut.mutate(id)}
            />
            <FormInspector
              form={form}
              selectedField={selectedField}
              onUpdateField={(id, patch) => fieldUpdateMut.mutate({ id, patch })}
              onUpdateForm={(patch) => formMut.mutate(patch)}
            />
            <DragOverlay>
              {activeDrag?.source === "library" && activeDrag.kind ? (
                <LibraryGhost kind={activeDrag.kind} />
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : tab === "submissions" ? (
          <SubmissionsPanel form={form} />
        ) : tab === "integrations" ? (
          <IntegrationsPanel form={form} />
        ) : (
          <CodePanel formId={formId} />
        )}
      </div>

      <FormPreviewDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        form={form}
        onSubmit={(values) => {
          recordSubmission({ data: { formId, data: values } });
          qc.invalidateQueries({ queryKey: ["submissions", formId] });
          qc.invalidateQueries({ queryKey: ["forms-dashboard", project] });
          toast.success("Test submission recorded");
        }}
      />
    </div>
  );
}

function LibraryGhost({ kind }: { kind: FieldKind }) {
  const def = fieldDef(kind);
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/60 bg-[color:var(--card)] px-3 py-2 shadow-lg">
      <def.icon className="h-4 w-4 text-muted-foreground" />
      <span className="text-xs font-medium text-foreground">{def.label}</span>
    </div>
  );
}


function patchToField(patch: Record<string, unknown>): Partial<FormField> {
  const out: Partial<FormField> = {};
  if ("label" in patch) out.label = patch.label as string;
  if ("name" in patch) out.name = patch.name as string;
  if ("placeholder" in patch) out.placeholder = patch.placeholder as string | null;
  if ("help_text" in patch) out.helpText = patch.help_text as string | null;
  if ("required" in patch) out.required = patch.required as boolean;
  if ("options" in patch) out.options = patch.options as FormField["options"];
  if ("validation" in patch) out.validation = patch.validation as FormField["validation"];
  return out;
}
