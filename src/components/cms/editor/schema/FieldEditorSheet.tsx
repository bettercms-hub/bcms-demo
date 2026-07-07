/**
 * FieldEditorSheet — slide-over for editing a single field.
 *
 * Wraps the existing SchemaInspector in `field` mode inside a wide Sheet
 * (~880px) so editing happens on a dedicated surface instead of a permanent
 * right rail.
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
  fieldId: string | null;
}

export function FieldEditorSheet({
  open,
  onOpenChange,
  schema,
  ownerKind,
  ownerId,
  fieldId,
}: Props) {
  return (
    <Sheet open={open && !!fieldId} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[min(880px,92vw)] sm:max-w-[880px] !p-0 border-l border-border/40 bg-[color:var(--inspector)]"
      >
        {fieldId && (
          <SchemaInspector
            schema={schema}
            selection={{ kind: "field", id: fieldId }}
            ownerKind={ownerKind}
            ownerId={ownerId}
            onSelectionClear={() => onOpenChange(false)}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}
