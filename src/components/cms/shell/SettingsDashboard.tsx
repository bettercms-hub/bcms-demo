import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CreditCard,
  KeyRound,
  Plug,
  ShieldCheck,
  Sliders,
  Users,
  Webhook,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Tile {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string;
  group: string;
}

export function SettingsDashboard({ wsSlug }: { wsSlug: string }) {
  const tiles: Tile[] = [
    { label: "General", description: "Workspace identity, region, defaults.", icon: Sliders, href: `/w/${wsSlug}/settings/general`, group: "Workspace" },
    { label: "Members", description: "Invite teammates and manage access.", icon: Users, href: `/w/${wsSlug}/members`, group: "Workspace" },
    { label: "Roles & Permissions", description: "Built-in roles, custom roles, capabilities.", icon: ShieldCheck, href: `/w/${wsSlug}/roles`, group: "Workspace" },
    { label: "Notifications", description: "Publishing, mentions, alerts, emails.", icon: Bell, href: `/w/${wsSlug}/settings/notifications`, group: "Workspace" },
    { label: "API Keys", description: "Personal and machine tokens.", icon: KeyRound, href: `/w/${wsSlug}/settings/api-keys`, group: "Developer" },
    { label: "Webhooks", description: "Outgoing events and deliveries.", icon: Webhook, href: `/w/${wsSlug}/settings/webhooks`, group: "Developer" },
    { label: "Plans & Billing", description: "Subscription, seats, invoices.", icon: CreditCard, href: `/w/${wsSlug}/settings/billing`, group: "Subscription" },
    { label: "Usage", description: "Monitor API, storage, bandwidth, AI credits.", icon: BarChart3, href: `/w/${wsSlug}/settings/usage`, group: "Subscription" },
    { label: "Integrations", description: "Connect Slack, GitHub, and more.", icon: Plug, href: `/w/${wsSlug}/settings/integrations`, group: "Integrations" },
  ];

  const groups: { label: string; items: Tile[] }[] = [];
  for (const t of tiles) {
    let g = groups.find((x) => x.label === t.group);
    if (!g) {
      g = { label: t.group, items: [] };
      groups.push(g);
    }
    g.items.push(t);
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] px-8 py-14">
      <header className="mb-14">
        <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Workspace
        </div>
        <h1 className="mt-2.5 text-[28px] font-semibold leading-tight tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-2.5 max-w-xl text-[14px] leading-relaxed text-muted-foreground">
          Manage your organization, members, billing and developer configuration.
        </p>
      </header>

      {groups.map((g) => (
        <section key={g.label} className="mb-12">
          <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
            {g.label}
          </h2>
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((t) => (
              <Link
                key={t.href}
                to={t.href}
                className="group relative flex items-start gap-4 rounded-xl border border-border/60 bg-card p-5 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-px hover:bg-[color:var(--color-elevated)] hover:shadow-[var(--shadow-elevated)]"
              >
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary">
                  <t.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                </div>
                <div className="min-w-0 pt-0.5">
                  <div className="text-[14px] font-semibold leading-tight text-foreground">
                    {t.label}
                  </div>
                  <div className="mt-1.5 line-clamp-2 text-[12.5px] leading-snug text-muted-foreground">
                    {t.description}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
