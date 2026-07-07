import { Link, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Bell,
  CreditCard,
  Globe,
  KeyRound,
  Plug,
  Rocket,
  ShieldCheck,
  Sliders,
  Users,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export interface WorkspaceSubNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: string;
  /** Extra path prefixes that should also mark this item active. */
  alsoActiveFor?: string[];
}

export function buildWorkspaceSubNavItems(wsSlug: string): WorkspaceSubNavItem[] {
  return [
    { label: "General", icon: Sliders, href: `/w/${wsSlug}/settings/general`, group: "Workspace" },
    { label: "Members", icon: Users, href: `/w/${wsSlug}/members`, group: "Workspace" },
    { label: "Roles & Permissions", icon: ShieldCheck, href: `/w/${wsSlug}/roles`, group: "Workspace" },
    { label: "Domains", icon: Globe, href: `/w/${wsSlug}/settings/domains`, group: "Workspace" },
    { label: "Notifications", icon: Bell, href: `/w/${wsSlug}/settings/notifications`, group: "Workspace" },
    { label: "API Keys", icon: KeyRound, href: `/w/${wsSlug}/settings/api-keys`, group: "Developer" },
    { label: "Webhooks", icon: Webhook, href: `/w/${wsSlug}/settings/webhooks`, group: "Developer" },
    { label: "Plans", icon: Rocket, href: `/w/${wsSlug}/settings/plans`, group: "Subscription" },
    { label: "Billing", icon: CreditCard, href: `/w/${wsSlug}/settings/billing`, group: "Subscription" },
    { label: "Usage", icon: BarChart3, href: `/w/${wsSlug}/settings/usage`, group: "Subscription" },
    { label: "Integrations", icon: Plug, href: `/w/${wsSlug}/settings/integrations`, group: "Integrations" },
  ];
}

interface Props {
  wsSlug: string;
}

export function WorkspaceSubNav({ wsSlug }: Props) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const items = buildWorkspaceSubNavItems(wsSlug);

  const groups: { label: string; items: WorkspaceSubNavItem[] }[] = [];
  for (const it of items) {
    let g = groups.find((x) => x.label === it.group);
    if (!g) {
      g = { label: it.group, items: [] };
      groups.push(g);
    }
    g.items.push(it);
  }

  const isActive = (it: WorkspaceSubNavItem) => {
    // Exact match for Billing root so Usage doesn't get caught as billing-child.
    if (it.href.endsWith("/settings/billing")) {
      return pathname === it.href || pathname.startsWith(it.href + "/");
    }
    if (pathname === it.href || pathname.startsWith(it.href + "/")) return true;
    return (it.alsoActiveFor ?? []).some(
      (p) => pathname === p || pathname.startsWith(p + "/"),
    );
  };

  return (
    <aside className="hidden w-[248px] shrink-0 border-r border-border bg-background md:block">
      <div className="px-6 pb-4 pt-7">
        <Link
          to="/w/$workspace/settings"
          params={{ workspace: wsSlug }}
          className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:text-foreground"
        >
          Workspace
        </Link>
      </div>
      <nav className="px-3 pb-10">
        {groups.map((g, gi) => (
          <div key={g.label} className={gi > 0 ? "mt-6" : ""}>
            <div className="px-3 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
              {g.label}
            </div>
            {g.items.map((it) => {
              const active = isActive(it);
              return (
                <Link
                  key={it.href}
                  to={it.href}
                  className={`relative my-0.5 flex h-9 items-center gap-3 rounded-md px-3 text-[13px] transition-colors duration-150 ${
                    active
                      ? "bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-foreground"
                      : "text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 left-0 w-[2px] rounded-full bg-primary" />
                  )}
                  <it.icon
                    className={`h-[15px] w-[15px] shrink-0 ${active ? "text-primary" : ""}`}
                    strokeWidth={1.75}
                  />
                  <span className="truncate">{it.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}

/** Convenience wrapper: secondary nav + content area with consistent padding. */
export function WorkspaceLayout({
  wsSlug,
  children,
}: {
  wsSlug: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceSubNav wsSlug={wsSlug} />
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}
