/**
 * Workspace agent — start a task from the dashboard, before entering
 * any project. Tag the site with @, describe the job, and the task
 * starts inside that project's Agent tab.
 */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getCMSState } from "@/lib/cms/store";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { canEditContent, useEffectiveRole } from "@/lib/workspace/my-role";
import { agentRunActions } from "@/lib/agent/runs-store";
import { AgentComposer } from "@/components/agent/AgentComposer";

export const Route = createFileRoute("/w/$workspace/agent")({
  component: WorkspaceAgentPage,
});

function WorkspaceAgentPage() {
  const { workspace } = Route.useParams();
  const navigate = useNavigate();
  const ws = getWorkspaceBySlug(workspace);
  const { effective } = useEffectiveRole(workspace);
  const canRun = canEditContent(effective);

  if (!ws) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[640px] px-6 pb-16 pt-[12vh]">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--card)] text-primary shadow-[var(--shadow-card)]">
            <Sparkles className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.01em] text-foreground">
            How can I help you today?
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            Tag a site with @ and describe the job. The task opens inside that project.
          </p>
        </div>

        <div className="mt-7">
          <AgentComposer
            wsSlug={workspace}
            scope="workspace"
            sitePlan="pro"
            size="hero"
            autoFocus
            disabled={!canRun}
            onSubmit={({ prompt, tier, context, skillId, model }) => {
              const ref = context.find((c) => c.kind === "project");
              if (!ref) return;
              const project = getCMSState().projects.find((p) => p.id === ref.id);
              if (!project) {
                toast.error("That project could not be found");
                return;
              }
              // The run starts now; the tier re-clamps to the project's plan.
              const runId = agentRunActions.start({
                projectId: project.id,
                prompt,
                tier,
                context: context.filter((c) => c.kind !== "project"),
                skillId,
                model,
              });
              navigate({
                to: "/w/$workspace/p/$project/agent",
                params: { workspace, project: project.slug },
                search: { run: runId || undefined },
              });
            }}
          />
        </div>

        <p className="mt-4 text-center text-[11.5px] text-muted-foreground">
          The agent proposes changes and saves drafts. Publishing stays with you.
        </p>
      </div>
    </div>
  );
}
