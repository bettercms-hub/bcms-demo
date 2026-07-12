import type {
  ApiKey,
  AuditLogEntry,
  Backup,
  Collection,
  ComponentMaster,
  CustomCodeBlock,
  Domain,
  Entry,
  EnvironmentVariable,
  Integration,
  Invitation,
  Invoice,
  MediaAsset,
  MediaFolder,
  Member,
  Notification,
  Page,
  PageRevision,
  Plan,
  Project,
  Redirect,
  Schema,
  SeatRole,
  Section,
  SiteEnvironment,
  SiteMember,
  Subscription,
  UsageMetric,
  UsageMetricKey,
  Webhook,
  WebhookDelivery,
  Website,
  Workspace,
} from "./types";

/**
 * Six demo workspaces, one per plan tier, switchable without sign in:
 * Flowtrix (Agency, dogfood, default landing), Aarav Mehta (Free Workspace),
 * Northwind (Company), Pixelforge (Agency), Wayground (Team showcase),
 * Atlas Corp (Enterprise showcase).
 */
export const workspaces: Workspace[] = [
  {
    id: "ws_acme",
    slug: "flowtrix",
    name: "Flowtrix",
    logoUrl: "/flowtrix-logo.png",
    projectIds: ["pr_flowtrix_site", "pr_flowtrix_api", "pr_flowtrix_client"],
    memberIds: ["m_fx_owner", "m_fx_d1", "m_fx_d2", "m_fx_m1", "m_fx_e1", "m_fx_r1", "m_fx_r2"],
    workspacePlan: "agency",
    whiteLabel: true,
    billing: {
      cycle: "yearly",
      card: { brand: "Visa", last4: "6114", expMonth: 9, expYear: 2028 },
      renewalDate: "2027-03-10T00:00:00Z",
    },
    createdAt: "2025-09-01T00:00:00Z",
  },
  {
    id: "ws_aarav",
    slug: "aarav",
    name: "Aarav Mehta",
    projectIds: ["pr_aarav"],
    memberIds: ["m_aarav", "m_av_r1", "m_av_r2"],
    workspacePlan: "free",
    billing: { cycle: "monthly" },
    createdAt: "2026-04-18T00:00:00Z",
  },
  {
    id: "ws_northwind",
    slug: "northwind",
    name: "Northwind",
    projectIds: ["pr_northwind", "pr_nw_docs"],
    memberIds: [
      "m_jane", "m_dev", "m_alex", "m_priya",
      "m_nw_r1", "m_nw_r2", "m_nw_r3", "m_nw_r4",
      "m_mark", "m_nw_v2",
    ],
    workspacePlan: "company",
    billing: {
      cycle: "yearly",
      card: { brand: "Visa", last4: "4242", expMonth: 4, expYear: 2027 },
      renewalDate: "2027-01-15T00:00:00Z",
    },
    createdAt: "2025-11-02T00:00:00Z",
  },
  {
    id: "ws_pixelforge",
    slug: "pixelforge",
    name: "Pixelforge",
    projectIds: ["pr_pf_acme", "pr_pf_lumen", "pr_pf_studio"],
    memberIds: ["m_pf_owner", "m_pf_d1", "m_pf_d2", "m_pf_m1", "m_pf_e1", "m_pf_e2", "m_pf_r1", "m_pf_r2"],
    workspacePlan: "agency",
    whiteLabel: true,
    billing: {
      cycle: "yearly",
      card: { brand: "Mastercard", last4: "8823", expMonth: 11, expYear: 2027 },
      renewalDate: "2027-02-01T00:00:00Z",
    },
    createdAt: "2025-10-12T00:00:00Z",
  },
  {
    id: "ws_wayground",
    slug: "wayground",
    name: "Wayground",
    projectIds: ["pr_wayground"],
    memberIds: [
      "m_wg_owner",
      "m_wg_d1", "m_wg_d2", "m_wg_d3", "m_wg_d4", "m_wg_d5",
      "m_wg_m1", "m_wg_m2", "m_wg_m3", "m_wg_m4",
      "m_wg_e1", "m_wg_e2", "m_wg_e3", "m_wg_e4", "m_wg_e5", "m_wg_e6",
      "m_wg_r1", "m_wg_r2", "m_wg_v1", "m_wg_v2",
    ],
    workspacePlan: "team",
    billing: {
      cycle: "yearly",
      managed: {
        contactName: "Maya Chen",
        contactTitle: "Account manager",
        contactEmail: "maya.chen@bettercms.com",
        note: "Your plan and limits are managed on an annual contract. Reach out any time.",
      },
      renewalDate: "2027-03-01T00:00:00Z",
      contractLabel: "Annual contract, invoice based",
    },
    createdAt: "2025-06-20T00:00:00Z",
  },
  {
    id: "ws_atlas",
    slug: "atlas",
    name: "Atlas Corp",
    projectIds: ["pr_atlas"],
    memberIds: ["m_at_owner", ...Array.from({ length: 39 }, (_, i) => `m_at_${i + 1}`), "m_at_r1", "m_at_r2", "m_at_v1"],
    workspacePlan: "enterprise",
    billing: {
      cycle: "yearly",
      managed: {
        contactName: "Daniel Ross",
        contactTitle: "Dedicated account manager",
        contactEmail: "daniel.ross@bettercms.com",
        note: "Billing runs through your procurement process. Daniel handles everything.",
      },
      renewalDate: "2027-05-01T00:00:00Z",
      contractLabel: "Custom annual contract, invoice or PO",
    },
    createdAt: "2025-03-04T00:00:00Z",
  },
];

/* Atlas Corp roster: generated, deterministic. 39 people + owner, mixed roles. */
const ATLAS_FIRST = ["Imogen", "Ravi", "Sofia", "Mateo", "Hana", "Lucas", "Amara", "Jonas", "Leila", "Owen", "Naomi", "Diego", "Freya", "Kenji", "Zara"];
const ATLAS_LAST = ["Hale", "Patel", "Moreau", "Silva", "Sato", "Weber", "Okafor", "Berg", "Haddad", "Quinn", "Fischer", "Vargas", "Lindgren"];
const ATLAS_SEATS: SeatRole[] = ["developer", "editor", "marketer", "editor", "developer", "editor", "developer", "marketer", "editor", "developer"];
const atlasMembers: Member[] = Array.from({ length: 39 }, (_, i) => {
  const name = `${ATLAS_FIRST[i % ATLAS_FIRST.length]} ${ATLAS_LAST[(i * 3 + 1) % ATLAS_LAST.length]}`;
  return {
    id: `m_at_${i + 1}`,
    name,
    email: `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@atlascorp.com`,
    role: "editor" as const,
    seat: ATLAS_SEATS[i % ATLAS_SEATS.length],
    twoFactorEnabled: true,
    lastActiveAt: `2026-06-${String((i % 27) + 1).padStart(2, "0")}T09:00:00Z`,
    status: "active" as const,
  };
});

export const members: Member[] = [
  /* Flowtrix (us, dogfood). Agency workspace, white-label on. */
  { id: "m_fx_owner", name: "Himanshu Sahu", email: "himanshu@flowtrix.co", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-07-02T21:15:00Z", status: "active" },
  { id: "m_fx_d1", name: "Rohan Iyer", email: "rohan@flowtrix.co", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-07-02T18:40:00Z", status: "active" },
  { id: "m_fx_d2", name: "Elena Costa", email: "elena@flowtrix.co", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-07-01T15:05:00Z", status: "active" },
  { id: "m_fx_m1", name: "Tara Nolan", email: "tara@flowtrix.co", role: "admin", seat: "marketer", twoFactorEnabled: true, lastActiveAt: "2026-07-02T11:30:00Z", status: "active" },
  { id: "m_fx_e1", name: "Sam Okafor", email: "sam@flowtrix.co", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-30T09:20:00Z", status: "active" },
  { id: "m_fx_r1", name: "Nadia Reyes", email: "nadia@flowtrix.co", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-28T14:00:00Z", status: "active" },
  { id: "m_fx_r2", name: "Piet Janssen", email: "piet@flowtrix.co", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-25T10:45:00Z", status: "active" },

  /* Aarav Mehta (indie). Free workspace, 2 free reviewers, 0 paid seats. */
  { id: "m_aarav", name: "Aarav Mehta", email: "aarav@aarav.dev", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-07-02T23:10:00Z", status: "active" },
  { id: "m_av_r1", name: "Kavya Rao", email: "kavya.rao@gmail.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-29T19:30:00Z", status: "active" },
  { id: "m_av_r2", name: "Dev Sharma", email: "dev.sharma@outlook.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, status: "invited", invitedAt: "2026-06-26T12:00:00Z" },

  /* Northwind (Series A SaaS). Company workspace, 3 paid seats, 4 reviewers, 2 viewers. */
  { id: "m_jane", name: "Jane Park", email: "jane@northwind.com", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-06-15T08:12:00Z", status: "active" },
  { id: "m_dev", name: "Devon Lee", email: "devon@northwind.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-06-12T22:05:00Z", status: "active" },
  { id: "m_alex", name: "Alex Rivera", email: "alex@northwind.com", role: "admin", seat: "marketer", twoFactorEnabled: true, lastActiveAt: "2026-06-14T17:40:00Z", status: "active" },
  { id: "m_priya", name: "Priya Singh", email: "priya@northwind.com", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-13T09:21:00Z", status: "active" },
  { id: "m_nw_r1", name: "Lena Fischer", email: "lena@northwind.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-11T16:00:00Z", status: "active" },
  { id: "m_nw_r2", name: "Tom Adeyemi", email: "tom@northwind.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-10T13:25:00Z", status: "active" },
  { id: "m_nw_r3", name: "Grace Lin", email: "grace@northwind.com", role: "viewer", seat: "reviewer", twoFactorEnabled: true, lastActiveAt: "2026-06-09T10:10:00Z", status: "active" },
  { id: "m_nw_r4", name: "Omar Haddad", email: "omar@northwind.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-05T09:00:00Z", status: "active" },
  { id: "m_mark", name: "Marko Hahn", email: "marko@northwind.com", role: "viewer", seat: "viewer", twoFactorEnabled: false, status: "invited", invitedAt: "2026-06-10T14:00:00Z" },
  { id: "m_nw_v2", name: "Ines Torres", email: "ines@northwind.com", role: "viewer", seat: "viewer", twoFactorEnabled: false, lastActiveAt: "2026-06-02T08:45:00Z", status: "active" },

  /* Pixelforge (design agency). Agency workspace, white-label on, one guest into a client workspace. */
  { id: "m_pf_owner", name: "Noor Kapadia", email: "noor@pixelforge.studio", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-07-01T17:50:00Z", status: "active" },
  { id: "m_pf_d1", name: "Felix Braun", email: "felix@pixelforge.studio", role: "developer", seat: "developer", guestOf: "Acme Industries", twoFactorEnabled: true, lastActiveAt: "2026-07-02T09:35:00Z", status: "active" },
  { id: "m_pf_d2", name: "Yuki Tanaka", email: "yuki@pixelforge.studio", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-06-30T20:15:00Z", status: "active" },
  { id: "m_pf_m1", name: "Sasha Bell", email: "sasha@pixelforge.studio", role: "admin", seat: "marketer", twoFactorEnabled: true, lastActiveAt: "2026-07-01T12:00:00Z", status: "active" },
  { id: "m_pf_e1", name: "Theo Ncube", email: "theo@pixelforge.studio", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-29T15:40:00Z", status: "active" },
  { id: "m_pf_e2", name: "Clara Meyer", email: "clara@pixelforge.studio", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-27T11:10:00Z", status: "active" },
  { id: "m_pf_r1", name: "Jon Berg", email: "jon@pixelforge.studio", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-24T16:20:00Z", status: "active" },
  { id: "m_pf_r2", name: "Mira Solis", email: "mira@pixelforge.studio", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-22T10:05:00Z", status: "active" },

  /* Wayground (scale-up). Team plan, 15 included seats: 5 developers, 4 marketers, 6 editors. */
  { id: "m_wg_owner", name: "Ruth Ellison", email: "ruth@wayground.com", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-07-02T08:00:00Z", status: "active" },
  { id: "m_wg_d1", name: "Andre Volkov", email: "andre@wayground.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-07-02T16:30:00Z", status: "active" },
  { id: "m_wg_d2", name: "Bea Santos", email: "bea@wayground.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-07-01T14:20:00Z", status: "active" },
  { id: "m_wg_d3", name: "Chris Whitfield", email: "chris@wayground.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-06-30T18:45:00Z", status: "active" },
  { id: "m_wg_d4", name: "Dana Kovacs", email: "dana@wayground.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-06-29T09:15:00Z", status: "active" },
  { id: "m_wg_d5", name: "Emil Norgaard", email: "emil@wayground.com", role: "developer", seat: "developer", twoFactorEnabled: true, lastActiveAt: "2026-06-28T13:50:00Z", status: "active" },
  { id: "m_wg_m1", name: "Farah Aziz", email: "farah@wayground.com", role: "admin", seat: "marketer", twoFactorEnabled: true, lastActiveAt: "2026-07-01T10:30:00Z", status: "active" },
  { id: "m_wg_m2", name: "Gus Marino", email: "gus@wayground.com", role: "admin", seat: "marketer", twoFactorEnabled: false, lastActiveAt: "2026-06-30T15:00:00Z", status: "active" },
  { id: "m_wg_m3", name: "Hilde Braaten", email: "hilde@wayground.com", role: "admin", seat: "marketer", twoFactorEnabled: true, lastActiveAt: "2026-06-27T12:40:00Z", status: "active" },
  { id: "m_wg_m4", name: "Ivan Petrov", email: "ivan@wayground.com", role: "admin", seat: "marketer", twoFactorEnabled: false, lastActiveAt: "2026-06-26T17:25:00Z", status: "active" },
  { id: "m_wg_e1", name: "Julia Krause", email: "julia@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-07-02T11:00:00Z", status: "active" },
  { id: "m_wg_e2", name: "Kofi Mensah", email: "kofi@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-07-01T09:45:00Z", status: "active" },
  { id: "m_wg_e3", name: "Lucia Romero", email: "lucia@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: true, lastActiveAt: "2026-06-29T14:35:00Z", status: "active" },
  { id: "m_wg_e4", name: "Marta Nowak", email: "marta@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-28T10:20:00Z", status: "active" },
  { id: "m_wg_e5", name: "Nils Ekberg", email: "nils@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: false, lastActiveAt: "2026-06-26T16:55:00Z", status: "active" },
  { id: "m_wg_e6", name: "Olive Chen", email: "olive@wayground.com", role: "content_manager", seat: "editor", twoFactorEnabled: true, lastActiveAt: "2026-06-25T08:30:00Z", status: "active" },
  { id: "m_wg_r1", name: "Pat Doyle", email: "pat@wayground.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-24T13:10:00Z", status: "active" },
  { id: "m_wg_r2", name: "Quinn Foster", email: "quinn@wayground.com", role: "viewer", seat: "reviewer", twoFactorEnabled: false, lastActiveAt: "2026-06-23T09:50:00Z", status: "active" },
  { id: "m_wg_v1", name: "Rita Campos", email: "rita@wayground.com", role: "viewer", seat: "viewer", twoFactorEnabled: false, lastActiveAt: "2026-06-20T15:05:00Z", status: "active" },
  { id: "m_wg_v2", name: "Stefan Wolf", email: "stefan@wayground.com", role: "viewer", seat: "viewer", twoFactorEnabled: false, lastActiveAt: "2026-06-18T11:40:00Z", status: "active" },

  /* Atlas Corp (enterprise). 40 seats, custom roles, SSO and SCIM on. */
  { id: "m_at_owner", name: "Vera Atlas", email: "vera.atlas@atlascorp.com", role: "owner", twoFactorEnabled: true, lastActiveAt: "2026-07-02T07:30:00Z", status: "active" },
  ...atlasMembers,
  { id: "m_at_r1", name: "Wes Trent", email: "wes.trent@atlascorp.com", role: "viewer", seat: "reviewer", twoFactorEnabled: true, lastActiveAt: "2026-06-30T12:00:00Z", status: "active" },
  { id: "m_at_r2", name: "Xin Zhao", email: "xin.zhao@atlascorp.com", role: "viewer", seat: "reviewer", twoFactorEnabled: true, lastActiveAt: "2026-06-29T10:30:00Z", status: "active" },
  { id: "m_at_v1", name: "Yara Nassar", email: "yara.nassar@atlascorp.com", role: "viewer", seat: "viewer", twoFactorEnabled: true, lastActiveAt: "2026-06-28T09:00:00Z", status: "active" },
];

export const invitations: Invitation[] = [
  { id: "inv_1", workspaceId: "ws_acme", email: "lena@partner.io", role: "viewer", invitedBy: "m_fx_owner", createdAt: "2026-06-28T10:00:00Z", expiresAt: "2026-07-05T10:00:00Z", status: "pending" },
];

export const projects: Project[] = [
  /* Flowtrix (dogfood): flowtrix.co on Pro, bettercms.ai on Pro (headless), one client site on Basic. */
  { id: "pr_flowtrix_site", slug: "flowtrix-co", name: "Flowtrix.co", description: "Our marketing site, hosted on BetterCMS Cloud. The same content also feeds our mobile app over the API (hybrid delivery).", workspaceId: "ws_acme", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-07-01T16:20:00Z", publishState: "published", kind: "managed", delivery: { hosted: true, api: true }, sitePlan: "pro", domain: "flowtrix.co", usage: { bandwidthGB: 180, storageGB: 95, apiRequests: 410_000, aiCreditsUsed: 1_450, localesUsed: 2 } },
  { id: "pr_flowtrix_api", slug: "bettercms-ai", name: "BetterCMS.ai", description: "Marketing site for BetterCMS, headless on our own API.", workspaceId: "ws_acme", websiteId: "", collectionIds: ["c_posts", "c_authors", "c_categories"], componentIds: [], mediaIds: ["md_fx_1", "md_fx_2", "md_fx_3", "md_fx_4", "md_fx_5", "md_fx_6", "md_fx_7", "md_fx_8", "md_fx_9", "md_fx_10", "md_fx_11", "md_fx_12", "md_fx_13", "md_fx_14", "md_fx_15", "md_fx_16"], updatedAt: "2026-07-02T10:00:00Z", publishState: "published", kind: "headless", framework: "nextjs", delivery: { hosted: false, api: true }, hosting: { mode: "bettercms", repo: "flowtrix/bettercms-ai", branch: "main", rootDir: "/", packageManager: "bun", nodeVersion: "20", installCommand: "bun install", buildCommand: "bun run build", outputDir: ".next", autoDeploy: true }, sitePlan: "pro", domain: "bettercms.ai", usage: { bandwidthGB: 240, storageGB: 60, apiRequests: 620_000, aiCreditsUsed: 2_100, localesUsed: 1 } },
  { id: "pr_flowtrix_client", slug: "client-harbor", name: "Harbor & Co", description: "Client site, billed through Flowtrix.", workspaceId: "ws_acme", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-06-24T09:40:00Z", publishState: "published", kind: "managed", delivery: { hosted: true, api: false }, sitePlan: "basic", domain: "harborandco.com", clientSite: true, usage: { bandwidthGB: 62, storageGB: 22, apiRequests: 120_000, aiCreditsUsed: 310, localesUsed: 1 } },

  /* Aarav Mehta (indie): one site on the Free (Starter) plan. Trial credits nearly spent. */
  { id: "pr_aarav", slug: "aarav", name: "aarav.dev", description: "Personal site and blog.", workspaceId: "ws_aarav", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-07-02T22:30:00Z", publishState: "published", kind: "managed", sitePlan: "free", domain: "aarav.dev", usage: { bandwidthGB: 3.2, storageGB: 1.4, apiRequests: 18_000, aiCreditsUsed: 60 } },

  /* Northwind (Series A SaaS): marketing site on Pro (approaching limits), docs on Basic. */
  { id: "pr_northwind", slug: "northwind", name: "Northwind.com", description: "Marketing site for the Northwind platform.", workspaceId: "ws_northwind", websiteId: "wb_northwind", collectionIds: ["c_posts", "c_authors", "c_categories"], componentIds: ["cmp_header", "cmp_footer", "cmp_pricing_card"], mediaIds: ["md_1", "md_2", "md_3", "md_4", "md_5", "md_6"], updatedAt: "2026-06-14T18:21:00Z", publishState: "published", kind: "managed", sitePlan: "pro", domain: "northwind.com", usage: { bandwidthGB: 420, storageGB: 210, apiRequests: 780_000, aiCreditsUsed: 2_600, localesUsed: 3 } },
  { id: "pr_nw_docs", slug: "northwind-docs", name: "Docs", description: "Product documentation.", workspaceId: "ws_northwind", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-06-11T12:05:00Z", publishState: "published", kind: "managed", sitePlan: "basic", domain: "docs.northwind.com", usage: { bandwidthGB: 90, storageGB: 40, apiRequests: 220_000, aiCreditsUsed: 400, localesUsed: 2 } },

  /* Pixelforge (agency): two client sites plus their own. */
  { id: "pr_pf_acme", slug: "client-acme", name: "Acme Industries", description: "Client site, can be billed to the client.", workspaceId: "ws_pixelforge", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-07-01T11:25:00Z", publishState: "published", kind: "managed", sitePlan: "pro", domain: "client-acme.com", clientSite: true, usage: { bandwidthGB: 260, storageGB: 120, apiRequests: 540_000, aiCreditsUsed: 1_200, localesUsed: 2 } },
  { id: "pr_pf_lumen", slug: "client-lumen", name: "Lumen", description: "Client site, can be billed to the client.", workspaceId: "ws_pixelforge", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-06-26T14:10:00Z", publishState: "published", kind: "managed", sitePlan: "basic", domain: "client-lumen.io", clientSite: true, usage: { bandwidthGB: 45, storageGB: 18, apiRequests: 90_000, aiCreditsUsed: 250, localesUsed: 1 } },
  { id: "pr_pf_studio", slug: "pixelforge-studio", name: "Pixelforge Studio", description: "Our own portfolio site.", workspaceId: "ws_pixelforge", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-06-30T17:45:00Z", publishState: "published", kind: "managed", sitePlan: "pro", domain: "pixelforge.studio", usage: { bandwidthGB: 140, storageGB: 85, apiRequests: 310_000, aiCreditsUsed: 900, localesUsed: 2 } },

  /* Wayground (scale-up): one high scale site on the Team plan. */
  { id: "pr_wayground", slug: "wayground", name: "Wayground.com", description: "Wayground's production site on the Team plan.", workspaceId: "ws_wayground", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-07-02T13:15:00Z", publishState: "published", kind: "managed", sitePlan: "team", domain: "wayground.com", usage: { bandwidthGB: 12_000, storageGB: 900, apiRequests: 6_400_000, aiCreditsUsed: 22_000, localesUsed: 6 } },

  /* Atlas Corp (enterprise): custom everything, generous limits, no hard caps. */
  { id: "pr_atlas", slug: "atlas-portal", name: "Atlas Portal", description: "Customer portal on a dedicated isolated environment.", workspaceId: "ws_atlas", websiteId: "", collectionIds: [], componentIds: [], mediaIds: [], updatedAt: "2026-07-02T06:50:00Z", publishState: "published", kind: "managed", sitePlan: "enterprise", domain: "portal.atlascorp.com", usage: { bandwidthGB: 48_000, storageGB: 3_200, apiRequests: 22_000_000, aiCreditsUsed: 61_000, localesUsed: 12 } },
];

export const websites: Website[] = [
  { id: "wb_northwind", projectId: "pr_northwind", pageIds: ["pg_home", "pg_pricing", "pg_about", "pg_contact", "pg_blog"] },
];

export const pages: Page[] = [
  { id: "pg_home", projectId: "pr_northwind", slug: "/", title: "Home", sectionIds: ["sc_home_nav", "sc_home_hero", "sc_home_logos", "sc_home_features", "sc_home_workflow", "sc_home_integrations", "sc_home_stats", "sc_home_pricing", "sc_home_testimonials", "sc_home_faq", "sc_home_blog", "sc_home_cta", "sc_home_footer"], seoDescription: "Northwind AI — the AI-powered workspace for modern product teams.", publishState: "published", publishedAt: "2026-06-10T09:00:00Z", indexing: "index" },
  { id: "pg_pricing", projectId: "pr_northwind", slug: "/pricing", title: "Pricing", sectionIds: ["sc_pricing_hero", "sc_pricing_table", "sc_pricing_faq"], publishState: "published", indexing: "index" },
  { id: "pg_about", projectId: "pr_northwind", slug: "/about", title: "About", sectionIds: ["sc_about_hero", "sc_about_content"], publishState: "published", indexing: "index" },
  { id: "pg_contact", projectId: "pr_northwind", slug: "/contact", title: "Contact", sectionIds: ["sc_contact_hero", "sc_contact_form"], publishState: "draft", indexing: "index" },
  { id: "pg_blog", projectId: "pr_northwind", slug: "/blog", title: "Blog", sectionIds: ["sc_blog_hero"], publishState: "scheduled", scheduledAt: "2026-06-25T09:00:00Z", indexing: "index" },
];

export const pageRevisions: PageRevision[] = [
  { id: "rev_1", pageId: "pg_home", version: 4, authorId: "m_jane", createdAt: "2026-06-10T09:00:00Z", note: "Update hero copy" },
  { id: "rev_2", pageId: "pg_home", version: 3, authorId: "m_alex", createdAt: "2026-06-08T14:20:00Z" },
  { id: "rev_3", pageId: "pg_home", version: 2, authorId: "m_jane", createdAt: "2026-06-01T10:00:00Z" },
  { id: "rev_4", pageId: "pg_home", version: 1, authorId: "m_jane", createdAt: "2026-05-20T11:30:00Z", note: "Initial publish" },
];

export const sections: Section[] = [
  { id: "sc_home_nav", pageId: "pg_home", kind: "navigation", name: "Navigation", props: { logo: "Northwind AI", linksMode: "auto", linksLimit: 5, menuMode: "current-page-sections", menuLabel: "On this page", showSearch: true, language: "EN", ctaText: "Start free", ctaHref: "/signup" } },
  { id: "sc_home_hero", pageId: "pg_home", kind: "hero", name: "Hero", props: { eyebrow: "Northwind AI · v2", heading: "The AI workspace for modern product teams", subheading: "<p>Plan, build, and ship with autonomous agents that live inside your tools. No prompts to memorize. No glue code to maintain.</p>", ctaText: "Start free", ctaHref: "/signup", spacing: "spacious" } },
  { id: "sc_home_logos", pageId: "pg_home", kind: "logos", name: "Trusted by", props: { heading: "Trusted by teams at", count: 6, background: "muted", spacing: "compact" } },
  { id: "sc_home_features", pageId: "pg_home", kind: "features", name: "Features", props: { heading: "Everything your team needs, in one workspace", subheading: "Northwind unifies docs, tasks, and agents so context never gets lost.", columns: 3 } },
  { id: "sc_home_workflow", pageId: "pg_home", kind: "workflow", name: "AI workflow", props: { heading: "From idea to shipped in four steps", subheading: "Agents handle the busywork while your team stays in flow.", steps: 4, background: "muted" } },
  { id: "sc_home_integrations", pageId: "pg_home", kind: "integrations", name: "Integrations", props: { heading: "Connect the tools you already use", subheading: "Native sync with Linear, GitHub, Slack, Notion, Figma, and 30+ more.", count: 12 } },
  { id: "sc_home_stats", pageId: "pg_home", kind: "stats", name: "Stats", props: { heading: "Trusted at scale", count: 4, background: "inverse" } },
  { id: "sc_home_pricing", pageId: "pg_home", kind: "pricing", name: "Pricing", props: { heading: "Simple, transparent pricing", subheading: "Start free. Upgrade when your team needs more seats or storage.", plans: 3 } },
  { id: "sc_home_testimonials", pageId: "pg_home", kind: "testimonials", name: "Testimonials", props: { heading: "Loved by product teams", layout: "grid" } },
  { id: "sc_home_faq", pageId: "pg_home", kind: "faq", name: "FAQ", props: { heading: "Frequently asked questions", items: 6, background: "muted" } },
  { id: "sc_home_blog", pageId: "pg_home", kind: "blog", name: "From the blog", props: { heading: "From the Northwind blog", subheading: "Engineering, design, and product notes from our team.", count: 3 } },
  { id: "sc_home_cta", pageId: "pg_home", kind: "cta", name: "CTA", props: { heading: "Ready to give your team superpowers?", subheading: "Spin up a workspace in under a minute.", ctaText: "Start free", ctaHref: "/signup", background: "accent" } },
  { id: "sc_home_footer", pageId: "pg_home", kind: "footer", name: "Footer", props: { tagline: "Northwind AI · Built for product teams", copyright: "© 2026 Northwind, Inc." } },
  { id: "sc_pricing_hero", pageId: "pg_pricing", kind: "hero", name: "Hero", props: { heading: "Simple, transparent pricing" } },
  { id: "sc_pricing_table", pageId: "pg_pricing", kind: "pricing", name: "Plans", props: { plans: 3 } },
  { id: "sc_pricing_faq", pageId: "pg_pricing", kind: "faq", name: "FAQ", props: {} },
  { id: "sc_about_hero", pageId: "pg_about", kind: "hero", name: "Hero", props: { heading: "Built by a small team" } },
  { id: "sc_about_content", pageId: "pg_about", kind: "content", name: "Story", props: {} },
  { id: "sc_contact_hero", pageId: "pg_contact", kind: "hero", name: "Hero", props: { heading: "Get in touch" } },
  { id: "sc_contact_form", pageId: "pg_contact", kind: "contact", name: "Contact form", props: { heading: "Talk to our team", subheading: "We'll reply within one business day.", ctaText: "Send message", ctaHref: "#" } },
  { id: "sc_blog_hero", pageId: "pg_blog", kind: "hero", name: "Hero", props: { heading: "Field notes" } },
];

export const components: ComponentMaster[] = [
  {
    id: "cmp_header", projectId: "pr_northwind", name: "Header", kind: "master", variantIds: [], schemaId: "sch_cmp_header",
    states: ["default", "hover", "active", "focus", "disabled"], variantKinds: ["primary"],
    rootBlocks: [
      { id: "b_hdr_1", kind: "heading", props: { text: "{{field:title}}", level: 3 } },
    ],
  },
  {
    id: "cmp_footer", projectId: "pr_northwind", name: "Footer", kind: "master", variantIds: [], schemaId: "sch_cmp_footer",
    states: ["default"], variantKinds: ["primary"],
    rootBlocks: [
      { id: "b_ftr_1", kind: "paragraph", props: { text: "{{field:copy}}", muted: true, align: "center" } },
    ],
  },
  {
    id: "cmp_pricing_card", projectId: "pr_northwind", name: "Pricing Card", kind: "master", variantIds: ["v_pc_starter", "v_pc_team"],
    schemaId: "sch_cmp_pricing_card", states: ["default", "hover", "active"], variantKinds: ["primary", "secondary"],
    rootBlocks: [
      { id: "b_pc_1", kind: "heading", props: { text: "{{field:plan}}", level: 3 } },
      { id: "b_pc_2", kind: "paragraph", props: { text: "{{field:price}}" } },
      { id: "b_pc_3", kind: "paragraph", props: { text: "{{field:cta}}", muted: true } },
    ],
  },
];


export const schemas: Schema[] = [
  {
    id: "sch_posts",
    ownerType: "collection",
    ownerId: "c_posts",
    titleFieldName: "title",
    listFieldNames: ["slug", "author", "published"],
    groups: [
      { id: "g_general", name: "general", label: "General" },
      { id: "g_seo", name: "seo", label: "SEO" },
      { id: "g_publishing", name: "publishing", label: "Publishing" },
    ],
    fields: [
      { id: "f_title", name: "title", label: "Title", type: "text", required: true, groupId: "g_general" },
      { id: "f_slug", name: "slug", label: "Slug", type: "text", required: true, unique: true, groupId: "g_general", description: "URL segment, lowercase, hyphenated." },
      { id: "f_body", name: "body", label: "Body", type: "richText", groupId: "g_general" },
      { id: "f_author", name: "author", label: "Author", type: "reference", refCollectionId: "c_authors", groupId: "g_general" },
      { id: "f_category", name: "category", label: "Category", type: "reference", refCollectionId: "c_categories", groupId: "g_general" },
      { id: "f_cover", name: "cover", label: "Cover", type: "image", groupId: "g_seo" },
      { id: "f_seoTitle", name: "seoTitle", label: "Meta title", type: "text", groupId: "g_seo" },
      { id: "f_published", name: "published", label: "Published", type: "boolean", groupId: "g_publishing" },
    ],
  },
  {
    id: "sch_authors",
    ownerType: "collection",
    ownerId: "c_authors",
    titleFieldName: "name",
    listFieldNames: ["name", "bio"],
    fields: [
      { id: "f_name", name: "name", label: "Name", type: "text", required: true },
      { id: "f_bio", name: "bio", label: "Bio", type: "richText" },
      { id: "f_avatar", name: "avatar", label: "Avatar", type: "image" },
    ],
  },
  {
    id: "sch_categories",
    ownerType: "collection",
    ownerId: "c_categories",
    titleFieldName: "name",
    listFieldNames: ["slug"],
    fields: [
      { id: "f_name", name: "name", label: "Name", type: "text", required: true },
      { id: "f_slug", name: "slug", label: "Slug", type: "text", required: true, unique: true },
    ],
  },
  { id: "sch_cmp_header", ownerType: "component", ownerId: "cmp_header", fields: [
    { id: "f_logo", name: "logo", label: "Logo", type: "image" },
    { id: "f_title", name: "title", label: "Title", type: "text", defaultValue: "Northwind" },
  ] },
  { id: "sch_cmp_footer", ownerType: "component", ownerId: "cmp_footer", fields: [{ id: "f_copy", name: "copy", label: "Copyright", type: "text", defaultValue: "© Northwind" }] },

  { id: "sch_cmp_pricing_card", ownerType: "component", ownerId: "cmp_pricing_card", fields: [
    { id: "f_plan", name: "plan", label: "Plan", type: "text" },
    { id: "f_price", name: "price", label: "Price", type: "number" },
    { id: "f_cta", name: "cta", label: "CTA Label", type: "text" },
  ] },
];

export const collections: Collection[] = [
  { id: "c_posts", projectId: "pr_northwind", name: "Blog Posts", slug: "posts", schemaId: "sch_posts", entryIds: ["e_p1", "e_p2", "e_p3"] },
  { id: "c_authors", projectId: "pr_northwind", name: "Authors", slug: "authors", schemaId: "sch_authors", entryIds: ["e_a1", "e_a2"] },
  { id: "c_categories", projectId: "pr_northwind", name: "Categories", slug: "categories", schemaId: "sch_categories", entryIds: ["e_c1", "e_c2"] },
];

export const entries: Entry[] = [
  { id: "e_p1", collectionId: "c_posts", title: "Introducing Northwind v2", fields: { slug: "introducing-northwind-v2", published: true, author: "e_a1", category: "e_c1", cover: "https://images.unsplash.com/photo-1499951360447-b19be8fe80f5?auto=format&fit=crop&w=960&h=540&q=80" }, updatedAt: "2026-06-10T09:00:00Z", status: "published", createdBy: "m_jane", updatedBy: "m_jane" },
  { id: "e_p2", collectionId: "c_posts", title: "Why structured content wins", fields: { slug: "structured-content", published: true, author: "e_a2", category: "e_c1", cover: "https://images.unsplash.com/photo-1531297484001-80022131f5a1?auto=format&fit=crop&w=960&h=540&q=80" }, updatedAt: "2026-06-04T11:30:00Z", status: "published", createdBy: "m_alex", updatedBy: "m_priya" },
  { id: "e_p3", collectionId: "c_posts", title: "Workflows for small teams", fields: { slug: "workflows", published: false, author: "e_a1", category: "e_c2", cover: "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=960&h=540&q=80" }, updatedAt: "2026-05-28T16:12:00Z", status: "draft", createdBy: "m_priya", updatedBy: "m_priya" },
  { id: "e_a1", collectionId: "c_authors", title: "Jane Park", fields: { name: "Jane Park", bio: "Founder" }, updatedAt: "2026-05-01T00:00:00Z", status: "published" },
  { id: "e_a2", collectionId: "c_authors", title: "Alex Rivera", fields: { name: "Alex Rivera", bio: "Engineer" }, updatedAt: "2026-05-01T00:00:00Z", status: "published" },
  { id: "e_c1", collectionId: "c_categories", title: "Product", fields: { name: "Product", slug: "product" }, updatedAt: "2026-05-01T00:00:00Z", status: "published" },
  { id: "e_c2", collectionId: "c_categories", title: "Engineering", fields: { name: "Engineering", slug: "engineering" }, updatedAt: "2026-05-01T00:00:00Z", status: "published" },
];

// Every project ships with demo collections so the Content tab (and the entry
// editor it links into) is never empty. Projects with hand-written collections
// above (Northwind) are skipped.
(() => {
  const hasContent = new Set(collections.map((c) => c.projectId));
  const IMG = (id: string) =>
    `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=960&h=540&q=80`;
  // Topic tags shared by every seeded blog. Index is stable, so a post can
  // reference a tag entry by name via TAGS.indexOf(name).
  const TAGS = ["Product", "Engineering", "Design", "Company", "Announcements"];
  // Full blog posts: real schema fields, real copy. `authorIdx` points at the
  // Team members collection (e_<suf>_t<idx>); `tags` are tag names resolved to
  // tag entry ids at build time.
  const POST_DATA: {
    title: string;
    slug: string;
    cover: string;
    excerpt: string;
    authorIdx: number;
    category: string;
    tags: string[];
    readingTime: number;
    indexing: "index" | "noindex";
    body: string;
  }[] = [
    {
      title: "Launching our new site",
      slug: "launching-our-new-site",
      cover: IMG("1460925895917-afdab827c52f"),
      excerpt:
        "We rebuilt our marketing site on structured sections so the whole team can edit and publish without waiting on a deploy.",
      authorIdx: 0,
      category: "Company",
      tags: ["Company", "Announcements", "Product"],
      readingTime: 4,
      indexing: "index",
      body: [
        "<p>Today we launched a completely rebuilt marketing site, and the way we got here says as much as the pages themselves. Every screen is now assembled from structured sections that anyone on the team can edit, reorder, and publish without opening a code editor.</p>",
        "<h2>Why we rebuilt from scratch</h2>",
        "<p>Our old site had grown into a tangle of one-off templates. A small copy change meant a pull request, a review, and a deploy. Marketing waited on engineering for work that should have taken minutes, and the backlog only got longer.</p>",
        "<p>We wanted a site that the people closest to the message could own end to end. That meant moving away from bespoke pages and toward a shared library of sections with clear, editable fields.</p>",
        "<h2>What changed</h2>",
        "<ul><li>Every page is now a list of sections drawn from one reusable catalog.</li><li>Content lives in typed fields, so previews always match production.</li><li>Publishing is a single click, with a full draft and review history behind it.</li></ul>",
        "<blockquote>We shipped the new homepage, pricing page, and three landing pages in a single week.</blockquote>",
        "<p>This is only the first step. Over the next few releases we will open the same workflow to campaign pages and localized content, so every market can move at the same pace.</p>",
      ].join(""),
    },
    {
      title: "How we think about design",
      slug: "how-we-think-about-design",
      cover: IMG("1541462608143-67571c6738dd"),
      excerpt:
        "Why we build from small, reusable sections: consistency by construction, faster reviews, and a brand that stays coherent as the team grows.",
      authorIdx: 1,
      category: "Design",
      tags: ["Design", "Product"],
      readingTime: 6,
      indexing: "index",
      body: [
        "<p>Good design at our size is less about any single screen and more about the system underneath it. We build from small, reusable sections instead of one-off layouts, and that decision shapes everything downstream.</p>",
        "<h2>Consistency by construction</h2>",
        "<p>When a button, a card, or a hero comes from a shared component, it looks and behaves the same everywhere. Designers stop policing spacing and color across dozens of pages and spend their time on the parts that actually differ.</p>",
        "<h2>Fast reviews</h2>",
        "<p>Because the building blocks are already agreed on, design reviews focus on content and hierarchy rather than pixels. A new landing page becomes a conversation about the message, not a debate about margins.</p>",
        "<p>We keep a tight set of tokens for color, type, and spacing, and we resist adding new ones until a real need shows up. Constraints keep the surface area small and the brand coherent.</p>",
        "<h2>Design that scales with the team</h2>",
        "<p>The payoff is that a marketer, an engineer, and a designer can all touch the same page and trust the result. The system does the heavy lifting, so people can focus on the work that needs judgment.</p>",
      ].join(""),
    },
    {
      title: "Shipping faster with sections",
      slug: "shipping-faster-with-sections",
      cover: IMG("1498050108023-c5249f4df085"),
      excerpt:
        "How composing pages from a shared section library cut our time to publish a campaign page by roughly two thirds.",
      authorIdx: 2,
      category: "Engineering",
      tags: ["Engineering", "Product"],
      readingTime: 5,
      indexing: "noindex",
      body: [
        "<p>Sections changed how quickly we can put a page in front of customers. What used to take a designer and an engineer a few days now takes an afternoon, and the quality is higher because every piece is already tested.</p>",
        "<h2>From draft to publish</h2>",
        "<p>A marketer starts a new page, picks sections from the library, and fills in the fields. A live preview shows exactly how it will render. When it is ready, they send it for review, and an editor approves it in place.</p>",
        "<ol><li>Compose the page from existing sections.</li><li>Write and edit content directly in typed fields.</li><li>Preview, review, and publish without a deploy.</li></ol>",
        "<h2>Where the time goes</h2>",
        "<p>The slow part of publishing was never the writing. It was the handoffs, the deploys, and the small fixes that piled up afterward. By removing those steps, we cut the time to publish a campaign page by roughly two thirds.</p>",
        "<p>Sections also make it easy to reuse what works. A pricing block or a testimonial row that performs well on one page drops straight into the next, so good patterns spread instead of getting rebuilt.</p>",
        "<p>The team ships more, waits less, and spends its energy on the message rather than the mechanics.</p>",
      ].join(""),
    },
  ];
  const PEOPLE: [string, string, string][] = [
    ["Maya Chen", "Head of Growth", IMG("1494790108377-be9c29b29330")],
    ["Arnab Dhar", "Design Lead", IMG("1507003211169-0a1dd7228f2d")],
    ["Kiran Rao", "Engineer", IMG("1500648767791-00dcc994a43e")],
  ];
  const QUOTES: [string, string][] = [
    ["We shipped our new site in a week.", "Northwind"],
    ["The team edits everything without waiting on engineering.", "Vertex"],
  ];
  const DATES = ["2026-06-28T10:00:00Z", "2026-06-21T15:30:00Z", "2026-06-12T09:15:00Z"];

  for (const pr of projects) {
    if (hasContent.has(pr.id)) continue;
    const suf = pr.id.replace(/^pr_/, "");
    // Workflow seeds pull assignees from the project's own workspace.
    const mids = workspaces.find((w) => w.id === pr.workspaceId)?.memberIds ?? [];
    const mid = (i: number) => mids[i % Math.max(mids.length, 1)];

    // Canonical host for SEO fields, e.g. https://bettercms.ai/blog/<slug>.
    const host = pr.domain ?? `${pr.slug}.com`;

    // Tag taxonomy — referenced by Blog posts via multiReference.
    const cTags: Collection = { id: `c_${suf}_tags`, projectId: pr.id, name: "Tags", slug: "tags", schemaId: `sch_${suf}_tags`, entryIds: [] };
    schemas.push({
      id: cTags.schemaId,
      ownerType: "collection",
      ownerId: cTags.id,
      titleFieldName: "name",
      listFieldNames: ["slug"],
      fields: [
        { id: `f_${suf}_tag_name`, name: "name", label: "Name", type: "text", required: true },
        { id: `f_${suf}_tag_slug`, name: "slug", label: "Slug", type: "text", required: true, unique: true },
      ],
    });
    TAGS.forEach((name, i) => {
      const id = `e_${suf}_tag${i}`;
      cTags.entryIds.push(id);
      entries.push({
        id,
        collectionId: cTags.id,
        title: name,
        fields: { name, slug: name.toLowerCase() },
        updatedAt: DATES[0],
        status: "published",
      });
    });
    collections.push(cTags);

    // Seeded inside the "Resources" folder to demo a nested collection URL:
    // /resources/posts/:slug (folder id matches folders-store's deterministic seed).
    const cPosts: Collection = { id: `c_${suf}_posts`, projectId: pr.id, name: "Blog posts", slug: "posts", schemaId: `sch_${suf}_posts`, entryIds: [], folderId: `fld_seed_${pr.id}_resources` };
    schemas.push({
      id: cPosts.schemaId,
      ownerType: "collection",
      ownerId: cPosts.id,
      titleFieldName: "title",
      listFieldNames: ["category", "author", "publishedAt", "readingTime"],
      groups: [
        { id: `g_${suf}_content`, name: "content", label: "Content" },
        { id: `g_${suf}_details`, name: "details", label: "Details" },
        { id: `g_${suf}_seo`, name: "seo", label: "SEO", description: "Search and social metadata." },
      ],
      fields: [
        { id: `f_${suf}_p_title`, name: "title", label: "Title", type: "text", required: true, groupId: `g_${suf}_content` },
        { id: `f_${suf}_p_slug`, name: "slug", label: "Slug", type: "text", required: true, unique: true, groupId: `g_${suf}_content`, description: "URL segment, lowercase, hyphenated." },
        { id: `f_${suf}_p_excerpt`, name: "excerpt", label: "Excerpt", type: "text", groupId: `g_${suf}_content`, description: "One or two sentences used in listings and previews.", placeholder: "Short summary…" },
        { id: `f_${suf}_p_cover`, name: "cover", label: "Cover image", type: "image", groupId: `g_${suf}_content` },
        { id: `f_${suf}_p_body`, name: "body", label: "Body", type: "richText", groupId: `g_${suf}_content` },
        { id: `f_${suf}_p_author`, name: "author", label: "Author", type: "reference", refCollectionId: `c_${suf}_team`, groupId: `g_${suf}_details` },
        { id: `f_${suf}_p_category`, name: "category", label: "Category", type: "select", options: ["Product", "Engineering", "Company", "Design"], groupId: `g_${suf}_details` },
        { id: `f_${suf}_p_tags`, name: "tags", label: "Tags", type: "multiReference", refCollectionId: cTags.id, groupId: `g_${suf}_details` },
        { id: `f_${suf}_p_reading`, name: "readingTime", label: "Reading time (min)", type: "number", groupId: `g_${suf}_details`, validation: { min: 1, max: 60 } },
        { id: `f_${suf}_p_pubat`, name: "publishedAt", label: "Published at", type: "date", groupId: `g_${suf}_details` },
        { id: `f_${suf}_p_metatitle`, name: "metaTitle", label: "Meta title", type: "text", groupId: `g_${suf}_seo`, validation: { maxLength: 70 } },
        { id: `f_${suf}_p_metadesc`, name: "metaDescription", label: "Meta description", type: "text", groupId: `g_${suf}_seo`, validation: { maxLength: 160 } },
        { id: `f_${suf}_p_ogimage`, name: "ogImage", label: "Social image", type: "image", groupId: `g_${suf}_seo` },
        { id: `f_${suf}_p_canonical`, name: "canonicalUrl", label: "Canonical URL", type: "url", groupId: `g_${suf}_seo` },
        { id: `f_${suf}_p_indexing`, name: "indexing", label: "Indexing", type: "select", options: ["index", "noindex"], groupId: `g_${suf}_seo` },
      ],
    });
    POST_DATA.forEach((p, i) => {
      const id = `e_${suf}_p${i}`;
      cPosts.entryIds.push(id);
      // Spread posts across the workflow: one live, one sent back with a
      // comment, one in review (assigned to the viewer, overdue).
      const workflow =
        i === 1
          ? {
              workflowStageId: "wfs_changes",
              workflowAssigneeIds: [mid(2)],
              workflowLastMove: { by: mid(5), at: DATES[1], comment: "Tighten the intro and add a concrete example before this ships." },
            }
          : i === 2
            ? {
                workflowStageId: "wfs_review",
                workflowAssigneeIds: ["m_jane", mid(3)],
                workflowDueDate: "2026-07-09T12:00:00Z",
              }
            : { workflowAssigneeIds: [mid(1)] };
      const canonical = `https://${host}/blog/${p.slug}`;
      const metaTitle = `${p.title} | ${pr.name}`;
      entries.push({
        id,
        collectionId: cPosts.id,
        title: p.title,
        fields: {
          slug: p.slug,
          excerpt: p.excerpt,
          cover: p.cover,
          body: p.body,
          author: `e_${suf}_t${p.authorIdx}`,
          category: p.category,
          tags: p.tags.map((t) => `e_${suf}_tag${TAGS.indexOf(t)}`),
          readingTime: p.readingTime,
          publishedAt: DATES[i],
          metaTitle,
          metaDescription: p.excerpt,
          ogImage: p.cover,
          canonicalUrl: canonical,
          indexing: p.indexing,
        },
        updatedAt: DATES[i],
        status: i === 0 ? "published" : "draft",
        // Populate the dedicated SEO tab as well as the schema fields.
        metaTitle,
        metaDescription: p.excerpt,
        canonical,
        ogImage: p.cover,
        indexing: p.indexing,
        ...workflow,
      });
    });
    collections.push(cPosts);

    const cTeam: Collection = { id: `c_${suf}_team`, projectId: pr.id, name: "Team members", slug: "team", schemaId: `sch_${suf}_team`, entryIds: [] };
    schemas.push({
      id: cTeam.schemaId,
      ownerType: "collection",
      ownerId: cTeam.id,
      titleFieldName: "name",
      listFieldNames: ["role"],
      fields: [
        { id: `f_${suf}_t_name`, name: "name", label: "Name", type: "text", required: true },
        { id: `f_${suf}_t_role`, name: "role", label: "Role", type: "text" },
        { id: `f_${suf}_t_photo`, name: "photo", label: "Photo", type: "image" },
      ],
    });
    PEOPLE.forEach(([name, role, photo], i) => {
      const id = `e_${suf}_t${i}`;
      cTeam.entryIds.push(id);
      // Maya waits in Approved so the publish-gate column has a card.
      const workflow =
        i === 0
          ? { workflowStageId: "wfs_approved", workflowAssigneeIds: [mid(0)], workflowDueDate: "2026-07-12T12:00:00Z" }
          : {};
      entries.push({
        id,
        collectionId: cTeam.id,
        title: name,
        fields: { name, role, photo },
        updatedAt: DATES[i],
        status: i === 0 ? "draft" : "published",
        ...workflow,
      });
    });
    collections.push(cTeam);

    const cQuotes: Collection = { id: `c_${suf}_quotes`, projectId: pr.id, name: "Testimonials", slug: "testimonials", schemaId: `sch_${suf}_quotes`, entryIds: [] };
    schemas.push({
      id: cQuotes.schemaId,
      ownerType: "collection",
      ownerId: cQuotes.id,
      titleFieldName: "quote",
      listFieldNames: ["company"],
      fields: [
        { id: `f_${suf}_q_quote`, name: "quote", label: "Quote", type: "text", required: true },
        { id: `f_${suf}_q_company`, name: "company", label: "Company", type: "text" },
      ],
    });
    QUOTES.forEach(([quote, company], i) => {
      const id = `e_${suf}_q${i}`;
      cQuotes.entryIds.push(id);
      entries.push({ id, collectionId: cQuotes.id, title: quote, fields: { quote, company }, updatedAt: DATES[i], status: i === 1 ? "draft" : "published" });
    });
    collections.push(cQuotes);

    // Register on the project so the editor content tree lists them. This also
    // fixes projects whose collectionIds pointed at another project's data.
    pr.collectionIds = [cPosts.id, cTeam.id, cTags.id, cQuotes.id];
  }
})();

export const mediaFolders: MediaFolder[] = [
  { id: "mf_brand", projectId: "pr_northwind", name: "Brand" },
  { id: "mf_logos", projectId: "pr_northwind", parentId: "mf_brand", name: "Logos" },
  { id: "mf_icons", projectId: "pr_northwind", parentId: "mf_brand", name: "Icons" },
  { id: "mf_marketing", projectId: "pr_northwind", name: "Marketing" },
  { id: "mf_blog", projectId: "pr_northwind", parentId: "mf_marketing", name: "Blog" },
  { id: "mf_campaigns", projectId: "pr_northwind", parentId: "mf_marketing", name: "Campaigns" },
  { id: "mf_product", projectId: "pr_northwind", name: "Product" },
  { id: "mf_videos", projectId: "pr_northwind", name: "Videos" },
  { id: "mf_team", projectId: "pr_northwind", name: "Team" },
  { id: "mf_downloads", projectId: "pr_northwind", name: "Downloads" },
  // Flowtrix headless site (bettercms.ai) media hub
  { id: "mf_fx_brand", projectId: "pr_flowtrix_api", name: "Brand" },
  { id: "mf_fx_blog", projectId: "pr_flowtrix_api", name: "Blog covers" },
  { id: "mf_fx_social", projectId: "pr_flowtrix_api", name: "Social" },
  { id: "mf_fx_motion", projectId: "pr_flowtrix_api", name: "Video & motion" },
  { id: "mf_fx_docs", projectId: "pr_flowtrix_api", name: "Documents" },
];

const U = (id: string, w = 800, h = 600) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;

export const media: MediaAsset[] = [
  { id: "md_1", projectId: "pr_northwind", name: "hero-banner.webp", kind: "image", url: U("1517336714731-489689fd1ca8", 1920, 1080), thumbUrl: U("1517336714731-489689fd1ca8", 480, 320), size: "320 KB", sizeBytes: 327_680, folderId: "mf_marketing", mimeType: "image/webp", width: 1920, height: 1080, optimized: true, referencedBy: ["pg_home", "pg_pricing", "pg_features"], uploadedAt: "2026-06-12T10:00:00Z", altText: "Modern workspace at sunrise", tags: ["hero", "marketing"], favorite: true },
  { id: "md_2", projectId: "pr_northwind", name: "logo-mark.svg", kind: "image", url: "", size: "12 KB", sizeBytes: 12_288, folderId: "mf_logos", mimeType: "image/svg+xml", width: 64, height: 64, optimized: true, referencedBy: ["pg_home", "pg_about", "pg_pricing"], uploadedAt: "2026-04-02T00:00:00Z", tags: ["brand", "logo"] },
  { id: "md_3", projectId: "pr_northwind", name: "feature-dashboard.png", kind: "image", url: U("1551288049-bebda4e38f71", 1600, 1000), thumbUrl: U("1551288049-bebda4e38f71", 480, 300), size: "1.4 MB", sizeBytes: 1_468_006, folderId: "mf_product", mimeType: "image/png", width: 1600, height: 1000, optimized: false, referencedBy: ["pg_home"], uploadedAt: "2026-06-09T12:30:00Z", tags: ["product"] },
  { id: "md_4", projectId: "pr_northwind", name: "feature-analytics.png", kind: "image", url: U("1460925895917-afdab827c52f", 1200, 800), thumbUrl: U("1460925895917-afdab827c52f", 480, 320), size: "388 KB", sizeBytes: 397_312, folderId: "mf_product", mimeType: "image/png", width: 1200, height: 800, optimized: true, uploadedAt: "2026-05-21T09:10:00Z", tags: ["product"] },
  { id: "md_5", projectId: "pr_northwind", name: "team-portrait.jpg", kind: "image", url: U("1522071820081-009f0129c71c", 1600, 1067), thumbUrl: U("1522071820081-009f0129c71c", 480, 320), size: "2.1 MB", sizeBytes: 2_202_009, folderId: "mf_team", mimeType: "image/jpeg", width: 4032, height: 2688, optimized: false, referencedBy: ["pg_about"], uploadedAt: "2026-03-14T16:42:00Z", tags: ["team", "people"] },
  { id: "md_6", projectId: "pr_northwind", name: "demo-walkthrough.mp4", kind: "video", url: "", thumbUrl: U("1551434678-e076c223a692", 480, 270), size: "18 MB", sizeBytes: 18_874_368, folderId: "mf_videos", mimeType: "video/mp4", width: 1920, height: 1080, durationSec: 96, uploadedAt: "2026-06-01T11:00:00Z", tags: ["demo"] },
  { id: "md_7", projectId: "pr_northwind", name: "campaign-spring.jpg", kind: "image", url: U("1490481651871-ab68de25d43d", 1600, 1067), thumbUrl: U("1490481651871-ab68de25d43d", 480, 320), size: "640 KB", sizeBytes: 655_360, folderId: "mf_campaigns", mimeType: "image/jpeg", width: 2400, height: 1600, optimized: true, referencedBy: ["pg_home"], uploadedAt: "2026-06-15T08:00:00Z", tags: ["campaign", "spring"], favorite: true },
  { id: "md_8", projectId: "pr_northwind", name: "icon-rocket.svg", kind: "image", url: "", size: "3 KB", sizeBytes: 3_072, folderId: "mf_icons", mimeType: "image/svg+xml", width: 24, height: 24, optimized: true, uploadedAt: "2026-04-09T00:00:00Z", tags: ["icon"] },
  { id: "md_9", projectId: "pr_northwind", name: "icon-shield.svg", kind: "image", url: "", size: "2 KB", sizeBytes: 2_048, folderId: "mf_icons", mimeType: "image/svg+xml", width: 24, height: 24, optimized: true, uploadedAt: "2026-04-09T00:00:00Z", tags: ["icon"] },
  { id: "md_10", projectId: "pr_northwind", name: "blog-cover-launch.jpg", kind: "image", url: U("1499951360447-b19be8fe80f5", 1600, 900), thumbUrl: U("1499951360447-b19be8fe80f5", 480, 270), size: "780 KB", sizeBytes: 798_720, folderId: "mf_blog", mimeType: "image/jpeg", width: 2400, height: 1350, optimized: true, referencedBy: ["pg_blog_launch"], uploadedAt: "2026-06-10T14:20:00Z", tags: ["blog"] },
  { id: "md_11", projectId: "pr_northwind", name: "blog-cover-changelog.jpg", kind: "image", url: U("1531297484001-80022131f5a1", 1600, 900), thumbUrl: U("1531297484001-80022131f5a1", 480, 270), size: "612 KB", sizeBytes: 626_688, folderId: "mf_blog", mimeType: "image/jpeg", width: 2400, height: 1350, optimized: true, uploadedAt: "2026-06-04T11:05:00Z", tags: ["blog"] },
  { id: "md_12", projectId: "pr_northwind", name: "product-mockup.png", kind: "image", url: U("1517694712202-14dd9538aa97", 1600, 1067), thumbUrl: U("1517694712202-14dd9538aa97", 480, 320), size: "3.2 MB", sizeBytes: 3_355_443, folderId: "mf_product", mimeType: "image/png", width: 3200, height: 2133, optimized: false, uploadedAt: "2026-02-18T09:00:00Z", tags: ["product", "mockup"] },
  { id: "md_13", projectId: "pr_northwind", name: "promo-reel.mov", kind: "video", url: "", thumbUrl: U("1492724441997-5dc865305da7", 480, 270), size: "42 MB", sizeBytes: 44_040_192, folderId: "mf_videos", mimeType: "video/quicktime", width: 1920, height: 1080, durationSec: 28, uploadedAt: "2026-05-28T10:15:00Z", tags: ["promo"] },
  { id: "md_14", projectId: "pr_northwind", name: "brand-guidelines.pdf", kind: "file", url: "", size: "4.6 MB", sizeBytes: 4_823_449, folderId: "mf_downloads", mimeType: "application/pdf", uploadedAt: "2026-01-30T00:00:00Z", tags: ["brand", "docs"] },
  { id: "md_15", projectId: "pr_northwind", name: "press-kit.zip", kind: "file", url: "", size: "12 MB", sizeBytes: 12_582_912, folderId: "mf_downloads", mimeType: "application/zip", uploadedAt: "2026-02-11T00:00:00Z", tags: ["press"] },
  { id: "md_16", projectId: "pr_northwind", name: "office-tour.jpg", kind: "image", url: U("1497366216548-37526070297c", 1600, 1067), thumbUrl: U("1497366216548-37526070297c", 480, 320), size: "1.8 MB", sizeBytes: 1_887_436, folderId: "mf_team", mimeType: "image/jpeg", width: 3000, height: 2000, optimized: false, uploadedAt: "2026-06-16T09:30:00Z", tags: ["office", "team"] },
  { id: "md_17", projectId: "pr_northwind", name: "podcast-intro.mp3", kind: "file", url: "", size: "3.2 MB", sizeBytes: 3_355_443, folderId: "mf_marketing", mimeType: "audio/mpeg", durationSec: 14, uploadedAt: "2026-05-12T00:00:00Z", tags: ["audio"] },
  { id: "md_18", projectId: "pr_northwind", name: "homepage-hero-v2.webp", kind: "image", url: U("1504384308090-c894fdcc538d", 1920, 1080), thumbUrl: U("1504384308090-c894fdcc538d", 480, 270), size: "240 KB", sizeBytes: 245_760, folderId: "mf_marketing", mimeType: "image/webp", width: 1920, height: 1080, optimized: true, uploadedAt: "2026-06-17T07:45:00Z", tags: ["hero", "marketing"], favorite: true },
  // Flowtrix headless site (bettercms.ai) assets — pickable in the OG image picker
  { id: "md_fx_1", projectId: "pr_flowtrix_api", name: "og-default.webp", kind: "image", url: U("1451187580459-43490279c0fa", 1200, 630), thumbUrl: U("1451187580459-43490279c0fa", 480, 252), size: "180 KB", sizeBytes: 184_320, folderId: "mf_fx_social", mimeType: "image/webp", width: 1200, height: 630, optimized: true, uploadedAt: "2026-06-30T09:00:00Z", altText: "BetterCMS default social card", tags: ["og", "social"], favorite: true },
  { id: "md_fx_2", projectId: "pr_flowtrix_api", name: "hero-abstract.webp", kind: "image", url: U("1550745165-9bc0b252726f", 1600, 900), thumbUrl: U("1550745165-9bc0b252726f", 480, 270), size: "220 KB", sizeBytes: 225_280, folderId: "mf_fx_brand", mimeType: "image/webp", width: 1600, height: 900, optimized: true, uploadedAt: "2026-06-28T11:20:00Z", altText: "Abstract gradient hero", tags: ["hero", "brand"] },
  { id: "md_fx_3", projectId: "pr_flowtrix_api", name: "blog-headless-cms.jpg", kind: "image", url: U("1526374965328-7f61d4dc18c5", 1600, 900), thumbUrl: U("1526374965328-7f61d4dc18c5", 480, 270), size: "420 KB", sizeBytes: 430_080, folderId: "mf_fx_blog", mimeType: "image/jpeg", width: 1600, height: 900, optimized: true, uploadedAt: "2026-06-25T14:10:00Z", altText: "Code on a dark screen", tags: ["blog", "og"] },
  { id: "md_fx_4", projectId: "pr_flowtrix_api", name: "blog-ai-native.jpg", kind: "image", url: U("1677442136019-21780ecad995", 1600, 900), thumbUrl: U("1677442136019-21780ecad995", 480, 270), size: "390 KB", sizeBytes: 399_360, folderId: "mf_fx_blog", mimeType: "image/jpeg", width: 1600, height: 900, optimized: true, uploadedAt: "2026-06-22T10:05:00Z", altText: "AI abstract render", tags: ["blog", "ai"] },
  { id: "md_fx_5", projectId: "pr_flowtrix_api", name: "team-photo.jpg", kind: "image", url: U("1522071820081-009f0129c71c", 1600, 1067), thumbUrl: U("1522071820081-009f0129c71c", 480, 320), size: "510 KB", sizeBytes: 522_240, folderId: "mf_fx_brand", mimeType: "image/jpeg", width: 1600, height: 1067, optimized: true, uploadedAt: "2026-06-19T08:40:00Z", altText: "The team at work", tags: ["team", "about"] },
  { id: "md_fx_6", projectId: "pr_flowtrix_api", name: "product-shot.png", kind: "image", url: U("1551288049-bebda4e38f71", 1600, 1000), thumbUrl: U("1551288049-bebda4e38f71", 480, 300), size: "620 KB", sizeBytes: 634_880, folderId: "mf_fx_brand", mimeType: "image/png", width: 1600, height: 1000, optimized: true, uploadedAt: "2026-06-15T16:30:00Z", altText: "Product dashboard", tags: ["product"] },
  { id: "md_fx_7", projectId: "pr_flowtrix_api", name: "og-pricing.webp", kind: "image", url: U("1460925895917-afdab827c52f", 1200, 630), thumbUrl: U("1460925895917-afdab827c52f", 480, 252), size: "160 KB", sizeBytes: 163_840, folderId: "mf_fx_social", mimeType: "image/webp", width: 1200, height: 630, optimized: true, uploadedAt: "2026-06-12T09:15:00Z", altText: "Pricing social card", tags: ["og", "pricing"] },
  { id: "md_fx_8", projectId: "pr_flowtrix_api", name: "author-avatar.jpg", kind: "image", url: U("1500648767791-00dcc994a43e", 400, 400), thumbUrl: U("1500648767791-00dcc994a43e", 200, 200), size: "44 KB", sizeBytes: 45_056, folderId: "mf_fx_blog", mimeType: "image/jpeg", width: 400, height: 400, optimized: true, uploadedAt: "2026-06-08T12:00:00Z", altText: "Author headshot", tags: ["avatar", "blog"] },
  // Video and motion (real sample URLs so the inspector player works)
  { id: "md_fx_9", projectId: "pr_flowtrix_api", name: "product-demo.mp4", kind: "video", url: "https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4", thumbUrl: U("1536240478700-b869070f9279", 480, 270), size: "158 MB", sizeBytes: 165_675_008, folderId: "mf_fx_motion", mimeType: "video/mp4", width: 1280, height: 720, durationSec: 596, uploadedAt: "2026-06-27T15:20:00Z", tags: ["demo", "video"] },
  { id: "md_fx_10", projectId: "pr_flowtrix_api", name: "launch-teaser.mp4", kind: "video", url: "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4", thumbUrl: U("1492619375914-88005aa9e8fb", 480, 270), size: "2.4 MB", sizeBytes: 2_516_582, folderId: "mf_fx_motion", mimeType: "video/mp4", width: 1280, height: 720, durationSec: 15, uploadedAt: "2026-06-21T10:05:00Z", tags: ["launch", "teaser"] },
  { id: "md_fx_11", projectId: "pr_flowtrix_api", name: "hero-loader.json", kind: "file", url: "", size: "18 KB", sizeBytes: 18_432, folderId: "mf_fx_motion", mimeType: "application/lottie+json", uploadedAt: "2026-06-18T09:30:00Z", tags: ["lottie", "animation"] },
  { id: "md_fx_12", projectId: "pr_flowtrix_api", name: "confetti-burst.gif", kind: "image", url: U("1481349518771-20055b2a7b24", 480, 480), thumbUrl: U("1481349518771-20055b2a7b24", 480, 480), size: "1.1 MB", sizeBytes: 1_153_433, folderId: "mf_fx_motion", mimeType: "image/gif", width: 480, height: 480, uploadedAt: "2026-06-14T13:45:00Z", tags: ["gif", "celebration"] },
  // Documents (real PDFs so open-in-new-tab works)
  { id: "md_fx_13", projectId: "pr_flowtrix_api", name: "brand-guidelines.pdf", kind: "file", url: "https://pdfobject.com/pdf/sample.pdf", size: "2.8 MB", sizeBytes: 2_936_012, folderId: "mf_fx_docs", mimeType: "application/pdf", uploadedAt: "2026-06-11T11:00:00Z", tags: ["brand", "docs"] },
  { id: "md_fx_14", projectId: "pr_flowtrix_api", name: "press-kit.pdf", kind: "file", url: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf", size: "13 KB", sizeBytes: 13_312, folderId: "mf_fx_docs", mimeType: "application/pdf", uploadedAt: "2026-06-09T16:40:00Z", tags: ["press"] },
  { id: "md_fx_15", projectId: "pr_flowtrix_api", name: "release-notes.md", kind: "file", url: "", size: "6 KB", sizeBytes: 6_144, folderId: "mf_fx_docs", mimeType: "text/markdown", uploadedAt: "2026-06-06T08:15:00Z", tags: ["docs", "changelog"] },
  { id: "md_fx_16", projectId: "pr_flowtrix_api", name: "seo-checklist.txt", kind: "file", url: "", size: "3 KB", sizeBytes: 3_072, folderId: "mf_fx_docs", mimeType: "text/plain", uploadedAt: "2026-06-03T12:30:00Z", tags: ["seo", "notes"] },
];

// ===== Developer =====

export const apiKeys: ApiKey[] = [
  { id: "ak_1", workspaceId: "ws_acme", name: "Production read", prefix: "bcms_live_8s2k", scopes: ["content:read"], lastUsedAt: "2026-06-15T07:01:00Z", createdBy: "m_dev", createdAt: "2026-04-12T00:00:00Z" },
  { id: "ak_2", workspaceId: "ws_acme", name: "CI deploy", prefix: "bcms_live_x91p", scopes: ["content:read", "content:write", "deploy"], lastUsedAt: "2026-06-14T18:30:00Z", createdBy: "m_dev", createdAt: "2026-03-01T00:00:00Z" },
  { id: "ak_3", workspaceId: "ws_acme", name: "Preview env", prefix: "bcms_test_q4mw", scopes: ["content:read"], createdBy: "m_alex", createdAt: "2026-05-22T00:00:00Z", revokedAt: "2026-06-01T00:00:00Z" },
];

export const webhooks: Webhook[] = [
  { id: "wh_1", workspaceId: "ws_acme", url: "https://hooks.acme.co/cms/publish", events: ["page.published", "page.unpublished", "site.deployed"], secretPrefix: "whsec_3f9", status: "active", lastDeliveryAt: "2026-06-14T18:21:30Z", createdAt: "2026-04-01T00:00:00Z" },
  { id: "wh_2", workspaceId: "ws_acme", url: "https://api.algolia.com/cms-index", events: ["collection.entry.created", "collection.entry.updated", "collection.entry.deleted"], secretPrefix: "whsec_a12", status: "failing", lastDeliveryAt: "2026-06-13T11:08:00Z", createdAt: "2026-05-10T00:00:00Z" },
];

export const webhookDeliveries: WebhookDelivery[] = [
  { id: "wd_1", webhookId: "wh_1", event: "page.published", statusCode: 200, durationMs: 142, createdAt: "2026-06-14T18:21:30Z" },
  { id: "wd_2", webhookId: "wh_1", event: "site.deployed", statusCode: 200, durationMs: 88, createdAt: "2026-06-14T18:20:10Z" },
  { id: "wd_3", webhookId: "wh_1", event: "page.published", statusCode: 200, durationMs: 121, createdAt: "2026-06-10T09:00:00Z" },
  { id: "wd_4", webhookId: "wh_2", event: "collection.entry.updated", statusCode: 500, durationMs: 1480, createdAt: "2026-06-13T11:08:00Z" },
  { id: "wd_5", webhookId: "wh_2", event: "collection.entry.created", statusCode: 502, durationMs: 2100, createdAt: "2026-06-13T10:14:00Z" },
  { id: "wd_6", webhookId: "wh_2", event: "collection.entry.updated", statusCode: 200, durationMs: 312, createdAt: "2026-06-11T16:45:00Z" },
];

export const domains: Domain[] = [
  { id: "d_1", workspaceId: "ws_acme", projectId: "pr_flowtrix_site", host: "flowtrix.co", status: "active", primary: true, sslStatus: "issued", addedAt: "2026-03-12T00:00:00Z" },
  { id: "d_2", workspaceId: "ws_acme", projectId: "pr_flowtrix_api", host: "bettercms.ai", status: "active", primary: true, sslStatus: "issued", addedAt: "2026-04-02T00:00:00Z" },
  { id: "d_3", workspaceId: "ws_acme", projectId: "pr_flowtrix_client", host: "harborandco.com", status: "verifying", sslStatus: "pending", addedAt: "2026-06-24T00:00:00Z" },
  { id: "d_5", workspaceId: "ws_northwind", projectId: "pr_northwind", host: "northwind.com", status: "active", primary: true, sslStatus: "issued", addedAt: "2025-11-12T00:00:00Z" },
  { id: "d_6", workspaceId: "ws_northwind", projectId: "pr_nw_docs", host: "docs.northwind.com", status: "active", sslStatus: "issued", addedAt: "2026-01-20T00:00:00Z" },
];

export const integrations: Integration[] = [
  { id: "int_1", workspaceId: "ws_acme", provider: "slack", label: "Slack", status: "connected", connectedAt: "2026-04-02T00:00:00Z" },
  { id: "int_2", workspaceId: "ws_acme", provider: "github", label: "GitHub", status: "connected", connectedAt: "2026-03-10T00:00:00Z" },
  { id: "int_3", workspaceId: "ws_acme", provider: "linear", label: "Linear", status: "disconnected" },
  { id: "int_4", workspaceId: "ws_acme", provider: "vercel", label: "Vercel", status: "connected", connectedAt: "2026-05-01T00:00:00Z" },
];

// ===== Billing =====

export const plans: Plan[] = [
  { id: "plan_starter", name: "Starter", priceMonthly: 0, currency: "USD", seatsIncluded: 3, limits: { projects: 3, seats: 3, api_calls: 50_000, storage: 5, sites: 1, ai_credits: 100 }, features: ["3 projects", "Community support"] },
  { id: "plan_team", name: "Team", priceMonthly: 99, currency: "USD", seatsIncluded: 10, limits: { projects: 25, seats: 10, api_calls: 1_000_000, storage: 100, sites: 10, ai_credits: 5000, bandwidth: 200 }, features: ["Up to 10 seats", "Custom domains", "Webhooks"] },
  { id: "plan_business", name: "Business", priceMonthly: 399, currency: "USD", seatsIncluded: 25, limits: { projects: 100, seats: 25, api_calls: 10_000_000, storage: 500, sites: 50, ai_credits: 25000, bandwidth: 1000 }, features: ["SSO", "Audit log retention", "Priority support"] },
];

export const subscriptions: Subscription[] = [
  { workspaceId: "ws_acme", planId: "plan_team", status: "active", currentPeriodEnd: "2026-07-01T00:00:00Z", seats: 5 },
];

/**
 * Demo invoices, one set per paying workspace. Yearly self serve workspaces get
 * one annual invoice at 12x the monthly total. Team is a contract invoice.
 * Enterprise (Atlas) has none here: billing runs through procurement, PO based.
 */
export const invoices: Invoice[] = [
  // Flowtrix: Agency $30 + Pro $25 + Pro $25 + Basic $15 + seats $65 = $160/mo, billed yearly.
  { id: "inv_fx_2026", workspaceId: "ws_acme", number: "BCMS-202603-114", amount: 1_920, currency: "USD", status: "paid", periodStart: "2026-03-10T00:00:00Z", periodEnd: "2027-03-10T00:00:00Z", issuedAt: "2026-03-10T00:00:00Z" },
  { id: "inv_fx_2025", workspaceId: "ws_acme", number: "BCMS-202503-114", amount: 1_680, currency: "USD", status: "paid", periodStart: "2025-03-10T00:00:00Z", periodEnd: "2026-03-10T00:00:00Z", issuedAt: "2025-03-10T00:00:00Z" },
  // Northwind: Company $20 + Pro $25 + Basic $15 + seats $45 = $105/mo, billed yearly.
  { id: "inv_nw_2026", workspaceId: "ws_northwind", number: "BCMS-202601-078", amount: 1_260, currency: "USD", status: "paid", periodStart: "2026-01-15T00:00:00Z", periodEnd: "2027-01-15T00:00:00Z", issuedAt: "2026-01-15T00:00:00Z" },
  { id: "inv_nw_2025", workspaceId: "ws_northwind", number: "BCMS-202501-078", amount: 960, currency: "USD", status: "paid", periodStart: "2025-01-15T00:00:00Z", periodEnd: "2026-01-15T00:00:00Z", issuedAt: "2025-01-15T00:00:00Z" },
  // Pixelforge: Agency $30 + Pro $25 + Basic $15 + Pro $25 + seats $75 = $170/mo, billed yearly.
  { id: "inv_pf_2026", workspaceId: "ws_pixelforge", number: "BCMS-202602-091", amount: 2_040, currency: "USD", status: "paid", periodStart: "2026-02-01T00:00:00Z", periodEnd: "2027-02-01T00:00:00Z", issuedAt: "2026-02-01T00:00:00Z" },
  { id: "inv_pf_2025", workspaceId: "ws_pixelforge", number: "BCMS-202502-091", amount: 1_750, currency: "USD", status: "paid", periodStart: "2025-02-01T00:00:00Z", periodEnd: "2026-02-01T00:00:00Z", issuedAt: "2025-02-01T00:00:00Z" },
  // Wayground: Team plan, $1,500/mo on an annual contract, invoice based.
  { id: "inv_wg_2026", workspaceId: "ws_wayground", number: "BCMS-202603-CONTRACT-12", amount: 18_000, currency: "USD", status: "paid", periodStart: "2026-03-01T00:00:00Z", periodEnd: "2027-03-01T00:00:00Z", issuedAt: "2026-03-01T00:00:00Z" },
  { id: "inv_wg_2025", workspaceId: "ws_wayground", number: "BCMS-202503-CONTRACT-11", amount: 18_000, currency: "USD", status: "paid", periodStart: "2025-03-01T00:00:00Z", periodEnd: "2026-03-01T00:00:00Z", issuedAt: "2025-03-01T00:00:00Z" },
];

const METRICS: { key: UsageMetricKey; current: number; limit: number }[] = [
  { key: "projects", current: 4, limit: 25 },
  { key: "seats", current: 5, limit: 10 },
  { key: "sites", current: 4, limit: 10 },
  { key: "api_calls", current: 412_000, limit: 1_000_000 },
  { key: "storage", current: 22, limit: 100 },
  { key: "bandwidth", current: 48, limit: 200 },
  { key: "ai_credits", current: 1840, limit: 5000 },
  { key: "entries", current: 7, limit: 1000 },
  { key: "uploads", current: 6, limit: 500 },
];

export const usageMetrics: UsageMetric[] = (() => {
  const out: UsageMetric[] = [];
  const periods: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(2026, 5 - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  for (const m of METRICS) {
    periods.forEach((p, idx) => {
      const isCurrent = idx === periods.length - 1;
      const variance = 0.5 + (((idx * 7 + m.key.length) % 50) / 100);
      const value = isCurrent ? m.current : Math.round(m.current * variance);
      out.push({ workspaceId: "ws_acme", metric: m.key, period: p, value, limit: m.limit });
    });
  }
  return out;
})();

// ===== Site config =====

export const environmentVariables: EnvironmentVariable[] = [
  { id: "ev_1", projectId: "pr_northwind", key: "STRIPE_PUBLIC_KEY", value: "pk_live_xxx", scope: "prod", updatedAt: "2026-05-10T00:00:00Z" },
  { id: "ev_2", projectId: "pr_northwind", key: "STRIPE_PUBLIC_KEY", value: "pk_test_xxx", scope: "dev", updatedAt: "2026-05-10T00:00:00Z" },
  { id: "ev_3", projectId: "pr_northwind", key: "ANALYTICS_ID", value: "G-XXXXXX", scope: "all", updatedAt: "2026-04-22T00:00:00Z" },
  { id: "ev_4", projectId: "pr_northwind", key: "SUPPORT_URL", value: "https://help.acme.co", scope: "all", updatedAt: "2026-04-22T00:00:00Z" },
];

export const redirects: Redirect[] = [
  { id: "rd_1", projectId: "pr_northwind", from: "/old-pricing", to: "/pricing", type: 301, enabled: true },
  { id: "rd_2", projectId: "pr_northwind", from: "/blog/posts/:slug", to: "/blog/:slug", type: 301, enabled: true },
  { id: "rd_3", projectId: "pr_northwind", from: "/login", to: "/auth", type: 302, enabled: true },
  { id: "rd_4", projectId: "pr_northwind", from: "/help", to: "https://help.acme.co", type: 301, enabled: false },
];

export const customCodeBlocks: CustomCodeBlock[] = [
  { id: "cc_1", scope: "site", projectId: "pr_northwind", location: "head", language: "html", content: "<!-- Analytics -->\n<script async src=\"https://plausible.io/js/plausible.js\"></script>", enabled: true, updatedAt: "2026-05-10T00:00:00Z" },
  { id: "cc_2", scope: "site", projectId: "pr_northwind", location: "bodyEnd", language: "html", content: "<!-- Intercom -->", enabled: false, updatedAt: "2026-05-10T00:00:00Z" },
];

export const backups: Backup[] = [
  { id: "bk_1", projectId: "pr_northwind", label: "Pre-publish — Home v4", createdAt: "2026-06-10T08:55:00Z", sizeBytes: 1_240_000, kind: "auto" },
  { id: "bk_2", projectId: "pr_northwind", label: "Manual checkpoint", createdAt: "2026-06-05T12:00:00Z", sizeBytes: 1_180_000, kind: "manual" },
  { id: "bk_3", projectId: "pr_northwind", label: "Pre-publish — Pricing", createdAt: "2026-05-28T09:30:00Z", sizeBytes: 1_120_000, kind: "auto" },
];

export const siteEnvironments: SiteEnvironment[] = [
  { id: "se_1", projectId: "pr_northwind", kind: "production", url: "https://northwind.acme.co", lastDeployAt: "2026-06-14T18:21:00Z", status: "ready" },
  { id: "se_2", projectId: "pr_northwind", kind: "staging", url: "https://staging.northwind.acme.co", lastDeployAt: "2026-06-15T07:40:00Z", status: "ready" },
];

export const siteMembers: SiteMember[] = [
  { id: "sm_1", projectId: "pr_northwind", memberId: "m_jane", role: "site_manager" },
  { id: "sm_2", projectId: "pr_northwind", memberId: "m_alex", role: "designer" },
  { id: "sm_3", projectId: "pr_northwind", memberId: "m_priya", role: "content_editor" },
  { id: "sm_4", projectId: "pr_northwind", memberId: "m_dev", role: "site_manager" },
];

// ===== Audit + notifications =====

export const auditLog: AuditLogEntry[] = [
  { id: "al_1", workspaceId: "ws_acme", actorId: "m_jane", action: "page.published", entityType: "page", entityId: "pg_home", entityLabel: "Home", createdAt: "2026-06-14T18:21:00Z" },
  { id: "al_2", workspaceId: "ws_acme", actorId: "m_dev", action: "apikey.created", entityType: "apiKey", entityId: "ak_2", entityLabel: "CI deploy", createdAt: "2026-06-14T15:02:00Z" },
  { id: "al_3", workspaceId: "ws_acme", actorId: "m_alex", action: "member.invited", entityType: "member", entityLabel: "lena@partner.io", createdAt: "2026-06-12T10:00:00Z" },
  { id: "al_4", workspaceId: "ws_acme", actorId: "m_priya", action: "entry.updated", entityType: "entry", entityId: "e_p2", entityLabel: "Why structured content wins", createdAt: "2026-06-04T11:30:00Z" },
  { id: "al_5", workspaceId: "ws_acme", actorId: "m_jane", action: "domain.added", entityType: "domain", entityId: "d_3", entityLabel: "status.acme.co", createdAt: "2026-06-14T08:00:00Z" },
  { id: "al_6", workspaceId: "ws_acme", actorId: "m_dev", action: "webhook.created", entityType: "webhook", entityId: "wh_2", entityLabel: "Algolia index", createdAt: "2026-05-10T00:00:00Z" },
  { id: "al_7", workspaceId: "ws_acme", actorId: "m_jane", action: "settings.updated", entityType: "workspace", entityLabel: "General", createdAt: "2026-05-01T10:00:00Z" },
  { id: "al_8", workspaceId: "ws_acme", actorId: "m_alex", action: "role.changed", entityType: "member", entityId: "m_priya", entityLabel: "Priya Singh → Content Manager", createdAt: "2026-04-22T00:00:00Z" },
  { id: "al_9", workspaceId: "ws_acme", actorId: "m_jane", action: "page.created", entityType: "page", entityId: "pg_blog", entityLabel: "Blog", createdAt: "2026-04-12T00:00:00Z" },
  { id: "al_10", workspaceId: "ws_acme", actorId: "m_priya", action: "collection.created", entityType: "collection", entityId: "c_posts", entityLabel: "Blog Posts", createdAt: "2026-04-01T00:00:00Z" },
];

export const notifications: Notification[] = [
  { id: "n_1", workspaceId: "ws_acme", kind: "warning", title: "Webhook delivery failing", body: "Algolia index has failed 3 times in the last 24 hours.", createdAt: "2026-07-09T09:20:00Z" },
  { id: "n_7", workspaceId: "ws_acme", kind: "info", title: "Northwind Studio joined as a guest team", body: "Priya Raman accepted your guest invite to BetterCMS.ai.", createdAt: "2026-07-09T08:05:00Z" },
  { id: "n_6", workspaceId: "ws_acme", kind: "success", title: "Pricing page published", body: "Rohan Iyer published /pricing to production.", createdAt: "2026-07-08T17:42:00Z" },
  { id: "n_5", workspaceId: "ws_acme", kind: "info", title: "Agent finished a run", body: "The SEO agent drafted 12 location pages, ready for review.", createdAt: "2026-07-08T14:15:00Z" },
  { id: "n_2", workspaceId: "ws_acme", kind: "success", title: "Domain verified", body: "northwind.acme.co is live with SSL.", createdAt: "2026-07-06T00:00:00Z", readAt: "2026-07-06T01:00:00Z" },
  { id: "n_4", workspaceId: "ws_acme", kind: "info", title: "New comment on Home", body: "Mika Chen mentioned you on the hero section.", createdAt: "2026-07-04T10:30:00Z", readAt: "2026-07-04T12:00:00Z" },
  { id: "n_3", workspaceId: "ws_acme", kind: "info", title: "Agency plan renews July 30", createdAt: "2026-07-01T00:00:00Z", readAt: "2026-07-01T09:00:00Z" },
];
