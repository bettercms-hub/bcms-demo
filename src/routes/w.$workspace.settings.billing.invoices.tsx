import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Download, FileText, Mail, Search } from "lucide-react";
import { useCMS } from "@/lib/cms/store";
import { InvoiceStatusBadge } from "@/components/cms/ui/StatusBadge";
import { computeWorkspaceBill, fmtUSD } from "@/lib/billing/pricing";
import type { Invoice, Member, Project, Workspace } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/settings/billing/invoices")({
  component: InvoicesTab,
});

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

const FILTERS = [
  { key: "all", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "open", label: "Open" },
  { key: "failed", label: "Failed" },
  { key: "void", label: "Refunded" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

/** Trigger a real browser download of a small text file. */
function downloadTextFile(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Demo invoice body: the workspace, its current bill lines and the billed amount. */
function invoiceText(inv: Invoice, ws: Workspace, wsProjects: Project[], wsMembers: Member[]): string {
  const bill = computeWorkspaceBill(ws, wsProjects, wsMembers);
  const lines = bill.lines.map((l) => {
    const amount = l.amount == null ? "Custom" : `${fmtUSD(l.amount)}/mo`;
    return `  ${l.label}${l.detail ? ` (${l.detail})` : ""}  ${amount}`;
  });
  const monthly = bill.monthlyTotal == null ? "Custom" : `${fmtUSD(bill.monthlyTotal)}/mo`;
  return [
    `BetterCMS · Invoice ${inv.number}`,
    "",
    `Workspace: ${ws.name}`,
    `Period: ${fmtDate(inv.periodStart)} to ${fmtDate(inv.periodEnd)}`,
    `Issued: ${fmtDate(inv.issuedAt)}`,
    `Status: ${inv.status}`,
    "",
    "Plan lines (from the current configuration):",
    ...lines,
    "",
    `Monthly total: ${monthly}`,
    `Amount billed for this period: ${fmtUSD(inv.amount)} ${inv.currency}`,
    "",
    "Demo invoice, generated for preview. No real charge behind it.",
  ].join("\n");
}

function InvoicesTab() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const wsProjects = useCMS((s) => (ws ? s.projects.filter((p) => ws.projectIds.includes(p.id)) : []));
  const wsMembers = useCMS((s) => (ws ? s.members.filter((m) => ws.memberIds.includes(m.id)) : []));
  const invoices = useCMS((s) =>
    ws
      ? s.invoices
          .filter((i) => i.workspaceId === ws.id)
          .slice()
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
      : [],
  );

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (filter !== "all" && i.status !== filter) return false;
      if (query && !i.number.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [invoices, query, filter]);

  if (!ws) {
    return (
      <div className="rounded-md border border-border bg-card p-6 text-[13px] text-muted-foreground">
        Workspace not found.
      </div>
    );
  }

  // Managed workspaces with zero invoices (Atlas): billing runs through procurement.
  if (invoices.length === 0 && ws.billing?.managed) {
    return <ProcurementEmptyState ws={ws} />;
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-14 text-center shadow-[var(--shadow-card)]">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <h3 className="mt-4 text-[15px] font-semibold text-foreground">No invoices yet</h3>
        <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
          This workspace is on the free plan, so there is nothing to bill.
        </p>
      </div>
    );
  }

  function exportCsv() {
    const header = "number,period_start,period_end,amount,currency,status";
    const rows = filtered.map((i) => [i.number, i.periodStart, i.periodEnd, i.amount, i.currency, i.status].join(","));
    downloadTextFile(`${ws!.slug}-invoices.csv`, [header, ...rows].join("\n"));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[260px] max-w-md">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by invoice number"
            className="h-9 pl-8 text-[13px]"
          />
        </div>
        <div className="inline-flex rounded-lg border border-border bg-card p-0.5 text-[12px] font-medium shadow-[var(--shadow-card)]">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                filter === f.key ? "bg-[color:var(--row-selected)] text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" className="h-9 text-[13px]" onClick={exportCsv}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-14 text-center shadow-[var(--shadow-card)]">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary">
            <FileText className="h-5 w-5" />
          </div>
          <h3 className="mt-4 text-[15px] font-semibold text-foreground">No invoices match</h3>
          <p className="mt-1 max-w-sm text-[13px] text-muted-foreground">
            Try a different filter or clear your search.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border bg-[color:var(--surface)] text-left">
                  <th className="h-10 px-5 text-[12.5px] font-medium text-muted-foreground">Invoice</th>
                  <th className="h-10 px-5 text-[12.5px] font-medium text-muted-foreground">Period</th>
                  <th className="h-10 px-5 text-[12.5px] font-medium text-muted-foreground">Amount</th>
                  <th className="h-10 px-5 text-[12.5px] font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-[color:var(--row-hover)]">
                    <td className="px-5 py-3.5 font-mono text-[12px]">{r.number}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">
                      {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}
                    </td>
                    <td className="px-5 py-3.5 font-medium tabular-nums">{fmtUSD(r.amount)}</td>
                    <td className="px-5 py-3.5"><InvoiceStatusBadge status={r.status} /></td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        title={`Download ${r.number}`}
                        onClick={() => downloadTextFile(`${r.number}.txt`, invoiceText(r, ws, wsProjects, wsMembers))}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function ProcurementEmptyState({ ws }: { ws: Workspace }) {
  const managed = ws.billing?.managed;
  const firstName = managed?.contactName?.split(" ")[0] ?? "Your account manager";
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-14 text-center shadow-[var(--shadow-card)]">
      <div className="grid h-12 w-12 place-items-center rounded-xl bg-[color:color-mix(in_oklab,var(--primary)_12%,transparent)] text-primary">
        <FileText className="h-5 w-5" />
      </div>
      <h3 className="mt-4 text-[15px] font-semibold text-foreground">Invoices run through your procurement process</h3>
      <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
        {managed?.contactName ?? "Your account manager"} sends them against your PO. Nothing shows here.
      </p>
      {managed?.contactEmail && (
        <Button variant="outline" size="sm" className="mt-5 h-9 text-[13px]" asChild>
          <a href={`mailto:${managed.contactEmail}`}>
            <Mail className="mr-1.5 h-3.5 w-3.5" />
            Contact {firstName}
          </a>
        </Button>
      )}
    </div>
  );
}
