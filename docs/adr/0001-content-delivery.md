# ADR 0001: One content core, pluggable delivery

Status: proposed (prototype implements the UX; backend to be built)
Date: 2026-07-03
Owners: Flowtrix / BetterCMS

## Context

BetterCMS sells two experiences today: a hosted site product (we render, host and
publish) and a headless CMS (the customer's frontend fetches content over an API).
The prototype originally modeled this as a fork: `Project.kind: "headless" | "managed"`,
with two different navs and settings trees.

Questions this ADR answers:

1. Can a project convert between hosted and headless?
2. Can one project be both at the same time (hosted site plus API consumers)?
3. What does the Content Delivery API contract look like?

## Decision

**Do not fork the product on `kind`. Model delivery as capabilities on top of a
single content core.**

```
Project
├── Content core (identical in every mode)
│   ├── Schemas (collections, components)
│   ├── Entries
│   ├── Pages as Section/Block trees (JSON, never compiled HTML)
│   ├── Media
│   └── SEO records, redirects, sitemap rules, forms, tracking scripts
└── delivery: { hosted: boolean, api: boolean }
    ├── hosted → BetterCMS Cloud renderer + domains + publishing pipeline
    └── api    → Content Delivery API + SDKs + webhooks
```

Modes are presets over the two switches:

| Mode        | hosted | api | Who renders                          |
| ----------- | ------ | --- | ------------------------------------ |
| Hosted site | on     | off | BetterCMS Cloud                      |
| Headless    | off    | on  | Customer frontend (Next.js, Astro..) |
| Hybrid      | on     | on  | Both, from the same content          |

`kind` remains only as a derived back-compat label: `hosted ? "managed" : "headless"`.

### Conversion semantics

Switching modes flips flags. Content never moves, exports, or converts.

- Hosted → Headless: hosting adapter off. Publishing/domains UI hides. The API
  serves the same block trees and entries. The customer maps blocks to their own
  components (see Rendering SDK below).
- Headless → Hosted: hosting adapter on. Our renderer consumes the same content.
  Presentation defaults come from the block registry defaults.
- Hybrid: both adapters on. No extra machinery, because of the next rule.

### The one rule that makes hybrid free

**The hosted renderer must be consumer #1 of the public Content Delivery API.**
It reads pages, entries, SEO and redirects through the same endpoints and the same
publish states that external customers use. No private side channel. If the hosted
renderer needs data the API cannot express, fix the API.

## Prior art (why we are confident)

- WordPress: one install serves PHP themes or WPGraphQL/REST headless.
- Wix Headless: hosted sites and "use us as a backend" from the same platform.
- Builder.io: visual editor, content delivered as JSON, customer renders via SDK
  plus a component registry. Closest to our block-tree model.
- Storyblok: component-based headless with a visual editor.
- Sanity/Contentful: pure headless; they prove the API shape, not the hybrid.

Our wedge: hosted rendering AND headless delivery from one project, switchable.
Webflow cannot flip modes; the pure headless players cannot host.

## Content Delivery API contract (v1)

Base: `https://api.bettercms.site/v1/:projectId`
Auth: `Authorization: Bearer <key>`

Keys (already modeled in the UI):

| Key     | Scope                                                              | Browser safe |
| ------- | ------------------------------------------------------------------ | ------------ |
| Public  | published content, SEO, schema, sitemap, public form config        | yes          |
| Preview | draft content and draft SEO                                        | no           |
| Server  | form submissions, analytics reads, protected actions               | no           |

### Read endpoints (Public key; Preview key adds `?state=draft`)

```
GET /content/:collectionSlug              → { items: Entry[], total, cursor }
GET /content/:collectionSlug/:entrySlug   → Entry
GET /pages?path=/about                    → Page (see shape below)
GET /seo?path=/about                      → SeoRecord
GET /schema?path=/pricing                 → { schema: JsonLd[] }
GET /redirects                            → { rules: [{source, destination, type, active}] }
GET /forms/:formSlug                      → FormConfig (fields, validation, success)
GET /tracking-scripts                     → { head: Script[], body: Script[] }
GET /sitemap.xml                          → XML (also proxyable by the frontend)
GET /robots.txt                           → text
```

### Page shape (the block tree is the payload, never HTML)

```json
{
  "id": "pg_home",
  "path": "/",
  "title": "Home",
  "state": "published",
  "publishedAt": "2026-07-01T10:00:00Z",
  "seo": { "title": "…", "description": "…", "canonical": "…", "robots": "index,follow" },
  "sections": [
    {
      "id": "sc_hero",
      "kind": "hero",
      "layout": { "width": "wide", "paddingY": "lg" },
      "blocks": [
        { "id": "b1", "kind": "heading", "props": { "text": "…", "level": 1 } },
        { "id": "b2", "kind": "cta-group", "props": {}, "children": [ … ] }
      ]
    }
  ]
}
```

Entries resolve references shallowly by default; `?depth=2` expands.

### Write/collect endpoints (Server key, or unauthenticated where noted)

```
POST /forms/:formId/submit        (unauthenticated + domain allowlist + spam checks)
POST /analytics/collect           (unauthenticated, cookie-less, domain allowlist)
GET  /analytics/summary           (Server key)
```

### Events (webhooks, already modeled)

`content.published | content.updated | content.unpublished | form.submitted`
Signed with the project webhook secret. Headless customers use these to trigger
rebuilds; the hosted renderer subscribes to the same events internally.

### Publish state machine (shared by both adapters)

`draft → published → modified → published`, plus `archived`. Publishing an item:

1. Content state flips to published (API starts serving it with the Public key).
2. Events fire.
3. If hosted: the renderer revalidates/deploys. If headless: the customer's
   webhook does. Hybrid: both happen from the same event.

## Rendering SDK (the genuinely hard part)

Content is portable; pixel-perfect presentation is not automatic. Ship:

1. `@bettercms/sdk` (fetch + types + preview mode): thin typed client over the
   endpoints above.
2. `@bettercms/react` (and astro/vue later): `<BlockRenderer tree={page.sections}
   components={registry} />`. The registry maps block kinds to the customer's
   components; unmapped kinds fall back to our reference renderer, so a converted
   site renders on day one and gets progressively re-skinned.
3. The hosted renderer uses the same `BlockRenderer` with our default registry.
   One rendering path, three consumers: our cloud, their frontend, previews.

## What the prototype implements vs what backend must build

Implemented in the prototype (UI truth, in-memory):

- `Project.delivery {hosted, api}` with `kind` kept in sync
  (`src/lib/cms/delivery.ts`, `projectActions.setDelivery`).
- Delivery settings page: mode presets, switch flow, adapter/consumer diagram
  (`…settings/delivery`). Nav and settings trees re-compose live per capability.
- Scoped keys, endpoints, webhooks, integration guide, SEO/schema/sitemap "served
  via API" surfaces.

Backend to build:

- The delivery service itself: query layer, key-scoped auth, CDN caching,
  block-tree serialization endpoint, publish events.
- The SDK packages and the component registry contract.
- Real key issuance, usage metering (feeds the existing billing surfaces).

## Consequences

- Conversion is a support-free, self-serve flag flip. No migrations, ever.
- Hybrid costs nothing extra once the hosted renderer eats the public API.
- The API contract becomes the product's spine; breaking changes need versioning
  (`/v1/`) from day one.
- Pricing note: delivery mode is orthogonal to site plans. A hybrid site does not
  pay twice; it pays for one site plan and consumes one pool of bandwidth/API
  quota (hosted rendering counts toward the same metering).
