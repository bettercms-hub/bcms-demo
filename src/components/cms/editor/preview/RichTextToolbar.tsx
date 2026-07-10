/**
 * RichTextToolbar — a floating "bubble menu" over a text selection in the visual
 * editor. Formatting (bold / italic / underline / strike / code / link / color +
 * block type) applies live via execCommand, so it is a real inline editor.
 *
 * Architecture notes (why it's built this way):
 * - The toolbar bar is horizontally scrollable on narrow screens, so its flyout
 *   menus must NOT live inside it or they get clipped. Every flyout is portaled to
 *   document.body and positioned against its trigger button — clamped inside the
 *   viewport and flipped above/below when tight. This is the core fix.
 * - Text selection is preserved across menu interaction: we snapshot the range on
 *   open (`savedRange`) and restore + refocus the editable host before running any
 *   command, so clicking a button in a portaled panel never loses the selection.
 * - "Improve writing" opens an AI panel (back button + prompt + predefined
 *   actions). The AI actions are demo stubs until wired to the model.
 */
import {
  forwardRef,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Bold,
  Briefcase,
  Check,
  ChevronDown,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  ExternalLink,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Italic,
  Languages,
  Link2,
  MoreHorizontal,
  Palette,
  Pilcrow,
  Quote,
  RefreshCw,
  RemoveFormatting,
  Search,
  Smile,
  Sparkles,
  SpellCheck,
  Strikethrough,
  Trash2,
  Type,
  Underline,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";

const COLORS = [
  { value: "#0f172a", name: "Ink" },
  { value: "#6366f1", name: "Indigo" },
  { value: "#db2777", name: "Pink" },
  { value: "#059669", name: "Green" },
  { value: "#d97706", name: "Amber" },
  { value: "#dc2626", name: "Red" },
  { value: "#64748b", name: "Slate" },
];

const BLOCK_TYPES: { label: string; tag: string; icon: LucideIcon; sample: string }[] = [
  { label: "Text", tag: "P", icon: Pilcrow, sample: "text-[13px] font-normal" },
  { label: "Heading 1", tag: "H1", icon: Heading1, sample: "text-[17px] font-bold" },
  { label: "Heading 2", tag: "H2", icon: Heading2, sample: "text-[15px] font-bold" },
  { label: "Heading 3", tag: "H3", icon: Heading3, sample: "text-[14px] font-semibold" },
  { label: "Heading 4", tag: "H4", icon: Heading4, sample: "text-[13px] font-semibold" },
  { label: "Heading 5", tag: "H5", icon: Heading5, sample: "text-[12.5px] font-semibold" },
  { label: "Heading 6", tag: "H6", icon: Heading6, sample: "text-[12px] font-semibold uppercase tracking-wide" },
  { label: "Quote", tag: "BLOCKQUOTE", icon: Quote, sample: "text-[13px] italic" },
];

const AI_ACTIONS: { label: string; icon: LucideIcon }[] = [
  { label: "Rewrite", icon: RefreshCw },
  { label: "Fix spelling & grammar", icon: SpellCheck },
  { label: "Make shorter", icon: ChevronsDownUp },
  { label: "Make longer", icon: ChevronsUpDown },
  { label: "Simplify language", icon: Wand2 },
  { label: "Make more professional", icon: Briefcase },
  { label: "Make more casual", icon: Smile },
  { label: "Translate…", icon: Languages },
];

// A link carries ONE relationship. noopener/noreferrer are security tokens
// handled automatically when the link opens in a new tab, so they aren't shown.
const REL_OPTIONS: { token: string; label: string; hint: string }[] = [
  { token: "", label: "None", hint: "A normal followed link" },
  { token: "nofollow", label: "nofollow", hint: "Tell search engines not to pass ranking to this link" },
  { token: "sponsored", label: "sponsored", hint: "Mark paid, ad, or sponsored links" },
  { token: "ugc", label: "ugc", hint: "User-generated content, e.g. comments and forum links" },
];
const REL_RELATIONSHIPS = ["nofollow", "sponsored", "ugc"];

interface PageRef {
  path: string;
  title: string;
}

type MenuId = "ai" | "type" | "link" | "color" | "more";

export function RichTextToolbar({
  canvasRef,
  active,
  pages = [],
}: {
  canvasRef: RefObject<HTMLElement | null>;
  active: boolean;
  pages?: PageRef[];
}) {
  const [sel, setSel] = useState<{ top: number; bottom: number; centerX: number } | null>(null);
  const [place, setPlace] = useState<{ top: number; left: number } | null>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [, force] = useState(0);

  const [menu, setMenu] = useState<MenuId | null>(null);
  const menuRef = useRef<MenuId | null>(menu);
  menuRef.current = menu;
  const closeMenu = () => setMenu(null);

  // Trigger refs — flyouts anchor their position to these.
  const aiBtn = useRef<HTMLButtonElement>(null);
  const typeBtn = useRef<HTMLButtonElement>(null);
  const linkBtn = useRef<HTMLButtonElement>(null);
  const colorBtn = useRef<HTMLButtonElement>(null);
  const moreBtn = useRef<HTMLButtonElement>(null);

  // AI panel state
  const [aiPrompt, setAiPrompt] = useState("");

  // Link editor state
  const [linkUrl, setLinkUrl] = useState("");
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [linkRel, setLinkRel] = useState("");
  const [showPages, setShowPages] = useState(false);
  const [pageQuery, setPageQuery] = useState("");
  const [editingAnchor, setEditingAnchor] = useState(false);

  useEffect(() => {
    if (!active) {
      setSel(null);
      return;
    }
    function update() {
      // Freeze the toolbar while any flyout is open so focusing an input in a
      // portaled panel doesn't collapse the selection and hide everything.
      if (menuRef.current) return;
      const s = window.getSelection();
      if (!s || s.isCollapsed || s.rangeCount === 0) {
        setSel(null);
        return;
      }
      const node = s.anchorNode;
      if (!node || !canvasRef.current?.contains(node)) {
        setSel(null);
        return;
      }
      const r = s.getRangeAt(0).getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        setSel(null);
        return;
      }
      savedRange.current = s.getRangeAt(0).cloneRange();
      setSel({ top: r.top, bottom: r.bottom, centerX: r.left + r.width / 2 });
    }
    document.addEventListener("selectionchange", update);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      document.removeEventListener("selectionchange", update);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [active, canvasRef]);

  // Clamp the bar inside the viewport and flip below the selection when tight.
  useLayoutEffect(() => {
    if (!sel || !barRef.current) {
      setPlace(null);
      return;
    }
    const w = barRef.current.offsetWidth;
    const h = barRef.current.offsetHeight;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const half = w / 2;
    const left = Math.min(Math.max(sel.centerX, half + 8), Math.max(half + 8, vw - half - 8));
    let top = sel.top - h - 10;
    if (top < 8) top = Math.min(sel.bottom + 10, vh - h - 8);
    setPlace({ top, left });
  }, [sel]);

  if (!sel) return null;

  // ---- command helpers -----------------------------------------------------
  function snapshot() {
    const s = window.getSelection();
    if (s && s.rangeCount > 0 && !s.isCollapsed) savedRange.current = s.getRangeAt(0).cloneRange();
  }
  /** Restore the saved selection AND focus its editable host so execCommand lands. */
  function restoreSelection() {
    const r = savedRange.current;
    const s = window.getSelection();
    if (!r || !s) return;
    let host: Node | null = r.startContainer;
    while (host && host.nodeType === 3) host = host.parentNode;
    let el = host as HTMLElement | null;
    while (el && el !== document.body && !el.isContentEditable) el = el.parentElement;
    if (el && el.isContentEditable) el.focus();
    s.removeAllRanges();
    s.addRange(r);
  }
  function cmd(command: string, value?: string) {
    restoreSelection();
    document.execCommand(command, false, value);
    force((n) => n + 1);
  }
  function state(command: string): boolean {
    try {
      return document.queryCommandState(command);
    } catch {
      return false;
    }
  }
  function currentBlockTag(): string {
    try {
      return String(document.queryCommandValue("formatBlock") || "").toUpperCase();
    } catch {
      return "";
    }
  }
  function currentAnchor(): HTMLAnchorElement | null {
    const s = window.getSelection();
    if (!s || s.rangeCount === 0) return null;
    let n: Node | null = s.getRangeAt(0).startContainer;
    while (n && n !== canvasRef.current) {
      if (n instanceof HTMLAnchorElement) return n;
      n = n.parentNode;
    }
    return null;
  }

  // ---- openers -------------------------------------------------------------
  const toggle = (id: MenuId, onOpen?: () => void) => {
    if (menu === id) {
      closeMenu();
      return;
    }
    snapshot();
    onOpen?.();
    setMenu(id);
  };
  function openLink() {
    const a = currentAnchor();
    if (a) {
      setLinkUrl(a.getAttribute("href") || "");
      setLinkNewTab(a.getAttribute("target") === "_blank");
      const tokens = (a.getAttribute("rel") || "").split(/\s+/);
      setLinkRel(REL_RELATIONSHIPS.find((r) => tokens.includes(r)) ?? "");
      setEditingAnchor(true);
    } else {
      setLinkUrl("");
      setLinkNewTab(false);
      setLinkRel("");
      setEditingAnchor(false);
    }
    setShowPages(false);
    setPageQuery("");
  }

  // ---- AI ------------------------------------------------------------------
  function runAi(label: string) {
    restoreSelection();
    toast.success(`${label.replace(/…$/, "")} (demo)`);
    closeMenu();
    setAiPrompt("");
  }

  // ---- link apply / remove -------------------------------------------------
  function toggleNewTab() {
    setLinkNewTab((v) => !v);
  }
  function applyLink() {
    const url = linkUrl.trim();
    if (!url) return;
    restoreSelection();
    // The chosen relationship, plus security tokens when opening in a new tab.
    const rel = [linkRel, linkNewTab && "noopener", linkNewTab && "noreferrer"].filter(Boolean).join(" ");
    const existing = currentAnchor();
    if (existing) {
      existing.setAttribute("href", url);
      if (linkNewTab) existing.setAttribute("target", "_blank");
      else existing.removeAttribute("target");
      if (rel) existing.setAttribute("rel", rel);
      else existing.removeAttribute("rel");
    } else {
      const s = window.getSelection();
      const text = s && !s.isCollapsed ? s.toString() : url;
      const t = linkNewTab ? ' target="_blank"' : "";
      const r = rel ? ` rel="${rel}"` : "";
      document.execCommand(
        "insertHTML",
        false,
        `<a href="${escapeAttr(url)}"${t}${r}>${escapeHtml(text)}</a>`,
      );
    }
    force((n) => n + 1);
    closeMenu();
  }
  function removeLink() {
    restoreSelection();
    document.execCommand("unlink");
    force((n) => n + 1);
    closeMenu();
  }

  const activeBlock = menu === "type" ? currentBlockTag() : "";
  const filteredPages = pages.filter((p) => {
    const q = pageQuery.trim().toLowerCase();
    return !q || p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q);
  });

  return createPortal(
    <>
      <div
        ref={barRef}
        role="toolbar"
        aria-label="Text formatting"
        aria-orientation="horizontal"
        onMouseDown={(e) => e.preventDefault()}
        style={{
          position: "fixed",
          top: place?.top ?? sel.top - 48,
          left: place?.left ?? sel.centerX,
          transform: "translateX(-50%)",
          zIndex: 70,
          opacity: place ? 1 : 0,
          maxWidth: "calc(100vw - 16px)",
        }}
        className="flex items-center gap-0.5 overflow-x-auto rounded-xl border border-slate-200 bg-white px-1.5 py-1 text-slate-700 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.35)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {/* Improve writing → AI panel */}
        <ToolBtn
          ref={aiBtn}
          onClick={() => toggle("ai")}
          expanded={menu === "ai"}
          className="gap-1.5 px-2 font-medium text-slate-900"
        >
          <Sparkles className="h-3.5 w-3.5 text-indigo-500" /> Improve writing
          <ChevronDown className="h-3 w-3 opacity-60" />
        </ToolBtn>

        <Divider />

        {/* Block type */}
        <ToolBtn ref={typeBtn} onClick={() => toggle("type")} expanded={menu === "type"} className="gap-1 px-2">
          <Type className="h-3.5 w-3.5" /> Text <ChevronDown className="h-3 w-3 opacity-60" />
        </ToolBtn>

        <Divider />

        <IconToggle on={state("bold")} onClick={() => cmd("bold")} label="Bold">
          <Bold className="h-3.5 w-3.5" />
        </IconToggle>
        <IconToggle on={state("italic")} onClick={() => cmd("italic")} label="Italic">
          <Italic className="h-3.5 w-3.5" />
        </IconToggle>
        <IconToggle on={state("underline")} onClick={() => cmd("underline")} label="Underline">
          <Underline className="h-3.5 w-3.5" />
        </IconToggle>
        <IconToggle on={state("strikeThrough")} onClick={() => cmd("strikeThrough")} label="Strikethrough">
          <Strikethrough className="h-3.5 w-3.5" />
        </IconToggle>
        <IconToggle
          on={false}
          onClick={() => {
            const s = window.getSelection();
            const text = s?.toString() ?? "";
            if (text)
              cmd(
                "insertHTML",
                `<code style="background:#f1f5f9;border-radius:3px;padding:0 3px;font-family:ui-monospace,monospace;font-size:0.9em">${escapeHtml(text)}</code>`,
              );
          }}
          label="Inline code"
        >
          <Code2 className="h-3.5 w-3.5" />
        </IconToggle>

        <IconToggle ref={linkBtn} on={menu === "link" || !!currentAnchor()} onClick={() => toggle("link", openLink)} label="Link" expanded={menu === "link"}>
          <Link2 className="h-3.5 w-3.5" />
        </IconToggle>

        <IconToggle ref={colorBtn} on={menu === "color"} onClick={() => toggle("color")} label="Text color" expanded={menu === "color"}>
          <Palette className="h-3.5 w-3.5" />
        </IconToggle>

        <Divider />

        <IconToggle ref={moreBtn} on={menu === "more"} onClick={() => toggle("more")} label="More" expanded={menu === "more"}>
          <MoreHorizontal className="h-3.5 w-3.5" />
        </IconToggle>
      </div>

      {/* ---- AI panel ---- */}
      {menu === "ai" && (
        <Flyout anchorRef={aiBtn} onClose={closeMenu} width={296} align="left" label="AI writing assistant">
          <div className="flex items-center gap-1.5 border-b border-slate-100 p-1.5">
            <button
              type="button"
              onClick={closeMenu}
              aria-label="Back"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="relative flex-1">
              <Sparkles className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-indigo-500" />
              <input
                autoFocus
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && aiPrompt.trim()) runAi(aiPrompt.trim());
                }}
                placeholder="What do you want to do?"
                aria-label="Ask AI"
                className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-[12.5px] outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <button
              type="button"
              onClick={() => aiPrompt.trim() && runAi(aiPrompt.trim())}
              disabled={!aiPrompt.trim()}
              aria-label="Run"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-indigo-600 text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <div role="menu" aria-label="Suggested edits" className="max-h-[264px] overflow-y-auto p-1">
            <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Suggested</div>
            {AI_ACTIONS.map((a) => (
              <button
                key={a.label}
                type="button"
                role="menuitem"
                onClick={() => runAi(a.label)}
                className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] text-slate-700 transition-colors hover:bg-slate-100"
              >
                <a.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="flex-1">{a.label}</span>
              </button>
            ))}
          </div>
        </Flyout>
      )}

      {/* ---- Block type panel ---- */}
      {menu === "type" && (
        <Flyout anchorRef={typeBtn} onClose={closeMenu} width={220} align="left" label="Text style">
          <div role="menu" aria-label="Text style" className="max-h-[300px] overflow-y-auto p-1">
            {BLOCK_TYPES.map((b) => {
              const isActive = activeBlock === b.tag;
              return (
                <button
                  key={b.tag}
                  type="button"
                  role="menuitemradio"
                  aria-checked={isActive}
                  onClick={() => {
                    cmd("formatBlock", b.tag);
                    closeMenu();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
                >
                  <b.icon className="h-4 w-4 shrink-0 text-slate-400" />
                  <span className={`flex-1 text-slate-800 ${b.sample}`}>{b.label}</span>
                  {isActive && <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" />}
                </button>
              );
            })}
          </div>
        </Flyout>
      )}

      {/* ---- Link editor ---- */}
      {menu === "link" && (
        <Flyout anchorRef={linkBtn} onClose={closeMenu} width={312} align="center" label={editingAnchor ? "Edit link" : "Add link"}>
          <div className="space-y-2.5 p-2.5">
            <div>
              <label htmlFor="rt-link-url" className="mb-1 block text-[11px] font-medium text-slate-600">
                {editingAnchor ? "Edit link" : "Link to"}
              </label>
              <div className="flex items-center gap-1.5">
                <div className="relative flex-1">
                  <Link2 className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    id="rt-link-url"
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyLink();
                      }
                    }}
                    placeholder="https://your-site.com  or  /pricing"
                    className="h-8 w-full rounded-md border border-slate-200 pl-7 pr-2 text-[12.5px] outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
                  />
                </div>
                {pages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowPages((v) => !v)}
                    aria-expanded={showPages}
                    className={`flex h-8 shrink-0 items-center gap-1 rounded-md border px-2 text-[12px] font-medium transition-colors ${
                      showPages ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    Pages
                    <ChevronDown className={`h-3 w-3 transition-transform ${showPages ? "rotate-180" : ""}`} />
                  </button>
                )}
              </div>
            </div>

            {showPages && (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <div className="relative border-b border-slate-100">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={pageQuery}
                    onChange={(e) => setPageQuery(e.target.value)}
                    placeholder="Search pages…"
                    aria-label="Search pages"
                    className="h-8 w-full pl-8 pr-2 text-[12.5px] outline-none"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto p-1" role="listbox" aria-label="Pages">
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Main pages</div>
                  {filteredPages.map((p) => (
                    <button
                      key={p.path}
                      type="button"
                      role="option"
                      aria-selected={linkUrl === p.path}
                      onClick={() => {
                        setLinkUrl(p.path);
                        setShowPages(false);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-slate-100"
                    >
                      <span className="truncate text-[12.5px] text-slate-700">{p.title}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-slate-400">{p.path}</span>
                    </button>
                  ))}
                  {filteredPages.length === 0 && (
                    <div className="px-2 py-2 text-[12px] text-slate-400">No pages match “{pageQuery}”.</div>
                  )}
                </div>
              </div>
            )}

            {/* Open in new tab */}
            <div className="flex items-center justify-between rounded-md bg-slate-50 px-2.5 py-1.5">
              <span className="flex items-center gap-1.5 text-[12.5px] text-slate-700">
                <ExternalLink className="h-3.5 w-3.5 text-slate-400" /> Open in new tab
              </span>
              <Switch checked={linkNewTab} onChange={toggleNewTab} label="Open in new tab" />
            </div>

            {/* link relationship — single select */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Link relationship</div>
              <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Link relationship">
                {REL_OPTIONS.map((o) => {
                  const on = linkRel === o.token;
                  return (
                    <button
                      key={o.token || "none"}
                      type="button"
                      role="radio"
                      title={o.hint}
                      aria-checked={on}
                      onClick={() => setLinkRel(o.token)}
                      className={`rounded-md border px-2 py-1 text-[11.5px] font-medium transition-colors ${
                        on ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-400 hover:bg-slate-50 hover:text-slate-600"
                      }`}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-0.5">
              {editingAnchor && (
                <button
                  type="button"
                  onClick={removeLink}
                  className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] font-medium text-rose-600 transition-colors hover:bg-rose-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove
                </button>
              )}
              <button
                type="button"
                onClick={applyLink}
                disabled={!linkUrl.trim()}
                className="ml-auto h-8 rounded-md bg-indigo-600 px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {editingAnchor ? "Save" : "Apply"}
              </button>
            </div>
          </div>
        </Flyout>
      )}

      {/* ---- Color ---- */}
      {menu === "color" && (
        <Flyout anchorRef={colorBtn} onClose={closeMenu} width={188} align="center" label="Text color">
          <div className="p-2">
            <div className="mb-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Text color</div>
            <div className="flex flex-wrap items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  title={c.name}
                  aria-label={`${c.name} text`}
                  onClick={() => {
                    cmd("foreColor", c.value);
                    closeMenu();
                  }}
                  className="h-6 w-6 rounded-full ring-1 ring-inset ring-black/10 transition-transform hover:scale-110"
                  style={{ background: c.value }}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                cmd("removeFormat");
                closeMenu();
              }}
              className="mt-2 w-full rounded-md border border-slate-200 py-1 text-[12px] text-slate-600 transition-colors hover:bg-slate-50"
            >
              Reset to default
            </button>
          </div>
        </Flyout>
      )}

      {/* ---- More ---- */}
      {menu === "more" && (
        <Flyout anchorRef={moreBtn} onClose={closeMenu} width={196} align="right" label="More">
          <div role="menu" className="p-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                cmd("removeFormat");
                cmd("unlink");
                closeMenu();
              }}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[12.5px] text-slate-700 transition-colors hover:bg-slate-100"
            >
              <RemoveFormatting className="h-3.5 w-3.5 text-slate-400" /> Clear formatting
            </button>
          </div>
        </Flyout>
      )}
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ pieces */

const ToolBtn = forwardRef<
  HTMLButtonElement,
  { children: ReactNode; onClick: () => void; className?: string; expanded?: boolean }
>(function ToolBtn({ children, onClick, className = "", expanded }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={expanded}
      className={`inline-flex h-7 shrink-0 items-center whitespace-nowrap rounded-md px-1.5 text-[12.5px] transition-colors hover:bg-slate-100 ${
        expanded ? "bg-slate-100" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
});

const IconToggle = forwardRef<
  HTMLButtonElement,
  { children: ReactNode; onClick: () => void; on: boolean; label: string; expanded?: boolean }
>(function IconToggle({ children, onClick, on, label, expanded }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={on}
      aria-haspopup={expanded !== undefined ? "menu" : undefined}
      aria-expanded={expanded}
      className={`grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors ${
        on ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      {children}
    </button>
  );
});

function Divider() {
  return <span className="mx-0.5 h-4 w-px shrink-0 bg-slate-200" aria-hidden />;
}

function Switch({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? "bg-indigo-600" : "bg-slate-300"}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${checked ? "left-[18px]" : "left-0.5"}`}
      />
    </button>
  );
}

/**
 * Flyout — a menu/dialog portaled to <body> and positioned against a trigger
 * button (never clipped by the toolbar's overflow). Clamps inside the viewport,
 * flips above when there's no room below, closes on outside click and Escape.
 */
function Flyout({
  anchorRef,
  onClose,
  children,
  width,
  align = "center",
  label,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
  width: number;
  align?: "center" | "left" | "right";
  label: string;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    function measure() {
      const a = anchorRef.current;
      const p = panelRef.current;
      if (!a || !p) return;
      const ar = a.getBoundingClientRect();
      const pw = p.offsetWidth;
      const ph = p.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const gap = 8;
      const m = 8;
      let left =
        align === "center" ? ar.left + ar.width / 2 - pw / 2 : align === "right" ? ar.right - pw : ar.left;
      left = Math.min(Math.max(left, m), Math.max(m, vw - pw - m));
      let top = ar.bottom + gap;
      if (top + ph > vh - m) {
        const above = ar.top - gap - ph;
        top = above >= m ? above : Math.max(m, vh - ph - m);
      }
      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  });

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  return (
    <>
      <div className="fixed inset-0" style={{ zIndex: 80 }} onMouseDown={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-label={label}
        onMouseDown={(e) => {
          // Preserve the editor's text selection for clicks on buttons/labels,
          // but let inputs and textareas take focus normally.
          const t = e.target as HTMLElement;
          if (!(t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement)) e.preventDefault();
        }}
        style={{
          position: "fixed",
          top: pos?.top ?? -9999,
          left: pos?.left ?? -9999,
          width,
          maxWidth: "calc(100vw - 16px)",
          zIndex: 81,
          opacity: pos ? 1 : 0,
        }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-700 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.4)]"
      >
        {children}
      </div>
    </>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
