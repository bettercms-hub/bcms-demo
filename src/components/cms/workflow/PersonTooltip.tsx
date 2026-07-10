/**
 * PersonTooltip — hover card for any member avatar: photo/initials, full
 * name, and role. One shared wrapper so every avatar in the app (presence,
 * workflow assignees, comments, revisions) shows the same information.
 */
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { initialsOf, toneFor } from "@/lib/cms/avatar-color";
import type { Member, WorkspaceRole } from "@/lib/cms/types";

const ROLE_LABEL: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  developer: "Developer",
  content_manager: "Content manager",
  editor: "Editor",
  viewer: "Viewer",
};

export function roleLabel(role?: WorkspaceRole): string | undefined {
  return role ? (ROLE_LABEL[role] ?? role) : undefined;
}

export function PersonTooltip({
  name,
  role,
  avatarUrl,
  initials,
  color,
  children,
}: {
  name: string;
  role?: WorkspaceRole | string;
  avatarUrl?: string;
  initials: string;
  color: string;
  children: React.ReactNode;
}) {
  const label = typeof role === "string" && !(role in ROLE_LABEL) ? role : roleLabel(role as WorkspaceRole);
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="top" className="flex items-center gap-2 px-2 py-1.5">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-7 w-7 shrink-0 rounded-full object-cover" />
        ) : (
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {initials}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-medium leading-tight text-foreground">{name}</span>
          {label && <span className="block truncate text-[11px] leading-tight text-muted-foreground">{label}</span>}
        </span>
      </TooltipContent>
    </Tooltip>
  );
}

export function PersonTooltipForMember({ member, children }: { member: Member; children: React.ReactNode }) {
  return (
    <PersonTooltip name={member.name} role={member.role} avatarUrl={member.avatarUrl} initials={initialsOf(member.name)} color={toneFor(member.id)}>
      {children}
    </PersonTooltip>
  );
}
