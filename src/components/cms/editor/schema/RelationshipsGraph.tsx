/**
 * RelationshipsGraph — visual replacement for the dropdown-style
 * reference picker.
 *
 * Two surfaces share this file:
 *   - <RelationshipPicker />   inline single-field picker used by the
 *                              SchemaInspector reference/componentRef rows.
 *   - <RelationshipsOverview /> full-schema graph rendered inside a Sheet
 *                              opened from the SchemaToolbar.
 *
 * Both render SVG nodes + curved bezier edges and let the user wire
 * relationships by clicking nodes, no dropdowns involved.
 */
import { forwardRef, useMemo, useRef, useState, useLayoutEffect } from "react";
import {
  Component as ComponentIcon,
  Database,
  Link2,
  Link2Off,
  Search,
  X,
} from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { schemaActions, useCMS } from "@/lib/cms/store";
import type { Schema, SchemaField } from "@/lib/cms/types";
import { NODE_KIND_ICON } from "@/lib/cms/icons";

/* ============================== Inline picker ============================= */

type PickerKind = "collection" | "component";

interface PickerProps {
  schemaId: string;
  field: SchemaField;
  kind: PickerKind;
  /** Label of the source side ("Article", "Page", …). */
  sourceLabel: string;
}

export function RelationshipPicker({ schemaId, field, kind, sourceLabel }: PickerProps) {
  const collections = useCMS((s) => s.collections);
  const components = useCMS((s) => s.components);
  const candidates = useMemo(
    () =>
      kind === "collection"
        ? collections.map((c) => ({ id: c.id, name: c.name, icon: NODE_KIND_ICON.collection }))
        : components.map((c) => ({ id: c.id, name: c.name, icon: NODE_KIND_ICON.component })),
    [collections, components, kind],
  );

  const selectedId = kind === "collection" ? field.refCollectionId : field.refComponentId;
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      query.trim()
        ? candidates.filter((c) => c.name.toLowerCase().includes(query.trim().toLowerCase()))
        : candidates,
    [candidates, query],
  );

  const handlePick = (id: string) => {
    const isSame = selectedId === id;
    const patch =
      kind === "collection"
        ? { refCollectionId: isSame ? undefined : id }
        : { refComponentId: isSame ? undefined : id };
    schemaActions.setFieldReference(schemaId, field.id, patch);
  };

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef<Map<string, HTMLButtonElement | null>>(new Map());
  const [edge, setEdge] = useState<EdgePath | null>(null);

  useLayoutEffect(() => {
    if (!selectedId || !wrapperRef.current || !sourceRef.current) {
      setEdge(null);
      return;
    }
    const target = targetRefs.current.get(selectedId);
    if (!target) {
      setEdge(null);
      return;
    }
    setEdge(computeEdge(wrapperRef.current, sourceRef.current, target));
  }, [selectedId, filtered.length, query]);

  const selectedName =
    candidates.find((c) => c.id === selectedId)?.name ??
    (selectedId ? "Missing target" : null);
  const KindIcon = kind === "collection" ? Database : ComponentIcon;

  if (candidates.length === 0) {
    return (
      <div className="rounded-md bg-[color:var(--panel)] px-3 py-4 text-center text-[12px] text-muted-foreground">
        No {kind === "collection" ? "collections" : "components"} available yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <KindIcon className="h-3 w-3" />
          {selectedName ? (
            <>
              Linked to <span className="font-medium text-foreground">{selectedName}</span>
            </>
          ) : (
            <>Pick a target {kind}</>
          )}
        </span>
        {selectedId && (
          <button
            type="button"
            onClick={() => handlePick(selectedId)}
            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Link2Off className="h-3 w-3" /> Unlink
          </button>
        )}
      </div>

      {candidates.length > 6 && (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Filter ${kind}s…`}
            className="h-7 w-full rounded-md bg-[color:var(--panel)] pl-7 pr-2 text-[12px] outline-none focus:ring-1 focus:ring-primary/40"
          />
        </div>
      )}

      <div
        ref={wrapperRef}
        className="relative rounded-md bg-[color:var(--panel)] p-3"
      >
        {/* Source pill */}
        <div className="mb-3 flex">
          <NodePill
            ref={sourceRef}
            kind={kind === "collection" ? "collection" : "component"}
            label={sourceLabel}
            tone="source"
          />
        </div>

        {/* Edge */}
        {edge && (
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={`arrow-${field.id}`}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M0,0 L10,5 L0,10 z" fill="var(--color-primary)" />
              </marker>
            </defs>
            <path
              d={edge.d}
              stroke="var(--color-primary)"
              strokeWidth="1.5"
              fill="none"
              markerEnd={`url(#arrow-${field.id})`}
              opacity="0.9"
            />
          </svg>
        )}

        {/* Candidate nodes */}
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((c) => {
            const isSelected = c.id === selectedId;
            return (
              <button
                key={c.id}
                ref={(el) => {
                  if (el) targetRefs.current.set(c.id, el);
                  else targetRefs.current.delete(c.id);
                }}
                type="button"
                onClick={() => handlePick(c.id)}
                className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground"
                    : "bg-[color:var(--card)] text-foreground hover:bg-[color:var(--elevated)]"
                }`}
              >
                <c.icon className="h-3 w-3 opacity-80" />
                <span className="truncate">{c.name}</span>
                {isSelected && <Link2 className="h-3 w-3" />}
              </button>
            );
          })}
          {filtered.length === 0 && (
            <span className="text-[11px] text-muted-foreground">No matches.</span>
          )}
        </div>
      </div>
    </div>
  );
}

const NodePill = forwardRef<
  HTMLDivElement,
  { kind: "collection" | "component"; label: string; tone: "source" | "target" | "muted" }
>(function NodePill({ kind, label, tone }, ref) {
  const Icon = NODE_KIND_ICON[kind];
  const toneCls =
    tone === "source"
      ? "bg-foreground text-background"
      : tone === "target"
        ? "bg-primary text-primary-foreground"
        : "bg-[color:var(--card)] text-foreground";
  return (
    <div
      ref={ref}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium ${toneCls}`}
    >
      <Icon className="h-3 w-3" />
      <span className="truncate">{label}</span>
    </div>
  );
});

/* ================================ Geometry ================================ */

interface EdgePath {
  d: string;
}

function computeEdge(
  wrapper: HTMLElement,
  source: HTMLElement,
  target: HTMLElement,
): EdgePath {
  const wrap = wrapper.getBoundingClientRect();
  const s = source.getBoundingClientRect();
  const t = target.getBoundingClientRect();
  // Source: bottom-center; Target: top-center.
  const sx = s.left - wrap.left + s.width / 2;
  const sy = s.top - wrap.top + s.height;
  const tx = t.left - wrap.left + t.width / 2;
  const ty = t.top - wrap.top;
  const dy = Math.max(20, (ty - sy) / 2);
  const d = `M ${sx} ${sy} C ${sx} ${sy + dy}, ${tx} ${ty - dy}, ${tx} ${ty}`;
  return { d };
}

/* ============================== Overview sheet ============================ */

interface OverviewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
  ownerName: string;
}

export function RelationshipsOverview({ open, onOpenChange, schema, ownerName }: OverviewProps) {
  const collections = useCMS((s) => s.collections);
  const components = useCMS((s) => s.components);

  const refFields = useMemo(
    () =>
      schema.fields.filter(
        (f) => f.type === "reference" || f.type === "multiReference" || f.type === "componentRef",
      ),
    [schema.fields],
  );

  const wrapperRef = useRef<HTMLDivElement>(null);
  const sourceRef = useRef<HTMLDivElement>(null);
  const targetRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [edges, setEdges] = useState<{ id: string; d: string; label: string }[]>([]);

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current || !sourceRef.current) return;
    const next: { id: string; d: string; label: string }[] = [];
    for (const f of refFields) {
      const targetId =
        f.type === "componentRef" ? f.refComponentId : f.refCollectionId;
      if (!targetId) continue;
      const key = `${f.type === "componentRef" ? "c" : "k"}:${targetId}`;
      const el = targetRefs.current.get(key);
      if (!el) continue;
      const wrap = wrapperRef.current.getBoundingClientRect();
      const s = sourceRef.current.getBoundingClientRect();
      const t = el.getBoundingClientRect();
      const sx = s.left - wrap.left + s.width;
      const sy = s.top - wrap.top + s.height / 2;
      const tx = t.left - wrap.left;
      const ty = t.top - wrap.top + t.height / 2;
      const dx = Math.max(40, (tx - sx) / 2);
      next.push({
        id: f.id,
        d: `M ${sx} ${sy} C ${sx + dx} ${sy}, ${tx - dx} ${ty}, ${tx} ${ty}`,
        label: f.label,
      });
    }
    setEdges(next);
  }, [open, refFields, collections, components]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[720px] sm:max-w-[720px]">
        <SheetHeader>
          <SheetTitle className="text-[15px]">Relationships</SheetTitle>
          <SheetDescription className="text-[12px]">
            Visual map of every reference field on{" "}
            <span className="font-medium text-foreground">{ownerName}</span>.
          </SheetDescription>
        </SheetHeader>

        {refFields.length === 0 ? (
          <div className="mt-8 rounded-md bg-[color:var(--panel)] p-8 text-center text-[12px] text-muted-foreground">
            No reference fields yet. Add a Reference or Component field to see the graph.
          </div>
        ) : (
          <div
            ref={wrapperRef}
            className="relative mt-6 grid grid-cols-[1fr_1.4fr] gap-10 rounded-md bg-[color:var(--panel)] p-6"
            style={{ minHeight: 320 }}
          >
            {/* Source column */}
            <div className="flex items-center">
              <div
                ref={sourceRef}
                className="inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-[12px] font-semibold text-background shadow-sm"
              >
                <Database className="h-3.5 w-3.5" />
                {ownerName}
              </div>
            </div>

            {/* Target column */}
            <div className="flex flex-col gap-2">
              {refFields.map((f) => {
                const isComponent = f.type === "componentRef";
                const list = isComponent ? components : collections;
                const targetId = isComponent ? f.refComponentId : f.refCollectionId;
                const target = targetId ? list.find((c) => c.id === targetId) : null;
                const key = `${isComponent ? "c" : "k"}:${targetId ?? "none"}`;
                const Icon = isComponent ? ComponentIcon : Database;
                return (
                  <div
                    key={f.id}
                    ref={(el) => {
                      if (target) targetRefs.current.set(key, el);
                    }}
                    className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[12px] ${
                      target
                        ? "bg-[color:var(--card)]"
                        : "border border-dashed border-border bg-transparent"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 opacity-70" />
                      <span className="font-medium">{target ? target.name : "Unlinked"}</span>
                      <span className="text-muted-foreground">via {f.label}</span>
                    </span>
                    {target ? (
                      <button
                        type="button"
                        onClick={() =>
                          schemaActions.setFieldReference(schema.id, f.id, isComponent
                            ? { refComponentId: undefined }
                            : { refCollectionId: undefined })
                        }
                        className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                      >
                        <X className="h-3 w-3" /> Unlink
                      </button>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">
                        Open the field to pick a target.
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Edges overlay */}
            <svg
              className="pointer-events-none absolute inset-0 h-full w-full"
              aria-hidden="true"
            >
              <defs>
                <marker
                  id="rel-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M0,0 L10,5 L0,10 z" fill="var(--color-primary)" />
                </marker>
              </defs>
              {edges.map((e) => (
                <path
                  key={e.id}
                  d={e.d}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="1.5"
                  markerEnd="url(#rel-arrow)"
                  opacity="0.85"
                />
              ))}
            </svg>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
