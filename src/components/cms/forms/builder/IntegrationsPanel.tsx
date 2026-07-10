import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Webhook, Mail, Slack, Sheet, Plus, Trash2, Zap, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  listIntegrations,
  createIntegration,
  updateIntegration,
  deleteIntegration,
  type IntegrationKind,
  type IntegrationRow,
} from "@/lib/forms/forms.store";
import type { FormDetail } from "@/lib/forms/types";

const CATALOG: {
  kind: IntegrationKind;
  label: string;
  description: string;
  icon: typeof Webhook;
  iconClass?: string;
}[] = [
  {
    kind: "sheets",
    label: "Google Sheets",
    description: "Sync every submission into a spreadsheet.",
    icon: Sheet,
    iconClass: "text-emerald-600",
  },
  {
    kind: "webhook",
    label: "Webhook",
    description: "POST the submission JSON to any URL.",
    icon: Webhook,
  },
  {
    kind: "slack",
    label: "Slack",
    description: "Post a message to a Slack channel via incoming webhook.",
    icon: Slack,
  },
  {
    kind: "email",
    label: "Email notification",
    description: "Notify a teammate when a submission arrives.",
    icon: Mail,
  },
];

export function IntegrationsPanel({ form }: { form: FormDetail }) {
  const formId = form.id;
  const qc = useQueryClient();
  const { data: rows = [], isLoading } = useQuery<IntegrationRow[]>({
    queryKey: ["integrations", formId],
    queryFn: () => listIntegrations({ data: { formId } }),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["integrations", formId] });

  const createMut = useMutation({
    mutationFn: (kind: IntegrationKind) => createIntegration({ data: { formId, kind } }),
    onSuccess: () => invalidate(),
  });
  const updMut = useMutation({
    mutationFn: (v: { id: string; patch: { enabled?: boolean; config?: IntegrationRow["config"] } }) =>
      updateIntegration({ data: v }),
    onSuccess: () => invalidate(),
  });
  const delMut = useMutation({
    mutationFn: (id: string) => deleteIntegration({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Removed");
    },
  });

  return (
    <div className="min-h-0 flex-1 overflow-auto bg-[color:var(--canvas)] p-6">
      <div className="mx-auto max-w-3xl">
        <h2 className="text-sm font-semibold text-foreground">Integrations</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Route new submissions to other tools. Triggers run on every submission.
        </p>

        {/* Add */}
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CATALOG.map((c) => (
            <button
              key={c.kind}
              onClick={() => createMut.mutate(c.kind)}
              className="flex flex-col items-start gap-2 rounded-lg border border-border bg-[color:var(--panel)] p-4 text-left transition-colors hover:border-primary/40"
            >
              <div className="flex w-full items-center justify-between">
                <c.icon className={`h-4 w-4 ${c.iconClass ?? "text-muted-foreground"}`} />
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">{c.label}</div>
                <div className="mt-1 text-xs text-muted-foreground">{c.description}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Configured */}
        <div className="mt-8">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Configured
          </h3>
          {isLoading ? (
            <div className="text-xs text-muted-foreground">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-[color:var(--panel)] p-8 text-center">
              <Zap className="mx-auto h-7 w-7 text-muted-foreground/70" />
              <p className="mt-2 text-xs text-muted-foreground">
                No integrations yet. Add one above to start routing submissions.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {rows.map((r) => (
                <IntegrationItem
                  key={r.id}
                  row={r}
                  form={form}
                  onToggle={(enabled) => updMut.mutate({ id: r.id, patch: { enabled } })}
                  onSaveConfig={(config) => updMut.mutate({ id: r.id, patch: { config } })}
                  onDelete={() => delMut.mutate(r.id)}
                />
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function IntegrationItem({
  row,
  form,
  onToggle,
  onSaveConfig,
  onDelete,
}: {
  row: IntegrationRow;
  form: FormDetail;
  onToggle: (enabled: boolean) => void;
  onSaveConfig: (config: IntegrationRow["config"]) => void;
  onDelete: () => void;
}) {
  const meta = CATALOG.find((c) => c.kind === row.kind)!;
  const Icon = meta.icon;
  return (
    <li className="rounded-lg border border-border bg-[color:var(--panel)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded bg-[color:var(--card)] p-2">
            <Icon className={`h-4 w-4 ${meta.iconClass ?? "text-muted-foreground"}`} />
          </div>
          <div>
            <div className="text-sm font-medium text-foreground">{meta.label}</div>
            <div className="text-xs text-muted-foreground">{meta.description}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch checked={row.enabled} onCheckedChange={onToggle} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Remove this integration?")) onDelete();
            }}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-4 border-t border-border/60 pt-3">
        <ConfigForm row={row} form={form} onSave={onSaveConfig} />
      </div>
    </li>
  );
}

function ConfigForm({
  row,
  form,
  onSave,
}: {
  row: IntegrationRow;
  form: FormDetail;
  onSave: (config: IntegrationRow["config"]) => void;
}) {
  if (row.kind === "sheets") {
    return <SheetsConfig row={row} form={form} onSave={onSave} />;
  }
  if (row.kind === "webhook") {
    return (
      <ConfigField
        label="Webhook URL"
        placeholder="https://your-site.com/hooks/forms"
        value={(row.config.url as string) ?? ""}
        onSave={(v) => onSave({ ...row.config, url: v })}
        help="Receives { formId, submissionId, data } as JSON."
      />
    );
  }
  if (row.kind === "slack") {
    return (
      <ConfigField
        label="Slack incoming webhook"
        placeholder="https://hooks.slack.com/services/…"
        value={(row.config.webhook_url as string) ?? ""}
        onSave={(v) => onSave({ ...row.config, webhook_url: v })}
        help="Create one in Slack › Apps › Incoming Webhooks."
      />
    );
  }
  return (
    <ConfigField
      label="Notify email"
      placeholder="you@company.com"
      value={(row.config.to as string) ?? ""}
      onSave={(v) => onSave({ ...row.config, to: v })}
      help="Sending requires connecting an email provider. Coming soon."
    />
  );
}

/* ───────────────────────── Google Sheets ───────────────────────── */

interface SheetsCfg {
  connected?: boolean;
  account?: string;
  spreadsheetId?: string;
  spreadsheetName?: string;
  worksheet?: string;
  lastSyncedAt?: string;
}

const DEMO_SPREADSHEETS = ["Website leads", "Newsletter signups", "Marketing Q3 2026"];

function SheetsConfig({
  row,
  form,
  onSave,
}: {
  row: IntegrationRow;
  form: FormDetail;
  onSave: (config: IntegrationRow["config"]) => void;
}) {
  const cfg = (row.config ?? {}) as SheetsCfg;
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const columns = ["Date", "IP address", ...[...form.fields].sort((a, b) => a.position - b.position).map((f) => f.label)];

  function connect() {
    setConnecting(true);
    window.setTimeout(() => {
      setConnecting(false);
      onSave({ ...cfg, connected: true, account: "you@gmail.com" });
      toast.success("Google account connected");
    }, 900);
  }
  function chooseSheet(name: string, isNew = false) {
    onSave({ ...cfg, spreadsheetName: name, spreadsheetId: "1AbCdEfGh_demoSheetId", worksheet: cfg.worksheet || "Submissions" });
    if (isNew) toast.success(`Created "${name}" in Google Drive`);
  }
  function syncNow() {
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      onSave({ ...cfg, lastSyncedAt: new Date().toISOString() });
      toast.success(`Submissions synced to ${cfg.spreadsheetName}`);
    }, 1000);
  }

  if (!cfg.connected) {
    return (
      <div className="space-y-3">
        <p className="text-[11.5px] leading-relaxed text-muted-foreground">
          Connect a Google account to sync every new submission into a spreadsheet automatically.
        </p>
        <button
          onClick={connect}
          disabled={connecting}
          className="inline-flex h-9 items-center gap-2.5 rounded-md border border-border bg-[color:var(--card)] px-3.5 text-[13px] font-medium text-foreground shadow-sm transition-colors hover:bg-[color:var(--row-hover)] disabled:opacity-70"
        >
          {connecting ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : <GoogleG className="h-4 w-4" />}
          {connecting ? "Connecting…" : "Continue with Google"}
        </button>
      </div>
    );
  }

  const initials = (cfg.account?.[0] ?? "G").toUpperCase();
  const sheetChosen = !!cfg.spreadsheetName;

  return (
    <div className="space-y-4">
      {/* Connected account */}
      <div className="flex items-center justify-between rounded-md border border-border bg-[color:var(--card)] px-3 py-2">
        <div className="flex items-center gap-2.5">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-emerald-500/10 text-[11px] font-semibold text-emerald-600">
            {initials}
          </span>
          <div>
            <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Connected
            </div>
            <div className="text-[11px] text-muted-foreground">{cfg.account}</div>
          </div>
        </div>
        <button
          onClick={() => {
            onSave({ connected: false });
            toast("Google account disconnected");
          }}
          className="text-[11.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Disconnect
        </button>
      </div>

      {/* Spreadsheet */}
      <div className="space-y-1.5">
        <SheetLabel>Spreadsheet</SheetLabel>
        <div className="flex items-center gap-1.5">
          <select
            value={cfg.spreadsheetName ?? ""}
            onChange={(e) => e.target.value && chooseSheet(e.target.value)}
            className="h-9 flex-1 rounded-md border border-border bg-transparent px-2.5 text-[13px] text-foreground outline-none focus:border-primary"
          >
            <option value="">Choose a spreadsheet…</option>
            {DEMO_SPREADSHEETS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            {cfg.spreadsheetName && !DEMO_SPREADSHEETS.includes(cfg.spreadsheetName) && (
              <option value={cfg.spreadsheetName}>{cfg.spreadsheetName}</option>
            )}
          </select>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => chooseSheet(`${form.name} submissions`, true)}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> New sheet
          </Button>
        </div>
      </div>

      {sheetChosen && (
        <>
          {/* Worksheet tab */}
          <div className="space-y-1.5">
            <SheetLabel>Worksheet tab</SheetLabel>
            <Input
              defaultValue={cfg.worksheet ?? "Submissions"}
              onBlur={(e) => onSave({ ...cfg, worksheet: e.target.value.trim() || "Submissions" })}
              className="h-9 text-[13px]"
            />
          </div>

          {/* Column mapping preview */}
          <div className="space-y-1.5">
            <SheetLabel>Columns</SheetLabel>
            <div className="overflow-x-auto rounded-md border border-[color:var(--border-hairline)]">
              <table className="w-full border-collapse text-[11px]">
                <thead>
                  <tr className="bg-[color:var(--surface-3)] text-muted-foreground">
                    <th className="w-8 border-r border-[color:var(--border-hairline)] px-2 py-1.5 text-left font-medium">A</th>
                    {columns.map((c, i) => (
                      <th
                        key={c + i}
                        className="whitespace-nowrap border-r border-[color:var(--border-hairline)] px-2.5 py-1.5 text-left font-medium last:border-r-0"
                      >
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr className="text-muted-foreground/50">
                    <td className="border-r border-[color:var(--border-hairline)] px-2 py-1.5">1</td>
                    {columns.map((c, i) => (
                      <td key={c + i} className="border-r border-[color:var(--border-hairline)] px-2.5 py-1.5 last:border-r-0">
                        —
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Each field maps to a column. New fields are added automatically.
            </p>
          </div>

          {/* Sync status */}
          <div className="flex items-center justify-between rounded-md bg-[color:var(--surface-3)]/50 px-3 py-2">
            <div className="text-[11.5px] text-muted-foreground">
              {cfg.lastSyncedAt ? (
                <>
                  <span className="text-foreground">Last synced</span> {timeAgo(cfg.lastSyncedAt)} · new rows sync live
                </>
              ) : (
                "New submissions will sync automatically."
              )}
            </div>
            <Button variant="outline" size="sm" className="h-8" onClick={syncNow} disabled={syncing}>
              {syncing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              {syncing ? "Syncing…" : "Sync now"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function SheetLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</label>
  );
}

function GoogleG({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}

function ConfigField({
  label,
  placeholder,
  value,
  onSave,
  help,
}: {
  label: string;
  placeholder: string;
  value: string;
  onSave: (v: string) => void;
  help?: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <Input
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== value) onSave(v);
        }}
        className="mt-1 h-8 text-xs"
      />
      {help ? <p className="mt-1 text-[11px] text-muted-foreground">{help}</p> : null}
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
