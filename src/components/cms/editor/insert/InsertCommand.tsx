/**
 * InsertCommand — the one engine that powers every block-insert surface:
 * the inline "+ Add block" slot between rows, the floating BlockToolbar's
 * "+" action, and the row-level slash menu.
 *
 * Pure presentational + a single side-effect (blockActions.add). After
 * insertion it returns the new BlockPath via onInserted so callers can
 * snap selection / open the floating toolbar onto the new block.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowRight,
  Clock,
  LayoutGrid,
  Sparkles,
  Type as TypeGroupIcon,
  Image as MediaGroupIcon,
  LayoutPanelTop,
  MousePointerClick,
  Wrench,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ALL_BLOCK_KINDS,
  BLOCK_GROUPS,
  BLOCK_REGISTRY,
  type BlockGroup,
  type BlockKind,
} from "@/lib/cms/blocks/registry";
import { blockActions } from "@/lib/cms/store";
import { getRecentBlocks, recordRecentBlock } from "@/lib/cms/blocks/recent";
import { openBlockLibrary } from "../center/BlockLibraryWorkspace";
import type { BlockPath } from "@/lib/cms/blocks/operations";
import type { Block, SectionKind } from "@/lib/cms/types";
import { BlockPreviewTile } from "./BlockPreviewTile";
import { AiDraftDialog } from "../ai/AiDraftDialog";
import { getTransformsFor, type BlockTransform } from "@/lib/cms/blocks/transforms";

const GROUP_ACCENT: Record<BlockGroup, string> = {
  Content: "var(--accent-content)",
  Media: "var(--accent-media)",
  Layout: "var(--accent-layout)",
  Interactive: "var(--accent-interactive)",
  Action: "var(--accent-action)",
  Advanced: "var(--accent-advanced)",
};

const GROUP_ICON: Record<BlockGroup, LucideIcon> = {
  Content: TypeGroupIcon,
  Media: MediaGroupIcon,
  Layout: LayoutPanelTop,
  Interactive: Sparkles,
  Action: MousePointerClick,
  Advanced: Wrench,
};

// Heuristic suggestions by section kind. Filtered against the registry so
// missing kinds are silently dropped.
const SUGGESTED: Partial<Record<SectionKind, BlockKind[]>> = {
  hero: ["heading", "paragraph", "cta-group", "image"],
  features: ["card-group", "card", "heading", "paragraph"],
  pricing: ["card-group", "card", "cta-group"],
  testimonials: ["quote", "card-group", "card"],
  logos: ["image", "grid"],
  cta: ["heading", "paragraph", "cta-group", "button"],
  faq: ["accordion", "heading", "list"],
  content: ["heading", "paragraph", "richText", "image", "list"],
  footer: ["columns", "list", "richText"],
  header: ["columns", "button"],
  navigation: ["columns", "button"],
  stats: ["grid", "card-group"],
  blog: ["heading", "richText", "image"],
  docs: ["heading", "richText", "list", "code"],
  contact: ["heading", "paragraph", "button"],
  workflow: ["card-group", "heading"],
  integrations: ["grid", "card-group"],
};

interface Props {
  sectionId: string;
  parentPath: BlockPath;
  atIndex: number;
  sectionKind?: SectionKind;
  initialQuery?: string;
  onQueryChange?: (q: string) => void;
  onClose: () => void;
  onInserted?: (newPath: BlockPath, kind: BlockKind) => void;
  /** When provided, a "Turn into" group is prepended with transforms for this block. */
  transformTarget?: { block: Block; path: BlockPath };
}

export function InsertCommand({
  sectionId,
  parentPath,
  atIndex,
  sectionKind,
  initialQuery = "",
  onQueryChange,
  onClose,
  onInserted,
  transformTarget,
}: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [aiOpen, setAiOpen] = useState(false);

  useEffect(() => {
    if (initialQuery !== query) setQuery(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const recent = useMemo<BlockKind[]>(
    () => getRecentBlocks().filter((k) => BLOCK_REGISTRY[k]).slice(0, 5),
    [],
  );
  const suggested = useMemo<BlockKind[]>(() => {
    if (!sectionKind) return [];
    const list = SUGGESTED[sectionKind] ?? [];
    const seen = new Set(recent);
    return list.filter((k) => BLOCK_REGISTRY[k] && !seen.has(k)).slice(0, 5);
  }, [sectionKind, recent]);

  const transforms = useMemo<BlockTransform[]>(
    () => (transformTarget ? getTransformsFor(transformTarget.block) : []),
    [transformTarget],
  );

  const insert = (kind: BlockKind) => {
    const newPath = blockActions.add(sectionId, parentPath, kind, atIndex);
    recordRecentBlock(kind);
    onInserted?.(newPath, kind);
    onClose();
  };

  const applyTransform = (t: BlockTransform) => {
    if (!transformTarget) return;
    blockActions.transform(sectionId, transformTarget.path, t.nextKind, t.patch ?? {});
    onClose();
  };


  return (
    <>
    <Command shouldFilter className="bg-transparent">
      <CommandInput
        placeholder="Search blocks…"
        value={query}
        onValueChange={(v) => {
          setQuery(v);
          onQueryChange?.(v);
        }}
        autoFocus
        className="h-9 text-[12.5px]"
      />
      <CommandList className="max-h-[380px]">
        <CommandEmpty className="py-6 text-center text-[12px] text-muted-foreground">
          No blocks match “{query}”.
        </CommandEmpty>

        {transforms.length > 0 && (
          <>
            <CommandGroup
              heading={
                <GroupHeading
                  icon={Wand2}
                  label={`Turn ${BLOCK_REGISTRY[transformTarget!.block.kind]?.label ?? "block"} into`}
                  color="var(--accent-interactive)"
                />
              }
            >
              {transforms.map((t) => (
                <TransformRow key={t.id} transform={t} onSelect={() => applyTransform(t)} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}


        <CommandGroup heading={<GroupHeading icon={Sparkles} label="AI" color="var(--accent-interactive)" />}>
          <CommandItem
            value="ai draft generate write blocks with ai"
            onSelect={() => {
              setAiOpen(true);
            }}
            className="gap-2.5 py-1.5"
          >
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-border"
              style={{
                background: `color-mix(in srgb, var(--accent-interactive) 12%, var(--s-card, var(--s2)))`,
                color: "var(--accent-interactive)",
              }}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[12.5px] font-medium text-foreground">
                Draft with AI{query.trim() ? `: “${query.trim()}”` : "…"}
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                Generate a small block tree from a prompt
              </span>
            </span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />


        {recent.length > 0 && (
          <>
            <CommandGroup heading={<GroupHeading icon={Clock} label="Recently used" />}>
              {recent.map((k) => (
                <BlockRow key={`r-${k}`} kind={k} onSelect={() => insert(k)} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {suggested.length > 0 && (
          <>
            <CommandGroup
              heading={
                <GroupHeading
                  icon={Sparkles}
                  label={`Suggested for ${sectionKind}`}
                />
              }
            >
              {suggested.map((k) => (
                <BlockRow key={`s-${k}`} kind={k} onSelect={() => insert(k)} />
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {BLOCK_GROUPS.map((g) => {
          const items = ALL_BLOCK_KINDS.filter((k) => BLOCK_REGISTRY[k]?.group === g);
          if (items.length === 0) return null;
          return (
            <CommandGroup
              key={g}
              heading={
                <GroupHeading icon={GROUP_ICON[g]} label={g} color={GROUP_ACCENT[g]} />
              }
            >
              {items.map((k) => (
                <BlockRow key={k} kind={k} onSelect={() => insert(k)} />
              ))}
            </CommandGroup>
          );
        })}
      </CommandList>

      <div className="border-t border-border">
        <button
          type="button"
          onClick={() => {
            onClose();
            openBlockLibrary(sectionId, parentPath, atIndex);
          }}
          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-[12px] font-medium text-foreground hover:bg-muted"
        >
          <span className="flex items-center gap-2">
            <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
            Browse all blocks
          </span>
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </Command>
    <AiDraftDialog
      open={aiOpen}
      onOpenChange={(o) => {
        setAiOpen(o);
        if (!o) onClose();
      }}
      sectionId={sectionId}
      parentPath={parentPath}
      atIndex={atIndex}
      sectionKind={sectionKind}
      onInserted={(p) => onInserted?.(p, "paragraph")}
    />
    </>
  );
}

function BlockRow({ kind, onSelect }: { kind: BlockKind; onSelect: () => void }) {
  const def = BLOCK_REGISTRY[kind];
  if (!def) return null;
  const Icon = def.icon;
  return (
    <CommandItem
      value={`${def.label} ${def.kind} ${def.description}`}
      onSelect={onSelect}
      className="group/row gap-2.5 py-1.5"
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-border"
        style={{
          background: `color-mix(in srgb, ${GROUP_ACCENT[def.group]} 10%, var(--s-card, var(--s2)))`,
          color: GROUP_ACCENT[def.group],
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-medium text-foreground">{def.label}</span>
        <span className="truncate text-[11px] text-muted-foreground">{def.description}</span>
      </span>
      <BlockPreviewTile kind={kind} group={def.group} />
    </CommandItem>
  );
}

function TransformRow({
  transform,
  onSelect,
}: {
  transform: BlockTransform;
  onSelect: () => void;
}) {
  const Icon = transform.icon;
  return (
    <CommandItem
      value={`turn into ${transform.label} ${transform.keywords ?? ""}`}
      onSelect={onSelect}
      className="gap-2.5 py-1.5"
    >
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] border border-border"
        style={{
          background: `color-mix(in srgb, var(--accent-interactive) 10%, var(--s-card, var(--s2)))`,
          color: "var(--accent-interactive)",
        }}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[12.5px] font-medium text-foreground">{transform.label}</span>
        {transform.hint && (
          <span className="truncate text-[11px] text-muted-foreground">{transform.hint}</span>
        )}
      </span>
    </CommandItem>
  );
}

function GroupHeading({
  icon: Icon,
  label,
  color,
}: {
  icon: LucideIcon;
  label: ReactNode;
  color?: string;
}) {
  return (
    <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
      <Icon className="h-3 w-3" style={color ? { color } : undefined} />
      {label}
    </span>
  );
}
