import { useState } from "react";
import { ChevronDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useCMS } from "@/lib/cms/store";
import { getReferenceLabel } from "@/lib/cms/references";
import { StatusBadge } from "@/components/cms/ui/StatusBadge";

interface SingleProps {
  value?: string;
  onChange: (id: string | undefined) => void;
  collectionId?: string;
  placeholder?: string;
}

export function ReferencePicker({ value, onChange, collectionId, placeholder = "Select…" }: SingleProps) {
  const [open, setOpen] = useState(false);
  const entries = useCMS((s) => s.entries.filter((e) => e.collectionId === collectionId));
  const schema = useCMS((s) => {
    const col = s.collections.find((c) => c.id === collectionId);
    return col ? s.schemas.find((sc) => sc.id === col.schemaId) : undefined;
  });
  const selected = entries.find((e) => e.id === value);

  if (!collectionId) {
    return (
      <div className="flex h-8 w-full items-center rounded-[6px] border border-dashed border-border bg-surface px-2 text-[12px] text-muted-foreground">
        No reference target set
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="flex h-8 w-full items-center justify-between gap-2 rounded-[6px] border border-border bg-surface px-2 text-left text-[13px] transition-colors hover:border-border-strong"
          >
            <span className={selected ? "truncate" : "truncate text-muted-foreground"}>
              {selected ? getReferenceLabel(selected, schema) : placeholder}
            </span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search entries…" className="h-9" />
            <CommandList>
              <CommandEmpty>No entries.</CommandEmpty>
              <CommandGroup>
                {entries.map((e) => (
                  <CommandItem
                    key={e.id}
                    value={getReferenceLabel(e, schema) + " " + e.id}
                    onSelect={() => {
                      onChange(e.id);
                      setOpen(false);
                    }}
                    className="flex items-center justify-between gap-2"
                  >
                    <span className="truncate text-[13px]">{getReferenceLabel(e, schema)}</span>
                    {e.status && <StatusBadge label={e.status} tone={e.status === "published" ? "success" : "muted"} />}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      {selected && (
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-[6px] border border-border bg-surface text-muted-foreground hover:bg-muted hover:text-foreground"
          title="Clear"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

interface MultiProps {
  value?: string[];
  onChange: (ids: string[]) => void;
  collectionId?: string;
}

export function MultiReferencePicker({ value = [], onChange, collectionId }: MultiProps) {
  const [open, setOpen] = useState(false);
  const entries = useCMS((s) => s.entries.filter((e) => e.collectionId === collectionId));
  const schema = useCMS((s) => {
    const col = s.collections.find((c) => c.id === collectionId);
    return col ? s.schemas.find((sc) => sc.id === col.schemaId) : undefined;
  });
  const selected = entries.filter((e) => value.includes(e.id));

  if (!collectionId) {
    return (
      <div className="flex h-8 w-full items-center rounded-[6px] border border-dashed border-border bg-surface px-2 text-[12px] text-muted-foreground">
        No reference target set
      </div>
    );
  }

  return (
    <div className="rounded-[6px] border border-border bg-surface p-1">
      <div className="flex flex-wrap gap-1">
        {selected.map((e) => (
          <span key={e.id} className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 py-0.5 text-[12px]">
            {getReferenceLabel(e, schema)}
            <button
              type="button"
              onClick={() => onChange(value.filter((id) => id !== e.id))}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button type="button" className="rounded border border-dashed border-border px-1.5 py-0.5 text-[12px] text-muted-foreground hover:text-foreground">
              + add
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0" align="start">
            <Command>
              <CommandInput placeholder="Search…" className="h-9" />
              <CommandList>
                <CommandEmpty>No entries.</CommandEmpty>
                <CommandGroup>
                  {entries
                    .filter((e) => !value.includes(e.id))
                    .map((e) => (
                      <CommandItem
                        key={e.id}
                        value={getReferenceLabel(e, schema) + " " + e.id}
                        onSelect={() => {
                          onChange([...value, e.id]);
                          setOpen(false);
                        }}
                      >
                        {getReferenceLabel(e, schema)}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
