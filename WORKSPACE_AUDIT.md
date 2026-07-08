# Workspace Settings Audit

Date: 2026-07-08. Scope: every workspace-level surface (`/w/{slug}/settings/*`, Members, Roles), plus how the newly shipped features (custom roles, generators, markdown delivery, agent) surface in governance. Verdicts: **Keep** (works, coherent), **Fixed** (was broken or missing, now built), **Roadmap** (intentionally stubbed, honest about it), **Skip** (considered and rejected, with reasoning).

## 1. Page-by-page catalog

| Page | Before this audit | Verdict | Notes |
|---|---|---|---|
| General | Working: name, slug, logo upload, save/discard | Keep | Persists via workspace overrides |
| Members | Working: seat table, invite, seat pricing math | Keep | Real seat totals, role changes |
| Roles & Permissions | Working: role matrix + view-as | Keep | Per-project custom roles live in each project's Access settings, deliberately: they scope to one project's collections/pages/sections |
| Domains | Read-only list, dead Add button; project page was hardcoded mock | **Fixed** (previous session) | Roll-up grouped by project, routes into projects, working add/remove/set-primary, one store |
| Notifications | Toggle rows (uncontrolled) + recent list | Keep, note | Switches do not persist; production wires them to a preferences store. Cosmetic-only gap, low priority |
| **AI controls** | Did not exist | **Fixed (new)** | See section 2 |
| **Connected agents** | Only existed per project, buried on the Agent page | **Fixed (new)** | Workspace surface: MCP endpoint, setup command, client list, per-project key summary |
| API Keys | Dead: static empty states, New token buttons did nothing | **Fixed** | Real create with one-time reveal, masked list, revoke. Personal vs machine tokens |
| Webhooks | Dead: static empty state, New endpoint did nothing | **Fixed** | Add endpoint with event subscriptions, signing secret shown once, pause/resume, delete |
| Plans | Working: two-layer plan model | Keep | Source of truth is the pricing brief |
| Billing (+ invoices, payment) | Working | Keep | Payment "update" is a simulated success toast; acceptable for demo |
| Usage | Working: per-site usage vs plan | Keep | |
| Integrations | Honest "Coming soon" cards | Roadmap | One copy fix applied ("seamlessly" removed). Do not fake connect buttons |

## 2. AI governance (new): what admins can and cannot control

Route: `/w/{slug}/settings/ai`. Store: `src/lib/agent/governance-store.ts`, keyed by workspace.

**Configurable** (all enforced in `runs-store` at the source, not just hidden in UI):
- Monthly credit budget (hard cap on top of plan credits)
- Speed ceiling (Lite / Balanced / Max): requests above it are clamped
- Per-skill switches: draft, backfill SEO, audit, internal links, AEO, migrate
- Per-generator switches: SEO pages, ABM pages
- Personal model keys (BYOK) on/off
- External agents (MCP clients) on/off

**Deliberately NOT configurable** (the trust story):
- Plan approval before the agent acts. Always required.
- No auto-publish. Everything the agent writes is a draft.

**Where governance shows up**: blocked skills read "Off in AI controls" on the Agent page; blocked generators are disabled in the Pages-hub Generate menu and the Agent page; BYOK section disappears from the composer model picker; external-agents banner on the Connected agents page. Store-level guards return "" so nothing can be started through code paths either.

## 3. Custom roles: coverage of the new features

`CustomRole.capabilities` now covers all six governable actions:
edit, publish, seo, agent, **generate** (page generators), **markdown** (llms.txt, .md files, serve toggles).
Builder checkboxes updated. Layering rule: workspace AI controls beat role capabilities; a role granting "generate" cannot override a workspace that turned generators off.

## 4. Role visibility matrix (who sees what)

| Surface | Admin | Developer | Marketer | Editor | Reviewer |
|---|---|---|---|---|---|
| Workspace settings nav | Full | Full | Reachable, read-mostly | No Settings tab | No Settings tab |
| AI controls | Manage | Manage | View only (lock note) | Not reachable | Not reachable |
| Connected agents | Manage | Manage | View | Not reachable | Not reachable |
| API keys / webhooks | Manage | Manage | View | Not reachable | Not reachable |
| Project custom roles | Manage | Manage | See own limits | See own limits | See own limits |

## 5. Skipped, with reasoning

- **Workspace-level custom roles**: custom roles scope to a project's collections/pages/sections; a workspace-level copy would duplicate the Access tab with weaker scoping. The workspace Roles page stays a matrix of the five built-in seats.
- **Fake integration connects**: integrations stay "Coming soon" rather than pretending to OAuth.
- **A separate chatbot**: the agent dock IS the chat surface, available on every project screen. Building a second chat widget would split history, credits and audit into two places. External agents get their own connect surface instead.
- **Per-member AI budgets**: workspace budget + audit trail covers the misuse story at this stage; per-member caps add a table nobody asked for yet.

## 6. UX consistency notes (found during the padding/a11y pass)

- Two card idioms coexist: `SettingsSection` (px-5 headers) and hand-rolled `px-7 py-5` cards (API keys, webhooks). Rebuilt pages now use px-5 headers; remaining px-7 cards are visually close and left alone rather than churned.
- All new dialogs: portal at z-[95], backdrop close, aria-label, Escape via backdrop, focus on first input.
- One-time reveal dialogs deliberately block "Done" until the value is copied.
- Switches everywhere have aria-labels; disabled states carry explanatory hints instead of silent disabling.
- Copy rules hold: no dashes in UI copy, no fluff verbs, tiers only ever Lite/Balanced/Max ("seamlessly" removed from Integrations).

## 7. Open items for the production build

1. Notification toggles need a preferences store (cosmetic now).
2. Credit budget is stored + displayed but spend is simulated; wire to real metering.
3. Custom roles are store + UI; runtime enforcement joins the effective-role cascade server-side.
4. Workspace-created content (workspaces, domains, tokens, webhooks) is in-memory; hard refresh reseeds.
