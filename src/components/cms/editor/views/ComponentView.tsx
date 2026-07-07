import { useState } from "react";
import { Plus, Settings2, Trash2 } from "lucide-react";
import { componentActions, useCMS } from "@/lib/cms/store";
import type { ComponentState } from "@/lib/cms/types";
import type { BlockKind } from "@/lib/cms/blocks/registry";
import { openSchemaEditor } from "../center/SchemaEditorWorkspace";

const STATES: ComponentState[] = ["default", "hover", "active"];
const ROOT_BLOCK_KINDS: { kind: BlockKind; label: string }[] = [
  { kind: "heading", label: "Heading" },
  { kind: "paragraph", label: "Paragraph" },
  { kind: "button", label: "Button" },
  { kind: "image", label: "Image" },
  { kind: "container", label: "Container" },
];


export function ComponentView({ componentId }: { componentId: string }) {
  const component = useCMS((s) => s.components.find((c) => c.id === componentId));
  const schema = useCMS((s) =>
    component?.schemaId ? s.schemas.find((sc) => sc.id === component.schemaId) : undefined,
  );
  const [state, setState] = useState<ComponentState>("default");
  // Only `default` is configured in mock data; treat the rest as not-yet-created.
  const [createdStates, setCreatedStates] = useState<ComponentState[]>(["default"]);

  if (!component) return null;

  const addState = (s: ComponentState) => {
    if (!createdStates.includes(s)) setCreatedStates([...createdStates, s]);
    setState(s);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-6">
      <div className="mb-5 flex items-start justify-between gap-3 pb-4">
        <div className="flex-1 min-w-0">
          <input
            value={component.name}
            onChange={(e) => componentActions.rename(component.id, e.target.value)}
            className="w-full bg-transparent text-[22px] font-semibold tracking-tight outline-none"
          />
          <div className="mt-2 flex items-center gap-2 text-[12px] text-muted-foreground">
            <span>Master component</span>
            <span className="opacity-40">·</span>
            <button className="hover:text-foreground">Open master →</button>
          </div>
        </div>
        <button
          type="button"
          disabled={!schema}
          onClick={() => schema && openSchemaEditor("component", component.id, schema.id)}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-[6px] border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:border-border-strong disabled:opacity-40"
        >
          <Settings2 className="h-3.5 w-3.5" /> Edit schema
        </button>
      </div>

      <>

          <Section
            title="Default blocks"
            action={<AddRootBlockMenu componentId={component.id} />}
          >
            {(component.rootBlocks ?? []).length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No default blocks yet. Add blocks to render every bound section instance from this component.
              </div>
            ) : (
              <div className="space-y-1.5">
                {(component.rootBlocks ?? []).map((b) => (
                  <div
                    key={b.id}
                    className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {b.kind}
                      </span>
                      <span className="truncate font-mono text-[11px] text-muted-foreground">
                        {Object.entries(b.props).map(([k, v]) => `${k}=${String(v)}`).join(" · ") || "no props"}
                      </span>
                    </div>
                    <button
                      onClick={() => componentActions.removeRootBlock(component.id, b.id)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Remove block"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-2 text-[11px] text-muted-foreground">
              Use <code className="rounded bg-muted px-1">{"{{field:name}}"}</code> in a block prop to bind it
              to a schema field. Bound section instances render this list with their per-instance overrides.
            </div>
          </Section>

          <Section title="States">

            <div className="flex flex-wrap items-center gap-1.5">
              {STATES.map((s) => {
                const created = createdStates.includes(s);
                const active = state === s;
                if (!created) {
                  return (
                    <button
                      key={s}
                      onClick={() => addState(s)}
                      className="inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2.5 py-1 text-[11px] capitalize text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" /> {s}
                    </button>
                  );
                }
                return (
                  <button
                    key={s}
                    onClick={() => setState(s)}
                    className={`rounded-md border px-2.5 py-1 text-[11px] capitalize transition-colors ${
                      active
                        ? "border-foreground/40 bg-muted text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section
            title="Variants"
            action={
              <button
                onClick={() => componentActions.addVariant(component.id)}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-3 w-3" /> Add variant
              </button>
            }
          >
            {component.variantIds.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                No variants yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {component.variantIds.map((v, i) => (
                  <div key={v} className="group relative overflow-hidden rounded-md border border-border bg-background">
                    <div className="grid aspect-[4/3] place-items-center bg-surface text-muted-foreground">
                      <span className="text-[10px] uppercase tracking-wider">{state}</span>
                    </div>
                    <div className="flex items-center justify-between border-t border-border px-2 py-1">
                      <span className="text-xs">Variant {i + 1}</span>
                      <button
                        onClick={() => componentActions.removeVariant(component.id, v)}
                        className="opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Section>

          <Section title="Schema preview">
            <div className="overflow-hidden rounded-md border border-border">
              {schema?.fields.length === 0 ? (
                <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                  No fields. Switch to the Schema tab to add one.
                </div>
              ) : (
                schema?.fields.map((f, i) => (
                  <div
                    key={f.id}
                    className={`flex items-center justify-between px-3 py-1.5 text-sm ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <span className="font-mono text-xs">{f.name}</span>
                    <span className="rounded border border-border bg-background px-1 font-mono text-[10px] text-muted-foreground">
                      {f.type}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Section>
      </>

    </div>
  );
}

function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{title}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddRootBlockMenu({ componentId }: { componentId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add block
      </button>
      {open && (
        <div
          className="absolute right-0 top-5 z-20 w-44 overflow-hidden rounded-md border border-border bg-surface shadow-[var(--shadow-container)]"
          onMouseLeave={() => setOpen(false)}
        >
          {ROOT_BLOCK_KINDS.map((b) => (
            <button
              key={b.kind}
              type="button"
              onClick={() => {
                componentActions.addRootBlock(componentId, b.kind);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-[12px] hover:bg-muted"
            >
              {b.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

