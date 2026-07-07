import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Check, ChevronDown, Mail, Minus } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { Segmented } from "@/components/ui/segmented";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import { DodoCheckoutDialog, type CheckoutLine } from "@/components/cms/billing/DodoCheckout";
import { projectActions, useCMS, workspaceActions } from "@/lib/cms/store";
import {
  ADDONS,
  CREDIT_PACKS,
  ENTERPRISE_TIERS,
  FEATURE_MATRIX,
  OVERAGE_PROMISE,
  PRO_SCALING,
  SEATS,
  SEAT_ORDER,
  SITE_PLANS,
  SITE_PLAN_ORDER,
  TEAM_NUDGE,
  WORKSPACE_PLANS,
  YEARLY_HEADLINE,
  fmtCompact,
  fmtGB,
  fmtUSD,
  proScalingOptions,
  sitePlanPrice,
  workspacePlanPrice,
  type BillingCycle,
  type ProScalableKey,
} from "@/lib/billing/pricing";
import type { Project, SitePlanId, WorkspacePlanId } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/settings/plans")({
  component: Plans,
});

const SCALING_KEYS: ProScalableKey[] = ["bandwidth", "storage", "api", "aiCredits", "locales"];
const SELF_SERVE_WS: WorkspacePlanId[] = ["free", "company", "agency"];

/** Key limits shown on each site plan card, formatted from the pricing model. */
function limitLines(planId: SitePlanId): string[] {
  const l = SITE_PLANS[planId].limits;
  return [
    l.bandwidthGB == null ? "Custom bandwidth" : `${fmtGB(l.bandwidthGB)} bandwidth`,
    l.storageGB == null ? "Custom asset storage" : `${fmtGB(l.storageGB)} asset storage`,
    l.apiRequests == null ? "Custom API volume" : `${fmtCompact(l.apiRequests)} API requests/mo`,
    l.aiCredits == null ? "Custom AI credits" : `${fmtCompact(l.aiCredits)} AI credits/mo`,
    l.locales == null ? "Custom locales" : l.locales === 0 ? "Single language" : `${l.locales} locales`,
    l.formSubmissions == null
      ? "Unlimited form submissions"
      : `${l.formSubmissions} form submissions/mo`,
  ];
}

interface PendingCheckout {
  title: string;
  lines: CheckoutLine[];
  apply: () => void;
}

interface PendingDowngrade {
  subject: string;
  planName: string;
  apply: () => void;
}

function Plans() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const wsProjects = useCMS((s) => (ws ? s.projects.filter((p) => p.workspaceId === ws.id) : []));

  const [cycle, setCycle] = useState<BillingCycle>("yearly");
  const [proScale, setProScale] = useState<Record<ProScalableKey, number>>(() => ({
    bandwidth: PRO_SCALING.bandwidth.base,
    storage: PRO_SCALING.storage.base,
    api: PRO_SCALING.api.base,
    aiCredits: PRO_SCALING.aiCredits.base,
    locales: PRO_SCALING.locales.base,
  }));
  const [pickPlan, setPickPlan] = useState<SitePlanId | null>(null);
  const [checkout, setCheckout] = useState<PendingCheckout | null>(null);
  const [downgrade, setDowngrade] = useState<PendingDowngrade | null>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);

  const proExtras = useMemo(() => {
    let sum = 0;
    for (const key of SCALING_KEYS) {
      const opt = proScalingOptions(key).find((o) => o.value === proScale[key]);
      sum += opt?.extraMonthly ?? 0;
    }
    return sum;
  }, [proScale]);

  const proScalingSummary = useMemo(() => {
    const parts: string[] = [];
    for (const key of SCALING_KEYS) {
      const def = PRO_SCALING[key];
      if (proScale[key] !== def.base) parts.push(`${def.label} ${def.format(proScale[key])}`);
    }
    return parts.join(", ");
  }, [proScale]);

  if (!ws) {
    return <SettingsHeader title="Plans" description={YEARLY_HEADLINE} />;
  }

  const wsPlan: WorkspacePlanId = ws.workspacePlan ?? "free";
  const managed = WORKSPACE_PLANS[wsPlan].managed === true;
  const managedContact = ws.billing?.managed;
  const proBase = sitePlanPrice("pro", cycle) ?? 0;

  function selectSiteForPlan(p: Project, target: SitePlanId) {
    const currentRank = SITE_PLAN_ORDER.indexOf(p.sitePlan ?? "free");
    const targetRank = SITE_PLAN_ORDER.indexOf(target);
    const label = p.domain ?? p.name;
    const planName = SITE_PLANS[target].name;
    setPickPlan(null);
    if (targetRank > currentRank) {
      const lines: CheckoutLine[] = [
        { label: `${label} · ${planName} site`, amount: sitePlanPrice(target, cycle) ?? 0 },
      ];
      if (target === "pro" && proExtras > 0) {
        lines.push({ label: "Pro scaling", detail: proScalingSummary, amount: proExtras });
      }
      setCheckout({
        title: `Move ${label} to ${planName}`,
        lines,
        apply: () => {
          projectActions.setSitePlan(p.id, target);
          toast.success(`${label} is now on ${planName}.`);
        },
      });
    } else {
      setDowngrade({
        subject: label,
        planName,
        apply: () => {
          projectActions.setSitePlan(p.id, target);
          toast.success("Done. No hard feelings.");
        },
      });
    }
  }

  function switchWorkspacePlan(target: WorkspacePlanId) {
    if (!ws || target === wsPlan) return;
    const planName = WORKSPACE_PLANS[target].name;
    const currentRank = SELF_SERVE_WS.indexOf(wsPlan);
    const targetRank = SELF_SERVE_WS.indexOf(target);
    if (targetRank > currentRank) {
      setCheckout({
        title: `Move ${ws.name} to ${planName}`,
        lines: [
          {
            label: `${planName} workspace`,
            detail: ws.name,
            amount: workspacePlanPrice(target, cycle) ?? 0,
          },
        ],
        apply: () => {
          workspaceActions.setWorkspacePlan(ws.id, target);
          toast.success(`${ws.name} is now a ${planName} workspace.`);
        },
      });
    } else {
      setDowngrade({
        subject: ws.name,
        planName,
        apply: () => {
          workspaceActions.setWorkspacePlan(ws.id, target);
          toast.success("Done. No hard feelings.");
        },
      });
    }
  }

  return (
    <>
      <SettingsHeader
        title="Plans"
        description={YEARLY_HEADLINE}
        action={
          <Segmented<BillingCycle>
            size="sm"
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        }
      />

      {managed && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-4 py-3">
          <p className="text-[13px] leading-relaxed text-foreground">
            Your plan is managed on an annual contract.{" "}
            {managedContact?.contactName ?? "Your account manager"} can change anything for you.
          </p>
          {managedContact?.contactEmail && (
            <Button asChild variant="secondary" size="sm">
              <a href={`mailto:${managedContact.contactEmail}`}>
                <Mail /> Email {managedContact.contactName.split(" ")[0]}
              </a>
            </Button>
          )}
        </div>
      )}

      {/* ── Site plans ─ each site carries its own plan ── */}
      <SettingsSection
        title="Site plans"
        description="Each site has its own plan. The workspace total is simply the sum of its parts."
        flush
      >
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {SITE_PLAN_ORDER.map((planId) => {
            const plan = SITE_PLANS[planId];
            const isPro = planId === "pro";
            const price = sitePlanPrice(planId, cycle);
            const selfServe = planId === "free" || planId === "basic" || planId === "pro";
            return (
              <div
                key={planId}
                className={`relative flex flex-col rounded-xl border p-4 ${
                  isPro
                    ? "border-primary/45 bg-primary/[0.04]"
                    : "border-[color:var(--border-hairline)] bg-[color:var(--s1)]"
                }`}
              >
                {isPro && (
                  <span className="absolute -top-2.5 left-4 rounded-full bg-primary px-2 py-0.5 text-[10.5px] font-semibold leading-4 text-primary-foreground">
                    Most sites land here
                  </span>
                )}

                <div className="flex items-baseline gap-1.5">
                  <span className="text-[14px] font-semibold text-foreground">{plan.name}</span>
                  {plan.subName && (
                    <span className="text-[12px] text-muted-foreground">{plan.subName}</span>
                  )}
                </div>

                <div className="mt-2">
                  {planId === "team" ? (
                    <>
                      <div className="text-[20px] font-semibold tracking-tight text-foreground">
                        from $1,500<span className="text-[12px] font-normal text-muted-foreground">/mo</span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">annual only</div>
                    </>
                  ) : planId === "enterprise" ? (
                    <>
                      <div className="text-[20px] font-semibold tracking-tight text-foreground">Custom</div>
                      <div className="text-[11.5px] text-muted-foreground">annual contract, invoice or PO</div>
                    </>
                  ) : (
                    <>
                      <div className="text-[20px] font-semibold tracking-tight tabular-nums text-foreground">
                        {fmtUSD(price ?? 0)}
                        <span className="text-[12px] font-normal text-muted-foreground">/mo</span>
                      </div>
                      <div className="text-[11.5px] text-muted-foreground">
                        {price === 0
                          ? "No card needed"
                          : cycle === "yearly"
                            ? `${fmtUSD((price ?? 0) * 12)} billed once a year`
                            : "billed monthly"}
                      </div>
                    </>
                  )}
                </div>

                <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">{plan.bestFor}</p>

                <ul className="mt-3 space-y-1.5">
                  {limitLines(planId).map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[12px] text-foreground/90">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {isPro && (
                  <div className="mt-3 space-y-1.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--card)] p-2.5">
                    <div className="pb-0.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                      Scale what you need
                    </div>
                    {SCALING_KEYS.map((key) => {
                      const def = PRO_SCALING[key];
                      return (
                        <div key={key} className="grid grid-cols-[84px_minmax(0,1fr)] items-center gap-2">
                          <div className="text-[11.5px] text-muted-foreground">{def.label}</div>
                          <Select
                            value={String(proScale[key])}
                            onValueChange={(v) => setProScale((s) => ({ ...s, [key]: Number(v) }))}
                          >
                            <SelectTrigger className="h-7 px-2 text-[12px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="mb-1 max-w-[250px] whitespace-normal border-b border-[color:var(--border-hairline)] px-2.5 pb-2 pt-1.5 text-[11px] leading-snug text-muted-foreground">
                                {TEAM_NUDGE}
                              </div>
                              {proScalingOptions(key).map((o) => (
                                <SelectItem key={o.value} value={String(o.value)}>
                                  {o.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      );
                    })}
                    {proExtras > 0 ? (
                      <div className="pt-1 text-[12px] font-medium tabular-nums text-foreground">
                        {fmtUSD(proBase)}/mo + {fmtUSD(proExtras)} in scaling = {fmtUSD(proBase + proExtras)}/mo
                      </div>
                    ) : (
                      <div className="pt-1 text-[11.5px] text-muted-foreground">
                        Included amounts selected. Scale any time.
                      </div>
                    )}
                  </div>
                )}

                {!managed && (
                  <div className="mt-auto pt-4">
                    {selfServe ? (
                      <Button
                        size="sm"
                        variant={isPro ? "default" : "secondary"}
                        className="w-full"
                        onClick={() => setPickPlan(planId)}
                      >
                        Choose {plan.name}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full"
                        onClick={() => setContactOpen(true)}
                      >
                        Talk to us
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Workspace plans ── */}
      <SettingsSection
        title="Workspace plans"
        description="The team container. Projects and people live here, sites are priced separately above."
        flush
      >
        <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-3">
          {SELF_SERVE_WS.map((planId) => {
            const plan = WORKSPACE_PLANS[planId];
            const price = workspacePlanPrice(planId, cycle);
            const current = planId === wsPlan;
            return (
              <div
                key={planId}
                className={`flex flex-col rounded-xl border p-4 ${
                  current
                    ? "border-primary/45 bg-primary/[0.04]"
                    : "border-[color:var(--border-hairline)] bg-[color:var(--s1)]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-foreground">{plan.name}</span>
                  {current && (
                    <span className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-[10.5px] font-semibold leading-4 text-primary">
                      Current
                    </span>
                  )}
                </div>

                <div className="mt-2">
                  <div className="text-[20px] font-semibold tracking-tight tabular-nums text-foreground">
                    {fmtUSD(price ?? 0)}
                    <span className="text-[12px] font-normal text-muted-foreground">/mo</span>
                  </div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {price === 0
                      ? "No card needed"
                      : cycle === "yearly"
                        ? `${fmtUSD((price ?? 0) * 12)} billed once a year`
                        : "billed monthly"}
                  </div>
                </div>

                <ul className="mt-3 space-y-1.5">
                  {plan.includes.map((line) => (
                    <li key={line} className="flex items-start gap-2 text-[12px] text-foreground/90">
                      <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" strokeWidth={2.5} />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>

                {planId === "agency" && (
                  <p className="mt-2 text-[11.5px] text-muted-foreground">
                    White-label is an Agency workspace feature.
                  </p>
                )}

                {!managed && (
                  <div className="mt-auto pt-4">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="w-full"
                      disabled={current}
                      onClick={() => switchWorkspacePlan(planId)}
                    >
                      {current ? "Current plan" : `Switch to ${plan.name}`}
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </SettingsSection>

      {/* ── Seats ── */}
      <SettingsSection
        title="Seats"
        description="Viewer and reviewer seats are free and unlimited on every plan. You only pay for editor seats."
        flush
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-[12.5px]">
            <thead>
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th className="px-5 py-2.5 font-semibold">Seat</th>
                <th className="px-3 py-2.5 font-semibold">What they do</th>
                <th className="px-5 py-2.5 text-right font-semibold">Price</th>
              </tr>
            </thead>
            <tbody>
              {SEAT_ORDER.map((role) => {
                const seat = SEATS[role];
                return (
                  <tr key={role} className="border-t border-[color:var(--border-hairline)]">
                    <td className="px-5 py-2.5 font-medium text-foreground">{seat.label}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{seat.what}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums text-foreground">
                      {seat.monthly === 0 ? (
                        <span className="text-muted-foreground">Free, unlimited</span>
                      ) : (
                        `${fmtUSD(seat.monthly)}/mo`
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SettingsSection>

      {/* ── Add ons and credit packs ── */}
      <SettingsSection
        title="Add ons and AI credit packs"
        description="Top up exactly what you need. Every price is flat and listed here."
        flush
      >
        <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
          <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
            <div className="border-b border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Add ons
            </div>
            {ADDONS.map((a, i) => (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-3 px-4 py-2.5 ${
                  i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-[12.5px] text-foreground">{a.label}</div>
                  {a.max && <div className="text-[11px] text-muted-foreground">{a.max}</div>}
                </div>
                <div className="shrink-0 text-[12.5px] tabular-nums text-foreground">{a.price}</div>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
            <div className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[color:var(--border-hairline)] bg-[color:var(--s1)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <span>AI credit pack</span>
              <span className="text-right">Price</span>
              <span className="w-[64px] text-right">Per credit</span>
            </div>
            {CREDIT_PACKS.map((p, i) => (
              <div
                key={p.credits}
                className={`grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 ${
                  i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""
                }`}
              >
                <span className="text-[12.5px] tabular-nums text-foreground">
                  {p.credits.toLocaleString("en-US")} credits
                </span>
                <span className="text-right text-[12.5px] tabular-nums text-foreground">
                  {fmtUSD(p.price)}
                </span>
                <span className="w-[64px] text-right text-[12px] tabular-nums text-muted-foreground">
                  ${p.perCredit.toFixed(4)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="px-4 pb-4 text-[12px] leading-relaxed text-muted-foreground">{OVERAGE_PROMISE}</p>
      </SettingsSection>

      {/* ── Feature matrix ── */}
      <SettingsSection
        title="Compare everything"
        description="Every feature across the five site plans."
        flush={compareOpen}
        action={
          <Button size="sm" variant="secondary" onClick={() => setCompareOpen((o) => !o)}>
            {compareOpen ? "Hide comparison" : "Compare everything"}
            <ChevronDown className={`transition-transform ${compareOpen ? "rotate-180" : ""}`} />
          </Button>
        }
      >
        {compareOpen ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[12.5px]">
              <thead>
                <tr className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-5 py-2.5 text-left font-semibold">Feature</th>
                  {SITE_PLAN_ORDER.map((pid) => (
                    <th key={pid} className="px-3 py-2.5 text-center font-semibold">
                      {SITE_PLANS[pid].name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {FEATURE_MATRIX.map((row) => (
                  <tr key={row.key} className="border-t border-[color:var(--border-hairline)]">
                    <td className="px-5 py-2 text-foreground">{row.label}</td>
                    {SITE_PLAN_ORDER.map((pid) => {
                      const v = row.values[pid];
                      return (
                        <td key={pid} className="px-3 py-2 text-center">
                          {v === true ? (
                            <Check className="mx-auto h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} />
                          ) : v === false ? (
                            <Minus className="mx-auto h-3.5 w-3.5 text-muted-foreground/40" />
                          ) : (
                            <span className="text-[12px] text-muted-foreground">{v}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-3 text-[12.5px] text-muted-foreground">
            {FEATURE_MATRIX.length} features across five plans, from hosting and AI to governance and
            support.
          </p>
        )}
      </SettingsSection>

      {/* ── Enterprise tiers ── */}
      <SettingsSection
        title="Enterprise tiers"
        description="Where the managed plans start. Every deal is shaped with a human."
        flush
        action={
          !managed ? (
            <Button size="sm" variant="secondary" onClick={() => setContactOpen(true)}>
              Talk to us
            </Button>
          ) : undefined
        }
      >
        {ENTERPRISE_TIERS.map((tier, i) => (
          <div
            key={tier.name}
            className={`grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[140px_140px_minmax(0,1fr)] sm:gap-4 ${
              i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""
            }`}
          >
            <div className="text-[13px] font-medium text-foreground">{tier.name}</div>
            <div className="text-[12.5px] tabular-nums text-foreground">{tier.startingPrice}</div>
            <div className="text-[12px] leading-relaxed text-muted-foreground">{tier.adds}</div>
          </div>
        ))}
      </SettingsSection>

      {/* ── Site picker dialog for self serve plans ── */}
      <Dialog open={pickPlan != null} onOpenChange={(o) => !o && setPickPlan(null)}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>
              Choose a site for {pickPlan ? SITE_PLANS[pickPlan].name : ""}
            </DialogTitle>
            <DialogDescription>
              Pick which site moves to the {pickPlan ? SITE_PLANS[pickPlan].name : ""} plan. Every
              number shows before anything changes.
            </DialogDescription>
          </DialogHeader>
          {wsProjects.length === 0 ? (
            <p className="py-2 text-[12.5px] text-muted-foreground">No sites in this workspace yet.</p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-[color:var(--border-hairline)]">
              {wsProjects.map((p, i) => {
                const currentPlan = p.sitePlan ?? "free";
                const same = currentPlan === pickPlan;
                const isUpgrade =
                  pickPlan != null &&
                  SITE_PLAN_ORDER.indexOf(pickPlan) > SITE_PLAN_ORDER.indexOf(currentPlan);
                return (
                  <button
                    key={p.id}
                    type="button"
                    disabled={same}
                    onClick={() => pickPlan && selectSiteForPlan(p, pickPlan)}
                    className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""
                    } ${same ? "cursor-default opacity-60" : "cursor-pointer hover:bg-[color:var(--row-hover)]"}`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-[13px] text-foreground">{p.domain ?? p.name}</span>
                      <SitePlanBadge plan={currentPlan} />
                    </div>
                    <span className="shrink-0 text-[11.5px] text-muted-foreground">
                      {same ? "Current" : isUpgrade ? "Upgrade" : "Downgrade"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Calm downgrade confirm, no checkout ── */}
      <Dialog open={downgrade != null} onOpenChange={(o) => !o && setDowngrade(null)}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              Move {downgrade?.subject} to {downgrade?.planName}
            </DialogTitle>
            <DialogDescription>
              Takes effect right away in this demo. Downgrades never need a checkout.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="secondary" onClick={() => setDowngrade(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => {
                downgrade?.apply();
                setDowngrade(null);
              }}
            >
              Move to {downgrade?.planName}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Contact dialog for Team and Enterprise ── */}
      <ContactDialog open={contactOpen} onOpenChange={setContactOpen} />

      {/* ── Test mode checkout ── */}
      <DodoCheckoutDialog
        open={checkout != null}
        onOpenChange={(o) => !o && setCheckout(null)}
        title={checkout?.title ?? ""}
        lines={checkout?.lines ?? []}
        cycle={cycle}
        onComplete={() => checkout?.apply()}
      />
    </>
  );
}

function ContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");

  function submit() {
    toast.success("Thanks, we will reach out within a day.");
    setName("");
    setEmail("");
    setMessage("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Talk to us</DialogTitle>
          <DialogDescription>
            Tell us a little about your setup and a human will get back to you.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="contact-name">Name</Label>
            <Input
              id="contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-email">Email</Label>
            <Input
              id="contact-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="contact-message">Message</Label>
            <Textarea
              id="contact-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="What are you building, and roughly how big is the team?"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button size="sm" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={submit} disabled={!name.trim() || !email.trim()}>
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
