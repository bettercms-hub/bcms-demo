/**
 * FieldCommandPalette — replaces the docked FieldLibrary.
 *
 * Triggered from `+ Add field`, `/`, or `⌘K`. Lists every field type by
 * category. Selecting one inserts into the active group and opens the
 * field editor for the new field.
 */
import { useEffect, useState } from "react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { schemaActions } from "@/lib/cms/store";
import {
  CATEGORY_ACCENT,
  FIELD_CATEGORIES,
  FIELD_TYPES,
} from "@/lib/cms/schema/field-meta";
import type { SchemaFieldType } from "@/lib/cms/types";

const RECENT_KEY = "bcms.schema.recent-fields";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  schemaId: string;
  activeGroupId: string | null;
  onCreated: (fieldId: string) => void;
}

export function FieldCommandPalette({
  open,
  onOpenChange,
  schemaId,
  activeGroupId,
  onCreated,
}: Props) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const pushRecent = (t: SchemaFieldType) => {
    try {
      const prev: string[] = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
      const next = [t, ...prev.filter((x) => x !== t)].slice(0, 6);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch { /* noop */ }
  };

  const insert = (t: SchemaFieldType) => {
    const fid = schemaActions.addField(schemaId, t);
    if (activeGroupId) schemaActions.setFieldGroup(schemaId, fid, activeGroupId);
    pushRecent(t);
    onOpenChange(false);
    onCreated(fid);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder="Search field types…"
      />
      <CommandList>
        <CommandEmpty>No fields match.</CommandEmpty>
        {FIELD_CATEGORIES.map((cat, idx) => {
          const items = FIELD_TYPES.filter((f) => f.category === cat);
          if (items.length === 0) return null;
          const accent = CATEGORY_ACCENT[cat];
          return (
            <div key={cat}>
              {idx > 0 && <CommandSeparator />}
              <CommandGroup heading={cat}>
                {items.map((f) => {
                  const Icon = f.icon;
                  return (
                    <CommandItem
                      key={f.type}
                      value={`${cat} ${f.label} ${f.desc} ${f.type}`}
                      onSelect={() => insert(f.type)}
                    >
                      <span
                        className="mr-2 grid h-6 w-6 place-items-center rounded"
                        style={{
                          background: `color-mix(in srgb, ${accent} 16%, transparent)`,
                          color: `color-mix(in srgb, ${accent} 85%, var(--color-foreground))`,
                        }}
                      >
                        <Icon className="h-3 w-3" />
                      </span>
                      <span className="text-[12.5px] font-medium">{f.label}</span>
                      <span className="ml-2 truncate text-[11px] text-muted-foreground">
                        {f.desc}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          );
        })}
      </CommandList>
    </CommandDialog>
  );
}
