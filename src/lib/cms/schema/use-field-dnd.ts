/**
 * use-field-dnd — small helpers for native HTML5 drag-and-drop of field rows
 * inside the Schema Builder. No new dependencies.
 *
 * Provides:
 * - DragState shape consumed by BuilderView/GroupSection/FieldCard
 * - `makeDragGhost(label, accent)` — builds & cleans up a premium drag preview
 * - `useDragAutoScroll()` — auto-scroll nearest scrollable ancestor when
 *   dragging near the top/bottom edge of the viewport.
 */
import { useEffect, useRef } from "react";

export type FieldDragState = {
  fieldId: string;
  fromGroupId: string | null;
  overGroupId: string | null;
  /** Insertion index inside overGroupId's filtered field list. */
  overIndex: number | null;
  /** True when this drag originated from the Field Library (new field insert). */
  isNew?: boolean;
} | null;

export const DRAG_MIME = "application/x-bcms-field";
export const NEW_FIELD_MIME = "application/x-bcms-new-field";
export const GROUP_MIME = "application/x-bcms-group";

/** Build a premium drag ghost element and attach it via setDragImage. */
export function makeDragGhost(
  event: React.DragEvent,
  label: string,
  accent: string,
) {
  const el = document.createElement("div");
  el.style.cssText = [
    "position:absolute",
    "top:-1000px",
    "left:-1000px",
    "display:inline-flex",
    "align-items:center",
    "gap:8px",
    "height:28px",
    "padding:0 10px",
    "border-radius:8px",
    "background:var(--elevated, #1c1c1f)",
    "color:var(--foreground, #fff)",
    "font:500 12px/1 ui-sans-serif,system-ui,sans-serif",
    "letter-spacing:-0.01em",
    "box-shadow:0 8px 24px -8px rgba(0,0,0,0.45), 0 2px 6px rgba(0,0,0,0.2)",
    `border:1px solid color-mix(in srgb, ${accent} 35%, transparent)`,
    "pointer-events:none",
    "white-space:nowrap",
  ].join(";");
  const dot = document.createElement("span");
  dot.style.cssText = `width:6px;height:6px;border-radius:9999px;background:${accent};box-shadow:0 0 0 3px color-mix(in srgb, ${accent} 25%, transparent)`;
  el.appendChild(dot);
  el.appendChild(document.createTextNode(label));
  document.body.appendChild(el);
  try {
    event.dataTransfer.setDragImage(el, 12, 14);
  } catch {
    /* ignore */
  }
  // Clean up after the browser has had a chance to snapshot.
  window.setTimeout(() => el.remove(), 0);
}

function findScrollableParent(node: HTMLElement | null): HTMLElement | null {
  let n: HTMLElement | null = node;
  while (n && n !== document.body) {
    const s = getComputedStyle(n);
    if (/(auto|scroll|overlay)/.test(s.overflowY) && n.scrollHeight > n.clientHeight) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

/**
 * Auto-scroll the nearest scrollable ancestor of the dragged-over element
 * while the user is near the top/bottom edge. Active only while `enabled`.
 */
export function useDragAutoScroll(enabled: boolean) {
  const rafRef = useRef<number | null>(null);
  const speedRef = useRef(0);
  const targetRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const EDGE = 64;
    const MAX_SPEED = 14;

    function loop() {
      const target = targetRef.current;
      const v = speedRef.current;
      if (target && v !== 0) target.scrollTop += v;
      rafRef.current = window.requestAnimationFrame(loop);
    }

    function onDragOver(e: DragEvent) {
      const t = e.target as HTMLElement | null;
      const scroller = findScrollableParent(t);
      if (!scroller) { speedRef.current = 0; return; }
      targetRef.current = scroller;
      const rect = scroller.getBoundingClientRect();
      const y = e.clientY;
      if (y < rect.top + EDGE) {
        const ratio = 1 - Math.max(0, (y - rect.top)) / EDGE;
        speedRef.current = -Math.ceil(ratio * MAX_SPEED);
      } else if (y > rect.bottom - EDGE) {
        const ratio = 1 - Math.max(0, (rect.bottom - y)) / EDGE;
        speedRef.current = Math.ceil(ratio * MAX_SPEED);
      } else {
        speedRef.current = 0;
      }
    }

    function stop() {
      speedRef.current = 0;
      targetRef.current = null;
    }

    window.addEventListener("dragover", onDragOver);
    window.addEventListener("dragend", stop);
    window.addEventListener("drop", stop);
    rafRef.current = window.requestAnimationFrame(loop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("dragend", stop);
      window.removeEventListener("drop", stop);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      speedRef.current = 0;
      targetRef.current = null;
    };
  }, [enabled]);
}
