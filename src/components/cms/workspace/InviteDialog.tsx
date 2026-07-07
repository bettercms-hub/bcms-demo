import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateInvitations, type RoleRow } from "@/lib/workspace/queries";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string | undefined;
  roles: RoleRow[];
  projects: { slug: string; name: string }[];
  defaultRoleKey?: string;
}

export function InviteDialog({
  open,
  onOpenChange,
  workspaceId,
  roles,
  projects,
  defaultRoleKey = "content_editor",
}: Props) {
  const [emailsRaw, setEmailsRaw] = useState("");
  const [roleId, setRoleId] = useState<string | undefined>();
  const [projectSlugs, setProjectSlugs] = useState<string[]>([]);
  const create = useCreateInvitations(workspaceId);

  // Default role once roles load.
  const defaultRole = useMemo(
    () => roles.find((r) => r.key === defaultRoleKey) ?? roles[0],
    [roles, defaultRoleKey],
  );
  const currentRoleId = roleId ?? defaultRole?.id;

  const emails = useMemo(
    () =>
      emailsRaw
        .split(/[\s,;]+/)
        .map((e) => e.trim())
        .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
    [emailsRaw],
  );

  const toggleProject = (slug: string) => {
    setProjectSlugs((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  };

  const reset = () => {
    setEmailsRaw("");
    setRoleId(undefined);
    setProjectSlugs([]);
  };

  const handleSend = async () => {
    if (!currentRoleId || emails.length === 0) return;
    try {
      await create.mutateAsync({ emails, roleId: currentRoleId, projectSlugs });
      toast.success(
        `Sent ${emails.length} invitation${emails.length === 1 ? "" : "s"}`,
      );
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error("Failed to send invitations", { description: (e as Error).message });
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Invite teammates</DialogTitle>
          <DialogDescription>
            Add multiple emails, choose a workspace role, and optionally scope to projects.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-1.5">
            <Label htmlFor="emails">Emails</Label>
            <textarea
              id="emails"
              value={emailsRaw}
              onChange={(e) => setEmailsRaw(e.target.value)}
              placeholder="alex@example.com, sam@example.com"
              rows={3}
              className="rounded-md border border-border bg-background px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <div className="text-[11.5px] text-muted-foreground">
              {emails.length === 0
                ? "Separate with commas, spaces, or new lines."
                : `${emails.length} valid email${emails.length === 1 ? "" : "s"} detected.`}
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label>Workspace role</Label>
            <Select value={currentRoleId} onValueChange={setRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                    {r.is_builtin ? "" : " (custom)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-1.5">
            <Label>Project access</Label>
            <div className="max-h-[140px] overflow-auto rounded-md border border-border bg-surface p-2">
              {projects.length === 0 && (
                <div className="px-2 py-1 text-[12px] text-muted-foreground">No projects yet.</div>
              )}
              {projects.map((p) => (
                <label
                  key={p.slug}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-[color:var(--color-row-hover)]"
                >
                  <Checkbox
                    checked={projectSlugs.includes(p.slug)}
                    onCheckedChange={() => toggleProject(p.slug)}
                  />
                  <span>{p.name}</span>
                  <span className="ml-auto text-[11px] text-muted-foreground">{p.slug}</span>
                </label>
              ))}
            </div>
            <div className="text-[11.5px] text-muted-foreground">
              Leave empty to grant workspace-wide access only.
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={emails.length === 0 || !currentRoleId || create.isPending}
            onClick={handleSend}
          >
            {create.isPending ? "Sending…" : `Send ${emails.length || ""} invitation${emails.length === 1 ? "" : "s"}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
