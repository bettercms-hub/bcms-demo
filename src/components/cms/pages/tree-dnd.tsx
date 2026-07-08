/**
 * tree-dnd — small render-prop wrappers over @dnd-kit for the Pages tree.
 *
 * Rows stay authored inline in the Pages hub; these helpers just hand back a
 * ref plus drag listeners (for a hover grip handle) or an `isOver` flag (for
 * drop highlighting), so a page row can be dragged into a folder and a folder
 * row can be both dragged and dropped onto. Membership and nesting only — the
 * Sort dropdown still owns row order.
 */
import type { CSSProperties, ReactNode, Ref } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";

/** Merge two refs (dnd-kit gives one per hook; folder rows need both). */
export function mergeRefs<T>(...refs: Array<Ref<T> | undefined>): (node: T | null) => void {
  return (node) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

export interface DragRender {
  setNodeRef: (node: HTMLElement | null) => void;
  handleProps: Record<string, unknown>;
  isDragging: boolean;
  style: CSSProperties;
}

export function Draggable({
  id,
  data,
  disabled,
  children,
}: {
  id: string;
  data: Record<string, unknown>;
  disabled?: boolean;
  children: (r: DragRender) => ReactNode;
}) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({ id, data, disabled });
  return (
    <>
      {children({
        setNodeRef,
        handleProps: disabled ? {} : { ...listeners, ...attributes },
        isDragging,
        style: isDragging ? { opacity: 0.4 } : {},
      })}
    </>
  );
}

export interface DropRender {
  setNodeRef: (node: HTMLElement | null) => void;
  isOver: boolean;
}

export function Droppable({
  id,
  data,
  disabled,
  children,
}: {
  id: string;
  data?: Record<string, unknown>;
  disabled?: boolean;
  children: (r: DropRender) => ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id, data, disabled });
  return <>{children({ setNodeRef, isOver: isOver && !disabled })}</>;
}
