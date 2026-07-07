/**
 * Capability model for workspace roles.
 *
 * A role's `capabilities` is a JSON object with grouped boolean flags.
 * Groups and their flags are intentionally enumerated here so the custom-role
 * builder can render them and so client-side gates can `hasCapability(role, "content.publish")`.
 */

export type CapabilityGroupKey =
  | "content"
  | "collections"
  | "media"
  | "publishing"
  | "settings";

export interface CapabilityFlagDef {
  key: string;
  label: string;
  description?: string;
}

export interface CapabilityGroupDef {
  key: CapabilityGroupKey;
  label: string;
  description: string;
  flags: CapabilityFlagDef[];
}

export const CAPABILITY_GROUPS: CapabilityGroupDef[] = [
  {
    key: "content",
    label: "Content",
    description: "Pages, entries, and editing.",
    flags: [
      { key: "view", label: "View", description: "See content in the editor and previews." },
      { key: "edit", label: "Edit", description: "Edit drafts and content fields." },
      { key: "delete", label: "Delete", description: "Delete pages and entries." },
      { key: "publish", label: "Publish", description: "Publish content to production." },
    ],
  },
  {
    key: "collections",
    label: "Collections",
    description: "Structured content models.",
    flags: [
      { key: "view", label: "View" },
      { key: "edit", label: "Edit entries" },
      { key: "schema", label: "Schema", description: "Add, rename, or remove fields." },
      { key: "delete", label: "Delete" },
    ],
  },
  {
    key: "media",
    label: "Media",
    description: "Library, uploads, organization.",
    flags: [
      { key: "upload", label: "Upload" },
      { key: "delete", label: "Delete" },
      { key: "organize", label: "Organize", description: "Create folders, move files, tag." },
    ],
  },
  {
    key: "publishing",
    label: "Publishing",
    description: "Workflow, review, scheduling.",
    flags: [
      { key: "draft", label: "Save draft" },
      { key: "review", label: "Request review" },
      { key: "approve", label: "Approve" },
      { key: "publish", label: "Publish" },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    description: "Workspace and project configuration.",
    flags: [
      { key: "view", label: "View" },
      { key: "edit", label: "Edit general" },
      { key: "domains", label: "Domains" },
      { key: "api", label: "API & webhooks" },
      { key: "security", label: "Security" },
      { key: "permissions", label: "Permissions" },
    ],
  },
];

export type Capabilities = Record<string, Record<string, boolean>>;

export function emptyCapabilities(): Capabilities {
  const out: Capabilities = {};
  for (const g of CAPABILITY_GROUPS) {
    out[g.key] = Object.fromEntries(g.flags.map((f) => [f.key, false]));
  }
  return out;
}

export function fullCapabilities(): Capabilities {
  const out: Capabilities = {};
  for (const g of CAPABILITY_GROUPS) {
    out[g.key] = Object.fromEntries(g.flags.map((f) => [f.key, true]));
  }
  return out;
}

/** Reads `"group.flag"` from a capabilities map (false if missing). */
export function hasCapability(
  caps: Capabilities | null | undefined,
  path: `${CapabilityGroupKey}.${string}`,
): boolean {
  if (!caps) return false;
  const [group, flag] = path.split(".");
  return Boolean(caps[group]?.[flag]);
}

/** Count of enabled flags across all groups. Used for role summary badges. */
export function countEnabled(caps: Capabilities | null | undefined): number {
  if (!caps) return 0;
  let n = 0;
  for (const g of Object.values(caps)) {
    for (const v of Object.values(g)) if (v) n++;
  }
  return n;
}

/** Total flag count across all groups. */
export function totalCapabilities(): number {
  return CAPABILITY_GROUPS.reduce((n, g) => n + g.flags.length, 0);
}
