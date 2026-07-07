import { useCMS } from "@/lib/cms/store";

export function ComponentPreview({ componentId }: { componentId: string }) {
  const component = useCMS((s) => s.components.find((c) => c.id === componentId));
  if (!component) return null;
  const states = component.states ?? ["default"];
  const variants = component.variantIds.length > 0 ? component.variantIds : ["__base__"];
  return (
    <div className="mx-auto max-w-4xl bg-white p-10">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Master component</div>
        <h1 className="text-2xl font-semibold tracking-tight">{component.name}</h1>
      </div>
      <div className="space-y-6">
        {variants.map((v, i) => (
          <div key={v} className="rounded-[8px] border border-border bg-surface p-4">
            <div className="mb-3 text-[11px] uppercase tracking-wider text-muted-foreground">Variant {i + 1}</div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {states.map((s) => (
                <div key={s} className="rounded-[6px] border border-border bg-white p-4 text-center">
                  <div className="mx-auto h-9 w-24 rounded-[6px] bg-primary text-primary-foreground" />
                  <div className="mt-2 text-[11px] uppercase tracking-wider text-muted-foreground">{s}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
