import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  useMembers,
  useProjectAccess,
  useRemoveProjectAccess,
  useRoles,
  useSetProjectAccess,
} from "@/lib/workspace/queries";

interface Props {
  workspaceId: string | undefined;
  projectSlug: string;
}

function initials(name: string) {
  return name.split(" ").map((s) => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export function ProjectAccessTable({ workspaceId, projectSlug }: Props) {
  const { data: members = [] } = useMembers(workspaceId);
  const { data: roles = [] } = useRoles(workspaceId);
  const { data: overrides = [] } = useProjectAccess(workspaceId, projectSlug);
  const setAccess = useSetProjectAccess(workspaceId, projectSlug);
  const removeAccess = useRemoveProjectAccess(workspaceId, projectSlug);

  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);
  const overrideByMember = useMemo(
    () => new Map(overrides.map((o) => [o.member_id, o])),
    [overrides],
  );

  const [addMemberId, setAddMemberId] = useState<string>("");
  const [addRoleId, setAddRoleId] = useState<string>("");

  const candidates = useMemo(
    () => members.filter((m) => !overrideByMember.has(m.id)),
    [members, overrideByMember],
  );

  const handleAdd = async () => {
    if (!addMemberId || !addRoleId) return;
    await setAccess.mutateAsync({ memberId: addMemberId, roleId: addRoleId });
    toast.success("Project access updated");
    setAddMemberId("");
    setAddRoleId("");
  };

  return (
    <div className="grid gap-3">
      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="grid grid-cols-[1.5fr_1.2fr_1.2fr_24px] gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <div>Member</div>
          <div>Workspace role (inherited)</div>
          <div>Project role</div>
          <div />
        </div>
        {members.length === 0 && (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            No workspace members yet.
          </div>
        )}
        {members.map((m, i) => {
          const wsRole = m.role_id ? roleById.get(m.role_id) : undefined;
          const ovr = overrideByMember.get(m.id);
          const effectiveRoleId = ovr?.role_id ?? m.role_id ?? "";
          return (
            <div
              key={m.id}
              className={`grid grid-cols-[1.5fr_1.2fr_1.2fr_24px] items-center gap-3 px-3 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">
                  {initials(m.name)}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-foreground">{m.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{m.email}</div>
                </div>
              </div>
              <div className="text-[12.5px] text-muted-foreground">{wsRole?.name ?? "—"}</div>
              <div>
                <Select
                  value={effectiveRoleId || undefined}
                  onValueChange={(roleId) =>
                    setAccess
                      .mutateAsync({ memberId: m.id, roleId })
                      .then(() => toast.success("Project role updated"))
                  }
                >
                  <SelectTrigger className="h-8 text-[12.5px]">
                    <SelectValue placeholder="Inherit" />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.id === m.role_id ? " (inherited)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end">
                {ovr ? (
                  <button
                    type="button"
                    onClick={() =>
                      removeAccess
                        .mutateAsync(ovr.id)
                        .then(() => toast.success("Override removed"))
                    }
                    title="Reset to inherited workspace role"
                    className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : (
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                    inherits
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {candidates.length > 0 && (
        <div className="rounded-md border border-border bg-surface p-3">
          <div className="text-[12px] font-semibold text-foreground">Add explicit access</div>
          <div className="mt-1 text-[11.5px] text-muted-foreground">
            Grant a non-default project role to a workspace member.
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={addMemberId} onValueChange={setAddMemberId}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Choose member" />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={addRoleId} onValueChange={setAddRoleId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={handleAdd} disabled={!addMemberId || !addRoleId}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
