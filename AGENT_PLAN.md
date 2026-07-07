# BetterCMS Agent: Product and Integration Plan

Status: proposal for review. Nothing here is built yet. This document explains what the leading content and website agents do, distills the patterns that make them work, and lays out a concrete, phased plan to bring a first class agent into BetterCMS on top of the architecture we already have.

Author's note on scope: BetterCMS today is a frontend skeleton with in memory stores. The backend is out of scope for us, but this plan defines the exact contract the backend must fulfil, and marks clearly what the frontend can ship as a working skeleton versus what the backend owns.

Copy rules that apply to every user facing string in this feature: no em or en dashes, no words like unlock or seamless or empower, never show a raw model name (only Lite, Balanced, Max), usage states stay calm and never turn red.

---

## 1. Thesis in one paragraph

An agent for BetterCMS is not a chat box bolted onto the side. It is a scoped teammate that operates the same structured surfaces a person does (sections, collections, entries, fields, SEO, publishing), through a small set of schema validated operations, and every change it proposes lands as a reviewable draft on staging that flows through the publish controls we already built. The person stays in command: the agent plans, a human approves, the change applies. This is the model that Sanity, Notion, Framer, and Prismic all converged on from different starting points, and BetterCMS is unusually well positioned to ship it because we already have the four things it needs: a typed content schema, a section composition system, a role and seat model, and a publish plus staging flow with revision history.

---

## 2. What the leaders actually built (distilled)

Four products, read together, describe the whole design space. Each one solved a different half of the problem.

| Product | What it is | The one idea to take |
|---|---|---|
| **Sanity** (Agent Actions, Content Agent, Agent Skills) | A layered stack: thin schema aware primitives, a chat product on top, and portable "skills" that teach external coding agents to build correctly | **Schema validated structured output.** Every write is checked against the content schema before it can persist. The chat agent is just an orchestrator over a handful of billable primitives. |
| **Framer** (AI, Agents, External Agents) | In canvas AI plus autonomous multi step agents, plus an external bridge that lets Claude Code or Cursor drive a project from the terminal | **The external bridge and structured context handles.** One operation layer powers both the in app agent and outside agents. Users pin context with slash skills, at mentions, and select on canvas, instead of describing things in prose. |
| **Notion** (Agents, Custom Agents) | A personal on demand agent plus persistent team "agent teammates" that run on schedules and triggers | **Plan Mode and agents as permissioned teammates.** The agent writes a plan as a real document, stays read only until you approve it, and every agent is a least privilege actor with version history as the undo safety net. |
| **Prismic** (SEO and ABM landing page builders) | The closest analog to us: slice based pages generated in bulk from a base template plus a data source | **Template constrained generation.** A human composes and orders the sections once; the agent only fills typed fields per data row. That is why it scales to hundreds of on brand pages and why review collapses to spot checks. |

### The convergent patterns (what they all agree on)

1. **A thin primitive layer, then a product on top.** Nobody ships "an AI feature." They ship four or five composable operations (generate, transform, translate, patch, prompt) and build the agent as an orchestrator over them. This gives clean, tiered metering and lets the same operations power scripts, pipelines, and external agents.
2. **Structured output as the contract.** The value and the safety both come from forcing the model's output to conform to a schema before it can be written. Free text you post process is fragile; a validated patch into typed fields is not.
3. **Human in the loop by staged proposal.** No agent edit publishes silently. The change is staged, shown as a reviewable diff or a plan document, batched, and committed by a person. This is what makes "edit hundreds of pages" acceptable.
4. **The agent is a scoped actor, not a superuser.** Default deny permissions, graduated per surface (view versus edit), revocable, with a full audit trail. Framer and Notion both model an agent as a teammate with its own least privilege access.
5. **One engine, many data shapes.** SEO pages, personalized ABM pages, localized pages, and catalog pages are the same pipeline (base layout plus data source plus generate plus review). The difference is the data and the prompt, not the machine.
6. **Two front ends, one operation layer.** The in app agent and the external terminal agent (Claude Code, Cursor) call the same tools. The external path is a native bridge that installs a skill so users skip manual MCP wiring, even though it is MCP compatible underneath.

### Why they are doing so well (the honest read)

They removed the two things that blocked AI in content tools: **trust** and **scale of review.** Structured output plus staged proposals plus version history means an agent can attempt a hundred edits and a human can accept them in one pass, or reject them with zero risk. Template constrained generation means the output is on brand by construction, so review drops from "read every word" to "spot check three." The credit models are all consumption based (work done, not requests) with a hard cap, which makes cost predictable. None of this is about a smarter model. It is about the harness around the model.

---

## 3. What a website agent truly is

Strip the marketing and an agent is a loop:

```
observe (read the project's structured state)
  -> plan (decide a sequence of operations, show it)
    -> [human approval gate]
      -> act (call validated operations, stage the results)
        -> verify (audit the staged diff, self check)
          -> hand off (present the diff for publish, or publish on approval)
```

The important shifts from "AI assist" to "agent":

- **From single turn to multi step.** It carries out a whole job (build a page, fill a collection, audit and fix a site), not one suggestion.
- **From free text to typed operations.** It writes patches into schema fields and section instances, not HTML blobs.
- **From foreground only to foreground and background.** It runs when you ask, and it runs on a schedule or trigger while you are away.
- **From one surface to a context graph.** It knows your sections, collections, pages, brand rules, and connected tools, and you can point it at any of them.

For BetterCMS specifically, a website agent is a teammate that composes pages from our section catalog, fills entries into our collection schemas, keeps SEO and localization current, and audits the site, with every write validated against the schema and staged for a human to publish through the exact controls we already ship.

---

## 4. The BetterCMS agent vision

Our position is the union of the four leaders, and we already own the primitives.

- **Section based like Prismic and Framer:** the agent composes pages from the dev defined section catalog and fills typed fields. It only uses sections a role is allowed to use, so output is on brand and valid by construction.
- **Structured content like Sanity:** every write is a validated patch into a `schema-store` model. Bulk operations are safe because the schema is the contract.
- **Agent UX like Notion:** Plan Mode with a plan that is a real draft page or entry, agents as permissioned seats, memory stored as native content.
- **External bridge like Framer:** Claude Code and Cursor drive BetterCMS through the same operation layer, installed with one command, scoped and revocable per project.

The differentiator we can own that none of them nail: **composition awareness plus a native review flow.** Because we have a typed section catalog with role gating, a comment system anchored to fields, a publish and staging flow, and revision history, the agent's plan and diff live inside the tools the team already trusts. There is no separate AI world. The agent is a seat, its plan is a draft, its diff is a publish preview, its discussion is a comment thread, and its output is one click from live.

Two gaps in the competitors are our openings: **internal linking** (Prismic does not surface it) and a **marketer facing generation flow that is credit metered and self serve** (Prismic's builders are sales gated and UI only). We can do both.

---

## 5. Architecture: three layers

Mirror Sanity's layering, adapted to our stores.

### Layer 1: Agent Operations (the primitive tool surface)

A small registry of typed operations, each of which maps to an existing store action and validates against `schema-store`. This is the entire surface the agent (internal or external) is allowed to touch. Proposed module: `src/lib/agent/operations.ts`.

| Operation | Maps to | Validation | Notes |
|---|---|---|---|
| `content.generate` | new `entryCreateActions.add` + `entryActions.setField` | fields checked against the collection's `SchemaModel` | Create or enrich an entry from a brief plus context. |
| `content.patch` | `entryActions.setField` / `pagesActions.update` | path and value must be schema valid | The core write. Set fields, never free text into the wrong slot. |
| `content.transform` | reads source, writes target via patch | schema valid | Reshape tone, structure, or standardize imported data. |
| `content.translate` | patch per locale field | schema valid, preserves structure | Style guide plus protected phrases (brand names). |
| `page.compose` | `pagesActions.update` with a `sections[]` list | only sections allowed for the role (`SECTION_DEFS` plus schema `allowedSections`) | Build a page from the catalog. Constrained to allowed sections. |
| `section.fill` | patch a `SectionInstance`'s props | field types from the section definition | Fill one section's typed fields. The Prismic pattern. |
| `seo.meta` | patch `seoTitle` / `seoDescription` / `indexing` | length limits, one line | Uses the SEO fields we already model. |
| `seo.schema` | attach a schema carrying section or JSON LD block | valid JSON LD shape | FAQ, how to, product, org. Rides on sections. |
| `link.suggest` | reads pages, proposes internal links | target must resolve to a real page | Our opening. Prismic does not do this. |
| `media.altText` | patch image field alt | non empty, describes the asset | Bulk alt backfill. |
| `audit.scan` | read only sweep | none (read only) | Broken links, missing meta, missing alt, contrast, terminology drift. Returns findings, not edits. |
| `prompt.raw` | returns text or JSON | none | Escape hatch for reasoning that does not write. |

Every operation returns a **proposed change**, never an immediate mutation. The orchestrator batches proposals into a plan and a staged diff.

### Layer 2: The Agent (orchestrator plus run model)

The loop from section 3, implemented as a run. Proposed store: `src/lib/agent/runs-store.ts`, same `useSyncExternalStore` pattern as `pages-store` and `schema-store`.

```
AgentRun {
  id, projectId, skillId, title,
  mode: "foreground" | "background",
  trigger?: { kind: "manual" | "schedule" | "event", ... },
  status: "planning" | "awaiting_approval" | "applying" | "done" | "failed" | "paused",
  context: ContextRef[],          // the @-mentioned pages, collections, sections, files
  steps: RunStep[],               // streamed, each with a label and result
  plan?: PlanDoc,                 // the human readable plan (also materialized as a draft page/entry)
  proposals: ProposedChange[],    // staged, schema validated, not yet applied
  creditsEstimated, creditsSpent,
  createdBy, createdAt, finishedAt
}
```

The orchestrator plans, streams steps, produces `proposals`, and waits at `awaiting_approval` unless the run is in an auto apply mode a human explicitly enabled for that skill.

### Layer 3: External bridge and MCP

The same Layer 1 operations exposed as MCP tools so Claude Code, Cursor, and any MCP client drive BetterCMS. Setup is one command that installs a bridge and a Skill, so users do not hand configure MCP. Covered in section 11.

---

## 6. The Skill catalog (jobs users invoke)

Skills are named, high level jobs built from Layer 1 operations. This is what appears in the UI. Ranked by expected use, which mirrors what the competitors advertise most.

**Tier A, flagship (build first):**

1. **Draft and fill an entry from a brief.** Input: a collection plus a one line brief or a source (URL, pasted text, a file). The agent generates title, body, excerpt, meta, and fills every typed field in the schema, then stages the entry as a draft. Built on `content.generate` plus `seo.meta`. This is the single most used content op.
2. **Generate SEO landing pages from a data source.** Input: an approved base page of sections plus a CSV of keywords or topics (we already have CSV import in `CollectionView`). One row becomes one page: the agent fills the section fields, writes meta, emits schema, and batches all pages into a staging release for review. Built on `page.compose` (or reuse an existing base), `section.fill`, `seo.meta`, `seo.schema`. This is the Prismic flagship and our clearest revenue story.
3. **Audit and fix.** A read only `audit.scan` produces findings (broken links, missing alt text, missing or thin meta, low contrast, terminology drift, thin content). Each finding gets a one click proposed fix. The person accepts fixes in a batch. Built on `audit.scan` plus the relevant patch operations.

**Tier B, high value:**

4. **Personalized page variations (ABM).** Same engine as skill 2, but the CSV carries account or segment data, and the prompt does narrative level rewriting (headline, pain points, proof points adapt), not token replacement. Each variant gets a traceable URL.
5. **Translate the site or a collection.** `content.translate` across locales, structure preserved, brand names protected, style guide honored.
6. **Backfill metadata and alt text across a collection.** `audit.scan` finds gaps, `seo.meta` and `media.altText` fill them, staged in one batch. The single best "wow in ten seconds" demo.
7. **Internal linking pass.** `link.suggest` reads the site and proposes contextual internal links between related entries and pages. Our differentiator.

**Tier C, developer and power:**

8. **Draft a content model from a description.** Already priced in our system as `schema` (Balanced, 20 credits). The agent proposes a `SchemaModel` in the `/schema` builder for a dev to accept.
9. **Migrate from a URL or export.** Reconstruct pages into our section catalog from an existing site.
10. **QA and safety pass.** Already priced as `qa` (Max, 120). Reads a staged change and flags risk (claims, legal, tone, broken references) before publish.
11. **AEO run.** Already priced as `aeo` (Max, 400). Optimizes content for answer engines, emits schema, checks question coverage.

Skills 8, 10, and 11 already exist as line items in `AI_ACTIONS` in `src/lib/billing/pricing.ts`. The credit model was built anticipating agents. We are extending, not inventing.

---

## 7. UX design (the core of the plan)

The rule: the agent lives inside the surfaces we already have, and its output uses the review and publish controls we already ship. No parallel AI world.

### 7.1 Surfaces

**a. The Agent Dock.** A right side dockable panel, sibling to the comment sidebar and the properties panel, available on every editor surface. This is the primary agent surface.

- **Chat per task.** Each job is its own thread. A "New task" button keeps the agent focused (Framer's lesson: long mixed threads degrade).
- **Context handles instead of prose.** Type `@` to reference a page, collection, entry, section, or a brand rule entry as a first class context object. Type `/` to launch a skill (`/seo-pages`, `/draft`, `/translate`, `/audit`, `/alt-text`). Select a section or field in the canvas and click "Add to agent" to pin it as context. This is the difference between a usable agent and a bare prompt box.
- **Plan Mode toggle.** On by default for anything that writes more than one item. The agent goes read only, asks clarifying questions (multiple choice where possible), then writes a plan.
- **Streamed steps.** Every step shows live ("Reading 42 entries", "Drafting page 3 of 60", "Validating fields"). The person watches the work.
- **Inline diff review.** Proposed changes render as a diff the person can accept or reject per item or in bulk, using our existing revision and snapshot diff infrastructure (`diffPage`, `diffEntry`).
- **Apply to staging, publish through the normal menu.** Accepted changes land on staging as drafts. The person publishes with the `EntryPublishMenu` and `PublishMenu` we just rebuilt. The agent never publishes silently.

**b. Inline escalation from the existing AskAIPanel.** The rich text bubble toolbar already has an AI panel (`AskAIPanel`, `editor-actions.functions.ts`). Keep the quick rewrites where they are (Lite tier, instant), and add one item: "Ask agent" that escalates the current selection into the Dock as context for a multi step task. Small change, big continuity.

**c. The Agent home (evolve the `/ai` route).** Today `w.$workspace.p.$project.ai.tsx` is a single action plus tier picker. Evolve it into three sections: a **skills gallery** (the catalog from section 6, with a credit estimate on each card), **run history** (past runs, their diffs, their cost), and **scheduled agents** (the background agents from 7.4). Launching a skill opens the Dock or a full run view.

**d. Bulk entry from the collection workspace.** In `CollectionView`, next to the CSV Import and Export we already built, add "Generate with agent": pick a skill (fill missing fields, draft N entries, translate all), preview the credit estimate, run, review the staged batch. This reuses the CSV pipeline directly.

**e. Command palette.** Add "Ask agent" to the ⌘K palette, pre-filled with the current selection.

### 7.2 The plan as a native artifact (steal from Notion)

When a run enters Plan Mode, the agent materializes the plan as a real draft page or a "Agent plan" entry in the content tree, listing every page, field, and section it intends to touch, with the reasoning. This artifact is:

- **Reviewable and commentable** using our field anchored comment system. A reviewer can comment "do not touch the pricing section" directly on the plan.
- **Shareable and persistent.** It stays in the tree as a record of what was proposed.
- **The approval gate.** Nothing writes until the plan is approved. Reject sends it back with the comments as new instructions.

This reuses three systems we already own (pages or entries, comments, roles) and turns the scariest part of agents (autonomous writes) into a familiar review.

### 7.3 Three detailed flows

**Flow 1: Draft and fill an entry (the everyday case).**
1. In a collection, click "Generate with agent" or open the Dock and `/draft @BlogPosts`.
2. The person types a one line brief or drops a source URL or file.
3. Preflight shows "This run will use about 8 to 20 credits" (we already show preflight on `/ai`).
4. The agent drafts title, body, excerpt, and fills every schema field, streaming steps.
5. The staged draft opens in the entry editor with a subtle "Drafted by agent, review before publish" banner. Fields the agent was unsure about are flagged.
6. The person edits, then publishes with the `EntryPublishMenu` as normal.

**Flow 2: SEO landing pages from keywords (the scale case).**
1. Build one on brand base page from sections (human owned, brand locked). Mark it "Use as agent template".
2. Open `/seo-pages`, pick the template, upload a keyword CSV (reuse CSV import), map the keyword column.
3. Plan Mode shows: "60 pages will be created under /lp/{slug}, each filling the Hero, Features, FAQ, and CTA sections, with meta and FAQ schema. Estimated 3,000 to 5,400 credits." The person adjusts URL pattern and which sections vary.
4. Approve. The agent generates all 60 into a staging release, streaming progress.
5. Review screen: a grid of 60 staged pages, spot check any, bulk approve. Prismic's data shows about 90 percent publish with no edits once the template is good.
6. Publish the release (schedule or now) through the existing publish flow.

**Flow 3: Audit and fix (the maintenance case, best demo).**
1. Open `/audit` on a site or a collection. Read only scan runs, no credits for the scan itself beyond a small reasoning cost.
2. Findings list: "12 images missing alt text, 5 pages missing meta description, 3 broken internal links, 2 pages with thin content." Each has severity and a proposed fix.
3. The person selects fixes to apply (all alt text, all meta, skip thin content for now).
4. Fixes stage as a batch diff. Approve. Publish.

### 7.4 Background and scheduled agents (steal from Notion)

Under project settings, an **Agents** page lets an owner or developer create a custom agent as a scoped teammate:

- **Identity:** name, avatar, purpose.
- **Instructions:** the prompt. Can reference brand rule entries with `@` as reusable modules.
- **Triggers:** manual, schedule (nightly, weekly), or event (entry published, form submission, a comment mention). Combinable.
- **Scope and permissions:** default deny, graduated per surface, reusing our roles and `CAPABILITY_GROUPS`. An agent might be "read all, write drafts to Blog Posts only, never publish."
- **Tier:** Lite, Balanced, or Max, plan gated as today.
- **Mode:** propose only (always stage for review) or auto apply to staging (never to production without a person, unless an owner explicitly allows publish for a low risk skill like alt text).

Examples that sell themselves: "Nightly, backfill missing alt text and meta on new entries, stage for review." "Weekly, scan for broken links and thin pages, open a report." "On publish, generate the three locale translations as drafts." Completion is surfaced as a comment or a notification, so the agent pushes results to the person, not the other way around.

### 7.5 Trust and safety UX

- **Every agent write is a draft on staging.** Production is never touched without a person, except where an owner explicitly opts a specific low risk skill into auto publish.
- **Version history is the undo floor.** We already snapshot revisions on publish. Any agent change is one click reversible.
- **The audit log** (`recordAudit`) records every agent action with who triggered it, what it did, and why, using the same audit surface we built for Access.
- **A hard spending cap** pauses background agents when hit (interactive runs follow our existing "never cut off, billed at the add on rate" principle; background autonomous runs pause instead, to prevent runaway cost).

---

## 8. Permissions and roles: the agent is a seat

Reuse `src/lib/workspace/my-role.ts` and `capabilities.ts` directly. An agent is a first class actor with a seat and a least privilege permission set.

- **Default deny.** A new agent can read nothing and write nothing until granted.
- **Graduated per surface,** matching our role model: view versus edit per collection, compose sections or not, publish or not, touch SEO or not.
- **View as still applies.** A marketer can preview what their agent is allowed to do.
- **Reviewer gate.** If the workspace requires review, agent drafts enter the same review to approved to published flow that human drafts do. The `PublishingPanel` workflow already models this.
- **The agent shows up in the audit log and the members roster** as a non human seat, clearly labeled, instantly disableable by an owner.

This is the cheapest big win in the plan: we do not design a new permission system, we let an agent hold an existing scoped seat.

---

## 9. MCP and external agents (connect Claude Code and Cursor)

The Framer pattern, adapted. Two front ends, one operation layer (Layer 1).

- **Setup in one command.** `npx bettercms agent setup` installs a local bridge and drops a `bettercms` Skill into the coding agent's skills directory. The user does not hand configure MCP, though the surface is MCP compatible so any MCP client works.
- **Auth: browser consent, project scoped, revocable.** First connection opens a consent screen in BetterCMS. Access is scoped to the explicitly connected project only, never billing or other projects, and is revocable at any time from a new "Connected agents" section in project settings Access.
- **The tool surface is Layer 1.** External agents call the same validated operations: read pages, collections, entries, sections, styles; create and update entries; compose pages from sections; patch fields; manage SEO, localization, redirects; and trigger publish. Writes still land on staging and still validate against the schema.
- **Edits land on a branch or staging,** never live, exactly as in app runs do.
- **A Skills package** (like Sanity's Agent Skills) teaches external agents our conventions: how our section catalog works, how the content API is shaped, our field types, our publish flow. Ship it in a public `bettercms-agent-toolkit` repo, installable into Claude Code and Cursor.

Result: a developer in Claude Code types "list all blog posts missing a cover image and draft one for each" and it executes against the real project through the same safe operations the in app agent uses.

---

## 10. Credits and metering plan

We already have the machinery: `AI_ACTIONS` with per tier costs, `CREDIT_PACKS`, `tierAllowed`, `tierGateNote`, `usageState`, preflight on `/ai`, and an AI credit activity table on the Usage page. Extend it, do not replace it.

### 10.1 The metering principle (from all four leaders)

Meter by **work done, not requests.** A quick inline rewrite is cheap; a sixty page generation is not. Three cost components:

1. **Primitive cost:** reuse existing `AI_ACTIONS` numbers. `meta` 1, `translate` 6 per 1,000 words, `summary` 2, `rewrite` 5 or 12 or 25, `section` 15 or 30 or 60, `page` 50 or 90 or 180, `draft` 8 or 20 or 40, `image` 30.
2. **Orchestration overhead:** a per step planning surcharge for agent runs (Sanity charges 4 credits per reasoning turn versus 1 per primitive). Propose a small per step reasoning cost so an agent run costs a bit more than the sum of its writes, reflecting real planning tokens.
3. **Bulk multiplier:** a skill over N items is the per item cost times N, shown as a total range in preflight before the run starts.

### 10.2 New line items to add to `AI_ACTIONS`

| Skill | Proposed cost | Tier | Rationale |
|---|---|---|---|
| Draft and fill an entry | reuse `draft` (8 / 20 / 40) plus `meta` | Lite to Max | Already exists as `draft`. |
| SEO pages (per page) | `page` cost per page plus small schema surcharge | Balanced or Max | Bulk multiplier shown as a total. |
| ABM variant (per variant) | `page` cost plus narrative surcharge | Max | Heavier rewriting. |
| Audit scan | small flat reasoning cost, read only | Lite | Cheap, drives fix upsell. |
| Fix (per fix) | the underlying patch cost (`meta`, alt via `meta` class, link) | Lite | Only pay for accepted fixes. |
| Alt text or meta backfill (per item) | `meta` (1) each | Lite | The cheap wow demo. |
| Internal linking pass | small per page reasoning cost | Balanced | New. |
| Custom or scheduled agent run | sum of the run's operations plus overhead | per agent's tier | Metered per run, per agent insights. |

We already ship `qa` (120, Max) and `aeo` (400, Max). Keep them.

### 10.3 Guardrails and gating

- **Preflight always.** Show the estimate before the run ("This run will use about 3,000 to 5,400 credits"), which we already do on `/ai`.
- **Tier gating unchanged.** Lite everywhere, Balanced on Basic for selected tasks, Max on Pro and above. Full autonomous agent runs sit at Max, consistent with `qa` and `aeo` today.
- **Interactive runs never cut off,** billed at the add on rate past the allowance, matching our stated principle.
- **Background and scheduled agents pause at the cap** to prevent runaway spend, and resume next cycle or when the cap is raised. Alerts at 80 and 100 percent, per agent credit insights on the Usage page.
- **Credit packs** already exist for top ups.

### 10.4 How to keep cost down (optimization)

- **Template constrained generation.** Filling typed fields in a fixed section layout uses far fewer tokens than open ended composition, and it is more reliable. This is the single biggest lever, and it is exactly what Prismic does.
- **Cache and reuse.** Brand voice, glossary, and schema context are stable; load them once per run, not per item.
- **Batch primitives.** One structured call that fills all fields of an entry beats one call per field.
- **Tier routing.** Route mechanical tasks (alt text, meta) to Lite, creative tasks to Balanced or Max. Do not run everything on Max.
- **Read only audits are cheap;** charge for the fixes the person actually accepts, not the scan. This aligns cost with value and drives conversion.
- **Spot check review.** Once a template proves out, the person reviews a sample, not every page, which is a human cost optimization the whole model depends on.

---

## 11. Infrastructure plan (the contract for the backend)

Backend is out of scope for us to build, but the plan must define what it owns and what the frontend skeleton can stand in for.

### 11.1 The run engine

- **A run is a durable job** with the shape in section 5. In production it is a backend job with a queue; in the skeleton it is an entry in `runs-store.ts` that we drive with simulated streaming so the whole UX is real and demoable without a backend.
- **Streaming** is SSE or websocket in production. The skeleton simulates step by step streaming so the Dock's live steps and progress feel real.
- **Structured output validation** happens server side against the schema in production. In the skeleton, validation runs against `schema-store` field definitions before a proposal is accepted, which is the same contract.

### 11.2 Tool execution

- Layer 1 operations call the content API in production. In the skeleton they call the in memory store actions (`pagesActions`, `entryActions`, `modelActions`, `sectionActions`). Same operation names, same validation, different backend. This is why the skeleton is faithful: the operation surface does not change when the backend arrives.

### 11.3 Background and scheduling

- Production needs a worker plus cron. We already have precedent: `store.ts` runs a due entry publisher (`entryActions.publish` on scheduled items), and the environment exposes a scheduled tasks capability. The skeleton models triggers as config plus a manual "run now", with a simulated scheduler.
- Long multi step and scheduled runs are background jobs. The frontend only needs the run status, the streamed steps, and the final diff.

### 11.4 The MCP server and bridge

- A `bettercms-mcp` server exposes Layer 1 as MCP tools. The `npx bettercms agent setup` bridge wraps it and installs the Skill. Auth is OAuth with per project consent, stored as a revocable grant listed under settings Access "Connected agents". This is backend plus a thin settings UI we can build now (the grant list, connect and revoke, even against mock grants).

### 11.5 Memory as native content

- Agent memory and instruction modules are ordinary content entries (a "Brand and rules" collection: voice, glossary, do and do not, protected phrases). The agent reads them as context. They are versioned, permissioned, and diffable by the tools the team already uses. No hidden config store. This is a `schema-store` model plus a seeded collection, buildable now.

### 11.6 Project auto context

- On every run, the agent is handed structured project context automatically: the section catalog and which sections each role may use, the collection schemas, the brand rules collection, and the site's existing pages for internal linking. This is assembled from `schema-store`, `SECTION_DEFS`, `pages-store`, and the roles model. All of it exists.

---

## 12. Phased roadmap (frontend skeleton first)

Each phase is shippable and demoable on its own, and each maps to files and surfaces we already have.

**Phase 0: Foundations (no visible UI change).**
- `src/lib/agent/operations.ts`: the Layer 1 registry, each op mapping to a store action plus `schema-store` validation.
- `src/lib/agent/runs-store.ts`: the run model, `useSyncExternalStore` like our other stores.
- Extend `AI_ACTIONS` in `pricing.ts` with the new skill line items and the per step overhead.
- Model the agent seat in `my-role.ts` and the members roster.

**Phase 1: The Agent Dock (the core UX).**
- A dockable right panel, sibling to the comment sidebar. Chat per task, `@` context handles, `/` skill launcher, Plan Mode toggle, simulated streamed steps, inline diff review using `diffEntry` and `diffPage`, apply to staging, publish through `EntryPublishMenu` and `PublishMenu`.
- Evolve `AskAIPanel` to add "Ask agent" escalation.
- Ship with one skill wired end to end: **Draft and fill an entry** (Flow 1).

**Phase 2: Flagship skills.**
- **SEO landing pages from a CSV** (Flow 2), reusing the `CollectionView` CSV import and the section catalog, with a staging release review grid.
- **Audit and fix** (Flow 3), read only scan plus per finding fixes.
- Evolve the `/ai` route into the skills gallery plus run history.

**Phase 3: Bulk and personalization.**
- ABM narrative variants from an account CSV.
- Translate a collection or site across locales.
- Alt text and meta backfill across a collection, from the collection workspace.
- Internal linking pass (our differentiator).

**Phase 4: Custom and scheduled agents.**
- Settings Agents page: identity, instructions with `@` module references, triggers, scoped permissions via `CAPABILITY_GROUPS`, tier, mode.
- Background runs surfaced as comments or notifications. Recent Activity per agent. Simulated scheduler with a "run now".
- The "Brand and rules" memory collection, seeded.

**Phase 5: External agents and MCP.**
- Connected agents UI under settings Access: connect, consent, scope, revoke (against mock grants first).
- The `bettercms-agent-toolkit` Skills package and `npx bettercms agent setup` bridge (needs backend, but the settings surface and docs ship now).

---

## 13. What we already have that de-risks this

- **Schema as a contract:** `schema-store` with typed fields, references, and the sections zone. Validation is ready made.
- **Composition:** the section catalog, marketer library, `SectionInstance`, and role gating. Template constrained generation is native to us.
- **Review and safety:** the comment system (field anchored threads), the publish and staging flow (`PublishMenu`, `EntryPublishMenu`), revision snapshots and `diffEntry` / `diffPage`, and the audit log.
- **Roles and seats:** the whole permission model an agent needs to be a scoped teammate.
- **Credits:** `AI_ACTIONS`, packs, preflight, usage metering, and even agent line items (`qa`, `aeo`) already priced.
- **AI surfaces:** `AskAIPanel`, `editor-actions.functions.ts`, the `/ai` builder, `AiAnswerPreview`.
- **Bulk pipeline:** CSV import and export in `CollectionView`, which the SEO and ABM skills build on directly.
- **Connected tools:** the environment already exposes Google Search Console, HubSpot, Slack, Notion, Figma, and more, which real skills (SEO from search data, ABM from CRM, notify in Slack) can use.

The agent is mostly an orchestration and UX layer over primitives we have already built. That is the whole reason this is feasible.

---

## 14. Decisions for you to make before we build

1. **Auto publish scope.** Do we ever let a scheduled agent publish without a person, for low risk skills like alt text, if an owner opts in? Or is production always human gated, no exceptions?
2. **Where the Dock lives by default.** Right dock sibling to comments (my recommendation), or a full screen agent mode, or both.
3. **The `/ai` route's future.** Evolve it into the skills gallery and run history (my recommendation), or keep it as a simple action runner and put the gallery in the Dock.
4. **Credit numbers.** The per step overhead and the SEO per page surcharge need final numbers. I proposed reusing existing costs plus a small overhead; you own the pricing.
5. **External agents priority.** Ship the in app agent fully first (Phases 1 to 4), then MCP and external (Phase 5), or pull external earlier because it is a developer acquisition story.
6. **The brand and rules memory model.** One shared collection per project, or per agent memory, or both.

---

## 15. The one line summary

Build a thin set of schema validated operations over the stores we already have, put an orchestrator with Plan Mode on top, surface it as a dock that uses our existing review and publish controls, meter it with the credit system we already ship, scope it with the roles we already model, and expose the same operations to Claude Code and Cursor through a one command bridge. The agent is a teammate that composes and fills our structured content, and a human always publishes.
