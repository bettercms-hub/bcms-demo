import { useEffect, useState } from "react";
import { commentsUi, useCommentsUi } from "@/lib/cms/comments-store";
import { useCommentsRealtime } from "@/lib/comments/realtime";
import { CommentLayer } from "./CommentLayer";
import type { CommentSurface, CommentThread } from "@/lib/comments/types";

/**
 * Wraps a region (editor center, preview, etc.) so that:
 *  - In "comment mode" (top-bar pin button toggled on), a normal click drops a
 *    pending pin at click coords and opens the composer popover — exactly like
 *    Figma.
 *  - Alt/Option+click ALWAYS drops a pin, regardless of mode, so you can
 *    comment without first toggling anything.
 *  - The CommentLayer renders threads + the pending pin over the region.
 *  - Block-anchored threads are positioned via DOM lookup, with smooth
 *    repositioning on scroll/resize.
 */
export function CommentSurfaceWrapper({
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
  const modeOn = useCommentsUi((s) => s.modeOn);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  useCommentsRealtime({ workspaceId, projectId });

  useEffect(() => {
    if (!container) return;
    function onClick(e: MouseEvent) {
      if (!container) return;
      // Pin-mode click OR Alt/Option-click anywhere on the canvas.
      const armed = modeOn || e.altKey;
      if (!armed) return;

      const t = e.target as HTMLElement;
      if (t.closest("[data-comments-layer]")) return;
      if (t.closest("[data-no-comment]")) return;

      e.preventDefault();
      e.stopPropagation();

      const rect = container.getBoundingClientRect();
      const xPct = ((e.clientX - rect.left) / rect.width) * 100;
      const yPct = ((e.clientY - rect.top) / rect.height) * 100;

      // Walk up to find a block/field anchor (improves thread re-anchoring)
      let node: HTMLElement | null = t;
      let blockId: string | undefined;
      let fieldPath: string | undefined;
      let snippet: string | undefined;
      while (node && node !== container) {
        if (!blockId) blockId = node.dataset.blockId;
        if (!fieldPath) fieldPath = node.dataset.fieldPath;
        node = node.parentElement;
      }
      if (blockId || fieldPath) {
        const text = (t.textContent ?? "").trim().slice(0, 120);
        snippet = text || undefined;
      }

      commentsUi.setPending({
        surface,
        pageId,
        anchorKind: blockId ? "block" : fieldPath ? "field" : "page",
        anchorRef: { blockId, fieldPath, text: snippet },
        viewport: { xPct, yPct },
        clientPoint: { x: e.clientX, y: e.clientY },
      });
      commentsUi.setMode(false);
    }
    container.addEventListener("click", onClick, true);
    return () => container.removeEventListener("click", onClick, true);
  }, [modeOn, container, surface, pageId]);

  function resolveBlockPosition(thread: CommentThread) {
    if (!container) return null;
    const ref = thread.anchor_ref;
    if (!ref) return null;
    let el: HTMLElement | null = null;
    if (ref.blockId)
      el = container.querySelector<HTMLElement>(
        `[data-block-id="${CSS.escape(String(ref.blockId))}"]`,
      );
    else if (ref.fieldPath)
      el = container.querySelector<HTMLElement>(
        `[data-field-path="${CSS.escape(String(ref.fieldPath))}"]`,
      );
    if (!el) return null;
    const cRect = container.getBoundingClientRect();
    const eRect = el.getBoundingClientRect();
    return {
      x: `${eRect.left - cRect.left + container.scrollLeft - 14}px`,
      y: `${eRect.top - cRect.top + container.scrollTop + 14}px`,
    };
  }

  return (
    <div
      ref={setContainer}
      className={`relative ${className ?? ""} ${modeOn ? "cursor-crosshair" : ""}`}
    >
      {children}
      <CommentLayer
        workspaceId={workspaceId}
        projectId={projectId}
        surface={surface}
        pageId={pageId}
        resolveAnchorPosition={resolveBlockPosition as never}
      />
    </div>
  );
}
