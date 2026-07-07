/**
 * FieldLibrary — middle column of the Schema Builder (V4).
 *
 * Drag-first source of field types. Replaces SchemaStructure for the
 * default Builder view. Categorised list with Search, Favorites, and
 * Recents. Items are draggable (HTML5) carrying `NEW_FIELD_MIME` so
 * GroupSection / BuilderView can drop them anywhere in the canvas.
 * Clicking an item inserts into the active group (existing fallback).
 */
import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles, Star, StarOff } from "lucide-react";
import { schemaActions } from "@/lib/cms/store";
import {
  CATEGORY_ACCENT,
  FIELD_CATEGORIES,
  FIELD_TYPES,
  FIELD_TYPE_META,
  type FieldCategory,
} from "@/lib/cms/schema/field-meta";
import type { SchemaFieldType } from "@/lib/cms/types";
import {
  NEW_FIELD_MIME,
  makeDragGhost,
} from "@/lib/cms/schema/use-field-dnd";

const RECENT_KEY = "bcms.schema.recent-fields";
const FAV_KEY = "bcms.schema.favorite-fields";

interface Props {
  schemaId: string;
  activeGroupId: string | null;
  onCreated: (fieldId: string) => void;
}

function readList(key: string): SchemaFieldType[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as SchemaFieldType[]) : [];
  } catch {
    return [];
  }
}

function writeList(key: string, list: SchemaFieldType[]) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* noop */
  }
}

export function FieldLibrary({ schemaId, activeGroupId, onCreated }: Props) {
  const [q, setQ] = useState("");
  const [recents, setRecents] = useState<SchemaFieldType[]>([]);
  const [favorites, setFavorites] = useState<SchemaFieldType[]>([]);

  useEffect(() => {
    setRecents(readList(RECENT_KEY));
    setFavorites(readList(FAV_KEY));
  }, []);

  // Keep in sync if other code (palette) updates localStorage.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_KEY) setRecents(readList(RECENT_KEY));
      if (e.key === FAV_KEY) setFavorites(readList(FAV_KEY));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

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

  const visibleByCategory = useMemo(() => {
    const map = new Map<FieldCategory, SchemaFieldType[]>();
    for (const cat of FIELD_CATEGORIES) map.set(cat, []);
    for (const meta of FIELD_TYPES) {
      if (matches(meta.type)) map.get(meta.category)!.push(meta.type);
    }
    return map;
  }, [query]);

  const totalVisible = useMemo(
    () =>
      Array.from(visibleByCategory.values()).reduce((s, l) => s + l.length, 0),
    [visibleByCategory],
  );

  const visibleFavs = favorites.filter(matches);
  const visibleRecents = recents.filter((t) => !favorites.includes(t)).filter(matches);

  const pushRecent = (t: SchemaFieldType) => {
    const next = [t, ...recents.filter((x) => x !== t)].slice(0, 6);
    setRecents(next);
    writeList(RECENT_KEY, next);
  };

  const toggleFav = (t: SchemaFieldType) => {
    const next = favorites.includes(t)
      ? favorites.filter((x) => x !== t)
      : [t, ...favorites].slice(0, 12);
    setFavorites(next);
    writeList(FAV_KEY, next);
  };

  const insert = (t: SchemaFieldType) => {
    const fid = schemaActions.addField(schemaId, t);
    if (activeGroupId) schemaActions.setFieldGroup(schemaId, fid, activeGroupId);
    pushRecent(t);
    onCreated(fid);
  };

  return (
    <div className="flex h-full flex-col bg-[color:var(--canvas)]">
      {/* Header */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80">
            Field library
          </div>
          {totalVisible > 0 && (
            <span className="text-[10.5px] tabular-nums text-muted-foreground/70">
              {totalVisible}
            </span>
          )}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fields"
            className="h-8 w-full rounded-md border border-transparent bg-transparent pl-7 pr-2 text-[12px] placeholder:text-muted-foreground/60 hover:bg-[color:var(--row-hover)] focus:border-primary/40 focus:bg-[color:var(--row-hover)] focus:outline-none"
          />
        </div>
        <p className="mt-2 px-1 text-[10.5px] leading-relaxed text-muted-foreground/70">
          Drag onto the canvas, or click to add to the active group.
        </p>
      </div>

      {/* Body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {totalVisible === 0 && visibleFavs.length === 0 && visibleRecents.length === 0 ? (
          <div className="px-3 py-6 text-center text-[12px] text-muted-foreground/70">
            No matching fields.
          </div>
        ) : null}

        {visibleFavs.length > 0 && (
          <LibrarySection icon={Star} label="Favorites">
            {visibleFavs.map((t) => (
              <LibraryItem
                key={`fav-${t}`}
                type={t}
                isFavorite
                onToggleFavorite={() => toggleFav(t)}
                onClick={() => insert(t)}
              />
            ))}
          </LibrarySection>
        )}

        {visibleRecents.length > 0 && (
          <LibrarySection icon={Sparkles} label="Recent">
            {visibleRecents.map((t) => (
              <LibraryItem
                key={`recent-${t}`}
                type={t}
                isFavorite={favorites.includes(t)}
                onToggleFavorite={() => toggleFav(t)}
                onClick={() => insert(t)}
              />
            ))}
          </LibrarySection>
        )}

        {FIELD_CATEGORIES.map((cat) => {
          const items = visibleByCategory.get(cat) ?? [];
          if (items.length === 0) return null;
          return (
            <LibrarySection key={cat} label={cat}>
              {items.map((t) => (
                <LibraryItem
                  key={`${cat}-${t}`}
                  type={t}
                  isFavorite={favorites.includes(t)}
                  onToggleFavorite={() => toggleFav(t)}
                  onClick={() => insert(t)}
                />
              ))}
            </LibrarySection>
          );
        })}
      </div>
    </div>
  );
}

function LibrarySection({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-3">
      <div className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
        {Icon && <Icon className="h-3 w-3" />}
        <span>{label}</span>
      </div>
      <div className="space-y-px">{children}</div>
    </section>
  );
}

function LibraryItem({
  type,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  type: SchemaFieldType;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onClick: () => void;
}) {
  const meta = FIELD_TYPE_META[type];
  const Icon = meta.icon;
  const accent = CATEGORY_ACCENT[meta.category];

  return (
    <div
      draggable
      onDragStart={(e) => {
        try {
          e.dataTransfer.setData(NEW_FIELD_MIME, type);
          e.dataTransfer.setData("text/plain", meta.label);
        } catch {
          /* noop */
        }
        e.dataTransfer.effectAllowed = "copy";
        makeDragGhost(e, meta.label, accent);
      }}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      title={`${meta.label} — ${meta.desc}`}
      className="group/lib flex cursor-grab items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-[color:var(--row-hover)] active:cursor-grabbing focus-visible:bg-[color:var(--row-hover)] focus-visible:outline-none"
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
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        aria-label={isFavorite ? "Unfavorite" : "Favorite"}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground/60 transition-opacity hover:bg-[color:var(--row-selected)] hover:text-foreground ${
          isFavorite ? "opacity-100" : "opacity-0 group-hover/lib:opacity-100 focus:opacity-100"
        }`}
      >
        {isFavorite ? (
          <Star className="h-3 w-3 fill-current" />
        ) : (
          <StarOff className="h-3 w-3" />
        )}
      </button>
    </div>
  );
}
