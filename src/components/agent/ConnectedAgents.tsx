/**
 * ConnectedAgents — drive this project from outside tools.
 *
 * One setup command installs the bridge and a skill into Claude Code,
 * Cursor, VS Code, or any MCP client; keys are project scoped, write to
 * staging only, and revoke in one click. Same operations, same audit
 * trail, same trust model as the in-app agent.
 */
import { useState } from "react";
import { Check, Copy, KeySquare, Plug, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_SCOPES,
  EXTERNAL_CLIENTS,
  agentGrantActions,
  useAgentGrants,
} from "@/lib/agent/connected-store";

interface Props {
  projectId: string;
}

export function ConnectedAgents({ projectId }: Props) {
  const grants = useAgentGrants(projectId);
  const [client, setClient] = useState<string>(EXTERNAL_CLIENTS[0].id);
  const [freshToken, setFreshToken] = useState<string | null>(null);

  const setupCommand = "npx bettercms agent setup";
  const mcpEndpoint = `https://mcp.bettercms.site/v1/projects/${projectId}`;

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    toast.success(`${label} copied`);
  };

  const generate = () => {
    const clientLabel = EXTERNAL_CLIENTS.find((c) => c.id === client)?.label ?? client;
    const { token } = agentGrantActions.create(projectId, clientLabel);
    setFreshToken(token);
  };

  return (
    <div className="mt-8">
      <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        External agents
      </p>
      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
        {/* intro + setup */}
        <div className="border-b border-[color:var(--border-hairline)] px-4 py-3.5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
              <Plug className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">
                Drive this project from Claude Code, Cursor, VS Code, or any MCP client
              </p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Outside agents use the same operations as the agent here: schema validated, drafts to staging, every
                action audited. Keys are scoped to this project and revoke in one click.
              </p>
            </div>
          </div>

          <div className="mt-3 space-y-1.5">
            <CommandRow label="Set up the bridge and skill" value={setupCommand} onCopy={() => copy(setupCommand, "Command")} />
            <CommandRow label="MCP endpoint" value={mcpEndpoint} onCopy={() => copy(mcpEndpoint, "Endpoint")} />
          </div>
        </div>

        {/* key generation */}
        <div className="border-b border-[color:var(--border-hairline)] px-4 py-3.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-medium text-foreground">Agent key for</span>
            {EXTERNAL_CLIENTS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setClient(c.id)}
                aria-pressed={client === c.id}
                title={c.hint}
                className={cn(
                  "inline-flex h-7 items-center rounded-md border px-2.5 text-[12px] font-medium transition-colors",
                  client === c.id
                    ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] text-primary"
                    : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
                )}
              >
                {c.label}
              </button>
            ))}
            <button
              type="button"
              onClick={generate}
              className="ml-auto inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2.5 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <KeySquare className="h-3.5 w-3.5" /> Generate key
            </button>
          </div>

          {freshToken && (
            <div className="mt-3 rounded-lg border border-[color:color-mix(in_oklab,var(--primary)_35%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">{freshToken}</code>
                <button
                  type="button"
                  onClick={() => copy(freshToken, "Key")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                  aria-label="Copy key"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFreshToken(null)}
                  className="inline-flex h-7 items-center rounded-md px-2 text-[11.5px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Done
                </button>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Store it now. For safety it will not be shown again.
              </p>
            </div>
          )}

          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3 w-3 text-emerald-500" />
            {DEFAULT_SCOPES.join(" · ")} · never production publish
          </p>
        </div>

        {/* grants */}
        {grants.length > 0 ? (
          grants.map((g) => (
            <div key={g.id} className="flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-2.5 last:border-b-0">
              <Check className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] font-medium text-foreground">{g.client}</span>
                <span className="block font-mono text-[10.5px] text-muted-foreground">{g.maskedToken}</span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">connected {timeAgo(g.createdAt)}</span>
              <button
                type="button"
                onClick={() => {
                  agentGrantActions.revoke(projectId, g.id);
                  toast.success(`${g.client} access revoked`);
                }}
                className="shrink-0 text-[12px] font-medium text-destructive transition-opacity hover:opacity-80"
              >
                Revoke
              </button>
            </div>
          ))
        ) : (
          <p className="px-4 py-3 text-[11.5px] text-muted-foreground">No connected agents yet.</p>
        )}
      </div>
    </div>
  );
}

function CommandRow({ label, value, onCopy }: { label: string; value: string; onCopy: () => void }) {
  return (
    <div className="flex items-center gap-2 rounded-lg bg-[color:var(--s2)] px-2.5 py-1.5">
      <span className="w-[168px] shrink-0 text-[11px] text-muted-foreground">{label}</span>
      <code className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-foreground">{value}</code>
      <button
        type="button"
        onClick={onCopy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="grid h-6 w-6 shrink-0 place-items-center rounded text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground"
      >
        <Copy className="h-3 w-3" />
      </button>
    </div>
  );
}

function timeAgo(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
