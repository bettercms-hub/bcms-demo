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
  | "bullet"
  | "numbered"
  | "todo"
  | "quote"
  | "callout"
  | "code"
  | "divider"
  | "image";

export interface DocBlock {
  id: string;
  type: DocBlockType;
  text?: string;
  checked?: boolean;
  src?: string;
  alt?: string;
  language?: string;
  emoji?: string;
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
    // Split on double newlines into paragraphs.
    const paragraphs = text.split(/\n{2,}/g);
    return {
      version: 1,
      blocks: paragraphs.map((p) => ({ id: blockId(), type: "paragraph", text: p })),
    };
  }
  return emptyDoc();
}

/** Plain-text projection (used for previews, summaries, search). */
export function docToPlainText(doc: DocValue): string {
  return doc.blocks
    .map((b) => {
      if (b.type === "divider") return "";
      if (b.type === "image") return b.alt ?? "";
      return b.text ?? "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export const BLOCK_PLACEHOLDER: Record<DocBlockType, string> = {
  paragraph: "Type '/' for commands",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
  bullet: "List item",
  numbered: "List item",
  todo: "To-do",
  quote: "Quote",
  callout: "Callout",
  code: "Code",
  divider: "",
  image: "",
};
