import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Gift, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WorkspaceSubNav } from "@/components/cms/workspace/WorkspaceSubNav";
import { GuestsSection } from "@/components/cms/workspace/GuestsSection";
import { PageShell } from "@/components/cms/layout";
import { Icon } from "@/components/cms/Icon";
import { MetricGrid, MetricTile } from "@/components/cms/ui/MetricTile";
import { useCMS, memberActions } from "@/lib/cms/store";
import {
  SEATS,
  SEAT_ORDER,
  fmtUSD,
  isPaidSeat,
  paidSeatsMonthly,
  seatCounts,
} from "@/lib/billing/pricing";
import type { Member, SeatRole } from "@/lib/cms/types";

export const Route = createFileRoute("/w/$workspace/members")({
  component: Members,
});

/** Display order for the paid groups: highest touch first. */
const PAID_DISPLAY_ORDER: SeatRole[] = ["developer", "marketer", "editor"];

/** Team plan includes 15 paid seats in the contract. Matches the pricing doc. */
const TEAM_INCLUDED_SEATS = 15;

const EMPTY_MEMBERS: Member[] = [];

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "?";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

/** Seat option label for the row selects. Every price visible before commit. */
function seatOptionLabel(role: SeatRole): string {
  const def = SEATS[role];
  return def.monthly === 0 ? `${def.label} · Free` : `${def.label} · ${fmtUSD(def.monthly)}/mo`;
}

/** Seat option label for the add dialog. Free seats get the full celebration. */
function seatDialogLabel(role: SeatRole): string {
  const def = SEATS[role];
  return def.monthly === 0
    ? `${def.label} · Free, unlimited`
    : `${def.label} · ${fmtUSD(def.monthly)}/mo`;
}

function Members() {
  const { workspace: slug } = Route.useParams();

  const ws = useCMS((s) => s.workspaces.find((w) => w.slug === slug));
  const roster = useCMS((s) => {
    const w = s.workspaces.find((x) => x.slug === slug);
    if (!w) return EMPTY_MEMBERS;
    return s.members.filter((m) => w.memberIds.includes(m.id));
  });
  const pending = useCMS((s) => {
    const w = s.workspaces.find((x) => x.slug === slug);
    if (!w) return [];
    return s.invitations.filter((i) => i.workspaceId === w.id && i.status === "pending");
  });

  const [addOpen, setAddOpen] = useState(false);

  if (!ws) {
    return (
      <div className="flex min-h-0 flex-1">
        <WorkspaceSubNav wsSlug={slug} />
        <div className="flex-1 overflow-auto">
          <PageShell title="Seats and members" width="full">
            <div className="rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)] px-6 py-8 text-[13px] text-muted-foreground">
              Workspace not found.
            </div>
          </PageShell>
        </div>
      </div>
    );
  }

  const plan = ws.workspacePlan ?? "free";
  const isTeam = plan === "team";
  const isEnterprise = plan === "enterprise";
  const managed = isTeam || isEnterprise;

  const owner = roster.find((m) => m.role === "owner");
  const counts = seatCounts(roster);
  const paidCount = counts.editor + counts.marketer + counts.developer;
  const freeCount = counts.viewer + counts.reviewer;
  const paidMonthly = paidSeatsMonthly(roster);

  const freeMembers = [
    ...roster.filter((m) => m.seat === "reviewer"),
    ...roster.filter((m) => m.seat === "viewer"),
  ];

  const handleChangeSeat = (member: Member, seat: SeatRole) => {
    memberActions.changeSeat(ws.id, member.id, seat);
    if (managed) {
      toast("Seat updated");
      return;
    }
    const next = roster.map((m) => (m.id === member.id ? { ...m, seat } : m));
    toast(`Seat updated. New workspace total: ${fmtUSD(paidSeatsMonthly(next))}/mo.`);
  };

  const handleRemove = (member: Member) => {
    memberActions.remove(ws.id, member.id);
    toast(managed ? "Seat removed." : "Seat removed. The total updated.");
  };

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceSubNav wsSlug={slug} />
      <div className="flex-1 overflow-auto">
        <PageShell
          breadcrumbs={[
            { label: ws.name, to: "/w/$workspace", params: { workspace: slug } },
            { label: "Seats and members" },
          ]}
          eyebrow="Workspace"
          title="Seats and members"
          description="Owners and free seats never bill. Paid seats are priced by role, and removing one is as easy as adding one."
          width="full"
          actions={
            <Button onClick={() => setAddOpen(true)} size="sm" className="h-8 gap-1.5 text-[13px]">
              <Icon icon={UserPlus} size="sm" /> Add seat
            </Button>
          }
        >
          {/* The headline moment: what is free stays free. */}
          <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] px-6 py-5">
            <div className="flex items-start gap-3.5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <Icon icon={Gift} size="lg" />
              </span>
              <div className="min-w-0">
                <div className="text-[14.5px] font-semibold leading-snug text-foreground">
                  Viewers and reviewers are free. Always, on every plan, unlimited.
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
                  Bring in every stakeholder to read, comment, suggest and approve. It never touches the bill.
                </p>
              </div>
            </div>
            <div className="shrink-0 rounded-full bg-emerald-500/12 px-3.5 py-1.5 text-[12.5px] font-medium text-emerald-700 dark:text-emerald-300">
              {plural(counts.reviewer, "reviewer")} · {plural(counts.viewer, "viewer")} on free seats
            </div>
          </div>

          {/* Summary tiles */}
          <div className="mb-10">
            <MetricGrid cols={3}>
              {isTeam ? (
                <MetricTile
                  label="Included seats"
                  value={paidCount}
                  sublabel={`${TEAM_INCLUDED_SEATS} seats included in your plan · ${paidCount} in use`}
                />
              ) : isEnterprise ? (
                <MetricTile
                  label="Seats"
                  value={paidCount}
                  sublabel={
                    <span className="flex items-center gap-2">
                      Custom seats under your agreement
                      <Badge className="rounded-full bg-indigo-500/10 px-2 py-0 text-[11px] font-medium text-indigo-600 hover:bg-indigo-500/10 dark:text-indigo-400">
                        Custom roles
                      </Badge>
                    </span>
                  }
                />
              ) : (
                <MetricTile
                  label="Paid seats"
                  value={paidCount}
                  sublabel={paidCount > 0 ? `${fmtUSD(paidMonthly)}/mo` : "No paid seats yet"}
                />
              )}
              <MetricTile label="Free seats" value={freeCount} sublabel="Always free, unlimited" />
              <MetricTile label="Owner" value={1} sublabel={owner ? `${owner.name} · never billed` : "Never billed"} />
            </MetricGrid>
          </div>

          {/* Members, grouped */}
          <div className="overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)]">
            {/* Owner */}
            <SectionHeader title="Owner" note="Always included" first />
            {owner && (
              <MemberRow member={owner} isOwner onChangeSeat={handleChangeSeat} onRemove={handleRemove} />
            )}

            {/* Paid seats */}
            <SectionHeader
              title="Paid seats"
              note={
                isTeam
                  ? "Included in your plan"
                  : isEnterprise
                    ? "Under your agreement"
                    : paidCount > 0
                      ? `${fmtUSD(paidMonthly)}/mo`
                      : undefined
              }
            />
            {paidCount === 0 && (
              <div className="border-t border-[color:var(--border-hairline)] px-6 py-5 text-[12.5px] text-muted-foreground">
                No paid seats yet. Add an editor, marketer or developer seat whenever someone needs to create or ship.
              </div>
            )}
            {PAID_DISPLAY_ORDER.map((role) => {
              const group = roster.filter((m) => m.seat === role);
              if (group.length === 0) return null;
              return (
                <div key={role}>
                  <RoleHeader role={role} />
                  {group.map((m) => (
                    <MemberRow key={m.id} member={m} onChangeSeat={handleChangeSeat} onRemove={handleRemove} />
                  ))}
                </div>
              );
            })}

            {/* Free seats */}
            <SectionHeader title="Free seats" note="Free, unlimited" />
            {freeMembers.length === 0 ? (
              <div className="border-t border-[color:var(--border-hairline)] px-6 py-5 text-[12.5px] text-muted-foreground">
                No free seats yet. Viewer and reviewer seats cost nothing, on every plan.
              </div>
            ) : (
              freeMembers.map((m) => (
                <MemberRow key={m.id} member={m} onChangeSeat={handleChangeSeat} onRemove={handleRemove} />
              ))
            )}
          </div>

          {/* Agency guests: whole teams collaborate without paid seats. */}
          <div className="mt-10">
            <GuestsSection ws={ws} />
          </div>

          {/* Pending invitations */}
          {pending.length > 0 && (
            <div className="mt-10">
              <h2 className="text-[13px] font-semibold text-foreground">Pending invitations</h2>
              <div className="mt-3 overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-[color:var(--card)]">
                {pending.map((inv, i) => (
                  <div
                    key={inv.id}
                    className={`flex items-center justify-between gap-4 px-6 py-3.5 ${i > 0 ? "border-t border-[color:var(--border-hairline)]" : ""}`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-medium text-foreground">{inv.email}</div>
                      <div className="mt-0.5 text-[12px] capitalize text-muted-foreground">
                        {inv.role.replace(/_/g, " ")}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-[color:var(--surface-2)] px-2.5 py-1 text-[11.5px] font-medium text-muted-foreground">
                      Pending
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <AddSeatDialog
            open={addOpen}
            onOpenChange={setAddOpen}
            workspaceId={ws.id}
            roster={roster}
            isTeam={isTeam}
            isEnterprise={isEnterprise}
          />
        </PageShell>
      </div>
    </div>
  );
}

/* ─── Grouping headers ─── */

function SectionHeader({ title, note, first = false }: { title: string; note?: string; first?: boolean }) {
  return (
    <div
      className={`flex items-center justify-between gap-4 bg-[color:var(--surface-2)]/60 px-6 py-2.5 ${
        first ? "" : "border-t border-[color:var(--border-hairline)]"
      }`}
    >
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{title}</span>
      {note && <span className="text-[12px] tabular-nums text-muted-foreground">{note}</span>}
    </div>
  );
}

function RoleHeader({ role }: { role: SeatRole }) {
  const def = SEATS[role];
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 border-t border-[color:var(--border-hairline)] px-6 pb-1.5 pt-3">
      <span className="text-[12.5px] font-semibold text-foreground">
        {def.label} · {fmtUSD(def.monthly)}/mo each
      </span>
      <span className="text-[12px] text-muted-foreground">{def.what}</span>
    </div>
  );
}

/* ─── Member row ─── */

function MemberRow({
  member,
  isOwner = false,
  onChangeSeat,
  onRemove,
}: {
  member: Member;
  isOwner?: boolean;
  onChangeSeat: (member: Member, seat: SeatRole) => void;
  onRemove: (member: Member) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[color:var(--border-hairline)] px-6 py-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
          isOwner ? "bg-primary/10 text-primary" : "bg-[color:var(--surface-2)] text-foreground"
        }`}
        aria-hidden
      >
        {initials(member.name)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium text-foreground">{member.name}</span>
          {member.status === "invited" && (
            <span className="shrink-0 rounded-full bg-[color:var(--surface-2)] px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              Invited
            </span>
          )}
          {member.guestOf && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              <Icon icon={UserPlus} size="xs" />
              Guest in {member.guestOf}
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{member.email}</div>
      </div>

      {isOwner ? (
        <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11.5px] font-medium text-primary">
          Owner · always included
        </span>
      ) : (
        <div className="flex shrink-0 items-center gap-2">
          <Select
            value={member.seat ?? "viewer"}
            onValueChange={(v) => onChangeSeat(member, v as SeatRole)}
          >
            <SelectTrigger className="h-8 w-[200px] text-[12.5px]" aria-label={`Seat for ${member.name}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SEAT_ORDER.map((role) => (
                <SelectItem key={role} value={role} className="text-[12.5px]">
                  {seatOptionLabel(role)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground"
            onClick={() => onRemove(member)}
          >
            Remove
          </Button>
        </div>
      )}
    </div>
  );
}

/* ─── Add seat dialog ─── */

function AddSeatDialog({
  open,
  onOpenChange,
  workspaceId,
  roster,
  isTeam,
  isEnterprise,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  roster: Member[];
  isTeam: boolean;
  isEnterprise: boolean;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [seat, setSeat] = useState<SeatRole>("reviewer");

  const managed = isTeam || isEnterprise;
  const currentMonthly = paidSeatsMonthly(roster);
  const nextMonthly = currentMonthly + (isPaidSeat(seat) ? SEATS[seat].monthly : 0);
  const valid = name.trim().length > 0 && email.includes("@");

  const reset = () => {
    setName("");
    setEmail("");
    setSeat("reviewer");
  };

  const close = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const submit = () => {
    if (!valid) return;
    memberActions.addSeat(workspaceId, { name: name.trim(), email: email.trim(), seat });
    if (managed) {
      toast("Seat added");
    } else if (isPaidSeat(seat)) {
      toast(`Added ${name.trim()} as ${SEATS[seat].label}. New workspace total: ${fmtUSD(nextMonthly)}/mo.`);
    } else {
      toast(`Added ${name.trim()} on a free ${SEATS[seat].label} seat.`);
    }
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">Add a seat</DialogTitle>
          <DialogDescription className="text-[12.5px]">
            Viewer and reviewer seats are free and unlimited. Paid seats bill monthly and can be removed any time.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="seat-name" className="text-[12.5px]">
              Name
            </Label>
            <Input
              id="seat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ada Osei"
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="seat-email" className="text-[12.5px]">
              Email
            </Label>
            <Input
              id="seat-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ada@example.com"
              className="h-9 text-[13px]"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Seat</Label>
            <Select value={seat} onValueChange={(v) => setSeat(v as SeatRole)}>
              <SelectTrigger className="h-9 text-[13px]" aria-label="Seat type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEAT_ORDER.map((role) => (
                  <SelectItem key={role} value={role} className="text-[12.5px]">
                    {seatDialogLabel(role)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="pt-0.5 text-[12px] leading-relaxed text-muted-foreground">{SEATS[seat].what}</p>
          </div>

          <div className="rounded-lg border border-[color:var(--border-hairline)] bg-[color:var(--surface-2)]/50 px-3.5 py-2.5 text-[12.5px]">
            {isTeam ? (
              <span className="text-muted-foreground">Seats are included in your plan.</span>
            ) : isEnterprise ? (
              <span className="text-muted-foreground">Seats are covered under your agreement.</span>
            ) : (
              <span className="text-foreground">
                New workspace total:{" "}
                <span className="font-semibold tabular-nums">{fmtUSD(nextMonthly)}/mo</span>
                {!isPaidSeat(seat) && (
                  <span className="text-muted-foreground"> · this seat is free, the total does not change</span>
                )}
              </span>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" className="h-8 text-[13px]" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-[13px]" onClick={submit} disabled={!valid}>
            Add seat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
