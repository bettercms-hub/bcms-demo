/**
 * guests-store — Webflow-style agency guests, per host workspace.
 *
 * A host workspace invites an agency or freelancer TEAM as a guest: the
 * whole team collaborates without paid seats, scoped to every project or
 * a chosen few, and never sees confidential workspace settings. The guest
 * team's admin brings teammates up to the host plan's cap.
 *
 * Caps mirror Webflow's model mapped onto our plans:
 * - Self-serve hosts (free / company / agency): 2 guest teams, 5 members each
 * - Managed hosts (team / enterprise): 10 guest teams, 10 members each
 *
 * In-memory for the demo, per workspace in the backend for production.
 */
import { useSyncExternalStore } from "react";
import type { WorkspacePlanId } from "@/lib/cms/types";

export type GuestRole = "developer" | "editor" | "marketer";

export interface GuestMember {
  id: string;
  name: string;
  email: string;
  /** The team's admin invited the rest; the admin is always members[0]. */
  isAdmin?: boolean;
}

export interface GuestTeam {
  id: string;
  hostWorkspaceId: string;
  agencyName: string;
  members: GuestMember[];
  /** "all" grants every project; otherwise an explicit project-id list. */
  scope: "all" | string[];
  role: GuestRole;
  canPublish: boolean;
  status: "invited" | "active";
  invitedAt: string;
}

export function guestLimits(plan: WorkspacePlanId | undefined): { teams: number; membersPerTeam: number; managed: boolean } {
  const managed = plan === "team" || plan === "enterprise";
  return managed ? { teams: 10, membersPerTeam: 10, managed } : { teams: 2, membersPerTeam: 5, managed };
}

export const GUEST_ROLE_INFO: Record<GuestRole, { label: string; blurb: string }> = {
  developer: { label: "Developer", blurb: "Schemas, code and content" },
  editor: { label: "Editor", blurb: "Edit content and drafts" },
  marketer: { label: "Marketer", blurb: "Pages, SEO and publishing surfaces" },
};

/* --------------------------------------------------------------- store */

const byHost = new Map<string, GuestTeam[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

/** The Flowtrix demo workspace (legacy id ws_acme) starts with one active
 *  guest team so the section reads without setup. Others start empty. */
function seed(hostWorkspaceId: string): GuestTeam[] {
  if (hostWorkspaceId !== "ws_acme") return [];
  return [
    {
      id: newId("gt"),
      hostWorkspaceId,
      agencyName: "Northwind Studio",
      members: [
        { id: newId("gm"), name: "Priya Raman", email: "priya@northwind.studio", isAdmin: true },
        { id: newId("gm"), name: "Jon Alvarez", email: "jon@northwind.studio" },
        { id: newId("gm"), name: "Mika Chen", email: "mika@northwind.studio" },
      ],
      scope: "all",
      role: "developer",
      canPublish: true,
      status: "active",
      invitedAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 12).toISOString(),
    },
  ];
}

function ensure(hostWorkspaceId: string): GuestTeam[] {
  let arr = byHost.get(hostWorkspaceId);
  if (!arr) {
    arr = seed(hostWorkspaceId);
    byHost.set(hostWorkspaceId, arr);
  }
  return arr;
}

export function useGuestTeams(hostWorkspaceId: string): GuestTeam[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(hostWorkspaceId),
    () => ensure(hostWorkspaceId),
  );
}

function patch(hostWorkspaceId: string, next: GuestTeam[]) {
  byHost.set(hostWorkspaceId, next);
  emit();
}

export const guestActions = {
  invite(
    hostWorkspaceId: string,
    input: { agencyName: string; adminName: string; adminEmail: string; scope: "all" | string[]; role: GuestRole; canPublish: boolean },
  ): GuestTeam {
    const team: GuestTeam = {
      id: newId("gt"),
      hostWorkspaceId,
      agencyName: input.agencyName.trim(),
      members: [{ id: newId("gm"), name: input.adminName.trim(), email: input.adminEmail.trim(), isAdmin: true }],
      scope: input.scope,
      role: input.role,
      canPublish: input.canPublish,
      status: "invited",
      invitedAt: new Date().toISOString(),
    };
    patch(hostWorkspaceId, [...ensure(hostWorkspaceId), team]);
    return team;
  },
  /** Demo shortcut: mark an invited team active, as if the agency accepted. */
  markActive(hostWorkspaceId: string, teamId: string) {
    patch(
      hostWorkspaceId,
      ensure(hostWorkspaceId).map((t) => (t.id === teamId ? { ...t, status: "active" as const } : t)),
    );
  },
  updateAccess(hostWorkspaceId: string, teamId: string, input: Partial<Pick<GuestTeam, "scope" | "role" | "canPublish">>) {
    patch(
      hostWorkspaceId,
      ensure(hostWorkspaceId).map((t) => (t.id === teamId ? { ...t, ...input } : t)),
    );
  },
  addMember(hostWorkspaceId: string, teamId: string, input: { name: string; email: string }) {
    patch(
      hostWorkspaceId,
      ensure(hostWorkspaceId).map((t) =>
        t.id === teamId
          ? { ...t, members: [...t.members, { id: newId("gm"), name: input.name.trim(), email: input.email.trim() }] }
          : t,
      ),
    );
  },
  removeMember(hostWorkspaceId: string, teamId: string, memberId: string) {
    patch(
      hostWorkspaceId,
      ensure(hostWorkspaceId).map((t) =>
        t.id === teamId ? { ...t, members: t.members.filter((m) => m.id !== memberId || m.isAdmin) } : t,
      ),
    );
  },
  removeTeam(hostWorkspaceId: string, teamId: string) {
    patch(hostWorkspaceId, ensure(hostWorkspaceId).filter((t) => t.id !== teamId));
  },
};
