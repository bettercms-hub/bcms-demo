/**
 * AbmPageDialog — one personalized page for one target account.
 *
 * Account context in, a personalized draft page out, then straight into the
 * visual editor with the agent dock open so refinement continues in place.
 * ABM pages default to noindex: they are for the account, not for search.
 */
import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, Check, Loader2, Lock, Sparkles, Users } from "lucide-react";
import { PAGE_TEMPLATES, getSectionDef } from "@/components/cms/editor/sections/SectionSystem";
import { abmPersonalizationPlan, slugifyKeyword } from "@/lib/agent/generate";
import { agentDock } from "@/lib/agent/dock-store";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { aiAction, tierAllowed } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { GeneratorShell, GenField, genInput } from "./GeneratorShell";

const COST = aiAction("abm-page")?.costs.balanced ?? 60;

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
  const [account, setAccount] = useState("");
  const [context, setContext] = useState("");
  const [templateId, setTemplateId] = useState("landing");
  const [runId, setRunId] = useState<string | null>(null);

  const runs = useAgentRuns(projectId);
  const run = runId ? runs.find((r) => r.id === runId) : undefined;
  const finished = run?.status === "done";
  const pagePath = run?.proposals[0]?.targetId;

  function generate() {
    const id = agentRunActions.startGenerator({ projectId, kind: "abm", config: { account, context, templateId } });
    if (id) setRunId(id);
  }

  function openInEditor() {
    if (!pagePath) return;
    onClose();
    // The run thread rides along in the dock so refinement continues in place.
    agentDock.show(runId);
    navigate({ to: "/w/$workspace/p/$project/visual", params: { workspace, project }, search: { page: pagePath } });
  }

  /* ------------------------------------------------------------- locked */

  if (!allowed) {
    return (
      <GeneratorShell icon={Users} title="ABM page" subtitle="A page for one target account" step={0} stepCount={1} onClose={onClose}>
        <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--s2)] p-8 text-center">
          <Lock className="mx-auto h-6 w-6 text-muted-foreground" />
          <h3 className="mt-3 text-[13.5px] font-semibold text-foreground">ABM pages are on Pro and above</h3>
          <p className="mx-auto mt-1 max-w-[360px] text-[12px] text-muted-foreground">
            Generate a page personalized for one account from your brand, sections and their context, ready before the next call.
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
      <GeneratorShell icon={Users} title="ABM page" subtitle={finished ? "Done" : `Generating for ${account}`} step={1} stepCount={2} onClose={onClose}>
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
              <div className="mt-2 text-[13.5px] font-semibold text-foreground">Draft ready for {account}</div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">
                <span className="font-mono text-[11px]">{pagePath}</span>, set to noindex. Open it to refine with the agent alongside.
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <Button size="sm" onClick={openInEditor}>Open in editor</Button>
                <Button size="sm" variant="ghost" onClick={onClose}>Close</Button>
              </div>
            </div>
          )}
        </div>
      </GeneratorShell>
    );
  }

  /* ------------------------------------------------------------- wizard */

  const plan = abmPersonalizationPlan(projectId, { account, context, templateId });

  const footer =
    step === 0 ? (
      <>
        <span className="text-[11.5px] text-muted-foreground">Uses your brand voice and section catalog with this context.</span>
        <Button size="sm" disabled={account.trim().length === 0 || context.trim().length < 20} onClick={() => setStep(1)}>
          Continue <ArrowRight className="ml-1 h-3.5 w-3.5" />
        </Button>
      </>
    ) : (
      <>
        <Button size="sm" variant="ghost" onClick={() => setStep(0)}>
          <ArrowLeft className="mr-1 h-3.5 w-3.5" /> Back
        </Button>
        <Button size="sm" onClick={generate}>
          <Sparkles className="mr-1 h-3.5 w-3.5" /> Generate page, {COST} credits
        </Button>
      </>
    );

  return (
    <GeneratorShell
      icon={Users}
      title="ABM page"
      subtitle={step === 0 ? "Target account context" : "What gets personalized"}
      step={step}
      stepCount={2}
      onClose={onClose}
      footer={footer}
    >
      {step === 0 && (
        <div className="space-y-3">
          <GenField label="Account name">
            <input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="Lumina" className={genInput} />
          </GenField>
          <GenField label="Target account context" hint="Who this page is for and what we should know about them. Two or three sentences is plenty.">
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              rows={5}
              placeholder="300-rep sales team, moving off spreadsheets for forecasting. VP Sales wants deal-risk scoring before the Q3 board review."
              className="w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] p-2.5 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]"
            />
          </GenField>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <div className="mb-1.5 text-[11.5px] font-medium text-muted-foreground">Start from</div>
            <div className="grid grid-cols-2 gap-2">
              {PAGE_TEMPLATES.filter((t) => ["landing", "case-study"].includes(t.id)).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTemplateId(t.id)}
                  className={cn(
                    "flex items-center gap-2.5 rounded-lg border p-2.5 text-left transition-colors",
                    templateId === t.id
                      ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                      : "border-[color:var(--border-hairline)] hover:border-[color:var(--color-border-strong)]",
                  )}
                >
                  <t.icon className={cn("h-4 w-4 shrink-0", templateId === t.id ? "text-primary" : "text-muted-foreground")} />
                  <span>
                    <span className="block text-[12.5px] font-medium text-foreground">{t.name}</span>
                    <span className="block text-[10.5px] text-muted-foreground">{t.blurb}</span>
                  </span>
                </button>
              ))}
            </div>
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

          <div className="rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-2 text-[11.5px] text-muted-foreground">
            Lands as a draft at <span className="font-mono text-[11px] text-foreground">/for/{slugifyKeyword(account || "account")}</span>, set to noindex.
            The page is for {account.trim() || "the account"}, not for search engines.
          </div>
        </div>
      )}
    </GeneratorShell>
  );
}
