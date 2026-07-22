/**
 * TransferProjectDialog — move a project to another workspace, Webflow-style.
 *
 * Two destinations:
 * - One of your workspaces: instant move.
 * - Someone else's email: creates a pending request they accept from their
 *   dashboard (they pick the receiving workspace); you can cancel meanwhile.
 *
 * Both paths warn that the site plan resets to Starter and custom domains
 * disconnect — billing always belongs to the destination workspace.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, Building2, Check, Mail, TriangleAlert, X } from "lucide-react";
import { toast } from "sonner";
import { useCMS } from "@/lib/cms/store";
import { transferActions } from "@/lib/workspace/transfers-store";
import { cn } from "@/lib/utils";

export function TransferProjectDialog({
  project,
  fromWorkspaceId,
  fromWorkspaceName,
  onClose,
  onTransferred,
}: {
  project: { id: string; name: string };
  fromWorkspaceId: string;
  fromWorkspaceName: string;
  onClose: () => void;
  /** Fires after an instant move (callers on project routes navigate away). */
  onTransferred?: () => void;
}) {
  const workspaces = useCMS((s) => s.workspaces);
  const others = workspaces.filter((w) => w.id !== fromWorkspaceId);
  const [mode, setMode] = useState<"workspace" | "email">("workspace");
  const [targetId, setTargetId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  const emailValid = /.+@.+\..+/.test(email.trim());
  const canSubmit = mode === "workspace" ? targetId !== "" : emailValid;

  function submit() {
    if (mode === "workspace") {
      const target = others.find((w) => w.id === targetId);
      if (!target) return;
      transferActions.toOwnWorkspace(project.id, target.id);
      toast.success(`${project.name} moved to ${target.name}`);
      onTransferred?.();
    } else {
      transferActions.sendToEmail({
        projectId: project.id,
        projectName: project.name,
        fromWorkspaceId,
        fromWorkspaceName,
        toEmail: email,
        note: note.trim() || undefined,
      });
      toast.success(`Transfer request sent to ${email.trim()}`);
    }
    onClose();
  }

  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-[rgba(24,18,16,0.4)]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Transfer ${project.name}`}
        className="absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)] text-foreground shadow-[var(--shadow-3)]"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <ArrowLeftRight className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">Transfer project</div>
            <div className="truncate text-[11.5px] text-muted-foreground">{project.name} · from {fromWorkspaceName}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">
          {/* Destination type */}
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: "workspace", label: "My workspaces", blurb: "Move it instantly", icon: Building2 },
                { id: "email", label: "Someone else", blurb: "They accept by email", icon: Mail },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setMode(o.id)}
                aria-pressed={mode === o.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-left transition-colors",
                  mode === o.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)]"
                    : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]",
                )}
              >
                <o.icon className={cn("h-4 w-4", mode === o.id ? "text-primary" : "text-muted-foreground")} />
                <div className="mt-1.5 text-[12.5px] font-semibold">{o.label}</div>
                <div className="text-[10.5px] text-muted-foreground">{o.blurb}</div>
              </button>
            ))}
          </div>

          {mode === "workspace" ? (
            <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
              {others.length === 0 && (
                <div className="px-3 py-6 text-center text-[12.5px] text-muted-foreground">No other workspaces yet. Create one from the workspace switcher.</div>
              )}
              {others.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => setTargetId(w.id)}
                  aria-pressed={targetId === w.id}
                  className={cn(
                    "flex w-full items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-3 py-2.5 text-left transition-colors last:border-b-0",
                    targetId === w.id ? "bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)]" : "hover:bg-[color:var(--color-row-hover)]",
                  )}
                >
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-[color:var(--s2)] text-[11px] font-semibold uppercase text-muted-foreground">
                    {w.name.slice(0, 1)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{w.name}</span>
                    <span className="block text-[11px] capitalize text-muted-foreground">{w.workspacePlan ?? "free"} plan · {w.projectIds.length} {w.projectIds.length === 1 ? "project" : "projects"}</span>
                  </span>
                  {targetId === w.id && <Check className="h-4 w-4 shrink-0 text-primary" />}
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              <label className="block">
                <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Recipient email</div>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@company.com"
                  type="email"
                  className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]"
                />
              </label>
              <label className="block">
                <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Note (optional)</div>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  placeholder="Handing this site over as agreed."
                  className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 py-2 text-[13px] leading-relaxed outline-none transition-colors focus:border-[color:var(--primary)]"
                />
              </label>
              <p className="text-[11px] leading-relaxed text-muted-foreground">
                They accept the transfer from their dashboard and choose which of their workspaces receives the project. You can cancel any time before that.
              </p>
            </div>
          )}

          <div className="flex items-start gap-2 rounded-lg border border-[color-mix(in_srgb,var(--status-warning)_30%,transparent)] bg-[color-mix(in_srgb,var(--status-warning)_8%,transparent)] px-3 py-2.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[color:var(--status-warning)]" />
            <p className="text-[11.5px] leading-relaxed text-[color:var(--status-warning)]">
              Pages, content, schemas, forms and media all move with the project. The site plan resets to Starter and custom domains disconnect. The new workspace owns billing.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">
          <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {mode === "workspace" ? "Transfer project" : "Send transfer request"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
