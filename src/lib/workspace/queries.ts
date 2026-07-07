/**
 * Workspace data layer — wraps Supabase reads/writes behind React Query hooks.
 *
 * On first load for a given workspace slug, `ensureWorkspace` upserts the
 * workspace row and the current viewer as the Owner member, so the rest of
 * the UI has something to work with.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentUserProfile } from "./current-user";
import type { Capabilities } from "./capabilities";
import { fullCapabilities } from "./capabilities";
import { getWorkspaceBySlug } from "@/lib/cms/use-cms";

// ---------- Types ----------
export interface WorkspaceRow {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  accent_color: string | null;
  owner_user_ref: string | null;
}

export interface RoleRow {
  id: string;
  workspace_id: string | null;
  key: string;
  name: string;
  description: string | null;
  is_builtin: boolean;
  color: string | null;
  capabilities: Capabilities;
}

export interface MemberRow {
  id: string;
  workspace_id: string;
  user_ref: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role_id: string | null;
  status: string;
  last_active_at: string | null;
  invited_at: string | null;
  created_at: string;
}

export interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role_id: string | null;
  project_slugs: string[];
  token: string;
  status: string;
  expires_at: string;
  invited_by_user_ref: string | null;
  created_at: string;
}

export interface ProjectAccessRow {
  id: string;
  workspace_id: string;
  project_slug: string;
  member_id: string;
  role_id: string;
  created_at: string;
}

// ---------- Keys ----------
const k = {
  workspace: (slug: string) => ["ws", slug] as const,
  roles: (workspaceId: string | undefined) => ["ws-roles", workspaceId] as const,
  members: (workspaceId: string | undefined) => ["ws-members", workspaceId] as const,
  invitations: (workspaceId: string | undefined) => ["ws-invitations", workspaceId] as const,
  access: (workspaceId: string | undefined, projectSlug?: string) =>
    ["ws-access", workspaceId, projectSlug ?? "_all"] as const,
};

// ---------- Ensure workspace exists ----------
async function ensureWorkspace(slug: string): Promise<WorkspaceRow> {
  // Try to fetch.
  const { data: existing } = await supabase
    .from("workspace")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  const viewer = getCurrentUserProfile();
  const mock = getWorkspaceBySlug(slug);

  if (existing) {
    // Make sure viewer is a member as Owner.
    await ensureOwnerMember(existing.id, viewer);
    await seedWorkspaceDemoData(existing.id);
    return existing as WorkspaceRow;
  }

  const { data: inserted, error } = await supabase
    .from("workspace")
    .insert({
      slug,
      name: mock?.name ?? slug,
      owner_user_ref: viewer.ref,
    })
    .select("*")
    .single();

  if (error || !inserted) throw error ?? new Error("Failed to create workspace");
  await ensureOwnerMember(inserted.id, viewer);
  await seedWorkspaceDemoData(inserted.id);
  return inserted as WorkspaceRow;
}

async function ensureOwnerMember(
  workspaceId: string,
  viewer: ReturnType<typeof getCurrentUserProfile>,
) {
  const { data: existing } = await supabase
    .from("workspace_member")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("user_ref", viewer.ref)
    .maybeSingle();
  if (existing) return;

  const { data: existingByEmail } = await supabase
    .from("workspace_member")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("email", viewer.email)
    .limit(1)
    .maybeSingle();
  if (existingByEmail) {
    await supabase
      .from("workspace_member")
      .update({
        user_ref: viewer.ref,
        name: viewer.name,
        last_active_at: new Date().toISOString(),
      })
      .eq("id", existingByEmail.id);
    return;
  }

  const { data: ownerRole } = await supabase
    .from("workspace_role")
    .select("id")
    .is("workspace_id", null)
    .eq("key", "owner")
    .maybeSingle();

  await supabase.from("workspace_member").insert({
    workspace_id: workspaceId,
    user_ref: viewer.ref,
    name: viewer.name,
    email: viewer.email,
    role_id: ownerRole?.id ?? null,
    status: "active",
    last_active_at: new Date().toISOString(),
  });
}

// ---------- Seed demo members + invitations (idempotent) ----------
const DEMO_MEMBERS: Array<{
  user_ref: string;
  name: string;
  email: string;
  roleKey: string;
  status: "active" | "invited" | "suspended";
  lastActiveDaysAgo?: number;
}> = [
  { user_ref: "seed:m_alex", name: "Alex Rivera", email: "alex@acme.co", roleKey: "site_manager", status: "active", lastActiveDaysAgo: 1 },
  { user_ref: "seed:m_priya", name: "Priya Singh", email: "priya@acme.co", roleKey: "content_editor", status: "active", lastActiveDaysAgo: 2 },
  { user_ref: "seed:m_devon", name: "Devon Lee", email: "devon@acme.co", roleKey: "developer", status: "active", lastActiveDaysAgo: 3 },
  { user_ref: "seed:m_marko", name: "Marko Hahn", email: "marko@acme.co", roleKey: "viewer", status: "invited" },
  { user_ref: "seed:m_sam", name: "Sam Okafor", email: "sam@acme.co", roleKey: "marketer", status: "active", lastActiveDaysAgo: 7 },
];

const DEMO_INVITATIONS: Array<{
  email: string;
  roleKey: string;
  projectSlugs: string[];
  expiresDays: number;
}> = [
  { email: "lena@partner.io", roleKey: "content_editor", projectSlugs: [], expiresDays: 7 },
  { email: "jordan@northwind.dev", roleKey: "developer", projectSlugs: ["northwind"], expiresDays: 10 },
];

async function seedWorkspaceDemoData(workspaceId: string) {
  const { data: existingSeedMembers } = await supabase
    .from("workspace_member")
    .select("user_ref")
    .eq("workspace_id", workspaceId);
  const existingSeedRefs = new Set(
    (existingSeedMembers ?? []).map((r) => r.user_ref as string),
  );

  const { data: builtinRoles } = await supabase
    .from("workspace_role")
    .select("id,key")
    .is("workspace_id", null);
  const roleByKey = new Map<string, string>(
    (builtinRoles ?? []).map((r) => [r.key as string, r.id as string]),
  );

  const now = Date.now();
  const memberRows = DEMO_MEMBERS.filter((m) => !existingSeedRefs.has(m.user_ref)).map((m) => ({
    workspace_id: workspaceId,
    user_ref: m.user_ref,
    name: m.name,
    email: m.email,
    role_id: roleByKey.get(m.roleKey) ?? null,
    status: m.status,
    last_active_at:
      m.lastActiveDaysAgo !== undefined
        ? new Date(now - m.lastActiveDaysAgo * 86400000).toISOString()
        : null,
    invited_at: m.status === "invited" ? new Date(now - 2 * 86400000).toISOString() : null,
  }));

  // Insert members ignoring duplicates (unique on workspace_id,user_ref enforced by app guard).
  if (memberRows.length > 0) {
    await supabase.from("workspace_member").insert(memberRows);
  }

  const { data: existingInv } = await supabase
    .from("workspace_invitation")
    .select("email")
    .eq("workspace_id", workspaceId);
  const haveEmails = new Set((existingInv ?? []).map((r) => r.email as string));

  const inviteRows = DEMO_INVITATIONS.filter((i) => !haveEmails.has(i.email)).map((i) => ({
    workspace_id: workspaceId,
    email: i.email,
    role_id: roleByKey.get(i.roleKey) ?? null,
    project_slugs: i.projectSlugs,
    token: `demo_${Math.random().toString(36).slice(2, 12)}`,
    status: "pending",
    expires_at: new Date(now + i.expiresDays * 86400000).toISOString(),
  }));
  if (inviteRows.length > 0) {
    await supabase.from("workspace_invitation").insert(inviteRows);
  }
}


// ---------- Workspace hook ----------
export function useWorkspaceRow(slug: string) {
  return useQuery({
    queryKey: k.workspace(slug),
    queryFn: () => ensureWorkspace(slug),
    staleTime: 30_000,
  });
}

// ---------- Roles ----------
export function useRoles(workspaceId: string | undefined) {
  return useQuery({
    queryKey: k.roles(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<RoleRow[]> => {
      const { data, error } = await supabase
        .from("workspace_role")
        .select("*")
        .or(`workspace_id.is.null,workspace_id.eq.${workspaceId}`)
        .order("is_builtin", { ascending: false })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as RoleRow[];
    },
  });
}

export function useCreateRole(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      description?: string;
      capabilities?: Capabilities;
      color?: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const key = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
      const { data, error } = await supabase
        .from("workspace_role")
        .insert({
          workspace_id: workspaceId,
          key: key || `role_${Date.now()}`,
          name: input.name,
          description: input.description ?? null,
          color: input.color ?? null,
          is_builtin: false,
          capabilities: (input.capabilities ?? fullCapabilities()) as never,
        })
        .select("*")
        .single();
      if (error) throw error;
      return data as unknown as RoleRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.roles(workspaceId) }),
  });
}

export function useUpdateRole(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      description?: string | null;
      capabilities?: Capabilities;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.name !== undefined) patch.name = input.name;
      if (input.description !== undefined) patch.description = input.description;
      if (input.capabilities !== undefined) patch.capabilities = input.capabilities;
      const { error } = await supabase.from("workspace_role").update(patch as never).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.roles(workspaceId) }),
  });
}

export function useDeleteRole(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_role").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k.roles(workspaceId) });
      qc.invalidateQueries({ queryKey: k.members(workspaceId) });
    },
  });
}

// ---------- Members ----------
export function useMembers(workspaceId: string | undefined) {
  return useQuery({
    queryKey: k.members(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<MemberRow[]> => {
      const { data, error } = await supabase
        .from("workspace_member")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const seen = new Set<string>();
      return ((data ?? []) as unknown as MemberRow[]).filter((member) => {
        const key = member.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    },
  });
}

export function useUpdateMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      role_id?: string;
      status?: "active" | "suspended" | "invited";
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.role_id !== undefined) patch.role_id = input.role_id;
      if (input.status !== undefined) patch.status = input.status;
      const { error } = await supabase.from("workspace_member").update(patch as never).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.members(workspaceId) }),
  });
}

export function useRemoveMember(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_member").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.members(workspaceId) }),
  });
}

export function useTransferOwnership(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { newOwnerMemberId: string; newOwnerUserRef: string }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const { data: ownerRole } = await supabase
        .from("workspace_role")
        .select("id")
        .is("workspace_id", null)
        .eq("key", "owner")
        .maybeSingle();
      if (!ownerRole) throw new Error("Owner role missing");
      // Promote new owner.
      await supabase
        .from("workspace_member")
        .update({ role_id: ownerRole.id })
        .eq("id", input.newOwnerMemberId);
      // Update workspace pointer.
      await supabase
        .from("workspace")
        .update({ owner_user_ref: input.newOwnerUserRef })
        .eq("id", workspaceId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: k.members(workspaceId) });
      qc.invalidateQueries();
    },
  });
}

// ---------- Invitations ----------
export function useInvitations(workspaceId: string | undefined) {
  return useQuery({
    queryKey: k.invitations(workspaceId),
    enabled: Boolean(workspaceId),
    queryFn: async (): Promise<InvitationRow[]> => {
      const { data, error } = await supabase
        .from("workspace_invitation")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as InvitationRow[];
    },
  });
}

export function useCreateInvitations(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      emails: string[];
      roleId: string;
      projectSlugs: string[];
    }) => {
      if (!workspaceId) throw new Error("Workspace not ready");
      const viewer = getCurrentUserProfile();
      const rows = input.emails.map((email) => ({
        workspace_id: workspaceId,
        email,
        role_id: input.roleId,
        project_slugs: input.projectSlugs,
        invited_by_user_ref: viewer.ref,
      }));
      const { error } = await supabase.from("workspace_invitation").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.invitations(workspaceId) }),
  });
}

export function useUpdateInvitation(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      status?: "pending" | "cancelled" | "accepted";
      expires_at?: string;
    }) => {
      const patch: Record<string, unknown> = {};
      if (input.status !== undefined) patch.status = input.status;
      if (input.expires_at !== undefined) patch.expires_at = input.expires_at;
      const { error } = await supabase.from("workspace_invitation").update(patch as never).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.invitations(workspaceId) }),
  });
}

export function useDeleteInvitation(workspaceId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_invitation").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.invitations(workspaceId) }),
  });
}

// ---------- Project access overrides ----------
export function useProjectAccess(
  workspaceId: string | undefined,
  projectSlug: string | undefined,
) {
  return useQuery({
    queryKey: k.access(workspaceId, projectSlug),
    enabled: Boolean(workspaceId && projectSlug),
    queryFn: async (): Promise<ProjectAccessRow[]> => {
      const { data, error } = await supabase
        .from("project_member_access")
        .select("*")
        .eq("workspace_id", workspaceId!)
        .eq("project_slug", projectSlug!);
      if (error) throw error;
      return (data ?? []) as unknown as ProjectAccessRow[];
    },
  });
}

export function useSetProjectAccess(
  workspaceId: string | undefined,
  projectSlug: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { memberId: string; roleId: string }) => {
      if (!workspaceId || !projectSlug) throw new Error("Missing scope");
      // Upsert by (project_slug, member_id).
      const { error } = await supabase
        .from("project_member_access")
        .upsert(
          {
            workspace_id: workspaceId,
            project_slug: projectSlug,
            member_id: input.memberId,
            role_id: input.roleId,
          },
          { onConflict: "project_slug,member_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.access(workspaceId, projectSlug) }),
  });
}

export function useRemoveProjectAccess(
  workspaceId: string | undefined,
  projectSlug: string | undefined,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_member_access").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: k.access(workspaceId, projectSlug) }),
  });
}
