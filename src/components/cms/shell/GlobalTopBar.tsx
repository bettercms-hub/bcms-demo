import { Link, useParams } from "@tanstack/react-router";
import { Bell, HelpCircle, Menu, Search, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectBreadcrumb } from "./project/ProjectBreadcrumb";
import { Logo } from "./Logo";
import { UtilityIconButton } from "./UtilityIconButton";
import { ThemeToggle } from "./ThemeToggle";
import { NotificationsHeader, NotificationsList, useUnreadCount } from "./NotificationsList";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { editorBus } from "@/lib/cms/editor-bus";

interface Props {
  onOpenPalette: () => void;
  /** Opens the mobile workspace drawer; the trigger only shows below md. */
  onMenu?: () => void;
  project?: {
    wsSlug: string;
    wsName: string;
    projectSlug: string;
    projectName: string;
    status?: string;
  };
}

const STATUS_DOT: Record<string, string> = {
  published: "bg-emerald-400",
  draft: "bg-muted-foreground/60",
  scheduled: "bg-amber-400",
  archived: "bg-muted-foreground/40",
};

export function GlobalTopBar({ onOpenPalette, onMenu, project }: Props) {
  return (
    <header className="relative z-30 grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-b border-border bg-[color:var(--topbar)] px-2 sm:gap-4 sm:px-3">
      {/* LEFT — breadcrumb / brand */}
      <div className="flex min-w-0 items-center gap-1 sm:gap-2">
        {onMenu && (
          <button
            type="button"
            onClick={onMenu}
            aria-label="Open navigation"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.75} />
          </button>
        )}
        {project ? (
          <>
            <ProjectBreadcrumb
              wsSlug={project.wsSlug}
              wsName={project.wsName}
              projectName={project.projectName}
              projectSlug={project.projectSlug}
            />
            {project.status && (
              <span
                aria-label={`Status: ${project.status}`}
                title={project.status}
                className={`ml-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[project.status] ?? STATUS_DOT.draft}`}
              />
            )}
          </>
        ) : (
          <Link
            to="/"
            aria-label="BetterCMS home"
            className="flex h-8 items-center rounded-md px-1.5 transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Logo className="h-5 w-auto" />
          </Link>
        )}
      </div>

      {/* CENTER — command search (full pill on larger screens, icon on phones) */}
      <div className="hidden justify-center sm:flex">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex h-9 w-[440px] max-w-[46vw] items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-[12.5px] text-muted-foreground transition-[background-color,border-color,color] duration-150 ease-out hover:border-border-strong hover:bg-[var(--s2b)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="hidden rounded border border-border bg-[var(--s2b)] px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground/90 md:inline-block">⌘K</kbd>
        </button>
      </div>
      <div className="sm:hidden" aria-hidden />

      {/* RIGHT — utility cluster */}
      <div className="flex items-center justify-end gap-0.5">
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
        {project && (
          <Link
            to="/w/$workspace/p/$project/settings"
            params={{ workspace: project.wsSlug, project: project.projectSlug }}
            aria-label="Project settings"
            title="Project settings"
            className="relative grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Settings className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        )}
        <NotificationsMenu />
      </div>
    </header>
  );
}

function NotificationsMenu() {
  const { workspace: wsSlug } = useParams({ strict: false }) as { workspace?: string };
  const ws = wsSlug ? getWorkspaceBySlug(wsSlug) : undefined;
  const unread = useUnreadCount(ws?.id);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UtilityIconButton
          label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          indicator={
            unread > 0 ? (
              <span className="absolute right-1 top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-primary px-0.5 text-[8px] font-bold leading-none text-primary-foreground ring-2 ring-[color:var(--topbar)]">
                {unread > 9 ? "9+" : unread}
              </span>
            ) : undefined
          }
        >
          <Bell className="h-4 w-4" />
        </UtilityIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
        {ws ? (
          <>
            <div className="border-b border-border">
              <NotificationsHeader workspaceId={ws.id} />
            </div>
            <div className="max-h-[380px] overflow-y-auto">
              <NotificationsList workspaceId={ws.id} max={6} />
            </div>
            <Link
              to="/w/$workspace/settings/notifications"
              params={{ workspace: wsSlug! }}
              className="block border-t border-border px-3 py-2 text-center text-[12px] font-medium text-primary transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              View all notifications
            </Link>
          </>
        ) : (
          <div className="px-6 py-10 text-center text-[12.5px] text-muted-foreground">You're all caught up</div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
