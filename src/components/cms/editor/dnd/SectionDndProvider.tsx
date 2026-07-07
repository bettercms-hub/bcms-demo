/**
 * Phase 6 — section drag-and-drop provider for the page-landing view.
 * Section nav-cards expose drag handles; insert slots between cards become
 * drop targets that call `sectionActions.reorder`.
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
import { sectionActions } from "@/lib/cms/store";
import type { ActiveData, OverData } from "./dragDataTypes";

interface Props {
  children: ReactNode;
}

export function SectionDndProvider({ children }: Props) {
  const [active, setActive] = useState<ActiveData | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const onDragStart = (e: DragStartEvent) =>
    setActive((e.active.data.current as ActiveData) ?? null);
  const onDragCancel = () => setActive(null);

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const a = e.active.data.current as ActiveData | undefined;
    const o = e.over?.data.current as OverData | undefined;
    if (!a || !o || o.kind !== "section-slot") return;
    if (a.kind !== "section" || a.pageId !== o.pageId) return;
    sectionActions.reorder(a.pageId, a.index, o.index);
  };

  const overlay = useMemo(() => {
    if (!active || active.kind !== "section") return null;
    return (
      <div className="pointer-events-none inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-foreground shadow-[var(--shadow-3,0_8px_24px_rgba(0,0,0,0.18))]">
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
