/**
 * Visual block renderers for Preview 2.0. Each block kind has a real
 * layout; container blocks recurse over their `children`.
 *
 * Designed to work inside the existing per-SectionKind shells in
 * `sections.tsx` — that shell still owns background/spacing/alignment
 * frame around the block tree.
 */
import { useMemo, type ReactElement } from "react";
import type { Block } from "@/lib/cms/types";
import { BLOCK_REGISTRY, type BlockKind } from "@/lib/cms/blocks/registry";
import { blockActions, useCMS } from "@/lib/cms/store";
import { usePreviewSectionId, usePreviewSync } from "../preview-sync";
import { InlineText } from "../InlineText";
import { PreviewSelectionToolbar } from "../PreviewSelectionToolbar";


const GAP_CLASS: Record<string, string> = {
  xs: "gap-1.5", sm: "gap-2", md: "gap-4", lg: "gap-6",
};
const ALIGN_FLEX: Record<string, string> = {
  start: "items-start", center: "items-center", end: "items-end", stretch: "items-stretch",
  left: "justify-start", right: "justify-end",
};
const PAD_CLASS: Record<string, string> = {
  none: "p-0", sm: "p-3", md: "p-5", lg: "p-8",
};
const MAXW_CLASS: Record<string, string> = {
  sm: "max-w-xl", md: "max-w-3xl", lg: "max-w-5xl", xl: "max-w-6xl", full: "max-w-none",
};

const str = (v: unknown, fb = "") => (v == null ? fb : String(v));
const bool = (v: unknown) => v === true || v === "true";
const intIn = (v: unknown, fb: number, min = 1, max = 6) => {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return fb;
  return Math.max(min, Math.min(max, n));
};

export function BlockTree({
  blocks,
  parentPath = [],
}: {
  blocks?: Block[];
  parentPath?: number[];
}) {
  if (!blocks || blocks.length === 0) return null;
  return (
    <>
      {blocks.map((b, i) => (
        <BlockRenderer key={b.id} block={b} path={[...parentPath, i]} />
      ))}
    </>
  );
}

export function BlockRenderer({ block, path }: { block: Block; path: number[] }) {
  const Comp = RENDERERS[block.kind] ?? FallbackBlock;
  const sync = usePreviewSync();
  const sectionId = usePreviewSectionId();
  const inner = <Comp block={block} path={path} />;
  if (!sync.active) return inner;

  const key = path.join(".");
  const isSelected = sync.selectedKey === key;
  const isHover = !isSelected && sync.hoverKey === key;
  const ring = isSelected
    ? "outline outline-2 outline-[color:var(--ring,theme(colors.primary.DEFAULT))] outline-offset-2"
    : isHover
      ? "outline outline-1 outline-[color:color-mix(in_srgb,var(--ring,theme(colors.primary.DEFAULT))_45%,transparent)] outline-offset-2"
      : "";
  const def = BLOCK_REGISTRY[block.kind];
  const label = def?.label ?? block.kind;
  return (
    <div
      data-preview-block-path={key}
      onMouseEnter={(e) => {
        e.stopPropagation();
        sync.setHover(key);
      }}
      onMouseLeave={(e) => {
        e.stopPropagation();
        sync.setHover(undefined);
      }}
      onClick={(e) => {
        e.stopPropagation();
        sync.select(key, "preview");
      }}
      className={`relative cursor-pointer rounded-[4px] transition-[outline-color] ${ring}`}
    >
      {isHover && !isSelected && (
        <div className="pointer-events-none absolute -top-[18px] left-0 z-10 inline-flex items-center gap-1 rounded-[4px] bg-foreground/90 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-background shadow-sm">
          {label}
        </div>
      )}
      {isSelected && sectionId && (
        <PreviewSelectionToolbar sectionId={sectionId} block={block} path={path} />
      )}
      {inner}
    </div>
  );
}


type R = (props: { block: Block; path: number[] }) => ReactElement | null;

// ----- Content -----

const Heading: R = ({ block, path }) => {
  const level = intIn(block.props.level, 2, 1, 6);
  const align = str(block.props.align, "left");
  const cls = `font-semibold tracking-tight ${
    level === 1 ? "text-4xl" : level === 2 ? "text-2xl" : level === 3 ? "text-xl" : level === 4 ? "text-lg" : "text-base"
  } ${align === "center" ? "text-center" : align === "right" ? "text-right" : ""}`;
  const text = str(block.props.text, "");
  const Tag = (`h${level}` as unknown) as keyof React.JSX.IntrinsicElements;
  const sync = usePreviewSync();
  const sectionId = usePreviewSectionId();
  const editable = sync.active && sync.selectedKey === path.join(".");
  return (
    <InlineText
      as={Tag as unknown as React.ElementType}
      value={text}
      placeholder="Heading"
      className={cls}
      editable={editable}
      onCommit={(next) => sectionId && blockActions.update(sectionId, path, { text: next })}
    />
  );
};

const Paragraph: R = ({ block, path }) => {
  const muted = bool(block.props.muted);
  const align = str(block.props.align, "left");
  const cls = `text-[14px] ${muted ? "text-muted-foreground" : "text-foreground"} ${
    align === "center" ? "text-center" : align === "right" ? "text-right" : ""
  }`;
  const sync = usePreviewSync();
  const sectionId = usePreviewSectionId();
  const editable = sync.active && sync.selectedKey === path.join(".");
  return (
    <InlineText
      as="p"
      value={str(block.props.text)}
      placeholder="Paragraph text"
      className={cls}
      editable={editable}
      multiline
      onCommit={(next) => sectionId && blockActions.update(sectionId, path, { text: next })}
    />
  );
};

const RichText: R = ({ block }) => {
  const html = str(block.props.html);
  if (!html) return <div className="text-[12px] italic text-muted-foreground">Empty rich text</div>;
  return <div className="bcms-prose text-[14px]" dangerouslySetInnerHTML={{ __html: html }} />;
};


const QuoteBlock: R = ({ block }) => (
  <blockquote className="rounded-[8px] border-l-4 border-primary/40 bg-surface px-4 py-3">
    <div className="text-[14px] italic text-foreground">“{str(block.props.text)}”</div>
    {block.props.cite ? (
      <div className="mt-1 text-[12px] text-muted-foreground">{str(block.props.cite)}</div>
    ) : null}
  </blockquote>
);

const ListBlock: R = ({ block }) => {
  const items = str(block.props.items).split("\n").map((s) => s.trim()).filter(Boolean);
  const Tag = bool(block.props.ordered) ? "ol" : "ul";
  return (
    <Tag className={`pl-5 text-[14px] ${Tag === "ol" ? "list-decimal" : "list-disc"} space-y-1`}>
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </Tag>
  );
};

const CodeBlock: R = ({ block }) => (
  <pre className="overflow-x-auto rounded-[8px] border border-border bg-foreground/95 px-3 py-2 text-[12px] text-background">
    <code>{str(block.props.code)}</code>
  </pre>
);

// ----- Media -----

const RATIO_CLASS: Record<string, string> = {
  "16/9": "aspect-video", "4/3": "aspect-[4/3]", "1/1": "aspect-square",
  "3/4": "aspect-[3/4]", "9/16": "aspect-[9/16]",
};

const ImageBlock: R = ({ block }) => {
  const src = str(block.props.src);
  const alt = str(block.props.alt);
  const caption = str(block.props.caption);
  const ratio = RATIO_CLASS[str(block.props.ratio, "16/9")] ?? RATIO_CLASS["16/9"];
  // Resolve media id → URL if applicable.
  const media = useCMS((s) => (src && src.startsWith("md_") ? s.media.find((m) => m.id === src) : undefined));
  const url = media?.url || src;
  return (
    <figure className="w-full">
      <div className={`overflow-hidden rounded-[8px] border border-border bg-surface ${ratio}`}>
        {url ? (
          <img src={url} alt={alt} loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full w-full place-items-center text-[11px] text-muted-foreground">No image</div>
        )}
      </div>
      {caption && <figcaption className="mt-1 text-[12px] text-muted-foreground">{caption}</figcaption>}
    </figure>
  );
};

const VideoBlock: R = ({ block }) => {
  const src = str(block.props.src);
  return (
    <div className="aspect-video overflow-hidden rounded-[8px] border border-border bg-foreground/90">
      {src ? (
        <video controls src={src} className="h-full w-full object-cover" />
      ) : (
        <div className="grid h-full place-items-center text-[12px] text-background">Video placeholder</div>
      )}
    </div>
  );
};

// ----- Action -----

const VARIANT_CLASS: Record<string, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary: "bg-foreground text-background hover:opacity-90",
  ghost: "bg-transparent text-foreground hover:bg-surface",
  outline: "border border-border bg-background text-foreground hover:border-border-strong",
};

const ButtonBlock: R = ({ block, path }) => {
  const variant = str(block.props.variant, "primary");
  const cls = VARIANT_CLASS[variant] ?? VARIANT_CLASS.primary;
  const sync = usePreviewSync();
  const sectionId = usePreviewSectionId();
  const editable = sync.active && sync.selectedKey === path.join(".");
  return (
    <a
      href={str(block.props.href, "#")}
      onClick={(e) => editable && e.preventDefault()}
      className={`inline-flex h-10 items-center rounded-[6px] px-4 text-[13px] font-medium transition-colors ${cls}`}
    >
      <InlineText
        as="span"
        value={str(block.props.label, "")}
        placeholder="Button"
        editable={editable}
        onCommit={(next) => sectionId && blockActions.update(sectionId, path, { label: next })}
      />
    </a>
  );
};


const CtaGroup: R = ({ block, path }) => {
  const align = str(block.props.align, "left");
  const justify = ALIGN_FLEX[align] ?? "justify-start";
  return (
    <div className={`flex flex-wrap gap-2 ${justify}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

// ----- Layout -----

const Container: R = ({ block, path }) => {
  const mw = MAXW_CLASS[str(block.props.maxWidth, "lg")] ?? MAXW_CLASS.lg;
  const pad = PAD_CLASS[str(block.props.padding, "md")] ?? PAD_CLASS.md;
  return (
    <div className={`mx-auto w-full ${mw} ${pad} flex flex-col gap-4`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

const ALIGN_ITEMS: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

const Stack: R = ({ block, path }) => {
  const gap = GAP_CLASS[str(block.props.gap, "md")] ?? GAP_CLASS.md;
  // Default to row — matches registry defaults and toolbar Direction toggle.
  const direction = str(block.props.direction, "row");
  const isRow = direction === "row";
  const wrap = block.props.wrap === undefined ? true : bool(block.props.wrap);
  if (isRow) {
    const align = ALIGN_ITEMS[str(block.props.align, "center")] ?? ALIGN_ITEMS.center;
    return (
      <div className={`flex w-full flex-row ${wrap ? "flex-wrap" : ""} ${gap} ${align}`}>
        <BlockTree blocks={block.children} parentPath={path} />
      </div>
    );
  }
  const align = ALIGN_FLEX[str(block.props.align, "stretch")] ?? ALIGN_FLEX.stretch;
  return (
    <div className={`flex w-full flex-col ${gap} ${align}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

const GRID_COLS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-3",
  4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  5: "grid-cols-1 md:grid-cols-3 lg:grid-cols-5",
  6: "grid-cols-2 md:grid-cols-3 lg:grid-cols-6",
};

const GridBlock: R = ({ block, path }) => {
  const cols = intIn(block.props.columns, 3, 1, 6);
  const gap = GAP_CLASS[str(block.props.gap, "md")] ?? GAP_CLASS.md;
  return (
    <div className={`grid w-full ${GRID_COLS[cols]} ${gap}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

const ColumnsBlock: R = ({ block, path }) => {
  const count = intIn(block.props.count, 2, 2, 4);
  const gap = GAP_CLASS[str(block.props.gap, "md")] ?? GAP_CLASS.md;
  return (
    <div className={`grid w-full ${GRID_COLS[count]} ${gap}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

const CardGroupBlock: R = ({ block, path }) => {
  const gap = GAP_CLASS[str(block.props.gap, "md")] ?? GAP_CLASS.md;
  return (
    <div className={`flex w-full flex-wrap ${gap}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </div>
  );
};

const CardBlock: R = ({ block, path }) => {
  const padded = bool(block.props.padded ?? true);
  return (
    <div className={`flex flex-1 flex-col gap-2 rounded-[8px] border border-border bg-white ${padded ? "p-5" : ""}`}>
      {block.props.title ? (
        <div className="text-[14px] font-semibold text-foreground">{str(block.props.title)}</div>
      ) : null}
      {block.props.body ? (
        <div className="text-[13px] text-muted-foreground">{str(block.props.body)}</div>
      ) : null}
      {block.children && block.children.length > 0 && (
        <div className="mt-2 flex flex-col gap-2">
          <BlockTree blocks={block.children} parentPath={path} />
        </div>
      )}
    </div>
  );
};

// ----- Interactive (visual-only this phase) -----

const Accordion: R = ({ block }) => {
  const items = useMemo(
    () => str(block.props.items).split("\n").map((l) => {
      const [q, ...rest] = l.split("|");
      return { q: q?.trim() ?? "", a: rest.join("|").trim() };
    }).filter((x) => x.q),
    [block.props.items],
  );
  return (
    <div className="w-full divide-y divide-border rounded-[8px] border border-border bg-white">
      {items.map((it, i) => (
        <details key={i} className="px-4 py-3 text-[13px]">
          <summary className="cursor-pointer font-medium">{it.q}</summary>
          <div className="mt-1 text-muted-foreground">{it.a}</div>
        </details>
      ))}
    </div>
  );
};

const Tabs: R = ({ block }) => {
  const labels = str(block.props.labels, "Tab 1, Tab 2").split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <div className="w-full rounded-[8px] border border-border bg-white">
      <div className="flex border-b border-border">
        {labels.map((l, i) => (
          <div
            key={l + i}
            className={`px-3 py-2 text-[12px] ${i === 0 ? "border-b-2 border-primary font-medium text-foreground" : "text-muted-foreground"}`}
          >{l}</div>
        ))}
      </div>
      <div className="px-4 py-3 text-[13px] text-muted-foreground">{str(block.props.body, "Tab content placeholder.")}</div>
    </div>
  );
};

// ----- Advanced -----

const EmbedBlock: R = ({ block }) => {
  const url = str(block.props.url);
  if (!url) return <PlaceholderBlock label="Embed" />;
  return <iframe src={url} className="aspect-video w-full rounded-[8px] border border-border" title="embed" />;
};

const HtmlBlock: R = ({ block }) => (
  <div className="rounded-[8px] border border-dashed border-border bg-surface p-3">
    <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Raw HTML</div>
    <div dangerouslySetInnerHTML={{ __html: str(block.props.html) }} />
  </div>
);

const PlaceholderBlock = ({ label }: { label: string }) => (
  <div className="grid h-24 place-items-center rounded-[8px] border border-dashed border-border bg-surface text-[12px] text-muted-foreground">
    {label} placeholder
  </div>
);

const FallbackBlock: R = ({ block }) => <PlaceholderBlock label={block.kind} />;

// ----- Site chrome (Phase 2 migration) -----

const JUSTIFY_CLASS: Record<string, string> = {
  between: "justify-between",
  start: "justify-start",
  end: "justify-end",
};

const NavBar: R = ({ block, path }) => {
  const sticky = bool(block.props.sticky);
  const children = block.children ?? [];
  // Three-slot top nav: logo (left), links (center, flexes), actions (right).
  // Falls back to a plain flex row if there are not exactly three children
  // so user-added/removed blocks still render reasonably.
  const useTriColumn = children.length === 3;
  return (
    <header
      className={`w-full border-b border-border bg-white/90 px-6 py-3 backdrop-blur ${
        sticky ? "sticky top-0 z-30" : ""
      }`}
    >
      <div
        className={
          useTriColumn
            ? "mx-auto flex w-full max-w-[1400px] items-center gap-6 [&>*:nth-child(1)]:justify-self-start [&>*:nth-child(2)]:flex [&>*:nth-child(2)]:min-w-0 [&>*:nth-child(2)]:flex-1 [&>*:nth-child(2)]:justify-center [&>*:nth-child(3)]:ml-auto [&>*:nth-child(3)]:justify-self-end"
            : "mx-auto flex w-full max-w-[1400px] flex-wrap items-center justify-between gap-4"
        }
      >
        <BlockTree blocks={children} parentPath={path} />
      </div>
    </header>
  );
};

const FooterBar: R = ({ block, path }) => {
  const justify = JUSTIFY_CLASS[str(block.props.justify, "between")] ?? JUSTIFY_CLASS.between;
  return (
    <footer className={`flex w-full flex-wrap items-center gap-4 border-t border-border bg-surface px-6 py-8 text-[12px] text-muted-foreground ${justify}`}>
      <BlockTree blocks={block.children} parentPath={path} />
    </footer>
  );
};

const LOGO_HEIGHT: Record<string, string> = {
  sm: "h-5",
  md: "h-7",
  lg: "h-10",
};

const NavLogo: R = ({ block, path }) => {
  const sync = usePreviewSync();
  const sectionId = usePreviewSectionId();
  const editable = sync.active && sync.selectedKey === path.join(".");
  const lightSrc = str(block.props.lightSrc, "");
  const darkSrc = str(block.props.darkSrc, "");
  const alt = str(block.props.imageAlt, str(block.props.text, "Logo"));
  const heightCls = LOGO_HEIGHT[str(block.props.height, "md")] ?? LOGO_HEIGHT.md;

  if (lightSrc || darkSrc) {
    const light = lightSrc || darkSrc;
    const dark = darkSrc || lightSrc;
    return (
      <div className="flex shrink-0 items-center">
        <img
          src={light}
          alt={alt}
          className={`${heightCls} w-auto object-contain dark:hidden`}
          draggable={false}
        />
        <img
          src={dark}
          alt={alt}
          className={`hidden ${heightCls} w-auto object-contain dark:block`}
          draggable={false}
        />
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-2 whitespace-nowrap text-[14px] font-semibold tracking-tight">
      {bool(block.props.mark ?? true) && (
        <span className="inline-block h-5 w-5 shrink-0 rounded-[5px] bg-gradient-to-br from-primary to-primary/50" />
      )}
      <InlineText
        as="span"
        value={str(block.props.text, "")}
        placeholder="Brand"
        editable={editable}
        onCommit={(next) => sectionId && blockActions.update(sectionId, path, { text: next })}
      />
    </div>
  );
};

const NavLinks: R = ({ block }) => {
  const items = str(block.props.items)
    .split("\n")
    .map((line) => {
      const [label, href] = line.split("|").map((s) => s.trim());
      return label ? { label, href: href || "#" } : null;
    })
    .filter(Boolean) as Array<{ label: string; href: string }>;
  if (items.length === 0) {
    return <span className="text-[12px] italic text-muted-foreground/60">No links</span>;
  }
  return (
    <nav className="flex min-w-0 flex-wrap items-center gap-5 text-[13px] text-muted-foreground">
      {items.map((l, i) => (
        <a
          key={l.label + i}
          href={l.href}
          onClick={(e) => e.preventDefault()}
          className="whitespace-nowrap transition-colors hover:text-foreground"
        >
          {l.label}
        </a>
      ))}
    </nav>
  );
};

const NavSearch: R = ({ block }) => (
  <button
    type="button"
    onClick={(e) => e.preventDefault()}
    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] border border-border bg-surface px-2 text-[12px] text-muted-foreground hover:border-border-strong"
  >
    <span>{str(block.props.placeholder, "Search…")}</span>
    {block.props.shortcut ? (
      <kbd className="ml-2 rounded bg-muted px-1 text-[10px]">{str(block.props.shortcut)}</kbd>
    ) : null}
  </button>
);

const RENDERERS: Record<BlockKind, R> = {
  heading: Heading, paragraph: Paragraph, richText: RichText, quote: QuoteBlock,
  list: ListBlock, code: CodeBlock,
  image: ImageBlock, video: VideoBlock,
  button: ButtonBlock, "cta-group": CtaGroup,
  container: Container, stack: Stack, grid: GridBlock, columns: ColumnsBlock,
  "card-group": CardGroupBlock, card: CardBlock,
  accordion: Accordion, tabs: Tabs,
  embed: EmbedBlock, html: HtmlBlock,
  "nav-bar": NavBar, "nav-logo": NavLogo, "nav-links": NavLinks,
  "nav-search": NavSearch, "footer-bar": FooterBar,
};

