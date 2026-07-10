/**
 * ChangeReview — the full-page review of an agent change set.
 *
 * Three panels, Sanity-Content-Agent style:
 *  - left: the ask, the agent's reasoning and what it left out, a follow-up box
 *  - middle: the proposed changes as per-document cards, with Confirm all /
 *    Discard and per-document accept
 *  - right: a live preview of the selected document with the changed fields
 *    highlighted and an inline before→after diff
 *
 * Everything writes through the same runs-store actions the dock uses, so
 * Apply and Undo behave identically here.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Database, FileText, FilePlus2, Send, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { agentRunActions } from "@/lib/agent/runs-store";
import {
  buildDocPreview,
  diffParts,
  docAccepted,
  groupChanges,
  type ChangeDoc,
  type ChangeDocKind,
  type PreviewField,
} from "@/lib/agent/change-set";
import type { AgentRun } from "@/lib/agent/types";

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

const DOC_ICON: Record<ChangeDocKind, typeof FileText> = {
  entry: Database,
  page: FileText,
  newEntry: FilePlus2,
};

export function ChangeReview({
  run,
  canAct = true,
  onBack,
  onAsk,
}: {
  run: AgentRun;
  canAct?: boolean;
  onBack?: () => void;
  onAsk?: (text: string) => void;
}) {
  const docs = useMemo(() => groupChanges(run), [run]);
  const [selectedKey, setSelectedKey] = useState<string | null>(docs[0]?.key ?? null);
  const selected = docs.find((d) => d.key === selectedKey) ?? docs[0] ?? null;

  const acceptedCount = run.proposals.filter((p) => p.status === "accepted").length;
  const acceptedDocs = docs.filter((d) => d.changes.some((c) => c.status === "accepted")).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[color:var(--background)]">
      {/* header */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> All tasks
          </button>
        )}
        <div className="mx-1 h-4 w-px bg-[color:var(--border-hairline)]" />
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[13.5px] font-semibold text-foreground">Review changes</span>
        <span className="text-[11.5px] tabular-nums text-muted-foreground">
          {docs.length} {docs.length === 1 ? "document" : "documents"}
        </span>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-[minmax(0,300px)_minmax(0,360px)_minmax(0,1fr)]">
        {/* ------------------------------------------------ reasoning */}
        <aside className="hidden min-h-0 flex-col overflow-y-auto border-r border-[color:var(--border-hairline)] md:flex">
          <div className="space-y-4 p-4">
            <div className="rounded-2xl rounded-tl-md bg-[color:var(--s2)] px-3.5 py-2.5">
              <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-foreground">{run.prompt}</p>
            </div>
            {run.note && (
              <div className="flex items-start gap-2 px-1">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{run.note}</p>
              </div>
            )}
            {run.plan && (
              <div className="space-y-1.5 border-t border-[color:var(--border-hairline)] pt-3">
                {run.plan.boundaries.map((b, i) => (
                  <p key={i} className="flex items-start gap-1.5 text-[11.5px] text-muted-foreground">
                    <ShieldCheck className="mt-0.5 h-3 w-3 shrink-0 text-emerald-500" />
                    {b}
                  </p>
                ))}
              </div>
            )}
          </div>
          {onAsk && canAct && <FollowUp onAsk={onAsk} />}
        </aside>

        {/* ------------------------------------------------ change list */}
        <section className="flex min-h-0 flex-col border-r border-[color:var(--border-hairline)]">
          <div className="flex shrink-0 items-center gap-2 border-b border-[color:var(--border-hairline)] px-3 py-2.5">
            <span className="text-[12.5px] font-semibold text-foreground">Proposed changes</span>
            <div className="ml-auto flex items-center gap-1.5">
              <button
                type="button"
                disabled={!canAct}
                onClick={() => {
                  agentRunActions.discard(run.id);
                  toast("Changes discarded", { description: "Nothing was written." });
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-3.5 w-3.5" /> Discard
              </button>
              <button
                type="button"
                disabled={!canAct || acceptedCount === 0}
                onClick={() => {
                  agentRunActions.confirmAll(run.id);
                  toast.success("Changes applied", { description: "Saved as drafts. Publishing stays with you." });
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-emerald-600 px-2.5 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> Confirm all
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {docs.map((doc) => (
              <DocCard
                key={doc.key}
                runId={run.id}
                doc={doc}
                selected={doc.key === selected?.key}
                canAct={canAct}
                onSelect={() => setSelectedKey(doc.key)}
              />
            ))}
          </div>

          {acceptedCount > 0 && acceptedCount < run.proposals.length && (
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] bg-[color:var(--s2)]/50 px-3 py-2.5">
              <span className="text-[11px] text-muted-foreground">{acceptedDocs} of {docs.length} documents selected</span>
              <button
                type="button"
                disabled={!canAct}
                onClick={() => {
                  agentRunActions.apply(run.id);
                  toast.success(`Applied ${acceptedCount} ${acceptedCount === 1 ? "change" : "changes"}`);
                }}
                className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
              >
                <Check className="h-3.5 w-3.5" /> Apply {acceptedCount} selected
              </button>
            </div>
          )}
        </section>

        {/* ------------------------------------------------ preview */}
        <section className="min-h-0 overflow-y-auto max-md:border-t max-md:border-[color:var(--border-hairline)]">
          {selected ? <DocPreviewPanel run={run} doc={selected} /> : (
            <div className="grid h-full place-items-center p-8 text-[13px] text-muted-foreground">
              Select a change to preview it.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- doc card */

function DocCard({
  runId,
  doc,
  selected,
  canAct,
  onSelect,
}: {
  runId: string;
  doc: ChangeDoc;
  selected: boolean;
  canAct: boolean;
  onSelect: () => void;
}) {
  const Icon = DOC_ICON[doc.kind];
  const on = docAccepted(doc);
  const applied = doc.changes.every((c) => c.status === "applied");
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "mb-1 flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
        selected ? "bg-[color:var(--row-selected)]" : "hover:bg-[color:var(--color-row-hover)]",
      )}
    >
      <span
        role="checkbox"
        aria-checked={on}
        aria-label={`Include changes to ${doc.label}`}
        onClick={(e) => {
          e.stopPropagation();
          if (!canAct || applied) return;
          agentRunActions.setProposals(runId, doc.changes.map((c) => c.id), on ? "rejected" : "accepted");
        }}
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded border transition-colors",
          on ? "border-primary bg-primary text-primary-foreground" : "border-[color:var(--color-border)] bg-[color:var(--card)]",
          (!canAct || applied) && "opacity-60",
        )}
      >
        {on && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <Icon className={cn("h-4 w-4 shrink-0", on ? "text-foreground" : "text-muted-foreground")} />
      <span className={cn("min-w-0 flex-1", !on && "opacity-55")}>
        <span className="block truncate text-[12.5px] font-medium text-foreground">{doc.label}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {doc.changes.length} {doc.changes.length === 1 ? "change" : "changes"}
          {doc.context ? ` · ${doc.context}` : ""}
        </span>
      </span>
      {applied && <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />}
    </button>
  );
}

/* ---------------------------------------------------------- preview panel */

function DocPreviewPanel({ run, doc }: { run: AgentRun; doc: ChangeDoc }) {
  const preview = useMemo(() => buildDocPreview(run, doc), [run, doc]);
  const Icon = DOC_ICON[preview.kind];
  return (
    <div className="mx-auto w-full max-w-[720px] p-5">
      <div className="mb-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {preview.typeLabel}
      </div>
      <h2 className="text-[22px] font-semibold tracking-tight text-foreground">{stripTags(preview.title)}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {preview.meta.filter(Boolean).map((m, i) => (
          <span key={i} className="rounded-full bg-[color:var(--s2)] px-2 py-0.5 text-[11px] text-muted-foreground">
            {m}
          </span>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {preview.fields.map((f) => (
          <FieldDiff key={f.id} field={f} />
        ))}
      </div>
    </div>
  );
}

function FieldDiff({ field }: { field: PreviewField }) {
  const dim = field.status === "rejected";
  const beforeText = field.before ? stripTags(field.before) : "";
  const afterText = stripTags(field.after);
  const diff = field.changed ? diffParts(beforeText, afterText) : null;

  return (
    <div className={cn("transition-opacity", dim && "opacity-40")}>
      <div className="mb-1.5 flex items-baseline gap-2">
        <span className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">{field.label}</span>
        {field.context && <span className="text-[11px] text-muted-foreground/70">{field.context}</span>}
        {field.added && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            New
          </span>
        )}
      </div>

      {field.changed && diff && (
        <div className="mb-1.5 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)]/40 px-3 py-2 text-[13px] leading-relaxed text-muted-foreground">
          {diff.before.map((part, i) => (
            <span key={i} className={part.changed ? "rounded bg-rose-500/15 px-0.5 text-rose-600 line-through decoration-rose-500/50 dark:text-rose-400" : ""}>
              {part.text}
            </span>
          ))}
        </div>
      )}

      <div
        className={cn(
          "rounded-lg border px-3 py-2 text-[13px] leading-relaxed text-foreground",
          field.added
            ? "border-emerald-500/40 bg-emerald-500/[0.06]"
            : "border-[color:color-mix(in_oklab,var(--primary)_55%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]",
        )}
      >
        {diff ? (
          diff.after.map((part, i) => (
            <span
              key={i}
              className={part.changed ? "rounded bg-[color:color-mix(in_oklab,var(--primary)_22%,transparent)] px-0.5 font-medium text-foreground" : ""}
            >
              {part.text}
            </span>
          ))
        ) : (
          afterText
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ follow-up */

function FollowUp({ onAsk }: { onAsk: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const t = text.trim();
        if (!t) return;
        onAsk(t);
        setText("");
      }}
      className="mt-auto shrink-0 border-t border-[color:var(--border-hairline)] p-3"
    >
      <div className="flex items-center gap-2 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 py-2">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a follow-up…"
          className="min-w-0 flex-1 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/70"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          aria-label="Send"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-40"
        >
          <Send className="h-3.5 w-3.5" />
        </button>
      </div>
    </form>
  );
}
