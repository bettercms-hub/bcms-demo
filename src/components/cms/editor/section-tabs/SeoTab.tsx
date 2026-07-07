/** SEO tab — anchor id, schema.org type, heading level, indexing. */
import { useState } from "react";
import type { Section, SectionSeo, SectionSchemaType } from "@/lib/cms/types";
import { sectionActions } from "@/lib/cms/store";
import {
  Field,
  Row,
  Section as Group,
  SelectInput,
  TextInput,
  ToggleField,
} from "./atoms";

const ANCHOR_RE = /^[a-z0-9-]+$/;

export function SeoTab({ section }: { section: Section }) {
  const seo = section.seo ?? {};
  const patch = (p: Partial<SectionSeo>) =>
    sectionActions.update(section.id, { seo: { ...seo, ...p } });

  const [anchor, setAnchor] = useState(seo.anchorId ?? "");
  const anchorInvalid = anchor.length > 0 && !ANCHOR_RE.test(anchor);

  const commitAnchor = (v: string) => {
    setAnchor(v);
    if (v.length === 0) patch({ anchorId: undefined });
    else if (ANCHOR_RE.test(v)) patch({ anchorId: v });
  };

  return (
    <div className="space-y-4">
      <Group
        title="Anchor & heading"
        description="In-page jump target and the section's heading level for outline / a11y."
      >
        <Row>
          <Field
            label="Anchor id"
            hint={
              anchorInvalid
                ? "Use lowercase letters, digits and hyphens only."
                : "Becomes the html id; reachable as #anchor-id."
            }
          >
            <TextInput
              value={anchor}
              onChange={commitAnchor}
              placeholder="pricing"
              invalid={anchorInvalid}
            />
          </Field>
          <Field label="Heading level" hint="Promote or demote the first heading.">
            <SelectInput
              value={seo.headingLevel ?? "h2"}
              onChange={(v) => patch({ headingLevel: v })}
              options={[
                { value: "h1", label: "H1 — page title" },
                { value: "h2", label: "H2 — section" },
                { value: "h3", label: "H3 — subsection" },
              ]}
            />
          </Field>
        </Row>
        <Field
          label="ARIA label"
          hint="Spoken name for assistive tech when the visible heading is not enough."
        >
          <TextInput
            value={seo.ariaLabel ?? ""}
            onChange={(v) => patch({ ariaLabel: v || undefined })}
            placeholder="Pricing plans"
          />
        </Field>
      </Group>

      <Group
        title="Structured data"
        description="Schema.org type emitted as JSON-LD on the public page."
      >
        <Field label="Schema type">
          <SelectInput<SectionSchemaType>
            value={seo.schemaType ?? ""}
            onChange={(v) => patch({ schemaType: v || undefined })}
            options={[
              { value: "", label: "None" },
              { value: "WebPageSection", label: "WebPageSection" },
              { value: "FAQPage", label: "FAQPage" },
              { value: "Product", label: "Product" },
              { value: "Article", label: "Article" },
              { value: "Organization", label: "Organization" },
              { value: "BreadcrumbList", label: "BreadcrumbList" },
            ]}
          />
        </Field>
      </Group>

      <Group title="Indexing" description="How crawlers treat this section.">
        <ToggleField
          label="Exclude from page SEO score"
          hint="Skip this section when auditing page content (e.g. legal footers, decorative bands)."
          checked={!!seo.excludeFromIndex}
          onChange={(v) => patch({ excludeFromIndex: v })}
        />
      </Group>

      <p className="px-1 text-[11px] text-muted-foreground">
        Page-level meta (title, description, OG image) lives in the page's SEO panel.
      </p>
    </div>
  );
}
