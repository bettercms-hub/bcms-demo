import { createFileRoute } from "@tanstack/react-router";
import { SettingsHeader } from "@/components/cms/SettingsSubNav";
import { WorkspaceUsagePanel } from "@/components/cms/billing/WorkspaceUsagePanel";
import { useCMS } from "@/lib/cms/store";

export const Route = createFileRoute("/w/$workspace/settings/usage")({
  component: UsagePage,
});

function UsagePage() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const projects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));

  if (!ws) {
    return (
      <>
        <SettingsHeader title="Usage" description="What each site is using this period, against what its plan includes." />
        <div className="rounded-md border border-[color:var(--border-hairline)] bg-card p-8 text-center text-[13px] text-muted-foreground">
          Workspace not found.
        </div>
      </>
    );
  }

  return (
    <>
      <SettingsHeader
        title="Usage"
        description="What each site is using this period, against what its plan includes."
      />
      <WorkspaceUsagePanel workspace={ws} projects={projects} />
    </>
  );
}
