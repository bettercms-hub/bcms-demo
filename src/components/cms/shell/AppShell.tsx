import { useParams, useRouterState, useSearch } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { GlobalTopBar } from "./GlobalTopBar";
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

export function AppShell({ wsSlug, children }: Props) {
  const palette = useCommandPalette();
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const [connectOpen, setConnectOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
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
      <GlobalTopBar
        onOpenPalette={() => palette.setOpen(true)}
        onMenu={!inProject ? () => setMobileNavOpen(true) : undefined}
        project={
          inProject && ws && project
            ? {
                wsSlug,
                wsName: ws.name,
                projectSlug: project.slug,
                projectName: project.name,
                status: project.publishState ?? "draft",
              }
            : undefined
        }
      />
      {inProject && ws && project ? (
        <div key="project" className="flex min-h-0 flex-1 flex-col animate-in fade-in duration-200">
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
        <div key="workspace" className="flex min-h-0 flex-1 animate-in fade-in duration-200">
          <div className="contents animate-in fade-in slide-in-from-left-2 duration-300">
            <Sidebar wsSlug={wsSlug} pathname={pathname} />
          </div>
          <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-auto bg-background animate-in fade-in duration-300">
            {blockedFeature ? <LargerScreen feature={blockedFeature} workspace={wsSlug} /> : children}
          </main>
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

