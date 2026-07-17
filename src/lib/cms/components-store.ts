/**
 * components-store — hub-created section components, per project.
 *
 * Built-in sections stay code-defined in SECTION_DEFS (the repo is canonical
 * for rendering). This store holds components created in the Components hub,
 * by hand or by the agent. They render through GenericSection, a deterministic
 * token-driven renderer: the CMS never executes user-authored code.
 *
 * The section system resolves these through registerSectionResolver, so the
 * visual editor's canvas, library and createSection all see them natively.
 */
import { useSyncExternalStore } from "react";
import { Sparkles, type LucideIcon } from "lucide-react";
import {
  registerSectionResolver,
  SECTION_DEFS,
  type FieldDef,
  type SectionDef,
  type SectionVariant,
} from "@/components/cms/editor/sections/SectionSystem";
import { GenericSection } from "@/components/cms/components/GenericSection";
import { getPages } from "@/lib/cms/pages-store";

export type ComponentStatus = "draft" | "published" | "archived";
export type ComponentOrigin = "manual" | "ai" | "duplicate";

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
  fields: FieldDef[];
  variants: SectionVariant[];
  defaults: Record<string, string>;
  prompt?: string;
  createdAt: number;
  updatedAt: number;
}

const byProject = new Map<string, CustomComponent[]>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

let seq = 0;
const newId = () => `cmp_${Date.now().toString(36)}${(seq++).toString(36)}`;

export function slugifyType(name: string): string {
  return (
    name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "component"
  );
}

function uniqueType(projectId: string, name: string): string {
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
      fields: [
        { key: "eyebrow", label: "Eyebrow" },
        { key: "heading", label: "Heading" },
        { key: "item1", label: "Stat 1" },
        { key: "item2", label: "Stat 2" },
        { key: "item3", label: "Stat 3" },
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
      id: `cmp_seed_${projectId}_faq`,
      projectId,
      type: `faq-teaser-${projectId.slice(-4)}`,
      name: "FAQ teaser",
      blurb: "Two common questions with a link to the full FAQ",
      category: "Content",
      status: "draft",
      origin: "ai",
      prompt: "A compact FAQ teaser with two questions and a see-all link",
      fields: [
        { key: "heading", label: "Heading" },
        { key: "item1", label: "Question 1", multiline: true },
        { key: "item2", label: "Question 2", multiline: true },
        { key: "cta", label: "Link label" },
      ],
      variants: [{ id: "centered", name: "Centered" }],
      defaults: {
        heading: "Questions, answered",
        item1: "How fast can we migrate? Most sites move in under two weeks.",
        item2: "Do editors need training? If they can use a doc, they can use this.",
        cta: "See all questions",
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
  fields: FieldDef[];
  variants?: SectionVariant[];
  defaults?: Record<string, string>;
  origin?: ComponentOrigin;
  prompt?: string;
}

export const componentHubActions = {
  create(projectId: string, input: ComponentInput): CustomComponent {
    const c: CustomComponent = {
      id: newId(),
      projectId,
      type: uniqueType(projectId, input.name),
      name: input.name.trim(),
      blurb: input.blurb?.trim() || "A custom section for this site",
      category: input.category || "Content",
      status: "draft",
      origin: input.origin ?? "manual",
      fields: input.fields.length ? input.fields : [{ key: "heading", label: "Heading" }],
      variants: input.variants?.length ? input.variants : [{ id: "centered", name: "Centered" }],
      defaults: input.defaults ?? {},
      prompt: input.prompt,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    patch(projectId, [c, ...ensure(projectId)]);
    return c;
  },
  update(projectId: string, id: string, up: Partial<Pick<CustomComponent, "name" | "blurb" | "category" | "fields" | "variants" | "defaults">>) {
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
  duplicate(projectId: string, source: { name: string; blurb: string; category: string; fields: FieldDef[]; variants: SectionVariant[]; defaults: Record<string, string> }): CustomComponent {
    return componentHubActions.create(projectId, {
      name: `${source.name} copy`,
      blurb: source.blurb,
      category: source.category,
      fields: source.fields.map((f) => ({ ...f })),
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

/** Adapt a custom component to the SectionDef shape the editor understands. */
export function toSectionDef(c: CustomComponent, opts?: { nameSuffix?: string }): SectionDef {
  return {
    type: c.type,
    name: opts?.nameSuffix ? `${c.name} ${opts.nameSuffix}` : c.name,
    blurb: c.blurb,
    category: c.category,
    icon: Sparkles as LucideIcon,
    variants: c.variants,
    fields: c.fields,
    defaults: c.defaults,
    render: (p) => GenericSection({ component: c, p }),
  };
}

// Let the section system (canvas, createSection, renderer) resolve custom
// types from any project. Registered once at module load.
registerSectionResolver((type) => {
  for (const arr of byProject.values()) {
    const c = arr.find((x) => x.type === type && x.status !== "archived");
    if (c) return toSectionDef(c);
  }
  return undefined;
});

/* ------------------------------------------------------------- code stub */

/** The starter React component a developer would commit to the repo. */
export function componentCodeStub(c: CustomComponent): string {
  const pascal = c.name.replace(/(^|[^a-zA-Z0-9])([a-z])/g, (_m, _s, ch) => ch.toUpperCase()).replace(/[^a-zA-Z0-9]/g, "");
  const props = c.fields.map((f) => `  ${f.key}: string;`).join("\n");
  return `// ${c.type}.tsx — starter component generated by BetterCMS
// Production rendering lives in your repo. Sync model changes with:
//   npx bettercms components pull

import { section } from "@bettercms/react";

interface ${pascal}Props {
${props}
}

export const ${pascal} = section("${c.type}", (props: ${pascal}Props) => {
  return (
    <section className="bcms-section" data-variant={props.variant}>
${c.fields.map((f) => `      {/* ${f.label} */}\n      <span>{props.${f.key}}</span>`).join("\n")}
    </section>
  );
});
`;
}

/* -------------------------------------------------------- "AI" drafting */

export interface ComponentGenerateConfig {
  prompt: string;
  category?: string;
}

interface Archetype {
  match: RegExp;
  name: string;
  blurb: string;
  category: string;
  fields: FieldDef[];
  defaults: (topic: string) => Record<string, string>;
}

const ARCHETYPES: Archetype[] = [
  {
    match: /stat|number|metric|kpi/i,
    name: "Stats band",
    blurb: "Headline numbers with labels",
    category: "Social proof",
    fields: [
      { key: "eyebrow", label: "Eyebrow" },
      { key: "heading", label: "Heading" },
      { key: "item1", label: "Stat 1" },
      { key: "item2", label: "Stat 2" },
      { key: "item3", label: "Stat 3" },
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
    fields: [
      { key: "heading", label: "Heading" },
      { key: "body", label: "Intro", multiline: true },
      { key: "item1", label: "Person 1" },
      { key: "item2", label: "Person 2" },
      { key: "item3", label: "Person 3" },
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
    fields: [
      { key: "heading", label: "Heading" },
      { key: "item1", label: "Step 1", multiline: true },
      { key: "item2", label: "Step 2", multiline: true },
      { key: "item3", label: "Step 3", multiline: true },
      { key: "cta", label: "CTA label" },
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
    fields: [
      { key: "body", label: "Quote", multiline: true },
      { key: "eyebrow", label: "Attribution" },
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
    fields: [
      { key: "heading", label: "Heading" },
      { key: "item1", label: "Question 1", multiline: true },
      { key: "item2", label: "Question 2", multiline: true },
      { key: "cta", label: "Link label" },
    ],
    defaults: (t) => ({
      heading: t || "Questions, answered",
      item1: "How fast can we migrate? Most sites move in under two weeks.",
      item2: "Is the AI safe? Nothing publishes without a person.",
      cta: "See all questions",
    }),
  },
];

const FALLBACK: Archetype = {
  match: /.*/,
  name: "Feature band",
  blurb: "Heading, supporting copy and highlights",
  category: "Content",
  fields: [
    { key: "eyebrow", label: "Eyebrow" },
    { key: "heading", label: "Heading" },
    { key: "body", label: "Body", multiline: true },
    { key: "item1", label: "Highlight 1" },
    { key: "item2", label: "Highlight 2" },
    { key: "item3", label: "Highlight 3" },
    { key: "cta", label: "CTA label" },
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

/** Deterministic draft from a prompt: archetype by keyword, topic from the
 *  prompt's leading words. The demo's stand-in for the model call. */
export function buildComponentDraft(config: ComponentGenerateConfig): ComponentInput {
  const prompt = config.prompt.trim();
  const arch = ARCHETYPES.find((a) => a.match.test(prompt)) ?? FALLBACK;
  const topic = prompt
    .replace(/^(a|an|the|create|make|build|generate)\s+/gi, "")
    .split(/[.,]/)[0]
    .trim();
  const nice = topic.length > 3 && topic.length <= 48 ? topic[0].toUpperCase() + topic.slice(1) : "";
  return {
    name: nice || arch.name,
    blurb: arch.blurb,
    category: config.category || arch.category,
    fields: arch.fields.map((f) => ({ ...f })),
    variants: [
      { id: "centered", name: "Centered" },
      { id: "left", name: "Left aligned" },
    ],
    defaults: arch.defaults(nice),
    origin: "ai",
    prompt,
  };
}
