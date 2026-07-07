import { Link } from "@tanstack/react-router";
import { Bell, HelpCircle, Search, Settings } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProjectBreadcrumb } from "./project/ProjectBreadcrumb";
import { Logo } from "./Logo";
import { UtilityIconButton } from "./UtilityIconButton";
import { editorBus } from "@/lib/cms/editor-bus";

interface Props {
  onOpenPalette: () => void;
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

export function GlobalTopBar({ onOpenPalette, project }: Props) {
  return (
    <header className="relative z-30 grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 border-b border-border bg-[color:var(--topbar)] px-3">
      {/* LEFT — breadcrumb / brand */}
      <div className="flex min-w-0 items-center gap-2">
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

      {/* CENTER — command search */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={onOpenPalette}
          className="group flex h-9 w-[440px] max-w-[60vw] items-center gap-2 rounded-lg border border-border bg-transparent px-3 text-[12.5px] text-muted-foreground transition-[background-color,border-color,color] duration-150 ease-out hover:border-border-strong hover:bg-[var(--s2b)] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-3.5 w-3.5" strokeWidth={1.75} />
          <span className="flex-1 text-left">Search or jump to…</span>
          <kbd className="rounded border border-border bg-[var(--s2b)] px-1.5 py-px font-mono text-[10px] font-medium text-muted-foreground/90">⌘K</kbd>
        </button>
      </div>

      {/* RIGHT — utility cluster */}
      <div className="flex items-center justify-end gap-0.5">
        <UtilityIconButton
          label="Help & shortcuts"
          onClick={() => editorBus.emit({ type: "editor:open-cheatsheet" })}
        >
          <HelpCircle className="h-4 w-4" strokeWidth={1.75} />
        </UtilityIconButton>
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <UtilityIconButton label="Notifications">
          <Bell className="h-4 w-4" />
        </UtilityIconButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0">
        <div className="border-b border-border px-3 py-2.5">
          <div className="text-[12px] font-semibold text-foreground">Notifications</div>
        </div>
        <div className="px-6 py-10 text-center">
          <div className="text-[12.5px] font-medium text-foreground">You're all caught up</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            New activity will appear here.
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
