import { createFileRoute } from "@tanstack/react-router";
import { WorkspaceUsagePanel } from "@/components/cms/billing/WorkspaceUsagePanel";
import { useCMS } from "@/lib/cms/store";

export const Route = createFileRoute("/w/$workspace/settings/billing/usage")({
  component: BillingUsage,
});

function BillingUsage() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const projects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));

  if (!ws) {
    return (
      <div className="rounded-md border border-[color:var(--border-hairline)] bg-card p-8 text-center text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  return <WorkspaceUsagePanel workspace={ws} projects={projects} />;
}
