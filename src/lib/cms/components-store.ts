/**
 * components-store — hub-created section components, per project.
 *
 * Built-in sections stay code-defined in SECTION_DEFS (the repo is canonical
 * for rendering). This store holds components created in the Components hub,
 * by hand or through the AI studio. They render through GenericSection, a
 * token-driven renderer: the CMS never executes user-authored code.
 *
 * Fields are typed (text, long text, image, number, link, slot). A slot is a
 * designated area that embeds another component from the library, one level
 * deep; instance-level slot overrides across the editor are the committed
 * next step (see COMPONENTS_PLAN.md).
 *
 * The AI studio is conversational: chats persist here, every turn spends
 * credits, and each applied change is auditable.
 */
import { useSyncExternalStore } from "react";
import {
  BarChart3,
  HelpCircle,
  Image as ImageIcon,
  Layers,
  LayoutGrid,
  ListOrdered,
  Megaphone,
  MousePointerClick,
  Quote,
  Sparkles,
  Star,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  registerSectionResolver,
  SECTION_DEFS,
  type SectionDef,
  type SectionVariant,
} from "@/components/cms/editor/sections/SectionSystem";
import { GenericSection } from "@/components/cms/components/GenericSection";
import { getPages } from "@/lib/cms/pages-store";

export type ComponentStatus = "draft" | "published" | "archived";
export type ComponentOrigin = "manual" | "ai" | "duplicate";
export type CustomFieldType = "text" | "longtext" | "image" | "number" | "link" | "slot";

export interface CustomField {
  key: string;
  label: string;
  type: CustomFieldType;
}

export const FIELD_TYPES: { id: CustomFieldType; label: string; hint: string }[] = [
  { id: "text", label: "Text", hint: "Short copy, one line" },
  { id: "longtext", label: "Long text", hint: "Paragraphs, multi line" },
  { id: "image", label: "Image", hint: "Picked from the media library" },
  { id: "number", label: "Number", hint: "Stats, prices, counts" },
  { id: "link", label: "Link", hint: "A button or CTA" },
  { id: "slot", label: "Slot", hint: "Embeds another component" },
];

/** Curated icon set for hub components. Built-ins set icons in code. */
export const COMPONENT_ICONS: { id: string; icon: LucideIcon }[] = [
  { id: "sparkles", icon: Sparkles },
  { id: "grid", icon: LayoutGrid },
  { id: "star", icon: Star },
  { id: "quote", icon: Quote },
  { id: "megaphone", icon: Megaphone },
  { id: "users", icon: Users },
  { id: "image", icon: ImageIcon },
  { id: "list", icon: ListOrdered },
  { id: "help", icon: HelpCircle },
  { id: "chart", icon: BarChart3 },
  { id: "layers", icon: Layers },
  { id: "pointer", icon: MousePointerClick },
];
export const componentIcon = (id?: string): LucideIcon =>
  COMPONENT_ICONS.find((i) => i.id === id)?.icon ?? Sparkles;

export interface CustomComponent {
  id: string;
  projectId: string;
  /** Section type key, unique across built-ins and customs. */
  type: string;
  name: string;
  blurb: string;
  category: string;
  status: ComponentStatus;
  origin: ComponentOrigin;
  iconId?: string;
  fields: CustomField[];
  variants: SectionVariant[];
  defaults: Record<string, string>;
  prompt?: string;
  createdAt: number;
  updatedAt: number;
}

const byProject = new Map<string, CustomComponent[]>();
const chatsByProject = new Map<string, ComponentChat[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let seq = 0;
const newId = (p: string) => `${p}_${Date.now().toString(36)}${(seq++).toString(36)}`;

export function slugifyType(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "component"
  );
}

function uniqueType(name: string): string {
  const base = slugifyType(name);
  const taken = new Set<string>([
    ...SECTION_DEFS.map((d) => d.type),
    ...[...byProject.values()].flat().map((c) => c.type),
  ]);
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

/* ------------------------------------------------------------------- seed */

function seed(projectId: string): CustomComponent[] {
  const now = Date.now();
  return [
    {
      id: `cmp_seed_${projectId}_stats`,
      projectId,
      type: `stats-band-${projectId.slice(-4)}`,
      name: "Stats band",
      blurb: "Three headline numbers with labels",
      category: "Social proof",
      status: "published",
      origin: "manual",
      iconId: "chart",
      fields: [
        { key: "eyebrow", label: "Eyebrow", type: "text" },
        { key: "heading", label: "Heading", type: "text" },
        { key: "item1", label: "Stat 1", type: "number" },
        { key: "item2", label: "Stat 2", type: "number" },
        { key: "item3", label: "Stat 3", type: "number" },
      ],
      variants: [
        { id: "centered", name: "Centered" },
        { id: "left", name: "Left aligned" },
      ],
      defaults: {
        eyebrow: "By the numbers",
        heading: "Teams ship faster here",
        item1: "3x faster launches",
        item2: "40 pages per batch",
        item3: "Zero rebinding",
      },
      createdAt: now - 86400000 * 6,
      updatedAt: now - 86400000 * 2,
    },
    {
      id: `cmp_seed_${projectId}_story`,
      projectId,
      type: `story-band-${projectId.slice(-4)}`,
      name: "Story band",
      blurb: "Image beside a short story with a quote slot",
      category: "Content",
      status: "draft",
      origin: "ai",
      iconId: "image",
      prompt: "An image-and-story band with room for a customer quote",
      fields: [
        { key: "heading", label: "Heading", type: "text" },
        { key: "body", label: "Story", type: "longtext" },
        { key: "image", label: "Image", type: "image" },
        { key: "cta", label: "Link label", type: "link" },
        { key: "slot1", label: "Quote area", type: "slot" },
      ],
      variants: [{ id: "centered", name: "Centered" }],
      defaults: {
        heading: "From forty tabs to one prompt",
        body: "The launch that used to take a sprint now ships in an afternoon, reviewed and on brand.",
        image: "aurora",
        cta: "Read the story",
        slot1: "testimonial",
      },
      createdAt: now - 86400000,
      updatedAt: now - 86400000,
    },
  ];
}

function ensure(projectId: string): CustomComponent[] {
  let arr = byProject.get(projectId);
  if (!arr) {
    arr = seed(projectId);
    byProject.set(projectId, arr);
  }
  return arr;
}

export function useCustomComponents(projectId: string): CustomComponent[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(projectId),
    () => ensure(projectId),
  );
}
export const getCustomComponents = (projectId: string) => ensure(projectId);

function patch(projectId: string, next: CustomComponent[]) {
  byProject.set(projectId, next);
  emit();
}

/* ---------------------------------------------------------------- actions */

export interface ComponentInput {
  name: string;
  blurb?: string;
  category?: string;
  iconId?: string;
  fields: CustomField[];
  variants?: SectionVariant[];
  defaults?: Record<string, string>;
  origin?: ComponentOrigin;
  prompt?: string;
}

export const componentHubActions = {
  create(projectId: string, input: ComponentInput): CustomComponent {
    const c: CustomComponent = {
      id: newId("cmp"),
      projectId,
      type: uniqueType(input.name),
      name: input.name.trim(),
      blurb: input.blurb?.trim() || "A custom section for this site",
      category: input.category || "Content",
      status: "draft",
      origin: input.origin ?? "manual",
      iconId: input.iconId,
      fields: input.fields.length ? input.fields : [{ key: "heading", label: "Heading", type: "text" }],
      variants: input.variants?.length ? input.variants : [{ id: "centered", name: "Centered" }],
      defaults: input.defaults ?? {},
      prompt: input.prompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    patch(projectId, [c, ...ensure(projectId)]);
    return c;
  },
  update(projectId: string, id: string, up: Partial<Pick<CustomComponent, "name" | "blurb" | "category" | "iconId" | "fields" | "variants" | "defaults">>) {
    patch(
      projectId,
      ensure(projectId).map((c) => (c.id === id ? { ...c, ...up, updatedAt: Date.now() } : c)),
    );
  },
  setStatus(projectId: string, id: string, status: ComponentStatus) {
    patch(
      projectId,
      ensure(projectId).map((c) => (c.id === id ? { ...c, status, updatedAt: Date.now() } : c)),
    );
  },
  /** Delete is guarded: only unused components can be removed. */
  remove(projectId: string, id: string): boolean {
    const c = ensure(projectId).find((x) => x.id === id);
    if (!c) return false;
    if (componentUsage(projectId, c.type).count > 0) return false;
    patch(projectId, ensure(projectId).filter((x) => x.id !== id));
    return true;
  },
  duplicate(projectId: string, source: { name: string; blurb: string; category: string; fields: { key: string; label: string; multiline?: boolean }[] | CustomField[]; variants: SectionVariant[]; defaults: Record<string, string> }): CustomComponent {
    return componentHubActions.create(projectId, {
      name: `${source.name} copy`,
      blurb: source.blurb,
      category: source.category,
      fields: source.fields.map((f) => ({
        key: f.key,
        label: f.label,
        type: ("type" in f ? f.type : (f as { multiline?: boolean }).multiline ? "longtext" : "text") as CustomFieldType,
      })),
      variants: source.variants.map((v) => ({ ...v })),
      defaults: { ...source.defaults },
      origin: "duplicate",
    });
  },
};

/* ----------------------------------------------------------------- usage */

export function componentUsage(projectId: string, type: string): { count: number; pages: { title: string; path: string }[] } {
  const pages = getPages(projectId).filter((p) => p.sections?.some((s) => s.type === type));
  return { count: pages.length, pages: pages.map((p) => ({ title: p.title, path: p.path })) };
}

/* ------------------------------------------------- section-system bridge */

export function toSectionDef(c: CustomComponent, opts?: { nameSuffix?: string }): SectionDef {
  return {
    type: c.type,
    name: opts?.nameSuffix ? `${c.name} ${opts.nameSuffix}` : c.name,
    blurb: c.blurb,
    category: c.category,
    icon: componentIcon(c.iconId),
    variants: c.variants,
    fields: c.fields.map((f) => ({ key: f.key, label: f.label, multiline: f.type === "longtext" })),
    defaults: c.defaults,
    render: (p) => GenericSection({ component: c, p }),
  };
}

registerSectionResolver((type) => {
  for (const arr of byProject.values()) {
    const c = arr.find((x) => x.type === type && x.status !== "archived");
    if (c) return toSectionDef(c);
  }
  return undefined;
});

/** Every def a slot can embed (built-ins + this project's live customs). */
export function slotTargets(projectId: string): { type: string; name: string }[] {
  return [
    ...SECTION_DEFS.map((d) => ({ type: d.type, name: d.name })),
    ...ensure(projectId).filter((c) => c.status !== "archived").map((c) => ({ type: c.type, name: c.name })),
  ];
}

/* ------------------------------------------------------------- code stub */

const TS_TYPE: Record<CustomFieldType, string> = {
  text: "string",
  longtext: "string",
  image: "ImageRef",
  number: "string",
  link: "LinkRef",
  slot: "SlotRef",
};

export function componentCodeStub(c: CustomComponent): string {
  const pascal = c.name.replace(/(^|[^a-zA-Z0-9])([a-z])/g, (_m, _s, ch) => ch.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
  const props = c.fields.map((f) => `  ${f.key}: ${TS_TYPE[f.type]};`).join("\n");
  return `// ${c.type}.tsx — starter component generated by BetterCMS
// Production rendering lives in your repo. Sync model changes with:
//   npx bettercms components pull

import { section, type ImageRef, type LinkRef, type SlotRef } from "@bettercms/react";

interface ${pascal}Props {
${props}
}

export const ${pascal} = section("${c.type}", (props: ${pascal}Props) => {
  return (
    <section className="bcms-section" data-variant={props.variant}>
${c.fields.map((f) => (f.type === "slot" ? `      <Slot of={props.${f.key}} /> {/* ${f.label} */}` : `      <span>{props.${f.key}}</span> {/* ${f.label} */}`)).join("\n")}
    </section>
  );
});
`;
}

/* ------------------------------------------------------------ AI studio */

export interface ChatAttachment {
  name: string;
  kind: "image" | "video" | "file";
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at: number;
  attachments?: ChatAttachment[];
  /** @-referenced component names. */
  refs?: string[];
  /** Workspace skills applied to this turn. */
  skills?: string[];
  credits?: number;
  componentId?: string;
}
export interface ComponentChat {
  id: string;
  projectId: string;
  title: string;
  componentId?: string;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
}

function ensureChats(projectId: string): ComponentChat[] {
  let arr = chatsByProject.get(projectId);
  if (!arr) {
    arr = [];
    chatsByProject.set(projectId, arr);
  }
  return arr;
}

export function useComponentChats(projectId: string): ComponentChat[] {
  return useSyncExternalStore(
    subscribe,
    () => ensureChats(projectId),
    () => ensureChats(projectId),
  );
}

export const componentChatActions = {
  newChat(projectId: string, title: string): ComponentChat {
    const chat: ComponentChat = {
      id: newId("cchat"),
      projectId,
      title: title.slice(0, 60),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [],
    };
    chatsByProject.set(projectId, [chat, ...ensureChats(projectId)]);
    emit();
    return chat;
  },
  addMessage(projectId: string, chatId: string, msg: Omit<ChatMessage, "id" | "at">): ChatMessage {
    const m: ChatMessage = { ...msg, id: newId("cmsg"), at: Date.now() };
    chatsByProject.set(
      projectId,
      ensureChats(projectId).map((c) =>
        c.id === chatId
          ? { ...c, updatedAt: Date.now(), componentId: msg.componentId ?? c.componentId, messages: [...c.messages, m] }
          : c,
      ),
    );
    emit();
    return m;
  },
  remove(projectId: string, chatId: string) {
    chatsByProject.set(projectId, ensureChats(projectId).filter((c) => c.id !== chatId));
    emit();
  },
};

/* ------------------------------------------------------ drafting engine */

export interface ComponentGenerateConfig {
  prompt: string;
  category?: string;
  /** @-referenced component: blend its shape into the draft. */
  refType?: string;
}

interface Archetype {
  match: RegExp;
  name: string;
  blurb: string;
  category: string;
  iconId: string;
  fields: CustomField[];
  defaults: (topic: string) => Record<string, string>;
}

const ARCHETYPES: Archetype[] = [
  {
    match: /stat|number|metric|kpi/i,
    name: "Stats band",
    blurb: "Headline numbers with labels",
    category: "Social proof",
    iconId: "chart",
    fields: [
      { key: "eyebrow", label: "Eyebrow", type: "text" },
      { key: "heading", label: "Heading", type: "text" },
      { key: "item1", label: "Stat 1", type: "number" },
      { key: "item2", label: "Stat 2", type: "number" },
      { key: "item3", label: "Stat 3", type: "number" },
    ],
    defaults: (t) => ({
      eyebrow: "By the numbers",
      heading: t || "Proof, not promises",
      item1: "99.9% uptime",
      item2: "2 week migrations",
      item3: "40 pages per batch",
    }),
  },
  {
    match: /team|people|founder|face/i,
    name: "Team row",
    blurb: "Introduce the people behind the product",
    category: "Content",
    iconId: "users",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Intro", type: "longtext" },
      { key: "item1", label: "Person 1", type: "text" },
      { key: "item2", label: "Person 2", type: "text" },
      { key: "item3", label: "Person 3", type: "text" },
    ],
    defaults: (t) => ({
      heading: t || "The people building it",
      body: "A small team that answers its own support inbox.",
      item1: "Jane Park, Product",
      item2: "Arun Mehta, Engineering",
      item3: "Kiran Rao, Design",
    }),
  },
  {
    match: /step|how it works|process|onboard/i,
    name: "Steps",
    blurb: "A numbered how-it-works walk",
    category: "Content",
    iconId: "list",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "item1", label: "Step 1", type: "longtext" },
      { key: "item2", label: "Step 2", type: "longtext" },
      { key: "item3", label: "Step 3", type: "longtext" },
      { key: "cta", label: "CTA label", type: "link" },
    ],
    defaults: (t) => ({
      heading: t || "How it works",
      item1: "Connect your assistant with one command.",
      item2: "Draft pages, entries and schema together.",
      item3: "Review every change, then publish.",
      cta: "Open the demo",
    }),
  },
  {
    match: /quote|testimonial|review/i,
    name: "Pull quote",
    blurb: "One strong quote with attribution",
    category: "Social proof",
    iconId: "quote",
    fields: [
      { key: "body", label: "Quote", type: "longtext" },
      { key: "eyebrow", label: "Attribution", type: "text" },
    ],
    defaults: () => ({
      body: "It felt like hiring a content team that never sleeps, with a manager who never lets it publish alone.",
      eyebrow: "Head of Marketing, beta customer",
    }),
  },
  {
    match: /faq|question/i,
    name: "FAQ teaser",
    blurb: "Common questions with a see-all link",
    category: "Content",
    iconId: "help",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "item1", label: "Question 1", type: "longtext" },
      { key: "item2", label: "Question 2", type: "longtext" },
      { key: "cta", label: "Link label", type: "link" },
    ],
    defaults: (t) => ({
      heading: t || "Questions, answered",
      item1: "How fast can we migrate? Most sites move in under two weeks.",
      item2: "Is the AI safe? Nothing publishes without a person.",
      cta: "See all questions",
    }),
  },
  {
    match: /image|photo|story|media|gallery/i,
    name: "Story band",
    blurb: "Image beside a short story",
    category: "Content",
    iconId: "image",
    fields: [
      { key: "heading", label: "Heading", type: "text" },
      { key: "body", label: "Story", type: "longtext" },
      { key: "image", label: "Image", type: "image" },
      { key: "cta", label: "Link label", type: "link" },
    ],
    defaults: (t) => ({
      heading: t || "Show, then tell",
      body: "Pair one strong visual with a short story that earns the click.",
      image: "aurora",
      cta: "See it live",
    }),
  },
];

const FALLBACK: Archetype = {
  match: /.*/,
  name: "Feature band",
  blurb: "Heading, supporting copy and highlights",
  category: "Content",
  iconId: "sparkles",
  fields: [
    { key: "eyebrow", label: "Eyebrow", type: "text" },
    { key: "heading", label: "Heading", type: "text" },
    { key: "body", label: "Body", type: "longtext" },
    { key: "item1", label: "Highlight 1", type: "text" },
    { key: "item2", label: "Highlight 2", type: "text" },
    { key: "item3", label: "Highlight 3", type: "text" },
    { key: "cta", label: "CTA label", type: "link" },
  ],
  defaults: (t) => ({
    eyebrow: "Why it matters",
    heading: t || "Built for the way you already work",
    body: "Composed from your section catalog and brand kit, ready to edit.",
    item1: "On brand by default",
    item2: "Editable in place",
    item3: "Ships everywhere",
    cta: "Learn more",
  }),
};

/** Deterministic draft from a prompt (the demo's stand-in for the model). */
export function buildComponentDraft(config: ComponentGenerateConfig): ComponentInput {
  const prompt = config.prompt.trim();
  const arch = ARCHETYPES.find((a) => a.match.test(prompt)) ?? FALLBACK;
  const topic = prompt
    .replace(/^(a|an|the|create|make|build|generate)\s+/gi, "")
    .split(/[.,]/)[0]
    .trim();
  const nice = topic.length > 3 && topic.length <= 48 ? topic[0].toUpperCase() + topic.slice(1) : "";
  const input: ComponentInput = {
    name: nice || arch.name,
    blurb: arch.blurb,
    category: config.category || arch.category,
    iconId: arch.iconId,
    fields: arch.fields.map((f) => ({ ...f })),
    variants: [
      { id: "centered", name: "Centered" },
      { id: "left", name: "Left aligned" },
    ],
    defaults: arch.defaults(nice),
    origin: "ai",
    prompt,
  };
  // @-referenced component: inherit its field shape as the starting point.
  if (config.refType) {
    const ref = getSectionDefByType(config.refType);
    if (ref) {
      input.blurb = `Based on ${ref.name}: ${arch.blurb}`;
      input.fields = [
        ...ref.fields.map((f) => ({ key: f.key, label: f.label, type: (f.multiline ? "longtext" : "text") as CustomFieldType })),
        ...input.fields.filter((f) => !ref.fields.some((rf) => rf.key === f.key)),
      ];
      input.defaults = { ...ref.defaults, ...input.defaults };
    }
  }
  return input;
}

function getSectionDefByType(type: string): SectionDef | undefined {
  return SECTION_DEFS.find((d) => d.type === type) ?? [...byProject.values()].flat().filter((c) => c.status !== "archived").map((c) => toSectionDef(c)).find((d) => d.type === type);
}

const FIELD_WORDS: [RegExp, CustomFieldType, string][] = [
  [/image|photo|picture/i, "image", "Image"],
  [/stat|number|metric/i, "number", "Stat"],
  [/step/i, "longtext", "Step"],
  [/question|faq/i, "longtext", "Question"],
  [/quote/i, "longtext", "Quote"],
  [/cta|button|link/i, "link", "CTA label"],
  [/slot|area|embed/i, "slot", "Slot"],
];

/**
 * Iterate on an existing draft from a follow-up message. Deterministic
 * transforms keyed off the prompt; returns what the assistant did.
 */
export function iterateComponent(projectId: string, componentId: string, prompt: string): string {
  const c = ensure(projectId).find((x) => x.id === componentId);
  if (!c) return "I lost track of that draft. Start a new chat and I will regenerate it.";
  const p = prompt.toLowerCase();
  const notes: string[] = [];
  let up: Partial<Pick<CustomComponent, "name" | "blurb" | "fields" | "defaults" | "variants">> = {};

  // rename: call it X / name it X
  const rename = prompt.match(/(?:call|name) it ["']?([^"'.]{3,40})["']?/i);
  if (rename) {
    up.name = rename[1].trim();
    notes.push(`renamed it to ${rename[1].trim()}`);
  }
  // change heading to "..."
  const heading = prompt.match(/heading (?:to|says?) ["']([^"']{3,80})["']/i);
  if (heading && c.fields.some((f) => f.key === "heading")) {
    up.defaults = { ...(up.defaults ?? c.defaults), heading: heading[1] };
    notes.push("rewrote the heading");
  }
  // add a field
  const add = p.match(/add (?:a |an |another )?(\w[\w ]{1,18})/);
  if (add) {
    const hit = FIELD_WORDS.find(([re]) => re.test(add[1]));
    if (hit) {
      const [, type, label] = hit;
      const n = c.fields.filter((f) => f.type === type).length + 1;
      const key = `${type}${n}`;
      up.fields = [...(up.fields ?? c.fields), { key, label: `${label} ${n}`, type }];
      up.defaults = {
        ...(up.defaults ?? c.defaults),
        [key]: type === "image" ? "aurora" : type === "slot" ? "testimonial" : type === "number" ? "2x faster" : type === "link" ? "Learn more" : "New content to edit.",
      };
      notes.push(`added ${type === "slot" ? "a slot" : `an ${label.toLowerCase()} field`}`);
    }
  }
  // remove a field by label word
  const rm = prompt.match(/remove (?:the )?([\w ]{3,20})/i);
  if (rm && !add) {
    const target = c.fields.find((f) => f.label.toLowerCase().includes(rm[1].trim().toLowerCase()));
    if (target && c.fields.length > 1) {
      up.fields = (up.fields ?? c.fields).filter((f) => f.key !== target.key);
      notes.push(`removed ${target.label}`);
    }
  }
  // tone: shorter / punchier
  if (/shorter|tighter|punchier|snappier/.test(p)) {
    const d = { ...(up.defaults ?? c.defaults) };
    for (const k of Object.keys(d)) {
      const words = d[k].split(" ");
      if (words.length > 7) d[k] = words.slice(0, 7).join(" ").replace(/[,;:]$/, "") + ".";
    }
    up.defaults = d;
    notes.push("tightened the copy");
  }
  // alignment
  if (/left/.test(p) && !/left alone/.test(p)) {
    if (!c.variants.some((v) => v.id === "left")) up.variants = [...c.variants, { id: "left", name: "Left aligned" }];
    notes.push("added a left aligned layout, switch it in the preview");
  }
  // color asks route to the brand kit, on purpose
  if (/colou?r|pink|blue|green|purple|dark/.test(p) && notes.length === 0) {
    return "Colors come from the brand kit so every component stays consistent. Use Edit brand in the composer to tweak them, and this preview updates live.";
  }
  if (notes.length === 0) {
    // fallback: treat as content direction, refresh blurb + first long field
    const long = c.fields.find((f) => f.type === "longtext");
    if (long) {
      up.defaults = { ...(up.defaults ?? c.defaults), [long.key]: prompt[0].toUpperCase() + prompt.slice(1).replace(/[.?!]*$/, ".") };
      notes.push(`rewrote ${long.label.toLowerCase()} from your note`);
    } else {
      up.blurb = prompt.slice(0, 80);
      notes.push("updated the description");
    }
  }
  componentHubActions.update(projectId, componentId, up);
  return `Done, ${notes.join(", ")}. The preview and code stub are updated.`;
}
