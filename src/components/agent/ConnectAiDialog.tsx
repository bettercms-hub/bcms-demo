/**
 * ConnectAiDialog — connect an external AI (Claude Code, Cursor, any MCP
 * client) to this project, the consent-screen way.
 *
 * Three steps, mirroring the OAuth-style flow the market converged on:
 * 1. Tool — pick the client.
 * 2. Access — choose exactly what the agent may touch (read is the locked
 *    baseline, publishing is never grantable) and the scope (this project
 *    or the whole workspace, never across workspaces).
 * 3. Authorize — review the grant, generate the key (shown once), and
 *    explicitly authorize. The connection stays pending until a person
 *    approves it; grant, authorize and revoke are all audited.
 */
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, Bot, Braces, Check, Copy, ExternalLink, FolderOpen, KeySquare, Layers, Lock, Plug, ShieldCheck, Terminal } from "lucide-react";
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
import {
  ACCESS_OPTIONS,
  accessLabel,
  agentGrantActions,
  grantReach,
  useAgentGrants,
  type AccessKey,
  type AgentGrant,
  type GrantScopeKind,
} from "@/lib/agent/connected-store";
import { useGovernance } from "@/lib/agent/governance-store";
import { useCMS } from "@/lib/cms/store";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  projectName: string;
  wsId: string;
  wsSlug: string;
  projectSlug: string;
}

type Step = 1 | 2 | 3;

export function ConnectAiDialog({ open, onOpenChange, projectId, projectName, wsId, wsSlug, projectSlug }: Props) {
  const gov = useGovernance(wsId);
  const grants = useAgentGrants(projectId);
  // Projects in this workspace, and every workspace, for the scope pickers.
  // Select stable state refs, then shape in a memo — mapping inside the
  // selector makes fresh objects each render and defeats useCMS's cache.
  const wsProjectsRaw = useCMS((s) => s.projects.filter((p) => p.workspaceId === wsId));
  const workspacesRaw = useCMS((s) => s.workspaces);
  const wsProjects = useMemo(() => wsProjectsRaw.map((p) => ({ id: p.id, name: p.name })), [wsProjectsRaw]);
  const allWorkspaces = useMemo(() => workspacesRaw.map((w) => ({ id: w.id, name: w.name })), [workspacesRaw]);
  const [step, setStep] = useState<Step>(1);
  const [clientId, setClientId] = useState(MCP_CLIENTS[0].id);
  const [access, setAccess] = useState<AccessKey[]>(ACCESS_OPTIONS.filter((o) => o.suggested).map((o) => o.key));
  const [scopeKind, setScopeKind] = useState<GrantScopeKind>("projects");
  const [projectIds, setProjectIds] = useState<string[]>([projectId]);
  const [workspaceIds, setWorkspaceIds] = useState<string[]>([wsId]);
  const [token, setToken] = useState<string | null>(null);
  const [grantId, setGrantId] = useState<string | null>(null);

  const client = MCP_CLIENTS.find((c) => c.id === clientId) ?? MCP_CLIENTS[0];
  const endpoint = mcpEndpoint(projectId);
  const steps = client.steps({ token: token ?? TOKEN_PLACEHOLDER, projectId });
  const pendingGrant = grantId ? grants.find((g) => g.id === grantId) : undefined;
  const authorized = pendingGrant?.status === "active";
  // Whether the current scope choice is actually complete enough to continue.
  const scopeReady = scopeKind === "workspace" || (scopeKind === "projects" ? projectIds.length > 0 : workspaceIds.length > 0);

  const wsName = allWorkspaces.find((w) => w.id === wsId)?.name ?? "this workspace";
  const scopeSummary = useMemo(() => {
    if (scopeKind === "workspace") return `All of ${wsName}`;
    if (scopeKind === "workspaces") {
      if (workspaceIds.length === 1) return `All of ${allWorkspaces.find((w) => w.id === workspaceIds[0])?.name ?? wsName}`;
      return `${workspaceIds.length} workspaces`;
    }
    if (projectIds.length === 1) return `Only ${wsProjects.find((p) => p.id === projectIds[0])?.name ?? projectName}`;
    return `${projectIds.length} projects`;
  }, [scopeKind, projectIds, workspaceIds, wsProjects, allWorkspaces, wsName, projectName]);

  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value).catch(() => {});
    toast.success(`${label} copied`);
  };

  const toggleAccess = (k: AccessKey) => {
    if (ACCESS_OPTIONS.find((o) => o.key === k)?.locked) return;
    setAccess((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));
  };

  const generate = () => {
    const { grant, token: fresh } = agentGrantActions.create(projectId, client.label, {
      access,
      scopeKind,
      homeWorkspaceId: wsId,
      projectIds: scopeKind === "projects" ? projectIds : undefined,
      workspaceIds: scopeKind === "workspaces" ? workspaceIds : undefined,
    });
    setToken(fresh);
    setGrantId(grant.id);
    toast.success("Connection key generated", { description: "Shown once. Authorize below to activate it." });
  };

  const authorize = () => {
    if (!grantId) return;
    agentGrantActions.authorize(projectId, grantId);
    toast.success(`${client.label} connected`, { description: "It now appears with your agents. Revoke anytime." });
  };

  const reset = (o: boolean) => {
    onOpenChange(o);
    if (!o) {
      setStep(1);
      setToken(null);
      setGrantId(null);
      setScopeKind("projects");
      setProjectIds([projectId]);
      setWorkspaceIds([wsId]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="max-h-[86vh] gap-0 overflow-hidden p-0 sm:max-w-[560px]">
        <DialogHeader className="space-y-1 border-b border-[color:var(--border-hairline)] px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-[color:var(--s2)] text-foreground">
              <Bot className="h-3.5 w-3.5" />
            </span>
            Connect your AI
            <span className="ml-auto flex items-center gap-1">
              {[1, 2, 3].map((n) => (
                <span key={n} className={cn("h-1.5 rounded-full transition-all", step === n ? "w-5 bg-primary" : "w-1.5 bg-[color:var(--s3)]")} />
              ))}
            </span>
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-relaxed">
            {step === 1 && (
              <>Point Claude Code, Cursor, or any MCP client at <span className="font-medium text-foreground">{projectName}</span>. You choose exactly what it can touch before anything connects.</>
            )}
            {step === 2 && <>Grant only what this agent needs. It connects like a guest: no seat, no billing, and it can never publish.</>}
            {step === 3 && <>Review the grant, install, and authorize. Nothing serves until you approve it.</>}
          </DialogDescription>
        </DialogHeader>

        {!gov.externalAgentsAllowed ? (
          <div className="px-5 py-6">
            <div className="rounded-lg border border-[color:color-mix(in_srgb,var(--status-warning)_30%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning)_10%,transparent)] px-4 py-3">
              <p className="text-[13px] font-medium text-foreground">External agents are turned off</p>
              <p className="mt-1 text-[12px] text-muted-foreground">An admin has disabled outside agents for this workspace. Turn it back on in AI controls to connect.</p>
              <Link to="/w/$workspace/settings/ai" params={{ workspace: wsSlug }} onClick={() => reset(false)} className="mt-2 inline-flex items-center gap-1 text-[12.5px] font-medium text-primary hover:underline">
                Open AI controls <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="max-h-[calc(86vh-160px)] overflow-y-auto px-5 py-4">
            {/* -------------------------------------------------- step 1: tool */}
            {step === 1 && (
              <>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your editor or assistant</div>
                <div className="flex flex-wrap gap-1.5">
                  {MCP_CLIENTS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setClientId(c.id)}
                      aria-pressed={clientId === c.id}
                      title={c.hint}
                      className={cn(
                        "inline-flex h-8 items-center rounded-[6px] border px-3 text-[12.5px] font-medium transition-colors",
                        clientId === c.id
                          ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_8%,transparent)] text-foreground"
                          : "border-[color:var(--color-border)] text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s1,var(--card))] px-3.5 py-3">
                  <p className="flex items-center gap-1.5 text-[12px] font-medium text-foreground">
                    <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--status-live)]" /> How this stays safe
                  </p>
                  <ul className="mt-1.5 space-y-1 text-[11.5px] leading-relaxed text-muted-foreground">
                    <li>You pick the exact permissions on the next step.</li>
                    <li>Writes are drafts and staging only. Publishing is never grantable.</li>
                    <li>The connection is inactive until you authorize it, and every action is audited.</li>
                  </ul>
                </div>

                {grants.length > 0 && (
                  <div className="mt-4 border-t border-[color:var(--border-hairline)] pt-3">
                    <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Connected</div>
                    {grants.map((g) => (
                      <div key={g.id} className="flex items-center gap-2 py-1">
                        <Plug className={cn("h-3.5 w-3.5 shrink-0", g.status === "active" ? "text-[color:var(--status-live)]" : "text-[color:var(--status-warning)]")} />
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{g.client}</span>
                        <span className="shrink-0 rounded-md bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {g.access.length} permissions · {grantScopeChip(g)}
                        </span>
                        {g.status === "pending" ? (
                          <button type="button" onClick={() => agentGrantActions.authorize(projectId, g.id)} className="shrink-0 text-[11.5px] font-semibold text-primary hover:underline">
                            Authorize
                          </button>
                        ) : null}
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
              </>
            )}

            {/* ------------------------------------------------ step 2: access */}
            {step === 2 && (
              <>
                <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">What {client.label} may touch</div>
                <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
                  {ACCESS_OPTIONS.map((o) => {
                    const on = access.includes(o.key);
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => toggleAccess(o.key)}
                        aria-pressed={on}
                        disabled={o.locked}
                        className={cn("flex w-full items-center gap-3 border-b border-[color:var(--border-hairline)] px-3.5 py-2.5 text-left last:border-0", !o.locked && "hover:bg-[color:var(--color-row-hover)]")}
                      >
                        <span className={cn("grid h-4.5 w-4.5 h-[18px] w-[18px] shrink-0 place-items-center rounded border", on ? "border-transparent bg-primary text-white" : "border-[color:var(--border-strong,var(--color-border))]")}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-medium text-foreground">{o.label}</span>
                          <span className="block text-[11.5px] text-muted-foreground">{o.hint}</span>
                        </span>
                        {o.locked && <span className="shrink-0 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">Baseline</span>}
                      </button>
                    );
                  })}
                  {/* the one that is never on the table */}
                  <div className="flex items-center gap-3 bg-[color:var(--s1,var(--card))] px-3.5 py-2.5">
                    <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded border border-[color:var(--color-border)] text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[13px] font-medium text-muted-foreground">Publishing</span>
                      <span className="block text-[11.5px] text-muted-foreground">Never available to agents. Going live always stays with people.</span>
                    </span>
                  </div>
                </div>

                <div className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Where it applies</div>
                <div className="space-y-1.5">
                  {(
                    [
                      { id: "projects", icon: FolderOpen, label: "Specific projects", hint: "The key touches only the projects you tick. Recommended." },
                      { id: "workspace", icon: Layers, label: `Every project in ${wsName}`, hint: "One key for all sites here. New projects are included." },
                      { id: "workspaces", icon: Bot, label: "Multiple workspaces", hint: "For agencies running one agent across client workspaces." },
                    ] as const
                  ).map((s) => {
                    const on = scopeKind === s.id;
                    return (
                      <div key={s.id} className={cn("rounded-lg border transition-colors", on ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)]" : "border-[color:var(--color-border)]")}>
                        <button type="button" onClick={() => setScopeKind(s.id)} aria-pressed={on} className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left">
                          <span className={cn("mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border-[5px]", on ? "border-primary" : "border-[color:var(--s3)]")} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5 text-[13px] font-medium text-foreground"><s.icon className="h-3.5 w-3.5 text-muted-foreground" />{s.label}</span>
                            <span className="block text-[11.5px] text-muted-foreground">{s.hint}</span>
                          </span>
                        </button>

                        {/* project checklist */}
                        {on && s.id === "projects" && (
                          <div className="border-t border-[color:var(--border-hairline)] px-3.5 py-2">
                            <div className="max-h-[148px] space-y-0.5 overflow-y-auto">
                              {wsProjects.map((p) => {
                                const checked = projectIds.includes(p.id);
                                return (
                                  <label key={p.id} className="flex cursor-pointer items-center gap-2.5 rounded-md px-1 py-1 hover:bg-[color:var(--color-row-hover)]">
                                    <span className={cn("grid h-[16px] w-[16px] shrink-0 place-items-center rounded border", checked ? "border-transparent bg-primary text-white" : "border-[color:var(--border-strong,var(--color-border))]")}>{checked && <Check className="h-2.5 w-2.5" />}</span>
                                    <input type="checkbox" className="sr-only" checked={checked} onChange={() => setProjectIds((a) => (a.includes(p.id) ? a.filter((x) => x !== p.id) : [...a, p.id]))} />
                                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{p.name}</span>
                                    {p.id === projectId && <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">This one</span>}
                                  </label>
                                );
                              })}
                            </div>
                            {projectIds.length === 0 && <p className="mt-1 text-[11px] text-[color:var(--status-warning)]">Tick at least one project.</p>}
                          </div>
                        )}

                        {/* workspace checklist */}
                        {on && s.id === "workspaces" && (
                          <div className="border-t border-[color:var(--border-hairline)] px-3.5 py-2">
                            <div className="max-h-[148px] space-y-0.5 overflow-y-auto">
                              {allWorkspaces.map((w) => {
                                const checked = workspaceIds.includes(w.id);
                                const isHome = w.id === wsId;
                                return (
                                  <label key={w.id} className={cn("flex items-center gap-2.5 rounded-md px-1 py-1", isHome ? "opacity-70" : "cursor-pointer hover:bg-[color:var(--color-row-hover)]")}>
                                    <span className={cn("grid h-[16px] w-[16px] shrink-0 place-items-center rounded border", checked ? "border-transparent bg-primary text-white" : "border-[color:var(--border-strong,var(--color-border))]")}>{checked && <Check className="h-2.5 w-2.5" />}</span>
                                    <input type="checkbox" className="sr-only" checked={checked} disabled={isHome} onChange={() => setWorkspaceIds((a) => (a.includes(w.id) ? a.filter((x) => x !== w.id) : [...a, w.id]))} />
                                    <span className="min-w-0 flex-1 truncate text-[12.5px] text-foreground">{w.name}</span>
                                    {isHome && <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Home</span>}
                                  </label>
                                );
                              })}
                            </div>
                            <p className="mt-1.5 flex items-start gap-1.5 text-[11px] text-[color:var(--status-warning)]">
                              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                              A cross-workspace key is the widest reach. You must be an admin on each, and one revoke pulls it from all of them.
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* --------------------------------------------- step 3: authorize */}
            {step === 3 && (
              <>
                {/* grant summary */}
                <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1,var(--card))] px-3.5 py-3">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-md bg-[color:var(--s2)] px-2 py-0.5 text-[11px] font-semibold text-foreground">{client.label}</span>
                    {access.map((k) => (
                      <span key={k} className="rounded-md border border-[color:var(--color-border)] px-1.5 py-0.5 text-[10.5px] font-medium text-muted-foreground">{accessLabel(k)}</span>
                    ))}
                    <span className="rounded-md border border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] px-1.5 py-0.5 text-[10.5px] font-medium text-foreground">{scopeSummary}</span>
                  </div>
                </div>

                {/* key */}
                <div className="mt-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s1,var(--card))] px-3.5 py-3">
                  {token ? (
                    <div className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-[color:var(--status-live)]" />
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-foreground">Key added to the commands below</p>
                        <p className="text-[11px] text-muted-foreground">Shown once for safety. Regenerating replaces it.</p>
                      </div>
                      <button type="button" onClick={generate} className="shrink-0 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
                        Regenerate
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-foreground">Generate the connection key</p>
                        <p className="text-[11px] text-muted-foreground">Carries exactly the permissions you chose. Shown once.</p>
                      </div>
                      <button type="button" onClick={generate} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]">
                        <KeySquare className="h-3.5 w-3.5" /> Generate key
                      </button>
                    </div>
                  )}
                </div>

                {/* install steps */}
                <div className="mt-4 space-y-3">
                  {steps.map((s, i) => (
                    <div key={i}>
                      <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-muted-foreground">
                        {s.lang === "json" ? <Braces className="h-3 w-3" /> : <Terminal className="h-3 w-3" />}
                        {s.label}
                      </div>
                      <CodeBlock code={s.code} onCopy={() => copy(s.code, "Command")} />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  <div className="mb-1 text-[11px] font-medium text-muted-foreground">MCP endpoint</div>
                  <CodeBlock code={endpoint} onCopy={() => copy(endpoint, "Endpoint")} />
                </div>

                {/* the human moment */}
                <div className={cn("mt-4 rounded-lg border px-3.5 py-3", authorized ? "border-[color:color-mix(in_srgb,var(--status-live)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--status-live)_10%,transparent)]" : "border-[color:color-mix(in_srgb,var(--status-warning)_35%,transparent)] bg-[color:color-mix(in_srgb,var(--status-warning)_10%,transparent)]")}>
                  {authorized ? (
                    <p className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                      <Check className="h-4 w-4 text-[color:var(--status-live)]" /> Authorized. {client.label} is connected and shows with your agents.
                    </p>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[12.5px] font-medium text-foreground">Waiting for your authorization</p>
                        <p className="text-[11px] text-muted-foreground">The key stays inactive until you approve this connection.</p>
                      </div>
                      <button type="button" onClick={authorize} disabled={!grantId} className={cn("inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-[12.5px] font-semibold transition-colors", grantId ? "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]" : "bg-[color:var(--s2)] text-muted-foreground")}>
                        <ShieldCheck className="h-3.5 w-3.5" /> Authorize connection
                      </button>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          {step === 1 ? (
            <Link to="/w/$workspace/p/$project/settings/agents" params={{ workspace: wsSlug, project: projectSlug }} onClick={() => reset(false)} className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              Manage keys and access <ExternalLink className="h-3 w-3" />
            </Link>
          ) : (
            <button type="button" onClick={() => setStep((s) => (s === 3 ? 2 : 1) as Step)} className="inline-flex items-center gap-1 text-[12px] font-medium text-muted-foreground transition-colors hover:text-foreground">
              <ArrowLeft className="h-3 w-3" /> Back
            </button>
          )}
          {gov.externalAgentsAllowed && step < 3 ? (
            <button type="button" disabled={step === 2 && !scopeReady} onClick={() => setStep((s) => (s === 1 ? 2 : 3) as Step)} className={cn("inline-flex h-8 items-center rounded-[6px] px-3.5 text-[12.5px] font-semibold transition-colors", step === 2 && !scopeReady ? "bg-[color:var(--s2)] text-muted-foreground" : "bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]")}>
              {step === 1 ? "Choose access" : `Continue with ${access.length} permissions`}
            </button>
          ) : (
            <button type="button" onClick={() => reset(false)} className="inline-flex h-8 items-center rounded-[6px] border border-[color:var(--color-border)] bg-card px-3.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-[color:var(--border-strong)] hover:bg-[color:var(--color-row-hover)]">
              Done
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Compact scope label for the Connected list. */
function grantScopeChip(g: AgentGrant): string {
  const { kind, count } = grantReach(g);
  if (kind === "workspace") return "whole workspace";
  if (kind === "workspaces") return count === 1 ? "1 workspace" : `${count} workspaces`;
  return count === 1 ? "this project" : `${count} projects`;
}

function CodeBlock({ code, onCopy }: { code: string; onCopy: () => void }) {
  return (
    <div className="group relative rounded-lg border border-[color:var(--color-border)] bg-[color:var(--s2)]">
      <pre className="overflow-x-auto px-3 py-2.5 pr-10 font-mono text-[11.5px] leading-relaxed text-foreground">
        <code>{code}</code>
      </pre>
      <button type="button" onClick={onCopy} aria-label="Copy" className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--card)] hover:text-foreground">
        <Copy className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
