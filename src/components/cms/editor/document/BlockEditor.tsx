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
  Award,
  Bookmark,
  Boxes,
  ChevronRight,
  Code as CodeIcon,
  CornerDownLeft,
  CreditCard,
  Figma,
  Globe,
  GripVertical,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Image as ImageIcon,
  ImagePlus,
  Link2,
  List as ListIcon,
  ListChecks,
  ListOrdered,
  ListTodo,
  Mail,
  Megaphone,
  MessagesSquare,
  MessageSquareQuote,
  Minimize2,
  Minus,
  MousePointerClick,
  PenLine,
  Plus,
  Quote,
  Search,
  Sparkles,
  StretchHorizontal,
  Table as TableIcon,
  Text as TextIcon,
  Trash2,
  TrendingUp,
  Copy as CopyIcon,
  UserRound,
  Video,
  Wand2,
  X,
  Youtube,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  BLOCK_PLACEHOLDER,
  blockId,
  emptyParagraph,
  hasInlineMarkup,
  isRichTextType,
  parseDoc,
  sanitizeInlineHtml,
  type DocBlock,
  type DocBlockType,
  type DocValue,
} from "@/lib/cms/blocks/doc";
import {
  AI_COMMANDS,
  COMPONENT_CATALOG,
  COMPONENT_GROUPS,
  CALLOUT_TONES,
  componentDef,
  detectEmbed,
  fakeBookmarkMeta,
  simulateAi,
  toneOf,
  type AiCommand,
} from "@/lib/cms/blocks/rich-blocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCMS } from "@/lib/cms/store";
import { useProjectPresence, type PresencePeer } from "@/lib/workspace/presence-store";
import { PersonTooltipForMember } from "@/components/cms/workflow/PersonTooltip";

interface Props {
  value: unknown;
  onChange: (next: DocValue) => void;
  /** Render-time placeholder for the first empty block. */
  placeholder?: string;
  /** Context used to show which teammate is on which paragraph. */
  projectId?: string;
  entryId?: string;
}

interface SlashState {
  blockId: string;
  query: string;
  rect: { top: number; left: number };
}

/* ------------------------------------------------------------------ */
/* Slash menu catalogue                                               */
/* ------------------------------------------------------------------ */

type SlashCategory = "AI" | "Basic" | "Lists" | "Media" | "Embeds" | "Components" | "Advanced";

type SlashAction =
  | { kind: "block"; type: DocBlockType }
  | { kind: "widget"; type: DocBlockType }
  | { kind: "component"; key: string }
  | { kind: "ai"; cmd: AiCommand };

type SlashItem = {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  category: SlashCategory;
  keywords?: string[];
  action: SlashAction;
};

const CATALOG_ICONS: Record<string, LucideIcon> = {
  PenLine, ListChecks, Wand2, StretchHorizontal, Minimize2, ImagePlus,
  Megaphone, Mail, CreditCard, Quote, TrendingUp, UserRound, Award, MessagesSquare,
};

const AI_ITEMS: SlashItem[] = AI_COMMANDS.map((cmd) => ({
  id: `ai:${cmd.id}`, label: cmd.label, description: cmd.desc,
  icon: CATALOG_ICONS[cmd.icon] ?? Sparkles, category: "AI",
  keywords: ["ai", cmd.id], action: { kind: "ai", cmd },
}));

const BASIC_ITEMS: SlashItem[] = [
  { id: "paragraph", label: "Text", description: "Plain paragraph text", icon: TextIcon, category: "Basic", keywords: ["body", "p"], action: { kind: "block", type: "paragraph" } },
  { id: "h1", label: "Heading 1", description: "Large section heading", icon: Heading1, category: "Basic", keywords: ["title", "h1"], action: { kind: "block", type: "h1" } },
  { id: "h2", label: "Heading 2", description: "Medium section heading", icon: Heading2, category: "Basic", keywords: ["h2"], action: { kind: "block", type: "h2" } },
  { id: "h3", label: "Heading 3", description: "Small section heading", icon: Heading3, category: "Basic", keywords: ["h3"], action: { kind: "block", type: "h3" } },
  { id: "h4", label: "Heading 4", description: "Sub-heading", icon: Heading4, category: "Basic", keywords: ["h4"], action: { kind: "block", type: "h4" } },
  { id: "h5", label: "Heading 5", description: "Minor heading", icon: Heading5, category: "Basic", keywords: ["h5"], action: { kind: "block", type: "h5" } },
  { id: "h6", label: "Heading 6", description: "Smallest heading", icon: Heading6, category: "Basic", keywords: ["h6"], action: { kind: "block", type: "h6" } },
  { id: "quote", label: "Quote", description: "Pull quote or block quote", icon: MessageSquareQuote, category: "Basic", keywords: ["blockquote"], action: { kind: "block", type: "quote" } },
  { id: "callout", label: "Callout", description: "Highlighted note with a tone", icon: Lightbulb, category: "Basic", keywords: ["note", "tip", "info"], action: { kind: "block", type: "callout" } },
  { id: "toggle", label: "Toggle", description: "Collapsible heading and body", icon: ChevronRight, category: "Basic", keywords: ["accordion", "collapse", "details"], action: { kind: "block", type: "toggle" } },
  { id: "divider", label: "Divider", description: "Horizontal rule", icon: Minus, category: "Basic", keywords: ["hr", "line"], action: { kind: "block", type: "divider" } },
];

const LIST_ITEMS: SlashItem[] = [
  { id: "bullet", label: "Bulleted list", description: "Unordered list", icon: ListIcon, category: "Lists", keywords: ["ul", "list"], action: { kind: "block", type: "bullet" } },
  { id: "numbered", label: "Numbered list", description: "Ordered list", icon: ListOrdered, category: "Lists", keywords: ["ol", "1."], action: { kind: "block", type: "numbered" } },
  { id: "todo", label: "To-do", description: "Checkbox list", icon: ListTodo, category: "Lists", keywords: ["task", "check"], action: { kind: "block", type: "todo" } },
];

const MEDIA_ITEMS: SlashItem[] = [
  { id: "image", label: "Image", description: "Insert an image by URL", icon: ImageIcon, category: "Media", action: { kind: "widget", type: "image" } },
  { id: "video", label: "Video", description: "Embed a video by URL", icon: Video, category: "Media", keywords: ["mp4", "player"], action: { kind: "widget", type: "video" } },
];

const EMBED_ITEMS: SlashItem[] = [
  { id: "embed", label: "Embed", description: "YouTube, Loom, Figma, CodePen, and more", icon: Youtube, category: "Embeds", keywords: ["youtube", "loom", "figma", "iframe", "codepen", "vimeo"], action: { kind: "widget", type: "embed" } },
  { id: "bookmark", label: "Bookmark", description: "A rich link preview card", icon: Bookmark, category: "Embeds", keywords: ["link", "url", "preview"], action: { kind: "widget", type: "bookmark" } },
  { id: "figma", label: "Figma", description: "Embed a Figma file or prototype", icon: Figma, category: "Embeds", keywords: ["design", "prototype"], action: { kind: "widget", type: "embed" } },
];

const ADVANCED_ITEMS: SlashItem[] = [
  { id: "code", label: "Code", description: "Monospaced code block", icon: CodeIcon, category: "Advanced", keywords: ["pre", "snippet"], action: { kind: "block", type: "code" } },
  { id: "table", label: "Table", description: "A simple editable table", icon: TableIcon, category: "Advanced", keywords: ["grid", "rows"], action: { kind: "widget", type: "table" } },
  { id: "button", label: "Button", description: "A call to action link", icon: MousePointerClick, category: "Advanced", keywords: ["cta", "link"], action: { kind: "widget", type: "button" } },
];

const COMPONENT_ITEMS: SlashItem[] = COMPONENT_CATALOG.map((c) => ({
  id: `cmp:${c.key}`, label: c.label, description: c.desc,
  icon: CATALOG_ICONS[c.icon] ?? Boxes, category: "Components",
  keywords: ["component", "instance", c.key], action: { kind: "component", key: c.key },
}));

// Everything the slash menu can insert, used for global fuzzy search.
const SLASH_ITEMS: SlashItem[] = [
  ...AI_ITEMS, ...BASIC_ITEMS, ...LIST_ITEMS, ...MEDIA_ITEMS,
  ...EMBED_ITEMS, ...ADVANCED_ITEMS, ...COMPONENT_ITEMS,
];

const byId = (id: string) => SLASH_ITEMS.find((i) => i.id === id);

// The block set shown directly at the root of the menu (basics first). AI and
// Components are collapsed into single expandable rows so the root stays short
// and can scale to hundreds of components.
const ROOT_BLOCKS: SlashItem[] = [
  "paragraph", "h1", "h2", "h3", "h4", "h5", "h6", "table",
  "quote", "callout", "bullet", "numbered", "todo", "toggle", "divider", "code", "image",
].map(byId).filter(Boolean) as SlashItem[];

function matchItem(it: SlashItem, q: string): boolean {
  const hay = `${it.label} ${it.description} ${(it.keywords ?? []).join(" ")}`.toLowerCase();
  return hay.includes(q);
}

function widgetDefaults(type: DocBlockType): Partial<DocBlock> {
  switch (type) {
    case "image":
      return { type, src: "" };
    case "video":
      return { type, url: "" };
    case "embed":
      return { type, url: "" };
    case "bookmark":
      return { type, url: "" };
    case "button":
      return { type, label: "Get started", href: "#", variant: "primary" };
    case "table":
      return { type, rows: [["Column 1", "Column 2"], ["", ""]], hasHeader: true };
    default:
      return { type };
  }
}

/** Offline placeholder image for the "generate image" AI command. */
function gradientImageDataUri(seed: string): string {
  const hue = (seed.charCodeAt(seed.length - 1) * 47) % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'>` +
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
    `<stop offset='0' stop-color='hsl(${hue},80%,60%)'/>` +
    `<stop offset='1' stop-color='hsl(${(hue + 60) % 360},80%,55%)'/>` +
    `</linearGradient></defs><rect width='1200' height='630' fill='url(#g)'/></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ------------------------------------------------------------------ */
/* Main editor                                                         */
/* ------------------------------------------------------------------ */

export function BlockEditor({ value, onChange, placeholder, projectId, entryId }: Props) {
  const initial = useMemo(() => parseDoc(value), [value]);
  const [doc, setDoc] = useState<DocValue>(initial);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [aiPrompt, setAiPrompt] = useState<{ blockId: string; cmd: AiCommand; base: DocBlock[]; rect: { top: number; left: number } } | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const focusAfterRenderRef = useRef<{ id: string; toStart?: boolean } | null>(null);

  // Simulated collaborators: map each active teammate on this entry to a block.
  const allPeers = useProjectPresence(projectId);
  const blockPeers = useMemo(() => {
    const map = new Map<string, PresencePeer[]>();
    if (!entryId || doc.blocks.length === 0) return map;
    for (const p of allPeers) {
      if (p.entryId !== entryId || p.status !== "active") continue;
      // Only show a paragraph avatar when they're actually in the body. When
      // they move to a structured field, the Details section shows their
      // avatar there instead, so we avoid double-marking the same person.
      if (p.fieldName && !/body|content|article|post/i.test(p.fieldName)) continue;
      const b = doc.blocks[(p.blockSeed ?? 0) % doc.blocks.length];
      if (!b) continue;
      const arr = map.get(b.id) ?? [];
      arr.push(p);
      map.set(b.id, arr);
    }
    return map;
  }, [allPeers, entryId, doc.blocks]);

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
    if (type === "divider") {
      commit({
        ...doc,
        blocks: doc.blocks.map((b) => (b.id === id ? { ...b, type, text: "" } : b)),
      });
      return;
    }
    focusAfterRenderRef.current = { id };
    commit({
      ...doc,
      blocks: doc.blocks.map((b) => (b.id === id ? { ...b, type } : b)),
    });
  };

  /* --- slash dispatch: the current (now empty) block becomes the target --- */

  // Insert a self-contained widget for the block at `id`. If that block still
  // holds text, keep it and drop the widget on a new line below; if it's empty
  // (just the "/query"), replace it in place. Always leave a trailing paragraph
  // so typing can continue.
  const replaceWithWidget = (base: DocBlock[], id: string, patch: Partial<DocBlock>) => {
    const idx = base.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const hadText = (base[idx].text ?? "").trim().length > 0;
    // Widgets that open their own URL input keep focus there; others jump the
    // caret to the trailing paragraph so typing continues below.
    const selfFocuses = patch.type === "embed" || patch.type === "video" || patch.type === "bookmark";
    const trailing = emptyParagraph();
    const blocks = [...base];
    if (hadText) {
      const widget: DocBlock = { id: blockId(), type: patch.type ?? "paragraph", ...patch };
      blocks.splice(idx + 1, 0, widget, trailing);
    } else {
      blocks[idx] = { ...base[idx], text: "", checked: undefined, ...patch };
      blocks.splice(idx + 1, 0, trailing);
    }
    if (!selfFocuses) focusAfterRenderRef.current = { id: trailing.id, toStart: true };
    commit({ ...doc, blocks });
  };

  const runAi = (base: DocBlock[], id: string, cmd: AiCommand, prompt?: string) => {
    const idx = base.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const priorText = base.slice(0, idx + 1).map((b) => b.text ?? "").filter(Boolean).join(" ");
    const selfText = base[idx].text ?? "";
    const context = cmd.needsPrompt ? (prompt ?? "") : cmd.mode === "replace" ? selfText : priorText;
    const out = simulateAi(cmd, context);

    if (cmd.mode === "image") {
      const p = (prompt ?? "").trim();
      replaceWithWidget(base, id, {
        type: "image",
        src: gradientImageDataUri(p || id),
        alt: p || "AI generated image",
        text: p ? `AI image: ${p} (demo)` : "AI generated image (demo)",
      });
      return;
    }
    if (cmd.mode === "replace") {
      focusAfterRenderRef.current = { id };
      commit({ ...doc, blocks: base.map((b) => (b.id === id ? { ...b, text: out } : b)) });
      return;
    }
    // append / callout: insert a new block after
    const block: DocBlock =
      cmd.mode === "callout"
        ? { id: blockId(), type: "callout", tone: "info", text: out }
        : { id: blockId(), type: "paragraph", text: out };
    const blocks = [...base];
    blocks.splice(idx + 1, 0, block);
    focusAfterRenderRef.current = { id: block.id };
    commit({ ...doc, blocks });
  };

  const onSlashSelect = (item: SlashItem) => {
    if (!slash) return;
    const id = slash.blockId;
    // The in-progress "/query" lives in the DOM; clean it before acting.
    const el = blockRefs.current.get(id);
    const cleaned = (el?.textContent ?? "").replace(/\/[^\s\/]*$/, "");
    if (el && el.textContent !== cleaned) el.textContent = cleaned;
    const base = doc.blocks.map((b) => (b.id === id ? { ...b, text: cleaned } : b));
    setSlash(null);

    const a = item.action;
    if (a.kind === "block") {
      commit({ ...doc, blocks: base });
      changeType(id, a.type);
    } else if (a.kind === "widget") {
      replaceWithWidget(base, id, widgetDefaults(a.type));
    } else if (a.kind === "component") {
      const def = componentDef(a.key);
      const d = def?.defaults() ?? {};
      replaceWithWidget(base, id, {
        type: "component", component: a.key, title: d.title, desc: d.desc, componentProps: d.props ?? {},
      });
    } else if (a.cmd.needsPrompt) {
      // Commit the cleaned text now, then ask for a prompt before running.
      commit({ ...doc, blocks: base });
      setAiPrompt({ blockId: id, cmd: a.cmd, base, rect: slash.rect });
    } else {
      runAi(base, id, a.cmd);
    }
  };

  // Bridge from the shared text-selection toolbar (SelectionToolbar). It
  // applies bold/italic to the live DOM via execCommand, then asks us to
  // persist the block's HTML; and it turns a block into a heading. Keep the
  // latest handlers in a ref so listeners never go stale.
  const bridgeRef = useRef({ changeType, updateBlock, blockRefs });
  bridgeRef.current = { changeType, updateBlock, blockRefs };
  useEffect(() => {
    function onTurn(e: Event) {
      const { blockId: bid, type } = (e as CustomEvent).detail ?? {};
      const { changeType, blockRefs } = bridgeRef.current;
      if (bid && type && blockRefs.current.has(bid)) changeType(bid, type as DocBlockType);
    }
    function onFormat(e: Event) {
      const { blockId: bid } = (e as CustomEvent).detail ?? {};
      const { updateBlock, blockRefs } = bridgeRef.current;
      const el = blockRefs.current.get(bid);
      if (!el) return;
      const html = sanitizeInlineHtml(el.innerHTML);
      updateBlock(bid, { text: hasInlineMarkup(html) ? html : (el.textContent ?? "") });
    }
    window.addEventListener("bcms:doc-turn", onTurn);
    window.addEventListener("bcms:doc-format", onFormat);
    return () => {
      window.removeEventListener("bcms:doc-turn", onTurn);
      window.removeEventListener("bcms:doc-format", onFormat);
    };
  }, []);

  return (
    <div className="relative">
      {doc.blocks.map((b, i) => (
        <BlockRow
          key={b.id}
          block={b}
          isFirst={i === 0}
          placeholder={i === 0 ? placeholder : undefined}
          refMap={blockRefs}
          peers={blockPeers.get(b.id)}
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
          onPatch={(patch) => updateBlock(b.id, patch)}
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
          onClose={() => {
            // Drop the leftover "/" (and any query typed into the menu) and
            // return the caret to the block.
            const id = slash.blockId;
            const el = blockRefs.current.get(id);
            if (el) {
              const cleaned = (el.textContent ?? "").replace(/\/[^\s\/]*$/, "");
              if (el.textContent !== cleaned) {
                el.textContent = cleaned;
                commit({ ...doc, blocks: doc.blocks.map((b) => (b.id === id ? { ...b, text: cleaned } : b)) });
              }
              focusAfterRenderRef.current = { id };
            }
            setSlash(null);
          }}
        />
      )}
      {aiPrompt && (
        <AiPromptPanel
          cmd={aiPrompt.cmd}
          rect={aiPrompt.rect}
          onCancel={() => setAiPrompt(null)}
          onSubmit={(text) => {
            runAi(aiPrompt.base, aiPrompt.blockId, aiPrompt.cmd, text);
            setAiPrompt(null);
          }}
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
  peers?: PresencePeer[];
  onTextInput: (text: string, rect: { top: number; left: number } | null) => void;
  onCommit: (text: string) => void;
  onCheck: (checked: boolean) => void;
  onSrcChange: (src: string) => void;
  onPatch: (patch: Partial<DocBlock>) => void;
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
  peers,
  onTextInput,
  onCommit,
  onCheck,
  onSrcChange,
  onPatch,
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
    // Blocks with inline formatting render as HTML; plain text stays plain
    // (so raw "<" / "&" a writer types can't be misread as markup).
    if (isRichTextType(block.type) && hasInlineMarkup(incoming)) {
      if (el.innerHTML !== incoming) el.innerHTML = incoming;
    } else if (el.textContent !== incoming) {
      el.textContent = incoming;
    }
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
    if (isRichTextType(block.type)) {
      const html = sanitizeInlineHtml(el.innerHTML);
      // Keep it plain unless real inline formatting is present.
      onCommit(hasInlineMarkup(html) ? html : (el.textContent ?? ""));
    } else {
      onCommit(el.textContent ?? "");
    }
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
      {/* Live collaborators on this paragraph */}
      {peers && peers.length > 0 && (
        <div className="absolute left-[-64px] top-1 hidden items-center sm:flex">
          {peers.slice(0, 3).map((p) => (
            <PresenceDot key={p.id} peer={p} />
          ))}
        </div>
      )}
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
        onPatch={onPatch}
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
  onPatch: (patch: Partial<DocBlock>) => void;
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
  onPatch,
}: BodyProps) {
  // Rich, self-contained widget blocks (no inline text editing).
  if (block.type === "embed" || block.type === "video") return <EmbedBlock block={block} onPatch={onPatch} />;
  if (block.type === "bookmark") return <BookmarkBlock block={block} onPatch={onPatch} />;
  if (block.type === "button") return <ButtonBlock block={block} onPatch={onPatch} />;
  if (block.type === "table") return <TableBlock block={block} onPatch={onPatch} />;
  if (block.type === "component") return <ComponentBlock block={block} onPatch={onPatch} />;
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
    const t = toneOf(block.tone);
    return (
      <div className={`group/callout relative flex w-full gap-3 rounded-lg border ${t.ring} ${t.bg} px-4 py-3`}>
        <span className="mt-0.5 shrink-0 text-[15px] leading-none">{block.emoji || t.emoji}</span>
        <div className="flex-1">{editable}</div>
        <div className="absolute right-2 top-2 hidden items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-sm group-hover/callout:flex">
          {CALLOUT_TONES.map((tn) => (
            <button
              key={tn.id}
              type="button"
              title={tn.label}
              onMouseDown={(e) => {
                e.preventDefault();
                onPatch({ tone: tn.id, emoji: tn.emoji });
              }}
              className={`grid h-5 w-5 place-items-center rounded text-[11px] transition-colors hover:bg-[color:var(--row-hover)] ${block.tone === tn.id ? "ring-1 ring-primary" : ""}`}
            >
              {tn.emoji}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (block.type === "toggle") {
    const open = block.open ?? true;
    return (
      <div className="w-full py-0.5">
        <div className="flex w-full items-start gap-1">
          <button
            type="button"
            title={open ? "Collapse" : "Expand"}
            onMouseDown={(e) => {
              e.preventDefault();
              onPatch({ open: !open });
            }}
            className="mt-[3px] grid h-5 w-5 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-90" : ""}`} />
          </button>
          <div className="flex-1 font-medium">{editable}</div>
        </div>
        {open && (
          <div className="ml-6 mt-1 border-l border-border pl-3">
            <ToggleBody block={block} onPatch={onPatch} />
          </div>
        )}
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
      case "h4":
        return "text-[15px] font-semibold leading-snug";
      case "h5":
        return "text-[13.5px] font-semibold uppercase tracking-wide leading-snug";
      case "h6":
        return "text-[12px] font-semibold uppercase tracking-wider text-muted-foreground leading-snug";
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
      data-doc-block-id={block.id}
      data-doc-block-type={block.type}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onBlur={onBlur}
      className={`block-editable w-full outline-none ${cls}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Rich widget blocks                                                  */
/* ------------------------------------------------------------------ */

type WidgetProps = { block: DocBlock; onPatch: (patch: Partial<DocBlock>) => void };

/** Empty-state URL capture shared by embed / video / bookmark. */
function UrlInput({
  icon: Icon,
  label,
  placeholder,
  onSubmit,
}: {
  icon: LucideIcon;
  label: string;
  placeholder: string;
  onSubmit: (url: string) => void;
}) {
  const [v, setV] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const commit = () => {
    const url = v.trim();
    if (url) onSubmit(url);
  };
  return (
    <div className="my-1 flex items-center gap-2.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="hidden shrink-0 text-[12px] font-medium text-muted-foreground sm:inline">{label}</span>
      <input
        ref={inputRef}
        type="url"
        value={v}
        placeholder={placeholder}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          }
        }}
        onBlur={commit}
        className="h-8 flex-1 rounded-md border border-border bg-background px-2.5 text-[12.5px] outline-none focus:border-primary"
      />
    </div>
  );
}

function WidgetChrome({ label, onChange, children }: { label: string; onChange: () => void; children: React.ReactNode }) {
  return (
    <div className="group/widget relative my-1 w-full">
      {children}
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          onChange();
        }}
        className="absolute right-2 top-2 hidden rounded-md border border-border bg-popover px-2 py-1 text-[11px] font-medium text-muted-foreground shadow-sm transition-colors hover:text-foreground group-hover/widget:block"
      >
        {label}
      </button>
    </div>
  );
}

function EmbedBlock({ block, onPatch }: WidgetProps) {
  const isVideo = block.type === "video";
  if (!block.url) {
    return (
      <UrlInput
        icon={isVideo ? Video : Youtube}
        label={isVideo ? "Video" : "Embed"}
        placeholder={isVideo ? "Paste a video URL (mp4, YouTube, Loom…)" : "Paste a YouTube, Loom, Figma, or CodePen link"}
        onSubmit={(url) => {
          const info = detectEmbed(url);
          onPatch({ url, provider: info.provider, title: info.label });
        }}
      />
    );
  }
  const info = detectEmbed(block.url);
  const fileVideo = isVideo && /\.(mp4|webm|ogg)(\?|$)/i.test(block.url);
  const aspect = info.aspect === "auto" ? "16/9" : info.aspect;
  return (
    <WidgetChrome label="Change" onChange={() => onPatch({ url: "", provider: undefined })}>
      <div className="overflow-hidden rounded-xl border border-border bg-black/5">
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Youtube className="h-3.5 w-3.5" /> {info.label}
          </span>
          <span className="ml-auto truncate opacity-70">{block.url}</span>
        </div>
        {fileVideo ? (
          <video src={block.url} controls className="block w-full bg-black" style={{ aspectRatio: aspect }} />
        ) : (
          <iframe
            src={info.embedUrl}
            title={info.label}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="block w-full border-0"
            style={{ aspectRatio: aspect }}
          />
        )}
      </div>
    </WidgetChrome>
  );
}

function BookmarkBlock({ block, onPatch }: WidgetProps) {
  if (!block.url) {
    return (
      <UrlInput
        icon={Link2}
        label="Bookmark"
        placeholder="Paste any link to create a preview card"
        onSubmit={(url) => {
          const meta = fakeBookmarkMeta(url);
          onPatch({ url, title: meta.title, desc: meta.desc, site: meta.site });
        }}
      />
    );
  }
  const letter = (block.site || block.url).replace(/^https?:\/\//, "").charAt(0).toUpperCase();
  return (
    <WidgetChrome label="Change" onChange={() => onPatch({ url: "" })}>
      <a
        href={block.url}
        target="_blank"
        rel="noopener noreferrer"
        onMouseDown={(e) => e.stopPropagation()}
        className="flex items-stretch overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border-strong"
      >
        <div className="min-w-0 flex-1 px-4 py-3">
          <div className="truncate text-[13px] font-semibold text-foreground">{block.title || block.url}</div>
          {block.desc && <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">{block.desc}</div>}
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="grid h-3.5 w-3.5 place-items-center rounded-sm bg-primary/15 text-[8px] font-bold text-primary">{letter}</span>
            <span className="truncate">{block.site || block.url}</span>
          </div>
        </div>
        <div className="hidden w-40 shrink-0 bg-gradient-to-br from-indigo-400/30 to-fuchsia-400/30 sm:block" />
      </a>
    </WidgetChrome>
  );
}

const BTN_VARIANTS: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)]",
  secondary: "bg-[color:var(--s2)] text-foreground border border-border",
  outline: "border border-border text-foreground",
  ghost: "text-primary hover:underline",
};

function ButtonBlock({ block, onPatch }: WidgetProps) {
  const variant = block.variant ?? "primary";
  return (
    <div className="my-1.5 w-full rounded-xl border border-border bg-muted/30 p-3">
      <div className="grid place-items-center py-2">
        <span className={`inline-flex h-9 items-center rounded-lg px-4 text-[13px] font-semibold ${BTN_VARIANTS[variant] ?? BTN_VARIANTS.primary}`}>
          {block.label || "Button"}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-2">
        <input
          value={block.label ?? ""}
          placeholder="Label"
          onChange={(e) => onPatch({ label: e.target.value })}
          className="h-7 w-28 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
        />
        <input
          value={block.href ?? ""}
          placeholder="https://your-site.com"
          onChange={(e) => onPatch({ href: e.target.value })}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
        />
        <div className="flex items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
          {["primary", "secondary", "outline", "ghost"].map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => onPatch({ variant: v })}
              className={`rounded px-1.5 py-1 text-[10.5px] font-medium capitalize transition-colors ${variant === v ? "bg-[color:var(--row-hover)] text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function TableBlock({ block, onPatch }: WidgetProps) {
  const rows = block.rows && block.rows.length ? block.rows : [["", ""], ["", ""]];
  const hasHeader = block.hasHeader ?? true;
  const setCell = (r: number, c: number, val: string) => {
    const next = rows.map((row) => [...row]);
    next[r][c] = val;
    onPatch({ rows: next });
  };
  const addRow = () => onPatch({ rows: [...rows, rows[0].map(() => "")] });
  const addCol = () => onPatch({ rows: rows.map((row) => [...row, ""]) });
  const removeRow = (r: number) => rows.length > 1 && onPatch({ rows: rows.filter((_, i) => i !== r) });

  return (
    <div className="my-1.5 w-full">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full border-collapse text-[12.5px]">
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="group/row">
                {row.map((cell, c) => (
                  <td key={c} className="border border-border p-0">
                    <input
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                      placeholder={hasHeader && r === 0 ? `Column ${c + 1}` : ""}
                      className={`w-full min-w-[96px] bg-transparent px-2.5 py-1.5 outline-none focus:bg-[color:var(--row-hover)] ${hasHeader && r === 0 ? "font-semibold" : ""}`}
                    />
                  </td>
                ))}
                <td className="w-6 border-y border-border bg-muted/30 align-middle">
                  <button
                    type="button"
                    title="Remove row"
                    onClick={() => removeRow(r)}
                    className="hidden h-6 w-6 place-items-center text-muted-foreground hover:text-destructive group-hover/row:grid"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <button type="button" onClick={addRow} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Plus className="h-3 w-3" /> Row
        </button>
        <button type="button" onClick={addCol} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground">
          <Plus className="h-3 w-3" /> Column
        </button>
        <label className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <input type="checkbox" checked={hasHeader} onChange={(e) => onPatch({ hasHeader: e.target.checked })} className="h-3 w-3 accent-[color:var(--primary)]" />
          Header row
        </label>
      </div>
    </div>
  );
}

function ComponentBlock({ block, onPatch }: WidgetProps) {
  const def = componentDef(block.component);
  const p = block.componentProps ?? {};
  return (
    <div className="group/cmp my-1.5 w-full overflow-hidden rounded-xl border border-border bg-card">
      <div className={`flex items-center gap-2 bg-gradient-to-r ${def?.accent ?? "from-slate-500 to-slate-600"} px-3 py-1.5 text-[11px] font-semibold text-white`}>
        <Boxes className="h-3.5 w-3.5" />
        {def?.label ?? "Component"}
        <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide">Instance</span>
      </div>
      <div className="p-4">
        <ComponentPreview keyName={block.component} title={block.title ?? ""} desc={block.desc ?? ""} props={p} />
      </div>
      <div className="hidden items-center gap-2 border-t border-border px-3 py-2 group-hover/cmp:flex">
        <input
          value={block.title ?? ""}
          placeholder="Title"
          onChange={(e) => onPatch({ title: e.target.value })}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
        />
        <input
          value={block.desc ?? ""}
          placeholder="Description"
          onChange={(e) => onPatch({ desc: e.target.value })}
          className="h-7 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
        />
      </div>
    </div>
  );
}

function ComponentPreview({ keyName, title, desc, props }: { keyName?: string; title: string; desc: string; props: Record<string, string> }) {
  switch (keyName) {
    case "cta-banner":
      return (
        <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-4 text-center text-white">
          <div className="text-[15px] font-semibold">{title}</div>
          <div className="mt-0.5 text-[12px] opacity-90">{desc}</div>
          <span className="mt-2.5 inline-flex h-8 items-center rounded-md bg-white px-3 text-[12px] font-semibold text-indigo-600">{props.button ?? "Get started"}</span>
        </div>
      );
    case "newsletter":
      return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="text-[14px] font-semibold text-foreground">{title}</div>
          <div className="text-[12px] text-muted-foreground">{desc}</div>
          <div className="mt-2 flex gap-2">
            <span className="flex h-8 flex-1 items-center rounded-md border border-border bg-background px-2.5 text-[12px] text-muted-foreground">{props.placeholder ?? "you@company.com"}</span>
            <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground">{props.button ?? "Subscribe"}</span>
          </div>
        </div>
      );
    case "pricing":
      return (
        <div className="rounded-lg border border-border px-4 py-3">
          <div className="text-[12px] font-medium text-muted-foreground">{title}</div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[26px] font-bold tracking-tight text-foreground">{props.price ?? "$29"}</span>
            <span className="text-[12px] text-muted-foreground">{props.period ?? "/mo"}</span>
          </div>
          <ul className="mt-2 space-y-1">
            {(props.features ?? "").split("\n").filter(Boolean).map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[12px] text-foreground"><span className="text-emerald-500">✓</span>{f}</li>
            ))}
          </ul>
          <span className="mt-2.5 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground">{props.button ?? "Choose plan"}</span>
        </div>
      );
    case "testimonial":
      return (
        <figure className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <blockquote className="text-[14px] font-medium leading-snug text-foreground">“{title}”</blockquote>
          <figcaption className="mt-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-600">{(props.author ?? "A").charAt(0)}</span>
            <span className="text-[11.5px]"><span className="font-semibold text-foreground">{props.author ?? "Author"}</span><span className="text-muted-foreground"> · {props.role ?? ""}</span></span>
          </figcaption>
        </figure>
      );
    case "stat":
      return (
        <div className="text-center">
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-[34px] font-bold leading-none tracking-tight text-transparent">{title}</div>
          <div className="mt-1 text-[12px] text-muted-foreground">{desc}</div>
        </div>
      );
    case "profile":
      return (
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-[15px] font-semibold text-white">{title.charAt(0)}</span>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground">{title} <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{props.role ?? ""}</span></div>
            <div className="text-[12px] text-muted-foreground">{desc}</div>
          </div>
        </div>
      );
    case "product-hunt":
      return (
        <div className="inline-flex items-center gap-2 rounded-lg border border-orange-300/50 bg-orange-500/10 px-3 py-2">
          <Award className="h-4 w-4 text-orange-500" />
          <span className="text-[12.5px] font-medium text-foreground">{title}</span>
          {props.tag && <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white">{props.tag}</span>}
        </div>
      );
    case "faq":
      return (
        <div>
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground"><MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" />{title}</div>
          <div className="mt-1 pl-5 text-[12.5px] text-muted-foreground">{desc}</div>
        </div>
      );
    default:
      return (
        <div>
          <div className="text-[13.5px] font-semibold text-foreground">{title}</div>
          {desc && <div className="mt-0.5 text-[12px] text-muted-foreground">{desc}</div>}
        </div>
      );
  }
}

/** Secondary editable for a toggle block's body text. */
function ToggleBody({ block, onPatch }: WidgetProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const incoming = block.bodyText ?? "";
    if (el.textContent !== incoming) el.textContent = incoming;
  }, [block.bodyText]);
  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      data-placeholder="Empty toggle. Add some content."
      onBlur={() => onPatch({ bodyText: ref.current?.textContent ?? "" })}
      className="block-editable min-h-[24px] text-[14px] leading-relaxed text-muted-foreground outline-none"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Presence                                                            */
/* ------------------------------------------------------------------ */

function PresenceDot({ peer }: { peer: PresencePeer }) {
  const member = useCMS((s) => s.members.find((m) => m.id === peer.id));
  const inner = (
    <span
      tabIndex={0}
      className="-ml-1.5 grid h-[18px] w-[18px] shrink-0 select-none place-items-center rounded-full text-[8.5px] font-semibold text-white outline-none ring-2 ring-[color:var(--canvas)] first:ml-0"
      style={{ backgroundColor: peer.color }}
      title={member ? undefined : peer.name}
    >
      {peer.initials}
    </span>
  );
  return member ? <PersonTooltipForMember member={member}>{inner}</PersonTooltipForMember> : inner;
}

/* ------------------------------------------------------------------ */
/* AI prompt panel                                                     */
/* ------------------------------------------------------------------ */

function AiPromptPanel({
  cmd,
  rect,
  onCancel,
  onSubmit,
}: {
  cmd: AiCommand;
  rect: { top: number; left: number };
  onCancel: () => void;
  onSubmit: (text: string) => void;
}) {
  const [v, setV] = useState("");
  const ref = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const Icon = cmd.mode === "image" ? ImagePlus : Wand2;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const left = Math.max(8, Math.min(rect.left, vw - 400));
  const submit = () => onSubmit(v.trim());
  return (
    <div
      style={{ position: "fixed", top: rect.top + 6, left }}
      className="z-50 w-[384px] rounded-xl border border-border bg-popover p-2 shadow-lg animate-in fade-in zoom-in-95 duration-100"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white">
          <Icon className="h-3.5 w-3.5" />
        </span>
        <input
          ref={ref}
          value={v}
          onChange={(e) => setV(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              onCancel();
            }
          }}
          placeholder={cmd.promptPlaceholder ?? "Describe what you want"}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            submit();
          }}
          className="inline-flex h-7 shrink-0 items-center rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
        >
          {cmd.mode === "image" ? "Create" : "Generate"}
        </button>
      </div>
      <div className="mt-1 px-1 text-[10.5px] text-muted-foreground">{cmd.label} · AI (demo)</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Slash menu                                                          */
/* ------------------------------------------------------------------ */

type SlashView = "root" | "ai" | "components" | "embeds";

type Row =
  | { t: "insert"; item: SlashItem }
  | { t: "drill"; view: SlashView; label: string; desc: string; icon: LucideIcon; count: number }
  | { t: "back"; label: string };

const CATEGORY_LABEL: Record<SlashCategory, string> = {
  AI: "AI", Basic: "Basic blocks", Lists: "Lists", Media: "Media",
  Embeds: "Embeds", Advanced: "Advanced", Components: "Components",
};
const CATEGORY_ORDER: SlashCategory[] = ["AI", "Basic", "Lists", "Media", "Embeds", "Advanced", "Components"];

function categoryItems(view: SlashView): SlashItem[] {
  return view === "ai" ? AI_ITEMS : view === "components" ? COMPONENT_ITEMS : view === "embeds" ? EMBED_ITEMS : [];
}

function SlashMenu({
  state,
  onSelect,
  onClose,
}: {
  state: SlashState;
  onSelect: (item: SlashItem) => void;
  onClose: () => void;
}) {
  const [view, setView] = useState<SlashView>("root");
  const [active, setActive] = useState(0);
  // The search input owns the query so clicking it and typing works. Seed it
  // from whatever the writer typed right after "/" before the menu grabbed focus.
  const [query, setQuery] = useState(() => state.query);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const focusedRef = useRef(false);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  // Until the input actually has focus, keep mirroring characters that still
  // land in the editor (covers the split-second before focus lands).
  useEffect(() => {
    if (!focusedRef.current) setQuery(state.query);
  }, [state.query]);
  const q = query.trim().toLowerCase();

  // Build the flat, keyboard-navigable rows and the section headers to show.
  const { rows, sections } = useMemo(() => {
    const rows: Row[] = [];
    const sections: { title?: string; idx: number[]; divider?: boolean }[] = [];
    const inCategory = view !== "root";

    if (!inCategory && !q) {
      // Compact root: the featured pickers (AI, Components, Embeds) sit up top,
      // then the everyday basic blocks below.
      rows.push({ t: "drill", view: "ai", label: "AI", desc: "Write and edit with AI", icon: Sparkles, count: AI_ITEMS.length });
      rows.push({ t: "drill", view: "components", label: "Components", desc: "Reusable blocks for your site", icon: Boxes, count: COMPONENT_ITEMS.length });
      rows.push({ t: "drill", view: "embeds", label: "Embeds", desc: "YouTube, Figma, Loom, and more", icon: Youtube, count: EMBED_ITEMS.length });
      sections.push({ title: "Featured", idx: [0, 1, 2] });
      const blockStart = rows.length;
      ROOT_BLOCKS.forEach((it) => rows.push({ t: "insert", item: it }));
      sections.push({ title: "Basic", idx: ROOT_BLOCKS.map((_, i) => blockStart + i), divider: true });
    } else if (!inCategory && q) {
      // Global fuzzy search across everything, grouped by category.
      const hits = SLASH_ITEMS.filter((it) => matchItem(it, q));
      hits.forEach((it) => rows.push({ t: "insert", item: it }));
      for (const cat of CATEGORY_ORDER) {
        const idx = rows.map((r, i) => (r.t === "insert" && r.item.category === cat ? i : -1)).filter((i) => i >= 0);
        if (idx.length) sections.push({ title: CATEGORY_LABEL[cat], idx });
      }
    } else {
      // Drilled into a category: a back row, then its (optionally filtered) items.
      rows.push({ t: "back", label: view === "ai" ? "AI" : view === "components" ? "Components" : "Embeds" });
      sections.push({ title: undefined, idx: [0] });
      const items = categoryItems(view).filter((it) => !q || matchItem(it, q));
      items.forEach((it) => rows.push({ t: "insert", item: it }));
      if (view === "components") {
        for (const g of COMPONENT_GROUPS) {
          const idx = rows
            .map((r, i) => (r.t === "insert" && r.item.action.kind === "component" && componentDef(r.item.action.key)?.group === g ? i : -1))
            .filter((i) => i >= 0);
          if (idx.length) sections.push({ title: g, idx });
        }
      } else {
        const idx = rows.map((r, i) => (r.t === "insert" ? i : -1)).filter((i) => i >= 0);
        if (idx.length) sections.push({ title: view === "ai" ? "AI commands" : "Embeds", idx });
      }
    }
    return { rows, sections };
  }, [q, view]);

  useEffect(() => setActive(0), [q, view]);

  const activate = (row: Row) => {
    if (row.t === "insert") onSelect(row.item);
    else if (row.t === "drill") setView(row.view);
    else setView("root");
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(rows.length - 1, i + 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(0, i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const row = rows[active];
        if (row) activate(row);
      } else if (e.key === "Escape") {
        e.preventDefault();
        if (view !== "root") setView("root");
        else onClose();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, active, view, onSelect, onClose]);

  const empty = rows.length === 0 || (rows.length === 1 && rows[0].t === "back");

  // Open downward from the caret, but flip up when there isn't room below.
  const MENU_MAX = 420;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const openUp = state.rect.top + 6 + MENU_MAX > vh;
  const top = openUp ? Math.max(8, state.rect.top - MENU_MAX - 22) : state.rect.top + 6;
  const left = Math.max(8, Math.min(state.rect.left, vw - 356));

  return (
    <div
      style={{ position: "fixed", top, left }}
      className="z-50 flex max-h-[420px] w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-lg animate-in fade-in zoom-in-95 duration-100"
      role="listbox"
    >
      {/* a real search input: click and type, or just keep typing after "/" */}
      <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2">
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            focusedRef.current = true;
          }}
          onKeyDown={(e) => {
            // Let the menu's own key handler drive arrows / enter / escape.
            if (["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(e.key)) e.preventDefault();
          }}
          placeholder={view === "root" ? "Search or pick a block" : `Search ${view === "ai" ? "AI commands" : view}`}
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1">
        {empty && (
          <div className="px-4 py-6 text-center text-[12px] text-muted-foreground">No matches</div>
        )}
        {sections.map((sec, si) => (
          <div key={si} className={`px-1.5 pb-1 ${sec.divider ? "mt-1 border-t border-border/50 pt-1" : ""}`}>
            {sec.title && (
              <div className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {sec.title}
              </div>
            )}
            {sec.idx.map((i) => {
              const row = rows[i];
              const common = {
                active: active === i,
                onMouseEnter: () => setActive(i),
                onClick: () => activate(row),
              };
              if (row.t === "insert") return <SlashRow key={i} item={row.item} {...common} />;
              if (row.t === "drill") return <DrillRow key={i} row={row} {...common} />;
              return <BackRow key={i} label={row.label} {...common} />;
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between border-t border-border/60 bg-muted/30 px-3 py-1.5 text-[10.5px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CornerDownLeft className="h-3 w-3" /> select
        </span>
        <span className="inline-flex items-center gap-1">
          {view === "root" ? "type to search" : "esc to go back"}
        </span>
      </div>
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

function DrillRow({
  row,
  active,
  onMouseEnter,
  onClick,
}: {
  row: { label: string; desc: string; icon: LucideIcon; count: number };
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  const Icon = row.icon;
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        e.preventDefault();
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
        <span className="block truncate text-[12.5px] font-medium text-foreground">{row.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">{row.desc}</span>
      </span>
      <span className="shrink-0 rounded-full bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">{row.count}</span>
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
    </button>
  );
}

function BackRow({
  label,
  active,
  onMouseEnter,
  onClick,
}: {
  label: string;
  active: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      className={`flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[12px] font-medium text-muted-foreground transition-colors ${
        active ? "bg-[color:var(--row-hover)] text-foreground" : "hover:bg-[color:var(--row-hover)]"
      }`}
    >
      <ChevronRight className="h-3.5 w-3.5 rotate-180" />
      {label}
      <span className="text-muted-foreground/60">· all blocks</span>
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
