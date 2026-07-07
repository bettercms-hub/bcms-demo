import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import { threadsQueryOptions } from "@/lib/comments/queries";
import type { CommentSurface, CommentThread } from "@/lib/comments/types";
import { CommentPin } from "./CommentPin";
import { ThreadView } from "./ThreadView";

interface CommentLayerProps {
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
  /**
   * Returns the on-screen position for a given thread, relative to the
   * layer container (which must be `position: relative`). When undefined,
   * the pin falls back to viewport coordinates from `thread.viewport`.
   */
  resolveAnchorPosition?: (thread: CommentThread) => { x: number; y: number } | null;
  /** Optional ref to the scroll container (drives re-position on scroll). */
  scrollContainer?: HTMLElement | null;
}

export function CommentLayer({
  workspaceId,
  projectId,
  surface,
  pageId,
  resolveAnchorPosition,
}: CommentLayerProps) {
  const modeOn = useCommentsUi((s) => s.modeOn);
  const pending = useCommentsUi((s) => s.pending);
  const activeId = useCommentsUi((s) => s.activeThreadId);
  const hasWorkspace = Boolean(workspaceId);

  const { data: threads = [] } = useQuery({
    ...threadsQueryOptions({ workspaceId, projectId }),
    enabled: hasWorkspace,
  });

  // Filter to this surface/page
  const local = threads.filter(
    (t) =>
      t.surface === surface &&
      (!pageId || t.page_id === pageId || t.anchor_kind === "page"),
  );

  // Trigger re-render on scroll/resize so anchored pins follow the DOM
  const [, tick] = useState(0);
  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => tick((n) => n + 1));
    };
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  function positionFor(t: CommentThread) {
    if (resolveAnchorPosition) {
      const p = resolveAnchorPosition(t);
      if (p) return p;
    }
    const x = (t.viewport.xPct ?? 50) as number;
    const y = (t.viewport.yPct ?? 30) as number;
    return { x: `${x}%`, y: `${y}%`, fallback: true };
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 z-30"
      data-comments-layer
      data-comment-mode={modeOn ? "on" : undefined}
    >
      {local.map((t) => {
        const pos = positionFor(t);
        return (
          <div
            key={t.id}
            className="pointer-events-auto absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: pos.x, top: pos.y }}
          >
            <ThreadPin
              thread={t}
              active={activeId === t.id}
              workspaceId={workspaceId}
              projectId={projectId}
              surface={surface}
              pageId={pageId}
            />
          </div>
        );
      })}
      {pending && pending.surface === surface && (!pageId || pending.pageId === pageId || pending.anchorKind === "page") && (
        <PendingComposer
          workspaceId={workspaceId}
          projectId={projectId}
          surface={surface}
          pageId={pageId}
          canSubmit={hasWorkspace}
        />
      )}
    </div>
  );
}

function ThreadPin({
  thread,
  active,
  workspaceId,
  projectId,
  surface,
  pageId,
}: {
  thread: CommentThread;
  active: boolean;
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
}) {
  const [open, setOpen] = useState(active);
  useEffect(() => setOpen(active), [active]);
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) commentsUi.setActive(thread.id);
        else if (commentsUi.get().activeThreadId === thread.id)
          commentsUi.setActive(null);
      }}
    >
      <PopoverTrigger asChild>
        <span>
          <CommentPin thread={thread} active={open} />
        </span>
      </PopoverTrigger>
      <PopoverContent
        side="right"
        align="start"
        className="w-[340px] overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <ThreadView
          thread={thread}
          pending={null}
          workspaceId={workspaceId}
          projectId={projectId}
          surface={surface}
          pageId={pageId}
          onClose={() => setOpen(false)}
          compact
        />
      </PopoverContent>
    </Popover>
  );
}

function PendingComposer({
  workspaceId,
  projectId,
  surface,
  pageId,
  canSubmit,
}: {
  workspaceId: string;
  projectId?: string;
  surface: CommentSurface;
  pageId?: string;
  canSubmit: boolean;
}) {
  const pending = useCommentsUi((s) => s.pending);
  // Close pending composer on scroll/resize to mirror Figma's behavior.
  // Hooks must run unconditionally — keep this above any early return.
  useEffect(() => {
    if (!pending) return;
    // Ignore the first burst of scroll/resize events that fire as the popover
    // mounts/positions itself (Radix scrolls focused content into view).
    let armed = false;
    const arm = setTimeout(() => {
      armed = true;
    }, 250);
    function close() {
      if (!armed) return;
      commentsUi.setPending(null);
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      clearTimeout(arm);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pending]);

  if (!pending) return null;

  const point = pending.clientPoint ?? {
    x: window.innerWidth / 2,
    y: window.innerHeight / 3,
  };

  const maxLeft = Math.max(12, window.innerWidth - 352);
  const maxTop = Math.max(12, window.innerHeight - 500);
  const left = Math.min(Math.max(point.x + 12, 12), maxLeft);
  const top = Math.min(Math.max(point.y - 16, 12), maxTop);

  return (
    <div
      data-no-comment
      className="pointer-events-auto fixed z-50 w-[340px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
      style={{ left, top }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ThreadView
        thread={null}
        pending={{
          surface: pending.surface,
          workspaceId,
          projectId,
          pageId: pending.pageId ?? pageId,
          anchorKind: pending.anchorKind,
          anchorRef: pending.anchorRef,
          selectionText: pending.selectionText,
        }}
        workspaceId={workspaceId}
        projectId={projectId}
        surface={surface}
        pageId={pageId}
        onClose={() => commentsUi.setPending(null)}
        onThreadCreated={(t) => {
          commentsUi.setPending(null);
          commentsUi.setActive(t.id);
        }}
        canSubmit={canSubmit}
        compact
      />
    </div>
  );
}
