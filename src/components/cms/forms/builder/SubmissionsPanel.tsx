import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Inbox, ShieldCheck, Trash2, ExternalLink, Download, ShieldAlert, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  listSubmissions,
  deleteSubmission,
  bulkUpdateSubmissionStatus,
  bulkDeleteSubmissions,
  type SubmissionRow,
} from "@/lib/forms/forms.store";
import type { FormDetail } from "@/lib/forms/types";

type Tab = "submissions" | "spam";

export function SubmissionsPanel({ form }: { form: FormDetail }) {
  const formId = form.id;
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("submissions");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openRow, setOpenRow] = useState<SubmissionRow | null>(null);

  const { data: allRows = [], isLoading } = useQuery<SubmissionRow[]>({
    queryKey: ["submissions", formId],
    queryFn: () => listSubmissions({ data: { formId, status: "all" } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["submissions", formId] });
  const clearSel = () => setSelected(new Set());
  const switchTab = (t: Tab) => {
    setTab(t);
    clearSel();
    setOpenRow(null);
  };

  const activeRows = useMemo(() => allRows.filter((r) => r.status !== "spam"), [allRows]);
  const spamRows = useMemo(() => allRows.filter((r) => r.status === "spam"), [allRows]);
  const rows = tab === "spam" ? spamRows : activeRows;

  // Columns: one per form field (in order), then any extra keys seen in data.
  const columns = useMemo(() => {
    const cols = [...form.fields]
      .sort((a, b) => a.position - b.position)
      .map((f) => ({ key: f.name, label: f.label, kind: f.kind }));
    const known = new Set(cols.map((c) => c.key));
    for (const r of allRows) {
      for (const k of Object.keys(r.data)) {
        if (!known.has(k) && !k.startsWith("_") && !k.startsWith("utm_")) {
          known.add(k);
          cols.push({ key: k, label: prettify(k), kind: "text" });
        }
      }
    }
    return cols;
  }, [form.fields, allRows]);

  const bulkSpamMut = useMutation({
    mutationFn: (v: { ids: string[]; status: "active" | "spam" }) => bulkUpdateSubmissionStatus({ data: v }),
    onSuccess: (_r, v) => {
      invalidate();
      clearSel();
      setOpenRow(null);
      toast.success(v.status === "spam" ? `Moved ${v.ids.length} to spam` : `Restored ${v.ids.length}`);
    },
  });
  const bulkDelMut = useMutation({
    mutationFn: (ids: string[]) => bulkDeleteSubmissions({ data: { ids } }),
    onSuccess: (_r, ids) => {
      invalidate();
      clearSel();
      setOpenRow(null);
      toast.success(`Deleted ${ids.length}`);
    },
  });
  const delOneMut = useMutation({
    mutationFn: (id: string) => deleteSubmission({ data: { id } }),
    onSuccess: () => {
      invalidate();
      setOpenRow(null);
      toast.success("Deleted");
    },
  });

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected((prev) => (prev.size === rows.length && rows.length > 0 ? new Set() : new Set(rows.map((r) => r.id))));
  }

  function exportCsv() {
    const list = selected.size ? rows.filter((r) => selected.has(r.id)) : rows;
    if (!list.length) return;
    const keys = columns.map((c) => c.key);
    const header = ["date", "ip_address", "source", ...keys].join(",");
    const lines = list.map((r) =>
      [
        r.submittedAt,
        r.ipAddress ?? "",
        r.sourceUrl ?? "",
        ...keys.map((k) => csv(cellText(r, k))),
      ].join(","),
    );
    const blob = new Blob([header + "\n" + lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${form.slug || "submissions"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const ids = () => Array.from(selected);
  const hasSel = selected.size > 0;
  const allChecked = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[color:var(--canvas)]">
        {/* Tabs + actions */}
        <div className="flex flex-col gap-3 border-b border-border/60 bg-[color:var(--panel)] px-5 pt-3">
          <div className="flex items-center gap-5">
            <TabButton active={tab === "submissions"} onClick={() => switchTab("submissions")} count={activeRows.length}>
              Submissions
            </TabButton>
            <TabButton active={tab === "spam"} onClick={() => switchTab("spam")} count={spamRows.length}>
              Spam
            </TabButton>
          </div>
          <div className="flex items-center justify-between gap-2 pb-3">
            <div className="text-[12px] text-muted-foreground">
              {hasSel ? (
                <span className="font-medium text-foreground">{selected.size} selected</span>
              ) : (
                `${rows.length} ${rows.length === 1 ? "entry" : "entries"}`
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8" onClick={exportCsv} disabled={!rows.length}>
                <Download className="mr-1.5 h-3.5 w-3.5" /> {hasSel ? "Export" : "Export all"}
              </Button>
              {tab === "submissions" ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={!hasSel}
                  onClick={() => bulkSpamMut.mutate({ ids: ids(), status: "spam" })}
                >
                  <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Report spam
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  disabled={!hasSel}
                  onClick={() => bulkSpamMut.mutate({ ids: ids(), status: "active" })}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Not spam
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-destructive/40"
                disabled={!hasSel}
                onClick={() => {
                  if (confirm(`Delete ${selected.size} submission(s)? This can't be undone.`)) bulkDelMut.mutate(ids());
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
              </Button>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="min-h-0 flex-1 overflow-auto p-4">
          {isLoading ? (
            <div className="p-6 text-center text-xs text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <EmptyState tab={tab} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[color:var(--border-hairline)] bg-card">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[color:var(--border-hairline)] bg-[color:var(--surface-3)]/60 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                    <th className="w-10 px-3 py-2.5">
                      <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Select all" />
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left font-medium">Date</th>
                    {columns.map((c) => (
                      <th key={c.key} className="whitespace-nowrap px-3 py-2.5 text-left font-medium">
                        {c.label}
                      </th>
                    ))}
                    <th className="whitespace-nowrap px-3 py-2.5 text-left font-medium">IP address</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isSel = selected.has(r.id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => setOpenRow(r)}
                        className={`cursor-pointer border-b border-[color:var(--border-hairline)] transition-colors last:border-b-0 hover:bg-[color:var(--row-hover)] ${
                          openRow?.id === r.id || isSel ? "bg-[color:var(--row-selected)]" : ""
                        }`}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <Checkbox checked={isSel} onCheckedChange={() => toggle(r.id)} aria-label="Select row" />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{timeAgo(r.submittedAt)}</td>
                        {columns.map((c) => (
                          <td key={c.key} className="max-w-[280px] truncate px-3 py-2.5 text-foreground">
                            <Cell row={r} col={c} />
                          </td>
                        ))}
                        <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[12px] tabular-nums text-muted-foreground">
                          {r.ipAddress ?? "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail modal */}
      <Dialog open={!!openRow} onOpenChange={(o) => !o && setOpenRow(null)}>
        <DialogContent className="sm:max-w-[520px]">
          {openRow && (
            <>
              <DialogHeader>
                <DialogTitle>Submission</DialogTitle>
                <DialogDescription>{new Date(openRow.submittedAt).toLocaleString()}</DialogDescription>
              </DialogHeader>

              <div className="max-h-[58vh] space-y-4 overflow-y-auto pr-0.5">
                <dl className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--surface-3)]/50 p-3 text-[12.5px]">
                  <dt className="text-muted-foreground">IP address</dt>
                  <dd className="min-w-0 break-all text-right font-mono tabular-nums text-foreground">
                    {openRow.ipAddress ?? "—"}
                  </dd>
                  <dt className="text-muted-foreground">Source</dt>
                  <dd className="min-w-0 break-all text-right text-foreground">
                    {openRow.sourceUrl ? (
                      <a
                        href={openRow.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" /> Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </dd>
                  <dt className="text-muted-foreground">Spam score</dt>
                  <dd className="text-right tabular-nums text-foreground">{openRow.spamScore.toFixed(2)}</dd>
                </dl>

                <dl className="space-y-3">
                  {columns.map((c) => (
                    <div key={c.key} className="border-b border-[color:var(--border-hairline)] pb-3 last:border-b-0 last:pb-0">
                      <dt className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {c.label}
                      </dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words text-[13.5px] text-foreground">
                        {cellText(openRow, c.key) || <span className="text-muted-foreground/50">—</span>}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>

              <DialogFooter className="border-t border-[color:var(--border-hairline)] pt-4 sm:justify-end sm:gap-2">
                {openRow.status === "spam" ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkSpamMut.mutate({ ids: [openRow.id], status: "active" })}
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Not spam
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => bulkSpamMut.mutate({ ids: [openRow.id], status: "spam" })}
                  >
                    <ShieldAlert className="mr-1.5 h-3.5 w-3.5" /> Report spam
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (confirm("Delete this submission? This can't be undone.")) delOneMut.mutate(openRow.id);
                  }}
                  className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Delete
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative -mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13px] font-medium transition-colors ${
        active ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
      {count > 0 && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
            active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function EmptyState({ tab }: { tab: Tab }) {
  return (
    <div className="flex h-full items-center justify-center p-10">
      <div className="max-w-sm rounded-xl border border-dashed border-border bg-[color:var(--panel)] p-8 text-center">
        {tab === "spam" ? (
          <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground/70" />
        ) : (
          <Inbox className="mx-auto h-8 w-8 text-muted-foreground/70" />
        )}
        <h3 className="mt-3 text-sm font-semibold text-foreground">
          {tab === "spam" ? "No spam" : "No submissions yet"}
        </h3>
        <p className="mt-2 text-xs text-muted-foreground">
          {tab === "spam"
            ? "Anything you report as spam lands here, out of your main view."
            : "Publish the form and embed it on a page, or use Preview to send a test. Entries appear here as a table."}
        </p>
      </div>
    </div>
  );
}

function Cell({ row, col }: { row: SubmissionRow; col: { key: string; kind: string } }) {
  const text = cellText(row, col.key);
  if (!text) return <span className="text-muted-foreground/50">—</span>;
  return <span title={text}>{text}</span>;
}

function cellText(row: SubmissionRow, key: string): string {
  const v = (row.data as Record<string, unknown>)[key];
  if (v == null || v === "") return "";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function prettify(key: string): string {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function csv(v: string) {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
