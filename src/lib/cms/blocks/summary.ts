/**
 * Human-readable one-line summary for a block, used by collapsed block rows
 * and the content tree. Falls back to the first string-valued prop.
 */
import type { Block } from "./registry";

function truncate(s: string, n = 60): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

function firstString(props: Record<string, unknown>): string {
  for (const v of Object.values(props)) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return "";
}

export function blockSummary(block: Block): string {
  const p = block.props ?? {};
  const kids = block.children?.length ?? 0;
  switch (block.kind) {
    case "heading": {
      const lvl = p.level ? `H${p.level}` : "H?";
      const text = typeof p.text === "string" ? p.text : "";
      return text ? `${lvl} · "${truncate(text, 60)}"` : `${lvl} · Empty heading`;
    }
    case "paragraph": {
      const text = typeof p.text === "string" ? p.text : "";
      return text ? `"${truncate(text, 80)}"` : "Empty paragraph";
    }
    case "richText": {
      const html = typeof p.html === "string" ? p.html.replace(/<[^>]+>/g, "") : "";
      return html ? `"${truncate(html, 80)}"` : "Empty content";
    }
    case "quote": {
      const text = typeof p.text === "string" ? p.text : "";
      const cite = typeof p.cite === "string" && p.cite ? ` — ${p.cite}` : "";
      return text ? `"${truncate(text, 60)}"${cite}` : "Empty quote";
    }
    case "list": {
      const items = typeof p.items === "string" ? p.items.split(/\n/).filter(Boolean).length : 0;
      return `${items} ${p.ordered ? "ordered" : "bulleted"} items`;
    }
    case "code": {
      const lang = typeof p.language === "string" ? p.language : "code";
      const code = typeof p.code === "string" ? p.code : "";
      return code ? `${lang} · ${truncate(code.split("\n")[0] ?? "", 50)}` : `${lang} snippet`;
    }
    case "image": {
      const alt = typeof p.alt === "string" ? p.alt : "";
      const src = typeof p.src === "string" ? p.src : "";
      const ratio = typeof p.ratio === "string" ? ` · ${p.ratio}` : "";
      if (alt) return `${alt}${ratio}`;
      if (src) return `${truncate(src.split("/").pop() ?? src, 40)}${ratio}`;
      return `No image${ratio}`;
    }
    case "video": {
      const src = typeof p.src === "string" ? p.src : "";
      return src ? truncate(src, 60) : "No source";
    }
    case "button": {
      const label = typeof p.label === "string" ? p.label : "";
      const variant = typeof p.variant === "string" ? ` · ${p.variant}` : "";
      return label ? `"${label}"${variant}` : `Untitled button${variant}`;
    }
    case "cta-group":
      return `${kids} button${kids === 1 ? "" : "s"}`;
    case "container":
      return `${kids} block${kids === 1 ? "" : "s"} · max ${p.maxWidth ?? "lg"}`;
    case "stack":
      return `Stack · ${kids} item${kids === 1 ? "" : "s"}`;
    case "grid": {
      const cols = typeof p.columns === "number" ? p.columns : Number(p.columns ?? 3);
      return `${cols} cols · ${kids} item${kids === 1 ? "" : "s"}`;
    }
    case "columns": {
      const count = typeof p.count === "string" || typeof p.count === "number" ? p.count : 2;
      return `${count} columns · ${kids} child${kids === 1 ? "" : "ren"}`;
    }
    case "card-group":
      return `${kids} card${kids === 1 ? "" : "s"}`;
    case "card": {
      const title = typeof p.title === "string" ? p.title : "";
      return title ? `"${truncate(title, 50)}"` : "Untitled card";
    }
    case "accordion": {
      const items = typeof p.items === "string" ? p.items.split(/\n/).filter(Boolean).length : 0;
      return `${items} item${items === 1 ? "" : "s"}`;
    }
    case "tabs": {
      const labels = typeof p.labels === "string"
        ? p.labels.split(",").map((s) => s.trim()).filter(Boolean)
        : [];
      return `${labels.length} tab${labels.length === 1 ? "" : "s"}`;
    }
    case "embed": {
      const url = typeof p.url === "string" ? p.url : "";
      return url ? truncate(url, 60) : "No URL";
    }
    case "html":
      return "Raw HTML";
    default: {
      const s = firstString(p);
      return s ? truncate(s, 80) : "";
    }
  }
}
