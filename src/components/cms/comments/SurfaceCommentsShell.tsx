import { CommentSidebar } from "./CommentSidebar";
import { CommentSurfaceWrapper } from "./CommentSurfaceWrapper";
import { CommentModeProvider } from "./CommentModeProvider";
import { CommentsTopButton } from "./CommentsTopButton";
import type { CommentSurface } from "@/lib/comments/types";

/**
 * One-line wrapper that mounts the universal commenting layer on any
 * non-editor surface: comment-mode hit area, threads sidebar, and the
 * top-right Comments button. Pass `pageId` (or any sub-scope id) to scope
 * threads.
 */
export function SurfaceCommentsShell({
  workspaceId,
  projectId,
  surface,
  pageId,
  children,
  className,
}: {
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
  children: React.ReactNode;
  className?: string;
}) {
  if (!workspaceId) {
    return <>{children}</>;
  }
  return (
    <CommentModeProvider>
      <CommentSurfaceWrapper
        workspaceId={workspaceId}
        projectId={projectId}
        surface={surface}
        pageId={pageId}
        className={className}
      >
        {children}
      </CommentSurfaceWrapper>
      <CommentSidebar
        workspaceId={workspaceId}
        projectId={projectId}
        surface={surface}
        pageId={pageId}
      />
      <CommentsTopButton
        workspaceId={workspaceId}
        projectId={projectId}
        variant="floating"
      />
    </CommentModeProvider>
  );
}
