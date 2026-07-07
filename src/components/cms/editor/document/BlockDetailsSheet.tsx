/**
 * BlockDetailsSheet — right-side slide-over holding the full property form
 * for the currently selected block. Replaces the persistent right inspector
 * for page/section editing (Phase 3).
 */
import { useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { blockActions } from "@/lib/cms/store";
import type { Section } from "@/lib/cms/types";
import { findBlock } from "@/lib/cms/blocks/operations";
import { BLOCK_REGISTRY } from "@/lib/cms/blocks/registry";
import { FieldControl } from "../fields/FieldControl";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  section: Section;
  selectedKey?: string;
}

function parseKey(key: string): number[] {
  return key.split(".").map((s) => Number(s)).filter((n) => Number.isFinite(n));
}

export function BlockDetailsSheet({ open, onOpenChange, section, selectedKey }: Props) {
  const path = useMemo(
    () => (selectedKey ? parseKey(selectedKey) : []),
    [selectedKey],
  );
  const block = useMemo(
    () => (selectedKey ? findBlock(section.blocks ?? [], path) : undefined),
    [section.blocks, path, selectedKey],
  );
  const def = block ? BLOCK_REGISTRY[block.kind] : undefined;

  return (
    <Sheet open={open && !!block} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[clamp(360px,30vw,480px)] sm:max-w-none overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 text-[14px]">
            {def?.icon && <def.icon className="h-4 w-4 text-muted-foreground" />}
            {def?.label ?? block?.kind ?? "Block"}
          </SheetTitle>
          {def?.group && (
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {def.group}
            </div>
          )}
        </SheetHeader>

        {block && def && (
          <div className="mt-5 space-y-4">
            {def.fields.length === 0 && (
              <p className="text-[12px] text-muted-foreground">
                This block has no editable properties.
              </p>
            )}
            {def.fields.map((field) => (
              <div key={field.id}>
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
                  {field.label}
                </label>
                <FieldControl
                  field={field}
                  value={block.props[field.name]}
                  onChange={(v) =>
                    blockActions.update(section.id, path, { [field.name]: v })
                  }
                />
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
