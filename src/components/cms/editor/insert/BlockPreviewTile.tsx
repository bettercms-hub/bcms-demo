/**
 * BlockPreviewTile — tiny CSS skeleton hinting at a block's visual shape,
 * shown on the right of each row in the insert palette. Falls back to a
 * category-colored placeholder for kinds without a custom skeleton.
 */
import type { BlockKind, BlockGroup } from "@/lib/cms/blocks/registry";

const GROUP_ACCENT: Record<BlockGroup, string> = {
  Content: "var(--accent-content)",
  Media: "var(--accent-media)",
  Layout: "var(--accent-layout)",
  Interactive: "var(--accent-interactive)",
  Action: "var(--accent-action)",
  Advanced: "var(--accent-advanced)",
};

const BAR = "rounded-[2px] bg-foreground/25";
const SOFT = "rounded-[2px] bg-foreground/12";

function Skeleton({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full flex-col justify-center gap-1 px-1.5 py-1">
      {children}
    </div>
  );
}

const SKELETONS: Partial<Record<BlockKind, React.ReactNode>> = {
  heading: (
    <Skeleton>
      <div className={`${BAR} h-2 w-3/4`} />
      <div className={`${SOFT} h-1.5 w-1/2`} />
    </Skeleton>
  ),
  paragraph: (
    <Skeleton>
      <div className={`${SOFT} h-1.5 w-full`} />
      <div className={`${SOFT} h-1.5 w-5/6`} />
      <div className={`${SOFT} h-1.5 w-3/4`} />
    </Skeleton>
  ),
  richText: (
    <Skeleton>
      <div className={`${BAR} h-1.5 w-2/3`} />
      <div className={`${SOFT} h-1.5 w-full`} />
      <div className={`${SOFT} h-1.5 w-4/5`} />
    </Skeleton>
  ),
  quote: (
    <Skeleton>
      <div className="flex items-start gap-1">
        <div className={`${BAR} h-4 w-0.5`} />
        <div className="flex flex-col gap-1">
          <div className={`${SOFT} h-1.5 w-12`} />
          <div className={`${SOFT} h-1.5 w-10`} />
        </div>
      </div>
    </Skeleton>
  ),
  list: (
    <Skeleton>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1">
          <div className="h-1 w-1 rounded-full bg-foreground/30" />
          <div className={`${SOFT} h-1.5 ${i === 0 ? "w-3/4" : i === 1 ? "w-2/3" : "w-1/2"}`} />
        </div>
      ))}
    </Skeleton>
  ),
  code: (
    <div className="flex h-full w-full items-center justify-center rounded-[3px] bg-foreground/10 font-mono text-[8px] text-foreground/60">
      {"</>"}
    </div>
  ),
  image: (
    <div className="flex h-full w-full items-center justify-center rounded-[3px] bg-foreground/10">
      <svg viewBox="0 0 24 24" className="h-3 w-3 text-foreground/40" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="1.5" />
        <path d="M21 17l-5-5-8 8" />
      </svg>
    </div>
  ),
  video: (
    <div className="flex h-full w-full items-center justify-center rounded-[3px] bg-foreground/10">
      <div className="h-0 w-0 border-y-[4px] border-l-[6px] border-y-transparent border-l-foreground/50" />
    </div>
  ),
  button: (
    <div className="flex h-full w-full items-center justify-center">
      <div className="rounded-[3px] bg-foreground/70 px-2 py-1 text-[7px] font-medium text-background">Button</div>
    </div>
  ),
  "cta-group": (
    <div className="flex h-full w-full items-center justify-center gap-1">
      <div className="rounded-[3px] bg-foreground/70 px-1.5 py-0.5 text-[7px] text-background">A</div>
      <div className="rounded-[3px] border border-foreground/40 px-1.5 py-0.5 text-[7px] text-foreground/70">B</div>
    </div>
  ),
  container: (
    <div className="flex h-full w-full items-center justify-center p-1">
      <div className="h-full w-full rounded-[3px] border border-dashed border-foreground/30" />
    </div>
  ),
  stack: (
    <Skeleton>
      <div className={`${SOFT} h-1.5 w-full`} />
      <div className={`${SOFT} h-1.5 w-full`} />
      <div className={`${SOFT} h-1.5 w-full`} />
    </Skeleton>
  ),
  grid: (
    <div className="grid h-full w-full grid-cols-3 gap-1 p-1">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className={SOFT} />
      ))}
    </div>
  ),
  columns: (
    <div className="grid h-full w-full grid-cols-2 gap-1 p-1">
      <div className={SOFT} />
      <div className={SOFT} />
    </div>
  ),
  "card-group": (
    <div className="grid h-full w-full grid-cols-3 gap-1 p-1">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-[3px] border border-foreground/20" />
      ))}
    </div>
  ),
  card: (
    <div className="flex h-full w-full items-center justify-center p-1">
      <div className="h-full w-full rounded-[3px] border border-foreground/20" />
    </div>
  ),
};

interface Props {
  kind: BlockKind;
  group: BlockGroup;
}

export function BlockPreviewTile({ kind, group }: Props) {
  const node = SKELETONS[kind];
  return (
    <div
      aria-hidden
      className="hidden h-9 w-14 shrink-0 overflow-hidden rounded-[4px] border border-border/70 md:block"
      style={{
        background: `color-mix(in srgb, ${GROUP_ACCENT[group]} 6%, var(--s-card, var(--s2)))`,
      }}
    >
      {node ?? (
        <div className="flex h-full w-full items-center justify-center">
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: GROUP_ACCENT[group] }}
          />
        </div>
      )}
    </div>
  );
}
