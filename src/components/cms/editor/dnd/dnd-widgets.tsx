/**
 * Phase 6 — DnD widget primitives used inside PageView.
 *
 * Tiny wrappers around `useDraggable` / `useDroppable` so the call sites in
 * the (already dense) PageView stay readable.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type {
  ActiveData,
  DropBlockSlot,
  DropSectionSlot,
} from "./dragDataTypes";

// ---------- Drag handles ----------

interface DragHandleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  id: string;
  data: ActiveData;
  /** Extra Tailwind classes for the handle wrapper. */
  className?: string;
  children?: ReactNode;
}

export const DragHandle = forwardRef<HTMLButtonElement, DragHandleProps>(
  function DragHandle({ id, data, className, children, ...rest }, ref) {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
      id,
      data,
    });
    const setRef = (node: HTMLButtonElement | null) => {
      setNodeRef(node);
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as React.MutableRefObject<HTMLButtonElement | null>).current = node;
    };
    return (
      <button
        ref={setRef}
        type="button"
        aria-label="Drag to reorder"
        data-noexpand
        data-noopen
        onClick={(e) => e.stopPropagation()}
        {...attributes}
        {...listeners}
        {...rest}
        className={
          (className ?? "") +
          " cursor-grab touch-none active:cursor-grabbing " +
          (isDragging ? "opacity-40 " : "")
        }
      >
        {children ?? <GripVertical className="h-3.5 w-3.5" />}
      </button>
    );
  },
);

// ---------- Drop slots ----------

interface DropZoneProps {
  id: string;
  data: DropBlockSlot | DropSectionSlot;
  children: (state: { isOver: boolean; canDrop: boolean }) => ReactNode;
}

export function DropZone({ id, data, children }: DropZoneProps) {
  const { setNodeRef, isOver, active } = useDroppable({ id, data });
  const canDrop = isCompatible(active?.data.current as ActiveData | undefined, data);
  return <div ref={setNodeRef}>{children({ isOver: isOver && canDrop, canDrop })}</div>;
}

function isCompatible(
  active: ActiveData | undefined,
  over: DropBlockSlot | DropSectionSlot,
): boolean {
  if (!active) return false;
  if (over.kind === "block-slot") {
    if (active.kind === "library") return true;
    if (active.kind === "block") {
      if (active.sectionId !== over.sectionId) return false;
      // Disallow dropping into own subtree (cycle).
      const from = active.path;
      const target = over.parentPath;
      if (target.length >= from.length && from.every((v, i) => target[i] === v)) {
        return false;
      }
      return true;
    }
    return false;
  }
  if (over.kind === "section-slot") {
    return active.kind === "section" && active.pageId === over.pageId;
  }
  return false;
}
