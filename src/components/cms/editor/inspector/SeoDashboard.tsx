import { useMemo } from "react";
import type { Page } from "@/lib/cms/types";
import { pageActions } from "@/lib/cms/store";
import { auditPage, scoreTone, type SeoCheck } from "@/lib/cms/seo-audit";
import { SeoSearchPreview } from "@/components/cms/ui/SeoSearchPreview";
import { SeoSocialPreview } from "@/components/cms/ui/SeoSocialPreview";

/**
 * Phase 4D — SEO panel rebuilt as an optimization dashboard.
 *
 * Score → checks → previews (Search / OG / Twitter) → recommendations.
 * Each section is its own visual group with consistent rhythm.
 */
export function SeoDashboard({ page }: { page: Page }) {
  const audit = useMemo(() => auditPage(page), [page]);
  const tone = scoreTone(audit.score);
  const fails = audit.checks.filter((c) => c.status !== "pass");

  return (
    <div className="space-y-6">
      <ScoreCard score={audit.score} tone={tone} totalChecks={audit.checks.length} failing={fails.length} />

      <ChecksList checks={audit.checks} />

      <PreviewBlock title="Search result">
        <SeoSearchPreview
          title={audit.preview.title}
          description={audit.preview.description}
          url={audit.preview.url || page.slug}
        />
      </PreviewBlock>

      <PreviewBlock title="Open Graph card">
        <SeoSocialPreview
          title={page.ogTitle?.trim() || audit.preview.title}
          description={page.ogDescription?.trim() || audit.preview.description}
          url={audit.preview.url || page.slug}
          image={audit.preview.image}
        />
      </PreviewBlock>

      <PreviewBlock title="Twitter card">
        <SeoSocialPreview
          title={page.ogTitle?.trim() || audit.preview.title}
          description={page.ogDescription?.trim() || audit.preview.description}
          url={audit.preview.url || page.slug}
          image={page.twitterImage?.trim() || audit.preview.image}
        />
      </PreviewBlock>

      <Recommendations checks={audit.checks} />

      <FieldsBlock page={page} />
    </div>
  );
}

// ───────── Score ─────────

function ScoreCard({
  score,
  tone,
  totalChecks,
  failing,
}: {
  score: number;
  tone: "good" | "warn" | "bad";
  totalChecks: number;
  failing: number;
}) {
  const toneColor =
    tone === "good"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "warn"
        ? "text-amber-600 dark:text-amber-400"
        : "text-rose-600 dark:text-rose-400";
  const ringColor =
    tone === "good"
      ? "stroke-emerald-500"
      : tone === "warn"
        ? "stroke-amber-500"
        : "stroke-rose-500";
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (score / 100) * c;
  return (
    <div className="flex items-center gap-4 rounded-[10px] border border-border bg-[color:var(--color-panel)] px-4 py-3.5">
      <div className="relative h-[68px] w-[68px] shrink-0">
        <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
          <circle cx="32" cy="32" r={r} className="fill-none stroke-border" strokeWidth="6" />
          <circle
            cx="32"
            cy="32"
            r={r}
            className={`fill-none ${ringColor} transition-[stroke-dashoffset]`}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c - dash}
          />
        </svg>
        <div className={`absolute inset-0 grid place-items-center text-[18px] font-semibold tabular-nums ${toneColor}`}>
          {score}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-foreground">
            {tone === "good" ? "Looking great" : tone === "warn" ? "Could be stronger" : "Needs attention"}
          </span>
          <span
            className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] ${
              tone === "good"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                : tone === "warn"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
            }`}
          >
            {tone === "good" ? "Good" : tone === "warn" ? "Needs work" : "Poor"}
          </span>
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {failing === 0
            ? `All ${totalChecks} checks pass.`
            : `${failing} of ${totalChecks} checks need attention.`}
        </div>
      </div>
    </div>
  );
}

// ───────── Checks ─────────


function ChecksList({ checks }: { checks: SeoCheck[] }) {
  return (
    <section>
      <GroupHeader title="Checks" hint={`${checks.length} total`} />
      <ul className="overflow-hidden rounded-[8px] border border-border">
        {checks.map((c, i) => {
          const dotColor =
            c.status === "pass"
              ? "bg-emerald-500"
              : c.status === "warn"
                ? "bg-amber-500"
                : "bg-rose-500";
          return (
            <li
              key={c.id}
              className={`flex items-start gap-2.5 px-3 py-2 transition-colors hover:bg-[color:var(--color-row-hover)] ${
                i === 0 ? "" : "border-t border-border/60"
              }`}
            >
              <span
                aria-hidden
                className={`mt-[7px] h-2 w-2 shrink-0 rounded-full ${dotColor}`}
                title={c.status}
              />
              <div className="min-w-0 flex-1">
                <div className="text-[12.5px] font-medium text-foreground">{c.label}</div>
                <div className="mt-0.5 text-[11px] leading-snug text-muted-foreground">
                  {c.detail}
                  {c.fix && c.status !== "pass" && (
                    <>
                      {" "}
                      <span className="text-foreground/70">{c.fix}</span>
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ───────── Previews ─────────

function PreviewBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <GroupHeader title={title} />
      {children}
    </section>
  );
}

// ───────── Recommendations ─────────

function Recommendations({ checks }: { checks: SeoCheck[] }) {
  const items = checks.filter((c) => c.status !== "pass" && c.fix);
  if (items.length === 0) {
    return (
      <section>
        <GroupHeader title="Recommendations" />
        <div className="rounded-[8px] border border-dashed border-border bg-[color:var(--color-panel)] px-3 py-3 text-[12px] text-muted-foreground">
          Nothing to fix. This page is ready to share.
        </div>
      </section>
    );
  }
  return (
    <section>
      <GroupHeader title="Recommendations" hint={`${items.length} action${items.length === 1 ? "" : "s"}`} />
      <ol className="space-y-1.5">
        {items.map((c, i) => (
          <li
            key={c.id}
            className="flex items-start gap-2.5 rounded-[6px] border border-border bg-[color:var(--color-panel)] px-3 py-2"
          >
            <span className="mt-[1px] grid h-4 w-4 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1 text-[12px] leading-snug">
              <span className="font-medium text-foreground">{c.label}.</span>{" "}
              <span className="text-muted-foreground">{c.fix}</span>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ───────── Editable fields ─────────

function FieldsBlock({ page }: { page: Page }) {
  return (
    <section className="space-y-3">
      <GroupHeader title="Fields" />
      <SeoField
        label="Meta title"
        value={page.metaTitle ?? ""}
        placeholder={page.title}
        max={60}
        onChange={(v) => pageActions.update(page.id, { metaTitle: v })}
      />
      <SeoField
        label="Meta description"
        value={page.metaDescription ?? page.seoDescription ?? ""}
        max={160}
        textarea
        onChange={(v) => pageActions.update(page.id, { metaDescription: v })}
      />
      <SeoField
        label="Canonical URL"
        mono
        value={page.canonical ?? ""}
        onChange={(v) => pageActions.update(page.id, { canonical: v })}
      />
      <SeoField
        label="OG image URL"
        mono
        value={page.ogImage ?? ""}
        onChange={(v) => pageActions.update(page.id, { ogImage: v })}
      />
      <SeoField
        label="Twitter image URL"
        mono
        value={page.twitterImage ?? ""}
        onChange={(v) => pageActions.update(page.id, { twitterImage: v })}
      />
    </section>
  );
}

function SeoField({
  label,
  value,
  onChange,
  placeholder,
  max,
  mono,
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  max?: number;
  mono?: boolean;
  textarea?: boolean;
}) {
  const overflow = max ? value.length > max : false;
  const inputCls = `w-full rounded-[6px] border bg-surface px-2 text-[13px] text-foreground transition-colors focus:border-primary focus:outline-none ${
    overflow ? "border-amber-500/60" : "border-border hover:border-border-strong"
  } ${mono ? "font-mono text-[12px]" : ""}`;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[11px] font-medium text-muted-foreground">{label}</label>
        {max && (
          <span
            className={`text-[10.5px] tabular-nums ${
              overflow ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/70"
            }`}
          >
            {value.length} / {max}
          </span>
        )}
      </div>
      {textarea ? (
        <textarea
          value={value}
          placeholder={placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputCls} py-1.5`}
        />
      ) : (
        <input
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`h-8 ${inputCls}`}
        />
      )}
    </div>
  );
}

function GroupHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-2 flex items-baseline gap-2">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </h3>
      {hint && <span className="text-[10.5px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}


