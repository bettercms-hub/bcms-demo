/**
 * Brand — the project's brand kit in one place.
 *
 * Left: the tokens (colors, typography, shape, logos, voice).
 * Right: a live preview composed from those tokens, so every edit is
 * visible the moment it lands. Developers and admins edit; marketers
 * and editors see exactly what their components will reference.
 *
 * Three ways in: edit here, import a design.md (parse, review, apply),
 * or PUT the same JSON over the API shown at the top.
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { createPortal } from "react-dom";
import { Check, Copy, FileUp, Lock, Palette, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";
import {
  BRAND_FONTS,
  RADIUS_VALUE,
  brandActions,
  fontStack,
  mapParsedColors,
  parseDesignMd,
  useBrandKit,
  type BrandColors,
  type BrandKit,
  type BrandRadius,
} from "@/lib/brand/brand-store";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/brand")({
  component: BrandPage,
});

const COLOR_SLOTS: { key: keyof BrandColors; label: string; hint: string }[] = [
  { key: "primary", label: "Primary", hint: "Buttons and key actions" },
  { key: "accent", label: "Accent", hint: "Links and highlights" },
  { key: "background", label: "Background", hint: "Page canvas" },
  { key: "surface", label: "Surface", hint: "Cards and panels" },
  { key: "text", label: "Text", hint: "Headings and body" },
  { key: "muted", label: "Muted", hint: "Secondary text" },
];

function BrandPage() {
  const { workspace, project } = Route.useParams();
  const pr = getProjectBySlug(workspace, project);
  const { effective } = useEffectiveRole(workspace);
  const canEdit = canSeeDeveloper(effective);
  const kit = useBrandKit(pr?.id ?? "");
  const [importing, setImporting] = useState(false);

  if (!pr) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-[13px] text-muted-foreground">
        Project not found. Pick a project from the dashboard.
      </div>
    );
  }

  const endpoint = `api.bettercms.site/v1/projects/${pr.id}/brand-kit`;
  const patch = (p: Parameters<typeof brandActions.update>[1]) => brandActions.update(pr.id, p);

  // Rendered inside the settings layout, which supplies the scroll
  // container, max width, padding, and breadcrumb.
  return (
    <div>
      <div>
        {/* header */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground">Brand</h1>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              One source of truth for colors, type, and voice. Components and the agent reference these tokens.
              <span className="ml-1.5 tabular-nums text-muted-foreground/70">v{kit.version}</span>
            </p>
          </div>
          {canEdit ? (
            <button
              type="button"
              onClick={() => setImporting(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <FileUp className="h-3.5 w-3.5 text-muted-foreground" /> Import design.md
            </button>
          ) : (
            <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[color:var(--s2)] px-2.5 text-[11.5px] font-medium text-muted-foreground">
              <Lock className="h-3 w-3" /> Developers edit the brand kit
            </span>
          )}
        </div>

        {/* API bar */}
        <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)] px-2.5 py-1.5">
          <span className="rounded bg-[color:var(--card)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-sky-600">GET PUT</span>
          <span className="truncate font-mono text-[11.5px] text-foreground">{endpoint}</span>
          <button
            type="button"
            title="Copy endpoint"
            aria-label="Copy endpoint"
            onClick={() => {
              navigator.clipboard?.writeText(`https://${endpoint}`).catch(() => {});
              toast.success("Endpoint copied");
            }}
            className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* two columns: tokens left, live preview right */}
        <div className="mt-6 flex flex-col gap-6 lg:flex-row">
          <div className="min-w-0 flex-1 space-y-6">
            <ColorsSection kit={kit} canEdit={canEdit} onPatch={patch} />
            <TypographySection kit={kit} canEdit={canEdit} onPatch={patch} />
            <ShapeAndLogoSection kit={kit} canEdit={canEdit} onPatch={patch} />
            <VoiceSection kit={kit} canEdit={canEdit} onPatch={patch} />
          </div>
          <div className="w-full shrink-0 lg:w-[380px]">
            <div className="lg:sticky lg:top-6">
              <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Live preview</p>
              <LivePreview kit={kit} />
              <p className="mt-2 px-1 text-[11px] text-muted-foreground">
                Rendered from the tokens on the left. Every component that references them updates the same way.
              </p>
            </div>
          </div>
        </div>
      </div>

      {importing && (
        <ImportDialog
          onClose={() => setImporting(false)}
          onApply={(p) => {
            patch(p);
            setImporting(false);
            toast.success("Brand kit updated from design.md");
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------------------------------------- sections */

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
      <div className="border-b border-[color:var(--border-hairline)] px-4 py-2.5">
        <span className="text-[12.5px] font-semibold text-foreground">{title}</span>
        {hint && <span className="ml-2 text-[11.5px] text-muted-foreground">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ColorsSection({ kit, canEdit, onPatch }: SectionProps) {
  return (
    <Section title="Colors" hint="Named tokens, never raw values in components">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {COLOR_SLOTS.map((slot) => (
          <label key={slot.key} className="group block">
            <span
              className="block h-16 w-full rounded-lg border border-black/5"
              style={{ background: kit.colors[slot.key] }}
            />
            <span className="mt-1.5 flex items-center justify-between">
              <span className="text-[12px] font-medium text-foreground">{slot.label}</span>
              <span className="relative inline-flex items-center">
                <input
                  type="color"
                  value={kit.colors[slot.key]}
                  disabled={!canEdit}
                  onChange={(e) => onPatch({ colors: { ...kit.colors, [slot.key]: e.target.value.toUpperCase() } })}
                  aria-label={`${slot.label} color`}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                />
                <span className="font-mono text-[10.5px] text-muted-foreground group-hover:text-foreground">
                  {kit.colors[slot.key]}
                </span>
              </span>
            </span>
            <span className="block text-[10.5px] text-muted-foreground/80">{slot.hint}</span>
          </label>
        ))}
      </div>
    </Section>
  );
}

interface SectionProps {
  kit: BrandKit;
  canEdit: boolean;
  onPatch: (p: Parameters<typeof brandActions.update>[1]) => void;
}

function TypographySection({ kit, canEdit, onPatch }: SectionProps) {
  const rows: { key: "headingFont" | "bodyFont"; label: string; sample: string; size: string }[] = [
    { key: "headingFont", label: "Headings", sample: "Clarity you can trust", size: "text-[22px] font-semibold" },
    { key: "bodyFont", label: "Body", sample: "Structured content that reads the way your brand sounds.", size: "text-[13.5px]" },
  ];
  return (
    <Section title="Typography">
      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border border-[color:var(--color-border)] p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</span>
              <select
                value={kit.typography[row.key]}
                disabled={!canEdit}
                onChange={(e) => onPatch({ typography: { ...kit.typography, [row.key]: e.target.value } })}
                aria-label={`${row.label} font`}
                className="h-7 rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-1.5 text-[11.5px] text-foreground outline-none disabled:cursor-not-allowed"
              >
                {BRAND_FONTS.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <p className={cn("mt-2 leading-snug text-foreground", row.size)} style={{ fontFamily: fontStack(kit.typography[row.key]) }}>
              {row.sample}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ShapeAndLogoSection({ kit, canEdit, onPatch }: SectionProps) {
  return (
    <Section title="Shape and logo">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Corners</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {(Object.keys(RADIUS_VALUE) as BrandRadius[]).map((r) => (
              <button
                key={r}
                type="button"
                disabled={!canEdit}
                onClick={() => onPatch({ radius: r })}
                aria-pressed={kit.radius === r}
                className={cn(
                  "flex h-9 items-center justify-center gap-1.5 rounded-md border text-[12px] font-medium capitalize transition-colors disabled:cursor-not-allowed",
                  kit.radius === r
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] text-primary"
                    : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className="h-3.5 w-3.5 border-2 border-current"
                  style={{ borderRadius: r === "pill" ? "999px" : RADIUS_VALUE[r] }}
                />
                {r}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-[1fr_84px] gap-2">
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Wordmark</span>
            <input
              value={kit.logos.wordmark}
              disabled={!canEdit}
              onChange={(e) => onPatch({ logos: { ...kit.logos, wordmark: e.target.value } })}
              className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none disabled:cursor-not-allowed"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Mark</span>
            <input
              value={kit.logos.mark}
              maxLength={2}
              disabled={!canEdit}
              onChange={(e) => onPatch({ logos: { ...kit.logos, mark: e.target.value } })}
              className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-center text-[13px] font-semibold text-foreground outline-none disabled:cursor-not-allowed"
            />
          </label>
        </div>
      </div>
    </Section>
  );
}

function VoiceSection({ kit, canEdit, onPatch }: SectionProps) {
  const listRow = (
    label: string,
    key: "doWords" | "dontWords" | "protectedPhrases",
    placeholder: string,
  ) => (
    <label className="block">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <input
        value={kit.voice[key].join(", ")}
        disabled={!canEdit}
        placeholder={placeholder}
        onChange={(e) =>
          onPatch({
            voice: {
              ...kit.voice,
              [key]: e.target.value.split(",").map((x) => x.trim()).filter(Boolean),
            },
          })
        }
        className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
      />
    </label>
  );

  return (
    <Section title="Voice" hint="The agent reads this before it writes anything">
      <div className="space-y-3">
        <label className="block">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Tone</span>
          <input
            value={kit.voice.tone}
            disabled={!canEdit}
            placeholder="e.g. Confident, plain spoken, no hype"
            onChange={(e) => onPatch({ voice: { ...kit.voice, tone: e.target.value } })}
            className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/50 disabled:cursor-not-allowed"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          {listRow("Words we use", "doWords", "ship, structured, calm")}
          {listRow("Words we avoid", "dontWords", "synergy, revolutionary")}
        </div>
        {listRow("Protected phrases, never rewritten or translated", "protectedPhrases", "BetterCMS, Brand names")}
      </div>
    </Section>
  );
}

/* --------------------------------------------------------- live preview */

function LivePreview({ kit }: { kit: BrandKit }) {
  const r = RADIUS_VALUE[kit.radius];
  const heading = fontStack(kit.typography.headingFont);
  const body = fontStack(kit.typography.bodyFont);
  const c = kit.colors;

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] shadow-[var(--shadow-card)]" style={{ background: c.background }}>
      {/* nav */}
      <div className="flex items-center gap-2 border-b px-4 py-2.5" style={{ borderColor: `${c.text}14` }}>
        <span
          className="grid h-5 w-5 place-items-center text-[10px] font-bold"
          style={{ background: c.primary, color: c.background, borderRadius: r }}
        >
          {kit.logos.mark || "B"}
        </span>
        <span className="text-[12px] font-semibold" style={{ color: c.text, fontFamily: heading }}>
          {kit.logos.wordmark || "Your brand"}
        </span>
        <span className="ml-auto text-[10.5px]" style={{ color: c.muted, fontFamily: body }}>
          Product · Pricing · Blog
        </span>
      </div>
      {/* hero */}
      <div className="px-5 pb-5 pt-6">
        <h2 className="text-[21px] font-bold leading-tight" style={{ color: c.text, fontFamily: heading }}>
          Pages that stay on brand, no matter who ships them
        </h2>
        <p className="mt-1.5 text-[12px] leading-relaxed" style={{ color: c.muted, fontFamily: body }}>
          Every component references these tokens. Change one and the whole site follows.
        </p>
        <div className="mt-3.5 flex items-center gap-2">
          <span
            className="inline-flex h-8 items-center px-3.5 text-[11.5px] font-semibold"
            style={{ background: c.primary, color: c.background, borderRadius: r, fontFamily: body }}
          >
            Get started
          </span>
          <span className="text-[11.5px] font-medium" style={{ color: c.accent, fontFamily: body }}>
            See how it works
          </span>
        </div>
      </div>
      {/* card row */}
      <div className="grid grid-cols-2 gap-2.5 px-5 pb-5">
        {["Structured content", "One brand kit"].map((t, i) => (
          <div key={t} className="border p-3" style={{ background: c.surface, borderColor: `${c.text}0F`, borderRadius: r }}>
            <span
              className="grid h-6 w-6 place-items-center text-[10px] font-bold"
              style={{ background: i === 0 ? c.accent : c.primary, color: c.background, borderRadius: r }}
            >
              {i + 1}
            </span>
            <p className="mt-2 text-[11.5px] font-semibold" style={{ color: c.text, fontFamily: heading }}>
              {t}
            </p>
            <p className="mt-0.5 text-[10.5px] leading-snug" style={{ color: c.muted, fontFamily: body }}>
              Filled by marketers, styled by tokens.
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------- import dialog */

function ImportDialog({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (patch: Parameters<typeof brandActions.update>[1]) => void;
}) {
  const [text, setText] = useState("");
  const parsed = useMemo(() => (text.trim() ? parseDesignMd(text) : null), [text]);
  const colors = useMemo(() => (parsed ? mapParsedColors(parsed) : {}), [parsed]);
  const foundAnything =
    parsed && (Object.keys(colors).length > 0 || parsed.headingFont || parsed.tone || parsed.doWords.length > 0);

  const apply = () => {
    if (!parsed) return;
    onApply({
      colors: colors as BrandColors,
      ...(parsed.headingFont || parsed.bodyFont
        ? { typography: { headingFont: parsed.headingFont ?? "inter", bodyFont: parsed.bodyFont ?? parsed.headingFont ?? "inter" } }
        : {}),
      ...(parsed.tone || parsed.doWords.length || parsed.dontWords.length || parsed.protectedPhrases.length
        ? {
            voice: {
              tone: parsed.tone ?? "",
              doWords: parsed.doWords,
              dontWords: parsed.dontWords,
              protectedPhrases: parsed.protectedPhrases,
            },
          }
        : {}),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Import design.md"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative flex max-h-[80vh] w-full max-w-[560px] flex-col overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <Palette className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">Import design.md</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Paste your brand guidelines. We read the colors, fonts, and voice, and you review before anything applies.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
            rows={7}
            placeholder={"# Brand guidelines\nPrimary: #EF037F\nBackground: #FFFFFF\nHeadings: Epilogue, Body: Inter\nTone: confident and plain spoken\nDo: ship, structured\nDo not: synergy, revolutionary"}
            className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--background)] px-3 py-2.5 font-mono text-[12px] leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />

          {parsed && foundAnything && (
            <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)]/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Found</p>
              {Object.keys(colors).length > 0 && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {Object.entries(colors).map(([slot, hex]) => (
                    <span key={slot} className="inline-flex items-center gap-1.5 rounded-md bg-[color:var(--card)] px-2 py-1 text-[11px] text-foreground">
                      <span className="h-3 w-3 rounded-sm border border-black/10" style={{ background: hex }} />
                      {slot} <span className="font-mono text-[10px] text-muted-foreground">{hex}</span>
                    </span>
                  ))}
                </div>
              )}
              {(parsed.headingFont || parsed.bodyFont) && (
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Fonts: {BRAND_FONTS.find((f) => f.id === parsed.headingFont)?.label ?? "unchanged"} headings,{" "}
                  {BRAND_FONTS.find((f) => f.id === parsed.bodyFont)?.label ?? "unchanged"} body
                </p>
              )}
              {parsed.tone && <p className="mt-1 text-[11.5px] text-muted-foreground">Tone: {parsed.tone}</p>}
              {parsed.doWords.length > 0 && (
                <p className="mt-1 text-[11.5px] text-muted-foreground">Words we use: {parsed.doWords.join(", ")}</p>
              )}
              {parsed.dontWords.length > 0 && (
                <p className="mt-1 text-[11.5px] text-muted-foreground">Words we avoid: {parsed.dontWords.join(", ")}</p>
              )}
            </div>
          )}
          {parsed && !foundAnything && (
            <p className="text-[11.5px] text-muted-foreground">
              Nothing recognizable yet. Hex colors, font names, and Tone / Do / Do not lines are picked up.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!foundAnything}
            onClick={apply}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" /> Apply to brand kit
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
