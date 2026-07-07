import * as React from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Plus, Globe, Folder } from "lucide-react";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { projects } from "@/lib/cms/mock-data";
import { PageShell } from "@/components/cms/layout";
import { DataTable, type DataTableColumn } from "@/components/cms/data-table";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/cms/Icon";

export const Route = createFileRoute("/w/$workspace/projects")({
  component: ProjectsList,
});

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string;
  updatedAt: string;
  collections: number;
  components: number;
  status: "live" | "draft";
};

function ProjectsList() {
  const { workspace } = Route.useParams();
  const ws = getWorkspaceBySlug(workspace)!;
  const wsProjects: Row[] = React.useMemo(
    () =>
      projects
        .filter((p) => p.workspaceId === ws.id)
        .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt))
        .map((p, i) => ({
          id: p.id,
          slug: p.slug,
          name: p.name,
          description: p.description ?? "",
          updatedAt: p.updatedAt,
          collections: p.collectionIds.length,
          components: p.componentIds.length,
          status: i % 4 === 0 ? "draft" : "live",
        })),
    [ws.id],
  );

  const columns: DataTableColumn<Row>[] = React.useMemo(
    () => [
      {
        key: "name",
        header: "Project",
        sortAccessor: (r) => r.name.toLowerCase(),
        searchAccessor: (r) => `${r.name} ${r.description}`,
        cell: (r) => (
          <Link
            to="/w/$workspace/p/$project"
            params={{ workspace, project: r.slug }}
            className="group flex min-w-0 items-center gap-3"
          >
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--surface-4)] text-[11px] font-semibold text-foreground">
              {r.name[0]}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-foreground group-hover:text-primary">
                {r.name}
              </div>
              <div className="truncate text-[12px] text-muted-foreground">
                {r.description || "—"}
              </div>
            </div>
          </Link>
        ),
      },
      {
        key: "status",
        header: "Status",
        sortAccessor: (r) => r.status,
        width: "110px",
        cell: (r) => <StatusPill status={r.status} />,
      },
      {
        key: "content",
        header: "Content",
        sortAccessor: (r) => r.collections + r.components,
        width: "180px",
        hideable: true,
        cell: (r) => (
          <div className="flex items-center gap-3 text-[12.5px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Icon icon={Folder} size="xs" /> {r.collections}
            </span>
            <span className="inline-flex items-center gap-1">
              <Icon icon={Globe} size="xs" /> {r.components}
            </span>
          </div>
        ),
      },
      {
        key: "updated",
        header: "Last updated",
        sortAccessor: (r) => r.updatedAt,
        width: "140px",
        cell: (r) => (
          <span className="text-[12.5px] tabular-nums text-muted-foreground">
            {new Date(r.updatedAt).toLocaleDateString()}
          </span>
        ),
      },
      {
        key: "open",
        header: "",
        width: "32px",
        align: "right",
        cell: (r) => (
          <Link
            to="/w/$workspace/p/$project"
            params={{ workspace, project: r.slug }}
            className="inline-grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
            aria-label={`Open ${r.name}`}
          >
            <Icon icon={ArrowUpRight} size="sm" />
          </Link>
        ),
      },
    ],
    [workspace],
  );

  return (
    <PageShell
      breadcrumbs={[
        { label: ws.name, to: "/w/$workspace", params: { workspace } },
        { label: "Projects" },
      ]}
      eyebrow="Workspace"
      title="Projects"
      description="Every project in this workspace. Open one to manage content, design, and publishing."
      actions={
        <Button size="sm" className="h-8 gap-1.5 text-[13px]">
          <Icon icon={Plus} size="sm" /> New project
        </Button>
      }
    >
      <DataTable<Row>
        rows={wsProjects}
        columns={columns}
        rowKey={(r) => r.id}
        selectable
        searchPlaceholder="Search projects…"
        filters={[
          {
            key: "status",
            label: "Status",
            options: [
              { value: "live", label: "Live" },
              { value: "draft", label: "Draft" },
            ],
            predicate: (r, v) => r.status === v,
          },
        ]}
        initialSort={{ key: "updated", dir: "desc" }}
        emptyTitle="No projects yet"
        emptyDescription="Create your first project to start building."
        emptyAction={
          <Button size="sm" className="h-8 gap-1.5 text-[13px]">
            <Icon icon={Plus} size="sm" /> New project
          </Button>
        }
      />
    </PageShell>
  );
}

function StatusPill({ status }: { status: "live" | "draft" }) {
  const meta =
    status === "live"
      ? { label: "Live", dot: "bg-[color:var(--status-live)]" }
      : { label: "Draft", dot: "bg-[color:var(--status-draft)]" };
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11.5px] font-medium text-foreground">
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
