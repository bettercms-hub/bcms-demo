/**
 * InsertPopover — popover wrapper around InsertCommand. Replaces the old
 * QuickInsertPopover at inline insert slots and powers the toolbar "+".
 */
import { useState, type ReactNode } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { InsertCommand } from "./InsertCommand";
import type { BlockPath } from "@/lib/cms/blocks/operations";
import type { BlockKind } from "@/lib/cms/blocks/registry";
import type { SectionKind } from "@/lib/cms/types";

interface Props {
  sectionId: string;
  parentPath: BlockPath;
  atIndex: number;
  sectionKind?: SectionKind;
  side?: "top" | "bottom" | "left" | "right";
  align?: "start" | "center" | "end";
  children: ReactNode;
  onInserted?: (newPath: BlockPath, kind: BlockKind) => void;
}

export function InsertPopover({
  sectionId,
  parentPath,
  atIndex,
  sectionKind,
  side = "bottom",
  align = "center",
  children,
  onInserted,
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={8}
        className="w-[360px] p-0"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <InsertCommand
          sectionId={sectionId}
          parentPath={parentPath}
          atIndex={atIndex}
          sectionKind={sectionKind}
          onClose={() => setOpen(false)}
          onInserted={onInserted}
        />
      </PopoverContent>
    </Popover>
  );
}
