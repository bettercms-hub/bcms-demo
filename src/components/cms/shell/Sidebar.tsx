import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  BarChart3,
  CreditCard,
  Globe,
  HelpCircle,
  Layers,
  Monitor,
  PanelLeft,
  Plus,
  Sliders,
  Sparkles,
  Users,
} from "lucide-react";
import { Logo } from "./Logo";
import { WorkspaceIdentity } from "./WorkspaceIdentity";
import { SidebarItem } from "./SidebarItem";
import { editorBus } from "@/lib/cms/editor-bus";
import { useViewportTier } from "@/lib/device";
import { deviceAllowsWorkspaceItem } from "@/lib/device-caps";

interface Props {
  wsSlug: string;
  pathname: string;
  /** "static" is the >=md rail; "drawer" fills the mobile off-canvas panel. */
  variant?: "static" | "drawer";
  /** Collapses the rail (static variant only; the drawer has its own close). */
  onCollapse?: () => void;
}

/**
 * V2 workspace sidebar — 260px sitting directly on the warm canvas, no card
 * background of its own. Logo row with the panel-collapse control, the s4
 * workspace switcher card, hairline-divided nav groups, and the plum Upgrade
 * button pinned at the bottom. Only the active nav row is a card.
 */
export function Sidebar({ wsSlug, pathname, variant = "static", onCollapse }: Props) {
  const tier = useViewportTier();
  const activeProjectSlug = useMemo(() => {
    const m = pathname.match(new RegExp(`^/w/${wsSlug}/p/([^/]+)`));
    return m?.[1];
  }, [pathname, wsSlug]);

  const isActive = (to: string) => pathname === to || pathname.startsWith(to + "/");

  const manageItems = [
    { label: "General settings", icon: Sliders, to: `/w/${wsSlug}/settings/general` },
    { label: "Team", icon: Users, to: `/w/${wsSlug}/members` },
    { label: "Plans", icon: Layers, to: `/w/${wsSlug}/settings/plans` },
    { label: "Billing", icon: CreditCard, to: `/w/${wsSlug}/settings/billing` },
    { label: "Usage", icon: BarChart3, to: `/w/${wsSlug}/settings/usage` },
    { label: "Domains", icon: Globe, to: `/w/${wsSlug}/settings/domains` },
  ].filter((it) => deviceAllowsWorkspaceItem(tier, it.label));

  return (
    <aside
      className={
        variant === "drawer"
          ? "relative flex w-full flex-col bg-background shadow-xl"
          : "relative hidden w-[260px] shrink-0 flex-col bg-background md:flex"
      }
      aria-label="Workspace"
    >
      {/* Logo row — 56px, collapse control on the right */}
      <div className="flex h-14 shrink-0 items-center gap-2 px-4">
        <Link
          to="/"
          aria-label="BetterCMS home"
          className="flex items-center rounded-md py-0.5 transition-colors hover:opacity-80"
        >
          <Logo className="h-5 w-auto" />
        </Link>
        {variant === "static" && onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
            className="ml-auto grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Workspace switcher card */}
      <div className="mx-3 mb-3 shrink-0">
        <WorkspaceIdentity wsSlug={wsSlug} />
      </div>

      {/* Nav groups — items carry px-3 on the list so the active indicator
          bar can hang at the scroll container's left edge without clipping. */}
      <nav className="flex flex-1 flex-col overflow-y-auto pb-1">
        <ul className="flex flex-col gap-0.5 px-3">
          <SidebarItem
            label="Sites"
            icon={Monitor}
            to={`/w/${wsSlug}`}
            active={
              pathname === `/w/${wsSlug}` ||
              pathname.startsWith(`/w/${wsSlug}/projects`) ||
              Boolean(activeProjectSlug)
            }
          />
          {deviceAllowsWorkspaceItem(tier, "Agent") && (
            <SidebarItem
              label="Agents"
              icon={Sparkles}
              to={`/w/${wsSlug}/agent`}
              active={pathname === `/w/${wsSlug}/agent`}
            />
          )}
        </ul>

        <div aria-hidden className="mx-3 my-3 h-px shrink-0 bg-[color:var(--border-hairline)]" />

        <ul className="flex flex-col gap-0.5 px-3">
          {manageItems.map((it) => (
            <SidebarItem
              key={it.to}
              label={it.label}
              icon={it.icon}
              to={it.to}
              active={isActive(it.to)}
            />
          ))}
        </ul>

        <div aria-hidden className="mx-3 mb-3 mt-auto h-px shrink-0 bg-[color:var(--border-hairline)]" />

        <ul className="flex flex-col gap-0.5 px-3">
          <li>
            <button
              type="button"
              onClick={() => editorBus.emit({ type: "editor:open-cheatsheet" })}
              className="group flex h-9 w-full items-center gap-2 rounded-md border border-transparent px-2.5 text-sm font-medium tracking-[-0.01em] text-foreground-secondary transition-colors duration-150 hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <HelpCircle
                className="h-[18px] w-[18px] shrink-0 text-muted-foreground group-hover:text-foreground-secondary"
                strokeWidth={1.75}
              />
              <span className="flex-1 truncate text-left">Help &amp; support</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Plum Upgrade — pinned bottom */}
      <div className="shrink-0 p-3">
        <Link
          to="/w/$workspace/settings/plans"
          params={{ workspace: wsSlug }}
          className="flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[color:var(--brand-plum)] text-sm font-medium tracking-[-0.01em] text-white transition-colors hover:bg-[#5A3846] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          Upgrade
        </Link>
      </div>
    </aside>
  );
}
