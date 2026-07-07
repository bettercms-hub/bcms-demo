import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { SchemaFieldType } from "@/lib/cms/types";
import {
  CATEGORY_ACCENT,
  FIELD_CATEGORIES,
  FIELD_TYPES,
  type FieldCategory,
} from "@/lib/cms/schema/field-meta";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (type: SchemaFieldType) => void;
}

export function FieldTypePicker({ open, onOpenChange, onPick }: Props) {
  const [query, setQuery] = useState("");

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const groups = new Map<FieldCategory, typeof FIELD_TYPES>();
    for (const f of FIELD_TYPES) {
      if (q && !f.label.toLowerCase().includes(q) && !f.desc.toLowerCase().includes(q) && !f.type.toLowerCase().includes(q)) continue;
      const arr = groups.get(f.category) ?? [];
      arr.push(f);
      groups.set(f.category, arr);
    }
    return groups;
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[680px]">
        <DialogHeader>
          <DialogTitle className="text-[16px]">Add field</DialogTitle>
          <DialogDescription className="text-[13px]">
            Pick a field type to add to this schema.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search field types…"
            className="h-9 w-full rounded-[6px] border border-border bg-surface pl-8 pr-2 text-[13px] focus:border-primary focus:outline-none"
          />
        </div>

        <div className="max-h-[460px] space-y-4 overflow-y-auto py-1">
          {FIELD_CATEGORIES.map((cat) => {
            const items = grouped.get(cat);
            if (!items || items.length === 0) return null;
            const accent = CATEGORY_ACCENT[cat];
            return (
              <div key={cat}>
                <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: accent }} />
                  {cat}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {items.map((e) => {
                    const Icon = e.icon;
                    return (
                      <button
                        key={e.type}
                        type="button"
                        onClick={() => { onPick(e.type); onOpenChange(false); }}
                        className="group flex items-start gap-2 rounded-[8px] border border-border bg-background p-2.5 text-left transition-all hover:-translate-y-px hover:border-border-strong hover:bg-muted/40 hover:shadow-sm"
                      >
                        <span
                          className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px]"
                          style={{
                            background: `color-mix(in srgb, ${accent} 12%, transparent)`,
                            color: `color-mix(in srgb, ${accent} 85%, var(--color-foreground))`,
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{e.label}</span>
                          <span className="block truncate text-[11px] text-muted-foreground">{e.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {[...grouped.values()].every((v) => !v?.length) && (
            <div className="py-10 text-center text-[12px] text-muted-foreground">
              No field types match “{query}”.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
