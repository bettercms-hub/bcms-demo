/**
 * markdown — two-way bridge between the block editor's DocValue and
 * Markdown text. Powers three things:
 *
 *   1. Paste: Markdown from anywhere (Notion copies as Markdown) turns
 *      into real blocks instead of one plain-text blob.
 *   2. The editor's Markdown view: see and edit the whole document as
 *      Markdown, then flip back to blocks.
 *   3. Round trip with the delivery layer (.md twins, llms.txt).
 *
 * Deliberately dependency-free. Prose maps 1:1 (headings, lists, todos,
 * quotes, code, tables, images, dividers). Widgets keep honest textual
 * forms: embeds/bookmarks are bare URLs on their own line (and parse back
 * into embeds), callouts use the `> [!tone]` convention, toggles use
 * <details>. Component instances travel as an HTML comment so nothing is
 * silently lost.
 */
import { detectEmbed, fakeBookmarkMeta, type EmbedInfo } from "./rich-blocks";
import { blockId, type DocBlock, type DocTone, type DocValue } from "./doc";

/* ------------------------------------------------------------- inline */

/** Editor inline HTML (b/i/a) → Markdown. */
function inlineToMd(html: string): string {
  return html
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/<(i|em)>([\s\S]*?)<\/\1>/gi, "*$2*")
    .replace(/<u>([\s\S]*?)<\/u>/gi, "$1")
    .replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)")
    .replace(/<br\s*\/?>/gi, "  \n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

/** Markdown inline marks → the editor's sanitized inline HTML. */
function mdToInline(md: string): string {
  let s = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  // Links first so their labels can still carry bold/italic.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");
  s = s.replace(/__([^_]+)__/g, "<b>$1</b>");
  s = s.replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<i>$2</i>");
  s = s.replace(/(^|[^_])_([^_\n]+)_/g, "$1<i>$2</i>");
  return s;
}

/** Strip inline marks entirely (for fields that hold plain text). */
function mdToPlain(md: string): string {
  return mdToInline(md)
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const hasMarks = (s: string) => /<(b|i|a)\b/.test(s);

/** Convert one parsed-md inline string to the editor's storage form:
 * inline HTML only when real marks are present, else plain text. */
function inlineValue(md: string): string {
  const html = mdToInline(md);
  return hasMarks(html) ? html : mdToPlain(md);
}

/* ---------------------------------------------------------- serialize */

const TONE_TAG: Record<DocTone, string> = {
  info: "info", success: "success", warning: "warning", danger: "danger", neutral: "note",
};

export function blocksToMarkdown(doc: DocValue): string {
  const out: string[] = [];
  let numberedRun = 0;
  for (const b of doc.blocks) {
    if (b.type !== "numbered") numberedRun = 0;
    switch (b.type) {
      case "h1": case "h2": case "h3": case "h4": case "h5": case "h6":
        out.push(`${"#".repeat(Number(b.type[1]))} ${inlineToMd(b.text ?? "")}`);
        break;
      case "bullet":
        out.push(`- ${inlineToMd(b.text ?? "")}`);
        break;
      case "numbered":
        numberedRun += 1;
        out.push(`${numberedRun}. ${inlineToMd(b.text ?? "")}`);
        break;
      case "todo":
        out.push(`- [${b.checked ? "x" : " "}] ${inlineToMd(b.text ?? "")}`);
        break;
      case "quote":
        out.push(`> ${inlineToMd(b.text ?? "")}`);
        break;
      case "callout":
        out.push(`> [!${TONE_TAG[b.tone ?? "info"]}] ${inlineToMd(b.text ?? "")}`);
        break;
      case "html":
        out.push("```html\n" + (b.text ?? "") + "\n```");
        break;
      case "code":
        out.push("```" + (b.language ?? "") + "\n" + (b.text ?? "") + "\n```");
        break;
      case "divider":
        out.push("---");
        break;
      case "image": {
        const title = b.caption ? ` "${b.caption.replace(/"/g, "'")}"` : "";
        out.push(`![${b.alt ?? ""}](${b.src ?? ""}${title})`);
        break;
      }
      case "table": {
        const rows = b.rows ?? [];
        if (rows.length === 0) break;
        const line = (r: string[]) => `| ${r.map((c) => c.replace(/\|/g, "\\|")).join(" | ")} |`;
        const cols = rows[0].length;
        const md = [line(rows[0]), `| ${Array(cols).fill("---").join(" | ")} |`, ...rows.slice(1).map(line)];
        out.push(md.join("\n"));
        break;
      }
      case "button":
        out.push(`[${b.label ?? "Button"}](${b.href ?? "#"})`);
        break;
      case "embed": case "video": case "bookmark":
        out.push(b.url ?? "");
        break;
      case "toggle":
        out.push(`<details>\n<summary>${inlineToMd(b.text ?? "")}</summary>\n\n${b.bodyText ?? ""}\n\n</details>`);
        break;
      case "component":
        out.push(`<!-- bcms:component ${b.component ?? ""} ${JSON.stringify({ title: b.title, desc: b.desc, props: b.componentProps ?? {} })} -->`);
        break;
      default:
        out.push(inlineToMd(b.text ?? ""));
    }
  }
  return out.filter((s) => s !== undefined).join("\n\n").trim() + "\n";
}

/* -------------------------------------------------------------- parse */

const URL_LINE = /^https?:\/\/\S+$/;

/** Pasted HTML (Notion, docs, web) → Markdown, so links + formatting survive
 *  the trip into blocks. Block-level tags become lines; inline uses inlineToMd. */
export function htmlToMarkdown(html: string): string {
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, "");
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  const lines: string[] = [];
  const inline = (el: Element) => inlineToMd(el.innerHTML).trim();
  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = (child.textContent ?? "").replace(/\s+/g, " ").trim();
        if (t) lines.push(t);
        return;
      }
      if (child.nodeType !== 1) return;
      const el = child as HTMLElement;
      switch (el.tagName.toLowerCase()) {
        case "h1": lines.push("# " + inline(el)); break;
        case "h2": lines.push("## " + inline(el)); break;
        case "h3": lines.push("### " + inline(el)); break;
        case "h4": lines.push("#### " + inline(el)); break;
        case "h5": lines.push("##### " + inline(el)); break;
        case "h6": lines.push("###### " + inline(el)); break;
        case "blockquote": lines.push("> " + (inline(el) || (el.textContent ?? "").trim())); break;
        case "pre": lines.push("```\n" + (el.textContent ?? "") + "\n```"); break;
        case "hr": lines.push("---"); break;
        case "ul":
          el.querySelectorAll(":scope > li").forEach((li) => lines.push("- " + inlineToMd((li as HTMLElement).innerHTML).trim()));
          break;
        case "ol":
          el.querySelectorAll(":scope > li").forEach((li, i) => lines.push(`${i + 1}. ` + inlineToMd((li as HTMLElement).innerHTML).trim()));
          break;
        case "li": lines.push("- " + inline(el)); break;
        case "img": lines.push(`![${el.getAttribute("alt") ?? ""}](${el.getAttribute("src") ?? ""})`); break;
        case "figure": case "div": case "section": case "article": case "main": case "body":
          walk(el); break;
        case "p": { const md = inline(el); if (md) lines.push(md); break; }
        case "br": break;
        default: { const md = inlineToMd(el.outerHTML).trim(); if (md) lines.push(md); }
      }
    });
  };
  walk(tpl.content);
  return lines.filter((l) => l !== "").join("\n\n");
}

export function markdownToBlocks(md: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const push = (b: Omit<DocBlock, "id">) => blocks.push({ id: blockId(), ...b });
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) { i += 1; continue; }

    // Fenced code
    const fence = trimmed.match(/^```(\w*)\s*$/);
    if (fence) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !/^```\s*$/.test(lines[i].trim())) { buf.push(lines[i]); i += 1; }
      i += 1; // closing fence
      push({ type: "code", text: buf.join("\n"), language: fence[1] || undefined });
      continue;
    }

    // Component comment
    const comp = trimmed.match(/^<!--\s*bcms:component\s+([\w-]+)\s+(\{[\s\S]*\})\s*-->$/);
    if (comp) {
      try {
        const data = JSON.parse(comp[2]) as { title?: string; desc?: string; props?: Record<string, string> };
        push({ type: "component", component: comp[1], title: data.title, desc: data.desc, componentProps: data.props ?? {} });
      } catch {
        push({ type: "paragraph", text: trimmed });
      }
      i += 1;
      continue;
    }

    // <details> toggle
    if (/^<details>/i.test(trimmed)) {
      const chunk: string[] = [];
      while (i < lines.length && !/<\/details>/i.test(lines[i])) { chunk.push(lines[i]); i += 1; }
      chunk.push(lines[i] ?? ""); i += 1;
      const all = chunk.join("\n");
      const summary = all.match(/<summary>([\s\S]*?)<\/summary>/i)?.[1] ?? "Toggle";
      const body = all
        .replace(/<\/?details>/gi, "")
        .replace(/<summary>[\s\S]*?<\/summary>/i, "")
        .trim();
      push({ type: "toggle", text: mdToPlain(summary), bodyText: mdToPlain(body), open: false });
      continue;
    }

    // Heading
    const h = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      push({ type: `h${h[1].length}` as DocBlock["type"], text: inlineValue(h[2]) });
      i += 1;
      continue;
    }

    // Divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) { push({ type: "divider", text: "" }); i += 1; continue; }

    // Image
    const img = trimmed.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    if (img) {
      push({ type: "image", src: img[2], alt: img[1] || undefined, caption: img[3] || undefined });
      i += 1;
      continue;
    }

    // Callout / quote
    const callout = trimmed.match(/^>\s*\[!(\w+)\]\s*(.*)$/);
    if (callout) {
      const tone = (Object.entries(TONE_TAG).find(([, tag]) => tag === callout[1].toLowerCase())?.[0] ?? "info") as DocTone;
      push({ type: "callout", tone, text: inlineValue(callout[2]) });
      i += 1;
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i].trim())) { buf.push(lines[i].trim().replace(/^>\s?/, "")); i += 1; }
      push({ type: "quote", text: inlineValue(buf.join(" ")) });
      continue;
    }

    // Table (GFM)
    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|?[\s:|-]+\|?$/.test(lines[i + 1].trim()) && lines[i + 1].includes("-")) {
      const rows: string[][] = [];
      const parseRow = (l: string) => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map((c) => c.replace(/\\\|/g, "|").trim());
      rows.push(parseRow(lines[i]).map(mdToPlain));
      i += 2; // skip separator
      while (i < lines.length && lines[i].trim().startsWith("|")) { rows.push(parseRow(lines[i]).map(mdToPlain)); i += 1; }
      push({ type: "table", rows, hasHeader: true });
      continue;
    }

    // Lists (bullet / numbered / todo)
    const todo = trimmed.match(/^[-*+]\s+\[([ xX])\]\s+(.*)$/);
    const bullet = trimmed.match(/^[-*+]\s+(.*)$/);
    const numbered = trimmed.match(/^\d+[.)]\s+(.*)$/);
    if (todo) { push({ type: "todo", checked: todo[1] !== " ", text: inlineValue(todo[2]) }); i += 1; continue; }
    if (bullet) { push({ type: "bullet", text: inlineValue(bullet[1]) }); i += 1; continue; }
    if (numbered) { push({ type: "numbered", text: inlineValue(numbered[1]) }); i += 1; continue; }

    // Bare URL on its own line → embed (YouTube, Figma, Loom…) or bookmark.
    if (URL_LINE.test(trimmed)) {
      const info: EmbedInfo = detectEmbed(trimmed);
      if (info.provider === "video") {
        push({ type: "video", url: trimmed, provider: "video", title: "Video" });
      } else if (info.provider !== "generic") {
        push({ type: "embed", url: trimmed, provider: info.provider, title: info.label });
      } else {
        const meta = fakeBookmarkMeta(trimmed);
        push({ type: "bookmark", url: trimmed, title: meta.title, desc: meta.desc, site: meta.site });
      }
      i += 1;
      continue;
    }

    // Paragraph: gather until a blank line or a structural line.
    const buf: string[] = [trimmed];
    i += 1;
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|```|\||!\[|---|<details|<!--)/.test(lines[i].trim()) &&
      !URL_LINE.test(lines[i].trim())
    ) {
      buf.push(lines[i].trim());
      i += 1;
    }
    push({ type: "paragraph", text: inlineValue(buf.join(" ")) });
  }

  return blocks;
}

/* ----------------------------------------------------- paste detection */

/** Cheap heuristic: does pasted text read as Markdown rather than prose?
 * Needs structure (headings, lists, fences, images, tables, quotes) or
 * multiple inline marks across multiple lines. */
export function looksLikeMarkdown(text: string): boolean {
  const t = text.trim();
  if (!t || !t.includes("\n")) return false;
  const lines = t.split("\n");
  let structural = 0;
  for (const l of lines) {
    const s = l.trim();
    if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|```|!\[|\|.*\|$|---$)/.test(s)) structural += 1;
  }
  if (structural >= 2) return true;
  const inline = (t.match(/\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/g) ?? []).length;
  return structural >= 1 && inline >= 1;
}
