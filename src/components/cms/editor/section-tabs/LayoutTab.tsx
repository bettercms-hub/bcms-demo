/** Layout tab — width, alignment, spacing, gap, columns. */
import type { Section, SectionLayout, SectionKind } from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import { Field, Row, Section as Group, SegmentedField, SelectInput } from "./atoms";

const GRID_KINDS: SectionKind[] = [
  "features", "pricing", "logos", "integrations", "blog", "docs", "testimonials",
];

export function LayoutTab({ section }: { section: Section }) {
  const layout = section.layout ?? {};
  const patch = (p: Partial<SectionLayout>) =>
    sectionActions.update(section.id, { layout: { ...layout, ...p } });

  const supportsColumns = GRID_KINDS.includes(section.kind);

  return (
    <div className="space-y-4">
      <Group
        title="Container"
        description="Controls the overall canvas this section paints on."
      >
        <Row>
          <SegmentedField
            label="Width"
            value={layout.width ?? "default"}
            onChange={(v) => patch({ width: v })}
            options={[
              { value: "narrow", label: "Narrow" },
              { value: "default", label: "Default" },
              { value: "wide", label: "Wide" },
              { value: "full", label: "Full" },
            ]}
          />
          <SegmentedField
            label="Alignment"
            value={layout.align ?? "center"}
            onChange={(v) => patch({ align: v })}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
              { value: "right", label: "Right" },
            ]}
          />
        </Row>
      </Group>

      <Group title="Spacing" description="Inner padding and gap between blocks.">
        <Row>
          <SegmentedField
            label="Vertical padding"
            value={layout.paddingY ?? "md"}
            onChange={(v) => patch({ paddingY: v })}
            options={[
              { value: "none", label: "0" },
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
              { value: "xl", label: "XL" },
            ]}
          />
          <SegmentedField
            label="Horizontal padding"
            value={layout.paddingX ?? "md"}
            onChange={(v) => patch({ paddingX: v })}
            options={[
              { value: "none", label: "0" },
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
            ]}
          />
        </Row>
        <SegmentedField
          label="Block gap"
          value={layout.gap ?? "md"}
          onChange={(v) => patch({ gap: v })}
          options={[
            { value: "none", label: "0" },
            { value: "sm", label: "S" },
            { value: "md", label: "M" },
            { value: "lg", label: "L" },
          ]}
        />
      </Group>

      {supportsColumns && (
        <Group title="Grid" description="Column count for grid-based sections.">
          <Field label="Columns">
            <SelectInput
              value={String(layout.columns ?? 3) as "1" | "2" | "3" | "4"}
              onChange={(v) => patch({ columns: Number(v) as 1 | 2 | 3 | 4 })}
              options={[
                { value: "1", label: "1 column" },
                { value: "2", label: "2 columns" },
                { value: "3", label: "3 columns" },
                { value: "4", label: "4 columns" },
              ]}
            />
          </Field>
        </Group>
      )}
    </div>
  );
}
