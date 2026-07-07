/**
 * SchemaJsonPanel — read-only JSON view of the current schema.
 *
 * Renders as a right-side Sheet. Includes a "Copy" button. Edits to the
 * schema must still go through the builder / inspector — this panel is
 * intentionally not editable so we never desync types from UI invariants.
 */
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { Schema } from "@/lib/cms/types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: Schema;
}

export function SchemaJsonPanel({ open, onOpenChange, schema }: Props) {
  const [copied, setCopied] = useState(false);
  const text = JSON.stringify(schema, null, 2);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch {
      /* no-op */
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[640px]"
      >
        <SheetHeader className="flex shrink-0 flex-row items-center justify-between gap-2 border-b border-border/40 px-5 py-3">
          <div>
            <SheetTitle className="text-[13.5px] font-semibold tracking-tight">
              Schema JSON
            </SheetTitle>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">
              Read-only. Editing happens in the builder.
            </p>
          </div>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/50 bg-[color:var(--panel)] px-2 text-[11.5px] text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-500" /> Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" /> Copy
              </>
            )}
          </button>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-auto bg-[color:var(--canvas)]">
          <pre className="px-5 py-4 text-[11.5px] leading-relaxed text-foreground/85">
            <code>{text}</code>
          </pre>
        </div>
      </SheetContent>
    </Sheet>
  );
}
