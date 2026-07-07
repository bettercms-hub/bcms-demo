import { useMemo, useState } from "react";
import { MoreHorizontal, Search } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  useMembers,
  useRoles,
  useRemoveMember,
  useTransferOwnership,
  useUpdateMember,
  type MemberRow,
  type RoleRow,
} from "@/lib/workspace/queries";
import { getCurrentUserRef } from "@/lib/workspace/current-user";

interface Props {
  workspaceId: string | undefined;
}

function relTime(iso: string | null) {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function initials(name: string) {
  return name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-600",
  invited: "bg-amber-500/15 text-amber-600",
  suspended: "bg-rose-500/15 text-rose-600",
};

export function MembersTable({ workspaceId }: Props) {
  const { data: members = [], isLoading } = useMembers(workspaceId);
  const { data: roles = [] } = useRoles(workspaceId);
  const updateMember = useUpdateMember(workspaceId);
  const removeMember = useRemoveMember(workspaceId);
  const transfer = useTransferOwnership(workspaceId);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const viewerRef = getCurrentUserRef();
  const ownerRole = roles.find((r) => r.is_builtin && r.key === "owner");
  const roleById = useMemo(() => new Map(roles.map((r) => [r.id, r])), [roles]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return members.filter((m) => {
      if (q && !`${m.name} ${m.email}`.toLowerCase().includes(q)) return false;
      if (roleFilter !== "all" && m.role_id !== roleFilter) return false;
      if (statusFilter !== "all" && m.status !== statusFilter) return false;
      return true;
    });
  }, [members, search, roleFilter, statusFilter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === filtered.length ? new Set() : new Set(filtered.map((m) => m.id)),
    );

  const bulkSuspend = async () => {
    await Promise.all(
      [...selected].map((id) => updateMember.mutateAsync({ id, status: "suspended" })),
    );
    toast.success(`Suspended ${selected.size} member${selected.size === 1 ? "" : "s"}`);
    setSelected(new Set());
  };

  const bulkRemove = async () => {
    await Promise.all([...selected].map((id) => removeMember.mutateAsync(id)));
    toast.success(`Removed ${selected.size} member${selected.size === 1 ? "" : "s"}`);
    setSelected(new Set());
  };

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="invited">Invited</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {selected.size > 0 && (
        <div className="flex items-center justify-between rounded-md border border-border bg-surface px-3 py-2 text-[12.5px]">
          <span>{selected.size} selected</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={bulkSuspend}
              className="rounded-md border border-border bg-background px-2.5 py-1 hover:bg-[color:var(--color-row-hover)]"
            >
              Suspend
            </button>
            <button
              type="button"
              onClick={bulkRemove}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-destructive hover:bg-[color:var(--color-row-hover)]"
            >
              Remove
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border bg-background">
        <div className="grid grid-cols-[36px_2fr_1.4fr_1fr_120px_24px] items-center gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          <Checkbox
            checked={filtered.length > 0 && selected.size === filtered.length}
            onCheckedChange={toggleAll}
          />
          <div>Member</div>
          <div>Role</div>
          <div>Status</div>
          <div>Last active</div>
          <div />
        </div>
        {isLoading && (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">Loading…</div>
        )}
        {!isLoading && filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">
            No members match those filters.
          </div>
        )}
        {filtered.map((m, i) => (
          <MemberRowView
            key={m.id}
            row={m}
            roles={roles}
            roleName={m.role_id ? roleById.get(m.role_id)?.name : undefined}
            isViewer={m.user_ref === viewerRef}
            divided={i > 0}
            selected={selected.has(m.id)}
            onToggle={() => toggle(m.id)}
            onChangeRole={(roleId) =>
              updateMember
                .mutateAsync({ id: m.id, role_id: roleId })
                .then(() => toast.success("Role updated"))
            }
            onSuspend={() =>
              updateMember
                .mutateAsync({ id: m.id, status: m.status === "suspended" ? "active" : "suspended" })
                .then(() =>
                  toast.success(m.status === "suspended" ? "Member reactivated" : "Member suspended"),
                )
            }
            onRemove={() =>
              removeMember.mutateAsync(m.id).then(() => toast.success("Member removed"))
            }
            onTransfer={() => {
              if (!ownerRole) return;
              transfer
                .mutateAsync({ newOwnerMemberId: m.id, newOwnerUserRef: m.user_ref })
                .then(() => toast.success("Ownership transferred"));
            }}
          />
        ))}
      </div>
    </div>
  );
}

function MemberRowView({
  row,
  roles,
  roleName,
  isViewer,
  divided,
  selected,
  onToggle,
  onChangeRole,
  onSuspend,
  onRemove,
  onTransfer,
}: {
  row: MemberRow;
  roles: RoleRow[];
  roleName: string | undefined;
  isViewer: boolean;
  divided: boolean;
  selected: boolean;
  onToggle: () => void;
  onChangeRole: (roleId: string) => void;
  onSuspend: () => void;
  onRemove: () => void;
  onTransfer: () => void;
}) {
  return (
    <div
      className={`grid grid-cols-[36px_2fr_1.4fr_1fr_120px_24px] items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[color:var(--color-row-hover)] ${divided ? "border-t border-border" : ""}`}
    >
      <Checkbox checked={selected} onCheckedChange={onToggle} />
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-muted text-[11px] font-semibold">
          {initials(row.name)}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate text-[13px] font-medium text-foreground">
            {row.name}
            {isViewer && (
              <span className="rounded bg-primary/10 px-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
                You
              </span>
            )}
          </div>
          <div className="truncate font-mono text-[11px] text-muted-foreground">{row.email}</div>
        </div>
      </div>
      <div>
        <Select
          value={row.role_id ?? undefined}
          onValueChange={onChangeRole}
        >
          <SelectTrigger className="h-8 text-[12.5px]">
            <SelectValue placeholder={roleName ?? "Select role"} />
          </SelectTrigger>
          <SelectContent>
            {roles.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <span
          className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[row.status] ?? "bg-muted text-muted-foreground"}`}
        >
          {row.status}
        </span>
      </div>
      <div className="text-[12px] text-muted-foreground">{relTime(row.last_active_at)}</div>
      <div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] hover:text-foreground"
              aria-label="Member actions"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Actions</DropdownMenuLabel>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>Change role</DropdownMenuSubTrigger>
              <DropdownMenuPortal>
                <DropdownMenuSubContent>
                  {roles.map((r) => (
                    <DropdownMenuItem key={r.id} onSelect={() => onChangeRole(r.id)}>
                      {r.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuPortal>
            </DropdownMenuSub>
            <DropdownMenuItem onSelect={onSuspend}>
              {row.status === "suspended" ? "Reactivate" : "Suspend"}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onTransfer} disabled={isViewer}>
              Transfer ownership
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={onRemove}
              className="text-destructive focus:text-destructive"
              disabled={isViewer}
            >
              Remove
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
