/** Style tab — theme, background (+ conditional overlay), typography, shape.
 * Which groups render is governed by the per-kind design-control allow-list,
 * so developers can trim the knobs a section exposes. */
import type { Section, SectionStyle } from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import { sectionDesignControls } from "@/lib/cms/section-schema";
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
  const allow = sectionDesignControls(section.kind);
  const patch = (p: Partial<SectionStyle>) =>
    sectionActions.update(section.id, { style: { ...style, ...p } });

  return (
    <div className="space-y-4">
      {allow.has("theme") && (
        <Group title="Theme" description="Flips this section (and everything in it) between light and dark.">
          <SegmentedField
            label="Theme"
            value={style.theme ?? "inherit"}
            onChange={(v) => patch({ theme: v })}
            options={[
              { value: "inherit", label: "Inherit" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Group>
      )}

      {allow.has("background") && (
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
          {allow.has("backgroundImage") && (
            <>
              <Field
                label="Background image URL"
                hint="Optional. Overlays the background color."
              >
                <TextInput
                  value={style.backgroundImage ?? ""}
                  onChange={(v) => patch({ backgroundImage: v })}
                  placeholder="https://…/image.jpg"
                />
              </Field>
              {/* Conditional prop: the scrim only exists once an image does. */}
              {style.backgroundImage && (
                <Field
                  label="Overlay opacity"
                  hint="Dark scrim over the image so text stays readable."
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={style.overlayOpacity ?? 0}
                      onChange={(e) => patch({ overlayOpacity: Number(e.target.value) })}
                      className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-[color:var(--color-border)] accent-[color:var(--primary)]"
                      aria-label="Overlay opacity"
                    />
                    <span className="w-10 text-right text-[12px] tabular-nums text-muted-foreground">
                      {style.overlayOpacity ?? 0}%
                    </span>
                  </div>
                </Field>
              )}
            </>
          )}
        </Group>
      )}

      {allow.has("typography") && (
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
      )}

      {allow.has("shape") && (
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
      )}
    </div>
  );
}
