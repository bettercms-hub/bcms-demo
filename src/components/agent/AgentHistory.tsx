/**
 * AgentHistory — every agent task on this project, the audit trail for
 * agent work: who (agent), what (skill), when, applied count, cost, and
 * whether it was undone. Searchable, exportable, and each applied run
 * has a one-click Undo right here.
 */
import { useMemo, useState } from "react";
import { Download, Search, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { agentRunActions, useAgentRuns } from "@/lib/agent/runs-store";
import { agentSkill } from "@/lib/agent/skills";
import type { AgentRun } from "@/lib/agent/types";
import { RunStatusChip } from "./AgentThread";

interface Props {
  projectId: string;
  canRun: boolean;
  onOpen: (runId: string) => void;
}

const PAGE = 8;

export function AgentHistory({ projectId, canRun, onOpen }: Props) {
  const runs = useAgentRuns(projectId);
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return runs;
    return runs.filter(
      (r) => r.title.toLowerCase().includes(q) || r.prompt.toLowerCase().includes(q) || (r.agentName ?? "").toLowerCase().includes(q),
    );
  }, [runs, query]);

  if (runs.length === 0) return null;

  const exportCsv = () => {
    const headers = ["When", "Agent", "Task", "Prompt", "Status", "Applied", "Reverted", "Cost"];
    const rows = runs.map((r) => [
      new Date(r.createdAt).toISOString(),
      r.agentName ?? "You",
      agentSkill(r.skillId)?.label ?? r.title,
      r.prompt,
      r.status,
      String(r.appliedCount),
      r.reverted ? "yes" : "no",
      r.model ? `key:${r.model}` : `${r.creditsSpent} credits`,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "agent-history.csv";
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`Exported ${runs.length} ${runs.length === 1 ? "task" : "tasks"}`);
  };

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center gap-2 px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">History</p>
        <span className="text-[11px] tabular-nums text-muted-foreground/70">{runs.length}</span>
        <div className="relative ml-auto">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setLimit(PAGE);
            }}
            placeholder="Search tasks"
            className="h-7 w-40 rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] pl-7 pr-2 text-[12px] text-foreground outline-none transition-[width] placeholder:text-muted-foreground/60 focus:w-52 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          title="Export history"
          aria-label="Export history"
          className="grid h-7 w-7 place-items-center rounded-md border border-[color:var(--color-border)] text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          <Download className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
        {filtered.slice(0, limit).map((r) => (
          <HistoryRow key={r.id} run={r} canRun={canRun} onOpen={() => onOpen(r.id)} />
        ))}
        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">No tasks match that search.</p>
        )}
      </div>

      {filtered.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((n) => n + PAGE)}
          className="mt-2 w-full rounded-lg border border-[color:var(--color-border)] py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
        >
          Show more ({filtered.length - limit} older)
        </button>
      )}
    </div>
  );
}

function HistoryRow({ run, canRun, onOpen }: { run: AgentRun; canRun: boolean; onOpen: () => void }) {
  const canUndo = canRun && run.appliedCount > 0 && !run.reverted && (run.undo?.length ?? 0) > 0;
  return (
    <div className="group flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5 last:border-b-0 hover:bg-[color:var(--color-row-hover)]">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-foreground">{run.title}</span>
            {run.reverted && (
              <span className="shrink-0 rounded bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Undone
              </span>
            )}
          </span>
          <span className="block truncate text-[11.5px] text-muted-foreground">{run.prompt}</span>
        </span>
        <span className="hidden shrink-0 text-[11px] text-muted-foreground/70 sm:block">{timeAgo(run.createdAt)}</span>
        {run.appliedCount > 0 && !run.reverted && (
          <span className="hidden shrink-0 text-[11px] tabular-nums text-muted-foreground/70 md:block">
            {run.appliedCount} applied
          </span>
        )}
        <RunStatusChip status={run.status} />
      </button>
      {canUndo && (
        <button
          type="button"
          onClick={() => {
            const { reverted, skipped } = agentRunActions.undo(run.id);
            if (reverted > 0) toast.success(`Undone. Reverted ${reverted} ${reverted === 1 ? "change" : "changes"}.`);
            if (skipped > 0) toast(`${skipped} kept`, { description: "Published or edited since, so left alone." });
          }}
          className={cn(
            "inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-[color:var(--color-border)] px-2 text-[11.5px] font-medium text-foreground opacity-0 transition-opacity hover:bg-[color:var(--card)] group-hover:opacity-100 focus-visible:opacity-100",
          )}
          title="Undo this run"
        >
          <Undo2 className="h-3 w-3" /> Undo
        </button>
      )}
    </div>
  );
}

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
