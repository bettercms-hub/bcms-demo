import { createFileRoute } from "@tanstack/react-router";
import { select } from "@/lib/cms/store";
import { RedirectsManager } from "@/components/cms/seo/RedirectsManager";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/redirects")({
  component: Redirects,
});

function Redirects() {
  const { workspace, project } = Route.useParams();
  const pr = select.projectBySlug(workspace, project)!;
  return (
    <RedirectsManager
      projectId={pr.id}
      projectSlug={project}
      description="Rewrites applied at the edge before your site renders. Evaluated in order."
    />
  );
}
