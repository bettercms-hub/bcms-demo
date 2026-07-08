/**
 * AbmPageDialog — pages for target accounts, one or many.
 *
 * Four steps:
 * 1. Accounts: one account with context, or a CSV of accounts (one page per
 *    row, capped). 2. Sales motion: break-in, expand, accelerate or
 *    re-engage; it shapes every headline and CTA. 3. Build: compose from
 *    one of your page templates, or the AI Builder, which writes from your
 *    prompt plus the brand kit and section catalog. 4. Review and generate.
 *
 * A single page opens in the visual editor with the agent dock alongside
 * for follow-ups; a batch lands in Pages with the review bar. ABM pages
 * default to noindex: they are for the accounts, not for search.
 */
import { useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  FileSpreadsheet,
  Layers,
  Loader2,
  Lock,
  Sparkles,
  Upload,
  User,
  Users,
  Wand2,
} from "lucide-react";
import { PAGE_TEMPLATES, getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import {
  ABM_MOTIONS,
  SAMPLE_ACCOUNTS_CSV,
  abmPersonalizationPlan,
  parseAccountsCsv,
  slugifyKeyword,
  type AbmAccount,
  type AbmBuildMode,
  type AbmMotion,
} from "@/lib/agent/generate";
import { agentDock } from "@/lib/agent/dock-store";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { hasBrandVoice } from "@/lib/brand/brand-store";
import { aiAction, tierAllowed } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeneratorShell, GenField, genInput } from "./GeneratorShell";

const PER_PAGE = aiAction("abm-page")?.costs.balanced ?? 60;
const MAX_ACCOUNTS = 25;

type Source = "single" | "csv";

export function AbmPageDialog({
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
  const allowed = tierAllowed(sitePlan, "balanced", "abm-page");

  const [step, setStep] = useState(0);
  const [source, setSource] = useState<Source>("single");
  const [account, setAccount] = useState("");
  const [context, setContext] = useState("");
  const [csvAccounts, setCsvAccounts] = useState<AbmAccount[]>([]);
  const [csvName, setCsvName] = useState("");
  const [motion, setMotion] = useState<AbmMotion>("breakin");
  const [mode, setMode] = useState<AbmBuildMode>("template");
  const [templateId, setTemplateId] = useState("landing");
  const [prompt, setPrompt] = useState("");
  const [runId, setRunId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const accounts: AbmAccount[] =
    source === "csv" ? csvAccounts.slice(0, MAX_ACCOUNTS) : [{ account: account.trim(), context: context.trim() }];
  const overflow = source === "csv" && csvAccounts.length > MAX_ACCOUNTS;
  const count = accounts.length;
  const credits = PER_PAGE * count;
  const voice = hasBrandVoice(projectId);

  const runs = useAgentRuns(projectId);
  const run = runId ? runs.find((r) => r.id === runId) : undefined;
  const finished = run?.status === "done";
  const firstPath = run?.proposals[0]?.targetId;

  const sourceValid =
    source === "csv" ? count > 0 : account.trim().length > 0 && context.trim().length >= 20;
  const buildValid = mode === "template" || prompt.trim().length >= 20;

  function onCsvFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setCsvAccounts(parseAccountsCsv(String(reader.result ?? "")));
      setCsvName(file.name);
    };
    reader.readAsText(file);
  }

  function downloadSample() {
    const blob = new Blob([SAMPLE_ACCOUNTS_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "accounts.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function generate() {
    const id = agentRunActions.startGenerator({
      projectId,
      kind: "abm",
      config: { accounts, motion, mode, prompt: mode === "ai" ? prompt.trim() : undefined, templateId },
    });
    if (id) setRunId(id);
  }

  function openInEditor() {
    if (!firstPath) return;
    onClose();
    // The run thread rides along in the dock so refinement continues in place.
    agentDock.show(runId);
    navigate({ to: "/w/$workspace/p/$project/visual", params: { workspace, project }, search: { page: firstPath } });
  }

  function reviewBatch() {
    onClose();
    navigate({ to: "/w/$workspace/p/$project/content", params: { workspace, project }, search: { batch: runId ?? undefined } });
  }

  /* ------------------------------------------------------------- locked */

  if (!allowed) {
    return (
      <GeneratorShell icon={Users} title="ABM pages" subtitle="Pages for target accounts" step={0} stepCount={1} onClose={onClose}>
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s2)] p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">ABM pages are on Pro and above</h3>
          <p className="mx-auto mt-1 max-w-[360px] text-[12px] text-muted-foreground">
            Generate pages personalized per account from your brand, templates and their context, one account or a whole list.
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
      <GeneratorShell icon={Users} title="ABM pages" subtitle={finished ? "Done" : "Generating"} step={3} stepCount={4} onClose={onClose}>
        <div className="space-y-2">
          {run.steps.map((s) => (
            <div key={s.id} className="flex items-center gap-2.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2.5">
              {s.status === "done" ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" /> : <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />}
              <span className="text-[12.5px] text-foreground">{s.label}</span>
            </div>
          ))}
          {finished && (
            <div className="rounded-xl border border-[color:color-mix(in_oklab,var(--primary)_25%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] p-4 text-center">
              <Sparkles className="mx-auto h-5 w-5 text-primary" />
              <div className="mt-2 text-[13.5px] font-semibold text-foreground">
                {run.appliedCount === 1 ? `Draft ready for ${accounts[0]?.account}` : `${run.appliedCount} account pages created as drafts`}
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                {run.appliedCount === 1 ? (
                  <>
                    <span className="font-mono text-[11px]">{firstPath}</span>, set to noindex. Open it to refine with the agent alongside.
                  </>
                ) : (
                  "All set to noindex. Review the batch, open any page to refine it with the agent."
                )}
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                {run.appliedCount === 1 ? (
                  <Button size="sm" onClick={openInEditor}>Open in editor</Button>
                ) : (
                  <Button size="sm" onClick={reviewBatch}>Review pages</Button>
                )}
                <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </GeneratorShell>
    );
  }

  /* ------------------------------------------------------------- wizard */

  const plan = abmPersonalizationPlan(projectId, { accounts, motion, mode, prompt, templateId });

  const footer =
    step === 0 ? (
      <>
        <span className="text-[11.5px] text-muted-foreground">
          {source === "csv"
            ? count > 0
              ? `${count} ${count === 1 ? "account" : "accounts"}${overflow ? `, first ${MAX_ACCOUNTS} used` : ""}`
              : "Upload a CSV of accounts"
            : "Uses your brand voice and section catalog with this context."}
        </span>
        <Button size="sm" disabled={!sourceValid} onClick={() => setStep(1)}>
          Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : step === 1 ? (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={() => setStep(2)}>
          Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : step === 2 ? (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" disabled={!buildValid} onClick={() => setStep(3)}>
          Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(2)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={generate}>
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate {count === 1 ? "page" : `${count} pages`}, {credits} credits
        </Button>
      </>
    );

  return (
    <GeneratorShell
      icon={Users}
      title="ABM pages"
      subtitle={["Target accounts", "Sales motion", "How to build", "Review"][step]}
      step={step}
      stepCount={4}
      onClose={onClose}
      footer={footer}
      wide
    >
      {step === 0 && (
        <div className="space-y-3">
          {/* source toggle */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "single" as Source, icon: User, label: "One account", blurb: "A single page, hand-tuned context" },
                { id: "csv" as Source, icon: FileSpreadsheet, label: "CSV of accounts", blurb: `Your ICP list, one page per row, up to ${MAX_ACCOUNTS}` },
              ]
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSource(s.id)}
                aria-pressed={source === s.id}
                className={cn(
                  "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                  source === s.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <s.icon className={cn("mt-0.5 h-4 w-4 shrink-0", source === s.id ? "text-primary" : "text-muted-foreground")} />
                <span>
                  <span className="block text-[12.5px] font-semibold text-foreground">{s.label}</span>
                  <span className="block text-[11px] leading-snug text-muted-foreground">{s.blurb}</span>
                </span>
              </button>
            ))}
          </div>

          {source === "single" ? (
            <>
              <GenField label="Account name">
                <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Lumina" className={genInput} />
              </GenField>
              <GenField label="Target account context" hint="Who this page is for and what we should know about them. Two or three sentences is plenty.">
                <textarea
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={4}
                  placeholder="300-rep sales team, moving off spreadsheets for forecasting. VP Sales wants deal-risk scoring before the Q3 board review."
                  className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]"
                />
              </GenField>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-2.5">
                <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12.5px] font-medium text-foreground">{csvName || "Upload your account list"}</div>
                  <div className="text-[11px] text-muted-foreground">
                    Two columns: account, context. One page per row.{" "}
                    <button type="button" onClick={downloadSample} className="text-primary hover:underline">Download sample</button>
                  </div>
                </div>
                <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => e.target.files?.[0] && onCsvFile(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>
                  <Upload className="mr-1 h-3.5 w-3.5" /> Upload file
                </Button>
              </div>
              {count > 0 && (
                <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
                  {accounts.slice(0, 5).map((a) => (
                    <div key={a.account} className="flex items-baseline gap-2.5 border-b border-[color:var(--border-hairline)] px-3 py-2 last:border-b-0">
                      <span className="w-[120px] shrink-0 truncate text-[12.5px] font-medium text-foreground">{a.account}</span>
                      <span className="truncate text-[11.5px] text-muted-foreground">{a.context || "No context, headline only"}</span>
                    </div>
                  ))}
                  {count > 5 && <div className="px-3 py-1.5 text-[11px] text-muted-foreground">and {count - 5} more</div>}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {step === 1 && (
        <div>
          <div className="mb-2 text-[11.5px] font-medium text-muted-foreground">What should {count === 1 ? "this page" : "these pages"} support?</div>
          <div className="space-y-2">
            {ABM_MOTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMotion(m.id)}
                aria-pressed={motion === m.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors",
                  motion === m.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <span
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded-full border-2",
                    motion === m.id ? "border-primary" : "border-[color:var(--color-border-strong)]",
                  )}
                >
                  {motion === m.id && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-foreground">{m.label}</span>
                  <span className="block text-[11px] text-muted-foreground">{m.blurb}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { id: "template" as AbmBuildMode, icon: Layers, label: "Your templates", blurb: "Compose from a page template your team already approved" },
                { id: "ai" as AbmBuildMode, icon: Wand2, label: "AI Builder", blurb: "Write a prompt; the agent composes from your brand kit and sections" },
              ]
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                aria-pressed={mode === m.id}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all",
                  mode === m.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] shadow-sm"
                    : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-lg", mode === m.id ? "bg-primary text-primary-foreground" : "bg-[color:var(--s2)] text-muted-foreground")}>
                  <m.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="mt-2 block text-[13px] font-semibold text-foreground">{m.label}</span>
                <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground">{m.blurb}</span>
              </button>
            ))}
          </div>

          {mode === "template" ? (
            <div>
              <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Start from</div>
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
                    <div className="mt-1.5 text-[12px] font-medium text-foreground">{t.name}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <GenField
              label="Describe the page"
              hint={voice ? "The agent writes with your brand voice and composes from your section catalog." : "The agent composes from your section catalog. Add a brand voice in Settings for tighter copy."}
            >
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                placeholder="A confident one-pager: hero that names their forecasting pain, three proof points, one customer quote from fintech, and a demo CTA. Keep it short and direct."
                className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]"
              />
            </GenField>
          )}
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
            {[
              [count === 1 ? "1 draft page" : `${count} draft pages`, count === 1 ? accounts[0]?.account : `one per account from ${csvName || "your list"}`],
              ["Sales motion", ABM_MOTIONS.find((m) => m.id === motion)?.label ?? ""],
              ["Built with", mode === "ai" ? "AI Builder, your prompt plus the brand kit" : `${PAGE_TEMPLATES.find((t) => t.id === templateId)?.name} template`],
              ["Destination", `Pages, under /for/${count === 1 ? slugifyKeyword(accounts[0]?.account || "account") : "..."} , noindex`],
              ["Estimated cost", `${credits} credits, Balanced speed`],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 border-b border-[color:var(--border-hairline)] px-3 py-2 text-[12.5px] last:border-b-0">
                <span className="shrink-0 text-muted-foreground">{k}</span>
                <span className="truncate font-medium text-foreground">{v}</span>
              </div>
            ))}
          </div>

          <div>
            <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Personalization, section by section</div>
            <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
              {plan.map((p) => (
                <div key={p.section} className="flex items-start gap-2.5 border-b border-[color:var(--border-hairline)] px-3 py-2 last:border-b-0">
                  <span className="mt-0.5 w-[86px] shrink-0 text-[11px] font-semibold text-foreground">{getSectionDef(p.section)?.name ?? p.section}</span>
                  <span className="text-[11.5px] leading-snug text-muted-foreground">{p.note}</span>
                </div>
              ))}
            </div>
          </div>

          <p className="px-1 text-[11.5px] text-muted-foreground">
            Drafts only, undo in one click. Open any page afterwards to keep refining it with the agent.
          </p>
        </div>
      )}
    </GeneratorShell>
  );
}
