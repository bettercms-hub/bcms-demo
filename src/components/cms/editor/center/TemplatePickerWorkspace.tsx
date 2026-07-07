/**
 * Template Picker — center workspace sub-mode.
 * Replaces the legacy SectionTemplatePicker modal. Triggered by the
 * section-card "Templates" button via `centerBus`.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Monitor, Smartphone, Tablet } from "lucide-react";
import { useCMS, blockActions } from "@/lib/cms/store";
import { centerBus } from "@/lib/cms/center-bus";
import {
  SECTION_TEMPLATES,
  TEMPLATE_SECTION_KINDS,
  type SectionTemplate,
  type TemplateSectionKind,
} from "@/lib/cms/blocks/templates";
import { BlockTree } from "../preview/blocks/index";
import type { SectionKind } from "@/lib/cms/types";

interface Props {
  sectionId: string;
  onClose: () => void;
}

type Device = "desktop" | "tablet" | "mobile";
type Mode = "replace" | "append";

const DEVICE_WIDTH: Record<Device, number | undefined> = {
  desktop: undefined,
  tablet: 768,
  mobile: 390,
};

export function TemplatePickerWorkspace({ sectionId, onClose }: Props) {
  const section = useCMS((s) => s.sections.find((x) => x.id === sectionId));
  const existingCount = section?.blocks?.length ?? 0;

  const isTemplateKind = (k: SectionKind | undefined): k is TemplateSectionKind =>
    !!k && (TEMPLATE_SECTION_KINDS as readonly string[]).includes(k);
  const activeKind: TemplateSectionKind = isTemplateKind(section?.kind) ? section!.kind : "hero";

  const templates = useMemo(
    () => SECTION_TEMPLATES.filter((t) => t.sectionKind === activeKind),
    [activeKind],
  );

  const [selected, setSelected] = useState<SectionTemplate | null>(templates[0] ?? null);
  const [device, setDevice] = useState<Device>("desktop");
  const [mode, setMode] = useState<Mode>(existingCount === 0 ? "replace" : "append");

  useEffect(() => {
    if (!selected || selected.sectionKind !== activeKind) {
      setSelected(templates[0] ?? null);
    }
  }, [activeKind, templates, selected]);

  const previewBlocks = useMemo(() => selected?.build() ?? [], [selected]);

  const insert = () => {
    if (!selected) return;
    const blocks = selected.build();
    if (mode === "replace") blockActions.setAll(sectionId, blocks);
    else blockActions.appendAll(sectionId, blocks);
    onClose();
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-7 items-center gap-1.5 rounded-[6px] px-2 text-[12px] text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to editor
        </button>
        <div className="text-[13px] font-semibold">Insert template</div>
        <span className="rounded border border-border px-1.5 py-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">
          {activeKind}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className="w-72 shrink-0 overflow-y-auto border-r border-border bg-surface/40 p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            Templates
          </div>
          <div className="flex flex-col gap-1.5">
            {templates.length === 0 ? (
              <div className="px-2 py-6 text-[12px] text-muted-foreground">
                No templates available for this section kind.
              </div>
            ) : (
              templates.map((t) => {
                const active = selected?.id === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setSelected(t)}
                    className={`flex flex-col items-start gap-1 rounded-[8px] border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-background"
                        : "border-border bg-background hover:border-border-strong"
                    }`}
                  >
                    <div className="text-[13px] font-medium">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground">{t.description}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <div className="flex items-center gap-1">
              {(["desktop", "tablet", "mobile"] as const).map((d) => {
                const Icon = d === "desktop" ? Monitor : d === "tablet" ? Tablet : Smartphone;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDevice(d)}
                    className={`grid h-7 w-7 place-items-center rounded-[6px] ${
                      device === d ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                    aria-label={d}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  type="radio"
                  name="tpl-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                Replace
                {existingCount > 0 && (
                  <span className="text-muted-foreground">({existingCount})</span>
                )}
              </label>
              <label className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
                <input
                  type="radio"
                  name="tpl-mode"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                />
                Append
              </label>
            </div>
          </div>

          <div className="flex-1 overflow-auto bg-[color:var(--color-row-hover)]/30 p-6">
            <div
              className="mx-auto rounded-[8px] border border-border bg-background shadow-sm"
              style={{ maxWidth: DEVICE_WIDTH[device] }}
            >
              <div className="flex flex-col gap-4 p-6">
                {previewBlocks.length === 0 ? (
                  <div className="py-10 text-center text-[12px] text-muted-foreground">
                    Select a template to preview.
                  </div>
                ) : (
                  <BlockTree blocks={previewBlocks} />
                )}
              </div>
            </div>
          </div>

          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-t border-border px-4">
            <div className="text-[11px] text-muted-foreground">
              {mode === "replace"
                ? existingCount > 0
                  ? `Replaces ${existingCount} existing block${existingCount === 1 ? "" : "s"}.`
                  : "Inserts blocks into an empty section."
                : `Appends after ${existingCount} existing block${existingCount === 1 ? "" : "s"}.`}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded-[6px] border border-border bg-background px-3 text-[12px] hover:border-border-strong"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={insert}
                disabled={!selected}
                className="h-8 rounded-[6px] bg-primary px-3 text-[12px] font-medium text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                Insert template
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function openTemplatePicker(sectionId: string) {
  centerBus.emit({ type: "center:open", mode: "template-picker", targetSectionId: sectionId });
}
