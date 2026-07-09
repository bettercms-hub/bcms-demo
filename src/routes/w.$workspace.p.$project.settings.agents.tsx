/**
 * Project settings > External agents. The same connect surface that lives on
 * the project's Agent page, mirrored into settings so developers can manage
 * external-agent keys where they manage the rest of the integration config.
 */
import { createFileRoute } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import { PageHeader } from "@/components/cms/SettingsSubNav";
import { ConnectedAgents } from "@/components/agent/ConnectedAgents";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/agents")({
  component: ProjectAgents,
});

function ProjectAgents() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const { effective } = useEffectiveRole(workspace);

  if (!pr) return null;

  return (
    <>
      <PageHeader
        title="External agents"
        description="Connect Claude Code, Cursor and other MCP clients to this project with scoped keys. Manage the same keys from the Agent page."
      />
      {canSeeDeveloper(effective) ? (
        <ConnectedAgents projectId={pr.id} />
      ) : (
        <div className="rounded-xl border border-[color:var(--border-hairline)] bg-card px-6 py-8 text-center">
          <div className="text-[13px] font-medium text-foreground">Developer access required</div>
          <p className="mx-auto mt-1 max-w-sm text-[12.5px] text-muted-foreground">
            External agent keys are managed by developers and admins. Ask a workspace admin if you need access.
          </p>
          <Link to="/w/$workspace/p/$project/settings/general" params={{ workspace, project }} className="mt-4 inline-block text-[12.5px] font-medium text-primary hover:underline">
            Back to settings
          </Link>
        </div>
      )}
    </>
  );
}
