import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, MousePointerClick } from "lucide-react";
import { cn } from "@/lib/utils";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import { threadsQueryOptions, unreadThreadsQueryOptions } from "@/lib/comments/queries";

/**
 * Top-bar entry point for comments.
 *  - Primary button: toggles the comments sidebar (Notion-style list).
 *  - Secondary button: arms "drop pin" mode — click anywhere on the canvas
 *    afterwards to drop a comment, exactly like Figma.
 *  - Alt-click on the canvas always drops a pin regardless of mode.
 *  - Shift+A also toggles the sidebar.
 */
export function CommentsTopButton({
  workspaceId,
  projectId,
  variant = "inline",
}: {
  workspaceId: string;
  projectId?: string;
  /** "inline" sits in a toolbar; "floating" docks to the top-right of the viewport */
  variant?: "inline" | "floating";
}) {
  const sidebarOpen = useCommentsUi((s) => s.sidebarOpen);
  const modeOn = useCommentsUi((s) => s.modeOn);

  const { data: threads = [] } = useQuery({
    ...threadsQueryOptions({ workspaceId, projectId }),
    enabled: Boolean(workspaceId),
  });
  const { data: unread = [] } = useQuery(
    unreadThreadsQueryOptions({ workspaceId, projectId }),
  );
  const openCount = threads.filter((t) => t.status === "open").length;
  const unreadCount = unread.length;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.shiftKey && (e.key === "A" || e.key === "a")) {
        e.preventDefault();
        commentsUi.toggleSidebar();
      }
      if (e.key === "Escape" && modeOn) {
        commentsUi.setMode(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modeOn]);

  const wrap =
    variant === "floating"
      ? "pointer-events-none fixed right-3 top-3 z-40"
      : "";

  return (
    <div className={cn(wrap, "flex items-center gap-1")}>
      <button
        type="button"
        onClick={() => commentsUi.toggleSidebar()}
        title="Comments (Shift+A)"
        aria-label="Open comments"
        aria-pressed={sidebarOpen}
        className={cn(
          "pointer-events-auto relative grid h-7 w-7 place-items-center rounded-md transition-colors",
          "hover:bg-[color:var(--color-row-hover)]",
          sidebarOpen ? "bg-[color:var(--color-row-hover)] text-foreground" : "text-muted-foreground",
        )}
      >
        <MessageSquare className="h-4 w-4" strokeWidth={1.75} />
        {(unreadCount > 0 || openCount > 0) && (
          <span
            className={cn(
              "absolute -top-0.5 -right-0.5 grid h-3.5 min-w-[14px] place-items-center rounded-full px-1 text-[9px] font-bold ring-2 ring-[color:var(--topbar,var(--canvas))]",
              unreadCount > 0
                ? "bg-rose-500 text-white"
                : "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]",
            )}
          >
            {unreadCount > 0 ? unreadCount : openCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => commentsUi.toggleMode()}
        title={modeOn ? "Click anywhere on the page to drop a pin (Esc to cancel)" : "Drop a comment pin"}
        aria-pressed={modeOn}
        className={cn(
          "pointer-events-auto grid h-7 w-7 place-items-center rounded-md transition-colors",
          modeOn
            ? "bg-violet-500 text-white shadow-[0_0_14px_-2px_rgba(139,92,246,0.6)]"
            : "text-muted-foreground hover:bg-[color:var(--color-row-hover)]",
        )}
      >
        <MousePointerClick className="h-4 w-4" strokeWidth={1.75} />
      </button>
    </div>
  );
}
