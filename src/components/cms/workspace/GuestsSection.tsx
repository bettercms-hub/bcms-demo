/**
 * GuestsSection — Webflow-style agency guests on the Team page.
 *
 * A host invites an agency or freelancer TEAM: everyone on it collaborates
 * without paid seats, scoped to all projects or a chosen few, and never
 * sees confidential workspace settings. The team's admin brings teammates
 * up to the host plan's cap (2 teams x 5 members self-serve, 10 x 10 on
 * managed plans).
 */
import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, Handshake, Plus, Trash2, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { useCMS } from "@/lib/cms/store";
import {
  GUEST_ROLE_INFO,
  guestActions,
  guestLimits,
  useGuestTeams,
  type GuestRole,
  type GuestTeam,
} from "@/lib/workspace/guests-store";
import type { Workspace } from "@/lib/cms/types";
import { cn } from "@/lib/utils";

export function GuestsSection({ ws }: { ws: Workspace }) {
  const teams = useGuestTeams(ws.id);
  const limits = guestLimits(ws.workspacePlan);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [manageTeam, setManageTeam] = useState<GuestTeam | null>(null);
  const liveManageTeam = manageTeam ? teams.find((t) => t.id === manageTeam.id) ?? null : null;
  const atTeamCap = teams.length >= limits.teams;

  return (
    <section className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[13px] font-semibold text-foreground">Agency guests</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Invite a whole agency or freelancer team without paid seats. Guests work on projects, never on workspace settings.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11.5px] tabular-nums text-muted-foreground">
            {teams.length} of {limits.teams} guest teams
            {!limits.managed && " · Enterprise hosts 10"}
          </span>
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            disabled={atTeamCap}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[12.5px] font-medium text-foreground transition-colors hover:bg-[color:var(--color-row-hover)] disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Handshake className="h-3.5 w-3.5" /> Invite guest team
          </button>
        </div>
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[color:var(--border-hairline)] bg-[color:var(--card)] px-6 py-8 text-center">
          <Handshake className="mx-auto h-6 w-6 text-muted-foreground/70" />
          <div className="mt-2 text-[13px] font-medium text-foreground">No guest teams yet</div>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-muted-foreground">
            Working with an agency? Invite their whole team as guests. They collaborate free of charge and only see the projects you choose.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)]">
          {teams.map((t, i) => (
            <div key={t.id} className={cn("flex flex-wrap items-center gap-3 px-4 py-3.5", i > 0 && "border-t border-[color:var(--border-hairline)]")}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[color:color-mix(in_oklab,var(--primary)_10%,transparent)] text-[12px] font-semibold uppercase text-primary">
                {t.agencyName.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13.5px] font-semibold text-foreground">{t.agencyName}</span>
                  <span className="rounded bg-[color:var(--s2)] px-1.5 py-px text-[10px] font-medium text-muted-foreground">Guest team · free</span>
                  {t.status === "invited" && (
                    <span className="rounded-[4px] bg-[color-mix(in_srgb,var(--status-warning)_14%,transparent)] px-1.5 py-px text-[10px] font-medium text-[color:var(--status-warning)]">Invited</span>
                  )}
                </div>
                <div className="mt-0.5 truncate text-[11.5px] text-muted-foreground">
                  {t.members.length} of {limits.membersPerTeam} {t.members.length === 1 ? "member" : "members"} · {GUEST_ROLE_INFO[t.role].label}
                  {t.canPublish ? " · Can publish" : ""} · {t.scope === "all" ? "All projects" : `${t.scope.length} ${t.scope.length === 1 ? "project" : "projects"}`}
                </div>
              </div>
              <div className="flex shrink-0 items-center">
                <div className="mr-2 flex -space-x-1.5">
                  {t.members.slice(0, 5).map((m) => (
                    <span
                      key={m.id}
                      title={`${m.name} (${m.email})`}
                      className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--card)] bg-[color:var(--s2)] text-[9px] font-semibold uppercase text-muted-foreground"
                    >
                      {m.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
                    </span>
                  ))}
                  {t.members.length > 5 && (
                    <span className="grid h-6 w-6 place-items-center rounded-full border border-[color:var(--card)] bg-[color:var(--s2)] text-[9px] font-semibold text-muted-foreground">
                      +{t.members.length - 5}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setManageTeam(t)}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
                >
                  <Users className="h-3.5 w-3.5" /> Manage
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Actions for ${t.agencyName}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[190px]">
                    <DropdownMenuItem className="text-[13px]" onSelect={() => setManageTeam(t)}>
                      <UserPlus className="mr-2 h-3.5 w-3.5" /> Manage members
                    </DropdownMenuItem>
                    {t.status === "invited" && (
                      <DropdownMenuItem className="text-[13px]" onSelect={() => { guestActions.markActive(ws.id, t.id); toast.success(`${t.agencyName} is now active`); }}>
                        <Check className="mr-2 h-3.5 w-3.5" /> Mark accepted (demo)
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-[13px] text-destructive focus:text-destructive"
                      onSelect={() => { guestActions.removeTeam(ws.id, t.id); toast.success(`${t.agencyName} removed`); }}
                    >
                      <Trash2 className="mr-2 h-3.5 w-3.5" /> Remove guest team
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {inviteOpen && <InviteGuestDialog ws={ws} onClose={() => setInviteOpen(false)} />}
      {liveManageTeam && <ManageGuestsDialog ws={ws} team={liveManageTeam} onClose={() => setManageTeam(null)} />}
    </section>
  );
}

/* ------------------------------------------------------------- dialogs */

function DialogShell({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[95]">
      <div className="absolute inset-0 bg-[rgba(24,18,16,0.4)]" onMouseDown={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="absolute left-1/2 top-[8vh] flex max-h-[84vh] w-[min(480px,calc(100vw-24px))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--card)] text-foreground shadow-2xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[color:var(--border-hairline)] px-4 py-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[color:var(--s2)] text-muted-foreground">
            <Handshake className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-semibold">{title}</div>
            {subtitle && <div className="truncate text-[11.5px] text-muted-foreground">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto p-4">{children}</div>
        <div className="flex items-center justify-end gap-2 border-t border-[color:var(--border-hairline)] px-4 py-3">{footer}</div>
      </div>
    </div>,
    document.body,
  );
}

function InviteGuestDialog({ ws, onClose }: { ws: Workspace; onClose: () => void }) {
  const projects = useCMS((s) => s.projects.filter((p) => p.workspaceId === ws.id));
  const [agencyName, setAgencyName] = useState("");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [role, setRole] = useState<GuestRole>("developer");
  const [canPublish, setCanPublish] = useState(false);
  const [scopeAll, setScopeAll] = useState(true);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const emailValid = /.+@.+\..+/.test(adminEmail.trim());
  const valid = agencyName.trim().length > 0 && adminName.trim().length > 0 && emailValid && (scopeAll || picked.size > 0);

  function submit() {
    guestActions.invite(ws.id, {
      agencyName,
      adminName,
      adminEmail,
      role,
      canPublish,
      scope: scopeAll ? "all" : [...picked],
    });
    toast.success(`Guest invite sent to ${adminEmail.trim()}`);
    onClose();
  }

  return (
    <DialogShell title="Invite a guest team" subtitle={`Guests join ${ws.name} free of charge`} onClose={onClose} footer={
      <>
        <button type="button" onClick={onClose} className="h-8 rounded-md px-3 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)]">Cancel</button>
        <button type="button" onClick={submit} disabled={!valid} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
          Send invite
        </button>
      </>
    }>
      <label className="block">
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Agency or studio name</div>
        <input value={agencyName} onChange={(e) => setAgencyName(e.target.value)} autoFocus placeholder="Northwind Studio" className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
      </label>
      <div className="grid grid-cols-2 gap-2.5">
        <label className="block">
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Team admin</div>
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Priya Raman" className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
        </label>
        <label className="block">
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Admin email</div>
          <input value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} type="email" placeholder="priya@studio.co" className="h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
        </label>
      </div>

      <div>
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Role on your projects</div>
        <div className="grid grid-cols-3 gap-1.5">
          {(Object.keys(GUEST_ROLE_INFO) as GuestRole[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              aria-pressed={role === r}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors",
                role === r
                  ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)]"
                  : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]",
              )}
            >
              <div className="text-[12px] font-semibold">{GUEST_ROLE_INFO[r].label}</div>
              <div className="text-[10px] leading-snug text-muted-foreground">{GUEST_ROLE_INFO[r].blurb}</div>
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-2.5">
        <span>
          <span className="block text-[12.5px] font-medium text-foreground">Can publish</span>
          <span className="block text-[11px] text-muted-foreground">Without it, their changes wait for your approval</span>
        </span>
        <input type="checkbox" checked={canPublish} onChange={(e) => setCanPublish(e.target.checked)} className="h-4 w-4 accent-[var(--primary)]" />
      </label>

      <div>
        <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Project access</div>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { all: true, label: "All projects", blurb: "Including future ones" },
            { all: false, label: "Only some", blurb: "Pick the client work" },
          ].map((o) => (
            <button
              key={String(o.all)}
              type="button"
              onClick={() => setScopeAll(o.all)}
              aria-pressed={scopeAll === o.all}
              className={cn(
                "rounded-lg border px-2.5 py-2 text-left transition-colors",
                scopeAll === o.all
                  ? "border-[color:color-mix(in_oklab,var(--primary)_45%,transparent)] bg-[color:color-mix(in_oklab,var(--primary)_7%,transparent)]"
                  : "border-[color:var(--color-border)] hover:bg-[color:var(--color-row-hover)]",
              )}
            >
              <div className="text-[12px] font-semibold">{o.label}</div>
              <div className="text-[10px] text-muted-foreground">{o.blurb}</div>
            </button>
          ))}
        </div>
        {!scopeAll && (
          <div className="mt-2 max-h-[150px] space-y-1 overflow-y-auto rounded-lg border border-[color:var(--color-border)] p-2">
            {projects.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-[color:var(--color-row-hover)]">
                <input
                  type="checkbox"
                  checked={picked.has(p.id)}
                  onChange={(e) => {
                    setPicked((prev) => {
                      const next = new Set(prev);
                      if (e.target.checked) next.add(p.id);
                      else next.delete(p.id);
                      return next;
                    });
                  }}
                  className="h-3.5 w-3.5 accent-[var(--primary)]"
                />
                {p.name}
              </label>
            ))}
          </div>
        )}
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Guests never see billing, members or workspace settings. Their admin can add teammates after accepting, up to {guestLimits(ws.workspacePlan).membersPerTeam} per team on your plan.
      </p>
    </DialogShell>
  );
}

function ManageGuestsDialog({ ws, team, onClose }: { ws: Workspace; team: GuestTeam; onClose: () => void }) {
  const limits = guestLimits(ws.workspacePlan);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const emailValid = /.+@.+\..+/.test(email.trim());
  const atCap = team.members.length >= limits.membersPerTeam;
  const canAdd = !atCap && name.trim().length > 0 && emailValid;

  function add() {
    guestActions.addMember(ws.id, team.id, { name, email });
    toast.success(`${name.trim()} added to ${team.agencyName}`);
    setName("");
    setEmail("");
  }

  return (
    <DialogShell
      title={`${team.agencyName} members`}
      subtitle={`${team.members.length} of ${limits.membersPerTeam} guest members on your plan`}
      onClose={onClose}
      footer={
        <button type="button" onClick={onClose} className="h-8 rounded-md bg-primary px-3.5 text-[12.5px] font-semibold text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]">
          Done
        </button>
      }
    >
      <div className="overflow-hidden rounded-lg border border-[color:var(--color-border)]">
        {team.members.map((m, i) => (
          <div key={m.id} className={cn("flex items-center gap-2.5 px-3 py-2.5", i > 0 && "border-t border-[color:var(--border-hairline)]")}>
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[color:var(--s2)] text-[10px] font-semibold uppercase text-muted-foreground">
              {m.name.split(" ").map((s) => s[0]).slice(0, 2).join("")}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">
                {m.name}
                {m.isAdmin && <span className="ml-1.5 rounded bg-[color:var(--s2)] px-1 py-px text-[9.5px] font-medium text-muted-foreground">Team admin</span>}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{m.email}</span>
            </span>
            {!m.isAdmin && (
              <button
                type="button"
                aria-label={`Remove ${m.name}`}
                onClick={() => { guestActions.removeMember(ws.id, team.id, m.id); toast.success(`${m.name} removed`); }}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-[color:var(--color-row-hover)] hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      {atCap ? (
        <p className="rounded-lg bg-[color:var(--s2)] px-3 py-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
          This team is at your plan's limit of {limits.membersPerTeam} guest members.
          {!limits.managed && " Enterprise workspaces host up to 10 per team."}
        </p>
      ) : (
        <div>
          <div className="mb-1 text-[11.5px] font-medium text-muted-foreground">Add a guest member</div>
          <div className="flex items-center gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" className="h-9 w-[38%] rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="name@agency.co" className="h-9 flex-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--card)] px-2.5 text-[13px] outline-none transition-colors focus:border-[color:var(--primary)]" />
            <button type="button" onClick={add} disabled={!canAdd} aria-label="Add guest member" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-40">
              <Plus className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </DialogShell>
  );
}
