/**
 * PreviewSlashMenu — listens for `/` inside the live preview surface and
 * opens the InsertCommand palette anchored at the relevant block.
 *
 * Trigger rules:
 *  1. If the user types `/` while focus is on an empty contentEditable
 *     InlineText (e.g. a freshly inserted heading/paragraph), the menu
 *     opens and the `/` is suppressed. Insertion target = sibling after
 *     the owning block.
 *  2. If the user types `/` while a block is selected in preview but no
 *     editable is focused, the menu opens and insertion target = sibling
 *     after the selected block (or appended to the section when nothing
 *     is selected).
 *
 * The palette closes on Esc, outside click, or after a successful insert,
 * at which point the newly created block is selected so the floating
 * toolbar reattaches to it.
 */
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { InsertCommand } from "../insert/InsertCommand";
import type { Section } from "@/lib/cms/types";
import type { BlockPath } from "@/lib/cms/blocks/operations";
import { findBlock } from "@/lib/cms/blocks/operations";

interface Props {
  /** Preview surface container. The keydown listener filters to this scope. */
  scopeRef: React.RefObject<HTMLElement | null>;
  section: Section;
  /** Currently selected block path key (e.g. "0.2.1"), if any. */
  selectedKey?: string;
  /** Called with the newly inserted block's path key. */
  onInserted?: (newPathKey: string) => void;
}

interface AnchorState {
  rect: DOMRect;
  parentPath: BlockPath;
  atIndex: number;
}

function pathFromKey(key: string): BlockPath {
  return key
    .split(".")
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n));
}

function elementForKey(scope: HTMLElement, key: string): HTMLElement | null {
  return scope.querySelector<HTMLElement>(
    `[data-preview-block-path="${CSS.escape(key)}"]`,
  );
}

function targetAfterKey(scope: HTMLElement, key: string): AnchorState | null {
  const el = elementForKey(scope, key);
  if (!el) return null;
  const path = pathFromKey(key);
  if (path.length === 0) return null;
  const last = path[path.length - 1] ?? 0;
  return {
    rect: el.getBoundingClientRect(),
    parentPath: path.slice(0, -1),
    atIndex: last + 1,
  };
}

function targetFromEditable(
  scope: HTMLElement,
  el: HTMLElement,
): AnchorState | null {
  const blockEl = el.closest<HTMLElement>("[data-preview-block-path]");
  if (!blockEl || !scope.contains(blockEl)) return null;
  const key = blockEl.dataset.previewBlockPath ?? "";
  return targetAfterKey(scope, key);
}

function isEmptyContentEditable(el: Element | null): el is HTMLElement {
  if (!el) return false;
  const node = el as HTMLElement;
  if (!node.isContentEditable) return false;
  return (node.textContent ?? "").trim() === "";
}

export function PreviewSlashMenu({
  scopeRef,
  section,
  selectedKey,
  onInserted,
}: Props) {
  const [state, setState] = useState<AnchorState | null>(null);
  const [query, setQuery] = useState("");
  const lastEditableRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const scope = scopeRef.current;
      if (!scope) return;
      const active = document.activeElement as HTMLElement | null;

      // Case A: empty contentEditable inside preview → open after its block.
      if (active && scope.contains(active) && isEmptyContentEditable(active)) {
        const t = targetFromEditable(scope, active);
        if (!t) return;
        e.preventDefault();
        lastEditableRef.current = active;
        setQuery("");
        setState(t);
        return;
      }

      // Case B: nothing eligible focused, but a block is selected in preview.
      // Only fire if focus is inside scope or on body (avoid hijacking right pane).
      const focusInScope =
        !active || active === document.body || scope.contains(active);
      if (!focusInScope) return;
      // Skip if user is typing in a real input/textarea anywhere.
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA")) return;
      if (active && active.isContentEditable) return; // non-empty editable: let `/` through

      if (selectedKey) {
        const t = targetAfterKey(scope, selectedKey);
        if (!t) return;
        e.preventDefault();
        lastEditableRef.current = null;
        setQuery("");
        setState(t);
        return;
      }

      // Case C: nothing selected — append to section root, anchor on scope.
      const rect = scope.getBoundingClientRect();
      e.preventDefault();
      lastEditableRef.current = null;
      setQuery("");
      setState({
        rect: new DOMRect(rect.left + 24, Math.min(rect.bottom - 40, rect.top + 80), 0, 0),
        parentPath: [],
        atIndex: (section.blocks ?? []).length,
      });
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [scopeRef, section, selectedKey]);

  // Re-anchor on scroll/resize.
  useEffect(() => {
    if (!state) return;
    const reflow = () => {
      const scope = scopeRef.current;
      if (!scope) return;
      const editable = lastEditableRef.current;
      const blockEl = editable
        ? (editable.closest("[data-preview-block-path]") as HTMLElement | null)
        : selectedKey
          ? elementForKey(scope, selectedKey)
          : null;
      if (blockEl) {
        setState((cur) => (cur ? { ...cur, rect: blockEl.getBoundingClientRect() } : cur));
      }
    };
    window.addEventListener("scroll", reflow, true);
    window.addEventListener("resize", reflow);
    return () => {
      window.removeEventListener("scroll", reflow, true);
      window.removeEventListener("resize", reflow);
    };
  }, [state, scopeRef, selectedKey]);

  if (!state) return null;
  if (typeof document === "undefined") return null;

  const top = Math.min(window.innerHeight - 420, state.rect.bottom + 6);
  const left = Math.max(8, Math.min(window.innerWidth - 376, state.rect.left));

  // Resolve the active block for transforms — prefer the editable's owning
  // block, else the currently selected block.
  const scope = scopeRef.current;
  let targetKey: string | undefined;
  if (lastEditableRef.current && scope) {
    const blockEl = lastEditableRef.current.closest<HTMLElement>(
      "[data-preview-block-path]",
    );
    targetKey = blockEl?.dataset.previewBlockPath;
  }
  if (!targetKey) targetKey = selectedKey;
  const targetPath = targetKey ? pathFromKey(targetKey) : [];
  const targetBlock =
    targetPath.length > 0
      ? findBlock(section.blocks ?? [], targetPath)
      : undefined;
  const transformTarget = targetBlock
    ? { block: targetBlock, path: targetPath }
    : undefined;

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
          transformTarget={transformTarget}
        />
      </div>
    </>
  );

  return createPortal(node, document.body);
}
