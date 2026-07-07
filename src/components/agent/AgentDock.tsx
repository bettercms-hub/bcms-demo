/**
 * AgentDock — the agent as a right-side panel, available on every
 * project surface. Same engine and components as the full Agent page;
 * this is the "work alongside me" form factor.
 */
import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Expand, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { agentDock, useAgentDock } from "@/lib/agent/dock-store";
import { agentRunActions, runIsActive, useAgentRuns } from "@/lib/agent/runs-store";
import { canEditContent, useEffectiveRole } from "@/lib/workspace/my-role";
import type { SitePlanId } from "@/lib/cms/types";
import { AgentComposer } from "./AgentComposer";
import { AgentThread, RunStatusChip } from "./AgentThread";

interface Props {
  wsSlug: string;
  projectSlug: string;
  projectId: string;
  sitePlan: SitePlanId;
}

function closeDock() {
  agentDock.close();
  // Hand focus back to the header toggle so keyboard users are not stranded.
  document.querySelector<HTMLElement>("[data-agent-dock-toggle]")?.focus();
}

export function AgentDock({ wsSlug, projectSlug, projectId, sitePlan }: Props) {
  const { open, activeRunId } = useAgentDock();
  const runs = useAgentRuns(projectId);
  const { effective } = useEffectiveRole(wsSlug);
  const canRun = canEditContent(effective);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const onAgentPage = pathname.endsWith("/agent");
  const asideRef = useRef<HTMLElement>(null);

  // Move focus into the panel when it opens.
  useEffect(() => {
    if (open && canRun && !onAgentPage) asideRef.current?.focus();
  }, [open, canRun, onAgentPage]);

  // The dock is an agent surface: seats that cannot run tasks never see it,
  // even if the open flag survived a role or workspace switch. And the Agent
  // page IS the agent, so the dock never doubles up next to it.
  if (!open || !canRun || onAgentPage) return null;

  const active = runs.find((r) => r.id === activeRunId) ?? runs.find(runIsActive) ?? null;
  const recent = runs.filter((r) => r.id !== active?.id).slice(0, 4);

  const start = (input: Omit<Parameters<typeof agentRunActions.start>[0], "projectId">) => {
    const id = agentRunActions.start({ projectId, ...input });
    agentDock.setRun(id);
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Agent"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") closeDock();
      }}
      className="relative flex h-full w-[400px] max-w-[40vw] shrink-0 flex-col border-l border-[color:var(--color-border)] bg-[color:var(--card)] outline-none animate-in slide-in-from-right-4 duration-200"
    >
      {/* header */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-[color:var(--border-hairline)] px-3">
        <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-primary">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <span className="text-[13px] font-semibold text-foreground">Agent</span>
        <div className="ml-auto flex items-center gap-0.5">
          {active && canRun && (
            <button
              type="button"
              title="New task"
              aria-label="New task"
              onClick={() => agentDock.setRun(null)}
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <Link
            to="/w/$workspace/p/$project/agent"
            params={{ workspace: wsSlug, project: projectSlug }}
            title="Open full view"
            aria-label="Open full view"
            onClick={() => agentDock.close()}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Expand className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            title="Close"
            aria-label="Close agent"
            onClick={closeDock}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {active ? (
          <AgentThread
            run={active}
            compact
            canAct={canRun}
            onFollowUp={(skillId, prompt) => canRun && start({ prompt, tier: active.tier, context: [], skillId })}
          />
        ) : (
          <div className="flex h-full flex-col">
            <div className="pt-6 text-center">
              <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary">
                <Sparkles className="h-5 w-5" />
              </span>
              <p className="mt-3 text-[14px] font-semibold text-foreground">What should the agent do?</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                The agent proposes changes and saves drafts. You publish.
              </p>
            </div>
            {recent.length > 0 && (
              <div className="mt-6">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">Recent tasks</p>
                <div className="space-y-1">
                  {recent.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => agentDock.setRun(r.id)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--color-row-hover)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-medium text-foreground">{r.title}</span>
                        <span className="block truncate text-[11px] text-muted-foreground">{r.prompt}</span>
                      </span>
                      <RunStatusChip status={r.status} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* composer */}
      <div className={cn("shrink-0 border-t border-[color:var(--border-hairline)] p-3", active && "bg-[color:var(--s2)]/40")}>
        <AgentComposer
          projectId={projectId}
          wsSlug={wsSlug}
          sitePlan={sitePlan}
          size="compact"
          disabled={!canRun}
          onSubmit={(input) => start(input)}
        />
      </div>
    </aside>
  );
}
