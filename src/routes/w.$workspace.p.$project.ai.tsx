import { createFileRoute, Link } from "@tanstack/react-router";
import * as React from "react";
import { Check, Loader2, Lock, Sparkles } from "lucide-react";
import { PageShell } from "@/components/cms/layout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import { useCMS } from "@/lib/cms/store";
import {
  AI_ACTIONS,
  AI_TIER_ORDER,
  AI_TIERS,
  aiAction,
  SITE_PLANS,
  tierAllowed,
  tierGateNote,
  usageState,
  USAGE_STATE_NOTE,
  type AiTier,
} from "@/lib/billing/pricing";
import { creditHistory, type CreditEvent } from "@/lib/billing/demo";
import type { SitePlanId } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/w/$workspace/p/$project/ai")({
  component: AIBuilderPage,
});

/* ─── helpers ─── */

const TIER_LABEL: Record<AiTier, "Lite" | "Balanced" | "Max"> = {
  lite: "Lite",
  balanced: "Balanced",
  max: "Max",
};

/**
 * Resolve the effective tier for an action. Keeps the current pick when it is
 * both offered and allowed. Otherwise prefers Balanced when allowed, then
 * Lite, then the first tier the action offers at all.
 */
function pickTier(plan: SitePlanId, actionId: string, current?: AiTier): AiTier {
  const action = aiAction(actionId);
  const has = (t: AiTier) => action?.costs[t] != null;
  if (current && has(current) && tierAllowed(plan, current, actionId)) return current;
  if (has("balanced") && tierAllowed(plan, "balanced", actionId)) return "balanced";
  if (has("lite")) return "lite";
  const allowed = AI_TIER_ORDER.find((t) => has(t) && tierAllowed(plan, t, actionId));
  return allowed ?? AI_TIER_ORDER.find(has) ?? "lite";
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface SessionRun {
  id: string;
  label: string;
  tier: CreditEvent["tier"];
  credits: number;
}

/* ─── page ─── */

function AIBuilderPage() {
  const { workspace, project } = Route.useParams();
  const pr = useCMS((s) => {
    const ws = s.workspaces.find((w) => w.slug === workspace);
    if (!ws) return undefined;
    return s.projects.find((p) => p.workspaceId === ws.id && p.slug === project);
  });

  const plan: SitePlanId = pr?.sitePlan ?? "free";

  const [actionId, setActionId] = React.useState("page");
  const [tierState, setTierState] = React.useState<AiTier>("balanced");
  const [prompt, setPrompt] = React.useState("");
  const [running, setRunning] = React.useState(false);
  const [done, setDone] = React.useState(false);
  const [gateTier, setGateTier] = React.useState<AiTier | null>(null);
  const [sessionRuns, setSessionRuns] = React.useState<SessionRun[]>([]);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const history = React.useMemo(() => (pr ? creditHistory(pr) : []), [pr]);

  // Derived, always valid for the current action and plan.
  const tier = pickTier(plan, actionId, tierState);
  const action = aiAction(actionId);
  const cost = action?.costs[tier];
  const tierOk = tierAllowed(plan, tier, actionId);

  const included = SITE_PLANS[plan].limits.aiCredits;
  const seededUsed = pr?.usage?.aiCreditsUsed ?? 0;
  const sessionSpend = sessionRuns.reduce((s, r) => s + r.credits, 0);
  const usedTotal = seededUsed + sessionSpend;
  const balance = included == null ? null : Math.max(0, included - usedTotal);
  const insufficient = cost != null && balance != null && cost > balance;
  const canRun = !running && cost != null && tierOk && !insufficient;

  const state = usageState(usedTotal, included);
  const barTone =
    state === "over" ? "bg-sky-500" : state === "approaching" ? "bg-amber-500" : "bg-emerald-500";
  const barPct = included ? Math.min(100, (usedTotal / included) * 100) : 0;

  const noteTier = gateTier ?? (!tierOk ? tier : null);
  const gateNote = noteTier ? tierGateNote(plan, noteTier) : "";

  function onActionChange(id: string) {
    setActionId(id);
    setTierState(pickTier(plan, id, tier));
    setDone(false);
  }

  function onTierClick(t: AiTier) {
    if (!tierAllowed(plan, t, actionId) || action?.costs[t] == null) return;
    setTierState(t);
    setDone(false);
  }

  function run() {
    if (!canRun || cost == null || !action) return;
    const runTier: CreditEvent["tier"] = action.isImage ? "Image" : TIER_LABEL[tier];
    const runLabel = action.label;
    const runCost = cost;
    setDone(false);
    setRunning(true);
    timerRef.current = setTimeout(() => {
      setSessionRuns((prev) => [
        { id: `run-${Date.now()}`, label: runLabel, tier: runTier, credits: runCost },
        ...prev,
      ]);
      setRunning(false);
      setDone(true);
    }, 1200);
  }

  if (!pr) {
    return (
      <PageShell
        breadcrumbs={[
          { label: workspace, to: "/w/$workspace", params: { workspace } },
          { label: project },
        ]}
        title="AI builder"
        width="default"
      >
        <p className="text-[13px] text-muted-foreground">This project could not be found.</p>
      </PageShell>
    );
  }

  return (
    <PageShell
      breadcrumbs={[
        { label: workspace, to: "/w/$workspace", params: { workspace } },
        {
          label: pr.name,
          to: "/w/$workspace/p/$project/editor",
          params: { workspace, project },
        },
        { label: "AI builder" },
      ]}
      eyebrow="AI"
      title="AI builder"
      description="Build pages and content with credits. Every run shows its cost before it starts."
      width="default"
    >
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* ─── Left: composer ─── */}
        <div className="rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)] p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[13.5px] font-semibold text-foreground">Composer</div>
            <SitePlanBadge plan={plan} />
          </div>

          {/* Action */}
          <div className="mt-4">
            <label className="text-[12px] font-medium text-foreground" htmlFor="ai-action">
              Action
            </label>
            <div className="mt-1.5">
              <Select value={actionId} onValueChange={onActionChange}>
                <SelectTrigger id="ai-action" disabled={running}>
                  <SelectValue placeholder="Pick an action" />
                </SelectTrigger>
                <SelectContent>
                  {AI_ACTIONS.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quality tier */}
          <div className="mt-4">
            <span className="text-[12px] font-medium text-foreground">Quality tier</span>
            <div
              role="radiogroup"
              aria-label="Quality tier"
              className="mt-1.5 grid grid-cols-3 gap-0.5 rounded-lg border border-border p-0.5"
            >
              {AI_TIER_ORDER.map((t) => {
                const allowed = tierAllowed(plan, t, actionId);
                const offered = action?.costs[t] != null;
                const active = t === tier;
                const disabled = !allowed || !offered;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-disabled={disabled}
                    onClick={() => onTierClick(t)}
                    onMouseEnter={() => {
                      if (!allowed) setGateTier(t);
                    }}
                    onMouseLeave={() => setGateTier((g) => (g === t ? null : g))}
                    onFocus={() => {
                      if (!allowed) setGateTier(t);
                    }}
                    onBlur={() => setGateTier((g) => (g === t ? null : g))}
                    title={allowed && !offered ? "Not available for this action" : undefined}
                    className={cn(
                      "inline-flex h-8 items-center justify-center gap-1.5 rounded-md text-[12px] font-medium transition-colors duration-[120ms]",
                      active
                        ? "bg-[var(--s3)] text-foreground"
                        : "text-muted-foreground",
                      disabled
                        ? "cursor-not-allowed opacity-55"
                        : "cursor-pointer hover:bg-[var(--s4)]/60 hover:text-foreground",
                    )}
                  >
                    {AI_TIERS[t].label}
                    {!allowed && <Lock className="h-3 w-3" aria-hidden />}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-muted-foreground">{AI_TIERS[tier].bestAt}</p>
            {gateNote && (
              <p className="mt-1 text-[12px] text-muted-foreground">
                {gateNote}{" "}
                <Link
                  to="/w/$workspace/settings/plans"
                  params={{ workspace }}
                  className="font-medium text-primary hover:underline"
                >
                  See plans
                </Link>
              </p>
            )}
          </div>

          {/* Prompt */}
          <div className="mt-4">
            <label className="text-[12px] font-medium text-foreground" htmlFor="ai-prompt">
              Prompt
            </label>
            <Textarea
              id="ai-prompt"
              className="mt-1.5 min-h-[120px]"
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                setDone(false);
              }}
              placeholder="Describe the page you want. Sections, tone, audience."
              disabled={running}
            />
          </div>

          {/* Preflight + run */}
          <div className="mt-5 border-t border-[color:var(--border-hairline)] pt-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0 text-[13px] leading-relaxed">
                {cost != null ? (
                  <>
                    <span className="font-medium text-foreground">
                      This run will use {cost.toLocaleString()} credits
                      {action?.isImage ? " · image action" : ""}
                    </span>
                    {balance != null && !insufficient && (
                      <span className="ml-2 text-[12.5px] text-muted-foreground">
                        {(balance - cost).toLocaleString()} left after this run
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">
                    Pick a quality tier this action offers.
                  </span>
                )}
              </div>
              <Button size="sm" className="gap-1.5" onClick={run} disabled={!canRun}>
                {running ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Running
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5" aria-hidden />
                    Run
                  </>
                )}
              </Button>
            </div>

            {insufficient && (
              <p className="mt-2 text-[12px] text-muted-foreground">
                Not enough credits left this month. Top up from the{" "}
                <Link
                  to="/w/$workspace/settings/plans"
                  params={{ workspace }}
                  className="font-medium text-primary hover:underline"
                >
                  plan page
                </Link>
                .
              </p>
            )}

            {running && (
              <div className="mt-3">
                <RunProgress />
                <p className="mt-1.5 text-[12px] text-muted-foreground">Building your draft.</p>
              </div>
            )}

            {done && !running && (
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <Check className="h-3.5 w-3.5" aria-hidden />
                Draft ready. Find it in your pages as a draft.
              </p>
            )}
          </div>
        </div>

        {/* ─── Right: credits panel ─── */}
        <div className="space-y-6">
          {/* Balance card */}
          <div className="rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Credits
            </div>

            {included != null && balance != null ? (
              <>
                <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                  {balance.toLocaleString()}{" "}
                  <span className="text-[13px] font-normal tracking-normal text-muted-foreground">
                    credits left
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">
                  {plan === "free"
                    ? `of ${included.toLocaleString()} trial credits`
                    : `of ${included.toLocaleString()} included monthly`}
                </div>
                <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full rounded-full", barTone)}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                {USAGE_STATE_NOTE[state] && (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    {USAGE_STATE_NOTE[state]}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-foreground tabular-nums">
                  {usedTotal.toLocaleString()}{" "}
                  <span className="text-[13px] font-normal tracking-normal text-muted-foreground">
                    credits used
                  </span>
                </div>
                <div className="mt-1 text-[12px] text-muted-foreground">Custom allowance</div>
              </>
            )}

            {plan === "free" && (
              <p className="mt-3 border-t border-[color:var(--border-hairline)] pt-3 text-[12px] text-muted-foreground">
                You are on trial credits, 100 to try things out. Paid plans refill monthly.
              </p>
            )}
          </div>

          {/* Recent activity */}
          <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)]">
            <div className="border-b border-[color:var(--border-hairline)] px-5 py-3 text-[13px] font-semibold text-foreground">
              Recent activity
            </div>
            <ul className="divide-y divide-[color:var(--border-hairline)]">
              {sessionRuns.map((r) => (
                <ActivityRow
                  key={r.id}
                  label={r.label}
                  tier={r.tier}
                  credits={r.credits}
                  meta="You · just now"
                />
              ))}
              {history.map((e) => (
                <ActivityRow
                  key={e.id}
                  label={e.label}
                  tier={e.tier}
                  credits={e.credits}
                  meta={`${e.actor} · ${fmtWhen(e.when)}`}
                />
              ))}
              {sessionRuns.length === 0 && history.length === 0 && (
                <li className="px-5 py-4 text-[12.5px] text-muted-foreground">
                  No runs yet this period.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

/* ─── pieces ─── */

function RunProgress() {
  const [w, setW] = React.useState(0);
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setW(100));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${w}%`, transition: "width 1.15s linear" }}
      />
    </div>
  );
}

const TIER_CHIP_TONE: Record<CreditEvent["tier"], string> = {
  Lite: "border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-400",
  Balanced: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
  Max: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Image: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

function TierChip({ tier }: { tier: CreditEvent["tier"] }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none",
        TIER_CHIP_TONE[tier],
      )}
    >
      {tier}
    </span>
  );
}

function ActivityRow({
  label,
  tier,
  credits,
  meta,
}: {
  label: string;
  tier: CreditEvent["tier"];
  credits: number;
  meta: string;
}) {
  return (
    <li className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[12.5px] font-medium text-foreground">{label}</span>
          <TierChip tier={tier} />
        </div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{meta}</div>
      </div>
      <span className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground">
        -{credits.toLocaleString()} credits
      </span>
    </li>
  );
}
