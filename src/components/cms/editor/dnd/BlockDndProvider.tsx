/**
 * Phase 6 — block drag-and-drop provider.
 *
 * One `DndContext` wraps a section workspace. Block rows expose drag handles
 * (grip in BlockToolbar header / pill toolbar) via `useDraggable`; inline
 * insert slots become `useDroppable`. On drop we route to the block store —
 * sibling reorder, cross-parent re-parenting, or insert-from-library.
 */
import { useMemo, useState, type ReactNode } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { blockActions } from "@/lib/cms/store";
import { createBlock } from "@/lib/cms/blocks/operations";
import type { ActiveData, OverData } from "./dragDataTypes";

interface Props {
  children: ReactNode;
  onSelect?: (pathKey: string) => void;
}

export function BlockDndProvider({ children, onSelect }: Props) {
  const [active, setActive] = useState<ActiveData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) => {
    setActive((e.active.data.current as ActiveData) ?? null);
  };

  const onDragCancel = () => setActive(null);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const a = e.active.data.current as ActiveData | undefined;
    const o = e.over?.data.current as OverData | undefined;
    if (!a || !o || o.kind !== "block-slot") return;

    if (a.kind === "block") {
      if (a.sectionId !== o.sectionId) return; // cross-section moves not supported yet
      const toPath = [...o.parentPath, o.index];
      const newPath = blockActions.moveTo(a.sectionId, a.path, toPath);
      onSelect?.(newPath.join("."));
    } else if (a.kind === "library") {
      const block = createBlock(a.blockKind);
      const newPath = blockActions.insertAt(o.sectionId, o.parentPath, o.index, block);
      onSelect?.(newPath.join("."));
    }
  };

  const overlay = useMemo(() => {
    if (!active) return null;
    return (
      <div className="pointer-events-none inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-1 text-[11.5px] font-medium text-foreground shadow-[var(--shadow-3,0_8px_24px_rgba(0,0,0,0.18))]">
        {active.label}
      </div>
    );
  }, [active]);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      {children}
      <DragOverlay dropAnimation={null}>{overlay}</DragOverlay>
    </DndContext>
  );
}
