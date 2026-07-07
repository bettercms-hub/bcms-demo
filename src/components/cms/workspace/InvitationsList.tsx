import { useMemo, useState } from "react";
import { Copy, RefreshCcw, Send, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateInvitations,
  useDeleteInvitation,
  useInvitations,
  useRoles,
  useUpdateInvitation,
  type InvitationRow,
} from "@/lib/workspace/queries";

interface Props {
  workspaceId: string | undefined;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function relExpires(iso: string) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff < 0) return "expired";
  const d = Math.round(diff / 86400000);
  if (d < 1) return "today";
  if (d === 1) return "in 1 day";
  return `in ${d} days`;
}

export function InvitationsList({ workspaceId }: Props) {
  const { data: roles = [] } = useRoles(workspaceId);
  const { data: invitations = [], isLoading } = useInvitations(workspaceId);
  const update = useUpdateInvitation(workspaceId);
  const remove = useDeleteInvitation(workspaceId);
  const create = useCreateInvitations(workspaceId);

  const defaultRole = useMemo(
    () => roles.find((r) => r.key === "content_editor") ?? roles.find((r) => !r.is_builtin) ?? roles[0],
    [roles],
  );
  const [email, setEmail] = useState("");
  const [roleId, setRoleId] = useState<string | undefined>();
  const currentRoleId = roleId ?? defaultRole?.id;
  const emailValid = EMAIL_RE.test(email.trim());

  const sendInvite = async () => {
    if (!emailValid || !currentRoleId) return;
    try {
      await create.mutateAsync({
        emails: [email.trim()],
        roleId: currentRoleId,
        projectSlugs: [],
      });
      toast.success(`Invitation sent to ${email.trim()}`);
      setEmail("");
    } catch (e) {
      toast.error("Failed to send invitation", { description: (e as Error).message });
    }
  };



  const roleName = (id: string | null) =>
    (id && roles.find((r) => r.id === id)?.name) || "—";

  const copyLink = (inv: InvitationRow) => {
    const url = `${window.location.origin}/invite/${inv.token}`;
    void navigator.clipboard.writeText(url);
    toast.success("Invitation link copied");
  };

  const resend = (inv: InvitationRow) => {
    const expires = new Date(Date.now() + 14 * 86400000).toISOString();
    update
      .mutateAsync({ id: inv.id, status: "pending", expires_at: expires })
      .then(() => toast.success("Invitation refreshed"));
  };

  const pending = invitations.filter((i) => i.status === "pending");
  const other = invitations.filter((i) => i.status !== "pending");

  return (
    <div className="grid gap-8">
      <section className="rounded-md border border-border bg-surface p-4">
        <div className="mb-3">
          <h2 className="text-[14px] font-semibold text-foreground">Invite a teammate</h2>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            Send a mock invitation link. They'll appear in Pending below.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <div className="flex-1">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && emailValid && !create.isPending) void sendInvite();
              }}
              placeholder="teammate@company.com"
              aria-label="Invitee email"
            />
          </div>
          <div className="sm:w-[180px]">
            <Select value={currentRoleId} onValueChange={setRoleId}>
              <SelectTrigger aria-label="Role">
                <SelectValue placeholder="Role" />
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
          <Button
            onClick={() => void sendInvite()}
            disabled={!emailValid || !currentRoleId || create.isPending}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {create.isPending ? "Sending…" : "Send invite"}
          </Button>
        </div>
      </section>

      <Section title="Pending" count={pending.length}>
        <Table>
          {isLoading && <EmptyRow>Loading…</EmptyRow>}
          {!isLoading && pending.length === 0 && (
            <EmptyRow>No pending invitations.</EmptyRow>
          )}
          {pending.map((inv, i) => (
            <Row key={inv.id} divided={i > 0}>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-medium text-foreground">{inv.email}</div>
                <div className="truncate text-[11.5px] text-muted-foreground">
                  Sent {new Date(inv.created_at).toLocaleDateString()} · expires{" "}
                  {relExpires(inv.expires_at)}
                </div>
              </div>
              <div className="text-[12.5px] text-muted-foreground">{roleName(inv.role_id)}</div>
              <div className="text-[12.5px] text-muted-foreground">
                {inv.project_slugs.length === 0
                  ? "Workspace only"
                  : `${inv.project_slugs.length} project${inv.project_slugs.length === 1 ? "" : "s"}`}
              </div>
              <div className="flex items-center justify-end gap-1">
                <IconBtn onClick={() => copyLink(inv)} label="Copy link">
                  <Copy className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn onClick={() => resend(inv)} label="Resend">
                  <RefreshCcw className="h-3.5 w-3.5" />
                </IconBtn>
                <IconBtn
                  onClick={() =>
                    update
                      .mutateAsync({ id: inv.id, status: "cancelled" })
                      .then(() => toast.success("Invitation cancelled"))
                  }
                  label="Cancel"
                  danger
                >
                  <X className="h-3.5 w-3.5" />
                </IconBtn>
              </div>
            </Row>
          ))}
        </Table>
      </Section>

      {other.length > 0 && (
        <Section title="History" count={other.length}>
          <Table>
            {other.map((inv, i) => (
              <Row key={inv.id} divided={i > 0}>
                <div className="min-w-0">
                  <div className="truncate text-[13px] font-medium text-foreground">{inv.email}</div>
                  <div className="truncate text-[11.5px] text-muted-foreground capitalize">
                    {inv.status} · {new Date(inv.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-[12.5px] text-muted-foreground">{roleName(inv.role_id)}</div>
                <div className="text-[12.5px] text-muted-foreground">
                  {inv.project_slugs.length === 0
                    ? "Workspace only"
                    : `${inv.project_slugs.length} project${inv.project_slugs.length === 1 ? "" : "s"}`}
                </div>
                <div className="flex justify-end">
                  <IconBtn
                    onClick={() =>
                      remove
                        .mutateAsync(inv.id)
                        .then(() => toast.success("Invitation deleted"))
                    }
                    label="Delete"
                    danger
                  >
                    <X className="h-3.5 w-3.5" />
                  </IconBtn>
                </div>
              </Row>
            ))}
          </Table>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        {count !== undefined && (
          <span className="text-[12px] text-muted-foreground">{count}</span>
        )}
      </div>
      {children}
    </section>
  );
}

function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-background">
      <div className="grid grid-cols-[2fr_1fr_1fr_160px] gap-3 border-b border-border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <div>Email</div>
        <div>Role</div>
        <div>Access</div>
        <div className="text-right">Actions</div>
      </div>
      {children}
    </div>
  );
}

function Row({ children, divided }: { children: React.ReactNode; divided: boolean }) {
  return (
    <div
      className={`grid grid-cols-[2fr_1fr_1fr_160px] items-center gap-3 px-3 py-2.5 ${divided ? "border-t border-border" : ""}`}
    >
      {children}
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 py-8 text-center text-[13px] text-muted-foreground">{children}</div>
  );
}

function IconBtn({
  children,
  onClick,
  label,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  label: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-[color:var(--color-row-hover)] ${danger ? "hover:text-destructive" : "hover:text-foreground"}`}
    >
      {children}
    </button>
  );
}
