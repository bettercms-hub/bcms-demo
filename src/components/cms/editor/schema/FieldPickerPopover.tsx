/**
 * FieldPickerPopover — contextual, Notion-style field-type picker.
 *
 * Wraps a trigger in a Popover that opens a compact search list of all
 * field types (grouped by category, with Recents). Selecting a type
 * creates the field via `schemaActions.addField`, optionally placing it
 * in `groupId` at a specific `index`, then calls `onCreated(fid)`.
 *
 * Replaces the always-on left FieldLibrary panel for click-to-insert
 * flows. The library panel still exists for users who prefer drag.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { schemaActions } from "@/lib/cms/store";
import {
  CATEGORY_ACCENT,
  FIELD_CATEGORIES,
  FIELD_TYPES,
  FIELD_TYPE_META,
  type FieldCategory,
} from "@/lib/cms/schema/field-meta";
import type { SchemaFieldType } from "@/lib/cms/types";

const RECENT_KEY = "bcms.schema.recent-fields";

function readRecents(): SchemaFieldType[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? (arr as SchemaFieldType[]) : [];
  } catch {
    return [];
  }
}

function pushRecent(t: SchemaFieldType) {
  try {
    const next = [t, ...readRecents().filter((x) => x !== t)].slice(0, 6);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* noop */
  }
}

interface Props {
  schemaId: string;
  /** Group to insert into. `null` = ungrouped. */
  groupId?: string | null;
  /** Insertion index inside the target group. */
  index?: number;
  onCreated?: (fieldId: string) => void;
  align?: "start" | "center" | "end";
  side?: "top" | "right" | "bottom" | "left";
  children: React.ReactNode;
}

export function FieldPickerPopover({
  schemaId,
  groupId = null,
  index,
  onCreated,
  align = "start",
  side = "bottom",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [recents, setRecents] = useState<SchemaFieldType[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setRecents(readRecents());
      setQ("");
      setHighlight(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const query = q.trim().toLowerCase();
  const matches = (t: SchemaFieldType) => {
    if (!query) return true;
    const m = FIELD_TYPE_META[t];
    return (
      m.label.toLowerCase().includes(query) ||
      m.desc.toLowerCase().includes(query) ||
      m.type.toLowerCase().includes(query) ||
      m.category.toLowerCase().includes(query)
    );
  };

  const grouped = useMemo(() => {
    const map = new Map<FieldCategory, SchemaFieldType[]>();
    for (const cat of FIELD_CATEGORIES) map.set(cat, []);
    for (const meta of FIELD_TYPES) {
      if (matches(meta.type)) map.get(meta.category)!.push(meta.type);
    }
    return map;
  }, [query]);

  const recentRow = recents.filter(matches);

  const flat: SchemaFieldType[] = useMemo(() => {
    const list: SchemaFieldType[] = [...recentRow];
    for (const cat of FIELD_CATEGORIES) {
      list.push(...(grouped.get(cat) ?? []));
    }
    return list;
  }, [grouped, recentRow]);

  useEffect(() => {
    if (highlight >= flat.length) setHighlight(0);
  }, [flat.length, highlight]);

  const insert = (t: SchemaFieldType) => {
    const fid = schemaActions.addField(schemaId, t);
    if (groupId) schemaActions.setFieldGroup(schemaId, fid, groupId);
    if (typeof index === "number") {
      schemaActions.moveFieldTo(schemaId, fid, groupId, index);
    }
    pushRecent(t);
    onCreated?.(fid);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const t = flat[highlight];
      if (t) insert(t);
    }
  };

  let cursor = 0;
  const renderItem = (t: SchemaFieldType, keyPrefix: string) => {
    const meta = FIELD_TYPE_META[t];
    const Icon = meta.icon;
    const accent = CATEGORY_ACCENT[meta.category];
    const idx = cursor++;
    const active = idx === highlight;
    return (
      <button
        key={`${keyPrefix}-${t}`}
        type="button"
        onMouseEnter={() => setHighlight(idx)}
        onClick={() => insert(t)}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors ${
          active
            ? "bg-[color:var(--row-hover)]"
            : "hover:bg-[color:var(--row-hover)]"
        }`}
      >
        <span
          className="grid h-6 w-6 shrink-0 place-items-center rounded"
          style={{
            background: `color-mix(in srgb, ${accent} 16%, transparent)`,
            color: `color-mix(in srgb, ${accent} 85%, var(--color-foreground))`,
          }}
        >
          <Icon className="h-3 w-3" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12.5px] font-medium tracking-tight text-foreground">
            {meta.label}
          </span>
          <span className="block truncate text-[10.5px] text-muted-foreground/70">
            {meta.desc}
          </span>
        </span>
      </button>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align={align}
        side={side}
        sideOffset={6}
        className="w-[320px] overflow-hidden p-0"
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-border/40 px-2 py-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setHighlight(0);
              }}
              placeholder="Search fields"
              className="h-8 w-full rounded-md bg-transparent pl-7 pr-2 text-[12.5px] placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="max-h-[360px] overflow-y-auto p-1">
          {flat.length === 0 ? (
            <div className="px-3 py-6 text-center text-[12px] text-muted-foreground/70">
              No matching fields.
            </div>
          ) : (
            <>
              {recentRow.length > 0 && (
                <Section icon={Sparkles} label="Recent">
                  {recentRow.map((t) => renderItem(t, "recent"))}
                </Section>
              )}
              {FIELD_CATEGORIES.map((cat) => {
                const items = grouped.get(cat) ?? [];
                if (items.length === 0) return null;
                return (
                  <Section key={cat} label={cat}>
                    {items.map((t) => renderItem(t, cat))}
                  </Section>
                );
              })}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function Section({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-1">
      <div className="flex items-center gap-1.5 px-2 pt-1.5 pb-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{label}</span>
      </div>
      <div className="space-y-px">{children}</div>
    </section>
  );
}
