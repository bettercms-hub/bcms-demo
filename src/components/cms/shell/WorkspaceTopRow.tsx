import { Link } from "@tanstack/react-router";
import { ChevronRight, HelpCircle, Menu, PanelLeft, Search } from "lucide-react";
import { NotificationsMenu } from "./GlobalTopBar";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { UtilityIconButton } from "./UtilityIconButton";
import { ViewAsControl } from "./ViewAsControl";
import { TopBarPresence } from "@/components/cms/presence/Presence";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { editorBus } from "@/lib/cms/editor-bus";

interface Props {
  wsSlug: string;
  pathname: string;
  /** True when the 260px rail is hidden; shows the reopen control. */
  sidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  /** Opens the mobile drawer; the trigger only shows below md. */
  onMenu: () => void;
  onOpenPalette: () => void;
}

/** Section label for the breadcrumb, derived from the workspace-level path. */
function sectionLabel(wsSlug: string, pathname: string): string {
  const rest = pathname.replace(`/w/${wsSlug}`, "");
  if (rest === "" || rest === "/" || rest.startsWith("/projects")) return "Projects";
  if (rest.startsWith("/agent")) return "Agents";
  if (rest.startsWith("/members")) return "Team";
  if (rest.startsWith("/roles")) return "Roles & permissions";
  if (rest.startsWith("/settings/general")) return "General settings";
  if (rest.startsWith("/settings/plans")) return "Plans";
  if (rest.startsWith("/settings/billing")) return "Billing";
  if (rest.startsWith("/settings/usage")) return "Usage";
  if (rest.startsWith("/settings/domains")) return "Domains";
  if (rest.startsWith("/settings/notifications")) return "Notifications";
  if (rest.startsWith("/settings/ai")) return "AI controls";
  if (rest.startsWith("/settings/agents")) return "Connected agents";
  if (rest.startsWith("/settings/api-keys")) return "API keys";
  if (rest.startsWith("/settings/webhooks")) return "Webhooks";
  if (rest.startsWith("/settings/integrations")) return "Integrations";
  if (rest.startsWith("/settings")) return "Settings";
  return "Projects";
}

/**
 * The top row of the floating workspace card: breadcrumb left, the centered
 * pill search, and the utility cluster right (view-as, presence, theme,
 * help, notifications, account). Closed by a hairline.
 */
export function WorkspaceTopRow({
  wsSlug,
  pathname,
  sidebarCollapsed,
  onToggleSidebar,
  onMenu,
  onOpenPalette,
}: Props) {
  const ws = getWorkspaceBySlug(wsSlug);
  const section = sectionLabel(wsSlug, pathname);

  return (
    <div className="grid h-14 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-[color:var(--border-hairline)] px-2 sm:gap-4 sm:px-3">
      {/* LEFT — drawer trigger (mobile), sidebar reopen (collapsed), breadcrumb */}
      <div className="flex min-w-0 items-center gap-1">
        <button
          type="button"
          onClick={onMenu}
          aria-label="Open navigation"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
        </button>
        {sidebarCollapsed && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="hidden h-8 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground md:grid"
          >
            <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        )}
        <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1 px-1 text-[13px]">
          <Link
            to="/w/$workspace"
            params={{ workspace: wsSlug }}
            className="shrink-0 rounded px-1 py-0.5 text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            {ws?.name ?? wsSlug}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.75} />
          <span className="min-w-0 truncate px-1 font-medium text-foreground">{section}</span>
        </nav>
      </div>

      {/* CENTER — pill search */}
      <div className="hidden justify-center sm:flex">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex h-9 w-[440px] max-w-[42vw] items-center gap-2 rounded-full border border-border bg-transparent px-3.5 text-[12.5px] tracking-[-0.01em] text-muted-foreground transition-[background-color,border-color,color] duration-150 ease-out hover:border-border-strong hover:bg-[var(--s2)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="hidden rounded border border-border bg-[var(--s2)] px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground/90 md:inline-block">
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="sm:hidden" aria-hidden />

      {/* RIGHT — utility cluster */}
      <div className="flex items-center justify-end gap-0.5">
        <span className="mr-0.5 sm:mr-1.5">
          <ViewAsControl />
        </span>
        <span className="mr-1 hidden sm:block">
          <TopBarPresence />
        </span>
        <span className="sm:hidden">
          <UtilityIconButton label="Search" onClick={onOpenPalette}>
            <Search className="h-4 w-4" strokeWidth={1.75} />
          </UtilityIconButton>
        </span>
        <ThemeToggle />
        <span className="hidden sm:contents">
          <UtilityIconButton
            label="Help & shortcuts"
            onClick={() => editorBus.emit({ type: "editor:open-cheatsheet" })}
          >
            <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
          </UtilityIconButton>
        </span>
        <NotificationsMenu />
        <span className="ml-1">
          <UserMenu variant="avatar" />
        </span>
      </div>
    </div>
  );
}
