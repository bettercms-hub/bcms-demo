/**
 * BetterCMS — Operational entity model.
 *
 * Domain ownership:
 * - Workspace: Projects, Members, ApiKeys, Webhooks, Domains, Integrations,
 *   AuditLog, Subscription, Invoices, UsageMetrics, Notifications.
 * - Project (= Site): Website, Collections, Components, Media + site-level
 *   EnvironmentVariables, Redirects, CustomCodeBlocks, Backups, SiteMembers,
 *   SiteEnvironments.
 * - Page: Sections + per-page SEO, custom code, visibility, publishing state,
 *   revisions.
 *
 * Field shapes mirror eventual table columns so the next phase can drop
 * them into Postgres unchanged.
 */

export type ID = string;
export type ISODate = string;

// ===== Workspace + projects =====

/**
 * Two layer plan model.
 * Workspace plan: the team container (projects + people). Free, Company, Agency.
 * Site plan: powers one live site. Free (Starter), Basic, Pro, Team, Enterprise.
 * Team and Enterprise workspaces are managed account level deals shown in their
 * own workspace with managed billing.
 */
export type WorkspacePlanId = "free" | "company" | "agency" | "team" | "enterprise";
export type SitePlanId = "free" | "basic" | "pro" | "team" | "enterprise";

/** Seat types. Viewer and reviewer are free and unlimited; the rest are paid per role. */
export type SeatRole = "viewer" | "reviewer" | "editor" | "marketer" | "developer";

/** Demo billing state for a workspace. Presented, never processed. */
export interface WorkspaceBillingInfo {
  cycle: "monthly" | "yearly";
  /** Team and Enterprise: invoice based contract with a named human, no self serve card. */
  managed?: {
    contactName: string;
    contactTitle?: string;
    contactEmail?: string;
    note?: string;
  };
  /** Self serve card on file (demo, Dodo Payments test mode). */
  card?: { brand: string; last4: string; expMonth: number; expYear: number };
  renewalDate?: ISODate;
  contractLabel?: string;
}

/** Partly consumed usage for one site, current period. */
export interface SiteUsage {
  bandwidthGB: number;
  storageGB: number;
  apiRequests: number;
  aiCreditsUsed: number;
  localesUsed?: number;
  formSubmissions?: number;
}

export interface Workspace {
  id: ID;
  slug: string;
  name: string;
  /** Optional workspace logo — a data URL or remote image URL. Falls back to initials. */
  logoUrl?: string;
  projectIds: ID[];
  memberIds: ID[];
  planId?: ID;
  createdAt?: ISODate;
  /** Two layer plan model: the workspace layer. */
  workspacePlan?: WorkspacePlanId;
  /** Agency workspaces can white-label the workspace chrome. */
  whiteLabel?: boolean;
  billing?: WorkspaceBillingInfo;
}

export type WorkspaceRole =
  | "owner"
  | "admin"
  | "editor"
  | "content_manager"
  | "developer"
  | "viewer";

export type MemberStatus = "active" | "invited" | "suspended";

export interface Member {
  id: ID;
  name: string;
  email: string;
  role: WorkspaceRole;
  avatarUrl?: string;
  twoFactorEnabled?: boolean;
  lastActiveAt?: ISODate;
  status?: MemberStatus;
  invitedAt?: ISODate;
  /**
   * Seat type for billing. Viewer and reviewer seats are free and unlimited.
   * Editor, marketer and developer seats are paid per role. Owners hold a
   * free owner seat and are never billed, so they carry no seat value.
   */
  seat?: SeatRole;
  /** Agency feature: this person is also a guest in the named client workspace. */
  guestOf?: string;
}

export interface Invitation {
  id: ID;
  workspaceId: ID;
  email: string;
  role: WorkspaceRole;
  invitedBy: ID;
  createdAt: ISODate;
  expiresAt: ISODate;
  status: "pending" | "accepted" | "revoked";
}

/** How a project uses BetterCMS: content-only API, or fully hosted by us. */
export type ProjectKind = "headless" | "managed";
export type ProjectFramework = "nextjs" | "astro" | "nuxt" | "sveltekit" | "other";

/**
 * Delivery capabilities. The content core (schemas, entries, pages, media,
 * SEO) is identical either way; delivery decides who renders and serves it.
 * - hosted: BetterCMS Cloud renders and hosts the site.
 * - api: the Content Delivery API serves the same content to any frontend.
 * Both on = hybrid. `kind` stays as a derived label for back compat:
 * hosted ? "managed" : "headless". Switching modes never moves content.
 */
export interface ProjectDelivery {
  hosted: boolean;
  api: boolean;
}

/**
 * Frontend hosting for headless projects. The CMS side is identical in both
 * modes; this only decides who runs the customer's frontend code.
 * - external: they deploy to Vercel, Netlify, their own VPS. We keep the URLs
 *   and can ping their rebuild webhook.
 * - bettercms: we build and host the frontend from their GitHub repo, with
 *   staging and production environments on bettercms.site.
 */
export type FrontendHostingMode = "external" | "bettercms";

export interface FrontendHosting {
  mode: FrontendHostingMode;
  /** external: where their deployments live. */
  productionUrl?: string;
  stagingUrl?: string;
  /** bettercms: connected repo + build settings (auto detected, overridable). */
  repo?: string; // org/name
  branch?: string;
  rootDir?: string;
  packageManager?: "bun" | "pnpm" | "npm" | "yarn";
  nodeVersion?: string;
  installCommand?: string;
  buildCommand?: string;
  outputDir?: string;
  autoDeploy?: boolean;
}

export interface Project {
  id: ID;
  slug: string;
  name: string;
  description?: string;
  workspaceId: ID;
  websiteId: ID;
  collectionIds: ID[];
  componentIds: ID[];
  mediaIds: ID[];
  updatedAt: ISODate;
  publishState?: PublishState;
  /** Set for projects created via the New Project wizard. */
  kind?: ProjectKind;
  framework?: ProjectFramework;
  /** managed-only: how the code was brought in + linked repo/host details. */
  source?: "github" | "zip" | "template";
  repo?: string;
  /** Delivery capabilities: hosted rendering and/or the Content Delivery API. */
  delivery?: ProjectDelivery;
  /** Headless projects: who hosts the customer's frontend code. */
  hosting?: FrontendHosting;
  /** Two layer plan model: each live site sits on its own site plan. */
  sitePlan?: SitePlanId;
  /** Production domain for this site, e.g. northwind.com. */
  domain?: string;
  /** Current period usage against the site plan's included amounts. */
  usage?: SiteUsage;
  /** Agency workspaces: this site belongs to a client and can be billed to them. */
  clientSite?: boolean;
}

export interface Website {
  id: ID;
  projectId: ID;
  pageIds: ID[];
}

// ===== Pages + sections =====

export type SectionKind =
  | "hero" | "features" | "pricing" | "testimonials"
  | "logos" | "cta" | "faq" | "content" | "header" | "footer"
  | "navigation" | "workflow" | "integrations" | "stats"
  | "blog" | "docs" | "contact";

export type PageType = "static" | "dynamic" | "template";

export type PublishState =
  | "draft" | "review" | "approved" | "scheduled" | "published" | "archived";

export interface Page {
  id: ID;
  projectId: ID;
  slug: string;
  title: string;
  sectionIds: ID[];
  type?: PageType;
  publishState?: PublishState;
  scheduledAt?: ISODate;
  publishedAt?: ISODate;
  lastPublishedAt?: ISODate;
  revisionIds?: ID[];
  /** SEO */
  seoDescription?: string;
  metaTitle?: string;
  metaDescription?: string;
  canonical?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterImage?: string;
  indexing?: "index" | "noindex";
  structuredData?: string;
  /** Per-page custom code (HTML strings). */
  customHead?: string;
  customBody?: string;
  /** Last published snapshot for draft/published comparison. */
  publishedSnapshot?: PagePublishedSnapshot;
}

export interface PagePublishedSnapshot {
  capturedAt: ISODate;
  page: Omit<Page, "publishedSnapshot">;
  sections: Section[];
}

export interface EntryPublishedSnapshot {
  capturedAt: ISODate;
  entry: Omit<Entry, "publishedSnapshot">;
}

export interface PageRevision {
  id: ID;
  pageId: ID;
  version: number;
  authorId: ID;
  createdAt: ISODate;
  note?: string;
}

/** Snapshot-bearing revision used by the Publishing workflow. */
export interface Revision {
  id: ID;
  ownerKind: "page" | "entry";
  ownerId: ID;
  createdAt: ISODate;
  createdBy?: ID;
  label?: string;
  snapshot: PagePublishedSnapshot | EntryPublishedSnapshot;
}

/**
 * Composable content unit. Sections are made of trees of Blocks; container
 * blocks (grid, stack, card, container, columns…) carry `children`.
 * Field shape per kind lives in `src/lib/cms/blocks/registry.ts`.
 */
export type BlockKind =
  | "heading" | "paragraph" | "richText" | "quote" | "list" | "code"
  | "image" | "video"
  | "button" | "cta-group"
  | "container" | "stack" | "grid" | "columns" | "card-group" | "card"
  | "accordion" | "tabs"
  | "embed" | "html"
  // Site chrome composables (Phase 2 migration)
  | "nav-bar" | "nav-logo" | "nav-links" | "nav-search" | "footer-bar";

export interface Block {
  id: ID;
  kind: BlockKind;
  props: Record<string, unknown>;
  children?: Block[];
}

export interface SectionLayout {
  width?: "full" | "wide" | "default" | "narrow";
  align?: "left" | "center" | "right";
  paddingY?: "none" | "sm" | "md" | "lg" | "xl";
  paddingX?: "none" | "sm" | "md" | "lg";
  gap?: "none" | "sm" | "md" | "lg";
  columns?: 1 | 2 | 3 | 4;
  /** Stretch the section to fill the viewport and center its content. */
  fullHeight?: boolean;
}

export interface SectionStyle {
  background?: "transparent" | "surface" | "muted" | "accent" | "inverse" | "custom";
  backgroundColor?: string;
  backgroundImage?: string;
  /** Section-scoped theme. Dark flips the section (and every block inside)
   * onto the dark token set; light pins it light regardless of context. */
  theme?: "inherit" | "light" | "dark";
  /** 0-100 dark scrim over the background image, for text legibility.
   * Only meaningful (and only shown) when a background image is set. */
  overlayOpacity?: number;
  textTone?: "default" | "muted" | "inverse";
  fontScale?: "sm" | "md" | "lg";
  radius?: "none" | "sm" | "md" | "lg" | "xl";
  shadow?: "none" | "sm" | "md" | "lg";
  borderTop?: boolean;
  borderBottom?: boolean;
}

export type SectionSchemaType =
  | ""
  | "WebPageSection"
  | "FAQPage"
  | "Product"
  | "Article"
  | "Organization"
  | "BreadcrumbList";

export interface SectionSeo {
  anchorId?: string;
  schemaType?: SectionSchemaType;
  headingLevel?: "h1" | "h2" | "h3";
  excludeFromIndex?: boolean;
  ariaLabel?: string;
}

export type SectionHtmlTag =
  | "section" | "div" | "article" | "aside"
  | "header" | "footer" | "main" | "nav";

export type SectionVisibilityDevice = "all" | "mobile" | "tablet" | "desktop";
export type SectionVisibilityAuth = "any" | "authenticated" | "guest";

export interface SectionCustomAttribute {
  name: string;
  value: string;
}

export interface SectionAdvanced {
  /** Render this section under a different HTML tag (default: section). */
  htmlTag?: SectionHtmlTag;
  /** Hide the section from the public render without deleting it. */
  hidden?: boolean;
  /** Conditional visibility for the published page. */
  visibility?: {
    device?: SectionVisibilityDevice;
    authState?: SectionVisibilityAuth;
  };
  /** Extra Tailwind / utility classes appended to the wrapper. */
  customClassName?: string;
  /** Explicit DOM id — overrides seo.anchorId when set. */
  customId?: string;
  /** Custom HTML attributes (data-*, aria-*, role, etc.). */
  customAttributes?: SectionCustomAttribute[];
  /** Optional CSS scoped to this section instance via #id { ... }. */
  customCss?: string;
  /** z-index override for overlapping section effects. */
  zIndex?: number;
  /** Developer notes — not rendered, surfaced in inspectors. */
  notes?: string;
}

export interface Section {
  id: ID;
  pageId: ID;
  kind: SectionKind;
  name: string;
  /** Legacy flat props — preserved while migrating to blocks. */
  props: Record<string, unknown>;
  /** Composable block tree — canonical content going forward. */
  blocks?: Block[];
  componentId?: ID;
  /** Per-instance values keyed by component schema field name. Only used when componentId is set. */
  overrides?: Record<string, unknown>;
  /** Phase 7 — section-level layout, style and SEO overrides. */
  layout?: SectionLayout;
  style?: SectionStyle;
  seo?: SectionSeo;
  /** Phase 8 — expert controls (custom DOM, visibility, scoped CSS). */
  advanced?: SectionAdvanced;
  publishedSnapshot?: { capturedAt: ISODate; section: Omit<Section, "publishedSnapshot"> };
}



// ===== Components =====

export type ComponentState = "default" | "hover" | "active" | "focus" | "disabled";
export type ComponentVariantKind = "primary" | "secondary" | "ghost" | "outline" | "custom";

export interface ComponentMaster {
  id: ID;
  projectId: ID;
  name: string;
  kind: "master";
  schemaId?: ID;
  variantIds: ID[];
  states?: ComponentState[];
  variantKinds?: ComponentVariantKind[];
  customCss?: string;
  customJs?: string;
  /** Canonical block tree rendered by every bound instance. */
  rootBlocks?: Block[];
}


export interface ComponentVariant {
  id: ID;
  componentId: ID;
  name: string;
  kind?: ComponentVariantKind;
}

export interface ComponentInstance {
  id: ID;
  componentId: ID;
  variantId?: ID;
  overrides: Record<string, unknown>;
  state: ComponentState;
}

// ===== Schema =====

export type SchemaFieldType =
  | "text" | "richText" | "number" | "boolean" | "date"
  | "image" | "file" | "reference" | "multiReference" | "select"
  | "url" | "email" | "json" | "code" | "color" | "componentRef";

export interface SchemaFieldValidation {
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
}

export type SchemaFieldUI =
  | "segmented"
  | "icons"
  | "chips"
  | "switch"
  | "stepper"
  | "select";

export interface SchemaField {
  id: ID;
  name: string;
  label: string;
  type: SchemaFieldType;
  required?: boolean;
  refCollectionId?: ID;
  refComponentId?: ID;
  options?: string[];
  groupId?: ID | null;
  description?: string;
  placeholder?: string;
  defaultValue?: unknown;
  unique?: boolean;
  localized?: boolean;
  validation?: SchemaFieldValidation;
  hiddenInList?: boolean;
  /** Optional UI hint to override the default control for this field. */
  ui?: SchemaFieldUI;
  /** For `ui: "icons"`: maps option value → lucide icon name. */
  icons?: Record<string, string>;
  /** For `ui: "chips" | "segmented"`: maps option value → short display label. */
  optionLabels?: Record<string, string>;
}

export interface SchemaFieldGroup {
  id: ID;
  name: string;
  label: string;
  description?: string;
  collapsed?: boolean;
  /** Optional accent color (hex / css variable) for the group header. */
  color?: string;
}


export interface Schema {
  id: ID;
  ownerType: "collection" | "component";
  ownerId: ID;
  fields: SchemaField[];
  groups?: SchemaFieldGroup[];
  titleFieldName?: string;
  listFieldNames?: string[];
}

// ===== Collections + entries =====

export interface Collection {
  id: ID;
  projectId: ID;
  name: string;
  slug: string;
  schemaId: ID;
  entryIds: ID[];
}

export interface Entry {
  id: ID;
  collectionId: ID;
  title: string;
  fields: Record<string, unknown>;
  updatedAt: ISODate;
  status?: PublishState;
  scheduledAt?: ISODate;
  lastPublishedAt?: ISODate;
  revisionIds?: ID[];
  createdBy?: ID;
  updatedBy?: ID;
  publishedSnapshot?: EntryPublishedSnapshot;
  /** Editorial workflow (stages describe the journey between draft and publish). */
  workflowStageId?: ID;
  workflowAssigneeIds?: ID[];
  workflowDueDate?: ISODate;
  workflowLastMove?: { by: ID; at: ISODate; comment?: string };
  /** Typed asks: who was asked to do what on this entry, and why. */
  workflowRequests?: WorkflowRequest[];
  /** SEO */
  metaTitle?: string;
  metaDescription?: string;
  canonical?: string;
  ogImage?: string;
  indexing?: "index" | "noindex";
}

// ===== Editorial workflow =====

export interface WorkflowStage {
  id: ID;
  name: string;
  /** Chip/dot color from the workflow palette, hex. */
  color: string;
  /** Publishing is offered only from stages that gate it. */
  publishGate?: boolean;
}

/** A project's editorial workflow: ordered custom stages. Draft, Scheduled,
 * Published and Archived remain system lifecycle; stages cover the middle. */
export interface ProjectWorkflow {
  id: ID;
  projectId: ID;
  stages: WorkflowStage[];
}

/** Why someone was pulled into an entry. Review = read and flag issues,
 * approval = sign off so it can ship, feedback = opinions, no gate. */
export type WorkflowRequestKind = "review" | "approval" | "feedback" | "task";

/** A typed ask on an entry: who was asked, for what, by whom, and why. */
export interface WorkflowRequest {
  id: ID;
  kind: WorkflowRequestKind;
  memberId: ID;
  /** Context that travels with the notification. */
  note?: string;
  requestedBy: ID;
  requestedAt: ISODate;
  due?: ISODate;
  status: "open" | "done";
}

export interface EntryComment {
  id: ID;
  entryId: ID;
  authorId?: ID;
  authorName: string;
  body: string;
  createdAt: ISODate;
  resolved?: boolean;
}

// ===== Media =====

export type MediaKind = "image" | "video" | "file";

export interface MediaFolder {
  id: ID;
  projectId: ID;
  parentId?: ID;
  name: string;
}

export interface MediaAsset {
  id: ID;
  projectId: ID;
  name: string;
  kind: MediaKind;
  url: string;
  thumbUrl?: string;
  size?: string;
  folderId?: ID;
  sizeBytes?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  optimized?: boolean;
  referencedBy?: ID[];
  uploadedAt?: ISODate;
  tags?: string[];
  altText?: string;
  caption?: string;
  favorite?: boolean;
  durationSec?: number;
}

// ===== Developer / API =====

export interface ApiKey {
  id: ID;
  workspaceId: ID;
  name: string;
  prefix: string;
  scopes: string[];
  lastUsedAt?: ISODate;
  createdBy: ID;
  createdAt: ISODate;
  revokedAt?: ISODate;
}

export type WebhookEvent =
  | "page.published" | "page.unpublished"
  | "collection.entry.created" | "collection.entry.updated" | "collection.entry.deleted"
  | "media.uploaded" | "member.invited" | "member.removed"
  | "site.deployed";

export interface Webhook {
  id: ID;
  workspaceId: ID;
  url: string;
  events: WebhookEvent[];
  secretPrefix: string;
  status: "active" | "paused" | "failing";
  lastDeliveryAt?: ISODate;
  createdAt: ISODate;
}

export interface WebhookDelivery {
  id: ID;
  webhookId: ID;
  event: WebhookEvent;
  statusCode: number;
  durationMs: number;
  createdAt: ISODate;
}

// ===== Domains, integrations =====

export type DomainStatus = "pending" | "verifying" | "active" | "failed";

export interface Domain {
  id: ID;
  workspaceId?: ID;
  projectId?: ID;
  host: string;
  status: DomainStatus;
  primary?: boolean;
  sslStatus?: "issued" | "pending" | "failed";
  addedAt: ISODate;
}

export interface Integration {
  id: ID;
  workspaceId: ID;
  provider: string;
  label: string;
  status: "connected" | "disconnected" | "error";
  connectedAt?: ISODate;
}

// ===== Audit + notifications =====

export interface AuditLogEntry {
  id: ID;
  workspaceId: ID;
  actorId: ID;
  action: string;
  entityType: string;
  entityId?: ID;
  entityLabel?: string;
  diff?: Record<string, unknown>;
  createdAt: ISODate;
}

export interface Notification {
  id: ID;
  workspaceId: ID;
  kind: "info" | "success" | "warning" | "error";
  title: string;
  body?: string;
  readAt?: ISODate;
  createdAt: ISODate;
}

// ===== Billing + usage =====

export type UsageMetricKey =
  | "projects" | "api_calls" | "storage" | "bandwidth"
  | "sites" | "ai_credits" | "seats" | "entries" | "uploads";

export interface UsageMetric {
  workspaceId: ID;
  metric: UsageMetricKey;
  period: string; // e.g. "2026-06"
  value: number;
  limit: number;
}

export interface Plan {
  id: ID;
  name: string;
  priceMonthly: number;
  currency: string;
  seatsIncluded: number;
  limits: Partial<Record<UsageMetricKey, number>>;
  features: string[];
}

export interface Subscription {
  workspaceId: ID;
  planId: ID;
  status: "trialing" | "active" | "past_due" | "canceled";
  currentPeriodEnd: ISODate;
  seats: number;
}

export interface Invoice {
  id: ID;
  workspaceId: ID;
  number: string;
  amount: number;
  currency: string;
  status: "paid" | "open" | "void" | "failed";
  periodStart: ISODate;
  periodEnd: ISODate;
  issuedAt: ISODate;
  pdfUrl?: string;
}

// ===== Project-scoped config =====

export type EnvScope = "dev" | "prod" | "all";

export interface EnvironmentVariable {
  id: ID;
  projectId: ID;
  key: string;
  value: string;
  scope: EnvScope;
  updatedAt: ISODate;
}

export interface Redirect {
  id: ID;
  projectId: ID;
  from: string;
  to: string;
  type: 301 | 302;
  enabled: boolean;
}

export type CustomCodeLocation = "head" | "bodyStart" | "bodyEnd";
export type CustomCodeLanguage = "html" | "css" | "js" | "jsonld";

export interface CustomCodeBlock {
  id: ID;
  scope: "site" | "page";
  projectId: ID;
  pageId?: ID;
  location: CustomCodeLocation;
  language: CustomCodeLanguage;
  content: string;
  enabled: boolean;
  updatedAt: ISODate;
}

export interface Backup {
  id: ID;
  projectId: ID;
  label: string;
  createdAt: ISODate;
  sizeBytes: number;
  kind: "auto" | "manual";
}

export interface SiteEnvironment {
  id: ID;
  projectId: ID;
  kind: "staging" | "production";
  url: string;
  lastDeployAt?: ISODate;
  status?: "ready" | "building" | "failed";
}

// ===== Site permissions =====

export type SiteRole =
  | "site_manager" | "designer" | "content_editor" | "marketer" | "reviewer" | "viewer";

export type PermissionResource =
  | "pages" | "components" | "collections" | "media"
  | "seo" | "publishing" | "analytics" | "settings";

export interface PermissionLevel {
  view: boolean;
  edit: boolean;
  publish?: boolean;
}

export type SitePermissionMatrix = Record<SiteRole, Record<PermissionResource, PermissionLevel>>;

export interface SiteMember {
  id: ID;
  projectId: ID;
  memberId: ID;
  role: SiteRole;
}

// ===== Tree =====

export type TreeNodeKind =
  | "group" | "page" | "section" | "block" | "collection" | "entry"
  | "component" | "media" | "settings";

export interface TreeNode {
  id: string;
  label: string;
  kind: TreeNodeKind;
  refId?: ID;
  children?: TreeNode[];
}
