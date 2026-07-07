import { useParams, useRouterState, useSearch } from "@tanstack/react-router";
import { Sidebar } from "./Sidebar";
import { GlobalTopBar } from "./GlobalTopBar";
import { ProjectHeader } from "./project/ProjectHeader";
import { ProjectSidebar } from "./project/ProjectSidebar";
import { CommandPalette, useCommandPalette } from "../CommandPalette";
import { ShortcutCheatsheet } from "../ShortcutCheatsheet";
import { AgentDock } from "@/components/agent/AgentDock";
import { useEffect, useState, type ReactNode } from "react";
import { editorBus } from "@/lib/cms/editor-bus";
import { isEditableTarget } from "@/lib/cms/shortcuts";
import { getProjectBySlug, getWorkspaceBySlug } from "@/lib/cms/use-cms";

interface Props {
  wsSlug: string;
  children: ReactNode;
}

type Scope = "pages" | "collections" | "components";

export function AppShell({ wsSlug, children }: Props) {
  const palette = useCommandPalette();
  const [cheatsheetOpen, setCheatsheetOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { project: projectSlug } = useParams({ strict: false }) as { project?: string };
  const search = useSearch({ strict: false }) as { scope?: Scope; view?: "pages" | "content" };
  const inProject = Boolean(projectSlug);

  useEffect(() => {
    const off = editorBus.on((e) => {
      if (e.type === "editor:open-cheatsheet") setCheatsheetOpen(true);
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
              {children}
            </main>
            {/* In-flow so content compresses instead of being covered. */}
            <AgentDock wsSlug={wsSlug} projectSlug={project.slug} projectId={project.id} sitePlan={project.sitePlan ?? "free"} />
          </div>
        </div>
      ) : (
        <div key="workspace" className="flex min-h-0 flex-1 animate-in fade-in duration-200">
          <div className="contents animate-in fade-in slide-in-from-left-2 duration-300">
            <Sidebar wsSlug={wsSlug} pathname={pathname} />
          </div>
          <main className="flex min-w-0 min-h-0 flex-1 flex-col overflow-auto bg-background animate-in fade-in duration-300">
            {children}
          </main>
        </div>
      )}
      <CommandPalette open={palette.open} onOpenChange={palette.setOpen} />
      <ShortcutCheatsheet open={cheatsheetOpen} onOpenChange={setCheatsheetOpen} />
    </div>
  );
}

