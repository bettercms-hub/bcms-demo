import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { MousePointerClick } from "lucide-react";
import type { FormDetail } from "@/lib/forms/types";
import { SortableField } from "./SortableField";
import { TurnstileWidget } from "./TurnstileWidget";

interface Props {
  form: FormDetail;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}

export function FormCanvas({ form, selectedId, onSelect, onDuplicate, onDelete }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: "canvas-drop", data: { source: "canvas-drop" } });
  const ids = form.fields.map((f) => f.id);

  return (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-auto bg-[color:var(--canvas)]"
      onClick={() => onSelect(null)}
    >
      <div className="mx-auto w-full max-w-[640px] px-10 py-12">
        <div
          className="overflow-hidden rounded-2xl border border-[color:var(--border-hairline)] bg-white shadow-[var(--shadow-3)] dark:bg-[color:var(--card)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="border-b border-[color:var(--border-hairline)] px-8 py-8">
            <h1 className="text-[22px] font-semibold tracking-tight text-foreground">{form.name}</h1>
            {form.description && (
              <p className="mt-2 text-sm text-muted-foreground">{form.description}</p>
            )}
          </div>

          {/* Fields */}
          <div
            ref={setNodeRef}
            className={`relative flex flex-col transition-shadow ${
              isOver ? "ring-2 ring-inset ring-primary/60" : ""
            }`}
          >
            {form.fields.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                <MousePointerClick className="h-8 w-8 text-muted-foreground/70" />
                <h3 className="mt-3 text-sm font-semibold text-foreground">
                  Drag a field from the left
                </h3>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Or click a field in the library to append it. Use the inspector on the right to
                  fine-tune labels, validation, and appearance.
                </p>
              </div>
            ) : (
              <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                {form.fields.map((f, i) => (
                  <SortableField
                    key={f.id}
                    field={f}
                    selected={selectedId === f.id}
                    isLast={i === form.fields.length - 1}
                    onSelect={() => onSelect(f.id)}
                    onDuplicate={() => onDuplicate(f.id)}
                    onDelete={() => onDelete(f.id)}
                  />
                ))}
              </SortableContext>
            )}
          </div>

          {/* Captcha */}
          {form.settings?.captcha?.provider === "turnstile" && form.fields.length > 0 && (
            <div className="border-t border-[color:var(--border-hairline)] px-8 py-6">
              <TurnstileWidget />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border-hairline)] px-8 py-6">
            <button
              disabled
              className="rounded-lg bg-primary px-6 py-2 text-sm font-medium text-primary-foreground opacity-90"
            >
              {form.submitAction?.label ?? "Submit"}
            </button>
            <p className="text-[11px] text-muted-foreground">
              {form.submitAction?.kind === "redirect"
                ? "Redirects after submit"
                : "Configure in Form settings"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
