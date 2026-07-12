import { useEffect, useRef, useState } from "react";
import { Bold, Copy, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Italic, Link2, MessageSquarePlus, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { commentsUi } from "@/lib/cms/comments-store";
import type { AnchorKind, AnchorRef, CommentSurface } from "@/lib/comments/types";

/** If the selection sits inside an editable content-editor block, return its
 *  id + current type so the toolbar can offer formatting. */
function editableBlockFor(range: Range): { blockId: string; blockType: string } | null {
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== document.body) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      const id = el.dataset?.docBlockId;
      if (id && el.isContentEditable) return { blockId: id, blockType: el.dataset.docBlockType ?? "paragraph" };
    }
    node = node.parentNode;
  }
  return null;
}

interface Props {
  surface: CommentSurface;
  pageId?: string;
  /** Optional resolver: given the selection's container, return an anchor ref. */
  resolveAnchor?: (range: Range) => { anchorKind: AnchorKind; anchorRef: AnchorRef } | null;
}

/**
 * Floating toolbar that appears on text selection inside its containing
 * element. Activates on `mouseup` when there's a non-empty range and the
 * selection sits inside its target.
 */
export function SelectionToolbar({ surface, pageId, resolveAnchor }: Props) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [text, setText] = useState("");
  const [range, setRange] = useState<Range | null>(null);
  const [editable, setEditable] = useState<{ blockId: string; blockType: string } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const textRef = useRef("");
  const posRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    function onUp() {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
        rangeRef.current = null;
        textRef.current = "";
        posRef.current = null;
        setPos(null);
        return;
      }
      const r = sel.getRangeAt(0);
      const rect = r.getBoundingClientRect();
      if (rect.width < 2 && rect.height < 2) {
        rangeRef.current = null;
        textRef.current = "";
        posRef.current = null;
        setPos(null);
        return;
      }
      // Skip selections inside the toolbar itself
      if (ref.current && r.commonAncestorContainer instanceof Node && ref.current.contains(r.commonAncestorContainer)) {
        return;
      }
      const nextRange = r.cloneRange();
      const nextText = sel.toString().trim();
      const nextPos = { x: rect.left + rect.width / 2, y: rect.top - 8 };
      rangeRef.current = nextRange;
      textRef.current = nextText;
      posRef.current = nextPos;
      setRange(nextRange);
      setText(nextText);
      setPos(nextPos);
      setEditable(editableBlockFor(r));
    }
    function onDown(e: MouseEvent) {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      setPos(null);
    }
    document.addEventListener("mouseup", onUp);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("mousedown", onDown);
    };
  }, []);

  if (!pos || !text) return null;

  function startComment(withAi = false) {
    const savedRange = rangeRef.current ?? range;
    const savedText = textRef.current || text;
    if (!savedRange || !savedText) return;
    const resolved = resolveAnchor?.(savedRange);
    const anchorKind: AnchorKind = resolved?.anchorKind ?? "selection";
    const anchorRef: AnchorRef = resolved?.anchorRef ?? { text: savedText };
    if (!resolved) anchorRef.text = savedText;
    const rect = savedRange.getBoundingClientRect();
    const fallbackPoint = posRef.current ?? pos ?? { x: window.innerWidth / 2, y: window.innerHeight / 3 };
    const hasRect = rect.width > 0 || rect.height > 0;
    const clientPoint = hasRect
      ? { x: rect.right, y: rect.top + rect.height / 2 }
      : { x: fallbackPoint.x, y: fallbackPoint.y };
    commentsUi.setPending({
      surface,
      pageId,
      anchorKind,
      anchorRef,
      viewport: {
        xPct: ((hasRect ? rect.left : fallbackPoint.x) / window.innerWidth) * 100,
        yPct: ((hasRect ? rect.top : fallbackPoint.y) / window.innerHeight) * 100,
      },
      clientPoint,
      selectionText: savedText,
    });
    
    if (withAi) toast.info("Pick an AI quick action in the composer");
    setPos(null);
  }

  function applyMark(cmd: "bold" | "italic") {
    if (!editable) return;
    // The selection is still live (the toolbar suppresses mousedown), so
    // execCommand applies the mark to it. Force tags, not inline styles.
    document.execCommand("styleWithCSS", false, "false");
    document.execCommand(cmd, false, "");
    window.dispatchEvent(new CustomEvent("bcms:doc-format", { detail: { blockId: editable.blockId } }));
  }

  function turnInto(type: "h1" | "h2" | "h3" | "h4" | "h5" | "h6") {
    if (!editable) return;
    const next = editable.blockType === type ? "paragraph" : type;
    window.dispatchEvent(new CustomEvent("bcms:doc-turn", { detail: { blockId: editable.blockId, type: next } }));
    setPos(null);
  }

  return (
    <div
      ref={ref}
      data-no-comment
      className="pointer-events-auto fixed z-50 flex -translate-x-1/2 -translate-y-full items-center gap-0.5 rounded-md border border-border/70 bg-[color:var(--s2)] p-0.5 text-[11px] shadow-xl"
      style={{ left: pos.x, top: pos.y }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      {editable && (
        <>
          <IconButton title="Bold" onClick={() => applyMark("bold")}>
            <Bold className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Italic" onClick={() => applyMark("italic")}>
            <Italic className="h-3.5 w-3.5" />
          </IconButton>
          <span className="mx-0.5 h-3.5 w-px bg-border/70" />
          <IconButton title="Heading 1" active={editable.blockType === "h1"} onClick={() => turnInto("h1")}>
            <Heading1 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Heading 2" active={editable.blockType === "h2"} onClick={() => turnInto("h2")}>
            <Heading2 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Heading 3" active={editable.blockType === "h3"} onClick={() => turnInto("h3")}>
            <Heading3 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Heading 4" active={editable.blockType === "h4"} onClick={() => turnInto("h4")}>
            <Heading4 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Heading 5" active={editable.blockType === "h5"} onClick={() => turnInto("h5")}>
            <Heading5 className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton title="Heading 6" active={editable.blockType === "h6"} onClick={() => turnInto("h6")}>
            <Heading6 className="h-3.5 w-3.5" />
          </IconButton>
          <span className="mx-0.5 h-3.5 w-px bg-border/70" />
        </>
      )}
      <ToolButton onClick={() => startComment(false)} icon={<MessageSquarePlus className="h-3 w-3" />}>
        Comment
      </ToolButton>
      <ToolButton onClick={() => startComment(true)} icon={<Wand2 className="h-3 w-3 text-violet-400" />}>
        Ask AI
      </ToolButton>
      <span className="mx-0.5 h-3.5 w-px bg-border/70" />
      <ToolButton
        onClick={() => {
          navigator.clipboard.writeText(text);
          toast.success("Text copied");
          setPos(null);
        }}
        icon={<Copy className="h-3 w-3" />}
      >
        Copy
      </ToolButton>
      <ToolButton
        onClick={() => {
          navigator.clipboard.writeText(window.location.href);
          toast.success("Link copied");
          setPos(null);
        }}
        icon={<Link2 className="h-3 w-3" />}
      >
        Link
      </ToolButton>
    </div>
  );
}

function IconButton({
  children,
  title,
  active,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onClick={onClick}
      className={`grid h-6 w-6 place-items-center rounded transition-colors hover:bg-[color:var(--color-row-hover)] ${
        active ? "bg-[color:var(--color-row-hover)] text-foreground" : "text-foreground/85"
      }`}
    >
      {children}
    </button>
  );
}

function ToolButton({
  children,
  icon,
  onClick,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex h-6 items-center gap-1 whitespace-nowrap rounded px-1.5 font-medium text-foreground/85 hover:bg-[color:var(--color-row-hover)]"
    >
      {icon}
      {children}
    </button>
  );
}
