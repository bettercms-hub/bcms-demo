# Design controls — marketer-mode section styling

The product decision record for the section design-control system (v1 shipped
2026-07-11), inspired by heavily-customized Sanity visual-editing setups
(theme switch per section, conditional overlay props, spacing tokens the
developer curates). This is the native, out-of-the-box version of that idea.

## The model

Design lives on the **section instance** as two structured objects:

- `section.layout` — width preset, alignment, paddingY/paddingX tokens,
  block gap token, grid columns, `fullHeight`
- `section.style` — background surface / custom color / image, `theme`
  (inherit | light | dark), `overlayOpacity` (0-100, image-conditional),
  text tone, font scale, radius, shadow, borders

**Tokens, never raw CSS.** Values are named presets (`paddingY: "lg"`,
`width: "narrow"`, `theme: "dark"`), not pixel values or stylesheets. That is
what keeps the system:

1. **Consistent** — marketers pick from the design system, they can't drift
   away from it. The client "doesn't have to learn your design system;
   they just use it."
2. **Headless-safe** — the `layout`/`style` objects travel through the API
   as plain data. A Next.js frontend maps `paddingY: "lg"` to its own scale;
   BetterCMS Cloud (managed hosting) renders the same tokens with the
   built-in mapping (`src/components/cms/editor/preview/sections.tsx`).
3. **Portable** — themes/spacing can later be re-mapped per brand kit
   without touching stored content.

## The developer allow-list

`sectionDesignControls(kind)` in `src/lib/cms/section-schema.ts` decides
which knobs each section kind exposes — the "only the spacing variables I
actually want them to use" pattern:

- Every kind gets the standard set (background, image+overlay, theme,
  typography, shape, width, align, padding, gap, columns).
- `hero` and `cta` additionally get **Full viewport height**.
- Chrome kinds (`navigation`, `header`, `footer`) are trimmed to
  background + theme + typography — they own their own width/padding.

Developers extend `DESIGN_OVERRIDES` to tighten or widen this per kind.
(Roadmap: expose this in the /schema builder so it's editable without code.)

## Conditional props

Controls appear only when they mean something. The **Overlay opacity**
slider renders only once a background image is set — props stay clean the
way the reference setup keeps card image/alt fields hidden until the image
variant is chosen.

## Who gets it

Design power is a **marketer-and-up** capability (`canCompose`):
- Marketer, developer, admin, owner → all five section tabs
  (Content / Layout / Style / SEO / Advanced).
- Content editor, reviewer → **Content + SEO only**. Their job is copy;
  they can't reshape pages. Enforced in the section workspace
  (`PageView.tsx`), driven by the same view-as system as the rest of the app.

## What v1 deliberately leaves out (and why)

- **Free-form CSS fields for marketers** — breaks the consistency contract;
  devs already have scoped custom CSS + classes on the Advanced tab.
- **Element-level design (per-block max-width ch sliders, per-button
  spacing)** — highest-value next step, but it needs per-block design
  storage + inspector surface. Sections-first covers the 80% case
  (spacing/theme/layout rhythm) at a fraction of the complexity.
- **Brand-kit spacing variables** — the token scale is currently global
  (none/sm/md/lg/xl). Wiring it to per-project brand tokens is a follow-up;
  the storage format doesn't change.
- **Drag-on-canvas padding handles** (the drag-to-adjust from the video) —
  pure interaction polish over the same data; can land later without
  migration.

## Verified

Northwind Home → Hero: token spacing scales render; Full-viewport-height
toggle (hero/cta only); theme Dark flips the section live on the canvas;
background image reveals the overlay slider; 60% scrim keeps the headline
legible; view-as Content editor hides Layout/Style/Advanced.
