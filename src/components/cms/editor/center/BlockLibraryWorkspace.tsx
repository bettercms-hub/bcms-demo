/**
 * Block Library — center workspace sub-mode.
 * Replaces the legacy BlockLibrary modal. Triggered by section-card
 * "+ Add block" actions via `centerBus`.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import {
  ALL_BLOCK_KINDS,
  BLOCK_GROUPS,
  BLOCK_REGISTRY,
  type BlockGroup,
  type BlockKind,
} from "@/lib/cms/blocks/registry";
import { blockActions } from "@/lib/cms/store";
import { centerBus } from "@/lib/cms/center-bus";
import { recordRecentBlock } from "@/lib/cms/blocks/recent";
import type { BlockPath } from "@/lib/cms/blocks/operations";

interface Props {
  sectionId: string;
  parentPath: BlockPath;
  atIndex?: number;
  onClose: () => void;
}

export function BlockLibraryWorkspace({ sectionId, parentPath, atIndex, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<BlockGroup | "All">("All");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ALL_BLOCK_KINDS.map((k) => BLOCK_REGISTRY[k])
      .filter((d) => (group === "All" ? true : d.group === group))
      .filter(
        (d) =>
          q.length === 0 ||
          d.label.toLowerCase().includes(q) ||
          d.kind.toLowerCase().includes(q) ||
          d.description.toLowerCase().includes(q),
      );
  }, [query, group]);

  const pick = (kind: BlockKind) => {
    blockActions.add(sectionId, parentPath, kind, atIndex);
    recordRecentBlock(kind);
    onClose();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
        </button>
        <div className="text-[13px] font-semibold">Insert block</div>
        {parentPath.length > 0 && (
          <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
            into nested container
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-56 shrink-0 border-r border-border bg-surface/40 p-3 md:block">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Category
          </div>
          <div className="flex flex-col gap-0.5">
            {(["All", ...BLOCK_GROUPS] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGroup(g)}
                className={`flex h-7 items-center rounded-[6px] px-2 text-left text-[12px] transition-colors ${
                  group === g
                    ? "bg-primary/10 font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <Search className="h-3.5 w-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search blocks…"
              className="h-7 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {BLOCK_GROUPS.map((g) => {
              const items = visible.filter((d) => d.group === g);
              if (items.length === 0) return null;
              return (
                <div key={g} className="mb-6 last:mb-0">
                  <div className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {g}
                  </div>
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-4">
                    {items.map((d) => {
                      const Icon = d.icon;
                      return (
                        <button
                          key={d.kind}
                          type="button"
                          onClick={() => pick(d.kind)}
                          className="group flex flex-col items-start gap-1 rounded-[8px] border border-border bg-surface p-3 text-left transition-colors hover:border-primary hover:bg-background"
                        >
                          <div className="flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-background text-foreground group-hover:border-primary">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div className="text-[13px] font-medium">{d.label}</div>
                          <div className="line-clamp-2 text-[11px] text-muted-foreground">
                            {d.description}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {visible.length === 0 && (
              <div className="px-2 py-10 text-center text-[12px] text-muted-foreground">
                No blocks match “{query}”.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Re-export trigger helpers for section cards.
export function openBlockLibrary(sectionId: string, parentPath: BlockPath = [], atIndex?: number) {
  centerBus.emit({ type: "center:open", mode: "block-library", targetSectionId: sectionId, parentPath, atIndex });
}
