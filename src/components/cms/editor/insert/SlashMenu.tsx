/**
 * SlashMenu — row-level slash trigger. Listens for `/` inside the editor
 * pane. When the active element is an empty INPUT or TEXTAREA that lives
 * inside the focused Section Workspace, it opens the InsertCommand
 * anchored to the field, with the leading `/` (and subsequent typing)
 * bound to the palette's search query.
 *
 * Resolves the (sectionId, parentPath, atIndex) target by walking up the
 * DOM from the focused field: finds the closest [data-block-path-key],
 * and inserts right after it. If no block ancestor exists, falls back to
 * appending at the end of the section's top-level blocks.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InsertCommand } from "./InsertCommand";
import type { Section } from "@/lib/cms/types";
import type { BlockPath } from "@/lib/cms/blocks/operations";

interface Props {
  /** Section workspace DOM container. The listener is scoped to this. */
  scopeRef: React.RefObject<HTMLElement | null>;
  section: Section;
  /** Re-selects newly inserted block via the workspace's selection bus. */
  onInserted?: (newPathKey: string) => void;
}

interface AnchorState {
  rect: DOMRect;
  parentPath: BlockPath;
  atIndex: number;
}

function targetFromActiveEl(el: Element | null, section: Section): AnchorState | null {
  if (!el || typeof window === "undefined") return null;
  const rect = (el as HTMLElement).getBoundingClientRect();
  // Find nearest ancestor block.
  const blockEl = (el as HTMLElement).closest("[data-block-path-key]") as
    | HTMLElement
    | null;
  if (blockEl) {
    const key = blockEl.dataset.blockPathKey ?? "";
    const path = key
      .split(".")
      .map((s) => Number(s))
      .filter((n) => Number.isFinite(n));
    if (path.length === 0) {
      return {
        rect,
        parentPath: [],
        atIndex: (section.blocks ?? []).length,
      };
    }
    // Insert AFTER the matched block, as a sibling.
    const atIndex = (path[path.length - 1] ?? 0) + 1;
    const parentPath = path.slice(0, -1);
    return { rect, parentPath, atIndex };
  }
  // Fallback: append to section.
  return {
    rect,
    parentPath: [],
    atIndex: (section.blocks ?? []).length,
  };
}

function isEligibleField(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  if (!el) return false;
  const tag = el.tagName;
  if (tag !== "INPUT" && tag !== "TEXTAREA") return false;
  const field = el as HTMLInputElement | HTMLTextAreaElement;
  if (field.readOnly || field.disabled) return false;
  return (field.value ?? "") === "";
}

export function SlashMenu({ scopeRef, section, onInserted }: Props) {
  const [state, setState] = useState<AnchorState | null>(null);
  const [query, setQuery] = useState("");
  const lastFieldRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const scope = scopeRef.current;
      if (!scope) return;
      const active = document.activeElement;
      if (!active || !scope.contains(active)) return;
      if (!isEligibleField(active)) return;
      const t = targetFromActiveEl(active, section);
      if (!t) return;
      e.preventDefault();
      lastFieldRef.current = active as HTMLInputElement | HTMLTextAreaElement;
      setQuery("");
      setState(t);
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [scopeRef, section]);

  // Close on Esc / outside click. Re-anchor on scroll/resize.
  useEffect(() => {
    if (!state) return;
    const onScrollOrResize = () => {
      const field = lastFieldRef.current;
      if (!field) return;
      setState((cur) =>
        cur ? { ...cur, rect: field.getBoundingClientRect() } : cur,
      );
    };
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [state]);

  if (!state) return null;
  if (typeof document === "undefined") return null;

  const top = Math.min(window.innerHeight - 420, state.rect.bottom + 6);
  const left = Math.max(8, Math.min(window.innerWidth - 376, state.rect.left));

  const node = (
    <>
      <div
        className="fixed inset-0 z-[55]"
        onMouseDown={() => setState(null)}
      />
      <div
        style={{ position: "fixed", top, left, zIndex: 60 }}
        className="w-[360px] overflow-hidden rounded-[8px] border border-border bg-[var(--s-card,var(--s2))] shadow-[var(--shadow-3,0_12px_32px_rgba(0,0,0,0.22))]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <InsertCommand
          sectionId={section.id}
          parentPath={state.parentPath}
          atIndex={state.atIndex}
          sectionKind={section.kind}
          initialQuery={query}
          onQueryChange={setQuery}
          onClose={() => setState(null)}
          onInserted={(newPath) => onInserted?.(newPath.join("."))}
        />
      </div>
    </>
  );

  return createPortal(node, document.body);
}
