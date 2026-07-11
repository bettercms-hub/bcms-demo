/**
 * Document blocks — the data model behind the Notion-style block editor.
 *
 * Stored as the value of a `richText` field. Strings stored by older versions
 * are migrated lazily at read time into a single paragraph block.
 */

export type DocBlockType =
  | "paragraph"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "image"
  // Rich blocks
  | "embed"
  | "bookmark"
  | "video"
  | "button"
  | "table"
  | "toggle"
  | "component";

/** Callout / accent tone shared by callouts and some rich blocks. */
export type DocTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  text?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
  language?: string;
  emoji?: string;
  // Callout
  tone?: DocTone;
  // Embed / bookmark / video
  url?: string;
  provider?: string;
  title?: string;
  desc?: string;
  site?: string;
  // Button
  label?: string;
  href?: string;
  variant?: string;
  // Table
  rows?: string[][];
  hasHeader?: boolean;
  // Toggle
  open?: boolean;
  bodyText?: string;
  // Component instance
  component?: string;
  componentProps?: Record<string, string>;
}

export interface DocValue {
  version: 1;
  blocks: DocBlock[];
}

let _uid = 0;
export function blockId(): string {
  _uid += 1;
  return `b_${Date.now().toString(36)}_${_uid.toString(36)}`;
}

export function emptyParagraph(): DocBlock {
  return { id: blockId(), type: "paragraph", text: "" };
}

export function emptyDoc(): DocValue {
  return { version: 1, blocks: [emptyParagraph()] };
}

/** Coerce any stored value into a normalised DocValue. */
export function parseDoc(value: unknown): DocValue {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (value as DocValue).version === 1 &&
    Array.isArray((value as DocValue).blocks)
  ) {
    const v = value as DocValue;
    if (v.blocks.length === 0) return emptyDoc();
    return v;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return emptyDoc();
    // Seeded/imported content often arrives as an HTML string. Turn its
    // block-level tags into real editor blocks so it renders formatted.
    if (/<(p|h[1-6]|ul|ol|li|blockquote|pre|hr)\b/i.test(text)) {
      const blocks = htmlToBlocks(text);
      if (blocks.length) return { version: 1, blocks };
    }
    const paragraphs = text.split(/\n{2,}/g);
    return {
      version: 1,
      blocks: paragraphs.map((p) => ({ id: blockId(), type: "paragraph", text: p })),
    };
  }
  return emptyDoc();
}

const HTML_TO_TYPE: Record<string, DocBlockType> = {
  h1: "h1", h2: "h2", h3: "h3", h4: "h4", h5: "h5", h6: "h6",
  blockquote: "quote", pre: "code",
};

function decode(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/** Lightweight, dependency-free HTML → DocBlock[] (block-level only). */
function htmlToBlocks(html: string): DocBlock[] {
  const blocks: DocBlock[] = [];
  const re = /<(p|h[1-6]|blockquote|pre|ul|ol|hr)\b[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = (m[1] ?? "hr").toLowerCase();
    const inner = m[2] ?? "";
    if (tag === "hr") {
      blocks.push({ id: blockId(), type: "divider", text: "" });
    } else if (tag === "ul" || tag === "ol") {
      const items = inner.match(/<li\b[^>]*>([\s\S]*?)<\/li>/gi) ?? [];
      for (const li of items) {
        const t = decode(li);
        if (t) blocks.push({ id: blockId(), type: tag === "ol" ? "numbered" : "bullet", text: t });
      }
    } else {
      const t = decode(inner);
      if (t) blocks.push({ id: blockId(), type: HTML_TO_TYPE[tag] ?? "paragraph", text: t });
    }
  }
  return blocks;
}

/** Plain-text projection (used for previews, summaries, search). */
export function docToPlainText(doc: DocValue): string {
  return doc.blocks
    .map((b) => {
      switch (b.type) {
        case "divider":
          return "";
        case "image":
          return b.alt ?? "";
        case "button":
          return b.label ?? "";
        case "bookmark":
          return b.title || b.url || "";
        case "embed":
        case "video":
          return b.title || b.url || "";
        case "toggle":
          return [b.text, b.bodyText].filter(Boolean).join("\n");
        case "table":
          return (b.rows ?? []).map((r) => r.join(" | ")).join("\n");
        case "component":
          return b.title || b.component || "";
        default:
          return b.text ?? "";
      }
    })
    .filter(Boolean)
    .join("\n\n");
}

export const BLOCK_PLACEHOLDER: Record<DocBlockType, string> = {
  paragraph: "Type '/' for commands",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  h4: "Heading 4",
  h5: "Heading 5",
  h6: "Heading 6",
  bullet: "List item",
  numbered: "List item",
  todo: "To-do",
  quote: "Quote",
  callout: "Callout",
  code: "Code",
  divider: "",
  image: "",
  embed: "",
  bookmark: "",
  video: "",
  button: "",
  table: "",
  toggle: "Toggle",
  component: "",
};
