/**
 * AgentRoster — the named agents working on this project.
 *
 * Each is a focused identity over the run engine (skill, tier, cadence)
 * and several can run at the same time. Run now fires a real task; the
 * cadence chip shows how it would fire on its own in production.
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { MoreHorizontal, Pause, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  SCHEDULE_LABEL,
  namedAgentActions,
  useNamedAgents,
  type AgentSchedule,
  type NamedAgent,
} from "@/lib/agent/agents-store";
import { agentRunActions } from "@/lib/agent/runs-store";
import { AGENT_SKILLS } from "@/lib/agent/skills";
import { AI_TIER_ORDER, tierAllowed, tierGateNote, type AiTier } from "@/lib/billing/pricing";
import type { SitePlanId } from "@/lib/cms/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const TIER_LABEL: Record<AiTier, string> = { lite: "Lite", balanced: "Balanced", max: "Max" };
const EMOJI_CHOICES = ["✍️", "🔍", "🩺", "🌍", "🧭", "📣", "🧱", "🗂️"];

interface Props {
  projectId: string;
  sitePlan: SitePlanId;
  canRun: boolean;
  /** Called with the run id so the page can open the thread. */
  onRunStarted: (runId: string) => void;
}

export function AgentRoster({ projectId, sitePlan, canRun, onRunStarted }: Props) {
  const agents = useNamedAgents(projectId);
  const [creating, setCreating] = useState(false);

  const runNow = (a: NamedAgent) => {
    if (!canRun || a.status === "paused") return;
    const id = agentRunActions.start({
      projectId,
      prompt: a.instructions,
      tier: a.tier,
      context: [],
      skillId: a.skillId,
      agentId: a.id,
      agentName: a.name,
    });
    if (!id) return;
    namedAgentActions.recordRun(projectId, a.id, id);
    onRunStarted(id);
  };

  return (
    <div className="mt-8">
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Your agents</p>
        {canRun && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[11.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <Plus className="h-3 w-3" /> New agent
          </button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)]">
        {agents.map((a) => (
          <div
            key={a.id}
            className={cn(
              "flex items-center gap-3 border-b border-[color:var(--border-hairline)] px-4 py-3 last:border-b-0",
              a.status === "paused" && "opacity-55",
            )}
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-[15px]">
              {a.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="truncate text-[13px] font-medium text-foreground">{a.name}</span>
                <span className="rounded bg-[color:var(--s2)] px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {SCHEDULE_LABEL[a.schedule]}
                </span>
                <span className="text-[10px] text-muted-foreground/70">{TIER_LABEL[a.tier]}</span>
              </span>
              <span className="block truncate text-[11.5px] text-muted-foreground">
                {a.purpose}
                {a.lastRunAt && ` · last ran ${timeAgo(a.lastRunAt)}`}
              </span>
            </span>
            {canRun && (
              <>
                <button
                  type="button"
                  disabled={a.status === "paused"}
                  onClick={() => runNow(a)}
                  className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)] disabled:cursor-not-allowed"
                >
                  <Play className="h-3 w-3" /> Run now
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Options for ${a.name}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onSelect={() =>
                        namedAgentActions.update(projectId, a.id, {
                          status: a.status === "paused" ? "active" : "paused",
                        })
                      }
                      className="gap-2"
                    >
                      {a.status === "paused" ? <Play className="h-3.5 w-3.5" /> : <Pause className="h-3.5 w-3.5" />}
                      {a.status === "paused" ? "Resume" : "Pause"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={() => {
                        namedAgentActions.remove(projectId, a.id);
                        toast.success(`${a.name} removed`);
                      }}
                    >
                      Remove agent
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        ))}
        {agents.length === 0 && (
          <p className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
            No agents yet. Create one to put a job on a cadence.
          </p>
        )}
      </div>
      {creating && <NewAgentDialog projectId={projectId} sitePlan={sitePlan} onClose={() => setCreating(false)} />}
    </div>
  );
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/* ------------------------------------------------------- create dialog */

function NewAgentDialog({
  projectId,
  sitePlan,
  onClose,
}: {
  projectId: string;
  sitePlan: SitePlanId;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState(EMOJI_CHOICES[4]);
  const [skillId, setSkillId] = useState(AGENT_SKILLS[0].id);
  const [tier, setTier] = useState<AiTier>(tierAllowed(sitePlan, "balanced") ? "balanced" : "lite");
  const [schedule, setSchedule] = useState<AgentSchedule>("manual");
  const [instructions, setInstructions] = useState(AGENT_SKILLS[0].suggestion);

  const skill = AGENT_SKILLS.find((s) => s.id === skillId) ?? AGENT_SKILLS[0];
  const skillGated = skill.minTier === "max" && !tierAllowed(sitePlan, "max");
  const canCreate = name.trim().length > 0 && !skillGated;

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onMouseDown={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New agent"
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        className="relative w-full max-w-[460px] overflow-hidden rounded-xl border border-[color:var(--color-border)] bg-[color:var(--card)] shadow-[var(--shadow-3)]"
      >
        <div className="flex items-start gap-3 border-b border-[color:var(--border-hairline)] px-5 py-4">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-[15px]">
            {emoji}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-foreground">New agent</h2>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              A teammate with one job. It proposes and drafts; you publish.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-5 py-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[12px] font-medium text-foreground">
                Name <span className="text-primary">*</span>
              </label>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Localization agent"
                className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none placeholder:text-muted-foreground/60 focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
              />
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Avatar</label>
              <div className="mt-1.5 flex h-9 items-center gap-1">
                {EMOJI_CHOICES.slice(0, 5).map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => setEmoji(e)}
                    aria-pressed={emoji === e}
                    className={cn(
                      "grid h-8 w-8 place-items-center rounded-md text-[15px] transition-colors",
                      emoji === e ? "bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)]" : "hover:bg-[color:var(--color-row-hover)]",
                    )}
                  >
                    {e}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[12px] font-medium text-foreground">Job</label>
              <select
                value={skillId}
                onChange={(e) => {
                  setSkillId(e.target.value);
                  const s = AGENT_SKILLS.find((x) => x.id === e.target.value);
                  if (s) setInstructions(s.suggestion);
                }}
                className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
              >
                {AGENT_SKILLS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              {skillGated && <p className="mt-1 text-[11px] text-muted-foreground">{tierGateNote(sitePlan, "max")}</p>}
            </div>
            <div>
              <label className="text-[12px] font-medium text-foreground">Cadence</label>
              <select
                value={schedule}
                onChange={(e) => setSchedule(e.target.value as AgentSchedule)}
                className="mt-1.5 h-9 w-full rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 text-[13px] text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
              >
                {(Object.keys(SCHEDULE_LABEL) as AgentSchedule[]).map((s) => (
                  <option key={s} value={s}>
                    {SCHEDULE_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-foreground">Speed</label>
            <div className="mt-1.5 grid grid-cols-3 gap-2">
              {AI_TIER_ORDER.map((t) => {
                const allowed = tierAllowed(sitePlan, t);
                return (
                  <button
                    key={t}
                    type="button"
                    disabled={!allowed}
                    onClick={() => setTier(t)}
                    aria-pressed={tier === t}
                    title={allowed ? undefined : tierGateNote(sitePlan, t)}
                    className={cn(
                      "h-8 rounded-md border text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                      tier === t
                        ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_6%,transparent)] text-primary"
                        : "border-[color:var(--color-border)] text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {TIER_LABEL[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[12px] font-medium text-foreground">Instructions</label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              className="mt-1.5 w-full resize-none rounded-md border border-[color:var(--color-border)] bg-[color:var(--background)] px-2.5 py-2 text-[13px] leading-relaxed text-foreground outline-none focus:border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)]"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">What this agent does every time it runs.</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 items-center rounded-md border border-[color:var(--color-border)] px-3 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canCreate}
            onClick={() => {
              namedAgentActions.add(projectId, {
                name: name.trim(),
                emoji,
                purpose: instructions.trim().slice(0, 90),
                skillId,
                instructions: instructions.trim(),
                tier,
                schedule,
              });
              toast.success(`${name.trim()} added to the roster`);
              onClose();
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Create agent
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
