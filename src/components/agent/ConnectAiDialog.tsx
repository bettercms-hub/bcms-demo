/**
 * ConnectAiDialog — the one-tap "point your own AI at this project" panel.
 *
 * BetterCMS is AI-first: most people drive it from their own Claude Code,
 * Cursor, or VS Code rather than the in-app agent. This is the surface that
 * hands them the exact install command for their editor, a project-scoped
 * connection key (shown once), and the MCP endpoint — opened from anywhere
 * (top-bar Connect button, ⌘K) so it's always a grab away, never buried in
 * settings.
 */
import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bot, Braces, Check, Copy, ExternalLink, KeySquare, Plug, ShieldCheck, Terminal } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MCP_CLIENTS, TOKEN_PLACEHOLDER, mcpEndpoint } from "@/lib/agent/mcp-clients";
import { DEFAULT_SCOPES, agentGrantActions, useAgentGrants } from "@/lib/agent/connected-store";
import { useGovernance } from "@/lib/agent/governance-store";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  projectName: string;
  wsId: string;
  wsSlug: string;
  projectSlug: string;
}

export function ConnectAiDialog({ open, onOpenChange, projectId, projectName, wsId, wsSlug, projectSlug }: Props) {
  const gov = useGovernance(wsId);
  const grants = useAgentGrants(projectId);
  const [clientId, setClientId] = useState(MCP_CLIENTS[0].id);
  const [token, setToken] = useState<string | null>(null);

  const client = MCP_CLIENTS.find((c) => c.id === clientId) ?? MCP_CLIENTS[0];
  const endpoint = mcpEndpoint(projectId);
  const steps = client.steps({ token: token ?? TOKEN_PLACEHOLDER, projectId });

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    toast.success(`${label} copied`);
  };

  const generate = () => {
    const { token: fresh } = agentGrantActions.create(projectId, client.label);
    setToken(fresh);
    toast.success("Connection key generated", { description: "Shown once. It's now in the commands below." });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="space-y-1 border-b border-[color:var(--border-hairline)] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--s2)] text-foreground">
              <Bot className="h-3.5 w-3.5" />
            </span>
            Connect your AI
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            Point Claude Code, Cursor, or any MCP client at <span className="font-medium text-foreground">{projectName}</span>. It reads and writes drafts through the same guarded operations as the agent here: schema-checked, staging-only, every action audited.
          </DialogDescription>
        </DialogHeader>

        {!gov.externalAgentsAllowed ? (
          <div className="px-5 py-6">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-[13px] font-medium text-foreground">External agents are turned off</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                An admin has disabled outside agents for this workspace. Turn it back on in AI controls to connect.
              </p>
              <Link
                to="/w/$workspace/settings/ai"
                params={{ workspace: wsSlug }}
                onClick={() => onOpenChange(false)}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline"
              >
                Open AI controls <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-h-[calc(86vh-160px)] overflow-y-auto px-5 py-4">
            {/* Editor picker */}
            <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your editor</div>
            <div className="flex flex-wrap gap-1.5">
              {MCP_CLIENTS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  aria-pressed={clientId === c.id}
                  title={c.hint}
                  className={cn(
                    "inline-flex h-8 items-center rounded-md border px-3 text-[12.5px] font-medium transition-colors",
                    clientId === c.id
                      ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                      : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Steps */}
            <div className="mt-4 space-y-3">
              {steps.map((step, i) => (
                <div key={i}>
                  <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                    {step.lang === "json" ? <Braces className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                    {step.label}
                  </div>
                  <CodeBlock code={step.code} onCopy={() => copy(step.code, "Command")} />
                </div>
              ))}
            </div>

            {/* Key generation */}
            <div className="mt-4 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1,var(--card))] px-3.5 py-3">
              {token ? (
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground">Key added to the commands above</p>
                    <p className="text-[11px] text-muted-foreground">Shown once for safety. Generate a new one anytime.</p>
                  </div>
                  <button
                    type="button"
                    onClick={generate}
                    className="shrink-0 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Regenerate
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[12.5px] font-medium text-foreground">Generate a connection key</p>
                    <p className="text-[11px] text-muted-foreground">Project-scoped, shown once, revoke anytime.</p>
                  </div>
                  <button
                    type="button"
                    onClick={generate}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
                  >
                    <KeySquare className="h-3.5 w-3.5" /> Generate key
                  </button>
                </div>
              )}
            </div>

            {/* Endpoint + scopes */}
            <div className="mt-3">
              <div className="mb-1 text-[11px] font-medium text-muted-foreground">MCP endpoint</div>
              <CodeBlock code={endpoint} onCopy={() => copy(endpoint, "Endpoint")} />
            </div>
            <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3 w-3 text-emerald-500" />
              {DEFAULT_SCOPES.join(" · ")} · never production publish
            </p>

            {/* Connected list */}
            {grants.length > 0 && (
              <div className="mt-3 border-t border-[color:var(--border-hairline)] pt-3">
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Connected</div>
                {grants.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 py-1">
                    <Plug className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{g.client}</span>
                    <span className="shrink-0 font-mono text-[10.5px] text-muted-foreground">{g.maskedToken}</span>
                    <button
                      type="button"
                      onClick={() => {
                        agentGrantActions.revoke(projectId, g.id);
                        toast.success(`${g.client} access revoked`);
                      }}
                      className="shrink-0 text-[11.5px] font-medium text-destructive transition-opacity hover:opacity-80"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <Link
            to="/w/$workspace/p/$project/settings/agents"
            params={{ workspace: wsSlug, project: projectSlug }}
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Manage keys and scopes <ExternalLink className="h-3 w-3" />
          </Link>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Done
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="group relative rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)]">
      <pre className="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[11.5px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label="Copy"
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
