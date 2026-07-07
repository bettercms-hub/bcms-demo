import { useMemo } from "react";
import {
  BarChart3,
  CreditCard,
  FolderKanban,
  Globe,
  Rocket,
  Sliders,
  Sparkles,
  Users,
} from "lucide-react";
import { WorkspaceIdentity } from "./WorkspaceIdentity";
import { UserMenu } from "./UserMenu";
import { SidebarSection } from "./SidebarSection";
import { SidebarItem } from "./SidebarItem";

interface Props {
  wsSlug: string;
  pathname: string;
}

export function Sidebar({ wsSlug, pathname }: Props) {
  const activeProjectSlug = useMemo(() => {
    const m = pathname.match(new RegExp(`^/w/${wsSlug}/p/([^/]+)`));
    return m?.[1];
  }, [pathname, wsSlug]);

  const manageItems = [
    { label: "General settings", icon: Sliders, to: `/w/${wsSlug}/settings/general` },
    { label: "Team", icon: Users, to: `/w/${wsSlug}/members` },
    { label: "Plans", icon: Rocket, to: `/w/${wsSlug}/settings/plans` },
    { label: "Billing", icon: CreditCard, to: `/w/${wsSlug}/settings/billing` },
    { label: "Usage", icon: BarChart3, to: `/w/${wsSlug}/settings/usage` },
    { label: "Domains", icon: Globe, to: `/w/${wsSlug}/settings/domains` },
  ];
  const isManageActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  return (
    <aside
      className="relative hidden w-[252px] shrink-0 flex-col border-r border-border bg-sidebar md:flex"
      aria-label="Workspace"
    >
      <WorkspaceIdentity wsSlug={wsSlug} />

      <nav className="flex-1 overflow-y-auto px-2 pb-3 pt-2">
        <SidebarSection label="Build">
          <SidebarItem
            label="Projects"
            icon={FolderKanban}
            to={`/w/${wsSlug}`}
            active={pathname === `/w/${wsSlug}` || Boolean(activeProjectSlug)}
          />
          <SidebarItem
            label="Agent"
            icon={Sparkles}
            to={`/w/${wsSlug}/agent`}
            active={pathname === `/w/${wsSlug}/agent`}
          />
        </SidebarSection>

        <SidebarSection label="Manage">
          {manageItems.map((it) => (
            <SidebarItem
              key={it.to}
              label={it.label}
              icon={it.icon}
              to={it.to}
              active={isManageActive(it.to)}
            />
          ))}
        </SidebarSection>
      </nav>

      <UserMenu />
    </aside>
  );
}
