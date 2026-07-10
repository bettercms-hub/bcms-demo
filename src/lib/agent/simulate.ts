/**
 * Agent simulation — the demo brain behind runs.
 *
 * Reads REAL project state (pages-store, CMS store) to build plans,
 * proposals, and findings, and applies accepted proposals through the
 * SAME store actions a person uses. In production this module is replaced
 * by the backend orchestrator; the shapes and the write paths stay put.
 */
import { buildPage, getPages, pagesActions } from "@/lib/cms/pages-store";
import { entryActions, entryCreateActions, getCMSState } from "@/lib/cms/store";
import { getBrandKit, hasBrandVoice } from "@/lib/brand/brand-store";
import { aiAction, type AiTier } from "@/lib/billing/pricing";
import type { AgentPlan, AuditFinding, ContextRef, ProposedChange, UndoOp } from "./types";
import type { AgentSkill } from "./skills";

let seq = 0;
const pid = () => `prop_${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ----------------------------------------------------------- helpers */

function titleFromBrief(brief: string): string {
  const cleaned = brief
    .replace(/^(please\s+)?(draft|write|create|generate)\s+(a|an|the)?\s*/i, "")
    .replace(/^(blog\s+)?(post|article|entry)\s+(about|on|for)\s*/i, "")
    .replace(/[.?!]+$/, "")
    .trim();
  const base = cleaned.length > 6 ? cleaned : brief.trim();
  return base.charAt(0).toUpperCase() + base.slice(1).slice(0, 80);
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function metaTitleFor(pageTitle: string, siteName: string): string {
  const t = `${pageTitle} | ${siteName}`;
  return t.length > 60 ? pageTitle.slice(0, 57).trimEnd() : t;
}

// Generated copy lands in the CMS as real content, so it has to read like
// the customer's site, never like CMS marketing or agent process notes.
function metaDescriptionFor(pageTitle: string, siteName: string): string {
  return `${pageTitle} from ${siteName}. What it covers, why it matters, and where to go next.`.slice(0, 158);
}

function bodyFor(title: string, brief: string): string {
  const topic = brief.trim().replace(/[.?!]+$/, "");
  return [
    `<p>${topic}. This piece walks through the idea in plain terms and shows where it pays off in practice.</p>`,
    `<p>Start with the problem it solves, then the approach, then the results you can expect. Concrete examples beat abstract claims, so each point below pairs the argument with a real situation.</p>`,
    `<p>${title} is not a silver bullet, and the honest version of the story includes the tradeoffs. The closing section covers when this approach fits and when it does not.</p>`,
  ].join("\n");
}

function excerptFor(title: string): string {
  return `${title}: the key ideas, why they matter, and how to put them to work.`.slice(0, 140);
}

/* ---------------------------------------------------------- collections */

export interface CollectionInfo {
  id: string;
  name: string;
  fieldNames: string[];
  schemaId: string;
}

export function projectCollections(projectId: string): CollectionInfo[] {
  const s = getCMSState();
  return s.collections
    .filter((c) => c.projectId === projectId)
    .map((c) => {
      const schema = s.schemas.find((x) => x.id === c.schemaId);
      return {
        id: c.id,
        name: c.name,
        fieldNames: (schema?.fields ?? []).map((f) => f.name),
        schemaId: c.schemaId,
      };
    });
}

function resolveCollection(projectId: string, context: ContextRef[]): CollectionInfo | undefined {
  const cols = projectCollections(projectId);
  const ref = context.find((c) => c.kind === "collection");
  if (ref) return cols.find((c) => c.id === ref.id) ?? cols[0];
  return cols[0];
}

/* ------------------------------------------------------------- planning */

export interface SimPlanInput {
  projectId: string;
  skill: AgentSkill;
  prompt: string;
  tier: AiTier;
  context: ContextRef[];
}

export function buildPlan({ projectId, skill, prompt, tier, context }: SimPlanInput): AgentPlan {
  const boundaries = [
    "Creates drafts only. Nothing publishes without your approval.",
    "Every change is proposed for your review before anything is saved.",
  ];

  if (skill.id === "draft") {
    const col = resolveCollection(projectId, context);
    const cost = aiAction("draft")?.costs[tier] ?? 8;
    const meta = aiAction("meta")?.costs.lite ?? 1;
    // Only promise what the schema can hold; the proposals mirror this list.
    const metaFields = ["seoTitle", "seoDescription"].filter((f) => col?.fieldNames.includes(f));
    const items = [
      `Write the title, body, and excerpt from: "${prompt.slice(0, 90)}"`,
      `Fill the ${col?.name ?? "collection"} fields the schema defines`,
    ];
    if (metaFields.length === 2) items.push("Write the meta title and description");
    else if (metaFields.length === 1) items.push("Write the meta title");
    // The brand kit's voice steers every word the agent writes.
    const draftBoundaries = hasBrandVoice(projectId)
      ? [`Follows the brand voice: ${getBrandKit(projectId).voice.tone || "your do and do not words"}`, ...boundaries]
      : boundaries;
    return {
      goal: `Draft one entry in ${col?.name ?? "a collection"} from your brief`,
      items,
      boundaries: draftBoundaries,
      estimate: { min: cost, max: cost + meta * metaFields.length },
    };
  }

  if (skill.id === "backfill") {
    const gaps = metaGaps(projectId);
    const per = aiAction("meta")?.costs.lite ?? 1;
    const n = Math.max(gaps.length, 1);
    return {
      goal: `Write missing SEO metadata for ${gaps.length} ${gaps.length === 1 ? "page" : "pages"}`,
      items: gaps.slice(0, 6).map((g) => `${g.title} (${g.missing.join(" and ")} missing)`),
      boundaries,
      estimate: { min: n * per, max: n * per + 2 },
    };
  }

  if (skill.id === "rename") {
    const r = parseRename(prompt);
    const per = aiAction("meta")?.costs.lite ?? 1;
    if (!r) {
      return {
        goal: "Rename a name across your content",
        items: ['Tell me the old and new name, e.g. Rename "The Satellites" to "Satellites"'],
        boundaries,
        estimate: { min: 1, max: 2 },
      };
    }
    const scan = renameScan(projectId, r.from, r.to);
    const docs = new Set(scan.proposals.map((p) => p.targetId)).size;
    return {
      goal: `Update "${r.from}" to "${r.to}" everywhere it appears`,
      items: [
        `Scan every page section and collection entry for "${r.from}"`,
        scan.mentions > 0
          ? `Found ${scan.mentions} mention${scan.mentions === 1 ? "" : "s"} across ${docs} document${docs === 1 ? "" : "s"}`
          : `No mentions found yet`,
        "Leave quoted and historical mentions untouched",
      ],
      boundaries,
      estimate: { min: Math.max(per, 1), max: Math.max(scan.proposals.length * per, per) },
    };
  }

  if (skill.id === "aeo") {
    const cost = aiAction("aeo")?.costs.max ?? 400;
    return {
      goal: "Score this site's readiness for AI answer engines",
      items: [
        "Check every page for direct answer blocks and FAQ sections",
        "Check meta descriptions for citability",
        "Report question coverage gaps",
      ],
      boundaries: ["Read only. No fields are touched."],
      estimate: { min: cost, max: cost },
    };
  }

  if (skill.id === "links") {
    return {
      goal: "Suggest internal links across pages and entries",
      items: [
        "Read every page and entry for related topics",
        "Propose link targets with anchor text and a reason",
        "Report suggestions only. Nothing is linked automatically",
      ],
      boundaries: ["Read only. No fields are touched."],
      estimate: { min: 3, max: 6 },
    };
  }

  if (skill.id === "migrate") {
    const url = prompt.match(/https?:\/\/[^\s]+/)?.[0] ?? "the source site";
    const per = aiAction("page")?.costs[tier] ?? aiAction("page")?.costs.balanced ?? 90;
    return {
      goal: `Rebuild 2 landing pages from ${url} as drafts`,
      items: [
        "Read the source structure and map it to your section catalog",
        "Compose each page from Hero, Features, and CTA sections",
        "Create the pages as drafts under /imported",
      ],
      boundaries,
      estimate: { min: per * 2, max: per * 2 },
    };
  }

  // audit
  return {
    goal: "Scan this site for content gaps and risks",
    items: [
      "Check every page for missing meta titles and descriptions",
      "Check collections for stale drafts and empty collections",
      "Report findings only. This scan changes nothing",
    ],
    boundaries: ["Read only. No fields are touched."],
    estimate: { min: 2, max: 4 },
  };
}

/* ------------------------------------------------------------ proposals */

interface MetaGap {
  path: string;
  title: string;
  missing: ("meta title" | "meta description")[];
}

function metaGaps(projectId: string): MetaGap[] {
  return getPages(projectId)
    .map((p) => {
      const missing: MetaGap["missing"] = [];
      if (!p.seoTitle?.trim()) missing.push("meta title");
      if (!p.seoDescription?.trim()) missing.push("meta description");
      return { path: p.path, title: p.title, missing };
    })
    .filter((g) => g.missing.length > 0);
}

export function buildProposals(input: SimPlanInput, siteName: string): ProposedChange[] {
  const { projectId, skill, prompt, context } = input;

  if (skill.id === "draft") {
    const col = resolveCollection(projectId, context);
    if (!col) return [];
    const title = titleFromBrief(prompt);
    const out: ProposedChange[] = [
      {
        id: pid(),
        operation: "content.generate",
        targetType: "entry",
        targetId: col.id,
        targetLabel: `${col.name} / ${title}`,
        after: title,
        reason: "New draft entry from your brief",
        risk: "low",
        status: "pending",
      },
    ];
    if (col.fieldNames.includes("slug")) {
      out.push(field(col, title, "slug", slugify(title), "URL segment from the title"));
    }
    if (col.fieldNames.includes("body")) {
      out.push(field(col, title, "body", bodyFor(title, prompt), "Body copy from your brief"));
    }
    if (col.fieldNames.includes("excerpt")) {
      out.push(field(col, title, "excerpt", excerptFor(title), "Short excerpt for lists and feeds"));
    }
    if (col.fieldNames.includes("seoTitle")) {
      out.push(field(col, title, "seoTitle", metaTitleFor(title, siteName), "Meta title, under 60 characters"));
    }
    if (col.fieldNames.includes("seoDescription")) {
      out.push(field(col, title, "seoDescription", metaDescriptionFor(title, siteName), "Meta description, under 160 characters"));
    }
    return out;
  }

  if (skill.id === "migrate") {
    const url = input.prompt.match(/https?:\/\/([^\s/]+)/);
    const host = url?.[1]?.replace(/^www\./, "") ?? "imported site";
    const existing = new Set(getPages(projectId).map((p) => p.path));
    const pages = [
      { path: "/imported/home", title: `${host} home`, blurb: "Hero, Logos, Features, and CTA sections" },
      { path: "/imported/pricing", title: `${host} pricing`, blurb: "Hero, Pricing, FAQ, and CTA sections" },
    ].filter((pg) => !existing.has(pg.path));
    return pages.map((pg) => ({
      id: pid(),
      operation: "page.compose",
      targetType: "page" as const,
      targetId: pg.path,
      targetLabel: pg.title,
      after: pg.blurb,
      reason: `New draft page at ${pg.path}, composed from your section catalog`,
      risk: "low" as const,
      status: "pending" as const,
    }));
  }

  if (skill.id === "backfill") {
    const out: ProposedChange[] = [];
    for (const p of getPages(projectId)) {
      if (!p.seoTitle?.trim()) {
        out.push({
          id: pid(),
          operation: "seo.meta",
          targetType: "page",
          targetId: p.path,
          targetLabel: p.title,
          fieldPath: "seoTitle",
          before: "",
          after: metaTitleFor(p.title, siteName),
          reason: "Page had no meta title",
          risk: "low",
          status: "pending",
        });
      }
      if (!p.seoDescription?.trim()) {
        out.push({
          id: pid(),
          operation: "seo.meta",
          targetType: "page",
          targetId: p.path,
          targetLabel: p.title,
          fieldPath: "seoDescription",
          before: "",
          after: metaDescriptionFor(p.title, siteName),
          reason: "Page had no meta description",
          risk: "low",
          status: "pending",
        });
      }
    }
    return out;
  }

  return [];
}

function field(col: CollectionInfo, title: string, name: string, value: string, reason: string): ProposedChange {
  return {
    id: pid(),
    operation: "content.patch",
    targetType: "entry",
    targetId: col.id,
    targetLabel: `${col.name} / ${title}`,
    fieldPath: name,
    after: value,
    reason,
    risk: "low",
    status: "pending",
  };
}

/* --------------------------------------------------------------- rename */

function stripQuotes(s: string): string {
  return s.replace(/^["'“”\s]+|["'“”\s.?!]+$/g, "").trim();
}

/** Pull the old and new name from a free-form ask. */
export function parseRename(prompt: string): { from: string; to: string } | null {
  const quoted = [...prompt.matchAll(/["'“”]([^"'“”]+)["'“”]/g)].map((m) => m[1].trim()).filter(Boolean);
  if (quoted.length >= 2) return { from: quoted[0], to: quoted[1] };
  let m = prompt.match(/\brename\s+(.+?)\s+to\s+(.+)/i);
  if (m) return { from: stripQuotes(m[1]), to: stripQuotes(m[2]) };
  m = prompt.match(/\breplace\s+(.+?)\s+with\s+(.+)/i);
  if (m) return { from: stripQuotes(m[1]), to: stripQuotes(m[2]) };
  m = prompt.match(/["'“”]?(.+?)["'“”]?\s+(?:is\s+)?(?:changing|changed).+?name.+?to\s+["'“”]?(.+?)["'“”]?$/i);
  if (m) return { from: stripQuotes(m[1]), to: stripQuotes(m[2]) };
  return null;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** How many times `from` appears in a value, and how many of those sit inside quotes. */
function countMentions(value: string, from: string): { total: number; quoted: number } {
  const re = new RegExp(escapeRe(from), "gi");
  const total = value.match(re)?.length ?? 0;
  let quoted = 0;
  const spans = value.match(/["'“”][^"'“”]{0,240}?["'“”]/g) ?? [];
  for (const span of spans) quoted += span.match(new RegExp(escapeRe(from), "gi"))?.length ?? 0;
  return { total, quoted };
}

function replaceMentions(value: string, from: string, to: string): string {
  return value.replace(new RegExp(escapeRe(from), "gi"), to);
}

export interface RenameScan {
  proposals: ProposedChange[];
  /** Fields left untouched because every mention sat inside quotes. */
  skipped: number;
  /** Total mentions found across the project (updated + quoted). */
  mentions: number;
}

/**
 * Find every mention of `from` across this project's page sections and
 * collection entries and stage a before→after change for each field.
 * Fields where the name appears only inside quotes are left alone and
 * counted, so the agent can say it respected editorial intent.
 */
export function renameScan(projectId: string, from: string, to: string): RenameScan {
  const proposals: ProposedChange[] = [];
  let skipped = 0;
  let mentions = 0;
  if (!from.trim() || !to.trim()) return { proposals, skipped, mentions };

  // Pages: every section content field.
  for (const pg of getPages(projectId)) {
    for (const sec of pg.sections) {
      for (const [key, raw] of Object.entries(sec.content ?? {})) {
        if (typeof raw !== "string" || !raw) continue;
        const { total, quoted } = countMentions(raw, from);
        if (total === 0) continue;
        mentions += total;
        if (quoted === total) {
          skipped++;
          continue;
        }
        proposals.push({
          id: pid(),
          operation: "page.section",
          targetType: "page",
          targetId: pg.path,
          targetLabel: pg.title,
          fieldPath: `${sec.id}.${key}`,
          before: raw,
          after: replaceMentions(raw, from, to),
          reason: `Update "${from}" in the ${sec.type} section`,
          risk: "low",
          status: "pending",
        });
      }
    }
  }

  // Entries: the title plus every string field.
  const s = getCMSState();
  const cols = s.collections.filter((c) => c.projectId === projectId);
  for (const col of cols) {
    for (const eid of col.entryIds) {
      const e = s.entries.find((x) => x.id === eid);
      if (!e) continue;
      const scanField = (fieldPath: string, raw: string) => {
        const { total, quoted } = countMentions(raw, from);
        if (total === 0) return;
        mentions += total;
        if (quoted === total) {
          skipped++;
          return;
        }
        proposals.push({
          id: pid(),
          operation: "entry.patch",
          targetType: "entry",
          targetId: e.id,
          targetLabel: `${col.name} / ${e.title}`,
          fieldPath,
          before: raw,
          after: replaceMentions(raw, from, to),
          reason: fieldPath === "title" ? `Update the entry title` : `Update "${from}" in ${fieldPath}`,
          risk: "low",
          status: "pending",
        });
      };
      if (typeof e.title === "string") scanField("title", e.title);
      for (const [key, raw] of Object.entries(e.fields ?? {})) {
        if (typeof raw === "string" && raw) scanField(key, raw);
      }
    }
  }

  return { proposals, skipped, mentions };
}

/** Rename proposals plus a short note on what was found and left out. */
export function buildRenameProposals(input: SimPlanInput): { proposals: ProposedChange[]; note?: string } {
  const r = parseRename(input.prompt);
  if (!r) {
    return { proposals: [], note: 'Tell me the old and new name, e.g. Rename "The Satellites" to "Satellites".' };
  }
  const scan = renameScan(input.projectId, r.from, r.to);
  const docs = new Set(scan.proposals.map((p) => p.targetId)).size;
  let note: string;
  if (scan.proposals.length === 0 && scan.skipped === 0) {
    note = `I couldn't find any mentions of "${r.from}" in this project.`;
  } else {
    note = `Found ${scan.mentions} mention${scan.mentions === 1 ? "" : "s"} of "${r.from}" across ${docs} document${docs === 1 ? "" : "s"}.`;
    if (scan.skipped > 0) {
      note += ` I left ${scan.skipped} quoted or historical ${scan.skipped === 1 ? "mention" : "mentions"} unchanged. Tell me to include those too.`;
    }
  }
  return { proposals: scan.proposals, note };
}

/* -------------------------------------------------------------- findings */

export function buildFindings(projectId: string): AuditFinding[] {
  const out: AuditFinding[] = [];
  const s = getCMSState();

  for (const g of metaGaps(projectId)) {
    out.push({
      id: pid(),
      severity: "warn",
      label: `Missing ${g.missing.join(" and ")}`,
      detail: "Search engines fall back to page text without them.",
      targetLabel: g.title,
      fixable: true,
    });
  }

  const cols = s.collections.filter((c) => c.projectId === projectId);
  for (const c of cols) {
    if (c.entryIds.length === 0) {
      out.push({
        id: pid(),
        severity: "note",
        label: "Empty collection",
        detail: "No entries yet. Draft one with the agent or import a CSV.",
        targetLabel: c.name,
        fixable: false,
      });
    }
  }

  const twoWeeks = Date.now() - 14 * 86_400_000;
  for (const c of cols) {
    for (const id of c.entryIds) {
      const e = s.entries.find((x) => x.id === id);
      if (e && e.status === "draft" && new Date(e.updatedAt).getTime() < twoWeeks) {
        out.push({
          id: pid(),
          severity: "note",
          label: "Stale draft",
          detail: `No edits since ${new Date(e.updatedAt).toLocaleDateString()}. Publish it or archive it.`,
          targetLabel: `${c.name} / ${e.title}`,
          fixable: false,
        });
      }
    }
  }

  for (const p of getPages(projectId)) {
    if (p.sections.length === 0) {
      out.push({
        id: pid(),
        severity: "warn",
        label: "Page has no sections",
        detail: "The page renders empty. Compose it in the visual editor.",
        targetLabel: p.title,
        fixable: false,
      });
    }
  }

  return out;
}

/** AEO readiness report: computed from real pages and sections. */
export function buildAeoFindings(projectId: string): AuditFinding[] {
  const out: AuditFinding[] = [];
  const pages = getPages(projectId);

  for (const p of pages) {
    const types = new Set(p.sections.map((s) => s.type));
    if (!types.has("faq")) {
      out.push({
        id: pid(),
        severity: "warn",
        label: "No FAQ section",
        detail: "Answer engines lift direct question and answer pairs. Add a FAQ section so this page can be cited.",
        targetLabel: p.title,
        fixable: false,
      });
    }
    if (!p.seoDescription?.trim()) {
      out.push({
        id: pid(),
        severity: "warn",
        label: "No citable summary",
        detail: "The meta description doubles as the snippet answer engines quote. Write one.",
        targetLabel: p.title,
        fixable: true,
      });
    }
  }

  const hasQuestionPage = pages.some((p) => /\b(how|what|why|when)\b/i.test(p.title));
  if (!hasQuestionPage) {
    out.push({
      id: pid(),
      severity: "note",
      label: "No question-shaped titles",
      detail: "Pages titled as questions match how people ask AI assistants. Consider one per core topic.",
      targetLabel: "Site wide",
      fixable: false,
    });
  }

  return out;
}

/** Internal link suggestions: real page and entry pairs, read only. */
export function buildLinkFindings(projectId: string): AuditFinding[] {
  const out: AuditFinding[] = [];
  const pages = getPages(projectId);
  const s = getCMSState();
  const cols = s.collections.filter((c) => c.projectId === projectId);
  const entries = cols.flatMap((c) => c.entryIds.map((id) => s.entries.find((e) => e.id === id)).filter(Boolean));

  const pricing = pages.find((p) => p.path.includes("pricing"));
  const blogPage = pages.find((p) => p.path.includes("blog"));

  for (const e of entries.slice(0, 3)) {
    if (!e) continue;
    if (pricing) {
      out.push({
        id: pid(),
        severity: "note",
        label: `Link to ${pricing.title}`,
        detail: `Readers who finish "${e.title}" convert better with a pricing link near the close.`,
        targetLabel: e.title,
        fixable: false,
      });
    }
  }
  if (blogPage && entries.length > 1) {
    out.push({
      id: pid(),
      severity: "note",
      label: "Cross-link related posts",
      detail: `"${entries[0]?.title}" and "${entries[1]?.title}" share a topic. Link them to keep readers on the site.`,
      targetLabel: blogPage.title,
      fixable: false,
    });
  }
  for (const p of pages.filter((x) => x.sections.length > 0).slice(0, 2)) {
    if (blogPage && p.path !== blogPage.path) {
      out.push({
        id: pid(),
        severity: "note",
        label: "Add a path to the blog",
        detail: `${p.title} has no route into your articles. A related reading block keeps visitors moving.`,
        targetLabel: p.title,
        fixable: false,
      });
    }
  }

  return out;
}

/* ---------------------------------------------------------------- apply */

/**
 * Apply accepted proposals through real store actions.
 * Entry drafts group by collection: one create, then field patches.
 *
 * Every write re-validates against CURRENT store state (pages can be deleted
 * or hand-edited while a run sits in review). Returns the ids that actually
 * wrote plus an undo journal so the whole run can be reverted in one click.
 */
export interface ApplyResult {
  appliedIds: string[];
  undo: UndoOp[];
}

export function applyProposals(projectId: string, proposals: ProposedChange[]): ApplyResult {
  const appliedIds: string[] = [];
  const undo: UndoOp[] = [];
  const accepted = proposals.filter((p) => p.status === "accepted");

  // Entry creation first, so field patches have a target.
  const createdByCollection = new Map<string, string>();
  for (const p of accepted) {
    if (p.operation === "content.generate" && p.targetType === "entry") {
      const entryId = entryCreateActions.add(p.targetId, p.after);
      if (typeof entryId === "string") {
        createdByCollection.set(p.targetId, entryId);
        const s = getCMSState();
        const col = s.collections.find((c) => c.id === p.targetId);
        const schema = s.schemas.find((x) => x.id === col?.schemaId);
        const titleField = schema?.titleFieldName ?? "title";
        if (schema?.fields.some((f) => f.name === titleField)) {
          entryActions.setField(entryId, titleField, p.after);
        }
        appliedIds.push(p.id);
        undo.push({ kind: "removeEntry", entryId, label: p.targetLabel });
      }
    }
  }

  for (const p of accepted) {
    if (p.operation === "content.patch" && p.targetType === "entry" && p.fieldPath) {
      // Field patches only make sense on the entry created in this run; the
      // undo removes that entry, so no separate field undo is needed.
      const entryId = createdByCollection.get(p.targetId);
      if (entryId) {
        entryActions.setField(entryId, p.fieldPath, p.after);
        appliedIds.push(p.id);
      }
    } else if (p.operation === "seo.meta" && p.targetType === "page" && p.fieldPath) {
      const fieldPath = p.fieldPath as "seoTitle" | "seoDescription";
      const current = getPages(projectId).find((pg) => pg.path === p.targetId);
      // Skip pages deleted or re-pathed since the proposal was built, and
      // fields a person filled in the meantime. Never clobber human edits.
      if (!current || (current[fieldPath] ?? "").trim() !== (p.before ?? "").trim()) continue;
      pagesActions.update(projectId, p.targetId, (pg) => ({ ...pg, [fieldPath]: p.after }));
      appliedIds.push(p.id);
      undo.push({ kind: "restorePageField", path: p.targetId, field: fieldPath, before: p.before ?? "", after: p.after, label: p.targetLabel });
    } else if (p.operation === "entry.patch" && p.targetType === "entry" && p.fieldPath) {
      // Patch an existing entry's title or a string field. Skip if the value
      // changed since the proposal was built, so we never clobber a human edit.
      const e = getCMSState().entries.find((x) => x.id === p.targetId);
      if (!e) continue;
      const current = p.fieldPath === "title" ? e.title : e.fields[p.fieldPath];
      if (String(current ?? "") !== (p.before ?? "")) continue;
      if (p.fieldPath === "title") entryActions.update(p.targetId, { title: p.after });
      else entryActions.setField(p.targetId, p.fieldPath, p.after);
      appliedIds.push(p.id);
      undo.push({ kind: "restoreEntryField", entryId: p.targetId, field: p.fieldPath, before: p.before ?? "", after: p.after, label: p.targetLabel });
    } else if (p.operation === "page.section" && p.targetType === "page" && p.fieldPath) {
      // Patch one field inside a page section: fieldPath is "sectionId.key".
      const dot = p.fieldPath.indexOf(".");
      const sectionId = p.fieldPath.slice(0, dot);
      const key = p.fieldPath.slice(dot + 1);
      const pg = getPages(projectId).find((x) => x.path === p.targetId);
      const sec = pg?.sections.find((x) => x.id === sectionId);
      if (!pg || !sec || String(sec.content?.[key] ?? "") !== (p.before ?? "")) continue;
      pagesActions.update(projectId, p.targetId, (page) => ({
        ...page,
        sections: page.sections.map((x) => (x.id === sectionId ? { ...x, content: { ...x.content, [key]: p.after } } : x)),
      }));
      appliedIds.push(p.id);
      undo.push({ kind: "restoreSectionField", path: p.targetId, sectionId, field: key, before: p.before ?? "", after: p.after, label: p.targetLabel });
    } else if (p.operation === "page.compose" && p.targetType === "page") {
      // Never overwrite a page someone created at this path meanwhile.
      if (getPages(projectId).some((pg) => pg.path === p.targetId)) continue;
      const specs = p.targetId.includes("pricing")
        ? [
            { type: "hero", content: { headline: p.targetLabel, primaryCta: "See plans" } },
            { type: "pricing" },
            { type: "faq" },
            { type: "cta" },
          ]
        : [
            { type: "hero", content: { headline: p.targetLabel, primaryCta: "Get started" } },
            { type: "logos" },
            { type: "features" },
            { type: "cta" },
          ];
      pagesActions.add(projectId, buildPage({ path: p.targetId, title: p.targetLabel, state: "draft" }, specs));
      appliedIds.push(p.id);
      undo.push({ kind: "removePage", path: p.targetId, label: p.targetLabel });
    }
  }

  return { appliedIds, undo };
}

/**
 * Reverse a run's changes. Guarded so undo never deletes content that was
 * since published or overwrites a value a person changed after the run.
 * Returns how many ops reverted and how many were skipped for safety.
 */
export function revertRun(projectId: string, undo: UndoOp[]): { reverted: number; skipped: number } {
  let reverted = 0;
  let skipped = 0;
  for (const op of undo) {
    if (op.kind === "removeEntry") {
      const e = getCMSState().entries.find((x) => x.id === op.entryId);
      if (e && e.status === "draft") {
        entryActions.remove(op.entryId);
        reverted++;
      } else {
        skipped++;
      }
    } else if (op.kind === "removePage") {
      const pg = getPages(projectId).find((x) => x.path === op.path);
      if (pg && pg.state === "draft") {
        pagesActions.remove(projectId, op.path);
        reverted++;
      } else {
        skipped++;
      }
    } else if (op.kind === "restoreEntryField") {
      const e = getCMSState().entries.find((x) => x.id === op.entryId);
      const current = op.field === "title" ? e?.title : e?.fields[op.field];
      // Only roll back if the field still holds what the agent wrote.
      if (e && String(current ?? "") === op.after) {
        if (op.field === "title") entryActions.update(op.entryId, { title: op.before });
        else entryActions.setField(op.entryId, op.field, op.before);
        reverted++;
      } else {
        skipped++;
      }
    } else if (op.kind === "restoreSectionField") {
      const pg = getPages(projectId).find((x) => x.path === op.path);
      const sec = pg?.sections.find((x) => x.id === op.sectionId);
      if (pg && sec && String(sec.content?.[op.field] ?? "") === op.after) {
        pagesActions.update(projectId, op.path, (p) => ({
          ...p,
          sections: p.sections.map((x) => (x.id === op.sectionId ? { ...x, content: { ...x.content, [op.field]: op.before } } : x)),
        }));
        reverted++;
      } else {
        skipped++;
      }
    } else {
      const pg = getPages(projectId).find((x) => x.path === op.path);
      // Only roll back if the field still holds what the agent wrote.
      if (pg && (pg[op.field] ?? "") === op.after) {
        pagesActions.update(projectId, op.path, (p) => ({ ...p, [op.field]: op.before }));
        reverted++;
      } else {
        skipped++;
      }
    }
  }
  return { reverted, skipped };
}
