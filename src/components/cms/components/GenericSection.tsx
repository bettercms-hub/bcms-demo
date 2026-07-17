/**
 * GenericSection — deterministic renderer for hub-created components.
 *
 * Custom components never ship user-authored code; they render from field
 * roles (eyebrow, heading, body, items, CTA) with the project's brand kit
 * coloring the accents. In production the generated stub in the repo takes
 * over; this keeps canvas, previews and the library honest in the meantime.
 */
import type { ReactNode } from "react";
import { InlineText, type RenderProps } from "@/components/cms/editor/sections/SectionSystem";
import { getBrandKit } from "@/lib/brand/brand-store";
import type { CustomComponent } from "@/lib/cms/components-store";
import { cn } from "@/lib/utils";

type Role = "eyebrow" | "heading" | "body" | "item" | "cta" | "meta";

function roleOf(key: string, multiline?: boolean): Role {
  const k = key.toLowerCase();
  if (/eyebrow|badge|kicker|attribution/.test(k)) return "eyebrow";
  if (/headline|heading|title/.test(k)) return "heading";
  if (/^item|feature|stat|step|question|person|logo/.test(k)) return "item";
  if (/cta|button|link/.test(k)) return "cta";
  if (/body|sub|desc|intro|quote|text/.test(k) || multiline) return "body";
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

export function GenericSection({ component, p }: { component: CustomComponent; p: RenderProps }): ReactNode {
  const brand = getBrandKit(component.projectId);
  const primary = brand?.colors?.primary || "#4f46e5";
  const centered = p.variant !== "left";

  const eyebrows = component.fields.filter((f) => roleOf(f.key, f.multiline) === "eyebrow");
  const headings = component.fields.filter((f) => roleOf(f.key, f.multiline) === "heading");
  const bodies = component.fields.filter((f) => roleOf(f.key, f.multiline) === "body");
  const items = component.fields.filter((f) => roleOf(f.key, f.multiline) === "item");
  const ctas = component.fields.filter((f) => roleOf(f.key, f.multiline) === "cta");
  const metas = component.fields.filter((f) => roleOf(f.key, f.multiline) === "meta");

  return (
    <div className={cn("px-8 py-10", centered && "text-center")}>
      {eyebrows.map((f) => (
        <span
          key={f.key}
          className="inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide"
          style={{ backgroundColor: `${primary}14`, color: primary }}
        >
          <Txt p={p} k={f.key} />
        </span>
      ))}
      {headings.map((f) => (
        <Txt
          key={f.key}
          p={p}
          k={f.key}
          as="h2"
          multiline
          className={cn("mt-3 block max-w-2xl text-[24px] font-bold leading-[1.15] tracking-tight text-slate-900", centered && "mx-auto")}
        />
      ))}
      {bodies.map((f) => (
        <Txt
          key={f.key}
          p={p}
          k={f.key}
          as="p"
          multiline
          className={cn("mt-3 block max-w-xl text-[13.5px] leading-relaxed text-slate-500", centered && "mx-auto")}
        />
      ))}
      {items.length > 0 && (
        <div
          className={cn(
            "mt-6 grid gap-4",
            items.length >= 3 ? "grid-cols-1 sm:grid-cols-3" : items.length === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1",
          )}
        >
          {items.map((f, i) => (
            <div key={f.key} className={cn("rounded-xl border border-slate-100 bg-slate-50/60 p-4", !centered && "text-left")}>
              <div
                className="grid h-7 w-7 place-items-center rounded-lg text-[12px] font-bold text-white"
                style={{ backgroundColor: primary, marginInline: centered ? "auto" : undefined }}
              >
                {i + 1}
              </div>
              <Txt p={p} k={f.key} as="div" multiline className="mt-3 block text-[13px] font-medium leading-relaxed text-slate-800" />
            </div>
          ))}
        </div>
      )}
      {ctas.length > 0 && (
        <div className={cn("mt-6 flex items-center gap-3", centered && "justify-center")}>
          {ctas.map((f, i) => (
            <span
              key={f.key}
              className={cn(
                "rounded-lg px-4 py-2 text-[13px] font-semibold",
                i > 0 && "border border-slate-200 text-slate-700",
              )}
              style={i === 0 ? { backgroundColor: primary, color: "#fff" } : undefined}
            >
              <Txt p={p} k={f.key} />
            </span>
          ))}
        </div>
      )}
      {metas.map((f) => (
        <div key={f.key} className="mt-4 text-[12px] text-slate-400">
          <Txt p={p} k={f.key} />
        </div>
      ))}
    </div>
  );
}
