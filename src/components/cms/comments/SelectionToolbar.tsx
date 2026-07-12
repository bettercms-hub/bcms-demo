import { useEffect, useMemo, useRef, useState } from "react";
import { Bold, Check, Copy, ExternalLink, FileText, Heading1, Heading2, Heading3, Heading4, Heading5, Heading6, Italic, Link2, MessageSquarePlus, Search, Unlink, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { commentsUi } from "@/lib/cms/comments-store";
import { getPages } from "@/lib/cms/pages-store";
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

/** Walk up from the selection to the editor root to read its project id, so
 *  the link editor can offer an existing-page picker. */
function projectIdFor(range: Range): string | null {
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== document.body) {
    if (node.nodeType === 1) {
      const el = node as HTMLElement;
      if (el.dataset?.projectId) return el.dataset.projectId;
    }
    node = node.parentNode;
  }
  return null;
}

/** If the selection sits inside an existing <a>, return that anchor so the
 *  editor can prefill (edit-in-place: URL, new-tab, rel) instead of always
 *  creating a fresh link. */
function anchorFor(range: Range): HTMLAnchorElement | null {
  let node: Node | null = range.commonAncestorContainer;
  while (node && node !== document.body) {
    if (node.nodeType === 1 && (node as HTMLElement).tagName === "A") return node as HTMLAnchorElement;
    node = node.parentNode;
  }
  return null;
}

/** Link relationship options for SEO — the same set the visual editor exposes. */
const REL_OPTIONS: { token: string; label: string; hint: string }[] = [
  { token: "", label: "None", hint: "A normal followed link" },
  { token: "nofollow", label: "nofollow", hint: "Do not pass ranking to this link" },
  { token: "sponsored", label: "sponsored", hint: "Paid, ad, or sponsored link" },
  { token: "ugc", label: "ugc", hint: "User-generated content" },
];
const REL_RELATIONSHIPS = ["nofollow", "sponsored", "ugc"];

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
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkQuery, setLinkQuery] = useState("");
  const [linkNewTab, setLinkNewTab] = useState(false);
  const [linkRel, setLinkRel] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [hadLink, setHadLink] = useState(false);
  const editAnchorRef = useRef<HTMLAnchorElement | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const rangeRef = useRef<Range | null>(null);
  const textRef = useRef("");
  const posRef = useRef<{ x: number; y: number } | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

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
      setProjectId(projectIdFor(r));
      setLinkOpen(false);
      setLinkQuery("");
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

  const pageMatches = useMemo(() => {
    if (!projectId) return [];
    const q = linkQuery.trim().toLowerCase();
    const pages = getPages(projectId);
    const list = q
      ? pages.filter((p) => p.title.toLowerCase().includes(q) || p.path.toLowerCase().includes(q))
      : pages;
    return list.slice(0, 6);
  }, [projectId, linkQuery, linkOpen]);

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

  /** Re-select the saved range so execCommand targets the original selection
   *  even though focus moved to the URL input. execCommand only acts on the
   *  focused contentEditable, so focus its host block first. */
  function restoreSelection() {
    const saved = rangeRef.current ?? range;
    if (!saved) return false;
    let host: Node | null = saved.commonAncestorContainer;
    while (host && host !== document.body) {
      if (host.nodeType === 1 && (host as HTMLElement).isContentEditable) {
        (host as HTMLElement).focus();
        break;
      }
      host = host.parentNode;
    }
    const sel = window.getSelection();
    if (!sel) return false;
    sel.removeAllRanges();
    sel.addRange(saved);
    return true;
  }

  function openLinkEditor() {
    const saved = rangeRef.current ?? range;
    const anchor = saved ? anchorFor(saved) : null;
    editAnchorRef.current = anchor;
    setHadLink(!!anchor);
    setLinkUrl(anchor?.getAttribute("href") ?? "");
    setLinkNewTab(anchor?.getAttribute("target") === "_blank");
    const relTokens = (anchor?.getAttribute("rel") ?? "").split(/\s+/);
    setLinkRel(REL_RELATIONSHIPS.find((r) => relTokens.includes(r)) ?? "");
    setLinkQuery("");
    setLinkOpen(true);
    // Focus the input on the next tick, once it has mounted.
    setTimeout(() => linkInputRef.current?.focus(), 0);
  }

  function applyLink(rawUrl: string, newTab = linkNewTab, rel = linkRel) {
    const url = rawUrl.trim();
    if (!url) return;
    if (/^\s*javascript:/i.test(url)) {
      toast.error("That link scheme is not allowed");
      return;
    }
    // Allow http(s), mailto, tel, and site-relative; otherwise assume https.
    const safe = /^(https?:|mailto:|tel:|\/|#)/i.test(url) ? url : `https://${url}`;
    // A new-tab link always carries the security rel tokens on top of the SEO one.
    const relValue = [rel, newTab && "noopener", newTab && "noreferrer"].filter(Boolean).join(" ");
    if (!editable) {
      setLinkOpen(false);
      return;
    }

    const existing = editAnchorRef.current;
    if (existing && existing.isConnected) {
      // Edit in place — no execCommand, so we never nest anchors.
      existing.setAttribute("href", safe);
      if (newTab) existing.setAttribute("target", "_blank");
      else existing.removeAttribute("target");
      if (relValue) existing.setAttribute("rel", relValue);
      else existing.removeAttribute("rel");
      existing.focus?.();
    } else {
      if (!restoreSelection()) {
        setLinkOpen(false);
        return;
      }
      document.execCommand("createLink", false, safe);
      // execCommand can't set target/rel — tag the freshly created anchor.
      const sel = window.getSelection();
      let node = sel?.anchorNode as Node | null;
      while (node && !(node.nodeType === 1 && (node as HTMLElement).tagName === "A")) node = node.parentNode;
      const anchor =
        (node as HTMLAnchorElement | null) ??
        (sel && sel.rangeCount ? (sel.getRangeAt(0).commonAncestorContainer.parentElement?.closest("a") as HTMLAnchorElement | null) : null);
      if (anchor) {
        if (newTab) anchor.setAttribute("target", "_blank");
        if (relValue) anchor.setAttribute("rel", relValue);
      }
    }
    window.dispatchEvent(new CustomEvent("bcms:doc-format", { detail: { blockId: editable.blockId } }));
    editAnchorRef.current = null;
    setLinkOpen(false);
    setPos(null);
    toast.success(hadLink ? "Link updated" : "Link added");
  }

  function removeLink() {
    if (!restoreSelection() || !editable) {
      setLinkOpen(false);
      return;
    }
    document.execCommand("unlink", false, "");
    window.dispatchEvent(new CustomEvent("bcms:doc-format", { detail: { blockId: editable.blockId } }));
    editAnchorRef.current = null;
    setLinkOpen(false);
    setPos(null);
    toast.success("Link removed");
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
      {editable && (
        <ToolButton onClick={openLinkEditor} icon={<Link2 className="h-3 w-3" />}>
          Link
        </ToolButton>
      )}

      {linkOpen && (
        <div
          data-no-comment
          className="absolute left-0 top-[calc(100%+6px)] w-72 rounded-md border border-border/70 bg-[color:var(--s2)] p-2 text-[11px] shadow-xl"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-1 rounded border border-border/70 bg-[color:var(--s1)] px-1.5">
            <Link2 className="h-3 w-3 shrink-0 text-muted-foreground" />
            <input
              ref={linkInputRef}
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  applyLink(linkUrl);
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  setLinkOpen(false);
                }
              }}
              placeholder="Paste a link or /page"
              className="h-7 flex-1 bg-transparent text-[12px] text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="button"
              title="Apply"
              onClick={() => applyLink(linkUrl)}
              className="grid h-5 w-5 place-items-center rounded bg-[color:var(--color-primary)] text-white hover:opacity-90"
            >
              <Check className="h-3 w-3" />
            </button>
          </div>

          {projectId && (
            <>
              <div className="mt-2 flex items-center gap-1 rounded border border-border/70 bg-[color:var(--s1)] px-1.5">
                <Search className="h-3 w-3 shrink-0 text-muted-foreground" />
                <input
                  value={linkQuery}
                  onChange={(e) => setLinkQuery(e.target.value)}
                  placeholder="Search existing pages"
                  className="h-6 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="mt-1 max-h-40 overflow-y-auto">
                {pageMatches.length === 0 ? (
                  <p className="px-1 py-1.5 text-[11px] text-muted-foreground">No pages found</p>
                ) : (
                  pageMatches.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyLink(p.path)}
                      className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-[color:var(--color-row-hover)]"
                    >
                      <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-[12px] text-foreground">{p.title}</span>
                      <span className="shrink-0 truncate text-[10px] text-muted-foreground">{p.path}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {/* Open in new tab */}
          <label className="mt-2 flex cursor-pointer items-center justify-between rounded bg-[color:var(--s1)] px-2 py-1.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-foreground/85">
              <ExternalLink className="h-3 w-3 text-muted-foreground" /> Open in new tab
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={linkNewTab}
              aria-label="Open in new tab"
              onClick={() => setLinkNewTab((v) => !v)}
              className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${linkNewTab ? "bg-[color:var(--color-primary)]" : "bg-border"}`}
            >
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow-sm transition-all ${linkNewTab ? "left-[14px]" : "left-0.5"}`} />
            </button>
          </label>

          {/* Link relationship (rel) — SEO control */}
          <div className="mt-2">
            <div className="mb-1 px-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-muted-foreground">Link relationship</div>
            <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Link relationship">
              {REL_OPTIONS.map((o) => {
                const on = linkRel === o.token;
                return (
                  <button
                    key={o.token || "none"}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    title={o.hint}
                    onClick={() => setLinkRel(o.token)}
                    className={`rounded border px-1.5 py-0.5 text-[10.5px] font-medium transition-colors ${
                      on
                        ? "border-[color:var(--color-primary)] bg-[color:var(--color-primary)]/10 text-[color:var(--color-primary)]"
                        : "border-border/70 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {hadLink && (
              <button
                type="button"
                onClick={removeLink}
                className="flex items-center gap-1 rounded px-1.5 py-1 text-[11px] text-rose-500 hover:bg-rose-500/10"
              >
                <Unlink className="h-3 w-3" /> Remove
              </button>
            )}
            <button
              type="button"
              onClick={() => applyLink(linkUrl)}
              disabled={!linkUrl.trim()}
              className="ml-auto rounded bg-[color:var(--color-primary)] px-2.5 py-1 text-[11.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {hadLink ? "Save" : "Apply"}
            </button>
          </div>
        </div>
      )}
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
