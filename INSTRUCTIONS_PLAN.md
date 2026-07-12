# Agent Instructions: Skills and Rules

Decision record for BetterCMS agent instructions — the standardized, reusable
playbooks that teach agents how a team works. Written 2026-07-12, before the
build. The demo implements Phase 1; later phases are the production roadmap.

---

## 1. Research

### Webflow — "AI agent instructions" (from product UI)

- Two artifact kinds under one **Instructions** panel:
  - **Skills** — "teach agents how to do specific tasks." Verbose, folder-shaped
    (a `SKILL.md` plus a `References` folder). Templates: Brand voice, Design
    system, Asset guidelines, Blank.
  - **Rules** — "set boundaries AI should always respect, like consistent
    formatting or scope limitations." Short constraints. Templates: SEO
    defaults, Naming, Accessibility, Blank.
- Creation: **Create from template / Create manually / Import** (menu on +).
- Editor: name + description settings rail, markdown-style rich editor with a
  formatting toolbar, an **On/Off toggle**, an eye (preview) / code toggle, and
  the standout: an **insert-reference menu** that embeds live site entities into
  the text — Variable, Style Selector, Component, Asset, Interaction, Skill,
  Rule, CMS Item, Page, Locale — each rendered as an inline chip. Instructions
  can therefore say "use the `About / team` component" and mean that exact
  component.
- Placement: a panel inside the Designer, scoped to the site.

### Sanity — Agent Skills (blog posts)

- Skills follow the open **Agent Skills standard** (agentskills.io): portable
  folders of instructions + examples that any agent (Claude Code, Cursor,
  Copilot…) discovers on demand. Rules follow a consistent format: problem →
  wrong way → right way.
- The bigger thesis ("Skills are how your company works, written down for
  agents"): operational knowledge should be **authored like content** — by
  non-engineers, in a structured studio, with revision history, approval,
  validation, and role-based permissions — then **distributed automatically**
  (publish → git commit → org plugin picks it up everywhere within minutes).
  Sanity runs ~60 published skills across teams (ad writing, content strategy,
  brand guidelines), plus a meta-skill that catalogs the system.

### What both agree on

1. Instructions are **content**, not code: authored, governed, versioned.
2. Two shapes: task playbooks (skills) and always-on constraints (rules).
3. **Reuse across the organization** is the point — one library, many surfaces.
4. Instructions get power from **referencing real system entities**, not prose.

---

## 2. Product decisions (CPO)

### Placement — decided

- The **library is workspace-level**. That is the standardization ask: author
  once, every project and teammate works from the same playbook. (Sanity model.)
- The **authoring surface lives in the Agent area**, reached from the project
  Agent page ("Instructions" card) at `/w/:ws/p/:project/instructions`. Not SEO
  (instructions govern all agent work, not just SEO); not buried in workspace
  settings (this is a creator surface, like Webflow putting it in the Designer).
  Governance stays where it is: AI controls can still disable skills/spend.
- Per-project fit: each instruction **applies to every project by default**,
  with a per-project opt-out on the instruction ("Applies here" toggle). Shared
  by default, scoped by exception.

### The two kinds — decided (Webflow naming, users have seen it)

| | Skills | Rules |
|---|---|---|
| Purpose | Teach the agent how to do a task well | Boundaries respected on every run |
| Shape | Long-form playbook, sections, examples | Short numbered constraints |
| Applied | When relevant to the task | Always, on every run |

### Templates (start-fast, edit-later)

- **Skills**: Brand voice (pre-filled from the project Brand kit voice tokens),
  Editorial style, SEO writing, Release notes.
- **Rules**: SEO defaults, Naming, Accessibility, Localization.
- Plus Blank and **Import** (.md file) for both. Export any instruction as .md —
  the interop story with the Agent Skills standard.

### What we cut from v1 (Phase 2+)

- Approval workflow + revision history (Sanity Studio features) — needs backend.
- Marketplace / cross-workspace sharing — needs a registry.
- Git sync + org plugin distribution — production infra (see CTO notes).
- Per-named-agent skill assignment (roster agents pick instructions) — later.

## 3. Scale + smart reuse (CTO)

- **One store, many consumers.** `instructions-store.ts` is the single source;
  consumers: (1) the in-app agent — every run resolves enabled instructions and
  records which ones it followed (audit trail on the run); (2) the **external
  agents MCP endpoint** — connected agents (Claude Code, Cursor) fetch the same
  library, so in-app and outside agents follow one playbook; (3) generators
  (SEO/ABM) inherit rules automatically.
- **Portability**: bodies are markdown; entity references are stable tokens
  (`@[Component: Pricing card]`) that serialize cleanly to `.md` — matching the
  Agent Skills folder standard for export.
- Production: instructions become documents in the content backend (same
  Postgres as entries) → versioning, approval, and audit ride the existing
  content pipeline for free; a publish hook syncs to a git repo for the
  org-plugin distribution loop Sanity described.
- Enforcement is server-side in production: run context assembly injects
  rules into every prompt; skills are retrieved by relevance (embedding match
  on name + description) instead of all-at-once.

## 4. Design (senior product designer)

- **Layout**: left rail (Skills group, Rules group, counts, on/off dots) +
  main editor. Empty state = the template gallery, not a blank void.
- **Editor**: settings column (Name, Description, On/Off, Applies to this
  project, Created) + a markdown editor with a small toolbar. The hero
  interaction is **Insert reference**: a searchable, grouped menu (Collections,
  Fields, Components, Sections, Pages, Brand tokens, Skills, Rules) that drops
  an inline chip token into the text. Preview toggle renders markdown with the
  chips styled; code view shows raw markdown. Mirrors the Webflow eye/code pair.
- **Copy**: sentence case; "Skills teach the agent how to do specific tasks."
  "Rules are boundaries the agent always respects." No jargon.
- **Accessibility**: full keyboard flow (rail is a listbox, menu items are
  options), aria-pressed toggles, focus rings, 44px touch targets on rows.
- **Role gating**: everyone with agent access can read; `canCompose`
  (marketer+) authors; delete confirmed inline.

## 5. Phase 1 scope (this build)

1. `src/lib/agent/instructions-store.ts` — types, workspace store, templates,
   seed, reference-token helpers, `enabledInstructions(ws, projectId)`.
2. `/w/:ws/p/:project/instructions` page — rail, gallery, editor, insert
   reference, preview, import/export, per-project toggle.
3. Agent wiring — runs record instruction names; the thread shows a
   "Following" line; the Agent page gets the Instructions entry card.
