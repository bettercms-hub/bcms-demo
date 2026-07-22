import { useParams, useRouterState, useSearch } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { GlobalTopBar } from "./GlobalTopBar";
import { WorkspaceTopRow } from "./WorkspaceTopRow";
import { ProjectHeader } from "./project/ProjectHeader";
import { ProjectSidebar } from "./project/ProjectSidebar";
import { CommandPalette, useCommandPalette } from "../CommandPalette";
import { ShortcutCheatsheet } from "../ShortcutCheatsheet";
import { LargerScreen } from "../LargerScreen";
import { AgentDock } from "@/components/agent/AgentDock";
import { ConnectAiDialog } from "@/components/agent/ConnectAiDialog";
import { useEffect, useState, type ReactNode } from "react";
import { editorBus } from "@/lib/cms/editor-bus";
import { isEditableTarget } from "@/lib/cms/shortcuts";
import { getProjectBySlug, getWorkspaceBySlug } from "@/lib/cms/use-cms";
import { useViewportTier } from "@/lib/device";
import { blockedFeatureFor } from "@/lib/device-caps";

interface Props {
  wsSlug: string;
  children: ReactNode;
}

type Scope = "pages" | "collections" | "components";

const SIDEBAR_COLLAPSED_KEY = "bcms:ws-sidebar:collapsed";

export function AppShell({ wsSlug, children }: Props) {
  const palette = useCommandPalette();
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  // Workspace rail collapse — remembered across sessions. Read post-mount so
  // SSR markup stays deterministic.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  useEffect(() => {
    setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
  }, []);
  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* noop */
      }
      return next;
    });
  };
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { project: projectSlug } = useParams({ strict: false }) as { project?: string };
  const search = useSearch({ strict: false }) as { scope?: Scope; view?: "pages" | "content" };
  const inProject = Boolean(projectSlug);
  const tier = useViewportTier();

  // Phones get the focused editor product; builder surfaces reached by URL
  // render the interstitial instead of a squeezed, broken layout.
  const blockedFeature = blockedFeatureFor(tier, pathname, inProject);

  // Drawer never lingers across navigation.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    const off = editorBus.on((e) => {
      if (e.type === "editor:open-cheatsheet") setCheatsheetOpen(true);
      if (e.type === "editor:open-connect") setConnectOpen(true);
    });
    const onKey = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;
      if (e.key === "?" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        setCheatsheetOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      off();
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const ws = getWorkspaceBySlug(wsSlug);
  const project = inProject ? getProjectBySlug(wsSlug, projectSlug!) : undefined;

  return (
    <div className="flex h-dvh flex-col bg-background text-foreground">
      {inProject && ws && project ? (
        <div key="project" className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-200">
          <GlobalTopBar
            onOpenPalette={() => palette.setOpen(true)}
            project={{
              wsSlug,
              wsName: ws.name,
              projectSlug: project.slug,
              projectName: project.name,
              status: project.publishState ?? "draft",
            }}
          />
          <div className="animate-in fade-in slide-in-from-top-2 duration-300">
            <ProjectHeader
              wsSlug={wsSlug}
              projectSlug={project.slug}
              pathname={pathname}
              scope={search.scope}
              view={search.view}
            />
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="contents animate-in fade-in slide-in-from-left-2 duration-300">
              <ProjectSidebar wsSlug={wsSlug} projectSlug={project.slug} pathname={pathname} />
            </div>
            <main className="flex min-w-0 min-h-0 flex-1 flex-col bg-[color:var(--surface-canvas)] animate-in fade-in duration-300">
              {blockedFeature ? (
                <LargerScreen feature={blockedFeature} workspace={wsSlug} project={project.slug} />
              ) : (
                children
              )}
            </main>
            {/* In-flow so content compresses instead of being covered. Phones get the focused editor, no dock. */}
            {tier !== "mobile" && (
              <AgentDock wsSlug={wsSlug} projectSlug={project.slug} projectId={project.id} sitePlan={project.sitePlan ?? "free"} />
            )}
          </div>
        </div>
      ) : (
        /* Workspace level — 260px rail on the warm canvas + the floating
           white content card with a 16px gutter (full-bleed below md). */
        <div key="workspace" className="flex min-h-0 flex-1 animate-in fade-in duration-200">
          {!sidebarCollapsed && (
            <div className="contents animate-in fade-in slide-in-from-left-2 duration-300">
              <Sidebar wsSlug={wsSlug} pathname={pathname} onCollapse={toggleSidebar} />
            </div>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col md:p-4">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-card animate-in fade-in duration-300 md:rounded-2xl md:border md:border-[color:var(--border-hairline)]">
              <WorkspaceTopRow
                wsSlug={wsSlug}
                pathname={pathname}
                sidebarCollapsed={sidebarCollapsed}
                onToggleSidebar={toggleSidebar}
                onMenu={() => setMobileNavOpen(true)}
                onOpenPalette={() => palette.setOpen(true)}
              />
              <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-auto">
                {blockedFeature ? <LargerScreen feature={blockedFeature} workspace={wsSlug} /> : children}
              </main>
            </div>
          </div>
        </div>
      )}
      {/* Off-canvas workspace nav for phones; the static sidebar is hidden below md. */}
      {mobileNavOpen && !inProject && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true" aria-label="Workspace navigation">
          <div className="absolute inset-0 bg-slate-900/45" onMouseDown={() => setMobileNavOpen(false)} aria-hidden />
          <div
            className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] animate-in slide-in-from-left duration-200"
            onClickCapture={(e) => {
              // Any link tap navigates; close the drawer with it.
              if ((e.target as HTMLElement).closest("a")) setMobileNavOpen(false);
            }}
          >
            <Sidebar wsSlug={wsSlug} pathname={pathname} variant="drawer" />
          </div>
        </div>
      )}
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      <ShortcutCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
      {ws && project && (
        <ConnectAiDialog
          open={connectOpen}
          onOpenChange={setConnectOpen}
          projectId={project.id}
          projectName={project.name}
          projectSlug={project.slug}
          wsId={ws.id}
          wsSlug={wsSlug}
        />
      )}
    </div>
  );
}

