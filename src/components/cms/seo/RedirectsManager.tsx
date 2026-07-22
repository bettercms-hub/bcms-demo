import { useState } from "react";
import { Download, Plus, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useSeoRedirects, type Redirect } from "@/lib/seo/site-pages";

const CODES = [
  { code: 301, label: "Permanent", hint: "301 · moved for good" },
  { code: 302, label: "Temporary", hint: "302 · found elsewhere" },
  { code: 307, label: "Temp (strict)", hint: "307 · keeps method" },
  { code: 308, label: "Perm (strict)", hint: "308 · keeps method" },
];

function isPermanent(code: number) {
  return code === 301 || code === 308;
}

/**
 * The redirects panel — add form, code picker, table, and CSV import/export.
 * Shared by SEO › Redirects and Settings › Redirects so both are identical and
 * read/write the same store (`useSeoRedirects`).
 */
export function RedirectsManager({
  projectId,
  projectSlug,
  title = "Redirects",
  description = "Keep inbound links and SEO equity when URLs change. Bulk import/export supported.",
}: {
  projectId: string;
  projectSlug: string;
  title?: string;
  description?: string;
}) {
  const [rows, setRows] = useSeoRedirects(projectId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [code, setCode] = useState(301);
  const [importOpen, setImportOpen] = useState(false);

  function add(r: Omit<Redirect, "id">) {
    setRows((cur) => [{ id: `rd_${Date.now().toString(36)}_${cur.length}`, ...r }, ...cur]);
  }
  function remove(id: string) {
    setRows((cur) => cur.filter((r) => r.id !== id));
  }

  const submit = () => {
    if (!from.trim() || !to.trim()) return;
    add({ from: from.trim(), to: to.trim(), code });
    setFrom("");
    setTo("");
    toast.success("Redirect added");
  };

  function exportCsv() {
    const lines = ["source,destination,code", ...rows.map((r) => `${r.from},${r.to},${r.code}`)];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${projectSlug}-redirects.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} redirects`);
  }

  function importCsv(text: string) {
    const parsed = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => l.split(",").map((c) => c.trim()))
      .filter(([a]) => a && a.toLowerCase() !== "source" && a.startsWith("/"));
    if (parsed.length === 0) {
      toast.error("No valid rows found");
      return;
    }
    const added: Redirect[] = parsed
      .filter(([src, dest]) => src && dest)
      .map(([src, dest, c], i) => ({ id: `rd_${Date.now().toString(36)}_${i}`, from: src, to: dest, code: Number(c) || 301 }));
    setRows((cur) => [...added, ...cur]);
    setImportOpen(false);
    toast.success(`Imported ${added.length} redirects`);
  }

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={rows.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] border border-[color:var(--color-border)] bg-[color:var(--card)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)] disabled:opacity-50"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </button>
        </div>
      </header>

      {/* add form */}
      <div className="mb-5 rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            placeholder="/old-path"
            className="h-9 min-w-[160px] flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 font-mono text-[12.5px] outline-none focus:border-primary"
          />
          <span className="text-muted-foreground">→</span>
          <input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="/new-path"
            className="h-9 min-w-[160px] flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] px-2.5 font-mono text-[12.5px] outline-none focus:border-primary"
          />
          <button
            type="button"
            onClick={submit}
            disabled={!from || !to}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" />
            Add
          </button>
        </div>
        <div className="mt-2.5">
          <CodePicker value={code} onChange={setCode} />
        </div>
      </div>

      {/* table */}
      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
        <div className="grid grid-cols-[1fr_1fr_120px_44px] gap-3 border-b border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <div>From</div>
          <div>To</div>
          <div>Type</div>
          <div />
        </div>
        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-[13px] text-muted-foreground">
            No redirects yet. Add one above or import a CSV.
          </div>
        ) : (
          rows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-[1fr_1fr_120px_44px] items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5 last:border-b-0 hover:bg-[color:var(--color-row-hover)]"
            >
              <div className="truncate font-mono text-[12px] text-foreground">{r.from}</div>
              <div className="truncate font-mono text-[12px] text-muted-foreground">{r.to}</div>
              <div>
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    isPermanent(r.code)
                      ? "bg-status-success/12 text-status-success"
                      : "bg-status-warning/12 text-status-warning"
                  }`}
                >
                  {r.code} · {isPermanent(r.code) ? "Perm" : "Temp"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => remove(r.id)}
                aria-label="Delete redirect"
                className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
      {rows.length > 0 && <p className="mt-3 text-[12px] text-muted-foreground">{rows.length} redirects</p>}

      {importOpen && <ImportModal onClose={() => setImportOpen(false)} onImport={importCsv} />}
    </>
  );
}

function CodePicker({ value, onChange }: { value: number; onChange: (c: number) => void }) {
  return (
    <div className="inline-flex flex-wrap gap-1.5">
      {CODES.map((c) => {
        const active = value === c.code;
        return (
          <button
            key={c.code}
            type="button"
            onClick={() => onChange(c.code)}
            title={c.hint}
            className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-left transition-colors ${
              active
                ? "border-primary bg-primary/10"
                : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]"
            }`}
          >
            <span className={`font-mono text-[13px] font-bold ${active ? "text-foreground" : "text-muted-foreground"}`}>
              {c.code}
            </span>
            <span className={`text-[10.5px] ${active ? "text-foreground/80" : "text-muted-foreground"}`}>{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ImportModal({ onClose, onImport }: { onClose: () => void; onImport: (text: string) => void }) {
  const [text, setText] = useState("");
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/45 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-[color:var(--color-border)] bg-[color:var(--elevated-modal)] p-5 shadow-[var(--shadow-3)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-1 text-[15px] font-semibold text-foreground">Import redirects</h3>
        <p className="mb-3 text-[12.5px] text-muted-foreground">
          One per line as <code className="font-mono">source,destination,code</code>. A header row is optional.
        </p>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"/old,/new,301\n/legacy/*,/,302"}
          className="w-full resize-none rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1)] p-2.5 font-mono text-[12px] text-foreground outline-none focus:border-primary"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center rounded-[6px] px-3.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onImport(text)}
            disabled={!text.trim()}
            className="inline-flex h-9 items-center gap-1.5 rounded-[6px] bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:opacity-60"
          >
            <Upload className="h-3.5 w-3.5" /> Import
          </button>
        </div>
      </div>
    </div>
  );
}
