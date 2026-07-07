/**
 * BlockEditor — Notion-style block editor.
 *
 * Each block is an uncontrolled contentEditable element. React owns the
 * block list (type/order/metadata); the DOM owns the in-progress text. We
 * only push text back into React on blur or on structural changes so the
 * caret never jumps mid-edit.
 */
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Code as CodeIcon,
  CornerDownLeft,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  List as ListIcon,
  ListOrdered,
  ListTodo,
  MessageSquareQuote,
  Minus,
  Plus,
  Sparkles,
  Text as TextIcon,
  Trash2,
  Copy as CopyIcon,
  Lightbulb,
} from "lucide-react";
import {
  BLOCK_PLACEHOLDER,
  blockId,
  emptyParagraph,
  parseDoc,
  type DocBlock,
  type DocBlockType,
  type DocValue,
} from "@/lib/cms/blocks/doc";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  value: unknown;
  onChange: (next: DocValue) => void;
  /** Render-time placeholder for the first empty block. */
  placeholder?: string;
}

interface SlashState {
  blockId: string;
  query: string;
  rect: { top: number; left: number };
}

const RECENT_KEY = "bcms.slash.recent";

/* ------------------------------------------------------------------ */
/* Slash menu catalogue                                               */
/* ------------------------------------------------------------------ */

type SlashItem = {
  id: DocBlockType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  category: "Basic" | "Lists" | "Media" | "Advanced";
  keywords?: string[];
};

const SLASH_ITEMS: SlashItem[] = [
  { id: "paragraph", label: "Text", description: "Plain paragraph text", icon: TextIcon, category: "Basic", keywords: ["body", "p"] },
  { id: "h1", label: "Heading 1", description: "Large section heading", icon: Heading1, category: "Basic", keywords: ["title", "h1"] },
  { id: "h2", label: "Heading 2", description: "Medium section heading", icon: Heading2, category: "Basic", keywords: ["h2"] },
  { id: "h3", label: "Heading 3", description: "Small section heading", icon: Heading3, category: "Basic", keywords: ["h3"] },
  { id: "bullet", label: "Bulleted list", description: "Unordered list", icon: ListIcon, category: "Lists", keywords: ["ul", "list"] },
  { id: "numbered", label: "Numbered list", description: "Ordered list", icon: ListOrdered, category: "Lists", keywords: ["ol", "1."] },
  { id: "todo", label: "To-do", description: "Checkbox list", icon: ListTodo, category: "Lists", keywords: ["task", "check"] },
  { id: "quote", label: "Quote", description: "Pull quote or block quote", icon: MessageSquareQuote, category: "Basic", keywords: ["blockquote"] },
  { id: "callout", label: "Callout", description: "Highlighted note with an icon", icon: Lightbulb, category: "Basic", keywords: ["note", "tip"] },
  { id: "divider", label: "Divider", description: "Horizontal rule", icon: Minus, category: "Basic", keywords: ["hr", "line"] },
  { id: "code", label: "Code", description: "Monospaced code block", icon: CodeIcon, category: "Advanced", keywords: ["pre", "snippet"] },
  { id: "image", label: "Image", description: "Insert an image by URL", icon: ImageIcon, category: "Media" },
];

function loadRecent(): DocBlockType[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.slice(0, 5) : [];
  } catch {
    return [];
  }
}
function pushRecent(t: DocBlockType) {
  if (typeof window === "undefined") return;
  const cur = loadRecent().filter((x) => x !== t);
  const next = [t, ...cur].slice(0, 5);
  window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */

export function BlockEditor({ value, onChange, placeholder }: Props) {
  const initial = useMemo(() => parseDoc(value), [value]);
  const [doc, setDoc] = useState<DocValue>(initial);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const focusAfterRenderRef = useRef<{ id: string; toStart?: boolean } | null>(null);

  // When external value changes wholesale (e.g. switching entries), reset.
  useEffect(() => {
    setDoc(parseDoc(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valueIdentity(value)]);

  const commit = useCallback(
    (next: DocValue) => {
      setDoc(next);
      onChange(next);
    },
    [onChange],
  );

  // After structural change, restore focus to the requested block.
  useLayoutEffect(() => {
    const target = focusAfterRenderRef.current;
    if (!target) return;
    focusAfterRenderRef.current = null;
    const el = blockRefs.current.get(target.id);
    if (el) {
      el.focus();
      placeCaret(el, target.toStart ? "start" : "end");
    }
  });

  const updateBlock = (id: string, patch: Partial<DocBlock>) => {
    commit({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    });
  };

  const insertAfter = (id: string, block: DocBlock, focus = true) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const blocks = [...doc.blocks];
    blocks.splice(idx + 1, 0, block);
    if (focus) focusAfterRenderRef.current = { id: block.id, toStart: true };
    commit({ ...doc, blocks });
  };

  const removeBlock = (id: string) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    if (doc.blocks.length === 1) {
      commit({ ...doc, blocks: [emptyParagraph()] });
      return;
    }
    const prev = doc.blocks[idx - 1] ?? doc.blocks[idx + 1];
    const blocks = doc.blocks.filter((b) => b.id !== id);
    if (prev) focusAfterRenderRef.current = { id: prev.id };
    commit({ ...doc, blocks });
  };

  const duplicateBlock = (id: string) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const src = doc.blocks[idx];
    const clone: DocBlock = { ...src, id: blockId() };
    const blocks = [...doc.blocks];
    blocks.splice(idx + 1, 0, clone);
    focusAfterRenderRef.current = { id: clone.id };
    commit({ ...doc, blocks });
  };

  const moveBlock = (id: string, dir: -1 | 1) => {
    const idx = doc.blocks.findIndex((b) => b.id === id);
    const swap = idx + dir;
    if (idx === -1 || swap < 0 || swap >= doc.blocks.length) return;
    const blocks = [...doc.blocks];
    [blocks[idx], blocks[swap]] = [blocks[swap], blocks[idx]];
    focusAfterRenderRef.current = { id };
    commit({ ...doc, blocks });
  };

  const changeType = (id: string, type: DocBlockType) => {
    pushRecent(type);
    if (type === "divider") {
      commit({
        ...doc,
        blocks: doc.blocks.map((b) =>
          b.id === id ? { ...b, type, text: "" } : b,
        ),
      });
      return;
    }
    if (type === "image") {
      const url = window.prompt("Image URL", "");
      commit({
        ...doc,
        blocks: doc.blocks.map((b) =>
          b.id === id ? { ...b, type, src: url ?? "", text: "" } : b,
        ),
      });
      return;
    }
    focusAfterRenderRef.current = { id };
    commit({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    });
  };

  const onSlashSelect = (item: SlashItem) => {
    if (!slash) return;
    // Read the *current* text from the DOM (React state is only synced on
    // blur / structural changes, so the in-progress slash query lives there).
    const el = blockRefs.current.get(slash.blockId);
    const currentText = el?.textContent ?? "";
    const cleaned = currentText.replace(/\/[^\s\/]*$/, "");
    // Sync DOM immediately so the useLayoutEffect's `activeElement` skip
    // doesn't leave the stale "/query" visible.
    if (el && el.textContent !== cleaned) el.textContent = cleaned;
    commit({
      ...doc,
      blocks: doc.blocks.map((x) =>
        x.id === slash.blockId ? { ...x, text: cleaned } : x,
      ),
    });
    setSlash(null);
    changeType(slash.blockId, item.id);
  };


  return (
    <div className="relative">
      {doc.blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          isFirst={i === 0}
          placeholder={i === 0 ? placeholder : undefined}
          refMap={blockRefs}
          onTextInput={(text, rect) => {
            // Detect slash trigger at end of current line.
            const m = text.match(/\/([^\s\/]*)$/);
            if (m) {
              setSlash({
                blockId: b.id,
                query: m[1] ?? "",
                rect: rect ?? { top: 0, left: 0 },
              });
            } else {
              setSlash(null);
            }
          }}
          onCommit={(text) => {
            if (text !== b.text) updateBlock(b.id, { text });
          }}
          onCheck={(checked) => updateBlock(b.id, { checked })}
          onSrcChange={(src) => updateBlock(b.id, { src })}
          onEnter={() => {
            insertAfter(b.id, emptyParagraph());
          }}
          onBackspaceAtStart={() => {
            // Empty: remove. Non-empty: convert to paragraph if it's not already.
            const el = blockRefs.current.get(b.id);
            const text = (el?.textContent ?? "").trim();
            if (!text && b.type !== "image") {
              removeBlock(b.id);
            } else if (b.type !== "paragraph" && b.type !== "image") {
              focusAfterRenderRef.current = { id: b.id, toStart: true };
              commit({
                ...doc,
                blocks: doc.blocks.map((x) =>
                  x.id === b.id ? { ...x, type: "paragraph" } : x,
                ),
              });
            }
          }}
          onMove={(dir) => moveBlock(b.id, dir)}
          onDuplicate={() => duplicateBlock(b.id)}
          onDelete={() => removeBlock(b.id)}
          onChangeType={(t) => changeType(b.id, t)}
          onInsertAfter={() => insertAfter(b.id, emptyParagraph())}
          onSlashEscape={() => setSlash(null)}
        />
      ))}
      {slash && (
        <SlashMenu
          state={slash}
          onSelect={onSlashSelect}
          onClose={() => setSlash(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Single block row                                                    */
/* ------------------------------------------------------------------ */

interface RowProps {
  block: DocBlock;
  isFirst: boolean;
  placeholder?: string;
  refMap: React.MutableRefObject<Map<string, HTMLElement>>;
  onTextInput: (text: string, rect: { top: number; left: number } | null) => void;
  onCommit: (text: string) => void;
  onCheck: (checked: boolean) => void;
  onSrcChange: (src: string) => void;
  onEnter: () => void;
  onBackspaceAtStart: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onChangeType: (t: DocBlockType) => void;
  onInsertAfter: () => void;
  onSlashEscape: () => void;
}

function BlockRow({
  block,
  placeholder,
  refMap,
  onTextInput,
  onCommit,
  onCheck,
  onSrcChange,
  onEnter,
  onBackspaceAtStart,
  onMove,
  onDuplicate,
  onDelete,
  onChangeType,
  onInsertAfter,
  onSlashEscape,
}: RowProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);

  // Set up ref map.
  const setRef = (el: HTMLDivElement | null) => {
    editableRef.current = el;
    if (el) refMap.current.set(block.id, el);
    else refMap.current.delete(block.id);
  };

  // Sync DOM text when the block's text changes from outside (type swap,
  // initial mount). Avoid clobbering during active editing.
  useLayoutEffect(() => {
    const el = editableRef.current;
    if (!el) return;
    const incoming = block.text ?? "";
    if (document.activeElement === el) return;
    if (el.textContent !== incoming) el.textContent = incoming;
  }, [block.text, block.type]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Move / duplicate shortcuts.
    if ((e.metaKey || e.ctrlKey) && e.key === "d") {
      e.preventDefault();
      onCommitText();
      onDuplicate();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown")) {
      e.preventDefault();
      onCommitText();
      onMove(e.key === "ArrowUp" ? -1 : 1);
      return;
    }
    if (e.key === "Escape") {
      onSlashEscape();
      return;
    }
    if (e.key === "Enter" && !e.shiftKey) {
      if (block.type === "code") return; // multi-line in code blocks
      e.preventDefault();
      onCommitText();
      onEnter();
      return;
    }
    if (e.key === "Backspace") {
      // Only collapse if caret is at offset 0 and selection is empty.
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      const r = sel.getRangeAt(0);
      if (!r.collapsed) return;
      const el = editableRef.current;
      if (!el) return;
      const atStart = isCaretAtStart(el);
      if (atStart) {
        e.preventDefault();
        onCommitText();
        onBackspaceAtStart();
      }
    }
  };

  const onCommitText = () => {
    const el = editableRef.current;
    if (!el) return;
    onCommit(el.textContent ?? "");
  };

  const handleInput = () => {
    const el = editableRef.current;
    if (!el) return;
    const text = el.textContent ?? "";
    // Only report rect when slash is active in this row.
    const sel = window.getSelection();
    let rect: { top: number; left: number } | null = null;
    if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0).getBoundingClientRect();
      // Viewport coords — paired with position:fixed on the slash menu.
      rect = { top: r.bottom, left: r.left };
    }
    onTextInput(text, rect);
  };

  return (
    <div className="group/block relative -mx-2 flex gap-1 rounded px-2 py-0.5 hover:bg-[color:var(--row-hover)]/30">
      {/* Hover handles */}
      <div className="absolute left-[-44px] top-1 hidden items-center gap-0.5 text-muted-foreground group-hover/block:flex">
        <button
          type="button"
          title="Insert below (Enter)"
          onClick={() => {
            onCommitText();
            onInsertAfter();
          }}
          className="grid h-6 w-6 place-items-center rounded transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Block options"
              className="grid h-6 w-6 cursor-grab place-items-center rounded transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
            >
              <GripVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <DropdownMenuItem onSelect={onDuplicate}>
              <CopyIcon className="mr-2 h-3.5 w-3.5" /> Duplicate
              <span className="ml-auto text-[10px] text-muted-foreground">⌘D</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove(-1)}>
              Move up
              <span className="ml-auto text-[10px] text-muted-foreground">⌘⇧↑</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onMove(1)}>
              Move down
              <span className="ml-auto text-[10px] text-muted-foreground">⌘⇧↓</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onChangeType("paragraph")}>
              Turn into text
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeType("h2")}>
              Turn into heading
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeType("quote")}>
              Turn into quote
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onChangeType("callout")}>
              Turn into callout
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={onDelete}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <BlockBody
        block={block}
        placeholder={placeholder ?? BLOCK_PLACEHOLDER[block.type]}
        editableRef={setRef}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        onBlur={onCommitText}
        onCheck={onCheck}
        onSrcChange={onSrcChange}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Block-type renderers                                                */
/* ------------------------------------------------------------------ */

interface BodyProps {
  block: DocBlock;
  placeholder: string;
  editableRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onBlur: () => void;
  onCheck: (checked: boolean) => void;
  onSrcChange: (src: string) => void;
}

function BlockBody({
  block,
  placeholder,
  editableRef,
  onKeyDown,
  onInput,
  onBlur,
  onCheck,
  onSrcChange,
}: BodyProps) {
  if (block.type === "divider") {
    return (
      <div className="w-full py-3">
        <hr className="border-t border-border" />
      </div>
    );
  }
  if (block.type === "image") {
    return (
      <div className="w-full py-2">
        {block.src ? (
          <figure className="overflow-hidden rounded-lg border border-border bg-muted">
            <img src={block.src} alt={block.alt ?? ""} className="block max-h-[480px] w-full object-cover" />
          </figure>
        ) : (
          <div className="grid place-items-center rounded-lg border border-dashed border-border bg-muted/40 px-6 py-10 text-center">
            <ImageIcon className="mb-2 h-5 w-5 text-muted-foreground" />
            <input
              type="url"
              placeholder="Paste an image URL…"
              defaultValue={block.src ?? ""}
              onBlur={(e) => onSrcChange(e.target.value)}
              className="h-8 w-72 rounded-md border border-border bg-background px-2 text-[12.5px] focus:border-primary focus:outline-none"
            />
          </div>
        )}
      </div>
    );
  }

  const editable = (
    <Editable
      block={block}
      editableRef={editableRef}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onBlur={onBlur}
      placeholder={placeholder}
    />
  );

  if (block.type === "todo") {
    return (
      <div className="flex w-full gap-2 py-1">
        <input
          type="checkbox"
          checked={!!block.checked}
          onChange={(e) => onCheck(e.target.checked)}
          className="mt-1.5 h-3.5 w-3.5 shrink-0 accent-[color:var(--primary)]"
        />
        <div className={`flex-1 ${block.checked ? "text-muted-foreground line-through" : ""}`}>
          {editable}
        </div>
      </div>
    );
  }
  if (block.type === "bullet") {
    return (
      <div className="flex w-full gap-2 py-0.5">
        <span className="mt-[10px] inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-foreground/70" />
        <div className="flex-1">{editable}</div>
      </div>
    );
  }
  if (block.type === "numbered") {
    return (
      <div className="flex w-full gap-2 py-0.5">
        <span className="mt-[2px] w-5 shrink-0 text-right text-[14px] text-muted-foreground tabular-nums">
          •
        </span>
        <div className="flex-1">{editable}</div>
      </div>
    );
  }
  if (block.type === "quote") {
    return (
      <div className="border-l-2 border-foreground/30 pl-4 py-1 italic">{editable}</div>
    );
  }
  if (block.type === "callout") {
    return (
      <div className="flex w-full gap-3 rounded-lg border border-border bg-muted/40 px-4 py-3">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
        <div className="flex-1">{editable}</div>
      </div>
    );
  }
  if (block.type === "code") {
    return (
      <div className="w-full overflow-hidden rounded-lg border border-border bg-[color:var(--muted)] py-2">
        <div className="px-4 py-1 font-mono text-[12.5px] leading-relaxed">{editable}</div>
      </div>
    );
  }
  return editable;
}

function Editable({
  block,
  editableRef,
  onKeyDown,
  onInput,
  onBlur,
  placeholder,
}: {
  block: DocBlock;
  editableRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onBlur: () => void;
  placeholder: string;
}) {
  const cls = (() => {
    switch (block.type) {
      case "h1":
        return "text-[28px] font-semibold leading-tight tracking-tight";
      case "h2":
        return "text-[22px] font-semibold leading-snug tracking-tight";
      case "h3":
        return "text-[17px] font-semibold leading-snug";
      case "code":
        return "font-mono text-[12.5px]";
      default:
        return "text-[15px] leading-relaxed";
    }
  })();
  return (
    <div
      ref={editableRef}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onBlur={onBlur}
      className={`block-editable w-full outline-none ${cls}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Slash menu                                                          */
/* ------------------------------------------------------------------ */

function SlashMenu({
  state,
  onSelect,
  onClose,
}: {
  state: SlashState;
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);

  const items = useMemo(() => {
    const q = state.query.trim().toLowerCase();
    if (!q) {
      const recent = loadRecent()
        .map((id) => SLASH_ITEMS.find((x) => x.id === id))
        .filter(Boolean) as SlashItem[];
      return { recent, results: SLASH_ITEMS };
    }
    const results = SLASH_ITEMS.filter((it) => {
      const hay = `${it.label} ${it.description} ${(it.keywords ?? []).join(" ")}`.toLowerCase();
      return hay.includes(q);
    });
    return { recent: [] as SlashItem[], results };
  }, [state.query]);

  const flat = [...items.recent, ...items.results];

  useEffect(() => {
    setActive(0);
  }, [state.query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(flat.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = flat[active];
        if (item) onSelect(item);
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [flat, active, onSelect, onClose]);

  if (flat.length === 0) return null;

  const categorised: Record<string, SlashItem[]> = {};
  for (const it of items.results) {
    (categorised[it.category] ??= []).push(it);
  }

  return (
    <div
      style={{
        position: "fixed",
        top: state.rect.top + 6,
        left: state.rect.left,
      }}
      className="z-50 w-[320px] overflow-hidden rounded-lg border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
    >
      <div className="max-h-[320px] overflow-y-auto py-1">
        {items.recent.length > 0 && (
          <Section title="Recently used">
            {items.recent.map((it, i) => (
              <SlashRow
                key={`r-${it.id}`}
                item={it}
                active={active === i}
                onMouseEnter={() => setActive(i)}
                onClick={() => onSelect(it)}
              />
            ))}
          </Section>
        )}
        {Object.entries(categorised).map(([cat, list]) => (
          <Section key={cat} title={cat}>
            {list.map((it) => {
              const idx = flat.indexOf(it);
              return (
                <SlashRow
                  key={it.id}
                  item={it}
                  active={active === idx}
                  onMouseEnter={() => setActive(idx)}
                  onClick={() => onSelect(it)}
                />
              );
            })}
          </Section>
        ))}
      </div>
      <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" /> select
        </span>
        <span className="inline-flex items-center gap-1">
          <Sparkles className="h-3 w-3" /> type to filter
        </span>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-1.5 pb-1">
      <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}

function SlashRow({
  item,
  active,
  onMouseEnter,
  onClick,
}: {
  item: SlashItem;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focus
        onClick();
      }}
      className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
        active ? "bg-[color:var(--row-hover)]" : "hover:bg-[color:var(--row-hover)]"
      }`}
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border bg-background text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-foreground">{item.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{item.description}</span>
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* utils                                                               */
/* ------------------------------------------------------------------ */

function valueIdentity(v: unknown): string {
  // Cheap identity: structural enough to detect entry swaps but stable
  // against in-place text edits (we own the doc state once mounted).
  if (typeof v === "string") return `s:${v.length}`;
  if (v && typeof v === "object" && Array.isArray((v as DocValue).blocks)) {
    return `d:${(v as DocValue).blocks.length}:${(v as DocValue).blocks[0]?.id ?? ""}`;
  }
  return "x";
}

function placeCaret(el: HTMLElement, where: "start" | "end") {
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(where === "start");
  const sel = window.getSelection();
  if (!sel) return;
  sel.removeAllRanges();
  sel.addRange(range);
}

function isCaretAtStart(el: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return false;
  const r = sel.getRangeAt(0);
  if (!r.collapsed) return false;
  if (r.startOffset !== 0) return false;
  // Walk up — if we're at offset 0 of the first text node inside `el`,
  // treat as start.
  let node: Node | null = r.startContainer;
  while (node && node !== el) {
    if (node.previousSibling) return false;
    node = node.parentNode;
  }
  return true;
}

// Caret coordinates are page-relative; the menu is absolute-positioned
// inside the editor wrapper. Translate by the wrapper's page offset.
let _editorOffset = { top: 0, left: 0 };
export function setEditorOffset(t: number, l: number) {
  _editorOffset = { top: t, left: l };
}
function getEditorTop() {
  return _editorOffset.top;
}
function getEditorLeft() {
  return _editorOffset.left;
}
