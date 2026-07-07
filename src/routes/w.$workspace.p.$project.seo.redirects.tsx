import { createFileRoute } from "@tanstack/react-router";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { RedirectsManager } from "@/components/cms/seo/RedirectsManager";

export const Route = createFileRoute("/w/$workspace/p/$project/seo/redirects")({
  component: RedirectsPage,
});

function RedirectsPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  return (
    <RedirectsManager
      projectId={pr.id}
      projectSlug={project}
      description="Keep inbound links and SEO equity when URLs change. Bulk import/export supported."
    />
  );
}
