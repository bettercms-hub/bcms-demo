/**
 * SeoPagesDialog — the programmatic SEO page generator.
 *
 * Keywords in (paste or CSV), one draft page out per keyword, composed from
 * a page template with URL, title and meta description patterns. The last
 * step hands off to a generator run: drafts land in Pages with a batch bar
 * for review, bulk publish and one-click undo.
 */
import { useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, FileSpreadsheet, Loader2, Lock, ScanSearch, Sparkles, Upload } from "lucide-react";
import { PAGE_TEMPLATES } from "@/components/cms/editor/sections/SectionSystem";
import {
  fillTokens,
  parseKeywordCsv,
  parseKeywordLines,
  SAMPLE_KEYWORDS_CSV,
  slugifyKeyword,
  type KeywordRow,
} from "@/lib/agent/generate";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { hasBrandVoice } from "@/lib/brand/brand-store";
import { aiAction, tierAllowed } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeneratorShell, GenField, genInput } from "./GeneratorShell";

const PER_PAGE = aiAction("seo-page")?.costs.balanced ?? 12;
const MAX_PAGES = 50;

export function SeoPagesDialog({
  projectId,
  workspace,
  project,
  sitePlan,
  onClose,
}: {
  projectId: string;
  workspace: string;
  project: string;
  sitePlan: SitePlanId;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const allowed = tierAllowed(sitePlan, "balanced", "seo-page");

  const [step, setStep] = useState(0);
  const [pasted, setPasted] = useState("");
  const [csvRows, setCsvRows] = useState<KeywordRow[] | null>(null);
  const [csvName, setCsvName] = useState("");
  const [templateId, setTemplateId] = useState("landing");
  const [pathPrefix, setPathPrefix] = useState("/lp");
  const [titlePattern, setTitlePattern] = useState("{{keyword}}");
  const [descriptionPattern, setDescriptionPattern] = useState("Compare options and get started with {{keyword}}. Clear pricing, instant confirmation.");
  const [runId, setRunId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => (csvRows ?? parseKeywordLines(pasted)).slice(0, MAX_PAGES), [csvRows, pasted]);
  const overflow = (csvRows ?? parseKeywordLines(pasted)).length > MAX_PAGES;
  const first = rows[0];
  const credits = rows.length * PER_PAGE;
  const voice = hasBrandVoice(projectId);

  const runs = useAgentRuns(projectId);
  const run = runId ? runs.find((r) => r.id === runId) : undefined;
  const generating = run != null && run.status !== "done";
  const finished = run?.status === "done";

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseKeywordCsv(String(reader.result ?? ""));
      setCsvRows(parsed);
      setCsvName(file.name);
    };
    reader.readAsText(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_KEYWORDS_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "keywords.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function generate() {
    const id = agentRunActions.startGenerator({
      projectId,
      kind: "seo",
      config: { rows, templateId, pathPrefix: pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`, titlePattern, descriptionPattern },
    });
    if (id) setRunId(id);
  }

  function reviewPages() {
    onClose();
    navigate({ to: "/w/$workspace/p/$project/content", params: { workspace, project }, search: { batch: runId ?? undefined } });
  }

  /* ------------------------------------------------------------- locked */

  if (!allowed) {
    return (
      <GeneratorShell icon={ScanSearch} title="SEO pages" subtitle="Bulk pages from keywords" step={0} stepCount={1} onClose={onClose}>
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s2)] p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">SEO page generation is on Basic and above</h3>
          <p className="mx-auto mt-1 max-w-[360px] text-[12px] text-muted-foreground">
            Turn a keyword list into draft pages composed from your section catalog, with metadata written for each one.
          </p>
          <Button
            size="sm"
            className="mt-4"
            onClick={() => {
              onClose();
              navigate({ to: "/w/$workspace/p/$project/settings/plan", params: { workspace, project } });
            }}
          >
            See plans
          </Button>
        </div>
      </GeneratorShell>
    );
  }

  /* --------------------------------------------------------- generating */

  if (run) {
    return (
      <GeneratorShell icon={ScanSearch} title="SEO pages" subtitle={finished ? "Done" : "Generating"} step={2} stepCount={3} onClose={onClose}>
        <div className="space-y-2">
          {run.steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2.5">
              {s.status === "done" ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
              <span className="text-[12.5px] text-foreground">{s.label}</span>
              {s.detail && <span className="ml-auto text-[11px] text-muted-foreground">{s.detail}</span>}
            </div>
          ))}
          {finished && (
            <div className="rounded-xl border border-[color:color-mix(in_oklab,var(--primary)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] p-4 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 text-[13.5px] font-semibold text-foreground">
                {run.appliedCount} draft {run.appliedCount === 1 ? "page" : "pages"} created
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Nothing is live. Review, then publish the ones you want.</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button size="sm" onClick={reviewPages}>Review pages</Button>
                <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </GeneratorShell>
    );
  }

  /* ------------------------------------------------------------- wizard */

  const footer =
    step === 0 ? (
      <>
        <span className="text-[11.5px] text-muted-foreground">
          {rows.length > 0 ? `${rows.length} ${rows.length === 1 ? "keyword" : "keywords"}${overflow ? `, first ${MAX_PAGES} used` : ""}` : "Paste keywords or upload a CSV"}
        </span>
        <Button size="sm" disabled={rows.length === 0} onClick={() => setStep(1)}>
          Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : step === 1 ? (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={() => setStep(2)}>
          Next <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={generate} disabled={generating}>
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate {rows.length} {rows.length === 1 ? "page" : "pages"}
        </Button>
      </>
    );

  return (
    <GeneratorShell
      icon={ScanSearch}
      title="SEO pages"
      subtitle={["Keywords", "Template and patterns", "Review"][step]}
      step={step}
      stepCount={3}
      onClose={onClose}
      footer={footer}
      wide
    >
      {step === 0 && (
        <div className="space-y-3">
          <GenField label="Keywords, one per line">
            <textarea
              value={pasted}
              onChange={(e) => {
                setPasted(e.target.value);
                setCsvRows(null);
                setCsvName("");
              }}
              rows={6}
              placeholder={"Car rental in Paris\nCar rental in Lyon\nCar rental in Nice"}
              className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]"
            />
          </GenField>

          <div className="flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-2.5">
            <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-medium text-foreground">{csvName || "Or upload a CSV"}</div>
              <div className="text-[11px] text-muted-foreground">
                First column is the keyword. Extra columns become tokens for your patterns.{" "}
                <button type="button" onClick={downloadSample} className="text-primary hover:underline">Download sample</button>
              </div>
            </div>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])} />
            <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
            </Button>
          </div>

          {rows.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {rows.slice(0, 6).map((r) => (
                <span key={r.keyword} className="rounded-md bg-[color:var(--s2)] px-2 py-0.5 text-[11.5px] text-foreground">{r.keyword}</span>
              ))}
              {rows.length > 6 && <span className="px-1 py-0.5 text-[11.5px] text-muted-foreground">and {rows.length - 6} more</span>}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Page template</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {PAGE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition-colors",
                    templateId === t.id
                      ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                      : "border-[color:var(--border-hairline)] hover:border-[color:var(--color-border-strong)]",
                  )}
                >
                  <t.icon className={cn("h-4 w-4", templateId === t.id ? "text-primary" : "text-muted-foreground")} />
                  <div className="mt-1.5 text-[12.5px] font-medium text-foreground">{t.name}</div>
                  <div className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{t.blurb}</div>
                </button>
              ))}
            </div>
          </div>

          <GenField label="URL prefix" hint="Each page gets the keyword as a slug under this prefix.">
            <input value={pathPrefix} onChange={(e) => setPathPrefix(e.target.value)} className={cn(genInput, "font-mono text-[12.5px]")} />
          </GenField>
          <GenField label="Meta title pattern" hint="Tokens: {{keyword}} plus any CSV column, like {{city}}.">
            <input value={titlePattern} onChange={(e) => setTitlePattern(e.target.value)} className={genInput} />
          </GenField>
          <GenField label="Meta description pattern">
            <input value={descriptionPattern} onChange={(e) => setDescriptionPattern(e.target.value)} className={genInput} />
          </GenField>

          {first && (
            <div className="rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-3">
              <div className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Example, first keyword</div>
              <div className="mt-1.5 truncate text-[13px] font-medium text-[#1a0dab] dark:text-sky-400">{fillTokens(titlePattern, first) || first.keyword}</div>
              <div className="truncate font-mono text-[11px] text-emerald-700 dark:text-emerald-400">
                {project}.bettercms.site{pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`}/{slugifyKeyword(first.keyword)}
              </div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] text-muted-foreground">{fillTokens(descriptionPattern, first)}</div>
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
            {[
              [`${rows.length} draft ${rows.length === 1 ? "page" : "pages"}`, `${PAGE_TEMPLATES.find((t) => t.id === templateId)?.name ?? "Landing page"} template`],
              ["Destination", `Pages, under ${pathPrefix.startsWith("/") ? pathPrefix : `/${pathPrefix}`}`],
              ["Voice", voice ? "Follows the brand voice" : "Neutral and factual"],
              ["Estimated cost", `${credits} credits, Balanced speed`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-[color:var(--border-hairline)] px-3 py-2 text-[12.5px] last:border-b-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <p className="px-1 text-[11.5px] text-muted-foreground">
            Everything lands as drafts. You review the batch, publish the ones you want, and can undo the whole run in one click.
          </p>
        </div>
      )}
    </GeneratorShell>
  );
}
