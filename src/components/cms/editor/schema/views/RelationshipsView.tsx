/**
 * RelationshipsView — inline visual map of every reference field.
 * Simpler version of the existing RelationshipsOverview sheet, rendered
 * directly inside the canvas.
 */
import { useMemo } from "react";
import { ArrowRight, Component as ComponentIcon, Database } from "lucide-react";
import { useCMS } from "@/lib/cms/store";
import type { Schema } from "@/lib/cms/types";

interface Props {
  schema: Schema;
  ownerName: string;
  onSelectField: (id: string) => void;
}

export function RelationshipsView({ schema, ownerName, onSelectField }: Props) {
  const collections = useCMS((s) => s.collections);
  const components = useCMS((s) => s.components);

  const refs = useMemo(
    () =>
      schema.fields.filter(
        (f) =>
          f.type === "reference" ||
          f.type === "multiReference" ||
          f.type === "componentRef",
      ),
    [schema.fields],
  );

  return (
    <div className="mx-auto max-w-[920px] px-8 py-7">
      <div className="grid grid-cols-[minmax(160px,1fr)_auto_minmax(220px,1fr)] items-center gap-4">
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
            Source
          </div>
          <div className="mt-1 inline-flex items-center gap-2 rounded-lg bg-foreground px-3 py-2 text-[13px] font-semibold text-background">
            <Database className="h-3.5 w-3.5" />
            {ownerName}
          </div>
        </div>
        <div />
        <div>
          <div className="text-[10.5px] uppercase tracking-[0.06em] text-muted-foreground">
            Targets
          </div>
        </div>

        {refs.length === 0 ? (
          <div className="col-span-full mt-4 rounded-lg border border-dashed border-border/40 p-8 text-center text-[12.5px] text-muted-foreground">
            No reference fields yet. Add a Reference, Multi-reference, or
            Component field to see relationships here.
          </div>
        ) : (
          refs.map((f) => {
            const isComponent = f.type === "componentRef";
            const list = isComponent ? components : collections;
            const targetId = isComponent ? f.refComponentId : f.refCollectionId;
            const target = targetId ? list.find((c) => c.id === targetId) : null;
            const TIcon = isComponent ? ComponentIcon : Database;
            return (
              <RefRow
                key={f.id}
                fieldLabel={f.label}
                targetName={target?.name ?? null}
                TargetIcon={TIcon}
                onOpen={() => onSelectField(f.id)}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

function RefRow({
  fieldLabel,
  targetName,
  TargetIcon,
  onOpen,
}: {
  fieldLabel: string;
  targetName: string | null;
  TargetIcon: React.ComponentType<{ className?: string }>;
  onOpen: () => void;
}) {
  return (
    <>
      <div className="text-right">
        <button
          type="button"
          onClick={onOpen}
          className="text-[11.5px] text-muted-foreground hover:text-foreground"
        >
          via <span className="font-medium">{fieldLabel}</span>
        </button>
      </div>
      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/60" />
      <button
        type="button"
        onClick={onOpen}
        className={`flex items-center gap-2 rounded-md px-3 py-2 text-left text-[12.5px] transition-colors ${
          targetName
            ? "bg-[color:var(--panel)] hover:bg-[color:var(--row-hover)]"
            : "border border-dashed border-border/40 text-muted-foreground hover:bg-[color:var(--row-hover)]"
        }`}
      >
        <TargetIcon className="h-3.5 w-3.5 opacity-70" />
        <span className="font-medium">{targetName ?? "Unlinked — click to pick"}</span>
      </button>
    </>
  );
}
