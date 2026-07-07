import { createFileRoute } from "@tanstack/react-router";
import { MediaLibraryShell } from "@/components/cms/media/MediaLibraryShell";
import { getProjectBySlug } from "@/lib/cms/use-cms";

export const Route = createFileRoute("/w/$workspace/p/$project/media")({
  component: MediaPage,
});

function MediaPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project)!;
  return <MediaLibraryShell projectId={pr.id} />;
}
