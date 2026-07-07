/**
 * CollectionSettingsSheet — slide-over for collection/schema metadata.
 * Replaces the always-visible schema metadata inspector from V1.
 */
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { Schema } from "@/lib/cms/types";
import type { SchemaOwnerKind } from "@/lib/cms/center-bus";
import { SchemaInspector } from "./SchemaInspector";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schema: Schema;
  ownerKind: SchemaOwnerKind;
  ownerId: string;
}

export function CollectionSettingsSheet({
  open,
  onOpenChange,
  schema,
  ownerKind,
  ownerId,
}: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(640px,92vw)] sm:max-w-[640px] !p-0 border-l border-border/40 bg-[color:var(--inspector)]"
      >
        <SchemaInspector
          schema={schema}
          selection={{ kind: "schema" }}
          ownerKind={ownerKind}
          ownerId={ownerId}
          onSelectionClear={() => onOpenChange(false)}
        />
      </SheetContent>
    </Sheet>
  );
}
