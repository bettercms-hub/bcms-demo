import { Outlet, createFileRoute, notFound, useLocation, useParams } from "@tanstack/react-router";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { useWorkspaceRow } from "@/lib/workspace/queries";
import { SurfaceCommentsShell } from "@/components/cms/comments/SurfaceCommentsShell";
import type { CommentSurface } from "@/lib/comments/types";

export const Route = createFileRoute("/w/$workspace/p/$project")({
  beforeLoad: ({ params }) => {
    // Validate on the client only — a renamed workspace slug is persisted in
    // localStorage and unknown to the server, which would otherwise 404 a valid
    // project on a hard reload. ProjectLayout re-validates on the client.
    if (typeof window !== "undefined" && !getProjectBySlug(params.workspace, params.project)) {
      throw notFound();
    }
  },
  component: ProjectLayout,
});

function ProjectLayout() {
  const { workspace, project } = useParams({ strict: false }) as {
    workspace: string;
    project: string;
  };
  const location = useLocation();
  const wsRow = useWorkspaceRow(workspace);
  const workspaceId = wsRow.data?.id ?? "";
  const projectRow = getProjectBySlug(workspace, project);
  // Client-side validation (server skips beforeLoad — see above).
  if (!projectRow) throw notFound();
  const projectId = projectRow.id;

  // The editor route mounts its own commenting shell internally.
  if (location.pathname.includes("/editor")) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <Outlet />
      </div>
    );
  }

  // Derive surface from the route segment after /p/<slug>/
  const segments = location.pathname.split("/");
  const projectIdx = segments.findIndex((s) => s === "p");
  const sub = segments[projectIdx + 2] ?? "content";
  const surface = mapSurface(sub);
  const pageId = segments[projectIdx + 3] || undefined;

  return (
    <SurfaceCommentsShell
      workspaceId={workspaceId}
      projectId={projectId}
      surface={surface}
      pageId={pageId}
      className="flex min-h-0 flex-1 flex-col"
    >
      <Outlet />
    </SurfaceCommentsShell>
  );
}

function mapSurface(sub: string): CommentSurface {
  switch (sub) {
    case "media":
      return "media";
    case "seo":
      return "seo";
    case "analytics":
      return "analytics";
    case "forms":
      return "forms";
    case "settings":
      return "settings";
    case "content":
      return "collection";
    case "deployments":
      return "page";
    case "ai":
      return "page";
    default:
      return "page";
  }
}
