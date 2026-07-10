# BetterCMS copy guide

The house style for every user-facing string. Grounded in Nielsen Norman Group,
Shopify Polaris, Google Material, Atlassian, Stripe, Mailchimp, and Intercom, plus
Saito ("letter case"), Yifrah (*Microcopy*), and Podmajersky (*Strategic Writing for UX*).

One meta-rule: **clarity over cleverness, always.** Personality comes after clarity,
never instead of it, and only in low-stakes places (empty states, success, presence).

## Casing — sentence case everywhere

Titles, headings, buttons, tabs, nav, labels, menu items: **sentence case.** Capitalize
only the first word plus proper nouns, product names, and acronyms.

- Do: "Add payment method", "Roles & permissions", "Schema markup", "API keys"
- Don't: "Add Payment Method", "Roles & Permissions", "Schema Markup", "API Keys"
- Keep capitalized: BetterCMS, SEO, API, RSS, JSON-LD, Slack, GitHub, Claude Code, GPTBot.

## Punctuation

- No period on short text: buttons, labels, tabs, tooltips, single-line toasts, menu items.
- Period only on full sentences: helper text, multi-sentence body, error bodies.
- Never any punctuation inside a button (no `.`, `!`, `?`).
- Exclamation points are rare, reserved for genuinely good news, never in errors.
- Oxford comma. Numerals for numbers ("3 pages", "8 characters").
- No em-dashes (—) or en-dashes (–) inside sentences. Use a period, colon, or comma.
  (The bare `—` as an empty-cell glyph in a table is a separate, allowed convention.)

## Buttons and actions

- Lead with a verb; add the noun when the target is ambiguous: "Create endpoint", "Delete folder".
- Bare common actions are fine when the object is obvious: Save, Cancel, Delete, Add, Done, Close.
- 2 to 4 words. Drop articles (a/an/the). No "please", no "successfully".
- Second person for possessives: "Post your update", not "Post my update".

## Navigation and tabs

- Nouns, not verbs. 1 to 2 words. Front-load the meaningful word.
- Icon-only is allowed only for near-universal glyphs (search, close, home) or a compact
  toggle that also carries a tooltip + screen-reader label. Otherwise show the text label.

## Page titles and subtitles

- Title: sentence case, no period, front-loaded keyword, works out of context.
- A subtitle must earn its place. Most pages need none. Add one only to remove real ambiguity
  or state a benefit, and keep it to **one short sentence**. Never restate the title.
- Cut 2 to 3 sentence descriptions to one clause, or delete them.

## Empty states

- Structure: what this is / why it's empty, then what to do, then one action.
- One line plus one clear CTA. Never a bare blank or "No data".
- A safe place for light warmth, as long as the next step stays obvious.

## Errors and validation

- Never blame the user. Drop "invalid", "illegal", "oops", "something went wrong".
- Reason plus fix, specific, at most two sentences, shown next to the field, input preserved.
- CTA is an imperative verb ("Try again", "Update details"), never "OK".

## Tooltips and helper text

- Supplementary only. Never hide required or actionable info in a hover tooltip.
- Don't repeat the label. If it adds nothing, omit it.
- Helper text is persistent (not a placeholder) and gets a period only if it's a full sentence.

## Confirmation and destructive dialogs

- Buttons restate the action: "Delete project" / "Keep project". Never Yes/No or OK/Cancel.
- Title and body name the specific object and the irreversible consequence.
- Stay neutral and exact. No personality, no emoji in destructive flows.

## Toasts

- Short, past tense, name the object: "Page published", "Draft saved".
- One phrasing per action across the whole app (see glossary). Prefer silent feedback over
  a congratulatory toast on every click.

## Form fields

- A placeholder is not a label. Always show a persistent visible label.
- Placeholders show format examples only ("name@company.com"), never the only label.
- Use one example domain everywhere: `your-site.com`.
- No colon after a label.

## Voice

- Plainspoken and human, like a competent colleague. Contractions, active voice, "you".
- Voice is constant; tone flexes: reassuring in errors, quietly warm in success.
- No jargon or hype: avoid "leverage", "supercharge", "single source of truth", "pluggable".
- Banned words: unlock, seamless, empower.
- This ships as a public demo, so keep honest "(demo)" / simulated markers where an action
  is not really wired up. Standardize them, don't hide them.

## Glossary — one word per concept

| Concept | Use | Not |
|---|---|---|
| Remove a document/entry for good | Delete | Remove, Trash |
| Send content live | Publish | Push live, Ship |
| Take content off the live site | Unpublish | Take down |
| Cancel a scheduled publish | Unschedule | Cancel schedule |
| Copy a value to clipboard | "<Thing> copied" | "Copied <thing>", bare "Copied" |
| Not built yet | "Coming soon" | "coming next", "in a future release", "Roadmap in progress" |
| US spelling | canceled, organize, color | cancelled, organise, colour |
| Empty state opener | "No <things> yet" + how to add the first | "No data", "Nothing here" |
| Drop zone | "Drop files here, or browse" | six different phrasings |
