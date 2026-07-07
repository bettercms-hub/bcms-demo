import { Link, Outlet, createFileRoute, useRouterState } from "@tanstack/react-router";
import { useCMS } from "@/lib/cms/store";
import { computeWorkspaceBill, fmtUSD } from "@/lib/billing/pricing";
import { WorkspacePlanBadge } from "@/components/cms/billing/PlanBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Mail, Sparkles } from "lucide-react";

export const Route = createFileRoute("/w/$workspace/settings/billing")({
  component: BillingLayout,
});

function fmtRenewal(iso?: string) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function BillingLayout() {
  const { workspace: slug } = Route.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const base = `/w/${slug}/settings/billing`;

  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const wsProjects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));
  const wsMembers = useCMS((s) => (ws ? s.members.filter((m) => ws.memberIds.includes(m.id)) : []));

  if (!ws) {
    return (
      <div className="rounded-md border border-border bg-surface p-6 text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  const bill = computeWorkspaceBill(ws, wsProjects, wsMembers);
  const renews = fmtRenewal(ws.billing?.renewalDate);
  const totalLabel =
    bill.monthlyTotal == null ? "Custom" : bill.monthlyTotal === 0 ? "Free" : `${fmtUSD(bill.monthlyTotal)}/mo`;
  const cycleLabel = bill.managed
    ? (ws.billing?.contractLabel ?? "Managed contract")
    : bill.monthlyTotal && bill.monthlyTotal > 0
      ? bill.cycle === "yearly"
        ? "billed yearly"
        : "billed monthly"
      : null;

  const tabs = [
    { label: "Overview", href: base, exact: true },
    { label: "Usage", href: `${base}/usage` },
    { label: "Invoices", href: `${base}/invoices` },
    { label: "Payment", href: `${base}/payment` },
  ];

  return (
    <div className="-mx-8 -my-10">
      {/* Header band */}
      <div className="border-b border-border bg-[color:var(--surface)] px-8 pb-7 pt-9">
        <div className="mx-auto max-w-[1180px]">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Workspace billing
          </div>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold leading-tight tracking-tight text-foreground">{ws.name}</h1>
                <WorkspacePlanBadge plan={ws.workspacePlan ?? "free"} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
                <Badge className="rounded-md bg-emerald-500/15 text-emerald-500 hover:bg-emerald-500/20 dark:text-emerald-400">
                  <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current" />
                  Active
                </Badge>
                <span className="font-semibold tabular-nums text-foreground">{totalLabel}</span>
                {cycleLabel && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">{cycleLabel}</span>
                  </>
                )}
                {renews && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground">Renews {renews}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bill.managed && ws.billing?.managed ? (
                <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
                  <a href={`mailto:${ws.billing.managed.contactEmail ?? ""}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" />
                    Contact your account manager
                  </a>
                </Button>
              ) : (
                <>
                  <Button variant="outline" size="sm" className="h-9 text-[13px]" asChild>
                    <Link to={`${base}/payment` as string}>Manage subscription</Link>
                  </Button>
                  <Button size="sm" className="h-9 text-[13px]" asChild>
                    <Link to={`/w/${slug}/settings/plans` as string}>
                      <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                      See plans
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Tabs */}
          <nav className="-mb-px mt-7 flex flex-wrap gap-1">
            {tabs.map((t) => {
              const active = t.exact ? pathname === t.href || pathname === t.href + "/" : pathname.startsWith(t.href);
              return (
                <Link
                  key={t.href}
                  to={t.href}
                  className={`relative inline-flex h-9 items-center px-3 text-[13px] font-medium transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                  {active && <span className="absolute -bottom-px left-2 right-2 h-[2px] bg-primary" />}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Tab content */}
      <div className="px-8 pb-16 pt-8">
        <div className="mx-auto max-w-[1180px]">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
