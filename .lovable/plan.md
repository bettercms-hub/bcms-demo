
# Workspace Overview — Visual & Interaction Polish

Scope: `src/routes/w.$workspace.index.tsx` only. No new widgets, no new data, no structural changes. Refine visual quality, hover behavior, and rhythm of three existing blocks: Continue working cards, Workspace setup, Projects table.

---

## 1. ContinueCard — premium card with subtle site mockup

Keep existing fields only (icon, name, description, status, avatars, last updated, env). Reorganize layout and add a decorative website mockup.

New structure (top → bottom inside the card):

```text
┌────────────────────────────────────────┐
│  [icon]  name           ● Live   Prod  │  ← header row
│          short description             │
│                                        │
│  ╭──────────────────────────────────╮  │
│  │ ● ● ●   project.com           │  │  ← mockup: browser chrome
│  │ ─────────────────────────────── │  │
│  │ ▢▢▢▢   ▭▭▭▭▭▭                  │  │  ← hero blocks
│  │ ▭▭▭▭▭▭▭▭▭▭▭▭                   │  │
│  │ ▭▭▭▭▭▭▭▭                       │  │
│  │ ░░  ░░  ░░                     │  │  ← 3-up tile row
│  ╰──────────────────────────────────╯  │
│                                        │
│  👥👥👥+2     ⌚ 2h ago        →     │  ← footer
└────────────────────────────────────────┘
```

The mockup is a pure CSS/SVG `SiteMockup` component built with surface tokens — no images, no screenshots. Uses `--s2` for the frame, `--s1` for the body, hairline divider, three traffic-light dots, a fake URL bar showing the project slug + `.bettercms.app`, and ~4 stacked blocks shaped from `currentColor` at low opacity. Default opacity ≈ 0.55; on card hover lifts to ≈ 0.9 with a soft 150ms transition. No borders, no shadows on the mockup itself.

Card styling changes:
- Replace `border-[var(--border-hairline)]` border with a near-invisible hairline; rely on `bg-card` (S1) surface contrast against canvas (S0).
- Remove `shadow-[var(--shadow-2)]` on hover. Replace with: brighter surface (`--row-hover`), border becomes `--border-strong`, mockup opacity rises, `→` arrow fades in at top-right of footer.
- Lift: keep the existing `-translate-y-px` (1px). No scaling.
- Replace bottom "QuickActionPill" cluster (Open / Preview / Publish / More) with a single right-aligned `ArrowRight` icon that fades in on hover. Quick actions belong inside the project, not on the overview.
- Tighten typography: name `text-[14.5px]`, description `text-[12px]` muted, footer meta `text-[11.5px]`.

---

## 2. Workspace setup — accordion checklist

Replace the 3-column grid of `SetupCard`s with a single collapsed-by-default accordion block.

Header row (always visible):
```text
▸  Complete workspace setup            3 / 6 · ▓▓▓░░░ 50%
```

Expanded body: vertical list of checklist rows. Each row:
```text
○  Upload workspace logo                                  →
✓  Invite teammates                                       
○  Configure custom domain                                →
```
- Pending: hollow circle, foreground text, hover reveals trailing `ArrowRight`, whole row is a `Link` to `item.href`.
- Done: filled check in muted/emerald, muted text, no arrow, not a link.
- Single-level only (no nested expand). Drop the separate "Completed" pill cluster — completion is conveyed by the row icon.
- Row hover: `--row-hover` background, no shadow, no lift.
- When `pct === 100`, keep the existing collapsed "Setup complete" affordance unchanged.

Accordion is plain local state (`useState`), no Radix dependency needed. Default `open = pct < 100 && pct > 0 ? false : false` — collapsed by default per spec.

---

## 3. Projects table — refinement only

Keep columns, filters, bulk toolbar, skeleton, empty state. Refine spacing, status, and hover.

- Row height: `py-3.5` → `py-4`. Header `py-2.5` → `py-3`. Increase column gap from `gap-4` to `gap-5`.
- Row border: keep hairline but drop opacity to ~0.5 via existing `--border-hairline` (already correct) — verify the token reads as low-contrast on S0; no token change.
- Project column: stack vertically with more breathing room. Increase icon to `h-9 w-9`, name `text-[13.5px] font-medium`, description `text-[11.5px] text-muted-foreground` truncated. Already mostly stacked — tighten the spacing and remove the icon's `shadow-[…]` glow (use flat gradient only).
- Status badge: drop the colored pill background. Render as `● Live` — small colored dot (keep saturated dot + soft glow only for `live`) followed by plain muted-foreground label. `StatusBadge` component refactored; cls map keeps only `dot` color.
- Env pill: reduce saturation — switch backgrounds from `…/12` to `…/8` and text from `400` to `300/muted-foreground` equivalents using existing tokens.
- Hover row:
  - background → `--row-hover` (already in place)
  - left accent bar stays (already in place)
  - reveal a small contextual action cluster on the right: `Open ↗  Publish  ⋯` — these already exist as `IconButton`s; move them out of the hidden md-only block and make them fade in on hover with a 120ms transition. Hide the standalone `ChevronRight` since the actions communicate affordance.
  - `RowMenu` (⋯) becomes hover-only too; remove the always-visible state.
- Transition easing aligned to `cubic-bezier(0.2, 0.8, 0.2, 1)` and 150ms throughout for consistency.

---

## Out of scope (do not touch)

- Header section
- Recent activity timeline
- Toolbar / filters / view toggle
- Bulk action toolbar
- Empty / no-results / skeleton components
- Design tokens in `src/styles.css`
- Any file outside `src/routes/w.$workspace.index.tsx`

---

## Technical notes

- New local component `SiteMockup({ name, slug }: { name: string; slug: string })` rendered inside `ContinueCard`. Pure JSX + tailwind, no new deps.
- New local component `SetupAccordion({ items }: { items: SetupItem[] })` replacing the grid of `SetupCard`s; `SetupCard` removed.
- `StatusBadge` simplified to dot + label (no pill background).
- All colors via existing tokens (`--s0`…`--s4`, `--row-hover`, `--border-hairline`, `--border-strong`, `--primary`, `--muted-foreground`). No hardcoded hex.
