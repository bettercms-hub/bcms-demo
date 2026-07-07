import { Link, createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Lock, Mail } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import { DodoCheckoutDialog, type CheckoutLine } from "@/components/cms/billing/DodoCheckout";
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
import { useCMS, projectActions } from "@/lib/cms/store";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import {
  CREDIT_PACKS,
  PRO_SCALING,
  SITE_PLANS,
  SITE_PLAN_ORDER,
  TEAM_NUDGE,
  featureRow,
  firstPlanWith,
  fmtCompact,
  fmtGB,
  fmtUSD,
  proScalingOptions,
  sitePlanPrice,
  type ProScalableKey,
} from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/p/$project/settings/plan")({
  component: PlanAndUsage,
});

const SCALE_KEYS: ProScalableKey[] = ["bandwidth", "storage", "api", "aiCredits", "locales"];

const FEATURE_KEYS = [
  "custom-domain",
  "seo",
  "analytics",
  "branching",
  "workflows",
  "ai-traffic",
  "aeo-agents",
  "ab-testing",
  "byo-cdn",
  "own-cloud",
  "sso",
  "support",
];

function priceLine(plan: SitePlanId): string {
  if (plan === "free") return "$0";
  if (plan === "team") return "from $1,500/mo on an annual contract";
  if (plan === "enterprise") return "Custom agreement";
  const p = sitePlanPrice(plan, "yearly") ?? 0;
  return `${fmtUSD(p)}/mo, billed yearly`;
}

function fmtPerCredit(perCredit: number): string {
  return `$${perCredit.toFixed(4).replace(/0+$/, "")} per credit`;
}

function PlanAndUsage() {
  const { workspace, project } = Route.useParams();
  const ws = getWorkspaceBySlug(workspace);
  const pr = useCMS((s) =>
    s.projects.find((p) => p.slug === project && (ws ? p.workspaceId === ws.id : true)),
  );

  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [downgradeOpen, setDowngradeOpen] = useState(false);
  const [scaling, setScaling] = useState<Record<ProScalableKey, number>>(() => ({
    bandwidth: PRO_SCALING.bandwidth.base,
    storage: PRO_SCALING.storage.base,
    api: PRO_SCALING.api.base,
    aiCredits: PRO_SCALING.aiCredits.base,
    locales: PRO_SCALING.locales.base,
  }));
  const [scaleCheckoutOpen, setScaleCheckoutOpen] = useState(false);
  const [packIdx, setPackIdx] = useState<number | null>(null);
  const [packCheckoutOpen, setPackCheckoutOpen] = useState(false);
  // In-settings plan catalog: buy an upgrade, or confirm a downgrade.
  const [buyPlan, setBuyPlan] = useState<SitePlanId | null>(null);
  const [switchDown, setSwitchDown] = useState<SitePlanId | null>(null);

  if (!pr) {
    return (
      <>
        <SettingsHeader title="Plan and usage" description="Plan, usage and features for this site." />
        <p className="text-[13px] text-muted-foreground">Project not found.</p>
      </>
    );
  }

  const plan: SitePlanId = pr.sitePlan ?? "free";
  const def = SITE_PLANS[plan];
  const domain = pr.domain ?? pr.name;
  const usage = pr.usage;
  const managed = plan === "team" || plan === "enterprise";
  const contact = ws?.billing?.managed;

  const planIdx = SITE_PLAN_ORDER.indexOf(plan);
  const nextPlan: SitePlanId | undefined =
    plan === "free" || plan === "basic" ? SITE_PLAN_ORDER[planIdx + 1] : undefined;
  const prevPlan: SitePlanId | undefined =
    plan === "basic" || plan === "pro" ? SITE_PLAN_ORDER[planIdx - 1] : undefined;

  // Pro scaling totals
  const proPrice = sitePlanPrice("pro", "yearly") ?? 0;
  const scalingExtras = SCALE_KEYS.reduce((sum, key) => {
    const opt = proScalingOptions(key).find((o) => o.value === scaling[key]);
    return sum + (opt?.extraMonthly ?? 0);
  }, 0);
  const scalingLines: CheckoutLine[] = [
    { label: domain, detail: "Pro site", amount: proPrice },
    ...SCALE_KEYS.flatMap((key) => {
      const opt = proScalingOptions(key).find((o) => o.value === scaling[key]);
      if (!opt || opt.extraMonthly === 0) return [];
      return [
        {
          label: `${PRO_SCALING[key].label} to ${PRO_SCALING[key].format(opt.value)}`,
          detail: "Scaling",
          amount: opt.extraMonthly,
        },
      ];
    }),
  ];

  // AI credits
  const included = def.limits.aiCredits;
  const creditsUsed = usage?.aiCreditsUsed ?? 0;
  const remaining = included != null ? Math.max(0, included - creditsUsed) : null;
  const pack = packIdx != null ? CREDIT_PACKS[packIdx] : null;

  return (
    <>
      <SettingsHeader
        title="Plan"
        description={`The plan, scaling, AI credits and features for ${domain}. See live consumption on the Usage page.`}
      />

      {/* ── Current plan ── */}
      <SettingsSection
        title="Current plan"
        description="This site's line on the workspace bill. Changes apply right away."
      >
        <div className="py-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <SitePlanBadge plan={plan} />
                <span className="text-[15px] font-semibold text-foreground">{def.name}</span>
                {def.subName && (
                  <span className="text-[12px] text-muted-foreground">{def.subName}</span>
                )}
              </div>
              <div className="mt-1.5 text-[13px] tabular-nums text-foreground">{priceLine(plan)}</div>
              <div className="mt-1 text-[12px] text-muted-foreground">Best for: {def.bestFor}</div>
            </div>
            {!managed && (
              <div className="flex shrink-0 items-center gap-3">
                {prevPlan && (
                  <button
                    type="button"
                    onClick={() => setDowngradeOpen(true)}
                    className="text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Downgrade
                  </button>
                )}
                {nextPlan && (
                  <button
                    type="button"
                    onClick={() => setUpgradeOpen(true)}
                    className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                  >
                    Move up to {SITE_PLANS[nextPlan].name}
                  </button>
                )}
              </div>
            )}
          </div>

          {managed && (
            <div className="mt-4 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] p-4">
              <div className="text-[13px] font-medium text-foreground">
                This site runs on a managed contract. Plan changes go through your account contact, not a checkout.
              </div>
              {contact ? (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[13px] text-foreground">{contact.contactName} manages this contract</div>
                    <div className="text-[12px] text-muted-foreground">
                      {[contact.contactTitle, contact.contactEmail].filter(Boolean).join(" · ")}
                    </div>
                    {contact.note && (
                      <div className="mt-1 text-[12px] text-muted-foreground">{contact.note}</div>
                    )}
                  </div>
                  {contact.contactEmail && (
                    <a
                      href={`mailto:${contact.contactEmail}`}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
                    >
                      <Mail className="h-3.5 w-3.5" /> Email {contact.contactName.split(" ")[0]}
                    </a>
                  )}
                </div>
              ) : (
                <div className="mt-2 text-[12px] text-muted-foreground">
                  Your account team can adjust the contract at any time.
                </div>
              )}
            </div>
          )}
        </div>
      </SettingsSection>

      {/* ── Change plan (buy directly in settings) ── */}
      {!managed && (
        <SettingsSection
          title="Change plan"
          description="Move this site to another plan without leaving settings. Upgrades apply right away; downgrade any time."
        >
          <div className="grid gap-3 py-1 md:grid-cols-3">
            {(["free", "basic", "pro"] as SitePlanId[]).map((pid) => (
              <PlanCard key={pid} planId={pid} current={plan} onBuy={setBuyPlan} onDown={setSwitchDown} />
            ))}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] pt-3.5">
            <div className="text-[12px] text-muted-foreground">
              Need more scale? Team and Enterprise are set up with our sales team.
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toast.success("Our team will reach out about Team and Enterprise")}
                className="text-[12.5px] font-medium text-primary hover:underline"
              >
                Contact sales
              </button>
              <Link
                to="/w/$workspace/settings/plans"
                params={{ workspace }}
                className="text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
              >
                Compare all plans
              </Link>
            </div>
          </div>
        </SettingsSection>
      )}

      {/* ── Scale this site (Pro only) ── */}
      {plan === "pro" && (
        <SettingsSection
          title="Scale this site"
          description="Grow any included amount without changing plans. Every step shows its price."
        >
          {SCALE_KEYS.map((key) => {
            const sDef = PRO_SCALING[key];
            const opts = proScalingOptions(key);
            const value = scaling[key];
            const atCeiling = value >= sDef.ceiling;
            const stepLabel = key === "locales" ? "each" : `per ${sDef.format(sDef.stepAmount)}`;
            return (
              <SettingsRow
                key={key}
                label={sDef.label}
                description={`${sDef.format(sDef.base)} included. Extras at ${fmtUSD(sDef.stepPrice)} ${stepLabel}.`}
              >
                <div className="flex flex-col items-end gap-1.5">
                  <Select
                    value={String(value)}
                    onValueChange={(v) => setScaling((cur) => ({ ...cur, [key]: Number(v) }))}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <div className="max-w-[240px] px-2 py-1.5 text-[11px] leading-relaxed text-muted-foreground">
                        {TEAM_NUDGE}
                      </div>
                      {opts.map((o) => (
                        <SelectItem key={o.value} value={String(o.value)}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {atCeiling && (
                    <p className="text-[11px] text-muted-foreground">
                      That is the ceiling on Pro. Team goes far past it.
                    </p>
                  )}
                </div>
              </SettingsRow>
            );
          })}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[color:var(--border-hairline)] py-3.5">
            <p className="text-[12.5px] tabular-nums text-foreground">
              Plan {fmtUSD(proPrice)}/mo + scaling {fmtUSD(scalingExtras)}/mo ={" "}
              <span className="font-semibold">{fmtUSD(proPrice + scalingExtras)}/mo</span>, billed yearly
            </p>
            <button
              type="button"
              disabled={scalingExtras === 0}
              onClick={() => setScaleCheckoutOpen(true)}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              Apply scaling
            </button>
          </div>
        </SettingsSection>
      )}

      {/* ── AI credits ── */}
      <SettingsSection
        title="AI credits"
        description="Credits power AI actions on this site. Quality tiers are Lite, Balanced and Max."
      >
        <div className="py-4">
          {included != null ? (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                  {(remaining ?? 0).toLocaleString("en-US")}
                </span>
                <span className="text-[13px] text-muted-foreground">
                  {plan === "free"
                    ? `of ${included.toLocaleString("en-US")} trial credits left`
                    : `of ${included.toLocaleString("en-US")} included credits left this month`}
                </span>
              </div>
              {plan === "free" && creditsUsed >= 50 && (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  Nearly through the trial credits. Paid plans refill monthly.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-[28px] font-semibold leading-none tracking-tight tabular-nums text-foreground">
                  {creditsUsed.toLocaleString("en-US")}
                </span>
                <span className="text-[13px] text-muted-foreground">credits used this period</span>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                Custom amount included on this agreement.
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-[color:var(--border-hairline)] py-4">
          <div className="mb-2.5 text-[13px] font-medium text-foreground">Top up</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {CREDIT_PACKS.map((p, i) => {
              const selected = packIdx === i;
              return (
                <button
                  key={p.credits}
                  type="button"
                  onClick={() => setPackIdx(selected ? null : i)}
                  aria-pressed={selected}
                  className={`rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)]"
                      : "border-[color:var(--border-hairline)] bg-[color:var(--card)] hover:bg-[color:var(--color-row-hover)]"
                  }`}
                >
                  <div className="text-[13px] font-semibold tabular-nums text-foreground">
                    {p.credits.toLocaleString("en-US")} credits
                  </div>
                  <div className="mt-0.5 text-[12px] tabular-nums text-muted-foreground">
                    {fmtUSD(p.price)} · {fmtPerCredit(p.perCredit)}
                  </div>
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={!pack}
              onClick={() => setPackCheckoutOpen(true)}
              className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[12.5px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-50"
            >
              {pack ? `Buy ${pack.credits.toLocaleString("en-US")} credits` : "Buy credits"}
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[color:var(--border-hairline)] py-3.5">
          <span className="text-[12px] text-muted-foreground">
            {creditsUsed.toLocaleString("en-US")} credits used this period.
          </span>
          <Link
            to="/w/$workspace/p/$project/settings/usage"
            params={{ workspace, project }}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            See usage and activity
          </Link>
        </div>
      </SettingsSection>

      {/* ── Features on this plan ── */}
      <SettingsSection title="Features on this plan" description={`What the ${def.name} plan includes for ${domain}.`}>
        {FEATURE_KEYS.map((key) => {
          const row = featureRow(key);
          if (!row) return null;
          return (
            <div
              key={key}
              className="flex items-center justify-between gap-4 border-b border-[color:var(--border-hairline)] py-3 last:border-b-0"
            >
              <span className="text-[13px] text-foreground">{row.label}</span>
              <FeatureValueCell value={row.values[plan]} featureKey={key} />
            </div>
          );
        })}
        <div className="border-t border-[color:var(--border-hairline)] py-3.5">
          <Link
            to="/w/$workspace/settings/plans"
            params={{ workspace }}
            className="text-[12.5px] font-medium text-primary hover:underline"
          >
            See all plans
          </Link>
        </div>
      </SettingsSection>

      {/* ── Dialogs ── */}
      {nextPlan && (
        <DodoCheckoutDialog
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          title={`Move ${domain} up to ${SITE_PLANS[nextPlan].name}`}
          lines={[
            {
              label: domain,
              detail: `${SITE_PLANS[nextPlan].name} site`,
              amount: sitePlanPrice(nextPlan, "yearly") ?? 0,
            },
          ]}
          cycle="yearly"
          onComplete={() => {
            projectActions.setSitePlan(pr.id, nextPlan);
            toast.success(`${domain} is now on ${SITE_PLANS[nextPlan].name}`);
          }}
        />
      )}

      {prevPlan && (
        <Dialog open={downgradeOpen} onOpenChange={setDowngradeOpen}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Downgrade to {SITE_PLANS[prevPlan].name}</DialogTitle>
              <DialogDescription>
                Move {domain} from {def.name} to {SITE_PLANS[prevPlan].name}. The change applies right
                away and nothing you built is deleted. This site's line goes from{" "}
                {fmtUSD(sitePlanPrice(plan, "yearly") ?? 0)}/mo to{" "}
                {fmtUSD(sitePlanPrice(prevPlan, "yearly") ?? 0)}/mo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setDowngradeOpen(false)}
                className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              >
                Keep {def.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  projectActions.setSitePlan(pr.id, prevPlan);
                  setDowngradeOpen(false);
                  toast.success(`${domain} is now on ${SITE_PLANS[prevPlan].name}`);
                }}
                className="inline-flex h-9 items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                Downgrade to {SITE_PLANS[prevPlan].name}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {plan === "pro" && (
        <DodoCheckoutDialog
          open={scaleCheckoutOpen}
          onOpenChange={setScaleCheckoutOpen}
          title={`Scale ${domain}`}
          lines={scalingLines}
          cycle="yearly"
          onComplete={() => toast.success("Scaling applied (demo)")}
        />
      )}

      {pack && (
        <DodoCheckoutDialog
          open={packCheckoutOpen}
          onOpenChange={setPackCheckoutOpen}
          title="Top up AI credits"
          lines={[
            {
              label: `${pack.credits.toLocaleString("en-US")} AI credits`,
              detail: `For ${domain}`,
              amount: pack.price,
            },
          ]}
          cycle="monthly"
          onComplete={() => toast.success("Credits added (demo)")}
        />
      )}

      {/* Catalog: buy an upgrade */}
      {buyPlan && (
        <DodoCheckoutDialog
          open
          onOpenChange={(o) => !o && setBuyPlan(null)}
          title={`Move ${domain} to ${SITE_PLANS[buyPlan].name}`}
          lines={[{ label: domain, detail: `${SITE_PLANS[buyPlan].name} site`, amount: sitePlanPrice(buyPlan, "yearly") ?? 0 }]}
          cycle="yearly"
          onComplete={() => {
            projectActions.setSitePlan(pr.id, buyPlan);
            toast.success(`${domain} is now on ${SITE_PLANS[buyPlan].name}`);
          }}
        />
      )}

      {/* Catalog: confirm a downgrade */}
      {switchDown && (
        <Dialog open onOpenChange={(o) => !o && setSwitchDown(null)}>
          <DialogContent className="sm:max-w-[420px]">
            <DialogHeader>
              <DialogTitle>Switch to {SITE_PLANS[switchDown].name}</DialogTitle>
              <DialogDescription>
                Move {domain} from {def.name} to {SITE_PLANS[switchDown].name}. The change applies right away and nothing
                you built is deleted. This site's line goes from {fmtUSD(sitePlanPrice(plan, "yearly") ?? 0)}/mo to{" "}
                {fmtUSD(sitePlanPrice(switchDown, "yearly") ?? 0)}/mo.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setSwitchDown(null)}
                className="inline-flex h-9 items-center rounded-lg px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              >
                Keep {def.name}
              </button>
              <button
                type="button"
                onClick={() => {
                  projectActions.setSitePlan(pr.id, switchDown);
                  toast.success(`${domain} is now on ${SITE_PLANS[switchDown].name}`);
                  setSwitchDown(null);
                }}
                className="inline-flex h-9 items-center rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-3.5 text-[13px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
              >
                Switch to {SITE_PLANS[switchDown].name}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function PlanCard({
  planId,
  current,
  onBuy,
  onDown,
}: {
  planId: SitePlanId;
  current: SitePlanId;
  onBuy: (p: SitePlanId) => void;
  onDown: (p: SitePlanId) => void;
}) {
  const def = SITE_PLANS[planId];
  const rank = SITE_PLAN_ORDER.indexOf(planId);
  const curRank = SITE_PLAN_ORDER.indexOf(current);
  const isCurrent = planId === current;
  const isUpgrade = rank > curRank;
  const l = def.limits;
  const price = planId === "free" ? "$0" : `${fmtUSD(sitePlanPrice(planId, "yearly") ?? 0)}/mo`;
  const lines = [
    l.bandwidthGB == null ? "Custom bandwidth" : `${fmtGB(l.bandwidthGB)} bandwidth`,
    l.aiCredits == null ? "Custom AI credits" : `${fmtCompact(l.aiCredits)} AI credits/mo`,
    l.apiRequests == null ? "Custom API volume" : `${fmtCompact(l.apiRequests)} API requests/mo`,
  ];

  return (
    <div
      className={`flex flex-col rounded-xl border p-4 ${
        isCurrent ? "border-primary/50 bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]" : "border-[color:var(--border-hairline)] bg-card"
      }`}
    >
      <div className="flex items-center gap-2">
        <SitePlanBadge plan={planId} />
        <span className="text-[14px] font-semibold text-foreground">{def.name}</span>
      </div>
      <div className="mt-1 text-[13px] tabular-nums text-foreground">
        {price}{" "}
        <span className="text-[11.5px] text-muted-foreground">{planId === "free" ? "free forever" : "billed yearly"}</span>
      </div>
      <ul className="mt-3 flex-1 space-y-1.5 text-[12px] text-muted-foreground">
        {lines.map((x) => (
          <li key={x} className="flex items-center gap-1.5">
            <Check className="h-3 w-3 shrink-0 text-emerald-500" /> {x}
          </li>
        ))}
      </ul>
      <div className="mt-4">
        {isCurrent ? (
          <div className="inline-flex h-8 w-full items-center justify-center gap-1.5 rounded-lg border border-primary/40 text-[12.5px] font-medium text-primary">
            <Check className="h-3.5 w-3.5" /> Current plan
          </div>
        ) : isUpgrade ? (
          <button
            type="button"
            onClick={() => onBuy(planId)}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-primary text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
          >
            Upgrade to {def.name}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onDown(planId)}
            className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-[color:var(--color-border)] text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Switch to {def.name}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── bits ── */

function FeatureValueCell({ value, featureKey }: { value: boolean | string; featureKey: string }) {
  if (value === true) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-foreground">
        <Check className="h-3.5 w-3.5 text-emerald-500" strokeWidth={2.5} /> Included
      </span>
    );
  }
  if (typeof value === "string") {
    if (value === "Coming soon") {
      return (
        <span className="inline-flex shrink-0 items-center rounded-md border border-violet-500/30 bg-violet-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold leading-none text-violet-600 dark:text-violet-400">
          Coming soon
        </span>
      );
    }
    return <span className="shrink-0 text-right text-[12.5px] text-foreground">{value}</span>;
  }
  const first = firstPlanWith(featureKey);
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <Lock className="h-3.5 w-3.5" />
      {first ? `Available on ${SITE_PLANS[first].name}` : "Not on this plan"}
    </span>
  );
}
