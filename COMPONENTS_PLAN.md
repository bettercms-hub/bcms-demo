# Components hub: decision record

One place to see, manage, create, and AI-generate the components pages are built
from. This document records the research, the product decisions, and what we
deliberately did not build. Written 2026-07-16.

## What the market does (research summary)

Full agent research 2026-07; sources in the session log. The short version:

- **Prismic (Slice Machine)**: slices modeled in a local dev tool, JSON model +
  component code in the repo, pushed to the CMS. Library UI shows screenshot
  cards with **variations**. A **simulator with editable mock data** previews
  components during development. AI arrived 2025: **image-to-slice** and
  **Figma-to-slice** generate the *field model* plus a starter component
  (structure only, no styling). The AI page builder is a sales-gated add-on.
- **Webflow**: components with instances + exposed-property **overrides** and
  **slots**. AI Assistant builds on-brand sections and (2025) full **AI code
  components**, on-brand because the assistant **reads the site's style
  variables before generating**. Shipped to all customers, not enterprise-gated.
- **Framer**: Workshop plugin, prompt to working code component, free on any
  plan. Weak token enforcement is its known gap.
- **Storyblok**: components ("bloks") modeled in the CMS UI, organized with
  folders/tags, **presets** give editors pre-filled starting points. No AI
  component generation.
- **Builder.io**: code-first component registry; Visual Copilot maps Figma to
  your registered components and **enforces registered design tokens**.
- **Contentful Studio**: devs register components + design tokens; admins
  assemble locked **patterns** with per-property editability flags.

**The decisive finding**: nobody lets non-developers author production
component *code* inside the CMS. The two viable shapes are (a) repo-canonical
code with a visually-modeled schema (Prismic, Storyblok, Builder), or (b) the
tool owns a sandboxed runtime (Webflow, Framer). Every credible AI story
generates either the *model* (low risk) or code that lands as a **reviewable
draft**, constrained by **design tokens read before generation**.

## Product decisions (CPO)

1. **One hub, one tab.** New project tab **Components** at
   `/w/{ws}/p/{project}/components`, between Visual editor and Agent. Visible
   to admin, developer, and marketer (composer roles); tablet and desktop only.
   Editors and reviewers do not see it.
2. **The hub manages the section catalog** (our slice equivalent), because that
   is what pages are made of. It also surfaces the other two component families
   read-only in v1: in-editor blocks (the entry editor's component catalog) and
   advanced block components (the editor workbench's component masters), each
   with a link to where they are managed. One page answers "what can we build
   with", even where deeper editing lives elsewhere.
3. **Gallery, not a table.** Cards with LIVE previews (the actual components
   scaled down, same mechanism as the section library), variant switcher on the
   card, category rail, search, and a **"Used on N pages"** count on every
   card, computed from real page data. Usage counts are rare in the market and
   instantly answer "can I touch this?".
4. **Status model**: `Built in code` (registered by developers, immutable in
   the hub), `Draft` (created here, visible in the editor's section library
   only to developers, marked), `Published` (available to every composer),
   `Archived` (hidden from the library, kept for history). Delete is guarded:
   a component used on pages cannot be deleted, only archived.
5. **Create flow** mirrors the schema builder, because modeling fields is the
   part a CMS can honestly own: name, category, blurb, then fields
   (Notion-style rows: label + single/multi line), variants, and starter
   content. Three entry points: **Blank**, **Duplicate existing**, **Generate
   with AI**.
6. **AI generation is a draft machine, never a publish machine.** Prompt plus
   the project's **brand kit** (colors, type, voice are shown as chips being
   "read" before generation, the Webflow trick, enforcement not vibes).
   Output: a complete draft component (fields, variants, on-brand starter
   content, generated code stub) that lands in the review pane. You publish it;
   nothing self-publishes. Runs ride the existing agent runs store, so credit
   estimates, history, and audit come for free. Gated like other generators:
   available from Basic up on Balanced, not enterprise-only (Webflow and
   Framer shipped broad and won; Prismic gated and lost momentum).
7. **Code is visible, honestly.** Every component has a Code panel showing the
   generated React stub with a copy button and the note that production code
   lives in your repo (synced via CLI/MCP, Slice Machine model). Custom
   components render in the demo through a token-driven generic renderer.

## Engineering decisions (CTO)

- **One source of truth per family.** Built-in sections stay code-defined in
  `SECTION_DEFS`. Hub-created components live in a client store
  (`components-store`) and are resolved by the section system through a
  registered resolver, so `getSectionDef`, `createSection`, `SectionRenderer`,
  and the editor's Section library all see them with zero duplication.
- **Custom components render through `GenericSection`**, a deterministic
  renderer driven by field roles (eyebrow/title/body/cta/items) and the section
  design tokens. No arbitrary code execution in the browser. In production the
  AI-generated stub is committed to the repo by a developer; the CMS never runs
  user-authored JS.
- **Usage counts** scan `pages-store` sections client-side (fine at demo scale;
  production is an indexed reverse reference, already specified in the
  engineering handoff).
- **Ditched, on purpose**:
  - In-browser production React editing. Nobody in the market does it; unsafe
    and unmaintainable. Code belongs in the repo behind review.
  - Arbitrary per-component custom JS in the hub (XSS surface, and the
    engineering audit already flagged our innerHTML debt).
  - A component marketplace, versioned rollbacks, and per-property editability
    flags: right ideas, later milestones (flags noted for v2, Contentful-style).
  - Pixel-perfect AI claims. The AI drafts structure, content, and a starter
    stub; it does not promise finished visual design.

## v1 build (this demo)

`components-store.ts` (custom defs, statuses, resolver registration, usage
counts, code stub generation), `GenericSection.tsx`, the hub route with gallery,
detail sheet (preview, fields, variants, usage list, code), New component
dialog, Generate-with-AI dialog wired to the runs store and brand kit, section
library merge with Draft badges, nav/role wiring (`library` tab key).

## v2 addendum (2026-07-17): list view, typed fields, slots, the AI studio

- **Typed fields**: text, long text, image, number, link, and **slot**. A slot
  is a field whose value is another component from the library, rendered one
  level deep and never recursive. This is the Webflow-slots idea grounded in
  our model: the component declares the opening, content fills it. Full
  instance-level slot overrides across the visual editor (choose the filling
  per page, override its content) are the committed next step; the model is
  already shaped for it (slot value = component type on the instance).
- **Builder**: a two-pane surface, settings left (name, category, icon picker
  from a curated set, typed field rows with per-type starter content, layout
  toggle), live preview right, updating per keystroke. Also used for Edit.
- **List view** joins the gallery: same data, row actions (edit, guarded
  delete) for people managing many components.
- **AI studio** replaces the one-shot dialog: a conversational surface with a
  chats rail (every generation is a persistent, browsable thread with credit
  totals), iterative refinement turns (~15 credits) after the first draft
  (~30), attachments (image, video, markdown), @-references to existing
  components (the draft inherits their field shape), workspace skills from the
  instructions library, and inline brand editing (color tweaks update the
  preview live, because color always comes from the brand kit, never from the
  prompt). Every turn is credit-priced and logged to the audit trail; drafts
  never publish themselves.
- Icons on built-ins remain code-defined; hub components pick from the curated
  set. Arbitrary icon upload was considered and skipped, consistency wins.
