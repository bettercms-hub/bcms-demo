import type { Section } from "@/lib/cms/types";
import { useCMS } from "@/lib/cms/store";
import { resolveBoundProps } from "@/lib/cms/bindings";
import { BlockTree } from "./blocks";

/**
 * Render a section that is bound to a Component master.
 * Reuses the master's `rootBlocks` and merges instance overrides.
 */
export function BoundSectionPreview({ section }: { section: Section }) {
  const master = useCMS((s) =>
    section.componentId ? s.components.find((c) => c.id === section.componentId) : undefined,
  );
  const schema = useCMS((s) =>
    master?.schemaId ? s.schemas.find((sc) => sc.id === master.schemaId) : undefined,
  );
  if (!master) {
    return (
      <div className="grid place-items-center border border-dashed border-border bg-surface px-6 py-10 text-[12px] text-muted-foreground">
        Bound component is missing.
      </div>
    );
  }
  const resolved = resolveBoundProps(master.rootBlocks, section.overrides, schema);
  if (resolved.length === 0) {
    return (
      <section className="border-y border-border bg-surface px-6 py-8 text-center text-[12px] text-muted-foreground">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em]">
          Bound · {master.name}
        </div>
        Component has no default blocks yet.
      </section>
    );
  }
  return (
    <section className="bg-white px-6 py-10">
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <BlockTree blocks={resolved} />
      </div>
    </section>
  );
}
