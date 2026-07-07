/**
 * SchemaCollectionsRail — leftmost column of the Schema Builder.
 * Lists project Collections + Components with entry counts. Click to switch.
 */
import { useMemo, useState } from "react";
import { useParams } from "@tanstack/react-router";
import { Component as ComponentIcon, Database, Search } from "lucide-react";
import { useCMS } from "@/lib/cms/store";
import type { SchemaOwnerKind } from "@/lib/cms/center-bus";

interface Props {
  currentSchemaId: string;
  currentOwnerId: string;
  currentOwnerKind: SchemaOwnerKind;
  onSwitchSchema: (schemaId: string, kind: SchemaOwnerKind, ownerId: string) => void;
}

export function SchemaCollectionsRail({
  currentOwnerId,
  currentOwnerKind,
  onSwitchSchema,
}: Props) {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace?: string;
    project?: string;
  };
  const all = useCMS((s) => ({
    collections: s.collections,
    components: s.components,
    schemas: s.schemas,
    entries: s.entries,
    projects: s.projects,
    workspaces: s.workspaces,
  }));

  const project_ = useMemo(() => {
    const ws = all.workspaces.find((w) => w.slug === workspace);
    return all.projects.find((p) => p.slug === project && p.workspaceId === ws?.id);
  }, [all.workspaces, all.projects, workspace, project]);

  const collections = useMemo(
    () => all.collections.filter((c) => !project_ || c.projectId === project_.id),
    [all.collections, project_],
  );
  const components = useMemo(
    () => all.components.filter((c) => !project_ || c.projectId === project_.id),
    [all.components, project_],
  );

  const entryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of all.entries) {
      map.set(e.collectionId, (map.get(e.collectionId) ?? 0) + 1);
    }
    return map;
  }, [all.entries]);

  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  return (
    <div className="flex h-full flex-col bg-[color:var(--canvas)]">
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search models"
            className="h-8 w-full rounded-md border border-transparent bg-transparent pl-7 pr-2 text-[12px] placeholder:text-muted-foreground/60 hover:bg-[color:var(--row-hover)] focus:border-primary/40 focus:bg-[color:var(--row-hover)] focus:outline-none"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <Section title="Collections" icon={Database}>
          {collections
            .filter((c) => !query || c.name.toLowerCase().includes(query))
            .map((c) => {
              const sch = all.schemas.find((s) => s.id === c.schemaId);
              const active =
                currentOwnerKind === "collection" && currentOwnerId === c.id;
              return (
                <Row
                  key={c.id}
                  active={active}
                  label={c.name}
                  count={entryCounts.get(c.id) ?? 0}
                  Icon={Database}
                  onClick={() => sch && onSwitchSchema(sch.id, "collection", c.id)}
                />
              );
            })}
          {collections.length === 0 && (
            <Empty>No collections in this project.</Empty>
          )}
        </Section>

        <Section title="Components" icon={ComponentIcon}>
          {components
            .filter((c) => !query || c.name.toLowerCase().includes(query))
            .map((c) => {
              const sch = all.schemas.find((s) => s.ownerId === c.id);
              const active =
                currentOwnerKind === "component" && currentOwnerId === c.id;
              return (
                <Row
                  key={c.id}
                  active={active}
                  label={c.name}
                  count={sch?.fields.length ?? 0}
                  Icon={ComponentIcon}
                  onClick={() => sch && onSwitchSchema(sch.id, "component", c.id)}
                  disabled={!sch}
                />
              );
            })}
          {components.length === 0 && <Empty>No components.</Empty>}
        </Section>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3 w-3" />
        {title}
      </div>
      <div className="space-y-px">{children}</div>
    </div>
  );
}

function Row({
  active,
  onClick,
  label,
  count,
  Icon,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  Icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12.5px] transition-colors disabled:opacity-40 ${
        active
          ? "bg-[color:var(--row-selected)] text-foreground"
          : "text-foreground/80 hover:bg-[color:var(--row-hover)] hover:text-foreground"
      }`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" />
      <span className="truncate">{label}</span>
      <span className="ml-auto text-[10.5px] tabular-nums text-muted-foreground">{count}</span>
    </button>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="px-2 py-2 text-[11px] text-muted-foreground">{children}</div>;
}
