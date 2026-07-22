/**
 * CommentSystem — a Figma/Sanity-style collaborative commenting layer for the
 * visual editor.
 *
 * Comments are anchored to a CONTENT FIELD (badge, headline, …) plus an optional
 * text range. A field-anchored thread renders in whichever surface is active —
 * the visual canvas OR the form panel — so a note is reachable in both modes.
 *
 * A thread is a list of messages. Each message supports reactions, @mentions
 * (highlighted inline via a contentEditable composer), an image, edit, and
 * delete. The root message shows the quoted text it was left on (Sanity-style).
 * A CommentsPanel lists every thread so anyone can jump straight to one.
 */
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import {
  AtSign,
  Check,
  CheckCheck,
  ImageIcon,
  Link2,
  MessageSquare,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Send,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* --------------------------------------------------------------- model */

export type Reaction = { emoji: string; by: string };
export type CommentMsg = {
  id: string;
  author: string;
  body: string;
  image?: string;
  ts: number;
  reactions: Reaction[];
  edited?: boolean;
};
export type CommentThread = {
  id: string;
  fieldKey: string;
  fieldLabel: string;
  quote: string;
  start?: number;
  end?: number;
  messages: CommentMsg[];
  resolved?: boolean;
};
/** Which panel a pin/thread is being anchored from, for popover positioning. */
export type Surface = "canvas" | "form";

export const ME = "Himanshu Sahu";
export const MEMBERS = ["Himanshu Sahu", "Arnab Dhar", "Kiran Rao", "Vamsi Krishna", "Priya Nair"];
const REACTIONS = ["👍", "❤️", "😂", "🎉", "👀", "🙏"];

const AVATAR_COLORS = ["#6366f1", "#D54646", "#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#761B36"];
function hueOf(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase();
}
export function newId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}
export function newMessage(author: string, body: string, image?: string): CommentMsg {
  return { id: newId("m"), author, body, image, ts: Date.now(), reactions: [] };
}
function timeAgo(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 45) return "just now";
  if (s < 90) return "1m";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 7200) return "1h";
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}
function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string) {
  return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}
function mentionRegex() {
  const names = MEMBERS.map(escapeRe).sort((a, b) => b.length - a.length).join("|");
  return new RegExp(`@(${names})`, "g");
}
/** Serialize plain "@Name" text into composer HTML with highlighted mention chips. */
function mentionsToHtml(value: string): string {
  const re = mentionRegex();
  let out = "";
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(value))) {
    out += escapeHtml(value.slice(last, m.index));
    out += `<span contenteditable="false" class="bcms-mention" data-mention="${escapeAttr(m[1])}">@${escapeHtml(m[1])}</span>`;
    last = m.index + m[0].length;
  }
  out += escapeHtml(value.slice(last));
  return out;
}

/** Map a character range within a field element to a DOM Range across its text nodes. */
export function rangeFromOffsets(field: HTMLElement, start: number, end: number): Range | null {
  const range = document.createRange();
  const walker = document.createTreeWalker(field, NodeFilter.SHOW_TEXT);
  let acc = 0;
  let startSet = false;
  let node = walker.nextNode();
  while (node) {
    const len = node.textContent?.length ?? 0;
    if (!startSet && acc + len >= start) {
      range.setStart(node, Math.max(0, start - acc));
      startSet = true;
    }
    if (startSet && acc + len >= end) {
      range.setEnd(node, Math.max(0, end - acc));
      return range;
    }
    acc += len;
    node = walker.nextNode();
  }
  return startSet ? range : null;
}

/** Styles for mention chips + composer placeholder. Mount once, works in any mode. */
export function CommentStyles() {
  return (
    <style>{`
.bcms-mention { background: rgba(99,102,241,0.14); color: #4f46e5; border-radius: 4px; padding: 0 3px; font-weight: 500; white-space: nowrap; }
.bcms-composer.is-empty:before { content: attr(data-placeholder); color: #a6a6a6; pointer-events: none; }
`}</style>
  );
}

/* --------------------------------------------------------------- avatar */

export function Avatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: hueOf(name), fontSize: size * 0.42 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* --------------------------------------------------------------- pin */

export function CommentPin({
  thread,
  active,
  onClick,
}: {
  thread: CommentThread;
  active: boolean;
  onClick: () => void;
}) {
  const root = thread.messages[0];
  const count = thread.messages.length;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={`${root?.author}: ${root?.body || "comment"}`}
      className={`pointer-events-auto grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full rounded-bl-none text-[10px] font-bold text-white shadow-md ring-2 ring-white transition-transform hover:scale-110 ${
        thread.resolved ? "bg-emerald-500" : "bg-indigo-600"
      } ${active ? "scale-110 ring-indigo-200" : ""}`}
      style={{ background: thread.resolved ? undefined : hueOf(root?.author ?? "") }}
    >
      {thread.resolved ? <Check className="h-3 w-3" strokeWidth={3} /> : count > 1 ? count : initials(root?.author ?? "?")[0]}
    </button>
  );
}

/* --------------------------------------------------------------- pin overlay */

/**
 * Renders comment pins over a container by measuring its `[data-field]` children.
 * The overlay lives INSIDE the (relative, non-scrolling) content element so pins
 * scroll naturally with content; positions only recompute on resize/content change.
 */
export function CommentLayer({
  containerRef,
  threads,
  commentMode,
  activeThreadId,
  onOpen,
  onNew,
  recalcKey,
}: {
  containerRef: RefObject<HTMLElement | null>;
  threads: CommentThread[];
  commentMode: boolean;
  activeThreadId: string | null;
  onOpen: (threadId: string) => void;
  onNew: (fieldKey: string, fieldLabel: string) => void;
  recalcKey: unknown;
}) {
  const [spots, setSpots] = useState<{ key: string; label: string; top: number; left: number }[]>([]);

  useLayoutEffect(() => {
    const c = containerRef.current;
    if (!c) {
      setSpots([]);
      return;
    }
    function measure() {
      const el = containerRef.current;
      if (!el) return;
      const cr = el.getBoundingClientRect();
      const next = [...el.querySelectorAll<HTMLElement>("[data-field]")].map((f) => {
        const r = f.getBoundingClientRect();
        return {
          key: f.dataset.field ?? "",
          label: f.dataset.fieldLabel ?? f.dataset.field ?? "",
          top: r.top - cr.top,
          left: r.left - cr.left,
        };
      });
      setSpots(next);
    }
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(c);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [containerRef, recalcKey]);

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      {spots.map((s) => {
        const list = threads.filter((t) => t.fieldKey === s.key);
        if (list.length === 0 && !commentMode) return null;
        return (
          <div key={s.key} style={{ position: "absolute", top: s.top, left: s.left, transform: "translate(-50%, -50%)" }} className="flex items-center gap-1">
            {list.map((t) => (
              <CommentPin key={t.id} thread={t} active={t.id === activeThreadId} onClick={() => onOpen(t.id)} />
            ))}
            {commentMode && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onNew(s.key, s.label);
                }}
                title={`Comment on ${s.label}`}
                aria-label={`Comment on ${s.label}`}
                className="pointer-events-auto grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full rounded-bl-none border border-indigo-200 bg-white text-indigo-500 opacity-60 shadow-sm transition-all hover:scale-110 hover:opacity-100"
              >
                <MessageSquarePlus className="h-3 w-3" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------- composer */

function placeCaretEnd(el: HTMLElement) {
  const r = document.createRange();
  r.selectNodeContents(el);
  r.collapse(false);
  const s = window.getSelection();
  s?.removeAllRanges();
  s?.addRange(r);
}

function Composer({
  onSubmit,
  placeholder,
  sendLabel,
  autoFocus,
  initialValue,
}: {
  onSubmit: (body: string, image?: string) => void;
  placeholder: string;
  sendLabel?: string;
  autoFocus?: boolean;
  initialValue?: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [image, setImage] = useState<string | null>(null);
  const [mentionQ, setMentionQ] = useState<string | null>(null);
  const [emoji, setEmoji] = useState(false);
  const [empty, setEmpty] = useState(!initialValue);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    el.innerHTML = initialValue ? mentionsToHtml(initialValue) : "";
    setEmpty(!initialValue);
    if (autoFocus) {
      el.focus();
      placeCaretEnd(el);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const matches = mentionQ === null ? [] : MEMBERS.filter((m) => m.toLowerCase().includes(mentionQ.toLowerCase())).slice(0, 5);

  function queryAtCaret(): string | null {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || !sel.isCollapsed || sel.rangeCount === 0 || !el || !el.contains(sel.getRangeAt(0).endContainer)) return null;
    const range = sel.getRangeAt(0);
    const pre = range.cloneRange();
    pre.selectNodeContents(el);
    pre.setEnd(range.endContainer, range.endOffset);
    const m = pre.toString().match(/@(\w*)$/);
    return m ? m[1] : null;
  }
  function refresh() {
    const el = editorRef.current;
    setEmpty(!el || el.innerText.replace(/ /g, " ").trim() === "");
    setMentionQ(queryAtCaret());
  }
  function insertMention(name: string) {
    const sel = window.getSelection() as (Selection & { modify?: (a: string, b: string, c: string) => void }) | null;
    const el = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !el) return;
    const q = queryAtCaret() ?? mentionQ ?? "";
    for (let i = 0; i < q.length + 1; i++) sel.modify?.("extend", "backward", "character");
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const chip = document.createElement("span");
    chip.setAttribute("contenteditable", "false");
    chip.className = "bcms-mention";
    chip.dataset.mention = name;
    chip.textContent = "@" + name;
    const space = document.createTextNode(" ");
    range.insertNode(space);
    range.insertNode(chip);
    const after = document.createRange();
    after.setStartAfter(space);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);
    setMentionQ(null);
    refresh();
  }
  function insertText(text: string) {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount && el.contains(sel.getRangeAt(0).endContainer)) {
      const r = sel.getRangeAt(0);
      r.deleteContents();
      const t = document.createTextNode(text);
      r.insertNode(t);
      r.setStartAfter(t);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    } else {
      el.appendChild(document.createTextNode(text));
      placeCaretEnd(el);
    }
    setEmoji(false);
    refresh();
  }
  function readImage(file?: File) {
    if (!file) return;
    const r = new FileReader();
    r.onload = () => setImage(String(r.result));
    r.readAsDataURL(file);
  }
  function submit() {
    const el = editorRef.current;
    const body = el ? el.innerText.replace(/ /g, " ").trim() : "";
    if (!body && !image) return;
    onSubmit(body, image ?? undefined);
    if (el) el.innerHTML = "";
    setImage(null);
    setEmpty(true);
    setMentionQ(null);
  }

  return (
    <div className="relative">
      {image && (
        <div className="mb-1.5 inline-flex items-start gap-1 rounded-lg border border-slate-200 p-1">
          <img src={image} alt="attachment" className="h-14 w-14 rounded-md object-cover" />
          <button type="button" onClick={() => setImage(null)} className="grid h-4 w-4 place-items-center rounded-full bg-slate-200 text-slate-600 hover:bg-slate-300" aria-label="Remove image">
            <X className="h-2.5 w-2.5" />
          </button>
        </div>
      )}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={refresh}
          onKeyUp={refresh}
          onKeyDown={(e) => {
            if (mentionQ !== null && matches.length && e.key === "Enter") {
              e.preventDefault();
              insertMention(matches[0]);
              return;
            }
            if (mentionQ !== null && e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              setMentionQ(null);
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          className={cn(
            "bcms-composer max-h-32 min-h-[38px] w-full overflow-y-auto whitespace-pre-wrap break-words rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-[12.5px] leading-snug text-slate-900 outline-none transition-shadow focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100",
            empty && "is-empty",
          )}
        />
        {mentionQ !== null && matches.length > 0 && (
          <div className="absolute bottom-full left-0 z-10 mb-1.5 w-56 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
            <div className="px-2 pb-0.5 pt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Mention</div>
            {matches.map((m) => (
              <button
                key={m}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  insertMention(m);
                }}
                className="flex w-full items-center gap-2 px-2 py-1.5 text-left hover:bg-slate-100"
              >
                <Avatar name={m} size={20} />
                <span className="text-[12.5px] text-slate-700">{m}</span>
              </button>
            ))}
          </div>
        )}
        {emoji && (
          <div className="absolute bottom-full left-0 z-10 mb-1.5 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
            {REACTIONS.map((e) => (
              <button key={e} type="button" onMouseDown={(ev) => ev.preventDefault()} onClick={() => insertText(e)} className="grid h-7 w-7 place-items-center rounded-md text-[15px] hover:bg-slate-100">
                {e}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-1 flex items-center gap-0.5">
        <ComposerBtn label="Mention someone" onClick={() => insertText("@")}>
          <AtSign className="h-4 w-4" />
        </ComposerBtn>
        <ComposerBtn label="Attach image" onClick={() => fileRef.current?.click()}>
          <ImageIcon className="h-4 w-4" />
        </ComposerBtn>
        <ComposerBtn label="Emoji" onClick={() => setEmoji((v) => !v)}>
          <Smile className="h-4 w-4" />
        </ComposerBtn>
        <div className="flex-1" />
        <button
          type="button"
          onClick={submit}
          disabled={empty && !image}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-indigo-600 px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sendLabel ?? <Send className="h-3.5 w-3.5" />}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          readImage(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />
    </div>
  );
}

function ComposerBtn({ children, onClick, label }: { children: ReactNode; onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="grid h-7 w-7 place-items-center rounded-md text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
      {children}
    </button>
  );
}

/* --------------------------------------------------------------- message body + reactions */

function Body({ body }: { body: string }) {
  if (!body) return null;
  const re = mentionRegex();
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(body))) {
    if (m.index > last) out.push(body.slice(last, m.index));
    out.push(
      <span key={`mn${i++}`} className="rounded bg-indigo-50 px-0.5 font-medium text-indigo-600">
        @{m[1]}
      </span>,
    );
    last = m.index + m[0].length;
  }
  if (last < body.length) out.push(body.slice(last));
  return <span className="whitespace-pre-wrap break-words text-[12.5px] leading-relaxed text-slate-700">{out}</span>;
}

function Reactions({ msg, onReact }: { msg: CommentMsg; onReact: (emoji: string) => void }) {
  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const r of msg.reactions) {
    const g = groups.get(r.emoji) ?? { count: 0, mine: false };
    g.count++;
    if (r.by === ME) g.mine = true;
    groups.set(r.emoji, g);
  }
  if (groups.size === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {[...groups.entries()].map(([emoji, g]) => (
        <button
          key={emoji}
          type="button"
          onClick={() => onReact(emoji)}
          className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] transition-colors ${
            g.mine ? "border-indigo-300 bg-indigo-50 text-indigo-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          <span>{emoji}</span>
          <span className="font-medium">{g.count}</span>
        </button>
      ))}
    </div>
  );
}

function Message({
  msg,
  isRoot,
  quote,
  onReact,
  onDelete,
  onEdit,
}: {
  msg: CommentMsg;
  isRoot: boolean;
  quote?: string;
  onReact: (emoji: string) => void;
  onDelete: () => void;
  onEdit: (body: string) => void;
}) {
  const [pick, setPick] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const mine = msg.author === ME;
  return (
    <div className="group/msg relative flex gap-2">
      <Avatar name={msg.author} size={26} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12.5px] font-semibold text-slate-900">{msg.author}</span>
          <span className="shrink-0 text-[11px] text-slate-400">
            {timeAgo(msg.ts)}
            {msg.edited && " · edited"}
          </span>
          {!editing && (
            <div className="relative ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100">
              <button type="button" onClick={() => setPick((v) => !v)} title="Add reaction" className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <Smile className="h-3.5 w-3.5" />
              </button>
              {mine && (
                <button type="button" onClick={() => setMenu((v) => !v)} title="More" className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              )}
              {pick && (
                <div className="absolute right-0 top-7 z-10 flex gap-0.5 rounded-lg border border-slate-200 bg-white p-1 shadow-xl">
                  {REACTIONS.map((e) => (
                    <button key={e} type="button" onClick={() => { onReact(e); setPick(false); }} className="grid h-7 w-7 place-items-center rounded-md text-[15px] hover:bg-slate-100">
                      {e}
                    </button>
                  ))}
                </div>
              )}
              {menu && (
                <div className="absolute right-0 top-7 z-10 w-32 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                  <button type="button" onClick={() => { setEditing(true); setMenu(false); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-100">
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </button>
                  <button type="button" onClick={() => { onDelete(); setMenu(false); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-3.5 w-3.5" /> Delete{isRoot ? " thread" : ""}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {isRoot && quote && (
          <div className="mt-1 line-clamp-2 border-l-2 border-indigo-300 pl-2 text-[12px] italic text-slate-500">{quote}</div>
        )}

        {editing ? (
          <div className="mt-1">
            <Composer
              autoFocus
              initialValue={msg.body}
              placeholder="Edit comment…"
              sendLabel="Save"
              onSubmit={(b) => {
                onEdit(b);
                setEditing(false);
              }}
            />
            <button type="button" onClick={() => setEditing(false)} className="mt-1 text-[11px] text-slate-400 hover:text-slate-600">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="mt-0.5">
              <Body body={msg.body} />
            </div>
            {msg.image && <img src={msg.image} alt="attachment" className="mt-1.5 max-h-40 rounded-lg border border-slate-200 object-cover" />}
            <Reactions msg={msg} onReact={onReact} />
          </>
        )}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- positioned popover */

function AnchoredPopover({
  getRect,
  onClose,
  width = 332,
  children,
}: {
  getRect: () => DOMRect | null;
  onClose: () => void;
  width?: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    function place() {
      const a = getRect();
      const p = ref.current;
      if (!a || !p) return;
      const ph = p.offsetHeight;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const m = 8;
      const gap = 12;
      let left = a.right + gap;
      if (left + width > vw - m) left = a.left - width - gap;
      if (left < m) left = Math.max(m, Math.min(a.left, vw - width - m));
      const top = Math.max(m, Math.min(a.top - 6, vh - ph - m));
      setPos((prev) => (prev && prev.top === top && prev.left === left ? prev : { top, left }));
    }
    place();
    const ro = new ResizeObserver(place);
    if (ref.current) ro.observe(ref.current);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [onClose]);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-label="Comment thread"
      style={{ position: "fixed", top: pos?.top ?? -9999, left: pos?.left ?? -9999, width, opacity: pos ? 1 : 0, zIndex: 76 }}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-[0_16px_50px_-12px_rgba(53,30,39,0.45)]"
    >
      {children}
    </div>,
    document.body,
  );
}

/* --------------------------------------------------------------- thread + new-comment popovers */

export function ThreadPopover({
  thread,
  getRect,
  onClose,
  onReply,
  onReact,
  onDeleteMsg,
  onEditMsg,
  onResolve,
  onCopyLink,
}: {
  thread: CommentThread;
  getRect: () => DOMRect | null;
  onClose: () => void;
  onReply: (body: string, image?: string) => void;
  onReact: (msgId: string, emoji: string) => void;
  onDeleteMsg: (msgId: string) => void;
  onEditMsg: (msgId: string, body: string) => void;
  onResolve: () => void;
  onCopyLink: () => void;
}) {
  const [menu, setMenu] = useState(false);
  return (
    <AnchoredPopover getRect={getRect} onClose={onClose}>
      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 text-[11px] font-medium text-slate-500">
          <MessageSquare className="h-3 w-3 shrink-0" /> <span className="truncate">On {thread.fieldLabel}</span>
          {thread.resolved && <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 text-[10px] font-semibold text-emerald-600"><Check className="h-2.5 w-2.5" />Resolved</span>}
        </div>
        <div className="relative flex shrink-0 items-center gap-0.5">
          <button type="button" onClick={onResolve} title={thread.resolved ? "Reopen" : "Resolve"} className={`grid h-6 w-6 place-items-center rounded-md hover:bg-slate-100 ${thread.resolved ? "text-emerald-600" : "text-slate-400 hover:text-slate-600"}`}>
            <CheckCheck className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => setMenu((v) => !v)} title="More" className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={onClose} title="Close" className="grid h-6 w-6 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
          {menu && (
            <div className="absolute right-0 top-7 z-10 w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button" onClick={() => { onCopyLink(); setMenu(false); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-slate-700 hover:bg-slate-100">
                <Link2 className="h-3.5 w-3.5" /> Copy link
              </button>
              <button type="button" onClick={() => { onDeleteMsg(thread.messages[0].id); setMenu(false); }} className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] text-destructive hover:bg-destructive/10">
                <Trash2 className="h-3.5 w-3.5" /> Delete thread
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-h-[46vh] space-y-3.5 overflow-y-auto px-3 py-2.5">
        {thread.messages.map((m, i) => (
          <Message
            key={m.id}
            msg={m}
            isRoot={i === 0}
            quote={i === 0 ? thread.quote : undefined}
            onReact={(e) => onReact(m.id, e)}
            onDelete={() => onDeleteMsg(m.id)}
            onEdit={(b) => onEditMsg(m.id, b)}
          />
        ))}
      </div>

      <div className="border-t border-slate-100 p-2">
        <Composer placeholder="Reply…" onSubmit={onReply} />
      </div>
    </AnchoredPopover>
  );
}

export function NewCommentPopover({
  fieldLabel,
  quote,
  getRect,
  onSubmit,
  onCancel,
}: {
  fieldLabel: string;
  quote: string;
  getRect: () => DOMRect | null;
  onSubmit: (body: string, image?: string) => void;
  onCancel: () => void;
}) {
  return (
    <AnchoredPopover getRect={getRect} onClose={onCancel}>
      <div className="flex items-center gap-1 border-b border-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500">
        <MessageSquarePlus className="h-3 w-3" /> Comment on {fieldLabel}
      </div>
      <div className="p-2">
        {quote && <div className="mb-1.5 line-clamp-2 border-l-2 border-indigo-300 pl-2 text-[12px] italic text-slate-500">{quote}</div>}
        <Composer autoFocus placeholder="Add a comment…" sendLabel="Comment" onSubmit={onSubmit} />
      </div>
    </AnchoredPopover>
  );
}

/* --------------------------------------------------------------- comments manager panel */

export function CommentsPanel({
  threads,
  activeId,
  onOpen,
  onClose,
}: {
  threads: CommentThread[];
  activeId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<"open" | "resolved" | "all">("open");
  const openN = threads.filter((t) => !t.resolved).length;
  const resolvedN = threads.filter((t) => t.resolved).length;
  const shown = threads.filter((t) => (filter === "all" ? true : filter === "resolved" ? t.resolved : !t.resolved));

  return (
    <div className="flex h-full w-[300px] shrink-0 flex-col border-l border-border bg-background">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-1.5 text-[13px] font-semibold text-foreground">
          <MessageSquare className="h-4 w-4" /> Comments
        </div>
        <button type="button" onClick={onClose} aria-label="Close comments" className="grid h-6 w-6 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="flex gap-1 border-b border-[color:var(--border-hairline)] px-2 py-1.5">
        {([["open", openN], ["resolved", resolvedN], ["all", threads.length]] as const).map(([f, n]) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-md px-2 py-1 text-[11.5px] font-medium capitalize transition-colors",
              filter === f ? "bg-[color:var(--s2)] text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {f} · {n}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
        {shown.length === 0 ? (
          <div className="px-2 py-8 text-center text-[12px] text-muted-foreground">No {filter} comments.</div>
        ) : (
          shown.map((t) => {
            const root = t.messages[0];
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onOpen(t.id)}
                className={cn(
                  "w-full rounded-lg border p-2 text-left transition-colors",
                  activeId === t.id ? "border-indigo-300 bg-indigo-50/60" : "border-transparent hover:bg-[color:var(--color-row-hover)]",
                )}
              >
                <div className="flex items-center gap-1.5">
                  <Avatar name={root.author} size={20} />
                  <span className="truncate text-[12px] font-semibold text-foreground">{root.author}</span>
                  <span className="ml-auto shrink-0 text-[10.5px] text-muted-foreground">{timeAgo(root.ts)}</span>
                </div>
                <div className="mt-1 flex items-center gap-1 text-[10.5px] font-medium text-indigo-500">
                  <MessageSquare className="h-3 w-3" /> {t.fieldLabel}
                  {t.resolved && <span className="text-emerald-600">· Resolved</span>}
                </div>
                <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">{root.body}</p>
                {t.messages.length > 1 && <div className="mt-1 text-[10.5px] text-muted-foreground">{t.messages.length} messages</div>}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
