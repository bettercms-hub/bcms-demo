/** Style tab — background, typography, radius, shadow, borders. */
import type { Section, SectionStyle } from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import {
  Field,
  Row,
  Section as Group,
  SegmentedField,
  TextInput,
  ToggleField,
} from "./atoms";

export function StyleTab({ section }: { section: Section }) {
  const style = section.style ?? {};
  const patch = (p: Partial<SectionStyle>) =>
    sectionActions.update(section.id, { style: { ...style, ...p } });

  return (
    <div className="space-y-4">
      <Group title="Background" description="Surface this section sits on.">
        <SegmentedField
          label="Background"
          value={style.background ?? "transparent"}
          onChange={(v) => patch({ background: v })}
          options={[
            { value: "transparent", label: "None" },
            { value: "surface", label: "Surface" },
            { value: "muted", label: "Muted" },
            { value: "accent", label: "Accent" },
            { value: "inverse", label: "Inverse" },
            { value: "custom", label: "Custom" },
          ]}
        />
        {style.background === "custom" && (
          <Row>
            <Field label="Custom color">
              <input
                type="color"
                value={style.backgroundColor ?? "#ffffff"}
                onChange={(e) => patch({ backgroundColor: e.target.value })}
                className="h-9 w-full cursor-pointer rounded-md border border-border bg-background"
              />
            </Field>
            <Field label="Hex / CSS color">
              <TextInput
                value={style.backgroundColor ?? ""}
                onChange={(v) => patch({ backgroundColor: v })}
                placeholder="#ffffff"
              />
            </Field>
          </Row>
        )}
        <Field
          label="Background image URL"
          hint="Optional — overlays the background colour."
        >
          <TextInput
            value={style.backgroundImage ?? ""}
            onChange={(v) => patch({ backgroundImage: v })}
            placeholder="https://…/image.jpg"
          />
        </Field>
      </Group>

      <Group title="Typography" description="Text tone and scale for this section only.">
        <Row>
          <SegmentedField
            label="Text tone"
            value={style.textTone ?? "default"}
            onChange={(v) => patch({ textTone: v })}
            options={[
              { value: "default", label: "Default" },
              { value: "muted", label: "Muted" },
              { value: "inverse", label: "Inverse" },
            ]}
          />
          <SegmentedField
            label="Font scale"
            value={style.fontScale ?? "md"}
            onChange={(v) => patch({ fontScale: v })}
            options={[
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
            ]}
          />
        </Row>
      </Group>

      <Group title="Shape" description="Corner radius, shadow and dividers.">
        <Row>
          <SegmentedField
            label="Radius"
            value={style.radius ?? "none"}
            onChange={(v) => patch({ radius: v })}
            options={[
              { value: "none", label: "0" },
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
              { value: "xl", label: "XL" },
            ]}
          />
          <SegmentedField
            label="Shadow"
            value={style.shadow ?? "none"}
            onChange={(v) => patch({ shadow: v })}
            options={[
              { value: "none", label: "0" },
              { value: "sm", label: "S" },
              { value: "md", label: "M" },
              { value: "lg", label: "L" },
            ]}
          />
        </Row>
        <Row>
          <ToggleField
            label="Border top"
            checked={!!style.borderTop}
            onChange={(v) => patch({ borderTop: v })}
          />
          <ToggleField
            label="Border bottom"
            checked={!!style.borderBottom}
            onChange={(v) => patch({ borderBottom: v })}
          />
        </Row>
      </Group>
    </div>
  );
}
