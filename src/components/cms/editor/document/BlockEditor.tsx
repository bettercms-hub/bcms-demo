/**
 * BlockEditor — Notion-style block editor.
 *
 * Each block is an uncontrolled contentEditable element. React owns the
 * block list (type/order/metadata); the DOM owns the in-progress text. We
 * only push text back into React on blur or on structural changes so the
 * caret never jumps mid-edit.
 */
import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/utils";
import { getPages } from "@/lib/cms/pages-store";
import {
  Award,
  Bookmark,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Boxes,
  ChevronRight,
  Code as CodeIcon,
  CornerDownLeft,
  CreditCard,
  Crop as CropIcon,
  Figma,
  FileCode,
  FileText,
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
  Maximize2,
  Megaphone,
  MessagesSquare,
  MessageSquareQuote,
  Minimize2,
  Minus,
  MousePointerClick,
  PenLine,
  Pencil,
  Plus,
  Upload,
  Quote,
  Search,
  Sparkles,
  StretchHorizontal,
  Table as TableIcon,
  Text as TextIcon,
  Trash2,
  TrendingUp,
  ClipboardCopy,
  CopyPlus,
  RotateCcw,
  SlidersHorizontal,
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
import { blocksToMarkdown, htmlToMarkdown, looksLikeMarkdown, markdownToBlocks } from "@/lib/cms/blocks/markdown";
import { toast } from "sonner";
import {
  AI_COMMANDS,
  COMPONENT_CATALOG,
  COMPONENT_GROUPS,
  CALLOUT_TONES,
  componentDef,
  componentFieldDefault,
  detectEmbed,
  fakeBookmarkMeta,
  simulateAi,
  toneOf,
  type AiCommand,
  type ComponentDef,
  type ComponentField,
} from "@/lib/cms/blocks/rich-blocks";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCMS, mediaActions } from "@/lib/cms/store";
import { useProjectPresence, type PresencePeer } from "@/lib/workspace/presence-store";
import { PersonTooltipForMember } from "@/components/cms/workflow/PersonTooltip";
import { MediaPickerDialog } from "@/components/cms/media/MediaPickerDialog";
import { ImageCropDialog } from "@/components/cms/media/ImageCropDialog";

/** Lets leaf blocks (e.g. the image block's media picker) reach the project
 *  without prop-drilling through every row. */
const BlockEditorContext = createContext<{ projectId?: string }>({});

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
  { id: "video", label: "Video", description: "Upload a video or embed by URL", icon: Video, category: "Media", keywords: ["mp4", "player", "upload"], action: { kind: "widget", type: "video" } },
];

const EMBED_ITEMS: SlashItem[] = [
  { id: "embed", label: "Embed", description: "YouTube, Loom, Figma, CodePen, and more", icon: Youtube, category: "Embeds", keywords: ["youtube", "loom", "figma", "iframe", "codepen", "vimeo"], action: { kind: "widget", type: "embed" } },
  { id: "bookmark", label: "Bookmark", description: "A rich link preview card", icon: Bookmark, category: "Embeds", keywords: ["link", "url", "preview"], action: { kind: "widget", type: "bookmark" } },
  { id: "figma", label: "Figma", description: "Embed a Figma file or prototype", icon: Figma, category: "Embeds", keywords: ["design", "prototype"], action: { kind: "widget", type: "embed" } },
  { id: "html", label: "Code embed", description: "HTML, CSS and JS with a live preview", icon: FileCode, category: "Embeds", keywords: ["html", "css", "js", "script", "custom", "iframe"], action: { kind: "widget", type: "html" } },
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
    case "html":
      return { type, text: "" };
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

/** Nearest scrollable ancestor, for drag edge auto-scroll. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let sc = el?.parentElement ?? null;
  while (sc) {
    const oy = getComputedStyle(sc).overflowY;
    if ((oy === "auto" || oy === "scroll") && sc.scrollHeight > sc.clientHeight) return sc;
    sc = sc.parentElement;
  }
  return null;
}

/** Every block id in document order between two blocks, inclusive. */
function blockIdsBetween(blocks: DocBlock[], aId: string, bId: string): string[] {
  const ia = blocks.findIndex((b) => b.id === aId);
  const ib = blocks.findIndex((b) => b.id === bId);
  if (ia === -1 || ib === -1) return [];
  const [lo, hi] = ia <= ib ? [ia, ib] : [ib, ia];
  return blocks.slice(lo, hi + 1).map((b) => b.id);
}

/** A slim horizontal line marking where a dragged block will drop. */
function DropLine() {
  return (
    <div className="relative h-0" aria-hidden>
      <div className="absolute -left-1 right-0 -top-px h-[2px] rounded-full bg-[color:var(--primary)]" />
      <div className="absolute -left-1 -top-[3px] h-2 w-2 rounded-full bg-[color:var(--primary)]" />
    </div>
  );
}

/** Floating actions shown while one or more blocks are selected. */
function BlockSelectionBar({
  count,
  firstId,
  rootRef,
  canDuplicate = true,
  onDuplicate,
  onCopy,
  onDelete,
  onClear,
}: {
  count: number;
  firstId: string;
  rootRef: React.MutableRefObject<HTMLDivElement | null>;
  canDuplicate?: boolean;
  onDuplicate: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  // Anchor above the first selected thing: a body block if any, otherwise the
  // first selected field element anywhere in the pane.
  const el =
    (firstId ? rootRef.current?.querySelector<HTMLElement>(`[data-block-id="${firstId}"]`) : null) ??
    (findScrollParent(rootRef.current) ?? document.body).querySelector<HTMLElement>('[data-grab-field][data-selected="true"]');
  const r = el?.getBoundingClientRect();
  const style: React.CSSProperties = r
    ? { position: "fixed", top: Math.max(8, r.top - 44), left: r.left, zIndex: 50 }
    : { position: "fixed", top: 12, left: "50%", transform: "translateX(-50%)", zIndex: 50 };
  const btn =
    "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--row-hover)]";
  return (
    <div
      style={style}
      // Keep clicks on the bar from clearing the selection.
      onMouseDown={(e) => e.stopPropagation()}
      className="flex items-center gap-0.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] p-1 shadow-lg"
    >
      <span className="px-2 text-[11.5px] font-semibold text-muted-foreground">{count} selected</span>
      <span className="mx-0.5 h-4 w-px bg-[color:var(--color-border)]" />
      <button
        type="button"
        className={cn(btn, !canDuplicate && "pointer-events-none opacity-40")}
        title={canDuplicate ? undefined : "Fields can't be duplicated"}
        onClick={onDuplicate}
      >
        <CopyPlus className="h-3.5 w-3.5" /> Duplicate
      </button>
      <button type="button" className={btn} onClick={onCopy}>
        <ClipboardCopy className="h-3.5 w-3.5" /> Copy
      </button>
      <button type="button" className={cn(btn, "text-destructive hover:bg-destructive/10")} onClick={onDelete}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </button>
      <span className="mx-0.5 h-4 w-px bg-[color:var(--color-border)]" />
      <button
        type="button"
        aria-label="Clear selection"
        className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        onClick={onClear}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function BlockEditor({ value, onChange, placeholder, projectId, entryId }: Props) {
  const initial = useMemo(() => parseDoc(value), [value]);
  const [doc, setDoc] = useState<DocValue>(initial);
  const [slash, setSlash] = useState<SlashState | null>(null);
  const [aiPrompt, setAiPrompt] = useState<{ blockId: string; cmd: AiCommand; base: DocBlock[]; rect: { top: number; left: number } } | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());
  const focusAfterRenderRef = useRef<{ id: string; toStart?: boolean } | null>(null);

  // Notion-style "grab the handle, drag the block to move it": grabbing a
  // row's ⋮⋮ handle lifts the whole block and shows a drop-line where it will
  // land; releasing reorders. Clicking the handle (no drag) opens its menu.
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Set true for the click that immediately follows a drag, so the handle's
  // click-to-open-menu doesn't fire after a move.
  const justDraggedRef = useRef(false);

  // Notion-style block selection: drag across two or more blocks to select
  // them as objects (highlighted), then Duplicate / Copy / Delete from the
  // floating toolbar or the keyboard.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectRef = useRef<{ down: string | null; active: boolean }>({ down: null, active: false });
  // Notion-style marquee: dragging from empty space (margins, gaps, other
  // whitespace in the pane) draws a translucent rectangle; blocks it touches
  // are selected. Viewport coords, rendered as a fixed overlay.
  const [marquee, setMarquee] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // The grab isn't limited to body blocks: any element in the pane marked
  // data-grab-field (title, summary, structured fields) joins the selection.
  // The host view listens for these events to highlight / collect / clear.
  const [selectedFields, setSelectedFields] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    document.dispatchEvent(new CustomEvent("bcms:grab-fields", { detail: { fields: [...selectedFields] } }));
  }, [selectedFields]);

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

  // Move one block — or a whole selection — to a target insertion index
  // (0..len), adjusting for the gaps the moved blocks leave behind.
  const reorderBlocks = (ids: string[], toIndex: number) => {
    const moving = new Set(ids);
    const moved = doc.blocks.filter((b) => moving.has(b.id)); // keeps doc order
    if (moved.length === 0) return;
    const removedBefore = doc.blocks.slice(0, toIndex).filter((b) => moving.has(b.id)).length;
    const remaining = doc.blocks.filter((b) => !moving.has(b.id));
    const insert = Math.max(0, Math.min(remaining.length, toIndex - removedBefore));
    const blocks = [...remaining];
    blocks.splice(insert, 0, ...moved);
    focusAfterRenderRef.current = { id: moved[0].id };
    commit({ ...doc, blocks });
  };

  // Which boundary (0..len) the pointer is over, from block midpoints.
  const dropIndexAt = (clientY: number): number => {
    const root = rootRef.current;
    if (!root) return doc.blocks.length;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (clientY < r.top + r.height / 2) return i;
    }
    return els.length;
  };

  // Grab handler on a row's ⋮⋮ handle. A small move threshold distinguishes a
  // click (opens the block menu) from a drag (lifts and moves the block).
  // If the grabbed block is part of the current selection, the WHOLE selection
  // moves together.
  const onHandlePointerDown = (id: string, e: React.PointerEvent<HTMLElement>) => {
    if (e.button !== 0) return;
    const group = selectedIds.has(id) && selectedIds.size > 1
      ? doc.blocks.filter((b) => selectedIds.has(b.id)).map((b) => b.id)
      : [id];
    const startY = e.clientY;
    let started = false;
    const onMove = (ev: PointerEvent) => {
      if (!started && Math.abs(ev.clientY - startY) > 4) {
        started = true;
        setDragId(id);
        document.body.style.userSelect = "none";
        document.body.style.cursor = "grabbing";
      }
      if (started) setDropIndex(dropIndexAt(ev.clientY));
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      if (started) {
        reorderBlocks(group, dropIndexAt(ev.clientY));
        justDraggedRef.current = true; // suppress the click that opens the menu
        setTimeout(() => { justDraggedRef.current = false; }, 0);
      }
      setDragId(null);
      setDropIndex(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  /* --- block selection: drag across blocks to grab them as objects --- */

  const blockAtY = (y: number): string | null => {
    const root = rootRef.current;
    if (!root) return null;
    const els = Array.from(root.querySelectorAll<HTMLElement>("[data-block-id]"));
    let nearest: string | null = null;
    let nearestDist = Infinity;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return el.dataset.blockId ?? null;
      const d = y < r.top ? r.top - y : y - r.bottom;
      if (d < nearestDist) { nearestDist = d; nearest = el.dataset.blockId ?? null; }
    }
    return nearest;
  };

  const onRootMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    // Leave handles, buttons, inputs, links and widgets alone.
    if (t.closest("button, a, input, textarea, select, [contenteditable='false'], [role='menu']")) return;
    // Drags that start on empty space belong to the marquee (document handler).
    if (!t.closest("[contenteditable]")) return;
    if (selectedIds.size || selectedFields.size) clearGrab(); // fresh interaction clears
    selectRef.current = { down: blockAtY(e.clientY), active: false };
    let lastKey = "";
    let curY = e.clientY;
    let raf = 0;
    // Nearest scrollable ancestor (the entry pane / page), for edge auto-scroll.
    const sc = findScrollParent(rootRef.current);
    const applyRange = () => {
      const st = selectRef.current;
      const to = blockAtY(curY);
      if (!st.down || !to) return;
      const ids = blockIdsBetween(doc.blocks, st.down, to);
      const key = ids.join(",");
      if (key === lastKey) return; // only re-render when the range changes
      lastKey = key;
      setSelectedIds(new Set(ids));
    };
    // While dragging near the top/bottom edge, scroll and keep extending —
    // this is what makes selecting past the fold feel smooth.
    const tick = () => {
      if (!selectRef.current.active) { raf = 0; return; }
      const r = sc ? sc.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      const EDGE = 56;
      let dy = 0;
      if (curY < r.top + EDGE) dy = -Math.min(18, (r.top + EDGE - curY) / 3 + 2);
      else if (curY > r.bottom - EDGE) dy = Math.min(18, (curY - (r.bottom - EDGE)) / 3 + 2);
      if (dy !== 0) {
        if (sc) sc.scrollTop += dy;
        else window.scrollBy(0, dy);
        applyRange();
      }
      raf = requestAnimationFrame(tick);
    };
    const onMove = (ev: MouseEvent) => {
      const st = selectRef.current;
      curY = ev.clientY;
      const to = blockAtY(ev.clientY);
      if (!st.active) {
        // Still inside one block → let native text selection happen.
        if (!to || !st.down || to === st.down) return;
        // Crossed a boundary: commit to block selection. Suppress the native
        // text selection ONCE, then keep it off — no per-move tug-of-war.
        st.active = true;
        document.body.style.userSelect = "none";
        rootRef.current?.setAttribute("data-selecting", "true");
        window.getSelection()?.removeAllRanges();
        if (!raf) raf = requestAnimationFrame(tick);
      }
      ev.preventDefault(); // stop the browser from re-extending a text range
      applyRange();
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      if (raf) cancelAnimationFrame(raf);
      document.body.style.userSelect = "";
      rootRef.current?.removeAttribute("data-selecting");
      selectRef.current = { down: null, active: false };
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Marquee from empty space: a left-button drag that starts anywhere in the
  // editor's scroll pane but NOT on text or a control draws the translucent
  // rectangle and selects every block it touches — Notion's grab.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (e.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      const t = e.target as HTMLElement;
      if (t.closest("button, a, input, textarea, select, [contenteditable], [role='menu'], [data-selection-bar]")) return;
      const pane = findScrollParent(root) ?? document.body;
      if (!pane.contains(t)) return;
      // Ignore grabs on a classic scrollbar (target is the pane, x past content).
      if (t === pane && e.clientX >= pane.getBoundingClientRect().left + pane.clientWidth) return;

      setSelectedIds(new Set()); // fresh interaction clears any selection
      setSelectedFields(new Set());
      const anchorX = e.clientX;
      const anchorDocY = e.clientY + pane.scrollTop; // survives auto-scroll
      let active = false;
      let raf = 0;
      let curX = e.clientX;
      let curY = e.clientY;
      let lastKey = "";

      const update = () => {
        const ay = anchorDocY - pane.scrollTop;
        const x = Math.min(anchorX, curX);
        const y = Math.min(ay, curY);
        const w = Math.abs(curX - anchorX);
        const h = Math.abs(curY - ay);
        setMarquee({ x, y, w, h });
        const ids: string[] = [];
        root.querySelectorAll<HTMLElement>("[data-block-id]").forEach((row) => {
          const b = row.getBoundingClientRect();
          if (b.right > x && b.left < x + w && b.bottom > y && b.top < y + h) {
            if (row.dataset.blockId) ids.push(row.dataset.blockId);
          }
        });
        // Fields anywhere in the pane (title, summary, structured fields) join
        // the same grab: anything marked data-grab-field that the rect touches.
        const fields: string[] = [];
        pane.querySelectorAll<HTMLElement>("[data-grab-field]").forEach((el) => {
          const b = el.getBoundingClientRect();
          if (b.right > x && b.left < x + w && b.bottom > y && b.top < y + h) {
            if (el.dataset.grabField) fields.push(el.dataset.grabField);
          }
        });
        const key = ids.join(",") + "|" + fields.join(",");
        if (key === lastKey) return; // only re-render when the set changes
        lastKey = key;
        setSelectedIds(new Set(ids));
        setSelectedFields(new Set(fields));
      };

      // Edge auto-scroll keeps the rectangle growing past the fold.
      const tick = () => {
        if (!active) { raf = 0; return; }
        const r = pane.getBoundingClientRect();
        const EDGE = 56;
        let dy = 0;
        if (curY < r.top + EDGE) dy = -Math.min(18, (r.top + EDGE - curY) / 3 + 2);
        else if (curY > r.bottom - EDGE) dy = Math.min(18, (curY - (r.bottom - EDGE)) / 3 + 2);
        if (dy !== 0) { pane.scrollTop += dy; update(); }
        raf = requestAnimationFrame(tick);
      };

      const onMove = (ev: MouseEvent) => {
        curX = ev.clientX;
        curY = ev.clientY;
        if (!active) {
          if (Math.abs(curX - anchorX) < 4 && Math.abs(curY + pane.scrollTop - anchorDocY) < 4) return;
          active = true;
          document.body.style.userSelect = "none";
          rootRef.current?.setAttribute("data-selecting", "true");
          window.getSelection()?.removeAllRanges();
          if (!raf) raf = requestAnimationFrame(tick);
        }
        ev.preventDefault();
        update();
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        if (raf) cancelAnimationFrame(raf);
        document.body.style.userSelect = "";
        rootRef.current?.removeAttribute("data-selecting");
        setMarquee(null); // rectangle goes, the block selection stays
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const clearGrab = () => {
    setSelectedIds(new Set());
    setSelectedFields(new Set());
  };

  const deleteSelection = (ids: Set<string>, fields: Set<string>) => {
    // Fields clear via the host view (it owns their values).
    if (fields.size > 0) {
      document.dispatchEvent(new CustomEvent("bcms:grab-clear", { detail: { fields: [...fields] } }));
    }
    if (ids.size > 0) {
      const idx = doc.blocks.findIndex((b) => ids.has(b.id));
      const remaining = doc.blocks.filter((b) => !ids.has(b.id));
      const next = remaining.length ? remaining : [emptyParagraph()];
      const focusId = (idx > 0 ? doc.blocks[idx - 1]?.id : undefined) ?? next[0]?.id;
      if (focusId) focusAfterRenderRef.current = { id: focusId };
      commit({ ...doc, blocks: next });
    }
    clearGrab();
    const n = ids.size + fields.size;
    if (fields.size > 0) toast.success(`${n} ${n === 1 ? "item" : "items"} cleared`);
  };

  const duplicateBlocks = (ids: Set<string>) => {
    const selected = doc.blocks.filter((b) => ids.has(b.id));
    if (selected.length === 0) return;
    const lastIdx = doc.blocks.reduce((m, b, i) => (ids.has(b.id) ? i : m), -1);
    const clones: DocBlock[] = selected.map((b) => ({ ...structuredClone(b), id: blockId() }));
    const blocks = [...doc.blocks];
    blocks.splice(lastIdx + 1, 0, ...clones);
    setSelectedIds(new Set(clones.map((c) => c.id)));
    setSelectedFields(new Set());
    commit({ ...doc, blocks });
    toast.success(`${clones.length} block${clones.length > 1 ? "s" : ""} duplicated`);
  };

  // Copy is real Markdown, in on-screen order: fields (title, summary, meta)
  // interleaved with blocks by document position — paste it anywhere, or back
  // into the editor to recreate the blocks.
  const copySelection = (ids: Set<string>, fields: Set<string>) => {
    const root = rootRef.current;
    const pane = findScrollParent(root) ?? document.body;
    const parts: { top: number; kind: "field" | "blocks"; name?: string; blocks?: DocBlock[] }[] = [];
    fields.forEach((name) => {
      const el = pane.querySelector<HTMLElement>(`[data-grab-field="${name}"]`);
      parts.push({ top: el ? el.getBoundingClientRect().top : 0, kind: "field", name });
    });
    const selBlocks = doc.blocks.filter((b) => ids.has(b.id));
    if (selBlocks.length > 0) {
      const firstRow = root?.querySelector<HTMLElement>(`[data-block-id="${selBlocks[0].id}"]`);
      parts.push({ top: firstRow ? firstRow.getBoundingClientRect().top : Infinity, kind: "blocks", blocks: selBlocks });
    }
    parts.sort((a, b) => a.top - b.top);
    const out: string[] = [];
    for (const p of parts) {
      if (p.kind === "blocks" && p.blocks) {
        out.push(blocksToMarkdown({ version: 1, blocks: p.blocks }).trim());
      } else if (p.name) {
        // Host view fills in the field's markdown (it owns the values).
        const detail = { fields: [p.name], out: [] as string[] };
        document.dispatchEvent(new CustomEvent("bcms:grab-collect", { detail }));
        if (detail.out[0]) out.push(detail.out[0]);
      }
    }
    const text = out.filter(Boolean).join("\n\n").trim();
    navigator.clipboard?.writeText(text).catch(() => {});
    const n = ids.size + fields.size;
    toast.success(`${n} ${n === 1 ? "item" : "items"} copied as Markdown`);
  };

  // Keyboard for an active selection — document-level so it still works when a
  // marquee started from empty space and focus sits outside the editor.
  useEffect(() => {
    if (selectedIds.size + selectedFields.size === 0) return;
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const mod = e.metaKey || e.ctrlKey;
      if (e.key === "Escape") { e.preventDefault(); clearGrab(); return; }
      if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); deleteSelection(selectedIds, selectedFields); return; }
      if (mod && (e.key === "d" || e.key === "D")) { e.preventDefault(); duplicateBlocks(selectedIds); return; }
      if (mod && (e.key === "c" || e.key === "C")) { e.preventDefault(); copySelection(selectedIds, selectedFields); return; }
      if (mod) return;
      if (e.key.startsWith("Arrow")) { clearGrab(); return; }
      if (e.key.length === 1) { e.preventDefault(); deleteSelection(selectedIds, selectedFields); return; }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, selectedFields, doc]);

  // Select-all (Cmd/Ctrl+A), Notion-style two-step. First press inside a block
  // lets the browser select that block's own text; a second press (block text
  // already selected) escalates to selecting EVERY block. Works even when focus
  // sits outside the editor after a marquee.
  useEffect(() => {
    function onSelectAll(e: KeyboardEvent) {
      if (!((e.metaKey || e.ctrlKey) && (e.key === "a" || e.key === "A"))) return;
      const root = rootRef.current;
      if (!root) return;
      const active = document.activeElement as HTMLElement | null;
      const focusInside = !!active && root.contains(active);
      // Only act when the editor is the user's context: focus is inside it, or a
      // block selection is already live. Otherwise leave native select-all alone.
      if (!focusInside && selectedIds.size === 0) return;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const allIds = doc.blocks.map((b) => b.id);
      if (allIds.length === 0) return;

      // Already selecting everything → swallow the keystroke (stop the browser
      // from selecting the whole page) and do nothing else.
      if (selectedIds.size >= allIds.length) { e.preventDefault(); return; }

      const editable = active?.closest?.("[data-doc-block-id]") as HTMLElement | null;
      const sel = window.getSelection();
      const hasTextSelection = !!sel && !sel.isCollapsed && sel.rangeCount > 0;

      if (editable && !hasTextSelection) {
        // First press: let the browser select this block's text natively.
        return;
      }
      // Second press (block text already selected) or focus outside a block:
      // grab every block as an object selection.
      e.preventDefault();
      if (editable) editable.blur();
      window.getSelection()?.removeAllRanges();
      setSelectedFields(new Set());
      setSelectedIds(new Set(allIds));
    }
    document.addEventListener("keydown", onSelectAll, true);
    return () => document.removeEventListener("keydown", onSelectAll, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, selectedIds]);

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

  // Markdown mode: view/edit the whole document as Markdown, then flip
  // back to blocks. The draft only commits when you leave the mode.
  const [mdMode, setMdMode] = useState(false);
  const [mdDraft, setMdDraft] = useState("");
  const enterMd = () => {
    setMdDraft(blocksToMarkdown(doc));
    setMdMode(true);
  };
  const exitMd = () => {
    const blocks = markdownToBlocks(mdDraft);
    commit({ version: 1, blocks: blocks.length ? blocks : [emptyParagraph()] });
    setMdMode(false);
  };

  // Pasting Markdown (Notion copies as Markdown) becomes real blocks.
  const pasteMarkdown = (id: string, text: string) => {
    const parsed = markdownToBlocks(text);
    if (parsed.length === 0) return;
    const idx = doc.blocks.findIndex((b) => b.id === id);
    if (idx === -1) return;
    const el = blockRefs.current.get(id);
    const curText = (el?.textContent ?? doc.blocks[idx].text ?? "").trim();
    const blocks = [...doc.blocks];
    if (!curText && doc.blocks[idx].type === "paragraph") blocks.splice(idx, 1, ...parsed);
    else blocks.splice(idx + 1, 0, ...parsed);
    focusAfterRenderRef.current = { id: parsed[parsed.length - 1].id };
    commit({ ...doc, blocks });
    toast.success("Markdown converted", {
      description: `${parsed.length} ${parsed.length === 1 ? "block" : "blocks"} added`,
    });
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

  if (mdMode) {
    return (
      <div className="relative">
        <div className="mb-1 flex items-center justify-end gap-2">
          <span className="text-[10.5px] uppercase tracking-wider text-muted-foreground/70">Markdown</span>
          <button
            type="button"
            onClick={exitMd}
            className="inline-flex h-6 items-center gap-1 rounded-md border border-border px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            <TextIcon className="h-3 w-3" /> Rich text
          </button>
        </div>
        <textarea
          value={mdDraft}
          onChange={(e) => setMdDraft(e.target.value)}
          spellCheck={false}
          rows={Math.max(12, mdDraft.split("\n").length + 2)}
          className="w-full resize-y rounded-lg border border-border bg-[color:var(--s1,var(--background))] px-3.5 py-3 font-mono text-[12.5px] leading-relaxed text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
          aria-label="Document as Markdown"
        />
        <div className="mt-1 text-[11px] text-muted-foreground/70">
          Standard Markdown, plus: a URL on its own line becomes an embed, and {"> [!info]"} makes a callout. Switching back converts to blocks.
        </div>
      </div>
    );
  }

  return (
    <BlockEditorContext.Provider value={{ projectId }}>
    <div
      ref={rootRef}
      data-project-id={projectId}
      onMouseDown={onRootMouseDown}
      className="bcms-doc-editor relative"
    >
      {marquee && marquee.w + marquee.h > 3 && (
        <div
          aria-hidden
          style={{ position: "fixed", left: marquee.x, top: marquee.y, width: marquee.w, height: marquee.h, zIndex: 40 }}
          className="pointer-events-none rounded-[3px] border border-[color:color-mix(in_oklab,var(--primary)_40%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)]"
        />
      )}
      {selectedIds.size + selectedFields.size > 0 && (
        <BlockSelectionBar
          count={selectedIds.size + selectedFields.size}
          firstId={doc.blocks.find((b) => selectedIds.has(b.id))?.id ?? ""}
          rootRef={rootRef}
          canDuplicate={selectedIds.size > 0}
          onDuplicate={() => duplicateBlocks(selectedIds)}
          onCopy={() => copySelection(selectedIds, selectedFields)}
          onDelete={() => deleteSelection(selectedIds, selectedFields)}
          onClear={clearGrab}
        />
      )}
      <div className="pointer-events-none absolute right-0 top-[-26px] z-10 flex justify-end">
        <button
          type="button"
          onClick={enterMd}
          title="View and edit this document as Markdown"
          className="pointer-events-auto inline-flex h-6 items-center gap-1 rounded-md px-2 text-[11px] font-medium text-muted-foreground/60 transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
        >
          <FileCode className="h-3 w-3" /> Markdown
        </button>
      </div>
      {doc.blocks.map((b, i) => (
        <Fragment key={b.id}>
          {dragId && dropIndex === i && <DropLine />}
          <BlockRow
          block={b}
          isFirst={i === 0}
          selected={selectedIds.has(b.id)}
          dragging={dragId === b.id || (dragId !== null && selectedIds.has(dragId) && selectedIds.has(b.id))}
          onHandlePointerDown={onHandlePointerDown}
          justDraggedRef={justDraggedRef}
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
          onPasteMarkdown={(text) => pasteMarkdown(b.id, text)}
        />
        </Fragment>
      ))}
      {dragId && dropIndex === doc.blocks.length && <DropLine />}
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
    </BlockEditorContext.Provider>
  );
}

/* ------------------------------------------------------------------ */
/* Single block row                                                    */
/* ------------------------------------------------------------------ */

interface RowProps {
  block: DocBlock;
  isFirst: boolean;
  selected?: boolean;
  dragging?: boolean;
  onHandlePointerDown: (id: string, e: React.PointerEvent<HTMLElement>) => void;
  justDraggedRef: React.MutableRefObject<boolean>;
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
  onPasteMarkdown: (text: string) => void;
}

function BlockRow({
  block,
  selected,
  dragging,
  onHandlePointerDown,
  justDraggedRef,
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
  onPasteMarkdown,
}: RowProps) {
  const editableRef = useRef<HTMLDivElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  // Multi-line Markdown (e.g. copied from Notion) becomes real blocks.
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    if (block.type === "code" || block.type === "html") return; // take paste verbatim
    const text = e.clipboardData.getData("text/plain");
    const html = e.clipboardData.getData("text/html");
    const loneUrl = (text ?? "").trim();
    if (/^https?:\/\/\S+$/.test(loneUrl)) {
      // A bare URL pastes as a player/embed/bookmark, not as text.
      e.preventDefault();
      onCommitText();
      onPasteMarkdown(loneUrl);
      return;
    }
    // Rich HTML (Notion, Google Docs, web): convert to Markdown so links,
    // headings, lists and emphasis all survive — otherwise the plain-text
    // fallback drops every hyperlink.
    if (html && /<(a\s|h[1-6]|ul\b|ol\b|blockquote|strong|b>|em|i>|img|pre|table)/i.test(html)) {
      const md = htmlToMarkdown(html);
      if (md.trim()) {
        e.preventDefault();
        onCommitText();
        onPasteMarkdown(md);
        return;
      }
    }
    if (text && looksLikeMarkdown(text)) {
      e.preventDefault();
      onCommitText();
      onPasteMarkdown(text);
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
    <div
      data-block-id={block.id}
      data-selected={selected ? "true" : undefined}
      className={cn(
        "bcms-block group/block relative -mx-2 flex gap-1 rounded px-2 py-0.5 transition-opacity",
        dragging && "opacity-40",
        !dragging && !selected && "hover:bg-[color:var(--row-hover)]/30",
      )}
    >
      {/* Live collaborators on this paragraph */}
      {peers && peers.length > 0 && (
        <div className="absolute left-[-64px] top-1 hidden items-center sm:flex">
          {peers.slice(0, 3).map((p) => (
            <PresenceDot key={p.id} peer={p} />
          ))}
        </div>
      )}
      {/* Hover handles — kept visible while the block menu is open so Radix
          keeps a real anchor to position against (otherwise it flies to 0,0). */}
      <div className={cn(
        "absolute left-[-44px] top-1 items-center gap-0.5 text-muted-foreground",
        menuOpen ? "flex" : "hidden group-hover/block:flex",
      )}>
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
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              title="Drag to move · click for options"
              // preventDefault stops Radix opening on pointerdown, so the same
              // handle can start a drag; a plain click still opens the menu.
              onPointerDown={(e) => {
                e.preventDefault();
                onHandlePointerDown(block.id, e);
              }}
              onClick={(e) => {
                if (justDraggedRef.current || e.detail === 0) return;
                setMenuOpen((o) => !o);
              }}
              className="grid h-6 w-6 cursor-grab touch-none place-items-center rounded transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground active:cursor-grabbing"
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
        onPaste={handlePaste}
        onCheck={onCheck}
        onSrcChange={onSrcChange}
        onPatch={onPatch}
        onDuplicate={onDuplicate}
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
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
  onCheck: (checked: boolean) => void;
  onSrcChange: (src: string) => void;
  onPatch: (patch: Partial<DocBlock>) => void;
  onDuplicate?: () => void;
}

function BlockBody({
  block,
  placeholder,
  editableRef,
  onKeyDown,
  onInput,
  onBlur,
  onPaste,
  onCheck,
  onSrcChange,
  onPatch,
  onDuplicate,
}: BodyProps) {
  // Rich, self-contained widget blocks (no inline text editing).
  if (block.type === "embed" || block.type === "video") return <EmbedBlock block={block} onPatch={onPatch} />;
  if (block.type === "bookmark") return <BookmarkBlock block={block} onPatch={onPatch} />;
  if (block.type === "button") return <ButtonBlock block={block} onPatch={onPatch} />;
  if (block.type === "table") return <TableBlock block={block} onPatch={onPatch} />;
  if (block.type === "component") return <ComponentBlock block={block} onPatch={onPatch} onDuplicate={onDuplicate} />;
  if (block.type === "html") return <HtmlEmbedBlock block={block} onPatch={onPatch} />;
  if (block.type === "divider") {
    return (
      <div className="w-full py-3">
        <hr className="border-t border-border" />
      </div>
    );
  }
  if (block.type === "image") {
    return <ImageBlock block={block} onPatch={onPatch} />;
  }

  const editable = (
    <Editable
      block={block}
      editableRef={editableRef}
      onKeyDown={onKeyDown}
      onInput={onInput}
      onBlur={onBlur}
      onPaste={onPaste}
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
  onPaste,
  placeholder,
}: {
  block: DocBlock;
  editableRef: (el: HTMLDivElement | null) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLDivElement>) => void;
  onInput: () => void;
  onBlur: () => void;
  onPaste?: (e: React.ClipboardEvent<HTMLDivElement>) => void;
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
      onPaste={onPaste}
      className={`block-editable w-full outline-none ${cls}`}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Rich widget blocks                                                  */
/* ------------------------------------------------------------------ */

type WidgetProps = { block: DocBlock; onPatch: (patch: Partial<DocBlock>) => void; onDuplicate?: () => void };

/* ------------------------------------------------------------------ */
/* Image block                                                         */
/* ------------------------------------------------------------------ */

const IMG_ALIGN_CLASS: Record<NonNullable<DocBlock["align"]>, string> = {
  full: "w-full",
  center: "mx-auto max-w-[78%]",
  left: "mr-auto max-w-[62%]",
  right: "ml-auto max-w-[62%]",
};

/**
 * Rich image block: pick from the media library, upload, or paste a URL;
 * then caption it, set alt text, align it, hyperlink it, or crop it in place.
 * Uploaded and cropped images are also saved to the project's media hub so
 * they can be reused elsewhere.
 */
function ImageBlock({ block, onPatch }: WidgetProps) {
  const { projectId } = useContext(BlockEditorContext);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [cropOpen, setCropOpen] = useState(false);
  const [urlOpen, setUrlOpen] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const align = block.align ?? "full";

  function onFile(file?: File) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result);
      const name = file.name.replace(/\.[^.]+$/, "");
      onPatch({ src: url, alt: block.alt || name });
      if (projectId) mediaActions.add(projectId, { name: file.name, url, thumbUrl: url, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  }

  const hiddenFile = (
    <input
      ref={fileRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={(e) => {
        onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  const cropDialog = block.src ? (
    <ImageCropDialog
      open={cropOpen}
      onOpenChange={setCropOpen}
      src={block.src}
      onCropped={(dataUrl) => {
        onPatch({ src: dataUrl });
        if (projectId) mediaActions.add(projectId, { name: "Cropped image", url: dataUrl, thumbUrl: dataUrl, mimeType: "image/png" });
      }}
    />
  ) : null;

  const picker = projectId ? (
    <MediaPickerDialog
      open={pickerOpen}
      onOpenChange={setPickerOpen}
      projectId={projectId}
      onSelect={(url) => onPatch({ src: url })}
    />
  ) : null;

  // ---------- Empty state ----------
  if (!block.src) {
    return (
      <div className="w-full py-2" contentEditable={false}>
        <div className="rounded-lg border border-dashed border-border bg-muted/40 px-5 py-8">
          <div className="mx-auto flex max-w-sm flex-col items-center gap-3 text-center">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <div className="text-[13px] font-medium text-foreground">Add an image</div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {projectId && (
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--row-hover)]"
                >
                  <ImageIcon className="h-3.5 w-3.5" /> Media library
                </button>
              )}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--row-hover)]"
              >
                <Upload className="h-3.5 w-3.5" /> Upload
              </button>
              <button
                type="button"
                onClick={() => setUrlOpen((v) => !v)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--row-hover)]"
              >
                <Link2 className="h-3.5 w-3.5" /> Paste URL
              </button>
            </div>
            {urlOpen && (
              <form
                className="mt-1 flex w-full items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = urlDraft.trim();
                  if (v) onPatch({ src: v });
                  setUrlOpen(false);
                  setUrlDraft("");
                }}
              >
                <input
                  autoFocus
                  type="url"
                  value={urlDraft}
                  onChange={(e) => setUrlDraft(e.target.value)}
                  placeholder="https://…"
                  className="h-8 flex-1 rounded-md border border-border bg-background px-2 text-[12.5px] focus:border-primary focus:outline-none"
                />
                <button type="submit" className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground hover:bg-[var(--primary-hover)]">
                  Add
                </button>
              </form>
            )}
          </div>
        </div>
        {hiddenFile}
        {picker}
      </div>
    );
  }

  // ---------- Filled state ----------
  const imgEl = (
    <img
      src={block.src}
      alt={block.alt ?? ""}
      className="block max-h-[520px] w-full rounded-lg object-cover"
    />
  );

  return (
    <div className="w-full py-2" contentEditable={false}>
      <figure className={IMG_ALIGN_CLASS[align]}>
        <div className="group relative overflow-hidden rounded-lg border border-border bg-muted">
          {block.href ? (
            <a href={block.href} target="_blank" rel="noreferrer" onClick={(e) => e.preventDefault()}>
              {imgEl}
            </a>
          ) : (
            imgEl
          )}

          {/* Hover toolbar */}
          <div className="absolute right-2 top-2 flex items-center gap-0.5 rounded-md border border-border bg-[var(--s-card,var(--s2))]/95 p-0.5 opacity-0 shadow-md backdrop-blur transition-opacity group-hover:opacity-100">
            <ImgToolButton title="Replace" onClick={() => (projectId ? setPickerOpen(true) : fileRef.current?.click())}>
              <ImageIcon className="h-3.5 w-3.5" />
            </ImgToolButton>

            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Align" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground">
                  {align === "left" ? <AlignLeft className="h-3.5 w-3.5" /> : align === "right" ? <AlignRight className="h-3.5 w-3.5" /> : align === "center" ? <AlignCenter className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-auto gap-0.5 p-1">
                {([
                  ["full", Maximize2, "Full width"],
                  ["center", AlignCenter, "Center"],
                  ["left", AlignLeft, "Left"],
                  ["right", AlignRight, "Right"],
                ] as const).map(([key, Icon, label]) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    onClick={() => onPatch({ align: key })}
                    className={`grid h-7 w-7 place-items-center rounded transition-colors ${
                      align === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                ))}
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Link" className={`grid h-6 w-6 place-items-center rounded hover:bg-[color:var(--row-hover)] hover:text-foreground ${block.href ? "text-primary" : "text-muted-foreground"}`}>
                  <Link2 className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Link the image to</label>
                <input
                  type="url"
                  defaultValue={block.href ?? ""}
                  placeholder="https://…"
                  onBlur={(e) => onPatch({ href: e.target.value.trim() || undefined })}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] focus:border-primary focus:outline-none"
                />
              </PopoverContent>
            </Popover>

            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="Alt text" className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-[color:var(--row-hover)] hover:text-foreground">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <label className="mb-1 block text-[11px] font-medium text-muted-foreground">Alt text (for accessibility and SEO)</label>
                <input
                  type="text"
                  defaultValue={block.alt ?? ""}
                  placeholder="Describe the image"
                  onBlur={(e) => onPatch({ alt: e.target.value })}
                  className="h-8 w-full rounded-md border border-border bg-background px-2 text-[12.5px] focus:border-primary focus:outline-none"
                />
              </PopoverContent>
            </Popover>

            <ImgToolButton title="Crop" onClick={() => setCropOpen(true)}>
              <CropIcon className="h-3.5 w-3.5" />
            </ImgToolButton>
            <ImgToolButton title="Remove image" onClick={() => onPatch({ src: undefined, caption: undefined, href: undefined })}>
              <X className="h-3.5 w-3.5" />
            </ImgToolButton>
          </div>
        </div>

        {/* Caption */}
        <input
          type="text"
          defaultValue={block.caption ?? ""}
          placeholder="Add a caption…"
          onBlur={(e) => onPatch({ caption: e.target.value })}
          className="mt-1.5 block w-full bg-transparent text-center text-[12.5px] text-muted-foreground outline-none placeholder:text-muted-foreground/50"
        />
      </figure>
      {hiddenFile}
      {picker}
      {cropDialog}
    </div>
  );
}

function ImgToolButton({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className="grid h-6 w-6 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
    >
      {children}
    </button>
  );
}

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

/** Custom code embed — paste HTML, CSS and JS; preview runs in a sandboxed
 *  iframe right in the editor (and on the published page). */
function HtmlEmbedBlock({ block, onPatch }: WidgetProps) {
  const [tab, setTab] = useState<"code" | "preview">(block.text ? "preview" : "code");
  const [draft, setDraft] = useState(block.text ?? "");
  useEffect(() => { setDraft(block.text ?? ""); }, [block.text]);
  const commit = () => { if (draft !== (block.text ?? "")) onPatch({ text: draft }); };
  return (
    <div className="my-1.5 w-full overflow-hidden rounded-xl border border-border bg-card" contentEditable={false}>
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-muted/40 px-2.5 text-[11px] font-medium text-muted-foreground">
        <FileCode className="h-3.5 w-3.5" /> Code embed
        <span className="ml-auto flex items-center gap-0.5">
          {(["preview", "code"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { commit(); setTab(t); }}
              aria-pressed={tab === t}
              className={cn("h-6 rounded px-2 text-[11px] font-medium capitalize transition-colors", tab === t ? "bg-background text-foreground shadow-sm" : "hover:text-foreground")}
            >
              {t}
            </button>
          ))}
        </span>
      </div>
      {tab === "code" ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          spellCheck={false}
          placeholder={"<style>.card { padding: 16px; }</style>\n<div class=\"card\">Any HTML, CSS and JS…</div>\n<script>console.log(\"runs in a sandbox\")</script>"}
          className="block h-44 w-full resize-y bg-[color:var(--s2)] p-3 font-mono text-[12px] leading-relaxed text-foreground outline-none"
        />
      ) : (
        <iframe
          title="Code embed preview"
          sandbox="allow-scripts"
          srcDoc={block.text || "<p style=\"font:13px system-ui;color:#888;padding:14px\">Nothing to preview yet. Switch to Code and paste HTML, CSS or JS.</p>"}
          className="block h-64 w-full border-0 bg-white"
        />
      )}
    </div>
  );
}

const miniBtn =
  "inline-flex h-7 items-center rounded-md border border-border px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground";

/** Link prop: type a URL, or pick one of the project's existing pages. */
function LinkPropEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { projectId } = useContext(BlockEditorContext);
  const pages = projectId ? getPages(projectId) : [];
  return (
    <div className="flex items-center gap-1">
      <input
        value={value}
        placeholder="https://… or /path"
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-full rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
      />
      {pages.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" title="Link to an existing page" className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-border text-muted-foreground transition-colors hover:text-foreground">
              <FileText className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="max-h-64 w-60 overflow-y-auto">
            {pages.map((p) => (
              <DropdownMenuItem key={p.id} className="justify-between gap-3 text-[12.5px]" onSelect={() => onChange(p.path)}>
                <span className="truncate">{p.title}</span>
                <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{p.path}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}

/** Image prop: media library, upload from disk, or paste a URL. */
function ImagePropEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { projectId } = useContext(BlockEditorContext);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  return (
    <div className="flex items-start gap-2">
      <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
        {value ? <img src={value} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-muted-foreground" />}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {projectId && (
          <button type="button" onClick={() => setPickerOpen(true)} className={miniBtn}>Library</button>
        )}
        <label className={cn(miniBtn, "cursor-pointer")}>
          Upload
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(URL.createObjectURL(f)); }}
          />
        </label>
        <button type="button" onClick={() => setUrlMode((v) => !v)} className={miniBtn}>URL</button>
        {value && <button type="button" onClick={() => onChange("")} className={miniBtn}>Remove</button>}
        {urlMode && (
          <input
            autoFocus
            defaultValue={value}
            placeholder="https://…"
            onKeyDown={(e) => { if (e.key === "Enter") { onChange((e.target as HTMLInputElement).value.trim()); setUrlMode(false); } }}
            onBlur={(e) => { onChange(e.target.value.trim()); setUrlMode(false); }}
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
          />
        )}
      </div>
      {projectId && (
        <MediaPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} projectId={projectId} onSelect={(url) => onChange(url)} />
      )}
    </div>
  );
}

function EmbedBlock({ block, onPatch }: WidgetProps) {
  const isVideo = block.type === "video";
  if (!block.url) {
    return (
      <div className="w-full">
        <UrlInput
          icon={isVideo ? Video : Youtube}
          label={isVideo ? "Video" : "Embed"}
          placeholder={isVideo ? "Paste a video URL (mp4, YouTube, Loom…)" : "Paste a YouTube, Loom, Figma, or CodePen link"}
          onSubmit={(url) => {
            const info = detectEmbed(url);
            onPatch({ url, provider: info.provider, title: info.label });
          }}
        />
        {isVideo && (
          <label className="mt-1.5 inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-border px-2.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground">
            <Upload className="h-3 w-3" /> Upload a video file
            <input
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onPatch({ url: URL.createObjectURL(f), provider: "video", title: f.name });
              }}
            />
          </label>
        )}
      </div>
    );
  }
  const info = detectEmbed(block.url);
  const fileVideo = /\.(mp4|webm|ogg|mov|m4v)(\?|$)/i.test(block.url.split("?")[0] + "?");
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

/** Inline-editable text inside a component preview. Click and type — commits
 *  on blur/Enter as a per-instance override. */
function InlineProp({
  value,
  onCommit,
  className,
  multiline,
}: {
  value: string;
  onCommit: (v: string) => void;
  className?: string;
  multiline?: boolean;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || document.activeElement === el) return;
    if (el.textContent !== value) el.textContent = value;
  }, [value]);
  return (
    <span
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      data-inline-prop
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === "Enter" && !multiline) {
          e.preventDefault();
          (e.target as HTMLElement).blur();
        }
        if (e.key === "Escape") {
          if (ref.current) ref.current.textContent = value;
          (e.target as HTMLElement).blur();
        }
      }}
      onBlur={() => onCommit((ref.current?.textContent ?? "").trim())}
      className={cn(
        "cursor-text rounded-sm outline-none transition-shadow focus:ring-2 focus:ring-white/50 focus:ring-offset-0",
        className,
      )}
    />
  );
}

/** A component instance: everything is editable — inline in the preview or in
 *  the props form — and every edit is a per-instance OVERRIDE. The component
 *  in the catalog never changes. */
function ComponentBlock({ block, onPatch, onDuplicate }: WidgetProps) {
  const def = componentDef(block.component);
  const [formOpen, setFormOpen] = useState(false);
  if (!def) return <div className="text-[12px] text-muted-foreground">Unknown component</div>;

  const p = block.componentProps ?? {};
  const getVal = (f: ComponentField): string =>
    f.slot === "title" ? (block.title ?? "") : f.slot === "desc" ? (block.desc ?? "") : (p[f.key] ?? "");
  const setVal = (f: ComponentField, v: string) => {
    if (f.slot === "title") onPatch({ title: v });
    else if (f.slot === "desc") onPatch({ desc: v });
    else onPatch({ componentProps: { ...p, [f.key]: v } });
  };
  const isOverridden = (f: ComponentField) => getVal(f) !== componentFieldDefault(def, f);
  const overridden = def.fields.filter(isOverridden);

  // Preview lookups by field key (covers slot fields transparently).
  const get = (key: string): string => {
    const f = def.fields.find((x) => x.key === key);
    return f ? getVal(f) : (p[key] ?? "");
  };
  const set = (key: string) => (v: string) => {
    const f = def.fields.find((x) => x.key === key);
    if (f) setVal(f, v);
  };

  const resetAll = () => {
    const d = def.defaults();
    onPatch({ title: d.title ?? "", desc: d.desc ?? "", componentProps: { ...(d.props ?? {}) } });
    toast.success("Overrides reset", { description: `Back to the ${def.label} component defaults.` });
  };

  const headBtn =
    "grid h-5.5 w-5.5 place-items-center rounded transition-colors hover:bg-white/25 focus:outline-none";

  return (
    <div className="group/cmp my-1.5 w-full overflow-hidden rounded-xl border border-border bg-card" contentEditable={false}>
      <div className={`flex h-8 items-center gap-2 bg-gradient-to-r ${def.accent} px-3 text-[11px] font-semibold text-white`}>
        <Boxes className="h-3.5 w-3.5 shrink-0" />
        {def.label}
        {overridden.length > 0 && (
          <span
            className="rounded-full bg-white/20 px-1.5 py-0.5 text-[9.5px] font-medium"
            title={`Overridden here: ${overridden.map((f) => f.label).join(", ")}. The ${def.label} component is unchanged.`}
          >
            {overridden.length} {overridden.length === 1 ? "override" : "overrides"}
          </span>
        )}
        <span className="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-[9.5px] font-medium uppercase tracking-wide">Instance</span>
        <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/cmp:opacity-100">
          {overridden.length > 0 && (
            <button type="button" title="Reset all overrides" onClick={resetAll} className={headBtn}>
              <RotateCcw className="h-3 w-3" />
            </button>
          )}
          {onDuplicate && (
            <button type="button" title="Duplicate this instance" onClick={onDuplicate} className={headBtn}>
              <CopyPlus className="h-3 w-3" />
            </button>
          )}
          <button
            type="button"
            title="Edit props"
            aria-pressed={formOpen}
            onClick={() => setFormOpen((v) => !v)}
            className={cn(headBtn, formOpen && "bg-white/25")}
          >
            <SlidersHorizontal className="h-3 w-3" />
          </button>
        </span>
      </div>

      {/* The preview IS the editor: click any text and type. */}
      <div className="p-4">
        <ComponentPreview keyName={block.component} get={get} set={set} onOpenForm={() => setFormOpen(true)} />
      </div>

      {/* Full props form — the complete editable surface, with per-prop reset. */}
      {formOpen && (
        <div className="border-t border-border bg-muted/20 px-4 py-3" onMouseDown={(e) => e.stopPropagation()}>
          <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
            {def.fields.map((f) => (
              <PropField
                key={f.key}
                field={f}
                value={getVal(f)}
                overridden={isOverridden(f)}
                onChange={(v) => setVal(f, v)}
                onReset={() => setVal(f, componentFieldDefault(def, f))}
              />
            ))}
          </div>
          <p className="mt-3 text-[10.5px] text-muted-foreground">
            Edits apply to this instance only — the {def.label} component stays unchanged.
          </p>
        </div>
      )}
    </div>
  );
}

/** One prop in the instance form: label, override marker, control, reset. */
function PropField({
  field,
  value,
  overridden,
  onChange,
  onReset,
}: {
  field: ComponentField;
  value: string;
  overridden: boolean;
  onChange: (v: string) => void;
  onReset: () => void;
}) {
  const inputCls =
    "w-full rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none transition-colors focus:border-primary";
  return (
    <div className={field.kind === "multiline" || field.kind === "list" || field.kind === "image" ? "sm:col-span-2" : undefined}>
      <div className="mb-1 flex h-4 items-center gap-1.5">
        <label className="text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground">{field.label}</label>
        {overridden && (
          <>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" title="Overridden on this instance" />
            <button
              type="button"
              onClick={onReset}
              title="Reset to component default"
              className="grid h-4 w-4 place-items-center rounded text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-2.5 w-2.5" />
            </button>
          </>
        )}
      </div>
      {field.kind === "link" ? (
        <LinkPropEditor value={value} onChange={onChange} />
      ) : field.kind === "image" ? (
        <ImagePropEditor value={value} onChange={onChange} />
      ) : field.kind === "list" ? (
        <ListPropEditor value={value} onChange={onChange} />
      ) : field.kind === "multiline" ? (
        <textarea value={value} rows={2} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "resize-none py-1.5")} />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={cn(inputCls, "h-7")} />
      )}
    </div>
  );
}

/** Newline-separated list prop as add/remove rows (e.g. pricing features). */
function ListPropEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const items = value.length ? value.split("\n") : [];
  const commit = (next: string[]) => onChange(next.join("\n"));
  return (
    <div className="space-y-1">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-1">
          <input
            value={it}
            onChange={(e) => commit(items.map((x, j) => (j === i ? e.target.value : x)))}
            className="h-7 w-full rounded-md border border-border bg-background px-2 text-[12px] text-foreground outline-none transition-colors focus:border-primary"
          />
          <button
            type="button"
            title="Remove item"
            onClick={() => commit(items.filter((_, j) => j !== i))}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => commit([...items, ""])}
        className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--row-hover)] hover:text-foreground"
      >
        <Plus className="h-3 w-3" /> Add item
      </button>
    </div>
  );
}

/** The live preview of an instance — every visible text is click-to-edit and
 *  commits as an override on this instance. */
function ComponentPreview({ keyName, get, set, onOpenForm }: { keyName?: string; get: (key: string) => string; set: (key: string) => (v: string) => void; onOpenForm?: () => void }) {
  const title = get("title");
  const desc = get("desc");
  switch (keyName) {
    case "cta-banner":
      return (
        <div className="rounded-lg bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-5 py-4 text-center text-white">
          <div className="text-[15px] font-semibold"><InlineProp value={title} onCommit={set("title")} /></div>
          <div className="mt-0.5 text-[12px] opacity-90"><InlineProp value={desc} onCommit={set("desc")} /></div>
          <span className="mt-2.5 inline-flex h-8 items-center rounded-md bg-white px-3 text-[12px] font-semibold text-indigo-600"><InlineProp value={get("button")} onCommit={set("button")} className="focus:ring-indigo-300" /></span>
        </div>
      );
    case "newsletter":
      return (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <div className="text-[14px] font-semibold text-foreground"><InlineProp value={title} onCommit={set("title")} className="focus:ring-primary/40" /></div>
          <div className="text-[12px] text-muted-foreground"><InlineProp value={desc} onCommit={set("desc")} className="focus:ring-primary/40" /></div>
          <div className="mt-2 flex gap-2">
            <span className="flex h-8 flex-1 items-center rounded-md border border-border bg-background px-2.5 text-[12px] text-muted-foreground"><InlineProp value={get("placeholder")} onCommit={set("placeholder")} className="focus:ring-primary/40" /></span>
            <span className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground"><InlineProp value={get("button")} onCommit={set("button")} /></span>
          </div>
        </div>
      );
    case "pricing": {
      const features = get("features").split("\n").filter(Boolean);
      return (
        <div className="rounded-lg border border-border px-4 py-3">
          <div className="text-[12px] font-medium text-muted-foreground"><InlineProp value={title} onCommit={set("title")} className="focus:ring-primary/40" /></div>
          <div className="mt-0.5 flex items-baseline gap-1">
            <span className="text-[26px] font-bold tracking-tight text-foreground"><InlineProp value={get("price")} onCommit={set("price")} className="focus:ring-primary/40" /></span>
            <span className="text-[12px] text-muted-foreground"><InlineProp value={get("period")} onCommit={set("period")} className="focus:ring-primary/40" /></span>
          </div>
          <ul className="mt-2 space-y-1">
            {features.map((f, i) => (
              <li key={i} className="flex items-center gap-1.5 text-[12px] text-foreground">
                <span className="text-emerald-500">✓</span>
                <InlineProp
                  value={f}
                  onCommit={(v) => {
                    const next = [...features];
                    if (v) next[i] = v; else next.splice(i, 1);
                    set("features")(next.join("\n"));
                  }}
                  className="focus:ring-primary/40"
                />
              </li>
            ))}
          </ul>
          <span className="mt-2.5 inline-flex h-8 items-center rounded-md bg-primary px-3 text-[12px] font-semibold text-primary-foreground"><InlineProp value={get("button")} onCommit={set("button")} /></span>
        </div>
      );
    }
    case "testimonial":
      return (
        <figure className="rounded-lg border border-border bg-muted/30 px-4 py-3">
          <blockquote className="text-[14px] font-medium leading-snug text-foreground">“<InlineProp value={title} onCommit={set("title")} multiline className="focus:ring-primary/40" />”</blockquote>
          <figcaption className="mt-2 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-amber-500/20 text-[11px] font-semibold text-amber-600">{(get("author") || "A").charAt(0)}</span>
            <span className="text-[11.5px]"><span className="font-semibold text-foreground"><InlineProp value={get("author")} onCommit={set("author")} className="focus:ring-primary/40" /></span><span className="text-muted-foreground"> · <InlineProp value={get("role")} onCommit={set("role")} className="focus:ring-primary/40" /></span></span>
          </figcaption>
        </figure>
      );
    case "stat":
      return (
        <div className="text-center">
          <div className="bg-gradient-to-r from-violet-500 to-purple-500 bg-clip-text text-[34px] font-bold leading-none tracking-tight text-transparent"><InlineProp value={title} onCommit={set("title")} className="focus:ring-violet-300" /></div>
          <div className="mt-1 text-[12px] text-muted-foreground"><InlineProp value={desc} onCommit={set("desc")} className="focus:ring-primary/40" /></div>
        </div>
      );
    case "profile":
      return (
        <div className="flex items-center gap-3">
          <button
            type="button"
            title="Change photo"
            onClick={onOpenForm}
            onMouseDown={(e) => e.stopPropagation()}
            className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-pink-500 to-rose-500 text-[15px] font-semibold text-white"
          >
            {get("avatar") ? <img src={get("avatar")} alt="" className="h-full w-full object-cover" /> : (title || "A").charAt(0)}
          </button>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground"><InlineProp value={title} onCommit={set("title")} className="focus:ring-primary/40" /> <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"><InlineProp value={get("role")} onCommit={set("role")} className="focus:ring-primary/40" /></span></div>
            <div className="text-[12px] text-muted-foreground"><InlineProp value={desc} onCommit={set("desc")} multiline className="focus:ring-primary/40" /></div>
          </div>
        </div>
      );
    case "product-hunt":
      return (
        <div className="inline-flex items-center gap-2 rounded-lg border border-orange-300/50 bg-orange-500/10 px-3 py-2">
          <Award className="h-4 w-4 text-orange-500" />
          <span className="text-[12.5px] font-medium text-foreground"><InlineProp value={title} onCommit={set("title")} className="focus:ring-orange-300" /></span>
          <span className="rounded-full bg-orange-500 px-1.5 py-0.5 text-[9.5px] font-bold uppercase text-white"><InlineProp value={get("tag")} onCommit={set("tag")} /></span>
        </div>
      );
    case "faq":
      return (
        <div>
          <div className="flex items-center gap-1.5 text-[13.5px] font-semibold text-foreground"><MessagesSquare className="h-3.5 w-3.5 text-muted-foreground" /><InlineProp value={title} onCommit={set("title")} className="focus:ring-primary/40" /></div>
          <div className="mt-1 pl-5 text-[12.5px] text-muted-foreground"><InlineProp value={desc} onCommit={set("desc")} multiline className="focus:ring-primary/40" /></div>
        </div>
      );
    default:
      return (
        <div>
          <div className="text-[13.5px] font-semibold text-foreground"><InlineProp value={title} onCommit={set("title")} className="focus:ring-primary/40" /></div>
          <div className="mt-0.5 text-[12px] text-muted-foreground"><InlineProp value={desc} onCommit={set("desc")} className="focus:ring-primary/40" /></div>
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
