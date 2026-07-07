/**
 * BlockToolbar — floating contextual toolbar that anchors above the
 * currently selected block, in either the editor pane or the live preview.
 *
 * Phase 3 of the BetterCMS 5.0 redesign: replaces the always-on right
 * inspector with ephemeral, in-context controls.
 *
 * Anchoring strategy: query for the live DOM node that represents the
 * selected block (editor row → `[data-block-path-key="<key>"]`, preview →
 * `[data-preview-block-path="<key>"]`). Position a portaled pill above the
 * node using viewport-fixed coordinates. Re-measure on scroll / resize /
 * selection change.
 */
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ChevronDown,
  ChevronUp,
  Copy,
  MoreHorizontal,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";

import { blockActions } from "@/lib/cms/store";
import type { Block, Section } from "@/lib/cms/types";
import { findBlock } from "@/lib/cms/blocks/operations";
import { BLOCK_REGISTRY } from "@/lib/cms/blocks/registry";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InsertPopover } from "../insert/InsertPopover";
import { AskAIPanel } from "../ai/AskAIPanel";
import { getAiTextField } from "@/lib/cms/ai/preset-actions";

interface Props {
  section: Section;
  selectedKey?: string;
  onOpenDetails: () => void;
  /** Reselect a block by path key, or clear selection when undefined. */
  onSelectKey: (key: string | undefined) => void;
}

function keyOf(path: number[]): string {
  return path.join(".");
}

function parseKey(key: string): number[] {
  return key.split(".").map((s) => Number(s)).filter((n) => Number.isFinite(n));
}

function findAnchor(key: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return (
    (document.querySelector(`[data-block-path-key="${key}"]`) as HTMLElement | null) ??
    (document.querySelector(`[data-preview-block-path="${key}"]`) as HTMLElement | null)
  );
}

export function BlockToolbar({ section, selectedKey, onOpenDetails, onSelectKey }: Props) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const path = useMemo(
    () => (selectedKey ? parseKey(selectedKey) : []),
    [selectedKey],
  );
  const block: Block | undefined = useMemo(
    () => (selectedKey ? findBlock(section.blocks ?? [], path) : undefined),
    [section.blocks, path, selectedKey],
  );

  useLayoutEffect(() => {
    if (!selectedKey) {
      setRect(null);
      return;
    }
    let raf = 0;
    const measure = () => {
      const el = findAnchor(selectedKey);
      setRect(el ? el.getBoundingClientRect() : null);
    };
    measure();
    // Re-measure on next frame to catch layout settle after selection.
    raf = requestAnimationFrame(measure);

    const onScroll = () => measure();
    const onResize = () => measure();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(measure);
    const el = findAnchor(selectedKey);
    if (el) ro.observe(el);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
    };
  }, [selectedKey]);

  if (!selectedKey || !block || !rect) return null;
  if (typeof document === "undefined") return null;

  const def = BLOCK_REGISTRY[block.kind];
  const Icon = def?.icon;

  // Prefer above; flip below when near the top edge.
  const aboveTop = rect.top - 44;
  const placeAbove = aboveTop > 56;
  const top = placeAbove ? aboveTop : rect.bottom + 8;
  const left = Math.max(8, Math.min(window.innerWidth - 360, rect.left));

  const node = (
    <div
      style={{ position: "fixed", top, left, zIndex: 60 }}
      className="pointer-events-auto select-none"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      role="toolbar"
      aria-label={`${def?.label ?? block.kind} actions`}
    >
      <div className="flex items-center gap-0.5 rounded-full border border-border bg-[var(--s-card,var(--s2))]/95 px-1 py-1 shadow-[var(--shadow-3,0_8px_24px_rgba(0,0,0,0.18))] backdrop-blur">
        <div className="flex items-center gap-1.5 px-2 text-[11.5px] font-medium text-foreground">
          {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
          <span className="max-w-[120px] truncate">{def?.label ?? block.kind}</span>
        </div>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <ToolbarButton
          title="Move up"
          onClick={() => {
            const next = blockActions.move(section.id, path, -1);
            onSelectKey(keyOf(next));
          }}
        >
          <ChevronUp className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Move down"
          onClick={() => {
            const next = blockActions.move(section.id, path, 1);
            onSelectKey(keyOf(next));
          }}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Duplicate"
          onClick={() => {
            const next = blockActions.duplicate(section.id, path);
            onSelectKey(keyOf(next));
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Delete"
          onClick={() => {
            blockActions.remove(section.id, path);
            onSelectKey(undefined);
          }}
          tone="danger"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <InsertPopover
          sectionId={section.id}
          parentPath={path.slice(0, -1)}
          atIndex={(path[path.length - 1] ?? 0) + 1}
          sectionKind={section.kind}
          onInserted={(newPath) => onSelectKey(keyOf(newPath))}
        >
          <button
            type="button"
            title="Insert block after"
            aria-label="Insert block after"
            className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </InsertPopover>
        {getAiTextField(block.kind) && (
          <>
            <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
            <AskAIPanel
              section={section}
              block={block}
              path={path}
              open={aiOpen}
              onOpenChange={setAiOpen}
            >
              <button
                type="button"
                title="Ask AI"
                aria-label="Ask AI"
                className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                <Sparkles className="h-3.5 w-3.5" /> AI
              </button>
            </AskAIPanel>
          </>
        )}
        <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
        <button
          type="button"
          onClick={onOpenDetails}
          className="inline-flex h-7 items-center gap-1 rounded-full px-2.5 text-[11.5px] font-medium text-foreground hover:bg-[color:var(--color-row-hover)]"
          title="Open details"
        >
          <Settings2 className="h-3.5 w-3.5" /> Details
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-full text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              aria-label="More actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-[12px]">
            {getAiTextField(block.kind) && (
              <DropdownMenuItem onClick={() => setAiOpen(true)}>
                <Sparkles className="mr-2 h-3.5 w-3.5" /> Rewrite with AI
              </DropdownMenuItem>
            )}
            <DropdownMenuItem disabled>Convert to…</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => navigator.clipboard?.writeText(selectedKey)}
            >
              Copy block path
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}

function ToolbarButton({
  children,
  onClick,
  title,
  tone,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  tone?: "danger";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`grid h-7 w-7 place-items-center rounded-full transition-colors hover:bg-[color:var(--color-row-hover)] ${
        tone === "danger"
          ? "text-muted-foreground hover:text-destructive"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}
