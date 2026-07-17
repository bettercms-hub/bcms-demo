/**
 * GenericSection — deterministic renderer for hub-created components.
 *
 * Fields are typed (text, long text, image, number, link, slot) and render
 * from role, with the project's brand kit coloring the accents. Slots embed
 * another component from the library, one level deep, never recursive. No
 * user-authored code executes here; production rendering ships from the repo.
 */
import type { ReactNode } from "react";
import { getSectionDef, InlineText, type RenderProps } from "@/components/cms/editor/sections/SectionSystem";
import { getBrandKit } from "@/lib/brand/brand-store";
import type { CustomComponent, CustomField } from "@/lib/cms/components-store";
import { cn } from "@/lib/utils";

type Role = "eyebrow" | "heading" | "body" | "item" | "cta" | "meta";

function roleOf(f: CustomField): Role {
  const k = f.key.toLowerCase();
  if (/eyebrow|badge|kicker|attribution/.test(k)) return "eyebrow";
  if (/headline|heading|title/.test(k)) return "heading";
  if (f.type === "number" || /^item|feature|stat|step|question|person|logo/.test(k)) return "item";
  if (f.type === "link" || /cta|button|link/.test(k)) return "cta";
  if (f.type === "longtext" || /body|sub|desc|intro|quote|text/.test(k)) return "body";
  return "meta";
}

function Txt({ p, k, as, className, multiline }: { p: RenderProps; k: string; as?: "span" | "h2" | "p" | "div"; className?: string; multiline?: boolean }) {
  return (
    <InlineText
      value={p.c[k] ?? ""}
      onCommit={(v: string) => p.onEdit(k, v)}
      as={as ?? "span"}
      className={className}
      editable={p.editable}
      multiline={multiline}
    />
  );
}

/** One level only: a slot never renders the slots of what it embeds. */
let slotDepth = 0;

export function GenericSection({ component, p }: { component: CustomComponent; p: RenderProps }): ReactNode {
  const brand = getBrandKit(component.projectId);
  const primary = brand?.colors?.primary || "#4f46e5";
  const centered = p.variant !== "left";

  const by = (r: Role) => component.fields.filter((f) => roleOf(f) === r && f.type !== "image" && f.type !== "slot");
  const images = component.fields.filter((f) => f.type === "image");
  const slots = component.fields.filter((f) => f.type === "slot");
  const eyebrows = by("eyebrow");
  const headings = by("heading");
  const bodies = by("body");
  const items = by("item");
  const ctas = by("cta");
  const metas = by("meta");
  const numbered = items.every((f) => f.type !== "number");

  const textCol = (
    <div className={cn(!centered && "text-left")}>
      {eyebrows.map((f) => (
        <span key={f.key} className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ backgroundColor: `${primary}14`, color: primary }}>
          <Txt p={p} k={f.key} />
        </span>
      ))}
      {headings.map((f) => (
        <Txt key={f.key} p={p} k={f.key} as="h2" multiline className={cn("mt-3 block max-w-2xl text-[24px] font-bold leading-[1.15] tracking-tight text-slate-900", centered && !images.length && "mx-auto")} />
      ))}
      {bodies.map((f) => (
        <Txt key={f.key} p={p} k={f.key} as="p" multiline className={cn("mt-3 block max-w-xl text-[13.5px] leading-relaxed text-slate-500", centered && !images.length && "mx-auto")} />
      ))}
      {ctas.length > 0 && (
        <div className={cn("mt-6 flex items-center gap-3", centered && !images.length && "justify-center")}>
          {ctas.map((f, i) => (
            <span key={f.key} className={cn("rounded-lg px-4 py-2 text-[13px] font-semibold", i > 0 && "border border-slate-200 text-slate-700")} style={i === 0 ? { backgroundColor: primary, color: "#fff" } : undefined}>
              <Txt p={p} k={f.key} />
            </span>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className={cn("px-8 py-10", centered && "text-center")}>
      {images.length > 0 ? (
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-2">
          {textCol}
          {images.map((f) => (
            <div key={f.key} className="relative h-48 overflow-hidden rounded-xl ring-1 ring-slate-200" style={{ background: `linear-gradient(135deg, ${primary}22, #ffffff 45%, ${primary}11)` }}>
              <span className="absolute bottom-2 right-2 rounded-md bg-white/85 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                {p.c[f.key] ? `Image · ${p.c[f.key]}` : "Image"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        textCol
      )}

      {items.length > 0 && (
        <div className={cn("mt-6 grid gap-4", items.length >= 3 ? "grid-cols-1 sm:grid-cols-3" : items.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1")}>
          {items.map((f, i) => (
            <div key={f.key} className={cn("rounded-xl border border-slate-100 bg-slate-50/60 p-4", !centered && "text-left")}>
              {f.type === "number" ? (
                <Txt p={p} k={f.key} as="div" className="block text-[20px] font-bold tracking-tight" />
              ) : (
                <>
                  {numbered && (
                    <div className="grid h-7 w-7 place-items-center rounded-lg text-[12px] font-bold text-white" style={{ backgroundColor: primary, marginInline: centered ? "auto" : undefined }}>
                      {i + 1}
                    </div>
                  )}
                  <Txt p={p} k={f.key} as="div" multiline className="mt-3 block text-[13px] font-medium leading-relaxed text-slate-800" />
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {slots.map((f) => (
        <SlotArea key={f.key} field={f} target={p.c[f.key]} />
      ))}

      {metas.map((f) => (
        <div key={f.key} className="mt-4 text-[12px] text-slate-400">
          <Txt p={p} k={f.key} />
        </div>
      ))}
    </div>
  );
}

function SlotArea({ field, target }: { field: CustomField; target?: string }) {
  const def = target && slotDepth === 0 ? getSectionDef(target) : undefined;
  let inner: ReactNode = null;
  if (def) {
    slotDepth++;
    try {
      inner = def.render({
        c: def.defaults,
        variant: def.variants[0]?.id ?? "default",
        editable: false,
        onEdit: () => {},
        fid: () => undefined,
        label: () => undefined,
      });
    } finally {
      slotDepth--;
    }
  }
  return (
    <div className="mt-6 rounded-xl border-2 border-dashed border-slate-200">
      <div className="flex items-center gap-2 px-3 pt-2 text-left">
        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[9.5px] font-bold uppercase tracking-wide text-slate-500">Slot</span>
        <span className="text-[10.5px] text-slate-400">
          {field.label}
          {def ? ` · ${def.name}` : " · empty"}
        </span>
      </div>
      {inner ? <div className="pointer-events-none scale-[0.92] opacity-90">{inner}</div> : <div className="px-3 pb-4 pt-2 text-[11.5px] text-slate-400">Choose a component to fill this slot.</div>}
    </div>
  );
}
