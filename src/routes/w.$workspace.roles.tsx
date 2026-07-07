import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RoleCard } from "@/components/cms/workspace/RoleCard";
import { CapabilityGroupPicker } from "@/components/cms/workspace/CapabilityGroupPicker";
import { WorkspaceSubNav } from "@/components/cms/workspace/WorkspaceSubNav";
import {
  useCreateRole,
  useDeleteRole,
  useMembers,
  useRoles,
  useUpdateRole,
  useWorkspaceRow,
  type RoleRow,
} from "@/lib/workspace/queries";
import {
  emptyCapabilities,
  fullCapabilities,
  type Capabilities,
} from "@/lib/workspace/capabilities";

export const Route = createFileRoute("/w/$workspace/roles")({
  component: Roles,
});

function Roles() {
  const { workspace } = Route.useParams();
  const { data: ws } = useWorkspaceRow(workspace);
  const { data: roles = [], isLoading } = useRoles(ws?.id);
  const { data: members = [] } = useMembers(ws?.id);
  const createRole = useCreateRole(ws?.id);
  const updateRole = useUpdateRole(ws?.id);
  const deleteRole = useDeleteRole(ws?.id);

  const [editing, setEditing] = useState<RoleRow | "new" | null>(null);

  const countByRole = useMemo(() => {
    const m = new Map<string, number>();
    for (const member of members) {
      if (!member.role_id) continue;
      m.set(member.role_id, (m.get(member.role_id) ?? 0) + 1);
    }
    return m;
  }, [members]);

  const builtins = roles.filter((r) => r.is_builtin);
  const customs = roles.filter((r) => !r.is_builtin);

  return (
    <div className="flex min-h-0 flex-1">
      <WorkspaceSubNav wsSlug={workspace} />
      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-[1200px] px-8 py-8">
          <header className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                Workspace
              </div>
              <h1 className="mt-1.5 text-[20px] font-semibold tracking-tight leading-none text-foreground">
                Roles & Permissions
              </h1>
              <p className="mt-1.5 text-[13px] text-muted-foreground">
                Built-in roles cover most teams. Create custom roles from grouped capabilities for specialist workflows.
              </p>
            </div>
            <Button onClick={() => setEditing("new")}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              New custom role
            </Button>
          </header>

          <div className="mb-6 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[12.5px] text-amber-700 dark:text-amber-300">
            <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Permissions are enforced in the UI only. Add sign-in to enforce them on the server.
            </span>
          </div>

          <Section title="Built-in roles" count={builtins.length}>
            {isLoading ? (
              <div className="rounded-md border border-border bg-surface px-4 py-8 text-center text-[13px] text-muted-foreground">
                Loading roles…
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {builtins.map((r) => (
                  <RoleCard key={r.id} role={r} count={countByRole.get(r.id) ?? 0} />
                ))}
              </div>
            )}
          </Section>

          <Section title="Custom roles" count={customs.length}>
            {customs.length === 0 ? (
              <div className="rounded-md border border-dashed border-border bg-surface px-4 py-8 text-center text-[13px] text-muted-foreground">
                No custom roles yet. Create one for specialists like SEO, Localization, or Legal.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {customs.map((r) => (
                  <RoleCard
                    key={r.id}
                    role={r}
                    count={countByRole.get(r.id) ?? 0}
                    onEdit={() => setEditing(r)}
                    onDelete={() => {
                      if (!confirm(`Delete "${r.name}"? Members with this role will be unassigned.`)) return;
                      deleteRole.mutateAsync(r.id).then(() => toast.success("Role deleted"));
                    }}
                  />
                ))}
              </div>
            )}
          </Section>

          <RoleEditor
            target={editing}
            onClose={() => setEditing(null)}
            onCreate={async (input) => {
              await createRole.mutateAsync(input);
              toast.success("Role created");
            }}
            onUpdate={async (id, input) => {
              await updateRole.mutateAsync({ id, ...input });
              toast.success("Role updated");
            }}
          />
        </div>
      </div>
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
    <section className="mb-10">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        {count !== undefined && <span className="text-[12px] text-muted-foreground">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function RoleEditor({
  target,
  onClose,
  onCreate,
  onUpdate,
}: {
  target: RoleRow | "new" | null;
  onClose: () => void;
  onCreate: (input: { name: string; description?: string; capabilities: Capabilities }) => Promise<void>;
  onUpdate: (
    id: string,
    input: { name?: string; description?: string | null; capabilities?: Capabilities },
  ) => Promise<void>;
}) {
  const open = target !== null;
  const isNew = target === "new";
  const role = target && target !== "new" ? target : null;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [caps, setCaps] = useState<Capabilities>(emptyCapabilities());
  const [submitting, setSubmitting] = useState(false);

  // Reset form when target changes.
  useMemo(() => {
    if (isNew) {
      setName("");
      setDescription("");
      setCaps(fullCapabilities());
    } else if (role) {
      setName(role.name);
      setDescription(role.description ?? "");
      setCaps(role.capabilities ?? emptyCapabilities());
    }
  }, [target, isNew, role]);

  const submit = async () => {
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      if (isNew) {
        await onCreate({ name: name.trim(), description: description.trim() || undefined, capabilities: caps });
      } else if (role) {
        await onUpdate(role.id, {
          name: name.trim(),
          description: description.trim() || null,
          capabilities: caps,
        });
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[560px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? "New custom role" : "Edit role"}</SheetTitle>
          <SheetDescription>
            Pick the capabilities this role unlocks across each area.
          </SheetDescription>
        </SheetHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SEO Specialist"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Input
              id="role-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this role is for"
            />
          </div>
          <CapabilityGroupPicker value={caps} onChange={setCaps} />
        </div>
        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!name.trim() || submitting}>
            {submitting ? "Saving…" : isNew ? "Create role" : "Save changes"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
