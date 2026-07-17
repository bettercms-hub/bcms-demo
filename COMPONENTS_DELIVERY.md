# How AI components are delivered

A reference for how a component created in the Components hub, by hand or by AI,
actually reaches a live site. This is the model we build, teach, and market
against. Written 2026-07-17.

## The one idea to hold onto

Every component has two halves, and they live in two different places:

1. **The model** (fields, variants, defaults, the shape of the content) lives in
   **BetterCMS**. It is data. We own it, version it, and serve it over the API.
2. **The rendering code** (the React or HTML that turns model data into pixels)
   lives **where the site runs**. It is code. It goes through your normal code
   review and ships from a repo.

BetterCMS never executes customer-authored component code as a black box in
production. That is the security stance, and it is the same one every credible
CMS landed on. What differs between products is only *who runs the frontend*,
and that is exactly what decides how a generated component goes live.

## What AI generation actually produces

When someone drafts a component in the AI studio, the run produces two things at
once:

- **The field model**, written into BetterCMS immediately as a **draft**. It is
  live over the API and in the `.md` / JSON export the moment it exists.
- **A starter React component** (the code stub you see in the Code panel). This
  is a real, readable component a developer can drop into a repo.

Both are grounded in the project's **brand kit** (colors, type, voice are read
before generation, not guessed). Nothing an agent makes publishes itself. The
draft lands in the library; a person publishes it.

## The two situations, side by side

### A. The site runs on BetterCMS Cloud (we own hosting and rendering)

We build and serve the frontend, so the whole loop can close inside the product.

1. AI (or a person) drafts the component here. Model saved, stub generated.
2. The stub is reviewed and merged into the project's connected repo, the one
   BetterCMS Cloud builds from. A developer owns that merge.
3. Once merged, the component appears in the section library for marketers, and
   BetterCMS Cloud renders it at publish time.

This is the Webflow / Framer shape: the platform owns the runtime, so a
generated component can go live through the platform's own pipeline. It is what
makes the "zero developer time" story true for Cloud, with the honest caveat
that bespoke code still passes through review before it serves real traffic.

### B. BetterCMS is headless only (you own the frontend)

BetterCMS is the content API. Your Next.js / Astro / SvelteKit app fetches
content and renders it with **your** components.

1. AI drafts the field model (live over the API at once) plus the starter stub.
2. Your developers, or your coding agent over MCP, take the stub, finish it, and
   ship it in **your** repo on **your** deploy.
3. Your build renders it. BetterCMS never runs component code for an outside
   frontend; it serves the model and gets out of the way.

This is the Prismic Slice Machine / Storyblok shape: model in the CMS, code in
your repo, kept in sync by CLI or MCP.

### The rule that covers both

> The model lives in BetterCMS. The rendering code lives where your site runs.
> AI generation always produces a draft you review, never a live publish.

The in-app note on the Components hub reads the project's hosting mode and shows
the matching version of this automatically, so people learn it at the moment
they need it.

## Where MCP fits

The Connect AI feature is what makes the headless story feel like the Cloud
story. An external coding agent (Claude Code, Cursor) connects with scoped,
authorized access and can take the generated stub, write it into the repo, wire
it up, and open a PR. That is the "the CMS your AI assistant can run"
positioning made concrete: the model comes from BetterCMS, the agent finishes
the code, a person still approves the merge and the publish.

## How we teach it (docs)

A short "How components are delivered" page, two columns (Cloud vs headless),
built around the one rule above. It should say plainly:

- The CMS owns the content model; your site owns the rendering code.
- AI drafts a model plus a starter component. It never ships code or publishes
  on its own.
- On Cloud, we render it for you after code review. Headless, your repo (or your
  agent over MCP) renders it.
- Publishing is always a human action. Agents cannot publish, by design.

## How we market it

- **Headline promise**: design the component once. On BetterCMS Cloud we render
  it for you; headless, we hand your repo a clean model and a starter component
  your AI can finish.
- **Trust line**: every AI change is a reviewable draft, credit-priced, logged
  to the audit trail. Going live always stays with a person.
- **Differentiator**: usage counts and brand-grounded generation, so "what can I
  safely touch" and "will it look like us" are answered before anyone commits.

Avoid claiming pixel-perfect AI or that non-developers author production code in
the browser. Nobody credible does, and the draft-first framing is the stronger,
more honest story.
