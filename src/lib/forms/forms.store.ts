/**
 * Client-side, localStorage-backed forms store for the prototype.
 *
 * The forms feature was built against Supabase server functions, but this
 * build has no backend wired (no service-role key), so those calls throw.
 * This module mirrors the exact call shape of the server functions
 * (`fn({ data }) => Promise<...>`) so components can swap their imports and
 * the whole New form -> build -> submissions -> embed flow works end to end,
 * entirely in the browser. Swap this for the real API later without touching
 * the components.
 */

import type {
  CreateFormInput,
  FieldKind,
  FormDetail,
  FormField,
  FormStatus,
  FormSummary,
  FormsDashboardData,
  PageUsingForm,
} from "./types";

/* ─────────────────────────── shared row types ─────────────────────────── */

type JsonValue = string | number | boolean | null | { [k: string]: JsonValue } | JsonValue[];

/** Submissions are just active (a real lead) or spam. Nothing else. */
export type SubmissionStatus = "active" | "spam";

export type SubmissionRow = {
  id: string;
  formId: string;
  data: { [k: string]: JsonValue };
  sourceUrl: string | null;
  ipAddress: string | null;
  submittedAt: string;
  status: string;
  spamScore: number;
};

export type IntegrationKind = "webhook" | "email" | "slack" | "sheets";

export type IntegrationRow = {
  id: string;
  formId: string;
  kind: IntegrationKind;
  enabled: boolean;
  config: { [k: string]: JsonValue };
};

/* ─────────────────────────────── storage ──────────────────────────────── */

interface FormRecord {
  id: string;
  projectSlug: string;
  name: string;
  slug: string;
  description: string | null;
  status: FormStatus;
  settings: Record<string, unknown>;
  submitAction: { kind: string; message?: string; url?: string; label?: string };
  updatedAt: string;
}

interface DB {
  seeded: string[];
  forms: FormRecord[];
  fields: FormField[];
  submissions: SubmissionRow[];
  integrations: IntegrationRow[];
  usages: PageUsingForm[];
}

const LS_KEY = "bettercms.forms.v1";

function emptyDB(): DB {
  return { seeded: [], forms: [], fields: [], submissions: [], integrations: [], usages: [] };
}

let _db: DB | null = null;

function db(): DB {
  if (_db) return _db;
  if (typeof window === "undefined") {
    _db = emptyDB();
    return _db;
  }
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    _db = raw ? { ...emptyDB(), ...(JSON.parse(raw) as DB) } : emptyDB();
  } catch {
    _db = emptyDB();
  }
  // Backfill fields added after a submission was first stored, so older
  // localStorage data still renders (e.g. IP address column).
  let migrated = false;
  _db.submissions.forEach((s) => {
    if (s.ipAddress == null) {
      s.ipAddress = stableIp(s.id);
      migrated = true;
    }
    // Submissions are now just active-vs-spam; collapse legacy read/archived.
    if (s.status === "read" || s.status === "archived" || s.status === "new") {
      s.status = "active";
      migrated = true;
    }
  });
  if (migrated) save();
  return _db;
}

function save() {
  if (typeof window === "undefined" || !_db) return;
  try {
    window.localStorage.setItem(LS_KEY, JSON.stringify(_db));
  } catch {
    /* quota or private mode - keep working from memory */
  }
}

/* ─────────────────────────────── helpers ──────────────────────────────── */

let _seq = 0;
function uid(prefix = "id"): string {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 8)
      : (++_seq).toString(36).padStart(4, "0");
  return `${prefix}_${Date.now().toString(36)}${rand}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Deterministic public-looking IP from an id, for backfilling old rows. */
function stableIp(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `203.0.113.${(h % 253) + 1}`;
}

function minsAgo(mins: number): string {
  return new Date(Date.now() - mins * 60_000).toISOString();
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "form"
  );
}

function uniqueSlug(projectSlug: string, base: string): string {
  let slug = base;
  for (let i = 2; i < 500; i++) {
    if (!db().forms.some((f) => f.projectSlug === projectSlug && f.slug === slug)) break;
    slug = `${base}-${i}`;
  }
  return slug;
}

function touch(formId: string) {
  const f = db().forms.find((x) => x.id === formId);
  if (f) f.updatedAt = nowIso();
}

function fieldLabel(kind: FieldKind): string {
  return (
    {
      text: "Text",
      email: "Email",
      textarea: "Message",
      phone: "Phone",
      number: "Number",
      url: "URL",
      select: "Select",
      radio: "Choose one",
      checkbox: "Choose any",
      consent: "I agree",
      date: "Date",
    } as Record<FieldKind, string>
  )[kind];
}

function defaultOptions(kind: FieldKind): FormField["options"] {
  if (kind === "select" || kind === "radio" || kind === "checkbox") {
    return {
      choices: [
        { label: "Option 1", value: "option_1" },
        { label: "Option 2", value: "option_2" },
      ],
    };
  }
  return {};
}

/* ─────────────────────────── field templates ──────────────────────────── */

const TEMPLATE_FIELDS: Record<
  NonNullable<CreateFormInput["template"]>,
  Array<{ kind: FieldKind; name: string; label: string; required?: boolean; placeholder?: string }>
> = {
  blank: [],
  contact: [
    { kind: "text", name: "name", label: "Name", required: true, placeholder: "Jane Doe" },
    { kind: "email", name: "email", label: "Email", required: true, placeholder: "you@example.com" },
    { kind: "textarea", name: "message", label: "Message", required: true, placeholder: "How can we help?" },
  ],
  newsletter: [
    { kind: "email", name: "email", label: "Email", required: true, placeholder: "you@example.com" },
    { kind: "consent", name: "consent", label: "I agree to receive newsletter emails", required: true },
  ],
  lead: [
    { kind: "text", name: "name", label: "Full name", required: true },
    { kind: "email", name: "email", label: "Work email", required: true },
    { kind: "text", name: "company", label: "Company" },
    { kind: "select", name: "size", label: "Company size" },
    { kind: "textarea", name: "details", label: "Tell us about your project" },
  ],
};

function addFieldsFromTemplate(formId: string, template: NonNullable<CreateFormInput["template"]>) {
  TEMPLATE_FIELDS[template].forEach((t, i) => {
    db().fields.push({
      id: uid("fld"),
      formId,
      groupId: null,
      kind: t.kind,
      name: t.name,
      label: t.label,
      placeholder: t.placeholder ?? null,
      helpText: null,
      required: !!t.required,
      options: defaultOptions(t.kind),
      validation: {},
      position: i,
    });
  });
}

/* ──────────────────────────────── seed ────────────────────────────────── */

function makeForm(
  projectSlug: string,
  name: string,
  template: NonNullable<CreateFormInput["template"]>,
  status: FormStatus,
  description: string | null,
  updatedMinsAgo: number,
): FormRecord {
  const id = uid("frm");
  const rec: FormRecord = {
    id,
    projectSlug,
    name,
    slug: uniqueSlug(projectSlug, slugify(name)),
    description,
    status,
    settings: {},
    submitAction: { kind: "message", message: "Thanks! We'll be in touch soon." },
    updatedAt: minsAgo(updatedMinsAgo),
  };
  db().forms.push(rec);
  addFieldsFromTemplate(id, template);
  return rec;
}

function seedProject(projectSlug: string) {
  const d = db();
  if (d.seeded.includes(projectSlug)) return;
  d.seeded.push(projectSlug);

  const contact = makeForm(projectSlug, "Contact form", "contact", "published", "Used on the contact page", 90);
  const newsletter = makeForm(projectSlug, "Newsletter signup", "newsletter", "published", "Footer email capture", 1440);
  makeForm(projectSlug, "Demo request", "lead", "draft", "Sales-qualified lead capture", 5760);

  const site = "https://acme.example.com";
  const subs: Array<{ formId: string; mins: number; data: Record<string, JsonValue>; status: SubmissionStatus; source: string; ip: string }> = [
    { formId: contact.id, mins: 18, status: "active", source: `${site}/contact`, ip: "203.0.113.42", data: { name: "Priya Nair", email: "priya@brightlabs.io", message: "Do you offer annual billing for teams over 20 seats?" } },
    { formId: contact.id, mins: 200, status: "active", source: `${site}/contact`, ip: "198.51.100.17", data: { name: "Marcus Feld", email: "marcus@feld.studio", message: "Loving the product. Any chance of a Figma plugin?" } },
    { formId: contact.id, mins: 1500, status: "active", source: `${site}/pricing`, ip: "203.0.113.9", data: { name: "Dana Ortiz", email: "dana@northwind.co", message: "Need a quote for a 3-year contract." } },
    { formId: newsletter.id, mins: 42, status: "active", source: `${site}/`, ip: "192.0.2.128", data: { email: "sofia.reyes@gmail.com", consent: true } },
    { formId: newsletter.id, mins: 120, status: "active", source: `${site}/blog/launch-week`, ip: "198.51.100.203", data: { email: "t.okafor@proton.me", consent: true } },
    { formId: newsletter.id, mins: 900, status: "active", source: `${site}/`, ip: "203.0.113.77", data: { email: "hello@indiehacker.dev", consent: true } },
    { formId: newsletter.id, mins: 2600, status: "spam", source: `${site}/blog`, ip: "45.148.10.201", data: { email: "spam-bot@tempmail.xyz", consent: false } },
  ];
  subs.forEach((s) =>
    d.submissions.push({
      id: uid("sub"),
      formId: s.formId,
      data: s.data,
      sourceUrl: s.source,
      ipAddress: s.ip,
      submittedAt: minsAgo(s.mins),
      status: s.status,
      spamScore: s.data.email === "spam-bot@tempmail.xyz" ? 0.82 : 0.02,
    }),
  );

  d.integrations.push({
    id: uid("int"),
    formId: contact.id,
    kind: "slack",
    enabled: true,
    config: { webhook_url: "https://hooks.slack.com/services/T000/B000/xxxx" },
  });

  d.usages.push({ formId: contact.id, formName: contact.name, pageId: "contact", blockId: uid("blk") });
  d.usages.push({ formId: newsletter.id, formName: newsletter.name, pageId: "home", blockId: uid("blk") });

  save();
}

/* ───────────────────────────── projections ────────────────────────────── */

function summaryOf(f: FormRecord): FormSummary {
  return {
    id: f.id,
    projectSlug: f.projectSlug,
    name: f.name,
    slug: f.slug,
    description: f.description,
    status: f.status,
    submissionCount: db().submissions.filter((s) => s.formId === f.id && s.status !== "spam").length,
    pagesUsing: db().usages.filter((u) => u.formId === f.id).length,
    updatedAt: f.updatedAt,
  };
}

function detailOf(f: FormRecord): FormDetail {
  return {
    id: f.id,
    projectSlug: f.projectSlug,
    name: f.name,
    slug: f.slug,
    description: f.description,
    status: f.status,
    settings: f.settings,
    submitAction: f.submitAction,
    fields: db()
      .fields.filter((x) => x.formId === f.id)
      .sort((a, b) => a.position - b.position),
  };
}

/* ───────────────────────────── forms: read ────────────────────────────── */

export async function getFormsDashboard(args: { data: { projectSlug: string } }): Promise<FormsDashboardData> {
  const { projectSlug } = args.data;
  seedProject(projectSlug);

  const forms = db()
    .forms.filter((f) => f.projectSlug === projectSlug)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const formIds = new Set(forms.map((f) => f.id));
  const nameById = new Map(forms.map((f) => [f.id, f.name]));

  // Spam never counts toward stats or activity — it isn't a real lead.
  const subs = db()
    .submissions.filter((s) => formIds.has(s.formId) && s.status !== "spam")
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const subsToday = subs.filter((s) => new Date(s.submittedAt).getTime() >= startOfDay.getTime()).length;

  const recentActivity: FormsDashboardData["recentActivity"] = subs.slice(0, 10).map((s) => {
    const data = s.data as Record<string, unknown>;
    const preview =
      (typeof data.email === "string" && data.email) ||
      (typeof data.name === "string" && data.name) ||
      (typeof data.message === "string" && (data.message as string).slice(0, 60)) ||
      "Submission";
    return {
      id: s.id,
      formId: s.formId,
      formName: nameById.get(s.formId) ?? "Form",
      sourceUrl: s.sourceUrl,
      submittedAt: s.submittedAt,
      preview: String(preview),
    };
  });

  const summaries = forms.map(summaryOf);

  return {
    stats: {
      totalForms: summaries.length,
      activeForms: summaries.filter((s) => s.status === "published").length,
      totalSubmissions: subs.length,
      submissionsToday: subsToday,
    },
    recentActivity,
    pagesUsing: db().usages.filter((u) => formIds.has(u.formId)),
    recentForms: summaries.slice(0, 5),
    allForms: summaries,
  };
}

export async function getForm(args: { data: { formId: string } }): Promise<FormDetail> {
  const f = db().forms.find((x) => x.id === args.data.formId);
  if (!f) throw new Error("Form not found");
  return detailOf(f);
}

/* ──────────────────────────── forms: write ────────────────────────────── */

export async function createForm(args: { data: CreateFormInput }): Promise<{ id: string; slug: string }> {
  const { projectSlug, name, description, template } = args.data;
  seedProject(projectSlug);
  const id = uid("frm");
  const rec: FormRecord = {
    id,
    projectSlug,
    name,
    slug: uniqueSlug(projectSlug, slugify(name)),
    description: description ?? null,
    status: "draft",
    settings: {},
    submitAction: { kind: "message", message: "Thanks! We'll be in touch soon." },
    updatedAt: nowIso(),
  };
  db().forms.push(rec);
  addFieldsFromTemplate(id, template ?? "blank");
  save();
  return { id: rec.id, slug: rec.slug };
}

export async function duplicateForm(args: { data: { formId: string } }): Promise<{ id: string }> {
  const src = db().forms.find((x) => x.id === args.data.formId);
  if (!src) throw new Error("Form not found");
  const id = uid("frm");
  const copy: FormRecord = {
    ...src,
    id,
    name: `${src.name} (copy)`,
    slug: uniqueSlug(src.projectSlug, `${src.slug}-copy`),
    status: "draft",
    updatedAt: nowIso(),
  };
  db().forms.push(copy);
  db()
    .fields.filter((f) => f.formId === src.id)
    .sort((a, b) => a.position - b.position)
    .forEach((f) => db().fields.push({ ...f, id: uid("fld"), formId: id }));
  save();
  return { id };
}

export async function deleteForm(args: { data: { formId: string } }): Promise<{ ok: true }> {
  const { formId } = args.data;
  const d = db();
  d.forms = d.forms.filter((f) => f.id !== formId);
  d.fields = d.fields.filter((f) => f.formId !== formId);
  d.submissions = d.submissions.filter((s) => s.formId !== formId);
  d.integrations = d.integrations.filter((i) => i.formId !== formId);
  d.usages = d.usages.filter((u) => u.formId !== formId);
  save();
  return { ok: true };
}

export async function updateForm(args: {
  data: {
    formId: string;
    patch: Partial<{
      name: string;
      description: string | null;
      status: FormStatus;
      settings: Record<string, unknown>;
      submit_action: Record<string, unknown>;
    }>;
  };
}): Promise<{ ok: true }> {
  const f = db().forms.find((x) => x.id === args.data.formId);
  if (!f) throw new Error("Form not found");
  const p = args.data.patch;
  if ("name" in p && p.name != null) f.name = p.name;
  if ("description" in p) f.description = p.description ?? null;
  if ("status" in p && p.status) f.status = p.status;
  if ("settings" in p && p.settings) f.settings = p.settings;
  if ("submit_action" in p && p.submit_action) f.submitAction = p.submit_action as FormRecord["submitAction"];
  f.updatedAt = nowIso();
  save();
  return { ok: true };
}

export async function updateFormStatus(args: {
  data: { formId: string; status: FormStatus };
}): Promise<{ ok: true }> {
  return updateForm({ data: { formId: args.data.formId, patch: { status: args.data.status } } });
}

/* ───────────────────────────── fields: write ──────────────────────────── */

export async function createField(args: {
  data: { formId: string; kind: FieldKind; label?: string; afterFieldId?: string | null };
}): Promise<FormField> {
  const { formId, kind, label, afterFieldId } = args.data;
  const list = db()
    .fields.filter((f) => f.formId === formId)
    .sort((a, b) => a.position - b.position);

  let insertIndex = list.length;
  if (afterFieldId) {
    const idx = list.findIndex((f) => f.id === afterFieldId);
    if (idx >= 0) insertIndex = idx + 1;
  }

  const taken = new Set(list.map((f) => f.name));
  let name: string = kind;
  let i = 2;
  while (taken.has(name)) name = `${kind}_${i++}`;

  // shift fields at/after the insert point
  db()
    .fields.filter((f) => f.formId === formId && f.position >= insertIndex)
    .forEach((f) => (f.position += 1));

  const field: FormField = {
    id: uid("fld"),
    formId,
    groupId: null,
    kind,
    name,
    label: label ?? fieldLabel(kind),
    placeholder: null,
    helpText: null,
    required: false,
    options: defaultOptions(kind),
    validation: {},
    position: insertIndex,
  };
  db().fields.push(field);
  touch(formId);
  save();
  return field;
}

export async function updateField(args: {
  data: {
    fieldId: string;
    patch: Partial<{
      label: string;
      name: string;
      placeholder: string | null;
      help_text: string | null;
      required: boolean;
      options: Record<string, unknown>;
      validation: Record<string, unknown>;
    }>;
  };
}): Promise<{ ok: true }> {
  const f = db().fields.find((x) => x.id === args.data.fieldId);
  if (!f) throw new Error("Field not found");
  const p = args.data.patch;
  if ("label" in p && p.label != null) f.label = p.label;
  if ("name" in p && p.name != null) f.name = p.name;
  if ("placeholder" in p) f.placeholder = p.placeholder ?? null;
  if ("help_text" in p) f.helpText = p.help_text ?? null;
  if ("required" in p && p.required != null) f.required = p.required;
  if ("options" in p && p.options) f.options = p.options as FormField["options"];
  if ("validation" in p && p.validation) f.validation = p.validation as FormField["validation"];
  touch(f.formId);
  save();
  return { ok: true };
}

export async function deleteField(args: { data: { fieldId: string } }): Promise<{ ok: true }> {
  const f = db().fields.find((x) => x.id === args.data.fieldId);
  if (f) {
    db().fields = db().fields.filter((x) => x.id !== args.data.fieldId);
    // compact positions
    db()
      .fields.filter((x) => x.formId === f.formId)
      .sort((a, b) => a.position - b.position)
      .forEach((x, i) => (x.position = i));
    touch(f.formId);
    save();
  }
  return { ok: true };
}

export async function duplicateField(args: { data: { fieldId: string } }): Promise<FormField> {
  const src = db().fields.find((x) => x.id === args.data.fieldId);
  if (!src) throw new Error("Field not found");
  const list = db().fields.filter((f) => f.formId === src.formId);
  const taken = new Set(list.map((r) => r.name));
  let name = `${src.name}_copy`;
  let i = 2;
  while (taken.has(name)) name = `${src.name}_copy_${i++}`;

  const insertIndex = src.position + 1;
  db()
    .fields.filter((f) => f.formId === src.formId && f.position >= insertIndex)
    .forEach((f) => (f.position += 1));

  const copy: FormField = { ...src, id: uid("fld"), name, position: insertIndex };
  db().fields.push(copy);
  touch(src.formId);
  save();
  return copy;
}

export async function reorderFields(args: {
  data: { formId: string; orderedIds: string[] };
}): Promise<{ ok: true }> {
  args.data.orderedIds.forEach((id, i) => {
    const f = db().fields.find((x) => x.id === id && x.formId === args.data.formId);
    if (f) f.position = i;
  });
  touch(args.data.formId);
  save();
  return { ok: true };
}

/* ───────────────────────────── submissions ────────────────────────────── */

export async function listSubmissions(args: {
  data: { formId: string; status?: string | null; q?: string | null };
}): Promise<SubmissionRow[]> {
  const { formId, status, q } = args.data;
  let out = db()
    .submissions.filter((s) => s.formId === formId)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
  if (status && status !== "all") out = out.filter((s) => s.status === status);
  if (q) {
    const needle = q.toLowerCase();
    out = out.filter((s) => JSON.stringify(s.data).toLowerCase().includes(needle));
  }
  return out.map((s) => ({ ...s }));
}

function fakeIp(): string {
  // Deterministic-ish public-looking IP so preview rows have an address.
  const n = Date.now();
  return `203.0.113.${(n % 254) + 1}`;
}

/** Record a submission from the in-app preview so the loop closes end to end. */
export async function recordSubmission(args: {
  data: { formId: string; data: { [k: string]: JsonValue }; sourceUrl?: string | null };
}): Promise<{ id: string }> {
  const row: SubmissionRow = {
    id: uid("sub"),
    formId: args.data.formId,
    data: args.data.data,
    sourceUrl: args.data.sourceUrl ?? "In-app preview",
    ipAddress: fakeIp(),
    submittedAt: nowIso(),
    status: "active",
    spamScore: 0,
  };
  db().submissions.push(row);
  save();
  return { id: row.id };
}

export async function bulkUpdateSubmissionStatus(args: {
  data: { ids: string[]; status: SubmissionStatus };
}): Promise<{ ok: true }> {
  const ids = new Set(args.data.ids);
  db().submissions.forEach((s) => {
    if (ids.has(s.id)) s.status = args.data.status;
  });
  save();
  return { ok: true };
}

export async function bulkDeleteSubmissions(args: { data: { ids: string[] } }): Promise<{ ok: true }> {
  const ids = new Set(args.data.ids);
  db().submissions = db().submissions.filter((s) => !ids.has(s.id));
  save();
  return { ok: true };
}

export async function updateSubmissionStatus(args: {
  data: { id: string; status: SubmissionStatus };
}): Promise<{ ok: true }> {
  const s = db().submissions.find((x) => x.id === args.data.id);
  if (s) {
    s.status = args.data.status;
    save();
  }
  return { ok: true };
}

export async function deleteSubmission(args: { data: { id: string } }): Promise<{ ok: true }> {
  db().submissions = db().submissions.filter((s) => s.id !== args.data.id);
  save();
  return { ok: true };
}

/* ──────────────────────────── integrations ────────────────────────────── */

export async function listIntegrations(args: { data: { formId: string } }): Promise<IntegrationRow[]> {
  return db()
    .integrations.filter((i) => i.formId === args.data.formId)
    .map((i) => ({ ...i }));
}

export async function createIntegration(args: {
  data: { formId: string; kind: IntegrationKind };
}): Promise<{ id: string }> {
  const defaults: Record<IntegrationKind, { [k: string]: JsonValue }> = {
    webhook: { url: "" },
    email: { to: "" },
    slack: { webhook_url: "" },
    sheets: { connected: false },
  };
  const row: IntegrationRow = {
    id: uid("int"),
    formId: args.data.formId,
    kind: args.data.kind,
    enabled: true,
    config: defaults[args.data.kind],
  };
  db().integrations.push(row);
  save();
  return { id: row.id };
}

export async function updateIntegration(args: {
  data: { id: string; patch: Partial<{ enabled: boolean; config: { [k: string]: JsonValue } }> };
}): Promise<{ ok: true }> {
  const row = db().integrations.find((i) => i.id === args.data.id);
  if (row) {
    if ("enabled" in args.data.patch && args.data.patch.enabled != null) row.enabled = args.data.patch.enabled;
    if ("config" in args.data.patch && args.data.patch.config) row.config = args.data.patch.config;
    save();
  }
  return { ok: true };
}

export async function deleteIntegration(args: { data: { id: string } }): Promise<{ ok: true }> {
  db().integrations = db().integrations.filter((i) => i.id !== args.data.id);
  save();
  return { ok: true };
}
