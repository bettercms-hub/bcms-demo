import { createFileRoute } from "@tanstack/react-router";
import { Bot, Check, Gauge, KeyRound, Lock, Plug, ScanSearch, ShieldCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { SettingsHeader, SettingsRow, SettingsSection } from "@/components/cms/SettingsSubNav";
import { AGENT_SKILLS } from "@/lib/agent/skills";
import { governanceActions, useGovernance } from "@/lib/agent/governance-store";
import { AI_TIERS, AI_TIER_ORDER, type AiTier } from "@/lib/billing/pricing";
import { canSeeDeveloper, myRole } from "@/lib/workspace/my-role";
import { useCMS } from "@/lib/cms/store";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/w/$workspace/settings/ai")({
  component: AiControls,
});

function AiControls() {
  const { workspace: slug } = Route.useParams();
  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const gov = useGovernance(ws?.id ?? "");
  const canManage = canSeeDeveloper(myRole(slug));

  if (!ws) return <SettingsHeader title="AI controls" description="Workspace not found." />;

  const wsId = ws.id;

  return (
    <>
      <SettingsHeader
        title="AI controls"
        description="What the agent may do in this workspace: budget, speed, skills, and who can connect what."
      />

      {!canManage && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--s2)] px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          <Lock className="h-3.5 w-3.5 shrink-0" /> Admins and developers manage AI controls. You can see the current setup.
        </div>
      )}

      {/* Always-on safety: the two rules governance cannot loosen. */}
      <div className="mb-4 flex items-start gap-3 rounded-xl border border-[color:var(--border-hairline)] bg-card px-4 py-3.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-semibold text-foreground">Two rules never change</div>
          <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
            Agent plans always need a person's approval, and nothing the agent writes publishes on its own.
            The controls below narrow what the agent may do; they never remove the human.
          </p>
        </div>
        <span className="mt-1 inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-emerald-600">
          <Check className="h-3 w-3" /> Always on
        </span>
      </div>

      <SettingsSection title="Budget" description="A hard monthly cap on AI credits, on top of what the plan includes.">
        <SettingsRow label="Monthly credit budget" description="Runs stop when the workspace hits this number. Leave empty for the plan's included credits.">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              disabled={!canManage}
              value={gov.monthlyCreditBudget ?? ""}
              placeholder="Plan default"
              onChange={(e) => {
                const v = e.target.value === "" ? null : Math.max(0, Number(e.target.value));
                governanceActions.patch(wsId, { monthlyCreditBudget: v });
              }}
              className="h-9 w-[140px] text-right tabular-nums"
            />
            <span className="text-[12px] text-muted-foreground">credits / month</span>
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Speed ceiling" description="The fastest tier members may pick. Requests above it are clamped, not rejected.">
        <div className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-3">
          {AI_TIER_ORDER.map((t: AiTier) => {
            const meta = AI_TIERS[t];
            const active = gov.tierCeiling === t;
            return (
              <button
                key={t}
                type="button"
                disabled={!canManage}
                onClick={() => {
                  governanceActions.patch(wsId, { tierCeiling: t });
                  toast.success(`Speed ceiling set to ${meta.label}`);
                }}
                className={cn(
                  "rounded-xl border p-3.5 text-left transition-all disabled:cursor-not-allowed",
                  active
                    ? "border-[color:color-mix(in_oklab,var(--primary)_50%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_5%,transparent)]"
                    : "border-[color:var(--color-border)] bg-card hover:border-[color:var(--color-border-strong)]",
                )}
              >
                <div className="flex items-center gap-2">
                  <Gauge className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")} />
                  <span className="text-[13.5px] font-semibold text-foreground">{meta.label}</span>
                  {active && <Check className="ml-auto h-3.5 w-3.5 text-primary" />}
                </div>
                <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{meta.bestAt}</p>
              </button>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Skills" description="Which jobs the agent may run. Turning one off hides it everywhere and blocks it at the source.">
        {AGENT_SKILLS.map((s) => (
          <SettingsRow key={s.id} label={s.label} description={s.blurb}>
            <Switch
              checked={gov.skills[s.id] !== false}
              disabled={!canManage}
              onCheckedChange={(v) => governanceActions.setSkill(wsId, s.id, v)}
              aria-label={`Allow ${s.label}`}
            />
          </SettingsRow>
        ))}
      </SettingsSection>

      <SettingsSection title="Page generators" description="Bulk page creation from the Pages hub and the Agent page.">
        <SettingsRow label="SEO pages from keywords" description="One draft page per keyword, from a CSV or a pasted list.">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={gov.generators.seo} disabled={!canManage} onCheckedChange={(v) => governanceActions.setGenerator(wsId, "seo", v)} aria-label="Allow SEO page generation" />
          </div>
        </SettingsRow>
        <SettingsRow label="ABM pages" description="One page personalized for one target account.">
          <div className="flex items-center gap-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={gov.generators.abm} disabled={!canManage} onCheckedChange={(v) => governanceActions.setGenerator(wsId, "abm", v)} aria-label="Allow ABM page generation" />
          </div>
        </SettingsRow>
      </SettingsSection>

      <SettingsSection title="Access" description="Who can bring their own model keys and connect outside tools.">
        <SettingsRow label="Personal model keys" description="Members can attach their own API keys. Those runs bill to their key, not to workspace credits.">
          <div className="flex items-center gap-2">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={gov.byokAllowed} disabled={!canManage} onCheckedChange={(v) => governanceActions.patch(wsId, { byokAllowed: v })} aria-label="Allow personal model keys" />
          </div>
        </SettingsRow>
        <SettingsRow label="External agents" description="MCP clients like Claude, Cursor and Lovable can connect with scoped, revocable keys.">
          <div className="flex items-center gap-2">
            <Plug className="h-3.5 w-3.5 text-muted-foreground" />
            <Switch checked={gov.externalAgentsAllowed} disabled={!canManage} onCheckedChange={(v) => governanceActions.patch(wsId, { externalAgentsAllowed: v })} aria-label="Allow external agents" />
          </div>
        </SettingsRow>
      </SettingsSection>

      <div className="mt-4 flex items-start gap-2.5 px-1 text-[11.5px] text-muted-foreground">
        <Bot className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>
          Every agent run is recorded with who started it, what changed, and the credits spent. See each project's Agent page for history and one click undo.
        </span>
      </div>
    </>
  );
}
