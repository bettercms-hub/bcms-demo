import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on comment_thread / comment_message /
 * comment_reaction for a workspace/project and invalidates the thread query
 * so all open sessions stay in sync.
 *
 * Mount once per surface (CommentSurfaceWrapper handles this).
 */
export function useCommentsRealtime({
  workspaceId,
  projectId,
}: {
  workspaceId?: string;
  projectId?: string;
}) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!workspaceId) return;
    const channelName = projectId
      ? `comments:proj:${projectId}`
      : `comments:ws:${workspaceId}`;

    const invalidate = () =>
      qc.invalidateQueries({ queryKey: ["comment-threads", workspaceId] });

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "comment_thread",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comment_message" },
        invalidate,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "comment_reaction" },
        invalidate,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, projectId, qc]);
}
