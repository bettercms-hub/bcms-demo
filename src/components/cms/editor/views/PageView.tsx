import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  GripVertical,
  LayoutTemplate,
  Link2,
  Link2Off,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import type { Page } from "@/lib/cms/types";
import { BoundSectionPreview } from "../preview/BoundSectionPreview";
import { SectionPreview } from "../preview/sections";
import { PreviewSyncProvider } from "../preview/preview-sync";
import { BlockToolbar } from "../document/BlockToolbar";
import { BlockDetailsSheet } from "../document/BlockDetailsSheet";
import { SECTION_ICON } from "@/lib/cms/icons";
import { LayoutTab } from "../section-tabs/LayoutTab";
import { StyleTab } from "../section-tabs/StyleTab";
import { SeoTab } from "../section-tabs/SeoTab";
import { AdvancedTab } from "../section-tabs/AdvancedTab";



import { blockActions, pageActions, sectionActions, useCMS } from "@/lib/cms/store";
import type { Block, ComponentMaster, Section, SectionKind, SchemaField } from "@/lib/cms/types";

import { BLOCK_REGISTRY, isContainer, type BlockGroup } from "@/lib/cms/blocks/registry";
import type { BlockPath } from "@/lib/cms/blocks/operations";
import { pathKey } from "@/lib/cms/blocks/operations";
import { blockSummary } from "@/lib/cms/blocks/summary";
import { recordRecentSection } from "@/lib/cms/blocks/recent";
import { useEditorDensity } from "@/lib/cms/use-editor-density";
import { FieldControl } from "../fields/FieldControl";
import { InlineEditable } from "../InlineEditable";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openBlockLibrary } from "../center/BlockLibraryWorkspace";
import { openTemplatePicker } from "../center/TemplatePickerWorkspace";
import { InsertPopover } from "../insert/InsertPopover";
import { SlashMenu } from "../insert/SlashMenu";
import { PreviewSlashMenu } from "../preview/PreviewSlashMenu";
import { BlockDndProvider } from "../dnd/BlockDndProvider";
import { SectionDndProvider } from "../dnd/SectionDndProvider";
import { DragHandle, DropZone } from "../dnd/dnd-widgets";
import {
  idForBlock,
  idForBlockSlot,
  idForSection,
  idForSectionSlot,
} from "../dnd/dragDataTypes";
import { formatRelative } from "@/lib/cms/format-time";
import { editorBus } from "@/lib/cms/editor-bus";

// ---------- Section meta ----------

const SECTION_KINDS: SectionKind[] = [
  "hero",
  "features",
  "pricing",
  "testimonials",
  "logos",
  "cta",
  "faq",
  "content",
  "footer",
];

const SECTION_LABEL: Record<SectionKind, string> = {
  hero: "Hero",
  features: "Features",
  pricing: "Pricing",
  testimonials: "Testimonials",
  logos: "Logos",
  cta: "Call to action",
  faq: "FAQ",
  content: "Content",
  header: "Header",
  footer: "Footer",
  navigation: "Navigation",
  workflow: "Workflow",
  integrations: "Integrations",
  stats: "Stats",
  blog: "Blog",
  docs: "Docs",
  contact: "Contact",
};




const TEMPLATEABLE: SectionKind[] = ["hero", "features", "pricing", "faq"];

// Category → CSS variable
const GROUP_ACCENT: Record<BlockGroup, string> = {
  Content: "var(--accent-content)",
  Media: "var(--accent-media)",
  Layout: "var(--accent-layout)",
  Interactive: "var(--accent-interactive)",
  Action: "var(--accent-action)",
  Advanced: "var(--accent-advanced)",
};

// ---------- Page ----------

interface Props {
  pageId: string;
  onSelectNode?: (id: string) => void;
  selectedSectionId?: string;
  selectedBlockPathKey?: string;
  focusedSectionId?: string;
  onFocusSection?: (sectionId: string | undefined) => void;
  onExitSectionFocus?: () => void;
}

export function PageView({
  pageId,
  onSelectNode,
  selectedSectionId,
  selectedBlockPathKey,
  focusedSectionId,
  onFocusSection,
  onExitSectionFocus,
}: Props) {
  const { density } = useEditorDensity();
  const page = useCMS((s) => s.pages.find((p) => p.id === pageId));
  const sections = useCMS(
    (s) =>
      (page
        ? (page.sectionIds
            .map((id) => s.sections.find((x) => x.id === id))
            .filter(Boolean) as Section[])
        : []) as Section[],
  );

  // Density drives default expansion; selection still wins per session.
  const initialExpanded =
    density === "compact"
      ? null
      : selectedSectionId?.startsWith("section:")
        ? selectedSectionId.slice("section:".length)
        : sections[0]?.id ?? null;
  const [expandedSectionId, setExpandedSectionId] = useState<string | null>(initialExpanded);

  // Track the active block per section (path key string).
  const [expandedBlockBySection, setExpandedBlockBySection] = useState<Record<string, string | undefined>>({});

  // When external selection changes, auto-expand the corresponding section + block.
  useEffect(() => {
    if (!selectedSectionId) return;
    const sid = selectedSectionId.startsWith("section:")
      ? selectedSectionId.slice("section:".length)
      : null;
    if (sid) {
      setExpandedSectionId(sid);
      if (selectedBlockPathKey) {
        setExpandedBlockBySection((m) => ({ ...m, [sid]: selectedBlockPathKey }));
      }
    }
  }, [selectedSectionId, selectedBlockPathKey]);

  // Aggregate stats + meta for the page header strip (must run before any
  // conditional returns to keep hook order stable).
  const totalBlocks = useMemo(
    () => sections.reduce((n, s) => n + countBlocks(s.blocks ?? []), 0),
    [sections],
  );

  if (!page) return null;

  // ----- Focused Section Workspace -----
  // When `?section=<id>` is set, render only that section in a tabbed
  // workspace. This replaces the old deep-accordion editing surface.
  const focused = focusedSectionId
    ? sections.find((s) => s.id === focusedSectionId)
    : undefined;
  if (focused) {
    return (
      <SectionWorkspace
        page={page}
        section={focused}
        sections={sections}
        onUnfocus={onExitSectionFocus ?? (() => onFocusSection?.(undefined))}
        onSwitchSection={(id: string) => onFocusSection?.(id)}
        onSelectBlock={(pathK: string) =>
          onSelectNode?.(
            pathK ? `block:${focused.id}:${pathK}` : `section:${focused.id}`,
          )
        }
        selectedBlockPathKey={selectedBlockPathKey}
        expandedBlockKey={expandedBlockBySection[focused.id]}
        onExpandBlock={(key: string | undefined) =>
          setExpandedBlockBySection((m) => ({ ...m, [focused.id]: key }))
        }
      />
    );
  }

  // ----- Section Index (clean nav cards) -----
  const status = page.publishState ?? "draft";
  const lastEdited =
    page.lastPublishedAt ?? page.publishedAt ?? page.scheduledAt ?? undefined;

  return (
    <div className="mx-auto max-w-3xl px-8 py-10">
      {/* Page header */}
      <div className="mb-10">
        <div className="mb-2 flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
          <span>Home</span>
          <span aria-hidden className="opacity-50">›</span>
          <span className="truncate text-foreground/80">{page.title || "Untitled"}</span>
        </div>
        <InlineEditable
          size="xl"
          value={page.title}
          onChange={(v) => pageActions.update(page.id, { title: v })}
          placeholder="Untitled page"
          containerClassName="-ml-2"
        />
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-muted-foreground">
          <span className="capitalize text-foreground/70">{status}</span>
          <span className="opacity-40">·</span>
          <span>
            {sections.length} section{sections.length === 1 ? "" : "s"}
          </span>
          <span className="opacity-40">·</span>
          <span>
            {totalBlocks} block{totalBlocks === 1 ? "" : "s"}
          </span>
          {lastEdited && (
            <>
              <span className="opacity-40">·</span>
              <span title={new Date(lastEdited).toLocaleString()}>
                Updated {formatRelative(lastEdited)}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Section navigation cards */}
      <SectionDndProvider>
        <SectionInsertSlot pageId={page.id} index={0} />
        <div className="flex flex-col gap-2">
          {sections.map((s, i) => (
            <div key={s.id}>
              <SectionNavCard
                section={s}
                pageId={page.id}
                index={i}
                isFirst={i === 0}
                isLast={i === sections.length - 1}
                selected={selectedSectionId === `section:${s.id}`}
                onOpen={() => {
                  onSelectNode?.(`section:${s.id}`);
                  onFocusSection?.(s.id);
                }}
              />
              <SectionInsertSlot pageId={page.id} index={i + 1} />
            </div>
          ))}
          {sections.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-border bg-surface/50 px-6 py-10 text-center">
              <div className="text-[13px] font-medium text-foreground">No sections yet</div>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Add your first section using the “+ Add section” control above.
              </p>
            </div>
          )}
        </div>
      </SectionDndProvider>
    </div>
  );
}




// Per-section wrapper that stabilizes callbacks so SectionCard (memoized)
// only re-renders when this section's own inputs change.
const SectionCardSlot = memo(function SectionCardSlot({
  section,
  pageId,
  index,
  isFirst,
  isLast,
  density,
  expandedSectionId,
  setExpandedSectionId,
  selectedSectionId,
  selectedBlockPathKey,
  onSelectNode,
  expandedBlockKey,
  setExpandedBlockBySection,
}: {
  section: Section;
  pageId: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  density: "compact" | "comfortable" | "expanded";
  expandedSectionId: string | null;
  setExpandedSectionId: React.Dispatch<React.SetStateAction<string | null>>;
  selectedSectionId?: string;
  selectedBlockPathKey?: string;
  onSelectNode?: (id: string) => void;
  expandedBlockKey?: string;
  setExpandedBlockBySection: React.Dispatch<
    React.SetStateAction<Record<string, string | undefined>>
  >;
}) {
  const sid = section.id;
  const isExpanded =
    density === "expanded" ? true : expandedSectionId === sid;

  const onToggleExpand = useCallback(
    () => setExpandedSectionId((cur) => (cur === sid ? null : sid)),
    [sid, setExpandedSectionId],
  );
  const onSelect = useCallback(
    () => onSelectNode?.(`section:${sid}`),
    [sid, onSelectNode],
  );
  const onSelectBlock = useCallback(
    (pathK: string) => onSelectNode?.(`block:${sid}:${pathK}`),
    [sid, onSelectNode],
  );
  const onExpandBlock = useCallback(
    (key: string | undefined) =>
      setExpandedBlockBySection((m) => ({ ...m, [sid]: key })),
    [sid, setExpandedBlockBySection],
  );

  return (
    <div>
      <SectionCard
        section={section}
        isFirst={isFirst}
        isLast={isLast}
        selected={selectedSectionId === `section:${sid}`}
        expanded={isExpanded}
        onToggleExpand={onToggleExpand}
        onSelect={onSelect}
        onSelectBlock={onSelectBlock}
        selectedBlockPathKey={
          selectedSectionId === `section:${sid}` ? selectedBlockPathKey : undefined
        }
        expandedBlockKey={expandedBlockKey}
        onExpandBlock={onExpandBlock}
      />
      <SectionInsertSlot pageId={pageId} index={index + 1} />
    </div>
  );
});


// ---------- Section insert slot ----------

const SectionInsertSlot = memo(function SectionInsertSlot({ pageId, index }: { pageId: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <DropZone
      id={idForSectionSlot(pageId, index)}
      data={{ kind: "section-slot", pageId, index }}
    >
      {({ isOver }) => (
        <div className="group relative flex h-4 items-center">
          <div
            className={`pointer-events-none absolute inset-x-2 top-1/2 h-px -translate-y-1/2 transition-all ${
              isOver
                ? "h-[2px] bg-primary opacity-100"
                : open
                  ? "bg-border opacity-100"
                  : "bg-border opacity-0 group-hover:opacity-100"
            }`}
          />
          <div className="mx-auto">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label="Add section"
              className={`relative z-10 inline-flex h-5 items-center gap-1 rounded-full border border-border bg-surface px-2 text-[11px] text-muted-foreground transition-all hover:border-foreground hover:text-foreground ${
                open ? "border-foreground text-foreground" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <Plus className="h-3 w-3" /> Add section
            </button>
          </div>
          {open && (
            <div
              className="absolute left-1/2 top-6 z-20 w-56 -translate-x-1/2 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-container)]"
              onMouseLeave={() => setOpen(false)}
            >
              <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Add section
              </div>
              <div className="max-h-72 overflow-auto pb-1">
                {SECTION_KINDS.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      sectionActions.add(pageId, k, index);
                      recordRecentSection(k);
                      setOpen(false);
                    }}
                    className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-muted"
                  >
                    <span>{SECTION_LABEL[k]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </DropZone>
  );
});

// ---------- Section card ----------

const SectionCard = memo(function SectionCard({
  section,
  isFirst,
  isLast,
  selected,
  expanded,
  onToggleExpand,
  onSelect,
  onSelectBlock,
  selectedBlockPathKey,
  expandedBlockKey,
  onExpandBlock,
}: {
  section: Section;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onSelectBlock?: (pathKey: string) => void;
  selectedBlockPathKey?: string;
  expandedBlockKey?: string;
  onExpandBlock: (key: string | undefined) => void;
}) {
  const blocks = section.blocks ?? [];
  const canTemplate = TEMPLATEABLE.includes(section.kind);
  const boundComponent = useCMS((s) =>
    section.componentId ? s.components.find((c) => c.id === section.componentId) : undefined,
  );
  const isBound = !!boundComponent;

  // Preview: first heading text or first text-bearing prop in tree.
  const preview = useMemo(() => sectionPreview(blocks), [blocks]);
  const blockCount = useMemo(() => countBlocks(blocks), [blocks]);

  return (
    <div
      onClick={onSelect}
      data-block-id={`section:${section.id}`}
      className={`group relative transition-colors duration-150 ${
        selected ? "" : ""
      }`}
    >
      {/* Selection treatment: soft elevated surface + 1px ring (replaces the
          old pink rail). Calmer, more Linear-style. */}
      {/* Section header — folder-style row, not a card. */}
      <div
        className="flex items-start gap-2 px-2 py-2 transition-colors hover:bg-[color:var(--color-row-hover)]"
        onClick={(e) => {
          // Header click toggles expand (but not when clicking inputs/buttons inside).
          if ((e.target as HTMLElement).closest("[data-noexpand]")) return;
          e.stopPropagation();
          onToggleExpand();
          onSelect();
        }}
      >
        <button
          type="button"
          data-noexpand
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="mt-0.5 grid h-5 w-5 place-items-center rounded-[4px] text-muted-foreground transition-colors hover:bg-[color:var(--s4)] hover:text-foreground"
          aria-label={expanded ? "Collapse section" : "Expand section"}
        >
          {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        <GripVertical
          data-noexpand
          className="mt-1 h-4 w-4 shrink-0 cursor-grab text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100"
        />


        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            {(() => {
              const SIcon = SECTION_ICON[section.kind];
              return SIcon ? (
                <SIcon
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-label={SECTION_LABEL[section.kind]}
                />
              ) : null;
            })()}
            <div data-noexpand className="min-w-0 flex-1" onClick={(e) => e.stopPropagation()}>
              <InlineEditable
                size="md"
                value={section.name}
                onChange={(v) => sectionActions.update(section.id, { name: v })}
                placeholder={SECTION_LABEL[section.kind]}
                containerClassName="-ml-1.5 font-semibold"
                className="font-semibold"
              />
            </div>
            {isBound && (
              <span
                className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                title={`Bound to component ${boundComponent!.name}`}
              >
                <Link2 className="h-3 w-3" /> {boundComponent!.name}
              </span>
            )}
          </div>

          {!expanded && (
            <div className="mt-1.5 flex items-center gap-2 text-[12px] text-muted-foreground">
              <span>
                {blockCount} block{blockCount === 1 ? "" : "s"}
              </span>
              {preview && (
                <>
                  <span className="opacity-40">·</span>
                  <span className="truncate text-foreground/70">{preview}</span>
                </>
              )}
              <BlockMixChips blocks={blocks} />
            </div>
          )}
        </div>

        {/* Quick actions — always visible */}
        <div className="flex shrink-0 items-center gap-0.5" data-noexpand data-no-comment>
          {!isBound && (
            <IconButton
              title="Add block"
              onClick={() => openBlockLibrary(section.id, [], blocks.length)}
            >
              <Plus className="h-4 w-4" />
            </IconButton>
          )}
          {!isBound && canTemplate && (
            <IconButton title="Insert template" onClick={() => openTemplatePicker(section.id)}>
              <LayoutTemplate className="h-4 w-4" />
            </IconButton>
          )}
          <IconButton title="Duplicate" onClick={() => sectionActions.duplicate(section.id)}>
            <Copy className="h-4 w-4" />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                aria-label="More section actions"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44 text-[12px]">
              <DropdownMenuItem
                disabled={isFirst}
                onClick={() => sectionActions.move(section.id, -1)}
              >
                <ChevronUp className="mr-2 h-3.5 w-3.5" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={isLast}
                onClick={() => sectionActions.move(section.id, 1)}
              >
                <ChevronDown className="mr-2 h-3.5 w-3.5" /> Move down
              </DropdownMenuItem>
              {isBound && (
                <DropdownMenuItem
                  onClick={() => sectionActions.detachFromComponent(section.id)}
                >
                  <Link2Off className="mr-2 h-3.5 w-3.5" /> Detach from component
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => sectionActions.remove(section.id)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete section
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Body — indented children, no card chrome */}
      {expanded && (
        <div className="pl-7 pr-2 pb-2" onClick={(e) => e.stopPropagation()}>
          {isBound ? (
            <BoundSectionBody section={section} master={boundComponent!} />
          ) : blocks.length === 0 ? (
            <EmptyBlocks
              sectionId={section.id}
              sectionKind={section.kind}
              canTemplate={canTemplate}
            />
          ) : (
            <BlockList
              sectionId={section.id}
              blocks={blocks}
              parentPath={[]}
              depth={0}
              onSelectBlock={onSelectBlock}
              selectedBlockPathKey={selectedBlockPathKey}
              expandedBlockKey={expandedBlockKey}
              onExpandBlock={onExpandBlock}
            />
          )}
        </div>
      )}
    </div>
  );
});

// ---------- Block list (recursive) ----------

const BlockList = memo(function BlockList({
  sectionId,
  blocks,
  parentPath,
  depth,
  onSelectBlock,
  selectedBlockPathKey,
  expandedBlockKey,
  onExpandBlock,
  onHoverBlock,
}: {
  sectionId: string;
  blocks: Block[];
  parentPath: BlockPath;
  depth: number;
  onSelectBlock?: (pathKey: string) => void;
  selectedBlockPathKey?: string;
  expandedBlockKey?: string;
  onExpandBlock: (key: string | undefined) => void;
  onHoverBlock?: (pathKey: string | undefined) => void;
}) {
  const parentKey = pathKey(parentPath);
  const onSelectedPath =
    !!selectedBlockPathKey &&
    depth > 0 &&
    (selectedBlockPathKey === parentKey || selectedBlockPathKey.startsWith(parentKey + "."));
  return (
    <div
      className={
        depth > 0
          ? `ml-2 flex flex-col border-l pl-3 transition-colors ${
              onSelectedPath ? "border-primary/40" : "border-border/60 hover:border-border-strong"
            }`
          : "flex flex-col"
      }
    >
      <BlockInsertSlot sectionId={sectionId} parentPath={parentPath} index={0} />
      {blocks.map((b, i) => {
        const path = [...parentPath, i];
        return (
          <div key={b.id}>
            <BlockNode
              block={b}
              path={path}
              depth={depth}
              sectionId={sectionId}
              onSelectBlock={onSelectBlock}
              selectedBlockPathKey={selectedBlockPathKey}
              expandedBlockKey={expandedBlockKey}
              onExpandBlock={onExpandBlock}
              onHoverBlock={onHoverBlock}
            />
            <BlockInsertSlot sectionId={sectionId} parentPath={parentPath} index={i + 1} />
          </div>
        );
      })}
    </div>
  );
});


// ---------- Block insert slot (between rows) ----------

const BlockInsertSlot = memo(function BlockInsertSlot({
  sectionId,
  parentPath,
  index,
}: {
  sectionId: string;
  parentPath: BlockPath;
  index: number;
}) {
  const sectionKind = useCMS(
    (s) => s.sections.find((x) => x.id === sectionId)?.kind,
  );
  return (
    <DropZone
      id={idForBlockSlot(sectionId, parentPath, index)}
      data={{ kind: "block-slot", sectionId, parentPath, index }}
    >
      {({ isOver }) => (
        <div className="group/slot relative flex h-5 items-center" onClick={(e) => e.stopPropagation()}>
          <div
            className={`pointer-events-none absolute inset-x-1 top-1/2 -translate-y-1/2 transition-all ${
              isOver
                ? "h-[2px] bg-primary opacity-100"
                : "h-px bg-border opacity-30 group-hover/slot:opacity-100"
            }`}
          />
          <div className="mx-auto opacity-0 transition-opacity group-hover/slot:opacity-100 data-[state=open]:opacity-100">
            <InsertPopover
              sectionId={sectionId}
              parentPath={parentPath}
              atIndex={index}
              sectionKind={sectionKind}
            >
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="relative z-10 inline-flex h-6 items-center gap-1 rounded-full border border-border bg-[--s-card] px-2.5 text-[11px] font-medium text-foreground shadow-sm transition-all hover:border-foreground/60 hover:bg-muted"
                aria-label="Insert block here"
              >
                <Plus className="h-3 w-3" />
                Add block
              </button>
            </InsertPopover>
          </div>
        </div>
      )}
    </DropZone>
  );
});

// ---------- Single block row ----------

const BlockNode = memo(function BlockNode({
  block,
  path,
  depth,
  sectionId,
  onSelectBlock,
  selectedBlockPathKey,
  expandedBlockKey,
  onExpandBlock,
  onHoverBlock,
}: {
  block: Block;
  path: BlockPath;
  depth: number;
  sectionId: string;
  onSelectBlock?: (pathKey: string) => void;
  selectedBlockPathKey?: string;
  expandedBlockKey?: string;
  onExpandBlock: (key: string | undefined) => void;
  onHoverBlock?: (pathKey: string | undefined) => void;
}) {

  const { density } = useEditorDensity();
  const def = BLOCK_REGISTRY[block.kind];
  const Icon = def?.icon;
  const container = isContainer(block.kind);
  const children = block.children ?? [];
  const myKey = pathKey(path);
  const isSelected = selectedBlockPathKey === myKey;
  const userExpanded = expandedBlockKey === myKey;
  const isExpanded =
    density === "expanded" ? true : density === "compact" ? false : userExpanded;
  const allowInlineExpand = density !== "compact";
  const rowRef = useRef<HTMLDivElement>(null);
  const accent = def ? GROUP_ACCENT[def.group] : "transparent";
  const summary = blockSummary(block);

  // Split fields into essentials + advanced based on registry hint.
  const essentialsSet = useMemo(
    () => new Set(def?.essentialFields ?? def?.fields.map((f) => f.name) ?? []),
    [def],
  );
  const essentialFields = useMemo(
    () => (def?.fields ?? []).filter((f) => essentialsSet.has(f.name)),
    [def, essentialsSet],
  );
  const advancedFields = useMemo(
    () => (def?.fields ?? []).filter((f) => !essentialsSet.has(f.name)),
    [def, essentialsSet],
  );
  const [showAdvanced, setShowAdvanced] = useState(density === "expanded");
  useEffect(() => {
    if (density === "expanded") setShowAdvanced(true);
  }, [density]);

  useEffect(() => {
    if (!isSelected || !rowRef.current) return;
    const r = rowRef.current.getBoundingClientRect();
    // Skip smooth scroll when the row is already comfortably in view —
    // smooth-scroll-to-visible is the most expensive no-op in the trace.
    const vh = typeof window !== "undefined" ? window.innerHeight : 0;
    if (r.top >= 0 && r.bottom <= vh) return;
    rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [isSelected]);

  const toggleExpand = () => {
    if (!allowInlineExpand) return;
    onExpandBlock(userExpanded ? undefined : myKey);
  };

  return (
    <div
      ref={rowRef}
      data-block-id={block.id}
      data-block-path-key={myKey}
      onClick={(e) => {
        e.stopPropagation();
        onSelectBlock?.(myKey);
        if (allowInlineExpand && !userExpanded) onExpandBlock(myKey);
      }}
      onMouseEnter={() => onHoverBlock?.(myKey)}
      onMouseLeave={() => onHoverBlock?.(undefined)}
      className={`relative overflow-hidden rounded-[8px] border bg-surface/40 transition-colors ${
        isSelected
          ? "border-primary/50 ring-1 ring-primary/20"
          : "border-border hover:border-border-strong"
      }`}
    >

      {/* Category accent rail */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[2px]"
        style={{ background: accent }}
      />

      {/* Row header */}
      <div className="group/row flex items-center gap-1.5 px-2.5 py-1.5 pl-1.5">
        <DragHandle
          id={idForBlock(sectionId, path)}
          data={{
            kind: "block",
            sectionId,
            path,
            label: def?.label ?? block.kind,
          }}
          className="grid h-5 w-4 shrink-0 place-items-center rounded-[3px] text-muted-foreground/40 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover/row:opacity-100"
        />

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleExpand();
          }}
          className="grid h-5 w-5 place-items-center text-muted-foreground hover:text-foreground"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <ChevronRight
            className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`}
          />
        </button>
        {/* Block identity: icon tinted by category, primary label, secondary preview */}
        {Icon && (
          <Icon
            aria-hidden
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: `color-mix(in srgb, ${accent} 75%, var(--color-foreground))` }}
          />
        )}
        <span
          className="shrink-0 text-[12.5px] font-medium text-foreground"
          title={def?.group ? `${def.label} · ${def.group}` : def?.label}
        >
          {def?.label ?? block.kind}
        </span>
        {summary ? (
          <span className="ml-1 min-w-0 flex-1 truncate text-[12px] text-muted-foreground">
            <span aria-hidden className="mr-1.5 text-muted-foreground/50">·</span>
            {summary}
          </span>
        ) : (
          <span className="ml-1 flex-1" />
        )}


        <div data-no-comment className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100 focus-within:opacity-100">
          {container && (
            <IconButton
              size="xs"
              title="Add child block"
              onClick={() => openBlockLibrary(sectionId, path, children.length)}
            >
              <Plus className="h-3.5 w-3.5" />
            </IconButton>
          )}
          <IconButton
            size="xs"
            title="Duplicate"
            onClick={() => blockActions.duplicate(sectionId, path)}
          >
            <Copy className="h-3.5 w-3.5" />
          </IconButton>
          <IconButton
            size="xs"
            title="Delete"
            onClick={() => blockActions.remove(sectionId, path)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </IconButton>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="grid h-6 w-6 place-items-center rounded-[4px] text-muted-foreground hover:bg-background hover:text-foreground"
                aria-label="Block actions"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40 text-[12px]">
              <DropdownMenuItem onClick={() => blockActions.move(sectionId, path, -1)}>
                <ChevronUp className="mr-2 h-3.5 w-3.5" /> Move up
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => blockActions.move(sectionId, path, 1)}>
                <ChevronDown className="mr-2 h-3.5 w-3.5" /> Move down
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => blockActions.wrap(sectionId, path, "container")}>
                Wrap in container
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={() => blockActions.remove(sectionId, path)}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded body: Essentials + Advanced disclosure */}
      {isExpanded && (def?.fields.length ?? 0) > 0 && (
        <div className="space-y-3 border-t border-border/60 px-3 py-3 pl-4">
          {essentialFields.map((field) => (
            <FieldRow
              key={field.id}
              blockId={block.id}
              field={field}
              value={block.props[field.name]}
              onChange={(v) =>
                blockActions.update(sectionId, path, { [field.name]: v })
              }
            />
          ))}
          {advancedFields.length > 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAdvanced((v) => !v);
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
                aria-expanded={showAdvanced}
              >
                <ChevronRight
                  className={`h-3 w-3 transition-transform ${showAdvanced ? "rotate-90" : ""}`}
                />
                Advanced
              </button>
              {showAdvanced && (
                <div className="mt-2 space-y-3 border-t border-border/50 pt-3">
                  {advancedFields.map((field) => (
                    <FieldRow
                      key={field.id}
                      blockId={block.id}
                      field={field}
                      value={block.props[field.name]}
                      onChange={(v) =>
                        blockActions.update(sectionId, path, { [field.name]: v })
                      }
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Container children render below row, indented, regardless of expansion */}
      {container && children.length > 0 && (
        <div className="pb-2 pl-2 pr-2">
          <BlockList
            sectionId={sectionId}
            blocks={children}
            parentPath={path}
            depth={depth + 1}
            onSelectBlock={onSelectBlock}
            selectedBlockPathKey={selectedBlockPathKey}
            expandedBlockKey={expandedBlockKey}
            onExpandBlock={onExpandBlock}
            onHoverBlock={onHoverBlock}

          />
        </div>
      )}

      {/* Container empty-state */}
      {container && children.length === 0 && (
        <div className="px-3 pb-2 pl-4">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openBlockLibrary(sectionId, path, 0);
            }}
            className="inline-flex h-6 items-center gap-1 rounded-[6px] border border-dashed border-border bg-background px-2 text-[11px] text-muted-foreground hover:border-border-strong hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> Add child block
          </button>
        </div>
      )}
    </div>
  );
});

// ---------- Bound section body (unchanged) ----------

const BoundSectionBody = memo(function BoundSectionBody({ section, master }: { section: Section; master: ComponentMaster }) {
  const fieldCount = useCMS((s) =>
    master.schemaId ? (s.schemas.find((sc) => sc.id === master.schemaId)?.fields.length ?? 0) : 0,
  );
  const overrideKeys = Object.keys(section.overrides ?? {});
  const blockCount = master.rootBlocks?.length ?? 0;
  return (
    <div className="rounded-[8px] border border-dashed border-primary/30 bg-primary/5 px-4 py-3 text-[12px]">
      <div className="flex items-center justify-between">
        <div className="font-medium text-foreground">
          Rendered from <span className="font-semibold">{master.name}</span>
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">{master.id}</div>
      </div>
      <div className="mt-1 text-muted-foreground">
        {blockCount} block{blockCount === 1 ? "" : "s"} · {fieldCount} schema field
        {fieldCount === 1 ? "" : "s"} · {overrideKeys.length} override
        {overrideKeys.length === 1 ? "" : "s"}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        Edit overrides in the right inspector’s{" "}
        <span className="font-medium text-foreground">Content</span> tab. Default blocks are edited
        on the component master.
      </div>
    </div>
  );
});

// ---------- Empty state ----------

const EmptyBlocks = memo(function EmptyBlocks({
  sectionId,
  sectionKind,
  canTemplate,
}: {
  sectionId: string;
  sectionKind: SectionKind;
  canTemplate: boolean;
}) {
  return (
    <div className="rounded-[8px] border border-dashed border-border bg-surface/50 px-4 py-6 text-center">
      <div className="text-[12px] text-muted-foreground">
        This {SECTION_LABEL[sectionKind]} section is empty.
      </div>
      <div className="mt-3 flex items-center justify-center gap-2" data-no-comment>
        <button
          type="button"
          onClick={() => openBlockLibrary(sectionId, [], 0)}
          className="inline-flex h-8 items-center gap-1 rounded-[6px] bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> Add a block
        </button>
        {canTemplate && (
          <button
            type="button"
            onClick={() => openTemplatePicker(sectionId)}
            className="inline-flex h-8 items-center gap-1 rounded-[6px] border border-border bg-background px-3 text-[12px] hover:border-border-strong"
          >
            <LayoutTemplate className="h-3.5 w-3.5" /> Browse templates
          </button>
        )}
      </div>
    </div>
  );
});

// ---------- Field row (label + control) ----------

const FieldRow = memo(function FieldRow({
  field,
  value,
  onChange,
  blockId,
}: {
  field: SchemaField;
  value: unknown;
  onChange: (v: unknown) => void;
  blockId?: string;
}) {
  return (
    <div data-field-path={`${blockId ?? "_"}:${field.name}`}>
      <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
        {field.label}
      </label>
      <FieldControl field={field} value={value} onChange={onChange} />
    </div>
  );
});


// ---------- IconButton ----------

const IconButton = memo(function IconButton({
  children,
  onClick,
  title,
  disabled,
  size = "sm",
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
  size?: "xs" | "sm";
}) {
  const dims = size === "xs" ? "h-6 w-6" : "h-7 w-7";
  return (
    <button
      title={title}
      disabled={disabled}
      data-no-comment
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`grid ${dims} place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30`}
    >
      {children}
    </button>
  );
});

// ---------- Block mix chips (collapsed section preview) ----------

const BlockMixChips = memo(function BlockMixChips({ blocks }: { blocks: Block[] }) {
  const mix = useMemo(() => blockTypeMix(blocks), [blocks]);
  if (mix.length === 0) return null;
  const shown = mix.slice(0, 4);
  const overflow = mix.length - shown.length;
  return (
    <span className="ml-auto flex shrink-0 items-center gap-1">
      {shown.map(({ kind, def, count }) => {
        const Icon = def?.icon;
        const accent = def ? GROUP_ACCENT[def.group] : "transparent";
        return (
          <span
            key={kind}
            title={`${count} × ${def?.label ?? kind}`}
            className="inline-flex items-center gap-0.5 rounded-[3px] px-1 py-0.5 text-[10px] font-medium"
            style={{
              background: `color-mix(in srgb, ${accent} 10%, transparent)`,
              color: `color-mix(in srgb, ${accent} 75%, var(--color-muted-foreground))`,
            }}
          >
            {Icon && <Icon className="h-2.5 w-2.5" />}
            {count}
          </span>
        );
      })}
      {overflow > 0 && (
        <span className="text-[10px] text-muted-foreground/70">+{overflow}</span>
      )}
    </span>
  );
});

function blockTypeMix(
  blocks: Block[],
): Array<{ kind: string; def: (typeof BLOCK_REGISTRY)[keyof typeof BLOCK_REGISTRY] | undefined; count: number }> {
  const counts = new Map<string, number>();
  const walk = (list: Block[]) => {
    for (const b of list) {
      counts.set(b.kind, (counts.get(b.kind) ?? 0) + 1);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  return Array.from(counts.entries())
    .map(([kind, count]) => ({ kind, count, def: BLOCK_REGISTRY[kind as keyof typeof BLOCK_REGISTRY] }))
    .sort((a, b) => b.count - a.count);
}

// ---------- Helpers ----------

function countBlocks(blocks: Block[]): number {
  let n = 0;
  for (const b of blocks) {
    n += 1;
    if (b.children?.length) n += countBlocks(b.children);
  }
  return n;
}

function sectionPreview(blocks: Block[]): string {
  // First heading wins; otherwise first non-empty text.
  const headings: Block[] = [];
  const walk = (list: Block[]) => {
    for (const b of list) {
      if (b.kind === "heading") headings.push(b);
      if (b.children?.length) walk(b.children);
    }
  };
  walk(blocks);
  if (headings.length > 0) {
    const t = typeof headings[0].props.text === "string" ? headings[0].props.text : "";
    if (t) return `"${truncate(t, 60)}"`;
  }
  // Fallback: first block's summary
  if (blocks.length > 0) {
    const s = blockSummary(blocks[0]);
    if (s) return s;
  }
  return "";
}

function truncate(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

// ============================================================
// SectionNavCard — clean navigation card used in the page index.
// Click anywhere to open the focused Section Workspace.
// ============================================================

const SectionNavCard = memo(function SectionNavCard({
  section,
  pageId,
  index,
  isFirst,
  isLast,
  selected,
  onOpen,
}: {
  section: Section;
  pageId: string;
  index: number;
  isFirst: boolean;
  isLast: boolean;
  selected: boolean;
  onOpen: () => void;
}) {
  const blocks = section.blocks ?? [];
  const boundComponent = useCMS((s) =>
    section.componentId ? s.components.find((c) => c.id === section.componentId) : undefined,
  );
  const isBound = !!boundComponent;
  const blockCount = useMemo(() => countBlocks(blocks), [blocks]);
  const ctaCount = useMemo(() => {
    let n = 0;
    const walk = (list: Block[]) => {
      for (const b of list) {
        if (b.kind === "button" || b.kind === "cta-group") n += 1;
        if (b.children?.length) walk(b.children);
      }
    };
    walk(blocks);
    return n;
  }, [blocks]);
  const preview = useMemo(() => sectionPreview(blocks), [blocks]);
  const SIcon = SECTION_ICON[section.kind];

  return (
    <div
      data-block-id={`section:${section.id}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("[data-noopen]")) return;
        onOpen();
      }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`group relative flex cursor-pointer items-start gap-3 rounded-[10px] border bg-surface px-4 py-3.5 transition-all hover:-translate-y-[1px] hover:border-border-strong hover:shadow-[var(--shadow-container)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
        selected
          ? "border-foreground/40 shadow-[var(--shadow-container)]"
          : "border-border"
      }`}
    >
      <DragHandle
        id={idForSection(section.id)}
        data={{
          kind: "section",
          pageId,
          sectionId: section.id,
          index,
          label: section.name || SECTION_LABEL[section.kind],
        }}
        className="mt-1 grid h-4 w-4 shrink-0 place-items-center rounded-[3px] text-muted-foreground/40 opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
      />


      {SIcon && (
        <div className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[8px] bg-muted/60 text-foreground/80">
          <SIcon className="h-4 w-4" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-[14px] font-semibold text-foreground">
            {section.name || SECTION_LABEL[section.kind]}
          </h3>
          {isBound && (
            <span
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
              title={`Bound to component ${boundComponent!.name}`}
            >
              <Link2 className="h-3 w-3" /> {boundComponent!.name}
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
          <span>
            {blockCount} block{blockCount === 1 ? "" : "s"}
          </span>
          {ctaCount > 0 && (
            <>
              <span className="opacity-40">·</span>
              <span>
                {ctaCount} CTA{ctaCount === 1 ? "" : "s"}
              </span>
            </>
          )}
          {preview && (
            <>
              <span className="opacity-40">·</span>
              <span className="truncate text-foreground/70">{preview}</span>
            </>
          )}
        </div>
      </div>

      <div data-noopen className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
        <IconButton title="Duplicate" onClick={() => sectionActions.duplicate(section.id)}>
          <Copy className="h-4 w-4" />
        </IconButton>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              aria-label="More section actions"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 text-[12px]">
            <DropdownMenuItem
              disabled={isFirst}
              onClick={() => sectionActions.move(section.id, -1)}
            >
              <ChevronUp className="mr-2 h-3.5 w-3.5" /> Move up
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={isLast}
              onClick={() => sectionActions.move(section.id, 1)}
            >
              <ChevronDown className="mr-2 h-3.5 w-3.5" /> Move down
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => sectionActions.remove(section.id)}
            >
              <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete section
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <ChevronRight className="ml-1 h-4 w-4 text-muted-foreground/60" />
      </div>
    </div>
  );
});

// ============================================================
// SectionWorkspace — focused tabbed editor for a single Section.
// Tabs: Preview · Content · Layout · Style · SEO · Advanced.
// Reuses BlockList / BoundSectionBody / EmptyBlocks for Content.
// ============================================================

type WorkspaceTab = "content" | "layout" | "style" | "seo" | "advanced";

const SECTION_TABS: { id: WorkspaceTab; label: string }[] = [
  { id: "content", label: "Content" },
  { id: "layout", label: "Layout" },
  { id: "style", label: "Style" },
  { id: "seo", label: "SEO" },
  { id: "advanced", label: "Advanced" },
];


const SectionWorkspace = memo(function SectionWorkspace({
  page,
  section,
  sections,
  onUnfocus,
  onSwitchSection,
  onSelectBlock,
  selectedBlockPathKey,
  expandedBlockKey,
  onExpandBlock,
}: {
  page: Page;
  section: Section;
  sections: Section[];
  onUnfocus: () => void;
  onSwitchSection: (sectionId: string) => void;
  onSelectBlock: (pathKey: string) => void;
  selectedBlockPathKey?: string;
  expandedBlockKey?: string;
  onExpandBlock: (key: string | undefined) => void;
}) {
  const [tab, setTab] = useState<WorkspaceTab>("content");
  const blocks = section.blocks ?? [];
  const boundComponent = useCMS((s) =>
    section.componentId ? s.components.find((c) => c.id === section.componentId) : undefined,
  );
  const isBound = !!boundComponent;
  const canTemplate = TEMPLATEABLE.includes(section.kind);
  const SIcon = SECTION_ICON[section.kind];

  const idx = sections.findIndex((s) => s.id === section.id);
  const prev = idx > 0 ? sections[idx - 1] : undefined;
  const next = idx >= 0 && idx < sections.length - 1 ? sections[idx + 1] : undefined;

  // Esc returns to the page index.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const t = e.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        onUnfocus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onUnfocus]);

  // Lift hover state so editor rows AND preview blocks both drive it.
  const [hoverKey, setHoverKey] = useState<string | undefined>();
  const [hoverSectionId, setHoverSectionId] = useState<string | undefined>();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const previewScopeRef = useRef<HTMLDivElement>(null);
  const onSelectFromPreview = useCallback(
    (key: string) => onSelectBlock(key),
    [onSelectBlock],
  );
  const onSelectSectionFromPreview = useCallback(
    (id: string) => {
      if (id !== section.id) onSwitchSection(id);
    },
    [onSwitchSection, section.id],
  );

  // Listen for cross-pane events from the content tree / placeholders.
  useEffect(() => {
    const off = editorBus.on((e) => {
      if (e.type === "editor:hover-section") {
        setHoverSectionId(e.sectionId);
      } else if (e.type === "editor:open-block-library" && e.sectionId === section.id) {
        openBlockLibrary(section.id, [], (section.blocks ?? []).length);
      }
    });
    return off;
  }, [section.id, section.blocks]);


  return (
    <BlockDndProvider onSelect={onSelectBlock}>
    <div ref={workspaceRef} className="mx-auto flex h-full w-full max-w-[1400px] flex-col px-6 py-6">
      {/* Header */}
      <div className="mb-4">
        <button
          type="button"
          onClick={onUnfocus}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to {page.title || "page"}
        </button>

        <div className="flex items-start gap-3">
          {SIcon && (
            <div className="mt-1 grid h-10 w-10 shrink-0 place-items-center rounded-[8px] bg-muted/60 text-foreground/80">
              <SIcon className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
              {SECTION_LABEL[section.kind]}
            </div>
            <InlineEditable
              size="xl"
              value={section.name}
              onChange={(v) => sectionActions.update(section.id, { name: v })}
              placeholder={SECTION_LABEL[section.kind]}
              containerClassName="-ml-2"
              className="font-semibold"
            />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              title="Previous section"
              onClick={() => prev && onSwitchSection(prev.id)}
              disabled={!prev}
            >
              <ChevronUp className="h-4 w-4" />
            </IconButton>
            <IconButton
              title="Next section"
              onClick={() => next && onSwitchSection(next.id)}
              disabled={!next}
            >
              <ChevronDown className="h-4 w-4" />
            </IconButton>
            <IconButton title="Duplicate" onClick={() => sectionActions.duplicate(section.id)}>
              <Copy className="h-4 w-4" />
            </IconButton>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                  aria-label="More section actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 text-[12px]">
                {isBound && (
                  <DropdownMenuItem
                    onClick={() => sectionActions.detachFromComponent(section.id)}
                  >
                    <Link2Off className="mr-2 h-3.5 w-3.5" /> Detach component
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={() => {
                    sectionActions.remove(section.id);
                    onUnfocus();
                  }}
                >
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Delete section
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Split: editor (tabs) on the left, persistent live preview on the right. */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Left: tabbed editor pane */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-4 flex items-center gap-1 border-b border-border">
            {SECTION_TABS.map((t) => {
              const active = t.id === tab;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`-mb-px border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
                    active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  }`}
                  aria-selected={active}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="min-h-0 flex-1 overflow-auto pr-1">
            {tab === "content" && (
              <div className="rounded-[10px] border border-border bg-surface/40 p-3">
                {isBound ? (
                  <BoundSectionBody section={section} master={boundComponent!} />
                ) : blocks.length === 0 ? (
                  <EmptyBlocks
                    sectionId={section.id}
                    sectionKind={section.kind}
                    canTemplate={canTemplate}
                  />
                ) : (
                  <BlockList
                    sectionId={section.id}
                    blocks={blocks}
                    parentPath={[]}
                    depth={0}
                    onSelectBlock={onSelectBlock}
                    selectedBlockPathKey={selectedBlockPathKey}
                    expandedBlockKey={expandedBlockKey}
                    onExpandBlock={onExpandBlock}
                    onHoverBlock={setHoverKey}
                  />
                )}
              </div>
            )}

            {tab === "layout" && <LayoutTab section={section} />}
            {tab === "style" && <StyleTab section={section} />}
            {tab === "seo" && <SeoTab section={section} />}
            {tab === "advanced" && <AdvancedTab section={section} />}
          </div>
        </div>

        {/* Right: persistent live preview, sticky as the editor scrolls. */}
        <div className="hidden min-w-0 flex-col lg:flex">
          <div className="mb-2 flex items-center justify-between px-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Live preview
            </div>
            <div className="text-[11px] text-muted-foreground">
              Hover or click a block to sync
            </div>
          </div>
          <div
            ref={previewScopeRef}
            className="min-h-0 flex-1 overflow-auto rounded-[10px] border border-border bg-white shadow-[var(--shadow-container)]"
          >
            <PreviewSyncProvider
              selectedKey={selectedBlockPathKey}
              hoverKey={hoverKey}
              onHoverChange={setHoverKey}
              onSelect={onSelectFromPreview}
              selectedSectionId={section.id}
              hoverSectionId={hoverSectionId}
              onSectionHoverChange={setHoverSectionId}
              onSelectSection={onSelectSectionFromPreview}
            >
              {isBound ? (
                <BoundSectionPreview section={section} />
              ) : (
                <SectionPreview section={section} />
              )}
            </PreviewSyncProvider>
          </div>
        </div>
      </div>

      {/* Contextual floating toolbar — anchors to the selected block in
          either the editor pane or the preview. */}
      {!isBound && (
        <BlockToolbar
          section={section}
          selectedKey={selectedBlockPathKey}
          onOpenDetails={() => setDetailsOpen(true)}
          onSelectKey={(k) => onSelectBlock(k ?? "")}
        />
      )}

      {/* Slide-over with the full property form for the selected block. */}
      {!isBound && (
        <BlockDetailsSheet
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          section={section}
          selectedKey={selectedBlockPathKey}
        />
      )}

      {/* Row-level slash menu — listens for '/' inside this workspace. */}
      {!isBound && (
        <SlashMenu
          scopeRef={workspaceRef}
          section={section}
          onInserted={(key) => onSelectBlock(key)}
        />
      )}

      {/* Preview slash menu — listens for '/' inside the live preview surface. */}
      {!isBound && (
        <PreviewSlashMenu
          scopeRef={previewScopeRef}
          section={section}
          selectedKey={selectedBlockPathKey}
          onInserted={(key) => onSelectBlock(key)}
        />
      )}
    </div>
    </BlockDndProvider>
  );
});



