import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, CreditCard, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SettingsSection } from "@/components/cms/SettingsSubNav";
import { SitePlanBadge } from "@/components/cms/billing/PlanBadge";
import { useCMS } from "@/lib/cms/store";
import {
  SEATS,
  SEAT_ORDER,
  SITE_PLANS,
  computeWorkspaceBill,
  fmtUSD,
  isPaidSeat,
  paidSeatsMonthly,
  seatCounts,
  sitePlanPrice,
  usageState,
} from "@/lib/billing/pricing";
import type { Member, Project, Workspace } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/settings/billing/")({
  component: BillingOverview,
});

function fmtDateLong(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function BillingOverview() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const wsProjects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));
  const wsMembers = useCMS((s) => (ws ? s.members.filter((m) => ws.memberIds.includes(m.id)) : []));

  if (!ws) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  const bill = computeWorkspaceBill(ws, wsProjects, wsMembers);

  if (bill.managed) {
    return <ManagedOverview ws={ws} wsProjects={wsProjects} wsMembers={wsMembers} />;
  }

  return (
    <div className="max-w-[880px]">
      <MonthlyTotalCard ws={ws} wsProjects={wsProjects} wsMembers={wsMembers} />
      <SitesCard ws={ws} wsProjects={wsProjects} cycle={bill.cycle} />
      <SeatsCard ws={ws} wsMembers={wsMembers} />
      <PaymentMethodCard ws={ws} />
    </div>
  );
}

/* ================= Managed workspaces (Wayground, Atlas) ================= */

function ManagedOverview({
  ws,
  wsProjects,
  wsMembers,
}: {
  ws: Workspace;
  wsProjects: Project[];
  wsMembers: Member[];
}) {
  const managed = ws.billing?.managed;
  const isTeam = ws.workspacePlan === "team";
  const renews = fmtDateLong(ws.billing?.renewalDate);
  const site = wsProjects[0];
  const paidInUse = wsMembers.filter((m) => isPaidSeat(m.seat)).length;
  const teamPrice = SITE_PLANS.team.yearly ?? 1500;
  const includes = isTeam
    ? "The Team site plan, 15 paid seats, custom roles, granular permissions and priority support."
    : "Custom limits, a dedicated environment, SSO, full audit and a dedicated account manager.";

  return (
    <div className="max-w-[880px]">
      <SettingsSection title="Your contract" description="Everything here is handled for you on the contract.">
        <InfoRow label="Contract">
          <span className="text-foreground">
            {ws.billing?.contractLabel ?? "Annual contract"}
            {isTeam && <span className="text-muted-foreground"> · from {fmtUSD(teamPrice)}/mo</span>}
          </span>
        </InfoRow>
        <InfoRow label="What is included">
          <span className="text-muted-foreground">{includes}</span>
        </InfoRow>
        {renews && (
          <InfoRow label="Renews">
            <span className="text-foreground">{renews}</span>
          </InfoRow>
        )}
        {isTeam && (
          <InfoRow label="Seats">
            <span className="text-foreground">
              15 included in your plan, {paidInUse} in use
            </span>
          </InfoRow>
        )}
      </SettingsSection>

      {site && (
        <SettingsSection title="Your site" flush>
          <Link
            to={`/w/${ws.slug}/p/${site.slug}/settings/plan` as string}
            className="flex items-center justify-between gap-4 px-5 py-4 transition-colors hover:bg-[color:var(--row-hover)]"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate text-[13px] font-semibold text-foreground">{site.domain ?? site.name}</span>
                  <SitePlanBadge plan={site.sitePlan ?? "free"} />
                </div>
                <div className="mt-0.5 text-[12px] text-muted-foreground">{site.name}</div>
              </div>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-muted-foreground">
              Site plan
              <ArrowUpRight className="h-3.5 w-3.5" />
            </span>
          </Link>
        </SettingsSection>
      )}

      {managed && <AccountManagerCard managed={managed} />}
    </div>
  );
}

function AccountManagerCard({
  managed,
}: {
  managed: NonNullable<NonNullable<Workspace["billing"]>["managed"]>;
}) {
  const initials = managed.contactName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
  return (
    <SettingsSection title="Your account manager" description="A named human, not a queue.">
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 text-[13px] font-semibold text-primary">
            {initials}
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-foreground">{managed.contactName}</div>
            <div className="text-[12px] text-muted-foreground">
              {managed.contactTitle}
              {managed.contactEmail && <span> · {managed.contactEmail}</span>}
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
          <a href={`mailto:${managed.contactEmail ?? ""}`}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Contact your account manager
          </a>
        </Button>
      </div>
      {managed.note && (
        <p className="border-t border-[color:var(--border-hairline)] py-3 text-[12.5px] leading-relaxed text-muted-foreground">
          {managed.note}
        </p>
      )}
    </SettingsSection>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[160px_minmax(0,1fr)] items-baseline gap-4 border-b border-[color:var(--border-hairline)] py-3.5 text-[13px] last:border-b-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/* ================= Self serve: monthly total ================= */

function MonthlyTotalCard({
  ws,
  wsProjects,
  wsMembers,
}: {
  ws: Workspace;
  wsProjects: Project[];
  wsMembers: Member[];
}) {
  const bill = computeWorkspaceBill(ws, wsProjects, wsMembers);
  const projectById = new Map(wsProjects.map((p) => [p.id, p]));

  return (
    <SettingsSection title="Monthly total" description="Every line on your bill, nothing hidden." flush>
      <div className="divide-y divide-[color:var(--border-hairline)]">
        {bill.lines.map((l) => {
          const project = l.kind === "site" ? projectById.get(l.id.replace(/^site-/, "")) : undefined;
          const detail =
            project?.clientSite && l.detail
              ? `${l.detail} · client site, can be billed to the client`
              : l.detail;
          return (
            <div key={l.id} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] text-foreground">{l.label}</div>
                {detail && <div className="mt-0.5 text-[12px] text-muted-foreground">{detail}</div>}
              </div>
              <div className="shrink-0 text-[13px] tabular-nums text-foreground">
                {l.amount == null ? "Custom" : `${fmtUSD(l.amount)}/mo`}
              </div>
            </div>
          );
        })}
        <div className="flex items-center justify-between gap-4 bg-[color:var(--surface)] px-5 py-3.5">
          <div>
            <div className="text-[13px] font-semibold text-foreground">Total</div>
            {bill.cycleNote && <div className="mt-0.5 text-[12px] text-muted-foreground">{bill.cycleNote}</div>}
          </div>
          <div className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
            {bill.monthlyTotal == null ? "Custom" : `${fmtUSD(bill.monthlyTotal)}/mo`}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}

/* ================= Self serve: sites ================= */

function siteAttentionNote(p: Project): { tone: "approaching" | "over"; text: string } | null {
  const plan = SITE_PLANS[p.sitePlan ?? "free"];
  const approaching: string[] = [];
  const over: string[] = [];
  if (p.usage) {
    const bw = usageState(p.usage.bandwidthGB, plan.limits.bandwidthGB);
    const cr = usageState(p.usage.aiCreditsUsed, plan.limits.aiCredits);
    if (bw === "approaching") approaching.push("Bandwidth");
    if (bw === "over") over.push("Bandwidth");
    if (cr === "approaching") approaching.push("AI credits");
    if (cr === "over") over.push("AI credits");
  }
  if (over.length > 0) {
    const what = over.join(" and ");
    return { tone: "over", text: `${what} went past the included amount on this site. Billed at the add on rate, never cut off.` };
  }
  if (approaching.length > 0) {
    const what = approaching.join(" and ");
    const verb = approaching.length > 1 ? "are" : "is";
    const it = approaching.length > 1 ? "them" : "it";
    return {
      tone: "approaching",
      text: `${what} ${verb} getting close on this site. Raise ${it} from the site plan page, or Team covers far more.`,
    };
  }
  return null;
}

function SitesCard({ ws, wsProjects, cycle }: { ws: Workspace; wsProjects: Project[]; cycle: "monthly" | "yearly" }) {
  return (
    <SettingsSection title="Sites" description="Each live site sits on its own site plan." flush>
      <div className="divide-y divide-[color:var(--border-hairline)]">
        {wsProjects.map((p) => {
          const plan = p.sitePlan ?? "free";
          const price = sitePlanPrice(plan, cycle);
          const note = siteAttentionNote(p);
          return (
            <div key={p.id}>
              <Link
                to={`/w/${ws.slug}/p/${p.slug}/settings/plan` as string}
                className="flex items-center justify-between gap-4 px-5 py-3.5 transition-colors hover:bg-[color:var(--row-hover)]"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[13px] font-semibold text-foreground">{p.domain ?? p.name}</span>
                    <SitePlanBadge plan={plan} />
                  </div>
                  <div className="mt-0.5 truncate text-[12px] text-muted-foreground">
                    {p.name}
                    {p.clientSite && <span> · client site</span>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-[13px] tabular-nums text-foreground">
                  {price == null ? "Custom" : price === 0 ? "Free" : `${fmtUSD(price)}/mo`}
                  <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Link>
              {note && (
                <div
                  className={`px-5 pb-3 text-[12px] leading-relaxed ${
                    note.tone === "over" ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {note.text}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}

/* ================= Self serve: seats ================= */

function SeatsCard({ ws, wsMembers }: { ws: Workspace; wsMembers: Member[] }) {
  const counts = seatCounts(wsMembers);
  const paidTotal = paidSeatsMonthly(wsMembers);
  const paidRoles = SEAT_ORDER.filter((r) => isPaidSeat(r) && counts[r] > 0);
  const freeParts: string[] = [];
  if (counts.viewer > 0) freeParts.push(`${counts.viewer} viewer${counts.viewer > 1 ? "s" : ""}`);
  if (counts.reviewer > 0) freeParts.push(`${counts.reviewer} reviewer${counts.reviewer > 1 ? "s" : ""}`);

  return (
    <SettingsSection
      title="Seats"
      action={
        <Button variant="ghost" size="sm" className="h-8 text-[12.5px]" asChild>
          <Link to={`/w/${ws.slug}/members` as string}>
            Manage members
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      }
      flush
    >
      <div className="divide-y divide-[color:var(--border-hairline)]">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <Check className="h-4 w-4 shrink-0 text-emerald-500" />
            <div className="min-w-0">
              <div className="text-[13px] text-foreground">Viewers and reviewers are free, unlimited</div>
              {freeParts.length > 0 && (
                <div className="mt-0.5 text-[12px] text-muted-foreground">{freeParts.join(", ")} on the team</div>
              )}
            </div>
          </div>
          <div className="shrink-0 text-[13px] tabular-nums text-muted-foreground">$0/mo</div>
        </div>
        {paidRoles.map((role) => (
          <div key={role} className="flex items-center justify-between gap-4 px-5 py-3">
            <div className="min-w-0">
              <div className="text-[13px] text-foreground">
                {counts[role]} {SEATS[role].label} {counts[role] > 1 ? "seats" : "seat"}
              </div>
              <div className="mt-0.5 text-[12px] text-muted-foreground">{fmtUSD(SEATS[role].monthly)}/mo each</div>
            </div>
            <div className="shrink-0 text-[13px] tabular-nums text-foreground">
              {fmtUSD(counts[role] * SEATS[role].monthly)}/mo
            </div>
          </div>
        ))}
        <div className="flex items-center justify-between gap-4 bg-[color:var(--surface)] px-5 py-3">
          <div className="text-[13px] font-semibold text-foreground">
            {paidRoles.length > 0 ? "Paid seats" : "No paid seats yet"}
          </div>
          <div className="shrink-0 text-[13px] font-semibold tabular-nums text-foreground">{fmtUSD(paidTotal)}/mo</div>
        </div>
      </div>
    </SettingsSection>
  );
}

/* ================= Self serve: payment method ================= */

function PaymentMethodCard({ ws }: { ws: Workspace }) {
  const card = ws.billing?.card;
  const renews = fmtDateLong(ws.billing?.renewalDate);

  if (!card) {
    // Free workspace: no card, no pressure. One calm pointer to plans.
    const basic = SITE_PLANS.basic;
    return (
      <>
        <SettingsSection title="Free forever" description="This workspace runs on the free plan.">
          <div className="flex items-center gap-3 py-3">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/10">
              <Check className="h-4 w-4 text-emerald-500" />
            </div>
            <p className="text-[13px] text-foreground">No card on file. Nothing to pay.</p>
          </div>
        </SettingsSection>
        <SettingsSection
          title="If you ever want more"
          description={`Basic adds a custom domain, SEO tools and 1,000 AI credits for ${fmtUSD(basic.yearly ?? 15)}/mo billed yearly, or ${fmtUSD(basic.monthly ?? 20)}/mo monthly.`}
        >
          <div className="py-3">
            <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
              <Link to={`/w/${ws.slug}/settings/plans` as string}>See plans</Link>
            </Button>
          </div>
        </SettingsSection>
      </>
    );
  }

  return (
    <SettingsSection
      title="Payment method"
      action={
        <Button variant="ghost" size="sm" className="h-8 text-[12.5px]" asChild>
          <Link to={`/w/${ws.slug}/settings/billing/payment` as string}>
            Manage payment
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-4 py-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-10 w-14 shrink-0 place-items-center rounded-md border border-[color:var(--border-hairline)] bg-[color:var(--surface)]">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-foreground">
              {card.brand} ending {card.last4}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              Expires {String(card.expMonth).padStart(2, "0")}/{card.expYear}
              {renews && <span> · renews {renews}</span>}
            </div>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
