import { Link, createFileRoute } from "@tanstack/react-router";
import { ArrowRight, Bot, Check, Copy, Plug, Terminal } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, SettingsSection } from "@/components/cms/SettingsSubNav";
import { EXTERNAL_CLIENTS, getAgentGrants, useGrantsVersion } from "@/lib/agent/connected-store";
import { useGovernance } from "@/lib/agent/governance-store";
import { useCMS } from "@/lib/cms/store";
import { Switch } from "@/components/ui/switch";
import { governanceActions } from "@/lib/agent/governance-store";
import { canSeeDeveloper, myRole } from "@/lib/workspace/my-role";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/w/$workspace/settings/agents")({
  component: ConnectedAgentsPage,
});

function ConnectedAgentsPage() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const projects = useCMS((s) => (ws ? s.projects.filter((p) => p.workspaceId === ws.id) : []));
  const gov = useGovernance(ws?.id ?? "");
  const canManage = canSeeDeveloper(myRole(slug));
  useGrantsVersion();

  if (!ws) return <SettingsHeader title="Connected agents" description="Workspace not found." />;

  const endpoint = `https://mcp.bettercms.site/w/${slug}`;
  const setupCmd = `npx bettercms connect --workspace ${slug}`;

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <>
      <SettingsHeader
        title="Connected agents"
        description="Outside tools that work in this workspace through the same guarded operations as the in-app agent."
      />

      {!gov.externalAgentsAllowed && (
        <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <Plug className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-300" />
          <p className="flex-1 text-[12.5px] text-amber-700 dark:text-amber-200">
            External agents are turned off for this workspace. Existing keys stop working until this is turned back on.
          </p>
          {canManage && (
            <Switch checked={false} onCheckedChange={(v) => governanceActions.patch(ws.id, { externalAgentsAllowed: v })} aria-label="Allow external agents" />
          )}
        </div>
      )}

      <SettingsSection title="Works with" description="Any MCP-compatible tool. These are the common ones.">
        <div className="flex flex-wrap gap-2 py-4">
          {EXTERNAL_CLIENTS.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3 py-1.5">
              <Bot className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[12.5px] font-medium text-foreground">{c.label}</span>
              <span className="text-[10.5px] text-muted-foreground">{c.hint}</span>
            </span>
          ))}
        </div>
      </SettingsSection>

      <SettingsSection title="Connect" description="One command sets up the MCP server; keys are created per project.">
        <div className="space-y-3 py-4">
          <div>
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Setup command</div>
            <div className="flex items-center gap-2">
              <code className="flex h-9 flex-1 items-center gap-2 overflow-x-auto rounded-lg bg-[color:var(--s2)] px-3 font-mono text-[12px] text-foreground">
                <Terminal className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> {setupCmd}
              </code>
              <Button size="sm" variant="outline" className="h-9" onClick={() => copy(setupCmd, "Command")}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>
          <div>
            <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">MCP endpoint</div>
            <div className="flex items-center gap-2">
              <code className="flex h-9 flex-1 items-center overflow-x-auto rounded-lg bg-[color:var(--s2)] px-3 font-mono text-[12px] text-foreground">{endpoint}</code>
              <Button size="sm" variant="outline" className="h-9" onClick={() => copy(endpoint, "Endpoint")}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
          </div>
          <p className="text-[11.5px] text-muted-foreground">
            External agents get the same guardrails as the in-app agent: staging-only writes, scoped keys, revocable anytime, every action audited.
          </p>
        </div>
      </SettingsSection>

      <SettingsSection title="Keys by project" description="Keys are scoped to one project. Create and revoke them on each project's Agent page." flush>
        <ul className="divide-y divide-[color:var(--border-hairline)]">
          {projects.map((p) => {
            const grants = getAgentGrants(p.id);
            return (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
                  <Plug className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-foreground">{p.name}</div>
                  <div className="text-[11.5px] text-muted-foreground">
                    {grants.length === 0 ? "No keys" : `${grants.length} active ${grants.length === 1 ? "key" : "keys"}`}
                    {grants.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center gap-1 text-emerald-600">
                        <Check className="h-3 w-3" /> connected
                      </span>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="h-7 text-[12px]">
                  <Link to="/w/$workspace/p/$project/agent" params={{ workspace: slug, project: p.slug }}>
                    Manage keys <ArrowRight className="ml-1 h-3 w-3" />
                  </Link>
                </Button>
              </li>
            );
          })}
          {projects.length === 0 && <li className="px-4 py-8 text-center text-[12.5px] text-muted-foreground">No projects yet.</li>}
        </ul>
      </SettingsSection>
    </>
  );
}
