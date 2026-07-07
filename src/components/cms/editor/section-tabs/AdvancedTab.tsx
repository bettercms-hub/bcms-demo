/** Advanced tab — expert controls: HTML tag, visibility, custom classes/ids,
 * data-attributes, scoped CSS, dev notes. */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type {
  Section,
  SectionAdvanced,
  SectionCustomAttribute,
  SectionHtmlTag,
  SectionVisibilityAuth,
  SectionVisibilityDevice,
} from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import {
  Field,
  Row,
  Section as Group,
  SegmentedField,
  SelectInput,
  TextInput,
  ToggleField,
} from "./atoms";

const ID_RE = /^[A-Za-z][A-Za-z0-9_-]*$/;
const CLASS_RE = /^[A-Za-z0-9 _\-:/\[\]().%!]*$/;

export function AdvancedTab({ section }: { section: Section }) {
  const adv = section.advanced ?? {};
  const patch = (p: Partial<SectionAdvanced>) =>
    sectionActions.update(section.id, { advanced: { ...adv, ...p } });

  return (
    <div className="space-y-4">
      <Group
        title="DOM"
        description="Override the wrapper element, id and utility classes."
      >
        <Row>
          <Field label="HTML tag" hint="Semantic element used for the section wrapper.">
            <SelectInput<SectionHtmlTag>
              value={adv.htmlTag ?? "section"}
              onChange={(v) => patch({ htmlTag: v })}
              options={[
                { value: "section", label: "<section>" },
                { value: "div", label: "<div>" },
                { value: "article", label: "<article>" },
                { value: "aside", label: "<aside>" },
                { value: "header", label: "<header>" },
                { value: "footer", label: "<footer>" },
                { value: "main", label: "<main>" },
                { value: "nav", label: "<nav>" },
              ]}
            />
          </Field>
          <Field
            label="z-index"
            hint="Stacking order for overlapping sections."
          >
            <TextInput
              value={adv.zIndex == null ? "" : String(adv.zIndex)}
              onChange={(v) => {
                const n = v.trim() === "" ? undefined : Number(v);
                patch({ zIndex: Number.isFinite(n as number) ? (n as number) : undefined });
              }}
              placeholder="auto"
            />
          </Field>
        </Row>

        <CustomIdField
          value={adv.customId ?? ""}
          onChange={(v) => patch({ customId: v || undefined })}
        />

        <CustomClassField
          value={adv.customClassName ?? ""}
          onChange={(v) => patch({ customClassName: v || undefined })}
        />
      </Group>

      <Group
        title="Visibility"
        description="Conditionally render this section on the published page."
      >
        <ToggleField
          label="Hide on public site"
          hint="Section stays in the editor but is not rendered when published."
          checked={!!adv.hidden}
          onChange={(v) => patch({ hidden: v })}
        />
        <Row>
          <SegmentedField<SectionVisibilityDevice>
            label="Device"
            value={adv.visibility?.device ?? "all"}
            onChange={(v) =>
              patch({ visibility: { ...(adv.visibility ?? {}), device: v } })
            }
            options={[
              { value: "all", label: "All" },
              { value: "mobile", label: "Mobile" },
              { value: "tablet", label: "Tablet" },
              { value: "desktop", label: "Desktop" },
            ]}
          />
          <Field label="Auth state" hint="Show only to signed-in or guest visitors.">
            <SelectInput<SectionVisibilityAuth>
              value={adv.visibility?.authState ?? "any"}
              onChange={(v) =>
                patch({ visibility: { ...(adv.visibility ?? {}), authState: v } })
              }
              options={[
                { value: "any", label: "Anyone" },
                { value: "authenticated", label: "Authenticated" },
                { value: "guest", label: "Guest only" },
              ]}
            />
          </Field>
        </Row>
      </Group>

      <Group
        title="Custom attributes"
        description="Extra data-* / aria-* / role attributes attached to the wrapper."
      >
        <AttributeEditor
          value={adv.customAttributes ?? []}
          onChange={(v) => patch({ customAttributes: v.length ? v : undefined })}
        />
      </Group>

      <Group
        title="Scoped CSS"
        description="Selectors are auto-prefixed with the section id. Use & to refer to the wrapper."
      >
        <Field
          label="Custom CSS"
          hint={
            adv.customId || section.seo?.anchorId
              ? `Scoped to #${adv.customId || section.seo?.anchorId}.`
              : "Set a custom id or SEO anchor for the rules to take effect."
          }
        >
          <textarea
            value={adv.customCss ?? ""}
            onChange={(e) => patch({ customCss: e.target.value || undefined })}
            placeholder={`& { background: linear-gradient(...); }\n.card { box-shadow: var(--shadow-lg); }`}
            rows={6}
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 font-mono text-[12px] outline-none focus:ring-2 focus:ring-primary/30"
            spellCheck={false}
          />
        </Field>
      </Group>

      <Group title="Developer notes" description="Internal — never rendered publicly.">
        <Field label="Notes">
          <textarea
            value={adv.notes ?? ""}
            onChange={(e) => patch({ notes: e.target.value || undefined })}
            placeholder="A/B test variant, owner, ticket link…"
            rows={3}
            className="w-full rounded-md border border-border bg-background px-2.5 py-2 text-[12.5px] outline-none focus:ring-2 focus:ring-primary/30"
          />
        </Field>
      </Group>
    </div>
  );
}

function CustomIdField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const invalid = local.length > 0 && !ID_RE.test(local);
  return (
    <Field
      label="Custom id"
      hint={
        invalid
          ? "Must start with a letter; letters, digits, hyphen and underscore only."
          : "Overrides the SEO anchor id when set."
      }
    >
      <TextInput
        value={local}
        onChange={(v) => {
          setLocal(v);
          if (v.length === 0) onChange("");
          else if (ID_RE.test(v)) onChange(v);
        }}
        placeholder="hero-banner"
        invalid={invalid}
      />
    </Field>
  );
}

function CustomClassField({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [local, setLocal] = useState(value);
  const invalid = local.length > 0 && !CLASS_RE.test(local);
  return (
    <Field
      label="Custom classes"
      hint={
        invalid
          ? "Disallowed characters."
          : "Appended to the wrapper. Space-separated utility classes."
      }
    >
      <TextInput
        value={local}
        onChange={(v) => {
          setLocal(v);
          if (!invalid || v.length === 0) onChange(v);
        }}
        placeholder="relative overflow-hidden"
        invalid={invalid}
      />
    </Field>
  );
}

function AttributeEditor({
  value,
  onChange,
}: {
  value: SectionCustomAttribute[];
  onChange: (v: SectionCustomAttribute[]) => void;
}) {
  const update = (i: number, patch: Partial<SectionCustomAttribute>) => {
    onChange(value.map((a, idx) => (idx === i ? { ...a, ...patch } : a)));
  };
  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));
  const add = () => onChange([...value, { name: "", value: "" }]);

  return (
    <div className="space-y-2">
      {value.length === 0 && (
        <div className="rounded-md border border-dashed border-border bg-background/40 px-3 py-4 text-center text-[11.5px] text-muted-foreground">
          No custom attributes.
        </div>
      )}
      {value.map((attr, i) => (
        <div key={i} className="grid grid-cols-[1fr_1.5fr_auto] items-center gap-2">
          <TextInput
            value={attr.name}
            onChange={(v) => update(i, { name: v })}
            placeholder="data-track"
          />
          <TextInput
            value={attr.value}
            onChange={(v) => update(i, { value: v })}
            placeholder="hero-cta"
          />
          <button
            type="button"
            onClick={() => remove(i)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-surface hover:text-foreground"
            aria-label="Remove attribute"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-[12px] font-medium text-foreground hover:bg-surface"
      >
        <Plus className="h-3.5 w-3.5" /> Add attribute
      </button>
    </div>
  );
}
