# Site Search — product plan and decision record

> Status: v1 shipped in the demo (Search tab, per-field searchable model, live playground, install snippets, analytics). This doc records the research-grounded decisions so engineering can productionize without re-litigating them.

## 1. Why

Every serious CMS customer eventually asks for search on their site. Webflow ships a limited hosted-only version; Sanity and Contentful punt to Algolia integrations; BaseHub ships the best-in-class native version (confirmed Typesense-backed). We ship search as a **content-adjacent primitive like Forms**: configured in the CMS, consumed by a hosted widget or a headless SDK.

## 2. Competitive read (July 2026)

| Product | Native? | Granularity | Consumption | AI |
|---|---|---|---|---|
| BaseHub | Yes (Typesense) | Per-block Index toggle, commit-triggered sync | `_searchKey` → `useSearch` + SearchBox primitives | No |
| Webflow | Hosted-only | Per-element exclude | On-site page only, no API | No |
| Sanity | GROQ `match`/`score()` | Query-level | GROQ; real search via Algolia webhook | No |
| Contentful | `query` param (basic) | Content-type | REST; real search via Algolia app | No |
| Strapi | Meilisearch plugin | Per-collection | Meilisearch client | Via engine |
| Payload | Search plugin (own DB) | Per-collection + priorities | Payload query API | No |

Full source list in the research memo (BaseHub docs /extras/search, Typesense docs, Algolia security/analytics docs, Webflow help, Sanity/Contentful/Strapi/Payload docs).

## 3. Decisions

1. **Engine: Typesense** (open source, typo-tolerant, query-time sort, scoped keys, built-in vector/hybrid). Shared clusters, per-project **collections**, never per-project clusters (enterprise-only upsell). Algolia rejected: proprietary, replica-per-sort, cost curve.
2. **Granularity: field-level.** `searchable` flag per schema field (BaseHub's Index toggle, our schema builder). Text-ish fields default ON when a collection is enabled; everything else opt-in. Field opt-in is also the RAM/cost control.
3. **Sync on publish, not save.** The index only ever contains published content. Publish/unpublish/delete events enqueue index jobs with retries; admin shows per-collection "last synced" status. (The Contentful→Algolia silent-stale failure mode is the anti-goal.)
4. **Key scoping.** Parent key is search-only; clients get generated scoped keys with embedded non-overridable `filter_by: project_id`, TTL, and `exclude_fields`. Delivered like BaseHub's `_searchKey` via the content API. Raw admin keys never reach a browser.
5. **Two consumption modes, same index** (mirrors Forms):
   - **Hosted sites:** drop-in embed snippet (search overlay widget).
   - **Headless:** REST endpoint + `useSearch` hook + composable SearchBox primitives (Radix-style, unstyled). No iframe widgets for headless.
6. **AI search = plan-gated hybrid.** Add an auto-embed field to the Typesense collection, `query_by` includes the vector field, rank fusion (~0.7 keyword / 0.3 semantic). Zero new infra. Plan gating: keyword search rides the existing `search` feature key (Basic+); `ai-search` is Pro+.
7. **Analytics at the proxy:** top searches, searches without results, no-results rate (Algolia's dashboard IA). Metered like BaseHub analytics requests.
8. **Pages + entries both index.** Pages flatten section content; entries flatten searchable fields (richText via `docToPlainText`).

## 4. Gotchas engineering must own

- Typesense schema changes = alias + rebuild-swap (`posts_v2` → alias). Budget reindex on model edits.
- Deletes/unpublish must remove documents (all three lifecycle events, not just upsert).
- PII: anything indexed is exposable via the endpoint regardless of UI. Enforce field toggles strictly; `exclude_fields` on scoped keys; warn when a sensitive-looking field is toggled searchable.
- Draft search (in-admin) is a separate index if we ever ship it; never mix draft into the public index.

## 5. What the demo implements (spec for production)

- `src/lib/search/search-store.ts` — per-project `SearchConfig` (enabled, pages toggle, per-collection + per-field toggles, AI toggle, public scoped key), a working client-side index + query engine (tokenized, weighted title>field>body, snippet highlighting, optional typo tolerance in AI mode), and query-log analytics (top / no-result).
- Search tab in the project nav (owner/developer; plan-gated by `search` feature key with locked-state upsell).
- Hub page: Overview (enable, stats, last-synced), Searchable content matrix, Playground (live queries against real seeded content), Install (embed + API/React snippets w/ scoped key), Analytics (top queries, no-result queries).
- Schema builder: per-field "Searchable" toggle on `ModelField`.
- `ai-search` row added to `FEATURE_MATRIX` (Pro+).
