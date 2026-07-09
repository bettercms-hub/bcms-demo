/**
 * Mutable in-memory CMS store.
 *
 * Phase-1 wraps the seed data with a tiny subscribe/snapshot store. Every
 * mutating action records an audit entry via `recordAudit`. Slices are
 * intentionally pure zustand-style — no network — so a future Postgres
 * adapter can drop in unchanged.
 */

import {
  apiKeys as seedApiKeys,
  auditLog as seedAudit,
  backups as seedBackups,
  collections as seedCollections,
  components as seedComponents,
  customCodeBlocks as seedCustomCode,
  domains as seedDomains,
  entries as seedEntries,
  environmentVariables as seedEnv,
  integrations as seedIntegrations,
  invitations as seedInvitations,
  invoices as seedInvoices,
  media as seedMedia,
  mediaFolders as seedMediaFolders,
  members as seedMembers,
  notifications as seedNotifications,
  pageRevisions as seedRevisions,
  pages as seedPages,
  plans as seedPlans,
  projects as seedProjects,
  redirects as seedRedirects,
  schemas as seedSchemas,
  sections as seedSections,
  siteEnvironments as seedSiteEnv,
  siteMembers as seedSiteMembers,
  subscriptions as seedSubs,
  usageMetrics as seedUsage,
  webhookDeliveries as seedWebhookDeliveries,
  webhooks as seedWebhooks,
  websites as seedWebsites,
  workspaces as seedWorkspaces,
} from "./mock-data";
import type {
  ApiKey,
  AuditLogEntry,
  Backup,
  Collection,
  ComponentMaster,
  CustomCodeBlock,
  CustomCodeLanguage,
  CustomCodeLocation,
  Domain,
  Entry,
  EntryComment,
  EnvScope,
  EnvironmentVariable,
  Integration,
  Invitation,
  Invoice,
  MediaAsset,
  MediaFolder,
  Member,
  Notification,
  Page,
  PagePublishedSnapshot,
  PageRevision,
  Plan,
  Project,
  ProjectKind,
  ProjectFramework,
  PublishState,
  Redirect,
  Revision,
  Schema,
  SchemaField,
  SchemaFieldGroup,
  SchemaFieldType,
  SchemaFieldValidation,
  Section,
  SectionKind,
  SiteEnvironment,
  SiteMember,
  SiteRole,
  Subscription,
  UsageMetric,
  Webhook,
  WebhookDelivery,
  WebhookEvent,
  Website,
  Workspace,
  WorkspaceRole,
} from "./types";
import { buildEntrySnapshot, buildPageSnapshot } from "./snapshots";
import { canTransition } from "./publishing";
import { useMemo, useRef, useSyncExternalStore } from "react";
import { buildProjectTree } from "./tree";
import { seedBlocksFromProps } from "./blocks/seed-from-props";
import {
  addBlock,
  duplicateBlock,
  insertBlockAt,
  moveBlock,
  moveBlockTo,
  removeBlock,
  updateBlockProps,
  wrapBlock,
  transformBlock,
  type BlockPath,
} from "./blocks/operations";

import type { Block, BlockKind } from "./types";

interface State {
  workspaces: Workspace[];
  members: Member[];
  invitations: Invitation[];
  projects: Project[];
  websites: Website[];
  pages: Page[];
  pageRevisions: PageRevision[];
  sections: Section[];
  components: ComponentMaster[];
  schemas: Schema[];
  collections: Collection[];
  entries: Entry[];
  media: MediaAsset[];
  mediaFolders: MediaFolder[];
  apiKeys: ApiKey[];
  webhooks: Webhook[];
  webhookDeliveries: WebhookDelivery[];
  domains: Domain[];
  integrations: Integration[];
  auditLog: AuditLogEntry[];
  notifications: Notification[];
  plans: Plan[];
  subscriptions: Subscription[];
  invoices: Invoice[];
  usageMetrics: UsageMetric[];
  envVars: EnvironmentVariable[];
  redirects: Redirect[];
  customCode: CustomCodeBlock[];
  backups: Backup[];
  siteEnvironments: SiteEnvironment[];
  siteMembers: SiteMember[];
  revisions: Revision[];
  comments: EntryComment[];
}

let state: State = {
  workspaces: structuredClone(seedWorkspaces),
  members: structuredClone(seedMembers),
  invitations: structuredClone(seedInvitations),
  projects: structuredClone(seedProjects),
  websites: structuredClone(seedWebsites),
  pages: structuredClone(seedPages),
  pageRevisions: structuredClone(seedRevisions),
  sections: structuredClone(seedSections),
  components: structuredClone(seedComponents),
  schemas: structuredClone(seedSchemas),
  collections: structuredClone(seedCollections),
  entries: structuredClone(seedEntries),
  media: structuredClone(seedMedia),
  mediaFolders: structuredClone(seedMediaFolders),
  apiKeys: structuredClone(seedApiKeys),
  webhooks: structuredClone(seedWebhooks),
  webhookDeliveries: structuredClone(seedWebhookDeliveries),
  domains: structuredClone(seedDomains),
  integrations: structuredClone(seedIntegrations),
  auditLog: structuredClone(seedAudit),
  notifications: structuredClone(seedNotifications),
  plans: structuredClone(seedPlans),
  subscriptions: structuredClone(seedSubs),
  invoices: structuredClone(seedInvoices),
  usageMetrics: structuredClone(seedUsage),
  envVars: structuredClone(seedEnv),
  redirects: structuredClone(seedRedirects),
  customCode: structuredClone(seedCustomCode),
  backups: structuredClone(seedBackups),
  siteEnvironments: structuredClone(seedSiteEnv),
  siteMembers: structuredClone(seedSiteMembers),
  revisions: [],
  comments: [],
};

// Seed `Section.blocks` from legacy props for any section that doesn't
// already declare blocks. Runs once before snapshot seeding so the
// published snapshot also captures the seeded block tree.
(function seedBlocks() {
  state.sections = state.sections.map((s) =>
    s.blocks && s.blocks.length > 0 ? s : { ...s, blocks: seedBlocksFromProps(s) },
  );
})();

// Seed published snapshots for mock pages so Draft/Published comparison is
// meaningful out of the box. Mutates state in place — runs once at module load
// before any listeners attach.
(function seedSnapshots() {
  const now = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
  const initialRevisions: Revision[] = [];
  state.pages = state.pages.map((page) => {
    const sections = page.sectionIds
      .map((id) => state.sections.find((s) => s.id === id))
      .filter(Boolean) as Section[];
    // Clone snapshot sections; tweak first heading on first page so a diff appears.
    const snapshotSections = sections.map((s, i) =>
      i === 0 && page === state.pages[0]
        ? { ...structuredClone(s), props: { ...s.props, heading: typeof s.props.heading === "string" ? `${s.props.heading} (v1)` : s.props.heading } }
        : structuredClone(s),
    );
    const { publishedSnapshot: _ignore, ...pageCore } = page;
    void _ignore;
    const snapshot = { capturedAt: now, page: pageCore, sections: snapshotSections };
    const revId = `rv_seed_${page.id}`;
    initialRevisions.push({
      id: revId,
      ownerKind: "page",
      ownerId: page.id,
      createdAt: now,
      createdBy: "m_jane",
      label: "Initial publish",
      snapshot,
    });
    return {
      ...page,
      publishedSnapshot: snapshot,
      lastPublishedAt: page.publishState === "published" ? now : page.lastPublishedAt,
      revisionIds: [revId],
    };
  });
  state.entries = state.entries.map((entry) => {
    const { publishedSnapshot: _ignore, ...entryCore } = entry;
    void _ignore;
    const snapshot = { capturedAt: now, entry: entryCore };
    const revId = `rv_seed_${entry.id}`;
    initialRevisions.push({
      id: revId,
      ownerKind: "entry",
      ownerId: entry.id,
      createdAt: now,
      createdBy: "m_jane",
      label: "Initial publish",
      snapshot,
    });
    return {
      ...entry,
      publishedSnapshot: snapshot,
      lastPublishedAt: entry.status === "published" ? now : entry.lastPublishedAt,
      revisionIds: [revId],
    };
  });
  state.revisions = initialRevisions;
})();

// ---------- Workspace identity persistence ----------
// Prototype-grade: workspace name/slug/logo edits are saved to localStorage so
// they survive reloads. Swap this for real API calls when a backend exists.
const WS_OVERRIDES_KEY = "bettercms.workspace-overrides.v1";
type WorkspaceOverride = { name?: string; slug?: string; logoUrl?: string };

function loadWorkspaceOverrides(): Record<string, WorkspaceOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(WS_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, WorkspaceOverride>) : {};
  } catch {
    return {};
  }
}

function persistWorkspaceOverrides() {
  if (typeof window === "undefined") return;
  const overrides: Record<string, WorkspaceOverride> = {};
  for (const w of state.workspaces) {
    const seed = seedWorkspaces.find((s) => s.id === w.id);
    const o: WorkspaceOverride = {};
    if (!seed || w.name !== seed.name) o.name = w.name;
    if (!seed || w.slug !== seed.slug) o.slug = w.slug;
    if (w.logoUrl) o.logoUrl = w.logoUrl;
    if (Object.keys(o).length > 0) overrides[w.id] = o;
  }
  try {
    window.localStorage.setItem(WS_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    /* storage full / unavailable — ignore */
  }
}

// Apply any saved overrides at module load (client only). Content pages render
// client-side after the auth gate, so this can't cause a hydration mismatch.
(function applyWorkspaceOverrides() {
  const overrides = loadWorkspaceOverrides();
  if (Object.keys(overrides).length === 0) return;
  state.workspaces = state.workspaces.map((w) =>
    overrides[w.id] ? { ...w, ...overrides[w.id] } : w,
  );
})();

// ---------- Created-project persistence ----------
// Projects made via the New Project wizard are saved to localStorage so they
// survive reloads. Swap for API calls when a backend exists.
const CREATED_PROJECTS_KEY = "bettercms.created-projects.v1";

function loadCreatedProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CREATED_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as Project[]) : [];
  } catch {
    return [];
  }
}

function persistCreatedProjects() {
  if (typeof window === "undefined") return;
  const seedIds = new Set(seedProjects.map((p) => p.id));
  try {
    window.localStorage.setItem(
      CREATED_PROJECTS_KEY,
      JSON.stringify(state.projects.filter((p) => !seedIds.has(p.id))),
    );
  } catch {
    /* ignore */
  }
}

(function applyCreatedProjects() {
  const created = loadCreatedProjects();
  if (created.length === 0) return;
  const existing = new Set(state.projects.map((p) => p.id));
  const fresh = created.filter((p) => !existing.has(p.id));
  if (fresh.length) state.projects = [...fresh, ...state.projects];
})();

// Scheduler tick — promotes scheduled pages/entries when their scheduledAt arrives.
if (typeof window !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const duePages = state.pages.filter(
      (p) => p.publishState === "scheduled" && p.scheduledAt && new Date(p.scheduledAt).getTime() <= now,
    );
    const dueEntries = state.entries.filter(
      (e) => e.status === "scheduled" && e.scheduledAt && new Date(e.scheduledAt).getTime() <= now,
    );
    for (const p of duePages) pageActions.publish(p.id);
    for (const e of dueEntries) entryActions.publish(e.id);
  }, 30_000);
}

const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};

function set(updater: (s: State) => State) {
  state = updater(state);
  emit();
}

const getSnapshot = () => state;

/** Synchronous state read for non-React modules (agent simulation, scripts). */
export function getCMSState(): State {
  return state;
}

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (!Object.is(a[i], b[i])) return false;
    return true;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object);
    const bk = Object.keys(b as object);
    if (ak.length !== bk.length) return false;
    for (const k of ak) {
      if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
    }
    return true;
  }
  return false;
}

const UNSET = Symbol("unset");

export function useCMS<T>(selector: (s: State) => T): T {
  const ref = useRef<T | typeof UNSET>(UNSET);
  const getCached = () => {
    const next = selector(getSnapshot());
    if (ref.current === UNSET || !shallowEqual(ref.current, next)) ref.current = next;
    return ref.current as T;
  };
  return useSyncExternalStore(subscribe, getCached, getCached);
}

export function useCMSVersion(): number {
  return useSyncExternalStore(subscribe, () => version, () => version);
}

export function useProjectTree(workspaceSlug: string, projectSlug: string) {
  const v = useCMSVersion();
  return useMemo(() => buildProjectTree(workspaceSlug, projectSlug), [v, workspaceSlug, projectSlug]);
}

// ---------- Selectors ----------

export const select = {
  workspaceBySlug: (slug: string) => state.workspaces.find((w) => w.slug === slug),
  projectBySlug: (wsSlug: string, prSlug: string) => {
    const ws = state.workspaces.find((w) => w.slug === wsSlug);
    if (!ws) return undefined;
    return state.projects.find((p) => p.workspaceId === ws.id && p.slug === prSlug);
  },
  websiteForProject: (projectId: string) => state.websites.find((w) => w.projectId === projectId),
  page: (id: string) => state.pages.find((p) => p.id === id),
  section: (id: string) => state.sections.find((s) => s.id === id),
  component: (id: string) => state.components.find((c) => c.id === id),
  collection: (id: string) => state.collections.find((c) => c.id === id),
  entry: (id: string) => state.entries.find((e) => e.id === id),
  schema: (id: string) => state.schemas.find((s) => s.id === id),
  schemaForOwner: (ownerId: string) => state.schemas.find((s) => s.ownerId === ownerId),
  media: (id: string) => state.media.find((m) => m.id === id),
  member: (id: string) => state.members.find((m) => m.id === id),
  sectionsForPage: (pageId: string) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return [];
    return page.sectionIds.map((id) => state.sections.find((s) => s.id === id)).filter(Boolean) as Section[];
  },
  entriesForCollection: (collectionId: string) =>
    state.entries.filter((e) => e.collectionId === collectionId),
};

// ---------- Workspace actions ----------

export const workspaceActions = {
  /** Create a workspace (onboarding + the switcher's Create workspace). */
  create(input: { name: string }): Workspace {
    const base =
      input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "") || "workspace";
    let slug = base;
    let n = 2;
    while (state.workspaces.some((w) => w.slug === slug)) slug = `${base}-${n++}`;
    const ws: Workspace = {
      id: newId("ws"),
      slug,
      name: input.name.trim(),
      projectIds: [],
      memberIds: [],
      createdAt: new Date().toISOString(),
      workspacePlan: "free",
    };
    set((s) => ({ ...s, workspaces: [...s.workspaces, ws] }));
    recordAudit(ws.id, "workspace.created", "workspace", ws.name);
    return ws;
  },
  /** Update a workspace's identity (name / slug / logo) and persist it. */
  update(id: string, patch: Partial<Pick<Workspace, "name" | "slug" | "logoUrl">>) {
    set((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, ...patch } : w)),
    }));
    persistWorkspaceOverrides();
    recordAudit(id, "settings.updated", "workspace", patch.name);
  },
  /** True if `slug` is already used by a different workspace. */
  slugTaken(slug: string, exceptId?: string) {
    return state.workspaces.some((w) => w.slug === slug && w.id !== exceptId);
  },
  /** Demo plan change. Updates the workspace plan so the billing total follows. */
  setWorkspacePlan(id: string, plan: NonNullable<Workspace["workspacePlan"]>) {
    set((s) => ({
      ...s,
      workspaces: s.workspaces.map((w) => (w.id === id ? { ...w, workspacePlan: plan } : w)),
    }));
    recordAudit(id, "workspace.plan_changed", "workspace", plan);
  },
};

// ---------- Project actions ----------

export const projectActions = {
  /** Create a new project (from the New Project wizard) and persist it. */
  create(input: {
    workspaceId: string;
    name: string;
    kind: ProjectKind;
    framework?: ProjectFramework;
    source?: "github" | "zip" | "template";
    repo?: string;
  }): Project {
    const base =
      input.name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
    let slug = base;
    let n = 2;
    while (state.projects.some((p) => p.workspaceId === input.workspaceId && p.slug === slug)) {
      slug = `${base}-${n++}`;
    }
    const project: Project = {
      id: newId("pr"),
      slug,
      name: input.name.trim(),
      workspaceId: input.workspaceId,
      websiteId: "",
      collectionIds: [],
      componentIds: [],
      mediaIds: [],
      updatedAt: new Date().toISOString(),
      publishState: input.kind === "managed" ? "draft" : "published",
      kind: input.kind,
      framework: input.framework,
      source: input.source,
      repo: input.repo,
    };
    set((s) => ({
      ...s,
      projects: [project, ...s.projects],
      workspaces: s.workspaces.map((w) =>
        w.id === input.workspaceId ? { ...w, projectIds: [project.id, ...w.projectIds] } : w,
      ),
    }));
    persistCreatedProjects();
    recordAudit(input.workspaceId, "project.created", "project", project.name, project.id);
    return project;
  },
  /**
   * Clone a project into a workspace (from a shared template link). Copies
   * the project shell plus its collections, schemas and entries under fresh
   * ids; pages are copied separately by the caller (they live in the pages
   * store). The clone starts on the free site plan, unpublished.
   */
  clone(sourceProjectId: string, targetWorkspaceId: string, name?: string): Project | undefined {
    const source = state.projects.find((p) => p.id === sourceProjectId);
    const target = state.workspaces.find((w) => w.id === targetWorkspaceId);
    if (!source || !target) return undefined;

    const cloneName = (name ?? `${source.name} copy`).trim();
    const base =
      cloneName
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, "-")
        .replace(/-{2,}/g, "-")
        .replace(/^-+|-+$/g, "") || "project";
    let slug = base;
    let n = 2;
    while (state.projects.some((p) => p.workspaceId === targetWorkspaceId && p.slug === slug)) slug = `${base}-${n++}`;

    const newProjectId = newId("pr");

    // Clone collections + their schemas + entries under new ids.
    const srcCollections = state.collections.filter((c) => c.projectId === sourceProjectId);
    const newSchemas: Schema[] = [];
    const newCollections: Collection[] = [];
    const newEntries: Entry[] = [];
    for (const col of srcCollections) {
      const srcSchema = state.schemas.find((s) => s.id === col.schemaId);
      const newSchemaId = newId("sch");
      if (srcSchema) newSchemas.push({ ...structuredClone(srcSchema), id: newSchemaId, ownerId: `${newProjectId}:${col.slug}` });
      const srcEntries = state.entries.filter((e) => e.collectionId === col.id);
      const newColId = newId("col");
      const entryIdMap = new Map<string, string>();
      for (const e of srcEntries) {
        const ne = { ...structuredClone(e), id: newId("ent"), collectionId: newColId };
        entryIdMap.set(e.id, ne.id);
        newEntries.push(ne);
      }
      newCollections.push({
        ...structuredClone(col),
        id: newColId,
        projectId: newProjectId,
        schemaId: srcSchema ? newSchemaId : col.schemaId,
        entryIds: (col.entryIds ?? []).map((id) => entryIdMap.get(id) ?? id).filter(Boolean),
      });
    }

    const project: Project = {
      ...structuredClone(source),
      id: newProjectId,
      slug,
      name: cloneName,
      workspaceId: targetWorkspaceId,
      websiteId: "",
      collectionIds: newCollections.map((c) => c.id),
      componentIds: [],
      mediaIds: [],
      sitePlan: "free",
      publishState: "draft",
      clientSite: false,
      updatedAt: new Date().toISOString(),
    };

    set((s) => ({
      ...s,
      projects: [project, ...s.projects],
      schemas: [...s.schemas, ...newSchemas],
      collections: [...s.collections, ...newCollections],
      entries: [...s.entries, ...newEntries],
      workspaces: s.workspaces.map((w) =>
        w.id === targetWorkspaceId ? { ...w, projectIds: [project.id, ...w.projectIds] } : w,
      ),
    }));
    persistCreatedProjects();
    recordAudit(targetWorkspaceId, "project.cloned", "project", `${cloneName} from ${source.name}`, project.id);
    return project;
  },
  /**
   * Move a project to another workspace (Webflow-style transfer). Content,
   * pages, schemas and media travel with the project; the site plan resets
   * to the base tier and the slug dedupes against the destination.
   */
  transfer(projectId: string, targetWorkspaceId: string) {
    const project = state.projects.find((p) => p.id === projectId);
    const target = state.workspaces.find((w) => w.id === targetWorkspaceId);
    if (!project || !target || project.workspaceId === targetWorkspaceId) return;
    const from = state.workspaces.find((w) => w.id === project.workspaceId);
    let slug = project.slug;
    let n = 2;
    while (state.projects.some((p) => p.id !== projectId && p.workspaceId === targetWorkspaceId && p.slug === slug)) {
      slug = `${project.slug}-${n++}`;
    }
    set((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, workspaceId: targetWorkspaceId, slug, sitePlan: "free" as const, updatedAt: new Date().toISOString() }
          : p,
      ),
      workspaces: s.workspaces.map((w) =>
        w.id === targetWorkspaceId
          ? { ...w, projectIds: [projectId, ...w.projectIds.filter((id) => id !== projectId)] }
          : { ...w, projectIds: w.projectIds.filter((id) => id !== projectId) },
      ),
    }));
    persistCreatedProjects();
    if (from) recordAudit(from.id, "project.transferred_out", "project", `${project.name} to ${target.name}`, project.id);
    recordAudit(targetWorkspaceId, "project.transferred_in", "project", project.name, project.id);
  },
  /**
   * Switch delivery mode. Content never moves; only the active delivery
   * adapters change. `kind` stays in sync as the derived back-compat label.
   */
  setDelivery(projectId: string, delivery: NonNullable<Project["delivery"]>) {
    const pr = state.projects.find((p) => p.id === projectId);
    set((s) => ({
      ...s,
      projects: s.projects.map((p) =>
        p.id === projectId
          ? { ...p, delivery, kind: delivery.hosted ? ("managed" as const) : ("headless" as const) }
          : p,
      ),
    }));
    if (pr) {
      const mode = delivery.hosted && delivery.api ? "hybrid" : delivery.hosted ? "hosted" : "headless";
      recordAudit(pr.workspaceId, "project.delivery_changed", "project", `${pr.name} → ${mode}`, projectId);
    }
  },
  /** Frontend hosting for headless projects: external or BetterCMS Hosting. */
  setHosting(projectId: string, hosting: NonNullable<Project["hosting"]>) {
    const pr = state.projects.find((p) => p.id === projectId);
    set((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, hosting } : p)),
    }));
    if (pr) recordAudit(pr.workspaceId, "hosting.mode_changed", "project", `${pr.name} → ${hosting.mode}`, projectId);
  },
  /** Demo plan change for one site. Billing totals and gating follow. */
  setSitePlan(projectId: string, plan: NonNullable<Project["sitePlan"]>) {
    const pr = state.projects.find((p) => p.id === projectId);
    set((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === projectId ? { ...p, sitePlan: plan } : p)),
    }));
    if (pr) recordAudit(pr.workspaceId, "site.plan_changed", "project", `${pr.name} → ${plan}`, projectId);
  },
};

// ---------- IDs + audit ----------

let counter = 5000;
const newId = (prefix: string) => `${prefix}_${(counter++).toString(36)}`;

const CURRENT_ACTOR = "m_jane";

function recordAudit(
  workspaceId: string,
  action: string,
  entityType: string,
  entityLabel?: string,
  entityId?: string,
) {
  const entry: AuditLogEntry = {
    id: newId("al"),
    workspaceId,
    actorId: CURRENT_ACTOR,
    action,
    entityType,
    entityId,
    entityLabel,
    createdAt: new Date().toISOString(),
  };
  set((s) => ({ ...s, auditLog: [entry, ...s.auditLog] }));
}

function workspaceForProject(projectId: string): string {
  return state.projects.find((p) => p.id === projectId)?.workspaceId ?? "ws_acme";
}

/** Record an agent action in the workspace audit log. */
export function recordAgentAudit(projectId: string, action: string, label: string, entityId?: string) {
  recordAudit(workspaceForProject(projectId), action, "agent", label, entityId);
}

// ---------- Section mutations ----------

export const DEFAULT_SECTION_PROPS: Record<SectionKind, Record<string, unknown>> = {
  hero: { heading: "New heading", eyebrow: "" },
  features: { columns: 3 },
  pricing: { plans: 3 },
  testimonials: { layout: "grid" },
  logos: { count: 6 },
  cta: { heading: "Call to action", buttonLabel: "Get started" },
  faq: { items: 6 },
  content: { body: "" },
  header: {},
  footer: {},
  navigation: { logo: "Northwind AI", links: "Product, Solutions, Pricing, Docs, Blog", ctaText: "Start free", ctaHref: "/signup" },
  workflow: { heading: "How it works", steps: 4 },
  integrations: { heading: "Connect everything", count: 12 },
  stats: { heading: "Trusted at scale", count: 4 },
  blog: { heading: "From the blog", count: 3 },
  docs: { heading: "Documentation", count: 6 },
  contact: { heading: "Talk to us", ctaText: "Send message", ctaHref: "/contact" },
};

// ---------- Section default block trees (Phase 2 migration) ----------

let _migId = 0;
const nb = (kind: BlockKind, props: Record<string, unknown> = {}, children?: Block[]): Block => ({
  id: `bk_seed_${(++_migId).toString(36)}_${Date.now().toString(36)}`,
  kind,
  props,
  ...(children ? { children } : {}),
});

/** Default block trees seeded when a section of this kind is created. */
export const DEFAULT_SECTION_BLOCKS: Partial<Record<SectionKind, () => Block[]>> = {
  navigation: () => [
    nb("nav-bar", { justify: "between" }, [
      nb("nav-logo", { text: "Northwind AI", mark: true }),
      nb("nav-links", { items: "Product|/product\nPricing|/pricing\nDocs|/docs\nBlog|/blog" }),
      nb("stack", { direction: "row", gap: "sm", align: "center", wrap: true }, [
        nb("nav-search", { placeholder: "Search…", shortcut: "⌘K" }),
        nb("button", { label: "Start free", href: "/signup", variant: "primary" }),
      ]),
    ]),
  ],
  header: () => [
    nb("nav-bar", { justify: "between" }, [
      nb("nav-logo", { text: "Brand", mark: true }),
      nb("nav-links", { items: "Product|/product\nPricing|/pricing\nAbout|/about" }),
      nb("button", { label: "Sign in", href: "/signin", variant: "ghost" }),
    ]),
  ],
  hero: () => [
    nb("paragraph", { text: "Eyebrow", muted: true, align: "center" }),
    nb("heading", { text: "Hero headline", level: "1", align: "center" }),
    nb("paragraph", { text: "Short supporting line to explain the value.", align: "center" }),
    nb("cta-group", { align: "center" }, [
      nb("button", { label: "Get started", href: "#", variant: "primary" }),
      nb("button", { label: "Learn more", href: "#", variant: "ghost" }),
    ]),
  ],
  cta: () => [
    nb("heading", { text: "Ready to start?", level: "2", align: "center" }),
    nb("paragraph", { text: "Short supporting line.", align: "center" }),
    nb("button", { label: "Get started", href: "#", variant: "primary" }),
  ],
  footer: () => [
    nb("footer-bar", { justify: "between" }, [
      nb("paragraph", { text: "Built with BetterCMS.", muted: true }),
      nb("paragraph", { text: "© 2026", muted: true }),
    ]),
  ],
};

// (One-shot legacy backfill happens in `seedBlocks` above via seedBlocksFromProps,
// which now produces the migrated block trees for navigation/header/hero/cta/footer.)



export const sectionActions = {
  add: (pageId: string, kind: SectionKind, atIndex?: number) => {
    const id = newId("sc");
    set((s) => {
      const seeded = DEFAULT_SECTION_BLOCKS[kind]?.();
      const newSection: Section = {
        id, pageId, kind,
        name: kind[0].toUpperCase() + kind.slice(1),
        props: structuredClone(DEFAULT_SECTION_PROPS[kind] ?? {}),
        ...(seeded ? { blocks: seeded } : {}),
      };
      return {
        ...s,
        sections: [...s.sections, newSection],
        pages: s.pages.map((p) => {
          if (p.id !== pageId) return p;
          const ids = [...p.sectionIds];
          const idx = atIndex ?? ids.length;
          ids.splice(idx, 0, id);
          return { ...p, sectionIds: ids };
        }),
      };
    });
    return id;
  },
  duplicate: (sectionId: string) => {
    const original = state.sections.find((s) => s.id === sectionId);
    if (!original) return;
    const id = newId("sc");
    set((s) => {
      const copy: Section = { ...structuredClone(original), id, name: `${original.name} copy` };
      const pageIdx = s.pages.findIndex((p) => p.id === original.pageId);
      const page = s.pages[pageIdx];
      const insertAt = page.sectionIds.indexOf(sectionId) + 1;
      const nextIds = [...page.sectionIds];
      nextIds.splice(insertAt, 0, id);
      const pages = [...s.pages];
      pages[pageIdx] = { ...page, sectionIds: nextIds };
      return { ...s, sections: [...s.sections, copy], pages };
    });
    return id;
  },
  remove: (sectionId: string) =>
    set((s) => {
      const section = s.sections.find((x) => x.id === sectionId);
      if (!section) return s;
      return {
        ...s,
        sections: s.sections.filter((x) => x.id !== sectionId),
        pages: s.pages.map((p) =>
          p.id === section.pageId
            ? { ...p, sectionIds: p.sectionIds.filter((id) => id !== sectionId) }
            : p,
        ),
      };
    }),
  move: (sectionId: string, delta: -1 | 1) =>
    set((s) => {
      const section = s.sections.find((x) => x.id === sectionId);
      if (!section) return s;
      const pageIdx = s.pages.findIndex((p) => p.id === section.pageId);
      const page = s.pages[pageIdx];
      const i = page.sectionIds.indexOf(sectionId);
      const j = i + delta;
      if (j < 0 || j >= page.sectionIds.length) return s;
      const nextIds = [...page.sectionIds];
      [nextIds[i], nextIds[j]] = [nextIds[j], nextIds[i]];
      const pages = [...s.pages];
      pages[pageIdx] = { ...page, sectionIds: nextIds };
      return { ...s, pages };
    }),
  reorder: (pageId: string, fromIndex: number, toIndex: number) =>
    set((s) => {
      const pageIdx = s.pages.findIndex((p) => p.id === pageId);
      if (pageIdx < 0) return s;
      const page = s.pages[pageIdx];
      if (
        fromIndex < 0 || fromIndex >= page.sectionIds.length ||
        toIndex < 0 || toIndex > page.sectionIds.length ||
        fromIndex === toIndex
      ) return s;
      const nextIds = [...page.sectionIds];
      const [moved] = nextIds.splice(fromIndex, 1);
      const insertAt = toIndex > fromIndex ? toIndex - 1 : toIndex;
      nextIds.splice(insertAt, 0, moved);
      const pages = [...s.pages];
      pages[pageIdx] = { ...page, sectionIds: nextIds };
      return { ...s, pages };
    }),
  update: (sectionId: string, patch: Partial<Section>) =>
    set((s) => ({
      ...s,
      sections: s.sections.map((x) => x.id === sectionId ? { ...x, ...patch } : x),
    })),
  setProp: (sectionId: string, key: string, value: unknown) =>
    set((s) => ({
      ...s,
      sections: s.sections.map((x) =>
        x.id === sectionId ? { ...x, props: { ...x.props, [key]: value } } : x,
      ),
    })),
  removeProp: (sectionId: string, key: string) =>
    set((s) => ({
      ...s,
      sections: s.sections.map((x) => {
        if (x.id !== sectionId) return x;
        const next = { ...x.props };
        delete next[key];
        return { ...x, props: next };
      }),
    })),
  bindComponent: (sectionId: string, componentId: string | null) =>
    set((s) => {
      const sections = s.sections.map((x) => {
        if (x.id !== sectionId) return x;
        if (!componentId) {
          // Detach: drop binding + overrides. Caller may have copied rootBlocks
          // in via `detachFromComponent` already.
          const { componentId: _c, overrides: _o, ...rest } = x;
          void _c; void _o;
          return rest as Section;
        }
        // Bind: seed overrides from schema defaults.
        const cmp = s.components.find((c) => c.id === componentId);
        const schema = cmp?.schemaId ? s.schemas.find((sc) => sc.id === cmp.schemaId) : undefined;
        const seeded: Record<string, unknown> = {};
        for (const f of schema?.fields ?? []) {
          if (f.defaultValue !== undefined) seeded[f.name] = f.defaultValue;
        }
        return { ...x, componentId, overrides: { ...seeded, ...(x.overrides ?? {}) } };
      });
      return { ...s, sections };
    }),
  setOverride: (sectionId: string, fieldName: string, value: unknown) =>
    set((s) => ({
      ...s,
      sections: s.sections.map((x) =>
        x.id === sectionId
          ? { ...x, overrides: { ...(x.overrides ?? {}), [fieldName]: value } }
          : x,
      ),
    })),
  clearOverride: (sectionId: string, fieldName: string) =>
    set((s) => ({
      ...s,
      sections: s.sections.map((x) => {
        if (x.id !== sectionId) return x;
        const next = { ...(x.overrides ?? {}) };
        delete next[fieldName];
        return { ...x, overrides: next };
      }),
    })),
  detachFromComponent: (sectionId: string) =>
    set((s) => {
      const sec = s.sections.find((x) => x.id === sectionId);
      if (!sec || !sec.componentId) return s;
      const cmp = s.components.find((c) => c.id === sec.componentId);
      const rootBlocks = cmp?.rootBlocks ? JSON.parse(JSON.stringify(cmp.rootBlocks)) as Block[] : [];
      return {
        ...s,
        sections: s.sections.map((x) => {
          if (x.id !== sectionId) return x;
          const { componentId: _c, overrides: _o, ...rest } = x;
          void _c; void _o;
          return { ...rest, blocks: rootBlocks } as Section;
        }),
      };
    }),
};


// ---------- Block mutations (Section.blocks tree) ----------

function mapSection(sectionId: string, fn: (s: Section) => Section) {
  set((s) => ({
    ...s,
    sections: s.sections.map((x) => (x.id === sectionId ? fn(x) : x)),
  }));
}

export const blockActions = {
  add: (sectionId: string, parentPath: BlockPath, kind: BlockKind, atIndex?: number) => {
    let newPath: BlockPath = [];
    mapSection(sectionId, (sec) => {
      const result = addBlock(sec.blocks ?? [], parentPath, kind, atIndex);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  remove: (sectionId: string, path: BlockPath) => {
    mapSection(sectionId, (sec) => ({ ...sec, blocks: removeBlock(sec.blocks ?? [], path) }));
  },
  update: (sectionId: string, path: BlockPath, patch: Record<string, unknown>) => {
    mapSection(sectionId, (sec) => ({ ...sec, blocks: updateBlockProps(sec.blocks ?? [], path, patch) }));
  },
  move: (sectionId: string, path: BlockPath, delta: -1 | 1) => {
    let newPath = path;
    mapSection(sectionId, (sec) => {
      const result = moveBlock(sec.blocks ?? [], path, delta);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  duplicate: (sectionId: string, path: BlockPath) => {
    let newPath = path;
    mapSection(sectionId, (sec) => {
      const result = duplicateBlock(sec.blocks ?? [], path);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  wrap: (sectionId: string, path: BlockPath, wrapperKind: BlockKind) => {
    let newPath = path;
    mapSection(sectionId, (sec) => {
      const result = wrapBlock(sec.blocks ?? [], path, wrapperKind);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  setAll: (sectionId: string, blocks: Block[]) => {
    mapSection(sectionId, (sec) => ({ ...sec, blocks }));
    return (blocks.length > 0 ? [0] : []) as BlockPath;
  },
  appendAll: (sectionId: string, blocks: Block[]) => {
    let firstPath: BlockPath = [];
    mapSection(sectionId, (sec) => {
      const existing = sec.blocks ?? [];
      firstPath = blocks.length > 0 ? [existing.length] : [];
      return { ...sec, blocks: [...existing, ...blocks] };
    });
    return firstPath;
  },
  moveTo: (sectionId: string, from: BlockPath, to: BlockPath) => {
    let newPath = from;
    mapSection(sectionId, (sec) => {
      const result = moveBlockTo(sec.blocks ?? [], from, to);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  insertAt: (sectionId: string, parentPath: BlockPath, atIndex: number, block: Block) => {
    let newPath: BlockPath = [];
    mapSection(sectionId, (sec) => {
      const result = insertBlockAt(sec.blocks ?? [], parentPath, atIndex, block);
      newPath = result.newPath;
      return { ...sec, blocks: result.blocks };
    });
    return newPath;
  },
  transform: (
    sectionId: string,
    path: BlockPath,
    nextKind: BlockKind,
    patch: Record<string, unknown> = {},
  ) => {
    mapSection(sectionId, (sec) => ({
      ...sec,
      blocks: transformBlock(sec.blocks ?? [], path, nextKind, patch),
    }));
  },
};

// `Block` type re-export kept for callers that import from the store barrel.
export type { Block, BlockPath };


// ---------- Page mutations ----------

export const pageActions = {
  update: (pageId: string, patch: Partial<Page>) =>
    set((s) => ({ ...s, pages: s.pages.map((p) => p.id === pageId ? { ...p, ...patch } : p) })),
  add: (projectId: string, input: { title: string; slug: string; type?: Page["type"] }) => {
    const id = newId("pg");
    set((s) => {
      const page: Page = {
        id, projectId, slug: input.slug, title: input.title,
        sectionIds: [], type: input.type ?? "static", publishState: "draft", indexing: "index",
      };
      const website = s.websites.find((w) => w.projectId === projectId);
      return {
        ...s,
        pages: [...s.pages, page],
        websites: website
          ? s.websites.map((w) => w.id === website.id ? { ...w, pageIds: [...w.pageIds, id] } : w)
          : s.websites,
      };
    });
    recordAudit(workspaceForProject(projectId), "page.created", "page", input.title, id);
    return id;
  },
  setPublishState: (pageId: string, next: PublishState, scheduledAt?: string) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return;
    set((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId
          ? { ...p, publishState: next, scheduledAt, publishedAt: next === "published" ? new Date().toISOString() : p.publishedAt }
          : p,
      ),
    }));
    recordAudit(workspaceForProject(page.projectId), `page.${next}`, "page", page.title, pageId);
  },
  transition: (pageId: string, to: PublishState) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return false;
    if (!canTransition(page.publishState, to)) return false;
    if (to === "published") {
      pageActions.publish(pageId);
      return true;
    }
    set((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId
          ? { ...p, publishState: to, scheduledAt: to === "scheduled" ? p.scheduledAt : undefined }
          : p,
      ),
    }));
    recordAudit(workspaceForProject(page.projectId), `page.${to}`, "page", page.title, pageId);
    return true;
  },
  schedule: (pageId: string, scheduledAt: string) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return;
    set((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, publishState: "scheduled", scheduledAt } : p,
      ),
    }));
    recordAudit(workspaceForProject(page.projectId), "page.scheduled", "page", page.title, pageId);
  },
  unschedule: (pageId: string) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return;
    set((s) => ({
      ...s,
      pages: s.pages.map((p) =>
        p.id === pageId ? { ...p, publishState: "approved", scheduledAt: undefined } : p,
      ),
    }));
  },
  publish: (pageId: string) => {
    const page = state.pages.find((p) => p.id === pageId);
    if (!page) return;
    const sections = page.sectionIds
      .map((id) => state.sections.find((s) => s.id === id))
      .filter(Boolean) as Section[];
    const snapshot = buildPageSnapshot(page, sections);
    const capturedAt = snapshot.capturedAt;
    const revisionId = newId("rv");
    const revision: Revision = {
      id: revisionId,
      ownerKind: "page",
      ownerId: pageId,
      createdAt: capturedAt,
      createdBy: CURRENT_ACTOR,
      label: `v${(page.revisionIds?.length ?? 0) + 1}`,
      snapshot,
    };
    set((s) => ({
      ...s,
      revisions: [revision, ...s.revisions],
      pages: s.pages.map((p) =>
        p.id === pageId
          ? {
              ...p,
              publishState: "published",
              publishedAt: capturedAt,
              lastPublishedAt: capturedAt,
              scheduledAt: undefined,
              publishedSnapshot: snapshot,
              revisionIds: [revisionId, ...(p.revisionIds ?? [])],
            }
          : p,
      ),
    }));
    recordAudit(workspaceForProject(page.projectId), "page.published", "page", page.title, pageId);
  },
  restoreRevision: (pageId: string, revisionId: string) => {
    const rev = state.revisions.find((r) => r.id === revisionId);
    if (!rev || rev.ownerKind !== "page" || rev.ownerId !== pageId) return;
    const snap = rev.snapshot as PagePublishedSnapshot;
    set((s) => {
      const snapSecs = snap.sections;
      const otherSections = s.sections.filter((sec) => !snapSecs.some((x) => x.id === sec.id && x.pageId === pageId));
      const restored = snapSecs.map((sec) => structuredClone(sec));
      return {
        ...s,
        sections: [...otherSections, ...restored],
        pages: s.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                publishState: "draft",
                sectionIds: snap.page.sectionIds,
              }
            : p,
        ),
      };
    });
    const page = state.pages.find((p) => p.id === pageId);
    if (page) recordAudit(workspaceForProject(page.projectId), "page.restored", "page", page.title, pageId);
  },
};

// (PagePublishedSnapshot imported at top.)

// ---------- Collection / Component / Entry / Media creation ----------

export const collectionActions = {
  add: (projectId: string, input: { name: string; slug: string }) => {
    const colId = newId("c");
    const schemaId = newId("sch");
    set((s) => {
      const schema: Schema = {
        id: schemaId, ownerType: "collection", ownerId: colId,
        fields: [{ id: newId("f"), name: "title", label: "Title", type: "text", required: true }],
      };
      const collection: Collection = {
        id: colId, projectId, name: input.name, slug: input.slug, schemaId, entryIds: [],
      };
      return {
        ...s,
        schemas: [...s.schemas, schema],
        collections: [...s.collections, collection],
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, collectionIds: [...p.collectionIds, colId] } : p,
        ),
      };
    });
    recordAudit(workspaceForProject(projectId), "collection.created", "collection", input.name, colId);
    return colId;
  },
};

export const componentMasterActions = {
  add: (projectId: string, input: { name: string }) => {
    const id = newId("cmp");
    const schemaId = newId("sch");
    set((s) => {
      const schema: Schema = { id: schemaId, ownerType: "component", ownerId: id, fields: [] };
      const cmp: ComponentMaster = {
        id, projectId, name: input.name, kind: "master", variantIds: [], schemaId,
        states: ["default", "hover", "active", "focus", "disabled"],
        variantKinds: ["primary"],
      };
      return {
        ...s,
        schemas: [...s.schemas, schema],
        components: [...s.components, cmp],
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, componentIds: [...p.componentIds, id] } : p,
        ),
      };
    });
    recordAudit(workspaceForProject(projectId), "component.created", "component", input.name, id);
    return id;
  },
};

export const entryCreateActions = {
  add: (collectionId: string, title: string) => {
    const id = newId("e");
    set((s) => {
      const entry: Entry = {
        id, collectionId, title, fields: {},
        updatedAt: new Date().toISOString(), status: "draft", createdBy: CURRENT_ACTOR, updatedBy: CURRENT_ACTOR,
      };
      return {
        ...s,
        entries: [...s.entries, entry],
        collections: s.collections.map((c) =>
          c.id === collectionId ? { ...c, entryIds: [...c.entryIds, id] } : c,
        ),
      };
    });
    return id;
  },
};

export const mediaActions = {
  add: (projectId: string, input: { name: string; kind?: MediaAsset["kind"]; size?: string; folderId?: string }) => {
    const id = newId("md");
    set((s) => {
      const asset: MediaAsset = {
        id, projectId, name: input.name,
        kind: input.kind ?? "image", url: "", size: input.size, folderId: input.folderId,
        uploadedAt: new Date().toISOString(),
      };
      return {
        ...s,
        media: [...s.media, asset],
        projects: s.projects.map((p) =>
          p.id === projectId ? { ...p, mediaIds: [...p.mediaIds, id] } : p,
        ),
      };
    });
    recordAudit(workspaceForProject(projectId), "media.uploaded", "media", input.name, id);
    return id;
  },
  remove: (mediaId: string) => {
    const asset = state.media.find((m) => m.id === mediaId);
    if (!asset) return;
    set((s) => ({
      ...s,
      media: s.media.filter((m) => m.id !== mediaId),
      projects: s.projects.map((p) =>
        p.id === asset.projectId ? { ...p, mediaIds: p.mediaIds.filter((id) => id !== mediaId) } : p,
      ),
    }));
    recordAudit(workspaceForProject(asset.projectId), "media.removed", "media", asset.name, mediaId);
  },
};

export const mediaFolderActions = {
  add: (projectId: string, name: string, parentId?: string) => {
    const id = newId("mf");
    set((s) => ({ ...s, mediaFolders: [...s.mediaFolders, { id, projectId, name, parentId }] }));
    return id;
  },
  remove: (folderId: string) =>
    set((s) => ({ ...s, mediaFolders: s.mediaFolders.filter((f) => f.id !== folderId) })),
};

// ---------- Component mutations ----------

export const componentActions = {
  addVariant: (componentId: string) => {
    const id = newId("v");
    set((s) => ({
      ...s,
      components: s.components.map((c) =>
        c.id === componentId ? { ...c, variantIds: [...c.variantIds, id] } : c,
      ),
    }));
    return id;
  },
  removeVariant: (componentId: string, variantId: string) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) =>
        c.id === componentId ? { ...c, variantIds: c.variantIds.filter((v) => v !== variantId) } : c,
      ),
    })),
  rename: (componentId: string, name: string) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) => c.id === componentId ? { ...c, name } : c),
    })),
  setCode: (componentId: string, patch: { customCss?: string; customJs?: string }) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) => c.id === componentId ? { ...c, ...patch } : c),
    })),
  setRootBlocks: (componentId: string, blocks: Block[]) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) => c.id === componentId ? { ...c, rootBlocks: blocks } : c),
    })),
  addRootBlock: (componentId: string, kind: BlockKind) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) => {
        if (c.id !== componentId) return c;
        const id = newId("b");
        const newBlock: Block = { id, kind, props: {} };
        return { ...c, rootBlocks: [...(c.rootBlocks ?? []), newBlock] };
      }),
    })),
  removeRootBlock: (componentId: string, blockId: string) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) =>
        c.id === componentId
          ? { ...c, rootBlocks: (c.rootBlocks ?? []).filter((b) => b.id !== blockId) }
          : c,
      ),
    })),
  updateRootBlockProps: (componentId: string, blockId: string, patch: Record<string, unknown>) =>
    set((s) => ({
      ...s,
      components: s.components.map((c) =>
        c.id === componentId
          ? {
              ...c,
              rootBlocks: (c.rootBlocks ?? []).map((b) =>
                b.id === blockId ? { ...b, props: { ...b.props, ...patch } } : b,
              ),
            }
          : c,
      ),
    })),

};

// ---------- Schema mutations ----------

export const schemaActions = {
  addField: (schemaId: string, type: SchemaFieldType = "text") => {
    const id = newId("f");
    const name = `field_${id.slice(2)}`;
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: [...sc.fields, { id, name, label: "New field", type }] }
          : sc,
      ),
    }));
    return id;
  },
  updateField: (schemaId: string, fieldId: string, patch: Partial<SchemaField>) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: sc.fields.map((f) => f.id === fieldId ? { ...f, ...patch } : f) }
          : sc,
      ),
    })),
  removeField: (schemaId: string, fieldId: string) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId ? { ...sc, fields: sc.fields.filter((f) => f.id !== fieldId) } : sc,
      ),
    })),
  moveField: (schemaId: string, fieldId: string, delta: -1 | 1) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId) return sc;
        const i = sc.fields.findIndex((f) => f.id === fieldId);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= sc.fields.length) return sc;
        const fields = [...sc.fields];
        [fields[i], fields[j]] = [fields[j], fields[i]];
        return { ...sc, fields };
      }),
    })),

  // ----- groups -----
  addGroup: (schemaId: string, label = "New group") => {
    const id = newId("g");
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, groups: [...(sc.groups ?? []), { id, name: id, label } as SchemaFieldGroup] }
          : sc,
      ),
    }));
    return id;
  },
  renameGroup: (schemaId: string, groupId: string, label: string) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, groups: (sc.groups ?? []).map((g) => g.id === groupId ? { ...g, label } : g) }
          : sc,
      ),
    })),
  removeGroup: (schemaId: string, groupId: string) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? {
              ...sc,
              groups: (sc.groups ?? []).filter((g) => g.id !== groupId),
              fields: sc.fields.map((f) => f.groupId === groupId ? { ...f, groupId: null } : f),
            }
          : sc,
      ),
    })),
  moveGroup: (schemaId: string, groupId: string, delta: -1 | 1) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId || !sc.groups) return sc;
        const i = sc.groups.findIndex((g) => g.id === groupId);
        const j = i + delta;
        if (i < 0 || j < 0 || j >= sc.groups.length) return sc;
        const groups = [...sc.groups];
        [groups[i], groups[j]] = [groups[j], groups[i]];
        return { ...sc, groups };
      }),
    })),
  /**
   * Reorder a group to a new index (relative to current `groups[]` order).
   * `toIndex` is the desired post-removal insertion position.
   */
  reorderGroups: (schemaId: string, groupId: string, toIndex: number) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId || !sc.groups) return sc;
        const from = sc.groups.findIndex((g) => g.id === groupId);
        if (from < 0) return sc;
        const groups = [...sc.groups];
        const [moved] = groups.splice(from, 1);
        const clamped = Math.max(0, Math.min(groups.length, toIndex));
        groups.splice(clamped, 0, moved);
        return { ...sc, groups };
      }),
    })),
  setFieldGroup: (schemaId: string, fieldId: string, groupId: string | null) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: sc.fields.map((f) => f.id === fieldId ? { ...f, groupId } : f) }
          : sc,
      ),
    })),
  /**
   * Move a field into `targetGroupId` at `targetIndex` (relative to that
   * group's current field order). Atomic: updates `groupId` and reorders
   * `fields[]` in a single state mutation.
   */
  moveFieldTo: (
    schemaId: string,
    fieldId: string,
    targetGroupId: string | null,
    targetIndex: number,
  ) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId) return sc;
        const src = sc.fields.find((f) => f.id === fieldId);
        if (!src) return sc;
        const groupIds = new Set((sc.groups ?? []).map((g) => g.id));
        const normGroup = (gid: string | null | undefined) =>
          gid && groupIds.has(gid) ? gid : null;
        const moved = { ...src, groupId: targetGroupId };
        const without = sc.fields.filter((f) => f.id !== fieldId);
        let seenInTarget = 0;
        let absIndex = without.length;
        for (let i = 0; i < without.length; i++) {
          if (normGroup(without[i].groupId) === targetGroupId) {
            if (seenInTarget === targetIndex) { absIndex = i; break; }
            seenInTarget++;
          }
        }
        const fields = [...without.slice(0, absIndex), moved, ...without.slice(absIndex)];
        return { ...sc, fields };
      }),
    })),

  // ----- per-field config -----
  setFieldValidation: (schemaId: string, fieldId: string, validation: SchemaFieldValidation) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: sc.fields.map((f) => f.id === fieldId ? { ...f, validation } : f) }
          : sc,
      ),
    })),
  setFieldOptions: (schemaId: string, fieldId: string, options: string[]) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: sc.fields.map((f) => f.id === fieldId ? { ...f, options } : f) }
          : sc,
      ),
    })),
  setFieldReference: (schemaId: string, fieldId: string, patch: { refCollectionId?: string; refComponentId?: string }) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, fields: sc.fields.map((f) => f.id === fieldId ? { ...f, ...patch } : f) }
          : sc,
      ),
    })),

  // ----- list / title -----
  setListField: (schemaId: string, fieldName: string, on: boolean) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId) return sc;
        const current = sc.listFieldNames ?? [];
        const next = on
          ? Array.from(new Set([...current, fieldName]))
          : current.filter((n) => n !== fieldName);
        return { ...sc, listFieldNames: next };
      }),
    })),
  setTitleField: (schemaId: string, fieldName: string) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId ? { ...sc, titleFieldName: fieldName } : sc,
      ),
    })),
  setGroupColor: (schemaId: string, groupId: string, color: string | undefined) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, groups: (sc.groups ?? []).map((g) => g.id === groupId ? { ...g, color } : g) }
          : sc,
      ),
    })),
  duplicateField: (schemaId: string, fieldId: string) => {
    let newFieldId = "";
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId) return sc;
        const i = sc.fields.findIndex((f) => f.id === fieldId);
        if (i < 0) return sc;
        const src = sc.fields[i];
        newFieldId = newId("f");
        const copy: SchemaField = {
          ...structuredClone(src),
          id: newFieldId,
          name: `${src.name}_copy`,
          label: `${src.label} copy`,
        };
        const fields = [...sc.fields];
        fields.splice(i + 1, 0, copy);
        return { ...sc, fields };
      }),
    }));
    return newFieldId;
  },
  updateGroup: (schemaId: string, groupId: string, patch: Partial<SchemaFieldGroup>) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId
          ? { ...sc, groups: (sc.groups ?? []).map((g) => g.id === groupId ? { ...g, ...patch } : g) }
          : sc,
      ),
    })),

  duplicateGroup: (schemaId: string, groupId: string) => {
    let newGroupId = "";
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) => {
        if (sc.id !== schemaId || !sc.groups) return sc;
        const i = sc.groups.findIndex((g) => g.id === groupId);
        if (i < 0) return sc;
        const src = sc.groups[i];
        newGroupId = newId("g");
        const copy: SchemaFieldGroup = { ...structuredClone(src), id: newGroupId, label: `${src.label} copy` };
        const groups = [...sc.groups];
        groups.splice(i + 1, 0, copy);
        // duplicate the fields too
        const dupFields: SchemaField[] = [];
        for (const f of sc.fields) {
          if (f.groupId === groupId) {
            dupFields.push({ ...structuredClone(f), id: newId("f"), name: `${f.name}_copy`, groupId: newGroupId });
          }
        }
        return { ...sc, groups, fields: [...sc.fields, ...dupFields] };
      }),
    }));
    return newGroupId;
  },

  /**
   * Replace a schema's structural slices (fields + groups) wholesale.
   * Used by the schema-workspace history stack for undo / redo / discard.
   */
  replaceSchema: (
    schemaId: string,
    fields: SchemaField[],
    groups: SchemaFieldGroup[] | undefined,
  ) =>
    set((s) => ({
      ...s,
      schemas: s.schemas.map((sc) =>
        sc.id === schemaId ? { ...sc, fields, groups } : sc,
      ),
    })),
};


// ---------- Entry mutations ----------

export const entryActions = {
  update: (entryId: string, patch: Partial<Entry>) =>
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, ...patch, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR } : e,
      ),
    })),
  setField: (entryId: string, key: string, value: unknown) =>
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, fields: { ...e.fields, [key]: value }, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR }
          : e,
      ),
    })),
  setStatus: (entryId: string, status: PublishState, scheduledAt?: string) => {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, status, scheduledAt, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR } : e,
      ),
    }));
    const col = state.collections.find((c) => c.id === entry.collectionId);
    recordAudit(workspaceForProject(col?.projectId ?? ""), `entry.${status}`, "entry", entry.title, entryId);
  },
  remove: (entryId: string) => {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    set((s) => ({
      ...s,
      entries: s.entries.filter((e) => e.id !== entryId),
      collections: s.collections.map((c) =>
        c.id === entry.collectionId ? { ...c, entryIds: c.entryIds.filter((id) => id !== entryId) } : c,
      ),
    }));
    const col = state.collections.find((c) => c.id === entry.collectionId);
    recordAudit(workspaceForProject(col?.projectId ?? ""), "entry.deleted", "entry", entry.title, entryId);
  },
  duplicate: (entryId: string) => {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const id = newId("e");
    set((s) => ({
      ...s,
      entries: [...s.entries, { ...structuredClone(entry), id, title: `${entry.title} copy`, status: "draft", updatedAt: new Date().toISOString() }],
      collections: s.collections.map((c) =>
        c.id === entry.collectionId ? { ...c, entryIds: [...c.entryIds, id] } : c,
      ),
    }));
    return id;
  },
  transition: (entryId: string, to: PublishState) => {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return false;
    if (!canTransition(entry.status, to)) return false;
    if (to === "published") {
      entryActions.publish(entryId);
      return true;
    }
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, status: to, scheduledAt: to === "scheduled" ? e.scheduledAt : undefined, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR }
          : e,
      ),
    }));
    const col = state.collections.find((c) => c.id === entry.collectionId);
    recordAudit(workspaceForProject(col?.projectId ?? ""), `entry.${to}`, "entry", entry.title, entryId);
    return true;
  },
  schedule: (entryId: string, scheduledAt: string) => {
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, status: "scheduled", scheduledAt, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR }
          : e,
      ),
    }));
  },
  unschedule: (entryId: string) => {
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId
          ? { ...e, status: "approved", scheduledAt: undefined, updatedAt: new Date().toISOString(), updatedBy: CURRENT_ACTOR }
          : e,
      ),
    }));
  },
  publish: (entryId: string) => {
    const entry = state.entries.find((e) => e.id === entryId);
    if (!entry) return;
    const snapshot = buildEntrySnapshot(entry);
    const capturedAt = snapshot.capturedAt;
    const revisionId = newId("rv");
    const revision: Revision = {
      id: revisionId,
      ownerKind: "entry",
      ownerId: entryId,
      createdAt: capturedAt,
      createdBy: CURRENT_ACTOR,
      label: `v${(entry.revisionIds?.length ?? 0) + 1}`,
      snapshot,
    };
    set((s) => ({
      ...s,
      revisions: [revision, ...s.revisions],
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              status: "published",
              lastPublishedAt: capturedAt,
              scheduledAt: undefined,
              publishedSnapshot: snapshot,
              revisionIds: [revisionId, ...(e.revisionIds ?? [])],
            }
          : e,
      ),
    }));
    const col = state.collections.find((c) => c.id === entry.collectionId);
    recordAudit(workspaceForProject(col?.projectId ?? ""), "entry.published", "entry", entry.title, entryId);
  },
  restoreRevision: (entryId: string, revisionId: string) => {
    const rev = state.revisions.find((r) => r.id === revisionId);
    if (!rev || rev.ownerKind !== "entry" || rev.ownerId !== entryId) return;
    const snap = rev.snapshot as { entry: Entry };
    set((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId
          ? {
              ...e,
              fields: structuredClone(snap.entry.fields),
              title: snap.entry.title,
              status: "draft",
              updatedAt: new Date().toISOString(),
              updatedBy: CURRENT_ACTOR,
            }
          : e,
      ),
    }));
  },
};

// ---------- Entry comments ----------

export const commentActions = {
  add: (entryId: string, body: string, authorName = "You") => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const id = newId("cm");
    const comment: EntryComment = {
      id,
      entryId,
      authorId: CURRENT_ACTOR,
      authorName,
      body: trimmed,
      createdAt: new Date().toISOString(),
      resolved: false,
    };
    set((s) => ({ ...s, comments: [comment, ...s.comments] }));
    return id;
  },
  remove: (commentId: string) =>
    set((s) => ({ ...s, comments: s.comments.filter((c) => c.id !== commentId) })),
  toggleResolved: (commentId: string) =>
    set((s) => ({
      ...s,
      comments: s.comments.map((c) => (c.id === commentId ? { ...c, resolved: !c.resolved } : c)),
    })),
};

export const memberActions = {
  invite: (workspaceId: string, email: string, role: WorkspaceRole) => {
    const id = newId("inv");
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + 7 * 86_400_000).toISOString();
    set((s) => ({
      ...s,
      invitations: [
        { id, workspaceId, email, role, invitedBy: CURRENT_ACTOR, createdAt: now, expiresAt: expires, status: "pending" },
        ...s.invitations,
      ],
    }));
    recordAudit(workspaceId, "member.invited", "member", email);
    return id;
  },
  resendInvite: (invitationId: string) => {
    const inv = state.invitations.find((i) => i.id === invitationId);
    if (!inv) return;
    recordAudit(inv.workspaceId, "invitation.resent", "invitation", inv.email);
  },
  revokeInvite: (invitationId: string) => {
    const inv = state.invitations.find((i) => i.id === invitationId);
    if (!inv) return;
    set((s) => ({
      ...s,
      invitations: s.invitations.map((i) => i.id === invitationId ? { ...i, status: "revoked" } : i),
    }));
    recordAudit(inv.workspaceId, "invitation.revoked", "invitation", inv.email);
  },
  changeRole: (workspaceId: string, memberId: string, role: WorkspaceRole) => {
    const m = state.members.find((x) => x.id === memberId);
    set((s) => ({ ...s, members: s.members.map((x) => x.id === memberId ? { ...x, role } : x) }));
    recordAudit(workspaceId, "role.changed", "member", m ? `${m.name} → ${role}` : memberId, memberId);
  },
  setStatus: (workspaceId: string, memberId: string, status: Member["status"]) => {
    const m = state.members.find((x) => x.id === memberId);
    set((s) => ({ ...s, members: s.members.map((x) => x.id === memberId ? { ...x, status } : x) }));
    recordAudit(workspaceId, `member.${status}`, "member", m?.name ?? memberId, memberId);
  },
  remove: (workspaceId: string, memberId: string) => {
    const m = state.members.find((x) => x.id === memberId);
    set((s) => ({
      ...s,
      members: s.members.filter((x) => x.id !== memberId),
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, memberIds: w.memberIds.filter((id) => id !== memberId) } : w,
      ),
    }));
    recordAudit(workspaceId, "member.removed", "member", m?.name ?? memberId, memberId);
  },
  /** Seat management: add a person with a seat type. Free seats cost nothing, paid seats bill by role. */
  addSeat: (workspaceId: string, input: { name: string; email: string; seat: NonNullable<Member["seat"]> }) => {
    const id = newId("m");
    const member: Member = {
      id,
      name: input.name,
      email: input.email,
      role: input.seat === "developer" ? "developer" : input.seat === "marketer" ? "admin" : input.seat === "editor" ? "content_manager" : "viewer",
      seat: input.seat,
      status: "active",
      lastActiveAt: new Date().toISOString(),
    };
    set((s) => ({
      ...s,
      members: [...s.members, member],
      workspaces: s.workspaces.map((w) =>
        w.id === workspaceId ? { ...w, memberIds: [...w.memberIds, id] } : w,
      ),
    }));
    recordAudit(workspaceId, "seat.added", "member", `${input.name} (${input.seat})`, id);
    return member;
  },
  /** Change a person's seat type. The workspace total updates immediately. */
  changeSeat: (workspaceId: string, memberId: string, seat: NonNullable<Member["seat"]>) => {
    const m = state.members.find((x) => x.id === memberId);
    set((s) => ({ ...s, members: s.members.map((x) => (x.id === memberId ? { ...x, seat } : x)) }));
    recordAudit(workspaceId, "seat.changed", "member", m ? `${m.name} → ${seat}` : memberId, memberId);
  },
};

// ---------- API keys ----------

export const apiKeyActions = {
  create: (workspaceId: string, name: string, scopes: string[]) => {
    const id = newId("ak");
    const prefix = `bcms_live_${Math.random().toString(36).slice(2, 6)}`;
    set((s) => ({
      ...s,
      apiKeys: [
        { id, workspaceId, name, prefix, scopes, createdBy: CURRENT_ACTOR, createdAt: new Date().toISOString() },
        ...s.apiKeys,
      ],
    }));
    recordAudit(workspaceId, "apikey.created", "apiKey", name, id);
    return { id, fullKey: `${prefix}_${Math.random().toString(36).slice(2, 14)}` };
  },
  revoke: (apiKeyId: string) => {
    const k = state.apiKeys.find((x) => x.id === apiKeyId);
    if (!k) return;
    set((s) => ({
      ...s,
      apiKeys: s.apiKeys.map((x) => x.id === apiKeyId ? { ...x, revokedAt: new Date().toISOString() } : x),
    }));
    recordAudit(k.workspaceId, "apikey.revoked", "apiKey", k.name, apiKeyId);
  },
};

// ---------- Webhooks ----------

export const webhookActions = {
  create: (workspaceId: string, url: string, events: WebhookEvent[]) => {
    const id = newId("wh");
    set((s) => ({
      ...s,
      webhooks: [
        { id, workspaceId, url, events, secretPrefix: `whsec_${Math.random().toString(36).slice(2, 5)}`, status: "active", createdAt: new Date().toISOString() },
        ...s.webhooks,
      ],
    }));
    recordAudit(workspaceId, "webhook.created", "webhook", url, id);
    return id;
  },
  remove: (webhookId: string) => {
    const w = state.webhooks.find((x) => x.id === webhookId);
    if (!w) return;
    set((s) => ({
      ...s,
      webhooks: s.webhooks.filter((x) => x.id !== webhookId),
      webhookDeliveries: s.webhookDeliveries.filter((d) => d.webhookId !== webhookId),
    }));
    recordAudit(w.workspaceId, "webhook.removed", "webhook", w.url, webhookId);
  },
  toggle: (webhookId: string, status: Webhook["status"]) => {
    set((s) => ({
      ...s,
      webhooks: s.webhooks.map((x) => x.id === webhookId ? { ...x, status } : x),
    }));
  },
};

// ---------- Domains ----------

export const domainActions = {
  add: (workspaceId: string, projectId: string | undefined, host: string) => {
    const id = newId("d");
    set((s) => ({
      ...s,
      domains: [
        { id, workspaceId, projectId, host, status: "verifying", sslStatus: "pending", addedAt: new Date().toISOString() },
        ...s.domains,
      ],
    }));
    recordAudit(workspaceId, "domain.added", "domain", host, id);
    return id;
  },
  setStatus: (domainId: string, status: Domain["status"]) =>
    set((s) => ({ ...s, domains: s.domains.map((d) => d.id === domainId ? { ...d, status } : d) })),
  setPrimary: (domainId: string) => {
    const target = state.domains.find((d) => d.id === domainId);
    if (!target) return;
    set((s) => ({
      ...s,
      domains: s.domains.map((d) => {
        if (d.id === domainId) return { ...d, primary: true };
        if (d.projectId && d.projectId === target.projectId) return { ...d, primary: false };
        return d;
      }),
    }));
  },
  remove: (domainId: string) => {
    const d = state.domains.find((x) => x.id === domainId);
    if (!d) return;
    set((s) => ({ ...s, domains: s.domains.filter((x) => x.id !== domainId) }));
    recordAudit(d.workspaceId ?? "ws_acme", "domain.removed", "domain", d.host, domainId);
  },
};

// ---------- Redirects / env / custom code ----------

export const redirectActions = {
  add: (projectId: string, input: { from: string; to: string; type?: 301 | 302 }) => {
    const id = newId("rd");
    set((s) => ({
      ...s,
      redirects: [
        { id, projectId, from: input.from, to: input.to, type: input.type ?? 301, enabled: true },
        ...s.redirects,
      ],
    }));
    return id;
  },
  update: (id: string, patch: Partial<Redirect>) =>
    set((s) => ({ ...s, redirects: s.redirects.map((r) => r.id === id ? { ...r, ...patch } : r) })),
  remove: (id: string) =>
    set((s) => ({ ...s, redirects: s.redirects.filter((r) => r.id !== id) })),
};

export const envVarActions = {
  add: (projectId: string, key: string, value: string, scope: EnvScope = "all") => {
    const id = newId("ev");
    set((s) => ({
      ...s,
      envVars: [...s.envVars, { id, projectId, key, value, scope, updatedAt: new Date().toISOString() }],
    }));
    return id;
  },
  update: (id: string, patch: Partial<EnvironmentVariable>) =>
    set((s) => ({
      ...s,
      envVars: s.envVars.map((v) => v.id === id ? { ...v, ...patch, updatedAt: new Date().toISOString() } : v),
    })),
  remove: (id: string) =>
    set((s) => ({ ...s, envVars: s.envVars.filter((v) => v.id !== id) })),
};

export const customCodeActions = {
  add: (input: { projectId: string; scope: "site" | "page"; pageId?: string; location: CustomCodeLocation; language: CustomCodeLanguage; content: string }) => {
    const id = newId("cc");
    set((s) => ({
      ...s,
      customCode: [
        ...s.customCode,
        { id, ...input, enabled: true, updatedAt: new Date().toISOString() },
      ],
    }));
    return id;
  },
  update: (id: string, patch: Partial<CustomCodeBlock>) =>
    set((s) => ({
      ...s,
      customCode: s.customCode.map((c) => c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c),
    })),
  remove: (id: string) =>
    set((s) => ({ ...s, customCode: s.customCode.filter((c) => c.id !== id) })),
};

// ---------- Integrations / site members ----------

export const integrationActions = {
  toggle: (id: string) =>
    set((s) => ({
      ...s,
      integrations: s.integrations.map((i) =>
        i.id === id
          ? { ...i, status: i.status === "connected" ? "disconnected" : "connected", connectedAt: i.status === "connected" ? i.connectedAt : new Date().toISOString() }
          : i,
      ),
    })),
};

export const siteMemberActions = {
  setRole: (siteMemberId: string, role: SiteRole) =>
    set((s) => ({
      ...s,
      siteMembers: s.siteMembers.map((m) => m.id === siteMemberId ? { ...m, role } : m),
    })),
  remove: (siteMemberId: string) =>
    set((s) => ({ ...s, siteMembers: s.siteMembers.filter((m) => m.id !== siteMemberId) })),
  add: (projectId: string, memberId: string, role: SiteRole) => {
    const id = newId("sm");
    set((s) => ({ ...s, siteMembers: [...s.siteMembers, { id, projectId, memberId, role }] }));
    return id;
  },
};
