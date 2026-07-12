/**
 * Agent instructions — the workspace library of skills and rules.
 *
 * Skills teach agents how to do specific tasks (long-form playbooks); rules
 * are boundaries agents always respect (short constraints). Instructions are
 * authored once per WORKSPACE and shared with every project — that is the
 * standardization story — with a per-project opt-out on each instruction.
 *
 * Bodies are markdown. Live references to CMS entities are inline tokens of
 * the form `@[Type: Label]` (component, collection, page, brand token…) so an
 * instruction can point at the exact thing it means. Tokens serialize cleanly
 * to .md for import/export, matching the open Agent Skills folder standard.
 *
 * See INSTRUCTIONS_PLAN.md for the research + decisions behind this.
 */
import { useSyncExternalStore } from "react";

export type InstructionKind = "skill" | "rule";

export interface Instruction {
  id: string;
  workspaceId: string;
  kind: InstructionKind;
  name: string;
  description: string;
  /** Markdown, with `@[Type: Label]` reference tokens inline. */
  body: string;
  /** Master switch; an off instruction is ignored everywhere. */
  enabled: boolean;
  /** Project ids that opted out; instructions apply everywhere by default. */
  disabledFor: string[];
  source: "template" | "manual" | "import";
  templateId?: string;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------- references */

/** Entity types an instruction can reference inline. */
export const REFERENCE_TYPES = [
  "Collection",
  "Field",
  "Component",
  "Section",
  "Page",
  "Brand token",
  "Skill",
  "Rule",
] as const;
export type ReferenceType = (typeof REFERENCE_TYPES)[number];

/** Serialize a reference as its inline markdown token. */
export function refToken(type: ReferenceType, label: string): string {
  return `@[${type}: ${label}]`;
}

/** Split a body into text and reference-token parts, for chip rendering. */
export function splitRefTokens(text: string): { kind: "text" | "ref"; value: string; refType?: string; label?: string }[] {
  const out: { kind: "text" | "ref"; value: string; refType?: string; label?: string }[] = [];
  const re = /@\[([A-Za-z ]+):\s*([^\]]+)\]/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ kind: "text", value: text.slice(last, m.index) });
    out.push({ kind: "ref", value: m[0], refType: m[1], label: m[2] });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ kind: "text", value: text.slice(last) });
  return out;
}

/* -------------------------------------------------------------- templates */

export interface InstructionTemplate {
  id: string;
  kind: InstructionKind;
  name: string;
  blurb: string;
  body: () => string;
}

export const INSTRUCTION_TEMPLATES: InstructionTemplate[] = [
  {
    id: "brand-voice",
    kind: "skill",
    name: "Brand voice",
    blurb: "Write headlines and body copy in our editorial voice and tone",
    body: () => `# Brand voice

How to sound like us in everything you write.

## Voice and tone

- Confident and plain-spoken. Short sentences. No hype.
- Warm in product copy, precise in documentation.
- Follow the tone set in ${refToken("Brand token", "Voice / tone")}.

## Vocabulary

- **Prefer:** the words in ${refToken("Brand token", "Preferred words")}.
- **Avoid:** the words in ${refToken("Brand token", "Words to avoid")}.
- Never rewrite phrases listed in ${refToken("Brand token", "Protected phrases")}.

## Examples

- On-brand: "Publish in minutes, not sprints."
- Off-brand: "Revolutionize your content workflows with cutting-edge synergy."`,
  },
  {
    id: "editorial-style",
    kind: "skill",
    name: "Editorial style",
    blurb: "Structure, headings, and formatting for long-form content",
    body: () => `# Editorial style

How we structure long-form content in ${refToken("Collection", "Blog posts")}.

## Structure

1. Open with the point. No throat-clearing intros.
2. One idea per section; use H2 headings a reader could skim.
3. Close with a concrete next step, usually the ${refToken("Component", "CTA banner")}.

## Formatting

- Sentence case for every heading and button.
- Bold for UI names, backticks for code and field names.
- Every claim with a number links its source.`,
  },
  {
    id: "seo-writing",
    kind: "skill",
    name: "SEO writing",
    blurb: "How to write titles, descriptions, and headings that rank",
    body: () => `# SEO writing

How to write search-facing copy for pages and entries.

## Titles and descriptions

- Meta title under 60 characters, primary keyword first, brand last.
- Meta description 140 to 155 characters, one benefit and one verb.
- Write them into the ${refToken("Field", "SEO group")} on each entry.

## Headings

- Exactly one H1 per page; it can differ from the meta title.
- H2s answer the questions people actually search.

## Structured data

- Prefer the ${refToken("Field", "Schema markup")} field over hand-written JSON-LD.
- FAQ content belongs in the ${refToken("Field", "FAQ")} field so schema is emitted automatically.`,
  },
  {
    id: "release-notes",
    kind: "skill",
    name: "Release notes",
    blurb: "Turn a changelog into customer-facing release notes",
    body: () => `# Release notes

How to turn engineering changelogs into notes customers want to read.

## Rules of the genre

1. Lead with what the customer can now do, never with the ticket.
2. Group by theme (New, Improved, Fixed), not by team.
3. One screenshot or clip per major item.

## Where it lives

- Draft into ${refToken("Collection", "Blog posts")} with the category "Announcements".
- Summary under 160 characters; it becomes the meta description.`,
  },
  {
    id: "seo-defaults",
    kind: "rule",
    name: "SEO defaults",
    blurb: "Meta titles, descriptions, and alt text on every page",
    body: () => `# SEO defaults

1. Every page ships with a meta title and meta description. No exceptions.
2. Every image gets descriptive alt text; decorative images get empty alt.
3. Canonical URLs stay on the page's own URL unless a human overrides.
4. Never remove or rewrite existing slugs; redirects are a human decision.`,
  },
  {
    id: "naming",
    kind: "rule",
    name: "Naming",
    blurb: "Consistent names for fields, slugs, and assets",
    body: () => `# Naming

1. Slugs are lowercase, hyphenated, and under 60 characters.
2. Field API ids are camelCase; never rename an existing API id.
3. Asset files are kebab-case with a content hint, like team-photo-berlin.jpg.
4. New collections take singular names, like ${refToken("Collection", "Blog posts")} takes "Blog post".`,
  },
  {
    id: "accessibility",
    kind: "rule",
    name: "Accessibility",
    blurb: "Contrast, focus states, and screen readers on everything",
    body: () => `# Accessibility

1. Meet WCAG AA contrast on every text and interactive element.
2. Every interactive element has a visible focus state and an accessible name.
3. Headings are hierarchical; never skip levels for visual effect.
4. Media needs alternatives: alt text, captions on video, transcripts on audio.`,
  },
  {
    id: "localization",
    kind: "rule",
    name: "Localization",
    blurb: "Keep content translatable and locale-safe",
    body: () => `# Localization

1. Never hard-code dates, currencies, or units inside sentences.
2. Avoid idioms and wordplay that do not translate.
3. Keep source strings under 120 characters where a layout depends on them.
4. Do not change locale-specific slugs or hreflang settings.`,
  },
];

/* ------------------------------------------------------------------ store */

const byWorkspace = new Map<string, Instruction[]>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

let seq = 0;
function newId() {
  return `ins_${Date.now().toString(36)}${(seq++).toString(36)}`;
}

function seed(workspaceId: string): Instruction[] {
  const now = Date.now();
  const make = (tid: string, daysAgo: number): Instruction => {
    const t = INSTRUCTION_TEMPLATES.find((x) => x.id === tid)!;
    return {
      id: newId(),
      workspaceId,
      kind: t.kind,
      name: t.name,
      description: t.blurb,
      body: t.body(),
      enabled: true,
      disabledFor: [],
      source: "template",
      templateId: t.id,
      createdAt: now - daysAgo * 86_400_000,
      updatedAt: now - daysAgo * 86_400_000,
    };
  };
  return [make("brand-voice", 12), make("seo-defaults", 12), make("naming", 5)];
}

function ensure(workspaceId: string): Instruction[] {
  let arr = byWorkspace.get(workspaceId);
  if (!arr) {
    arr = seed(workspaceId);
    byWorkspace.set(workspaceId, arr);
  }
  return arr;
}

export function useInstructions(workspaceId: string): Instruction[] {
  return useSyncExternalStore(
    subscribe,
    () => ensure(workspaceId),
    () => ensure(workspaceId),
  );
}

export function getInstructions(workspaceId: string): Instruction[] {
  return ensure(workspaceId);
}

/** The instructions that apply to a run in this project right now. */
export function enabledInstructions(workspaceId: string, projectId: string): Instruction[] {
  return ensure(workspaceId).filter((i) => i.enabled && !i.disabledFor.includes(projectId));
}

export const instructionActions = {
  create(
    workspaceId: string,
    input: { kind: InstructionKind; name: string; description?: string; body?: string; source?: Instruction["source"]; templateId?: string },
  ): Instruction {
    const now = Date.now();
    const ins: Instruction = {
      id: newId(),
      workspaceId,
      kind: input.kind,
      name: input.name,
      description: input.description ?? "",
      body: input.body ?? `# ${input.name}\n\n1. Add rules and guidance.`,
      enabled: true,
      disabledFor: [],
      source: input.source ?? "manual",
      templateId: input.templateId,
      createdAt: now,
      updatedAt: now,
    };
    byWorkspace.set(workspaceId, [...ensure(workspaceId), ins]);
    emit();
    return ins;
  },
  createFromTemplate(workspaceId: string, templateId: string): Instruction | null {
    const t = INSTRUCTION_TEMPLATES.find((x) => x.id === templateId);
    if (!t) return null;
    return this.create(workspaceId, {
      kind: t.kind,
      name: t.name,
      description: t.blurb,
      body: t.body(),
      source: "template",
      templateId: t.id,
    });
  },
  update(workspaceId: string, id: string, patch: Partial<Omit<Instruction, "id" | "workspaceId" | "createdAt">>) {
    byWorkspace.set(
      workspaceId,
      ensure(workspaceId).map((i) => (i.id === id ? { ...i, ...patch, updatedAt: Date.now() } : i)),
    );
    emit();
  },
  remove(workspaceId: string, id: string) {
    byWorkspace.set(
      workspaceId,
      ensure(workspaceId).filter((i) => i.id !== id),
    );
    emit();
  },
  duplicate(workspaceId: string, id: string): Instruction | null {
    const src = ensure(workspaceId).find((i) => i.id === id);
    if (!src) return null;
    return this.create(workspaceId, {
      kind: src.kind,
      name: `${src.name} copy`,
      description: src.description,
      body: src.body,
      source: src.source,
      templateId: src.templateId,
    });
  },
  /** Flip whether this instruction applies to one project. */
  toggleProject(workspaceId: string, id: string, projectId: string) {
    byWorkspace.set(
      workspaceId,
      ensure(workspaceId).map((i) =>
        i.id === id
          ? {
              ...i,
              disabledFor: i.disabledFor.includes(projectId)
                ? i.disabledFor.filter((p) => p !== projectId)
                : [...i.disabledFor, projectId],
              updatedAt: Date.now(),
            }
          : i,
      ),
    );
    emit();
  },
};
