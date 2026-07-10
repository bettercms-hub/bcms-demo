/**
 * AgentThread — renders one agent run from prompt to outcome.
 *
 * planning: streamed steps
 * awaiting_approval: the plan card with Approve and Reject
 * applying: streamed steps
 * review: staged changes with per-change accept, then one Apply
 * done: what was applied, credits spent, or audit findings
 */
import { Link, useParams } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Database,
  FilePlus2,
  FileText,
  Loader2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Undo2,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { agentRunActions } from "@/lib/agent/runs-store";
import { docAccepted, groupChanges, type ChangeDoc, type ChangeDocKind } from "@/lib/agent/change-set";
import type { AgentRun, ProposedChange } from "@/lib/agent/types";

const DOC_ICON: Record<ChangeDocKind, typeof FileText> = {
  entry: Database,
  page: FileText,
  newEntry: FilePlus2,
};

interface Props {
  run: AgentRun;
  /** Start a follow-up run (audit's Fix with agent). */
  onFollowUp?: (skillId: string, prompt: string) => void;
  compact?: boolean;
  /** Whether this seat may approve plans and apply changes. */
  canAct?: boolean;
}

export function AgentThread({ run, onFollowUp, compact, canAct = true }: Props) {
  return (
    <div className={cn("space-y-4", compact ? "text-[13px]" : "text-[13.5px]")}>
      {/* the ask */}
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-[color:var(--s2)] px-3.5 py-2.5">
          {run.context.length > 0 && (
            <div className="mb-1.5 flex flex-wrap gap-1">
              {run.context.map((c) => (
                <span
                  key={`${c.kind}:${c.id}`}
                  className="inline-flex items-center gap-1 rounded bg-[color:var(--card)] px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground"
                >
                  {c.kind === "collection" ? <Database className="h-2.5 w-2.5" /> : <FileText className="h-2.5 w-2.5" />}
                  {c.label}
                </span>
              ))}
            </div>
          )}
          <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{run.prompt}</p>
        </div>
      </div>

      {/* steps */}
      {run.steps.length > 0 && (
        <ol className="space-y-1.5" aria-label="Task steps">
          {run.steps.map((s) => (
            <li key={s.id} className="flex items-center gap-2 text-[12.5px]">
              {s.status === "running" ? (
                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-primary" />
              ) : (
                <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              )}
              <span className={s.status === "running" ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
              {s.detail && <span className="text-[11px] text-muted-foreground/70">{s.detail}</span>}
            </li>
          ))}
        </ol>
      )}

      {/* plan */}
      {run.plan && run.status === "awaiting_approval" && (
        <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
          <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-4 py-2.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[12.5px] font-semibold text-foreground">Plan</span>
            <span className="ml-auto text-[11.5px] tabular-nums text-muted-foreground">
              {run.model ? `${run.model} · your key` : `About ${run.plan.estimate.min} to ${run.plan.estimate.max} credits`}
            </span>
          </div>
          <div className="px-4 py-3">
            <p className="text-[13px] font-medium text-foreground">{run.plan.goal}</p>
            <ul className="mt-2 space-y-1">
              {run.plan.items.map((it, i) => (
                <li key={i} className="flex items-start gap-2 text-[12.5px] text-muted-foreground">
                  <ArrowRight className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/60" />
                  {it}
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 border-t border-[color:var(--border-hairline)] pt-2.5">
              {run.plan.boundaries.map((b, i) => (
                <p key={i} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                  <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                  {b}
                </p>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-4 py-2.5">
            {canAct ? (
              <>
                <button
                  type="button"
                  onClick={() => agentRunActions.rejectPlan(run.id)}
                  className="inline-flex h-7 items-center rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
                >
                  Reject
                </button>
                <button
                  type="button"
                  onClick={() => agentRunActions.approvePlan(run.id)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                >
                  <Check className="h-3.5 w-3.5" /> Approve and run
                </button>
              </>
            ) : (
              <span className="text-[11.5px] text-muted-foreground">Your seat can view this task, not act on it.</span>
            )}
          </div>
        </div>
      )}

      {/* review */}
      {run.status === "review" && <ProposalReview run={run} canAct={canAct} />}

      {/* outcomes */}
      {run.status === "rejected" && (
        <p className="text-[12.5px] text-muted-foreground">Plan rejected. Nothing was changed.</p>
      )}
      {run.status === "done" && <DoneCard run={run} onFollowUp={onFollowUp} />}
    </div>
  );
}

/* ------------------------------------------------------------- proposals */

function ProposalReview({ run, canAct }: { run: AgentRun; canAct: boolean }) {
  const accepted = run.proposals.filter((p) => p.status === "accepted").length;
  const docs = groupChanges(run);
  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
      <div className="flex items-center gap-2 border-b border-[color:var(--border-hairline)] px-4 py-2.5">
        <span className="text-[12.5px] font-semibold text-foreground">Proposed changes</span>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </span>
        {canAct && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                agentRunActions.discard(run.id);
                toast("Changes discarded", { description: "Nothing was written." });
              }}
              className="inline-flex h-6 items-center gap-1 rounded-md border border-[color:var(--color-border)] px-2 text-[11.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Trash2 className="h-3 w-3" /> Discard
            </button>
            <button
              type="button"
              disabled={accepted === 0}
              onClick={() => {
                agentRunActions.confirmAll(run.id);
                toast.success("Changes applied", { description: "Saved as drafts. Publishing stays with you." });
              }}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-emerald-600 px-2 text-[11.5px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-40"
            >
              <Check className="h-3 w-3" /> Confirm all
            </button>
          </div>
        )}
      </div>

      {run.note && (
        <div className="flex items-start gap-1.5 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 px-4 py-2">
          <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-primary" />
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">{run.note}</p>
        </div>
      )}

      <div className="max-h-[360px] overflow-y-auto">
        {docs.map((doc) => (
          <DocGroup key={doc.key} runId={run.id} doc={doc} disabled={!canAct} />
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-4 py-2.5">
        <span className="text-[11.5px] text-muted-foreground">Saved as drafts. Publishing stays with you.</span>
        <button
          type="button"
          disabled={accepted === 0 || !canAct}
          title={canAct ? undefined : "Your seat can view this task, not act on it"}
          onClick={() => agentRunActions.apply(run.id)}
          className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Check className="h-3.5 w-3.5" /> Apply {accepted} {accepted === 1 ? "change" : "changes"}
        </button>
      </div>
    </div>
  );
}

function DocGroup({ runId, doc, disabled }: { runId: string; doc: ChangeDoc; disabled?: boolean }) {
  const Icon = DOC_ICON[doc.kind];
  const on = docAccepted(doc);
  const applied = doc.changes.every((c) => c.status === "applied");
  return (
    <div className="border-b border-[color:var(--border-hairline)] last:border-b-0">
      <div className="flex items-center gap-2 bg-[color:var(--s2)]/30 px-4 py-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={`Include changes to ${doc.label}`}
          disabled={disabled || applied}
          onClick={() => agentRunActions.setProposals(runId, doc.changes.map((c) => c.id), on ? "rejected" : "accepted")}
          className={cn(
            "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors disabled:opacity-60",
            on ? "border-primary bg-primary text-primary-foreground" : "border-[color:var(--color-border)] bg-[color:var(--card)]",
          )}
        >
          {on && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">{doc.label}</span>
        <span className="shrink-0 text-[10.5px] text-muted-foreground">
          {doc.changes.length} {doc.changes.length === 1 ? "change" : "changes"}
        </span>
      </div>
      {doc.changes.map((p) => (
        <ProposalRow key={p.id} runId={runId} p={p} disabled={disabled} />
      ))}
    </div>
  );
}

function ProposalRow({ runId, p, disabled }: { runId: string; p: ProposedChange; disabled?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const on = p.status === "accepted";
  const long = p.after.length > 160;
  return (
    <div className="border-b border-[color:var(--border-hairline)] px-4 py-2.5 last:border-b-0">
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={on}
          aria-label={`Include change to ${p.targetLabel}`}
          disabled={disabled}
          onClick={() => agentRunActions.setProposal(runId, p.id, on ? "rejected" : "accepted")}
          className={cn(
            "mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
            on ? "border-primary bg-primary text-primary-foreground" : "border-[color:var(--color-border)] bg-[color:var(--card)]",
          )}
        >
          {on && <Check className="h-3 w-3" strokeWidth={3} />}
        </button>
        <div className={cn("min-w-0 flex-1", !on && "opacity-45")}>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[12.5px] font-medium text-foreground">{p.targetLabel}</span>
            {p.fieldPath && (
              <span className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {p.fieldPath}
              </span>
            )}
          </div>
          <div className="mt-1 text-[12.5px] leading-relaxed">
            {p.before ? (
              <>
                <span className="break-words text-muted-foreground line-through decoration-muted-foreground/40">{p.before}</span>
                <span className="mx-1.5 text-muted-foreground/50" aria-hidden>
                  to
                </span>
              </>
            ) : null}
            <span className={cn("break-words text-foreground", !expanded && long && "line-clamp-2")}>{stripTags(p.after)}</span>
          </div>
          {long && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {expanded ? "Show less" : "Show more"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{p.reason}</p>
        </div>
      </div>
    </div>
  );
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ done */

function DoneCard({ run, onFollowUp }: { run: AgentRun; onFollowUp?: (skillId: string, prompt: string) => void }) {
  const { workspace, project } = useParams({ strict: false }) as { workspace?: string; project?: string };
  // Only link to the draft when its creation actually applied.
  const draftCollectionId =
    run.skillId === "draft"
      ? run.proposals.find((p) => p.operation === "content.generate" && p.status === "applied")?.targetId
      : undefined;
  const fixable = run.findings.filter((f) => f.fixable).length;

  const canUndo = run.appliedCount > 0 && !run.reverted && (run.undo?.length ?? 0) > 0;

  return (
    <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
      <div className="flex items-center gap-2 px-4 py-3">
        {run.reverted ? <Undo2 className="h-4 w-4 text-muted-foreground" /> : <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
        <span className="text-[13px] font-medium text-foreground">
          {run.reverted
            ? "Reverted. The changes were undone."
            : run.findings.length > 0
              ? `Found ${run.findings.length} ${run.findings.length === 1 ? "thing" : "things"} worth a look`
              : run.appliedCount > 0
                ? `Applied ${run.appliedCount} ${run.appliedCount === 1 ? "change" : "changes"}${run.skillId === "draft" ? " as a draft" : ""}`
                : "Done. Nothing needed changing."}
        </span>
        <span className="ml-auto text-[11.5px] tabular-nums text-muted-foreground">
          {run.model ? "Billed to your key" : `${run.creditsSpent} credits`}
        </span>
      </div>

      {run.note && run.appliedCount === 0 && run.findings.length === 0 && (
        <p className="border-t border-[color:var(--border-hairline)] px-4 py-2.5 text-[12px] leading-relaxed text-muted-foreground">{run.note}</p>
      )}

      {run.findings.length > 0 && (
        <div className="max-h-[300px] overflow-y-auto border-t border-[color:var(--border-hairline)]">
          {run.findings.map((f) => (
            <div key={f.id} className="flex items-start gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-2.5 last:border-b-0">
              <CircleAlert className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", f.severity === "warn" ? "text-amber-500" : "text-muted-foreground/60")} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[12.5px] font-medium text-foreground">{f.label}</span>
                  <span className="truncate text-[11px] text-muted-foreground">{f.targetLabel}</span>
                </div>
                <p className="mt-0.5 text-[11.5px] text-muted-foreground">{f.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {(draftCollectionId || (fixable > 0 && onFollowUp) || canUndo) && (
        <div className="flex items-center gap-2 border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-4 py-2.5">
          {draftCollectionId && !run.reverted && workspace && project && (
            <Link
              to="/w/$workspace/p/$project/editor"
              params={{ workspace, project }}
              search={{ scope: "collections" as const, node: `collection:${draftCollectionId}`, section: undefined }}
              className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <FileText className="h-3.5 w-3.5" /> Review the draft
            </Link>
          )}
          {fixable > 0 && onFollowUp && (
            <button
              type="button"
              onClick={() => onFollowUp("backfill", "Backfill the missing metadata the audit found")}
              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Wrench className="h-3.5 w-3.5" /> Fix {fixable} with the agent
            </button>
          )}
          {canUndo && (
            <button
              type="button"
              onClick={() => {
                const { reverted, skipped } = agentRunActions.undo(run.id);
                if (reverted > 0)
                  toast.success(`Undone. Reverted ${reverted} ${reverted === 1 ? "change" : "changes"}.`);
                if (skipped > 0)
                  toast(`${skipped} kept`, { description: "Some changes were published or edited since, so they were left alone." });
              }}
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
            >
              <Undo2 className="h-3.5 w-3.5" /> Undo this run
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Small status chip for run history lists. */
export function RunStatusChip({ status }: { status: AgentRun["status"] }) {
  const meta: Record<AgentRun["status"], { label: string; cls: string }> = {
    planning: { label: "Planning", cls: "bg-[color:var(--s2)] text-muted-foreground" },
    awaiting_approval: { label: "Needs approval", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    applying: { label: "Working", cls: "bg-[color:var(--s2)] text-muted-foreground" },
    review: { label: "Review", cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
    done: { label: "Done", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
    rejected: { label: "Rejected", cls: "bg-[color:var(--s2)] text-muted-foreground" },
    failed: { label: "Failed", cls: "bg-[color:var(--s2)] text-muted-foreground" },
  };
  const m = meta[status];
  return <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[10.5px] font-medium", m.cls)}>{m.label}</span>;
}
