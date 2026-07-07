/**
 * Agent — the global agent surface for a project.
 *
 * Empty state is a focused, Notion-style ask screen: one composer,
 * skill suggestions, recent runs. A run in flight turns the page into
 * the thread with plan approval and staged-change review. The dock is
 * the same engine in sidebar form; this page is where big jobs live.
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, ScanSearch, Sparkles, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { getProjectBySlug } from "@/lib/cms/use-cms";
import { canCompose, canEditContent, canSeeDeveloper, useEffectiveRole } from "@/lib/workspace/my-role";
import { SeoPagesDialog } from "@/components/cms/generate/SeoPagesDialog";
import { AbmPageDialog } from "@/components/cms/generate/AbmPageDialog";
import { AGENT_SKILLS } from "@/lib/agent/skills";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { aiAction, tierAllowed } from "@/lib/billing/pricing";
import { AgentComposer } from "@/components/agent/AgentComposer";
import { AgentRoster } from "@/components/agent/AgentRoster";
import { AgentHistory } from "@/components/agent/AgentHistory";
import { ConnectedAgents } from "@/components/agent/ConnectedAgents";
import { AgentThread } from "@/components/agent/AgentThread";

export const Route = createFileRoute("/w/$workspace/p/$project/agent")({
  component: AgentPage,
  // The workspace agent hands off here with the run it just started.
  validateSearch: (search: Record<string, unknown>): { run?: string } => ({
    run: typeof search.run === "string" ? search.run : undefined,
  }),
});

function AgentPage() {
  const { workspace, project } = Route.useParams();
  const { run: handoffRunId } = Route.useSearch();
  const pr = getProjectBySlug(workspace, project);
  const { effective } = useEffectiveRole(workspace);
  const canRun = canEditContent(effective);
  const runs = useAgentRuns(pr?.id ?? "");
  const [activeRunId, setActiveRunId] = useState<string | null>(handoffRunId ?? null);
  const [seed, setSeed] = useState<{ text: string; n: number } | null>(null);
  const [generator, setGenerator] = useState<"seo" | "abm" | null>(null);

  const active = runs.find((r) => r.id === activeRunId) ?? null;

  if (!pr) {
    return (
      <div className="grid min-h-0 flex-1 place-items-center p-8 text-[13px] text-muted-foreground">
        Project not found. Pick a project from the dashboard.
      </div>
    );
  }

  const start = (input: Omit<Parameters<typeof agentRunActions.start>[0], "projectId">) => {
    const id = agentRunActions.start({ projectId: pr.id, ...input });
    setActiveRunId(id);
  };

  /* --------------------------------------------------------- thread view */

  if (active) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-6 py-6">
          <button
            type="button"
            onClick={() => setActiveRunId(null)}
            className="mb-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All tasks
          </button>
          <AgentThread
            run={active}
            canAct={canRun}
            onFollowUp={(skillId, prompt) => canRun && start({ prompt, tier: active.tier, context: [], skillId })}
          />
        </div>
      </div>
    );
  }

  /* ---------------------------------------------------------- ask screen */

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto w-full max-w-[640px] px-6 pb-16 pt-[9vh]">
        <div className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--card)] text-primary shadow-[var(--shadow-card)]">
            <Sparkles className="h-6 w-6" />
          </span>
          <h1 className="mt-4 text-[26px] font-semibold tracking-[-0.01em] text-foreground">
            How can I help you today?
          </h1>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            The agent drafts and stages changes for your review. Publishing stays with you.
          </p>
        </div>

        <div className="mt-7">
          <AgentComposer
            key={seed?.n ?? 0}
            projectId={pr.id}
            wsSlug={workspace}
            sitePlan={pr.sitePlan ?? "free"}
            size="hero"
            autoFocus
            seed={seed?.text}
            disabled={!canRun}
            onSubmit={(input) => start(input)}
          />
        </div>

        {/* skills */}
        <div className="mt-8">
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Skills</p>
          <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
            {AGENT_SKILLS.map((s) => {
              const cost = aiAction(s.actionId)?.costs;
              const base = cost?.lite ?? cost?.balanced ?? cost?.max;
              const gated = s.minTier === "max" && !tierAllowed(pr.sitePlan ?? "free", "max");
              const hint = gated
                ? "Max, on Pro and above"
                : base
                  ? `from ${base} ${base === 1 ? "credit" : "credits"}`
                  : "";
              const usable = canRun && !gated;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={!usable}
                  onClick={() => setSeed({ text: s.suggestion, n: (seed?.n ?? 0) + 1 })}
                  className={cn(
                    "flex w-full items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3 text-left transition-colors last:border-b-0",
                    usable ? "hover:bg-[color:var(--color-row-hover)]" : "cursor-not-allowed opacity-60",
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary">
                    <s.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{s.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{s.blurb}</span>
                  </span>
                  {hint && <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/80">{hint}</span>}
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              );
            })}
          </div>
        </div>

        {/* generators: structured jobs with their own wizards */}
        {canCompose(effective) && (
          <div className="mt-6">
            <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Generators</p>
            <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
              {(
                [
                  { id: "seo" as const, icon: ScanSearch, label: "SEO pages from keywords", blurb: "Paste a list or a CSV, get one draft page per keyword", hint: "Basic and above" },
                  { id: "abm" as const, icon: Users, label: "ABM page for an account", blurb: "One page personalized for one target account", hint: "Pro and above" },
                ]
              ).map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGenerator(g.id)}
                  className="flex w-full items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-[color:var(--color-row-hover)]"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-primary">
                    <g.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-foreground">{g.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{g.blurb}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground/80">{g.hint}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />
                </button>
              ))}
            </div>
          </div>
        )}

        {generator === "seo" && (
          <SeoPagesDialog projectId={pr.id} workspace={workspace} project={project} sitePlan={pr.sitePlan ?? "free"} onClose={() => setGenerator(null)} />
        )}
        {generator === "abm" && (
          <AbmPageDialog projectId={pr.id} workspace={workspace} project={project} sitePlan={pr.sitePlan ?? "free"} onClose={() => setGenerator(null)} />
        )}

        {/* named agents: several can work at once */}
        <AgentRoster
          projectId={pr.id}
          sitePlan={pr.sitePlan ?? "free"}
          canRun={canRun}
          onRunStarted={(id) => setActiveRunId(id)}
        />

        {/* full history: the agent audit trail, with per-run undo */}
        <AgentHistory projectId={pr.id} canRun={canRun} onOpen={(id) => setActiveRunId(id)} />

        {/* outside tools: developer surface */}
        {canSeeDeveloper(effective) && <ConnectedAgents projectId={pr.id} />}
      </div>
    </div>
  );
}
