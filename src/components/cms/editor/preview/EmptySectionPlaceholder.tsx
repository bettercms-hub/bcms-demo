/**
 * EmptySectionPlaceholder — rendered when a section has no blocks.
 *
 * Replaces the old "magical" behaviour where section renderers synthesised
 * navigation/hero/footer content from defaults. Now nothing appears in the
 * preview that the user can't see (and edit) in the content panel.
 */
import type { Section, SectionKind } from "@/lib/cms/types";
import { editorBus } from "@/lib/cms/editor-bus";
import { Plus } from "lucide-react";

interface Slot {
  label: string;
  /** tailwind size hints */
  className: string;
}

const SLOTS: Partial<Record<SectionKind, Slot[]>> = {
  navigation: [
    { label: "Logo", className: "h-7 w-24" },
    { label: "Links", className: "h-5 w-40" },
    { label: "Search", className: "h-7 w-7 rounded-full" },
    { label: "CTA", className: "h-8 w-24" },
  ],
  header: [
    { label: "Logo", className: "h-7 w-24" },
    { label: "Links", className: "h-5 w-40" },
    { label: "CTA", className: "h-8 w-24" },
  ],
  hero: [
    { label: "Eyebrow", className: "h-3 w-24" },
    { label: "Heading", className: "h-9 w-2/3" },
    { label: "Subheading", className: "h-4 w-3/4" },
    { label: "Buttons", className: "h-9 w-40" },
  ],
  features: [
    { label: "Heading", className: "h-7 w-1/2" },
    { label: "Cards", className: "h-24 w-full" },
  ],
  cta: [
    { label: "Heading", className: "h-7 w-1/2" },
    { label: "Button", className: "h-9 w-32" },
  ],
  footer: [
    { label: "Tagline", className: "h-4 w-1/2" },
    { label: "Links", className: "h-4 w-2/3" },
    { label: "Copyright", className: "h-3 w-32" },
  ],
};

const DEFAULT_SLOTS: Slot[] = [
  { label: "Heading", className: "h-7 w-1/2" },
  { label: "Body", className: "h-4 w-3/4" },
];

export function EmptySectionPlaceholder({ section }: { section: Section }) {
  const slots = SLOTS[section.kind] ?? DEFAULT_SLOTS;
  const isHorizontal = section.kind === "navigation" || section.kind === "header" || section.kind === "footer";

  return (
    <div className="w-full">
      <div
        className={
          "flex w-full " +
          (isHorizontal ? "flex-row items-center gap-4" : "flex-col gap-3")
        }
      >
        {slots.map((s) => (
          <div
            key={s.label}
            title={`${s.label} placeholder`}
            className={`${s.className} rounded-[6px] border border-dashed border-border bg-surface/60 transition-colors hover:bg-surface`}
          />
        ))}
      </div>
      <div className={"mt-4 flex w-full items-center justify-between gap-3 " + (isHorizontal ? "" : "")}>
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {section.name || section.kind} · no blocks yet
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            editorBus.emit({ type: "editor:open-block-library", sectionId: section.id });
          }}
          className="inline-flex h-7 items-center gap-1 rounded-[6px] border border-border bg-white px-2.5 text-[12px] font-medium text-foreground transition-colors hover:border-border-strong"
        >
          <Plus className="h-3.5 w-3.5" />
          Add block
        </button>
      </div>
    </div>
  );
}
