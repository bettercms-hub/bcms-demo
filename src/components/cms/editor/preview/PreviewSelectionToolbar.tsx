/**
 * Floating context toolbar anchored above the selected block in the preview.
 *
 * Layout (left → right):
 *   [kind label] | [kind-specific quick actions] | [Ask AI] | [common: dup, del, ↑, ↓]
 *
 * Kind-specific actions are deliberately small — anything richer belongs in
 * the right-side Properties panel. The goal is one-click for the 1–2 things
 * users tweak most often per kind.
 */
import { useState } from "react";
import {
  Sparkles,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowDownUp,
  ArrowLeftRight,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link as LinkIcon,
  Image as ImageIcon,
  Ratio,
  Rows3,
  Columns3,
  ChevronsLeftRightEllipsis,
  Upload,
  Plus,
  X,
  GripVertical,
  ListOrdered,
} from "lucide-react";

import { useCMS, blockActions } from "@/lib/cms/store";
import type { Block } from "@/lib/cms/types";
import { AskAIPanel } from "@/components/cms/editor/ai/AskAIPanel";
import { getAiTextField } from "@/lib/cms/ai/preset-actions";
import { BLOCK_REGISTRY } from "@/lib/cms/blocks/registry";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Props {
  sectionId: string;
  block: Block;
  path: number[];
}

const str = (v: unknown, fb = "") => (v == null ? fb : String(v));

export function PreviewSelectionToolbar({ sectionId, block, path }: Props) {
  const section = useCMS((s) => s.sections.find((x) => x.id === sectionId));
  const [aiOpen, setAiOpen] = useState(false);
  const hasText = Boolean(getAiTextField(block.kind));
  const label = BLOCK_REGISTRY[block.kind]?.label ?? block.kind;

  if (!section) return null;

  return (
    <div
      className="pointer-events-auto absolute -top-[30px] left-0 z-20 inline-flex h-[26px] items-center gap-0.5 rounded-[6px] border border-border bg-background/95 px-1 shadow-md backdrop-blur"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <span className="px-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>

      <KindActions sectionId={sectionId} block={block} path={path} />

      {hasText && (
        <>
          <Divider />
          <AskAIPanel
            section={section}
            block={block}
            path={path}
            open={aiOpen}
            onOpenChange={setAiOpen}
          >
            <button
              type="button"
              className="inline-flex h-[20px] items-center gap-1 rounded-[4px] px-1.5 text-[11px] font-medium text-foreground hover:bg-muted"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              Ask AI
            </button>
          </AskAIPanel>
        </>
      )}

      <Divider />
      <CommonActions sectionId={sectionId} path={path} />
    </div>
  );
}

// ---------- shared bits ----------

function Divider() {
  return <span className="mx-0.5 h-3 w-px bg-border" />;
}

function IconBtn({
  icon: Icon,
  label,
  onClick,
  active,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={`inline-flex h-[20px] w-[22px] items-center justify-center rounded-[4px] text-foreground hover:bg-muted ${
        active ? "bg-muted" : ""
      }`}
    >
      <Icon className="h-3 w-3" />
    </button>
  );
}

// ---------- common actions ----------

function CommonActions({ sectionId, path }: { sectionId: string; path: number[] }) {
  return (
    <>
      <IconBtn
        icon={Copy}
        label="Duplicate"
        onClick={() => blockActions.duplicate(sectionId, path)}
      />
      <IconBtn
        icon={ArrowUp}
        label="Move up"
        onClick={() => blockActions.move(sectionId, path, -1)}
      />
      <IconBtn
        icon={ArrowDown}
        label="Move down"
        onClick={() => blockActions.move(sectionId, path, 1)}
      />
      <IconBtn
        icon={Trash2}
        label="Delete"
        onClick={() => blockActions.remove(sectionId, path)}
      />
    </>
  );
}

// ---------- per-kind actions ----------

function KindActions({
  sectionId,
  block,
  path,
}: {
  sectionId: string;
  block: Block;
  path: number[];
}) {
  const update = (patch: Record<string, unknown>) =>
    blockActions.update(sectionId, path, patch);

  switch (block.kind) {
    case "heading":
      return (
        <>
          <Divider />
          <HeadingActions block={block} update={update} />
        </>
      );
    case "paragraph":
      return (
        <>
          <Divider />
          <AlignActions block={block} update={update} />
        </>
      );
    case "button":
      return (
        <>
          <Divider />
          <ButtonActions block={block} update={update} />
        </>
      );
    case "image":
      return (
        <>
          <Divider />
          <ImageActions block={block} update={update} />
        </>
      );
    case "stack":
      return (
        <>
          <Divider />
          <StackActions block={block} update={update} />
        </>
      );
    case "container":
    case "nav-bar":
    case "footer-bar":
    case "cta-group":
      return (
        <>
          <Divider />
          <ContainerActions block={block} update={update} />
        </>
      );
    case "nav-logo":
      return (
        <>
          <Divider />
          <NavLogoActions block={block} update={update} />
        </>
      );
    case "nav-links":
      return (
        <>
          <Divider />
          <NavLinksActions block={block} update={update} />
        </>
      );
    case "columns":
    case "grid":
      return (
        <>
          <Divider />
          <ColumnsActions block={block} update={update} />
        </>
      );
    default:
      return null;
  }
}

// ----- heading -----

function HeadingActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const level = Number(block.props.level ?? 2);
  return (
    <>
      <IconBtn icon={Heading1} label="H1" active={level === 1} onClick={() => update({ level: 1 })} />
      <IconBtn icon={Heading2} label="H2" active={level === 2} onClick={() => update({ level: 2 })} />
      <IconBtn icon={Heading3} label="H3" active={level === 3} onClick={() => update({ level: 3 })} />
      <Divider />
      <AlignActions block={block} update={update} />
    </>
  );
}

// ----- align (paragraph / heading) -----

function AlignActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const align = str(block.props.align, "left");
  return (
    <>
      <IconBtn icon={AlignLeft} label="Align left" active={align === "left"} onClick={() => update({ align: "left" })} />
      <IconBtn icon={AlignCenter} label="Align center" active={align === "center"} onClick={() => update({ align: "center" })} />
      <IconBtn icon={AlignRight} label="Align right" active={align === "right"} onClick={() => update({ align: "right" })} />
    </>
  );
}

// ----- button -----

const BUTTON_VARIANTS = ["primary", "secondary", "outline", "ghost"] as const;

function ButtonActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const variant = str(block.props.variant, "primary");
  const href = str(block.props.href, "");
  const [draftHref, setDraftHref] = useState(href);
  const [open, setOpen] = useState(false);
  return (
    <>
      {BUTTON_VARIANTS.map((v) => (
        <button
          key={v}
          type="button"
          title={`Variant: ${v}`}
          onClick={() => update({ variant: v })}
          className={`inline-flex h-[20px] items-center rounded-[4px] px-1.5 text-[10px] capitalize ${
            variant === v ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {v}
        </button>
      ))}
      <Divider />
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) setDraftHref(href);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Link"
            aria-label="Link"
            className={`inline-flex h-[20px] w-[22px] items-center justify-center rounded-[4px] text-foreground hover:bg-muted ${
              href ? "text-primary" : ""
            }`}
          >
            <LinkIcon className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start" sideOffset={6}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Link URL
          </div>
          <input
            autoFocus
            value={draftHref}
            onChange={(e) => setDraftHref(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ href: draftHref });
                setOpen(false);
              }
              if (e.key === "Escape") setOpen(false);
            }}
            placeholder="https://…"
            className="h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end gap-1">
            <button
              type="button"
              onClick={() => {
                update({ href: "" });
                setDraftHref("");
                setOpen(false);
              }}
              className="rounded-[4px] px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                update({ href: draftHref });
                setOpen(false);
              }}
              className="rounded-[4px] bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  );
}

// ----- image -----

const RATIO_CYCLE = ["16/9", "4/3", "1/1", "3/4", "9/16"] as const;

function ImageActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const ratio = str(block.props.ratio, "16/9");
  const alt = str(block.props.alt, "");
  const src = str(block.props.src, "");
  const [draftAlt, setDraftAlt] = useState(alt);
  const [draftSrc, setDraftSrc] = useState(src);
  const [altOpen, setAltOpen] = useState(false);
  const [srcOpen, setSrcOpen] = useState(false);

  const cycleRatio = () => {
    const idx = RATIO_CYCLE.indexOf(ratio as (typeof RATIO_CYCLE)[number]);
    const next = RATIO_CYCLE[(idx + 1) % RATIO_CYCLE.length];
    update({ ratio: next });
  };

  return (
    <>
      <Popover
        open={srcOpen}
        onOpenChange={(o) => {
          setSrcOpen(o);
          if (o) setDraftSrc(src);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Replace image"
            aria-label="Replace"
            className="inline-flex h-[20px] w-[22px] items-center justify-center rounded-[4px] hover:bg-muted"
          >
            <ImageIcon className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start" sideOffset={6}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Image URL or Media ID
          </div>
          <input
            autoFocus
            value={draftSrc}
            onChange={(e) => setDraftSrc(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ src: draftSrc });
                setSrcOpen(false);
              }
              if (e.key === "Escape") setSrcOpen(false);
            }}
            placeholder="https://… or md_…"
            className="h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                update({ src: draftSrc });
                setSrcOpen(false);
              }}
              className="rounded-[4px] bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <Popover
        open={altOpen}
        onOpenChange={(o) => {
          setAltOpen(o);
          if (o) setDraftAlt(alt);
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Alt text"
            className={`inline-flex h-[20px] items-center rounded-[4px] px-1.5 text-[10px] hover:bg-muted ${
              alt ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            Alt
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[280px] p-2" align="start" sideOffset={6}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alt text (a11y)
          </div>
          <input
            autoFocus
            value={draftAlt}
            onChange={(e) => setDraftAlt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                update({ alt: draftAlt });
                setAltOpen(false);
              }
              if (e.key === "Escape") setAltOpen(false);
            }}
            placeholder="Describe the image…"
            className="h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => {
                update({ alt: draftAlt });
                setAltOpen(false);
              }}
              className="rounded-[4px] bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>

      <IconBtn
        icon={Ratio}
        label={`Ratio: ${ratio} (click to cycle)`}
        onClick={cycleRatio}
      />
    </>
  );
}

// ----- containers -----

function ContainerActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const gap = str(block.props.gap, "md");
  const gaps = ["xs", "sm", "md", "lg"] as const;
  return (
    <>
      {gaps.map((g) => (
        <button
          key={g}
          type="button"
          title={`Gap: ${g}`}
          onClick={() => update({ gap: g })}
          className={`inline-flex h-[20px] items-center rounded-[4px] px-1.5 text-[10px] uppercase ${
            gap === g ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {g}
        </button>
      ))}
    </>
  );
}

// ----- columns / grid -----

function ColumnsActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const key = block.kind === "columns" ? "count" : "columns";
  const current = Number(block.props[key] ?? (block.kind === "columns" ? 2 : 3));
  const options = block.kind === "columns" ? [2, 3, 4] : [1, 2, 3, 4, 6];
  return (
    <>
      <IconBtn
        icon={block.kind === "columns" ? Columns3 : ChevronsLeftRightEllipsis}
        label="Columns"
        onClick={() => {
          const idx = options.indexOf(current);
          const next = options[(idx + 1) % options.length];
          update({ [key]: next });
        }}
      />
      <span className="px-1 text-[10px] tabular-nums text-muted-foreground">{current}</span>
      <Divider />
      <IconBtn
        icon={Rows3}
        label="Toggle gap"
        onClick={() => {
          const order = ["xs", "sm", "md", "lg"] as const;
          const cur = str(block.props.gap, "md") as (typeof order)[number];
          const idx = order.indexOf(cur);
          update({ gap: order[(idx + 1) % order.length] });
        }}
      />
    </>
  );
}

// ----- stack (row/col + gap) -----

function StackActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const direction = str(block.props.direction, "row");
  return (
    <>
      <IconBtn
        icon={ArrowLeftRight}
        label="Horizontal"
        active={direction === "row"}
        onClick={() => update({ direction: "row" })}
      />
      <IconBtn
        icon={ArrowDownUp}
        label="Vertical"
        active={direction === "column"}
        onClick={() => update({ direction: "column" })}
      />
      <Divider />
      <ContainerActions block={block} update={update} />
    </>
  );
}

// ----- nav-logo (upload light + dark) -----

function NavLogoActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const light = str(block.props.lightSrc, "");
  const dark = str(block.props.darkSrc, "");
  const alt = str(block.props.imageAlt, "");
  const [draftLight, setDraftLight] = useState(light);
  const [draftDark, setDraftDark] = useState(dark);
  const [draftAlt, setDraftAlt] = useState(alt);
  const [open, setOpen] = useState(false);
  const height = str(block.props.height, "md");
  const heights = ["sm", "md", "lg"] as const;

  return (
    <>
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (o) {
            setDraftLight(light);
            setDraftDark(dark);
            setDraftAlt(alt);
          }
        }}
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            title="Upload logo"
            className={`inline-flex h-[20px] items-center gap-1 rounded-[4px] px-1.5 text-[10px] hover:bg-muted ${
              light || dark ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            <Upload className="h-3 w-3" />
            Logo
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-2" align="start" sideOffset={6}>
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Light-mode logo (URL or Media ID)
          </div>
          <input
            autoFocus
            value={draftLight}
            onChange={(e) => setDraftLight(e.target.value)}
            placeholder="https://… or md_…"
            className="mb-2 h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Dark-mode logo (optional)
          </div>
          <input
            value={draftDark}
            onChange={(e) => setDraftDark(e.target.value)}
            placeholder="https://… or md_…"
            className="mb-2 h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Alt text
          </div>
          <input
            value={draftAlt}
            onChange={(e) => setDraftAlt(e.target.value)}
            placeholder="Describe the logo…"
            className="h-8 w-full rounded-[4px] border border-border bg-background px-2 text-[12px] outline-none focus:border-primary"
          />
          <div className="mt-2 flex justify-between gap-1">
            <button
              type="button"
              onClick={() => {
                update({ lightSrc: "", darkSrc: "", imageAlt: "" });
                setDraftLight("");
                setDraftDark("");
                setDraftAlt("");
                setOpen(false);
              }}
              className="rounded-[4px] px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                update({ lightSrc: draftLight, darkSrc: draftDark, imageAlt: draftAlt });
                setOpen(false);
              }}
              className="rounded-[4px] bg-primary px-2 py-1 text-[11px] text-primary-foreground hover:opacity-90"
            >
              Apply
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <Divider />
      {heights.map((h) => (
        <button
          key={h}
          type="button"
          title={`Size: ${h}`}
          onClick={() => update({ height: h })}
          className={`inline-flex h-[20px] items-center rounded-[4px] px-1.5 text-[10px] uppercase ${
            height === h ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:bg-muted/60"
          }`}
        >
          {h}
        </button>
      ))}
    </>
  );
}

// ----- nav-links (edit label/url/order) -----

type NavLink = { label: string; href: string };

function parseLinks(raw: string): NavLink[] {
  return raw
    .split("\n")
    .map((line) => {
      const [label = "", href = ""] = line.split("|").map((s) => s.trim());
      return label || href ? { label, href: href || "#" } : null;
    })
    .filter(Boolean) as NavLink[];
}

function serializeLinks(links: NavLink[]): string {
  return links.map((l) => `${l.label}|${l.href}`).join("\n");
}

function NavLinksActions({
  block,
  update,
}: {
  block: Block;
  update: (p: Record<string, unknown>) => void;
}) {
  const initial = parseLinks(str(block.props.items, ""));
  const [open, setOpen] = useState(false);
  const [links, setLinks] = useState<NavLink[]>(initial);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const sync = (next: NavLink[]) => {
    setLinks(next);
    update({ items: serializeLinks(next) });
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setLinks(parseLinks(str(block.props.items, "")));
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          title="Edit nav links"
          className="inline-flex h-[20px] items-center gap-1 rounded-[4px] px-1.5 text-[10px] text-foreground hover:bg-muted"
        >
          <ListOrdered className="h-3 w-3" />
          Links
          <span className="text-muted-foreground">({initial.length})</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[360px] p-2" align="start" sideOffset={6}>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Navigation links
          </span>
          <button
            type="button"
            onClick={() => sync([...links, { label: "New link", href: "/" }])}
            className="inline-flex items-center gap-1 rounded-[4px] px-1.5 py-0.5 text-[11px] text-primary hover:bg-muted"
          >
            <Plus className="h-3 w-3" />
            Add
          </button>
        </div>
        <div className="flex flex-col gap-1">
          {links.length === 0 && (
            <div className="rounded-[4px] border border-dashed border-border px-2 py-3 text-center text-[11px] text-muted-foreground">
              No links yet — click Add.
            </div>
          )}
          {links.map((link, i) => (
            <div
              key={i}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => {
                if (dragIdx === null || dragIdx === i) return;
                const next = [...links];
                const [moved] = next.splice(dragIdx, 1);
                next.splice(i, 0, moved);
                setDragIdx(null);
                sync(next);
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-1 rounded-[4px] border border-transparent bg-muted/30 px-1 py-1 hover:border-border ${
                dragIdx === i ? "opacity-50" : ""
              }`}
            >
              <GripVertical className="h-3 w-3 shrink-0 cursor-grab text-muted-foreground" />
              <input
                value={link.label}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], label: e.target.value };
                  sync(next);
                }}
                placeholder="Label"
                className="h-7 min-w-0 flex-1 rounded-[3px] border border-border bg-background px-1.5 text-[12px] outline-none focus:border-primary"
              />
              <input
                value={link.href}
                onChange={(e) => {
                  const next = [...links];
                  next[i] = { ...next[i], href: e.target.value };
                  sync(next);
                }}
                placeholder="/path"
                className="h-7 w-[110px] rounded-[3px] border border-border bg-background px-1.5 text-[12px] outline-none focus:border-primary"
              />
              <button
                type="button"
                title="Remove"
                onClick={() => sync(links.filter((_, j) => j !== i))}
                className="inline-flex h-6 w-6 items-center justify-center rounded-[3px] text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-muted-foreground">
          Drag the handle to reorder. Changes save instantly.
        </p>
      </PopoverContent>
    </Popover>
  );
}
