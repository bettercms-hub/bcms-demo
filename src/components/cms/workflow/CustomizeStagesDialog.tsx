/**
 * CustomizeStagesDialog — edit a project's workflow stages.
 *
 * Rename, recolor, reorder, add and remove stages, and choose which stage
 * gates publishing. Custom stages are a Team-plan capability; below that
 * the dialog shows the calm locked state instead.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowDown, ArrowUp, Lock, Plus, Trash2, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_WORKFLOW_STAGES, WORKFLOW_STAGE_COLORS, getWorkflow, workflowActions } from "@/lib/cms/store";
import { SITE_PLANS, firstPlanWith, siteHas } from "@/lib/billing/pricing";
import type { SitePlanId, WorkflowStage } from "@/lib/cms/types";

let seq = 0;
const sid = () => `wfs_c${Date.now().toString(36)}${(seq++).toString(36)}`;

export function CustomizeStagesDialog({
  projectId,
  sitePlan,
  wsSlug,
  onClose,
}: {
  projectId: string;
  sitePlan: SitePlanId;
  wsSlug: string;
  onClose: () => void;
}) {
  const allowed = siteHas(sitePlan, "custom-workflows");
  const [stages, setStages] = useState<WorkflowStage[]>(() => getWorkflow(projectId).map((s) => ({ ...s })));

  function patch(i: number, p: Partial<WorkflowStage>) {
    setStages((prev) => prev.map((s, x) => (x === i ? { ...s, ...p } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    setStages((prev) => {
      const next = [...prev];
      const j = i + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function remove(i: number) {
    setStages((prev) => (prev.length <= 2 ? prev : prev.filter((_, x) => x !== i)));
  }
  function add() {
    setStages((prev) => [
      ...prev,
      { id: sid(), name: "New stage", color: WORKFLOW_STAGE_COLORS[prev.length % WORKFLOW_STAGE_COLORS.length] },
    ]);
  }
  function setGate(i: number) {
    setStages((prev) => prev.map((s, x) => ({ ...s, publishGate: x === i })));
  }
  function save() {
    const cleaned = stages.map((s) => ({ ...s, name: s.name.trim() })).filter((s) => s.name.length > 0);
    if (cleaned.length < 2) {
      toast.error("Keep at least two stages");
      return;
    }
    if (!cleaned.some((s) => s.publishGate)) cleaned[cleaned.length - 1].publishGate = true;
    workflowActions.setStages(projectId, cleaned);
    toast.success("Workflow updated");
    onClose();
  }

  const gatePlan = firstPlanWith("custom-workflows");

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-slate-900/45" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Customize workflow stages"
        className="absolute left-1/2 top-[7vh] flex max-h-[86vh] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Customize stages</div>
            <div className="text-[11.5px] text-muted-foreground">
              Stages describe the journey between draft and published. One stage gates publishing.
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {!allowed ? (
          <div className="p-8 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[color:var(--s2)]">
              <Lock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <h2 className="mt-4 text-[14.5px] font-semibold">Custom workflow stages</h2>
            <p className="mx-auto mt-1.5 max-w-sm text-[12.5px] leading-relaxed text-muted-foreground">
              The default Draft, In review, Changes requested and Approved stages are included on your plan. Renaming,
              recoloring and adding stages is available on {gatePlan ? SITE_PLANS[gatePlan].name : "Team"}.
            </p>
            <Link
              to="/w/$workspace/settings/plans"
              params={{ workspace: wsSlug }}
              className="mt-5 inline-flex h-8 items-center rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              See plans
            </Link>
          </div>
        ) : (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-4">
              {stages.map((s, i) => (
                <div key={s.id} className="flex items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 px-2.5 py-2">
                  {/* color */}
                  <button
                    type="button"
                    title="Change color"
                    onClick={() =>
                      patch(i, {
                        color:
                          WORKFLOW_STAGE_COLORS[
                            (WORKFLOW_STAGE_COLORS.indexOf(s.color) + 1 + WORKFLOW_STAGE_COLORS.length) % WORKFLOW_STAGE_COLORS.length
                          ],
                      })
                    }
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full ring-offset-2 ring-offset-[color:var(--card)] transition-transform hover:scale-110"
                    style={{ backgroundColor: s.color }}
                    aria-label={`Stage color ${s.color}`}
                  />
                  <input
                    value={s.name}
                    onChange={(e) => patch(i, { name: e.target.value })}
                    className="h-8 min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 text-[13px] font-medium outline-none transition-colors focus:border-[color:var(--primary)] focus:bg-[color:var(--card)]"
                  />
                  <label className={cn("flex cursor-pointer items-center gap-1.5 text-[11px] font-medium", s.publishGate ? "text-foreground" : "text-muted-foreground")}>
                    <input type="radio" name="publishGate" checked={!!s.publishGate} onChange={() => setGate(i)} className="accent-[var(--primary)]" />
                    Publish gate
                  </label>
                  <div className="flex shrink-0 items-center">
                    <IconBtn label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn label="Move down" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>
                      <ArrowDown className="h-3.5 w-3.5" />
                    </IconBtn>
                    <IconBtn label="Delete stage" disabled={stages.length <= 2} onClick={() => remove(i)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </IconBtn>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={add}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-[color:var(--color-border)] py-2.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:border-[color:var(--primary)] hover:text-foreground"
              >
                <Plus className="h-3.5 w-3.5" /> Add stage
              </button>
            </div>
            <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
              <button
                type="button"
                onClick={() => setStages(DEFAULT_WORKFLOW_STAGES.map((s) => ({ ...s })))}
                className="text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Reset to default
              </button>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
                  Cancel
                </button>
                <button type="button" onClick={save} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
                  Save workflow
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground disabled:cursor-not-allowed disabled:opacity-35"
    >
      {children}
    </button>
  );
}
