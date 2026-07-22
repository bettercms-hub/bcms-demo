# V2 design system migration — the contract

The design team's Figma redesign (file QaFTXeDyAz5McBfa021g5H, node 58692:2109)
is the single source of truth. Its extracted system lives in two places you
MUST read before touching code:
- `DESIGN_SYSTEM_V2.html` (repo root) — the full specimen sheet
- the measured ground truth summarized below (from Figma dev mode)

The app is fully token-driven (`src/styles.css`, Tailwind v4 `@theme inline`
→ semantic vars). The migration = token flip + primitive restyle + shell
restructure + surface sweeps. Functionality must not change. TypeScript must
stay clean (`bun run typecheck` or `npx tsc --noEmit`).

## 1. TOKEN MAP (styles.css)

### Light `:root`
| Token | Old | NEW |
|---|---|---|
| --s0 | #FFFFFF | #FFFFFF (unchanged) |
| --s1 (canvas) | #FAFBFC | **#F2F1EF** warm putty |
| --s2 | #F4F5F7 | **#F7F7F7** |
| --s3 | #ECEEF1 | **#F1F0F0** |
| --s4 | #E4E6EB | **#E6E6E6** |
| --foreground | #0F172A | **#181D27** |
| --foreground-secondary | #475569 | **#4D4D4D** |
| --muted-foreground | #64748B | **#606060** |
| --foreground-disabled | #94A3B8 | **#A6A6A6** |
| --border-hairline | #EEEFF2 | **#ECEBE9** |
| --border | #E3E5EA | **#E3E3E3** |
| --border-strong | #CFD2D9 | **#BABABA** |
| --primary | #EF037F | **#D54646** |
| --primary-hover | #FF1F8F | **#C23B3B** |
| --primary-pressed | #D6026F | **#A93333** |
| --ring | #EF037F | **#D54646** |
| --row-selected | pink 7% mix | **color-mix(in srgb, #D54646 7%, transparent)** |
| --nav-active-bg | pink 8% mix | **transparent** (v2 nav active = white card, see shell) |
| --nav-active-indicator | var(--primary) | **#761B36** burgundy |
| --destructive | #B4243A | **#B03A3A** |
| --status-live / -success | #16A34A | **#2E8B57** |
| --status-draft | #D97706 | **#5D5D5D** (v2: Draft is grey) |
| --status-preview | #2563EB | **#2786CA** |
| --status-scheduled | #0891B2 | **#0E7490** |
| --status-error | #B4243A | **#B03A3A** |
| --status-warning | #D97706 | **#9A7B24** khaki |
| --accent-action | #EF037F | **#D54646** |
| --shadow-2 | slate rgba | **0 4px 14px -8px rgba(53,30,39,.14)** |
| --shadow-3 | slate rgba | **0 12px 32px -16px rgba(53,30,39,.18), 0 2px 6px -2px rgba(53,30,39,.08)** |
| --shadow-focus | pink .18 | **0 0 0 3px rgba(213,70,70,.20)** |

NEW tokens to add in `:root` (+ dark equivalents) and `@theme inline`
(`--color-*` aliases where useful):
```
--brand-burgundy: #761B36;      /* active nav indicator, deep accent */
--brand-plum:     #4B2D39;      /* Upgrade button, deep surface */
--plum-text:      #351E27;      /* sidebar workspace name */
--plum-muted:     #5F4E55;      /* sidebar workspace meta */
--shadow-nav-card: 0 2px 2px rgba(0,0,0,.02), 0 5px 3px rgba(0,0,0,.01);
--shadow-seg: 0 0 1px rgba(158,143,146,.10), 0 1px 1px rgba(158,143,146,.09), 0 3px 2px rgba(158,143,146,.05);
--shadow-seg-track: inset 0 0.5px 2px rgba(182,168,171,.5);
--radius-xs: 4px;               /* in @theme: badges, checkboxes, utility buttons */
--status-draft-bg: #E6E6E6;  --status-draft-fg: #5D5D5D;
--status-live-bg:  #D3EDDE;  --status-live-fg:  #2D593F;
--status-review-bg: rgba(0,132,209,.15); --status-review-fg: #2786CA;
--plan-fg: #0084D1; --plan-border: rgba(0,166,244,.3);
```

### Dark `.dark` (near-black, warmer; coral IDENTICAL)
| Token | NEW |
|---|---|
| --s0 | **#0F0F10** |
| --s1 | **#1A1A1C** |
| --s2 | **#202023** |
| --s3 | **#242428** |
| --s4 | **#2A2A2E** |
| --foreground | **#F2F2F2** |
| --foreground-secondary | **#C9C9CC** |
| --muted-foreground | **#8E8E93** |
| --foreground-disabled | **#6E6E73** |
| --border-hairline | rgba(255,255,255,.07) |
| --border | rgba(255,255,255,.10) |
| --border-strong | rgba(255,255,255,.16) |
| --primary/-hover/-pressed | **#D54646 / #E05252 / #C23B3B** |
| --ring | #D54646 |
| --row-selected / --nav-active-bg mixes | on **#D54646** (12%) / transparent |
| --nav-active-indicator | **#D54646** (coral in dark, burgundy invisible) |
| --status-draft | **#D4B450** khaki (v2 dark rule) + draft-bg rgba(212,180,80,.18) |
| status bg/fg pairs | ok rgba(76,175,122,.16)/#4CAF7A, review rgba(90,167,232,.16)/#5AA7E8, plan #4DA9E8/rgba(77,169,232,.35) |
| shadows | black-based, deeper (0 24px 64px -24px rgba(0,0,0,.6) for shadow-3) |
| --plum-text / --plum-muted | #E8DFE3 / #B3A6AC |

Keep: `.bcms-preview-surface` (preview stays light-website) — update its
values only if they reference removed vars. Keep the `.dark :is(.text-*)`
status remap layer. Update any other hardcoded pink color-mix in the file.

## 2. PRIMITIVES (src/components/ui) — v2 specs
- **button.tsx**: default h-10 (40px) rounded-[6px] px-4 text-sm
  font-medium tracking-[-0.01em]; sm h-8 rounded-[6px]; primary coral w/
  hover/pressed tokens; **secondary = FILLED var(--s3) hover var(--s4), NO
  border, text foreground-secondary**; outline = bg-card + border (the old
  "secondary look") for tertiary; ghost unchanged semantics; destructive =
  outline red text/border, hover soft red fill; icon sizes 16 default.
- **badge.tsx**: **square rounded-[4px]** px-1.5 py-0.5 text-[12.5px]
  font-medium, soft-fill variants using the new status bg/fg pairs; ADD
  `plan` variant: rounded-full border plan-border text-plan-fg font-semibold
  px-2.5 bg-transparent.
- **input.tsx / textarea / select trigger**: h-10 rounded-[8px] border
  (--border #DEDEDE-ish ok via token) bg-card placeholder #7C7C7C →
  use muted-foreground; focus = border-strong + shadow-focus (no ring
  offset).
- **checkbox.tsx**: 16px rounded-[4px] border-border-strong; checked coral.
- **switch.tsx**: 40x22, thumb 18, coral when on.
- **tabs.tsx**: line variant = coral 2px underline, active text foreground;
  keep pill variant mapped to segmented look.
- **segmented.tsx**: track bg s2 rounded-[8px] p-1 shadow-seg-track; active
  item bg-card rounded-[6px] border shadow-seg.
- **table.tsx**: header row h-10 text-[13px] font-medium muted-foreground;
  body rows h-12 (48px) hover row-hover; row radius via cell padding.
- **dialog.tsx**: rounded-xl (12) shadow-3, overlay rgba(24,18,16,.4).
- **dropdown-menu / context-menu / popover / command**: rounded-[8px]
  shadow-3 border-hairline; item rounded-[6px] h-8 text-[13px].
- **card.tsx**: rounded-xl border-hairline; NO shadow at rest.
- **skeleton**: bg s3.
- **sonner.tsx**: card bg, rounded-[8px], shadow-3, 13px.
- **avatar**: keep; ring offsets use card color.
- Others (accordion, sheet r-16 left corners, slider coral, progress
  coral, pagination = tertiary buttons r-8): match language.

## 3. SHELL (the structural change, from the Figma dashboard)
Current: top bar + horizontal project tabs everywhere.
V2 target:
- **Workspace level** (dashboard + /w/$workspace/* pages): LEFT SIDEBAR
  260px on canvas (no card bg): header w/ logo + collapse; workspace
  switcher card (bg s4 r-8, 32px logo tile r-6, name 13 semibold
  plum-text, meta 11 plum-muted, chevrons); nav groups (Sites, Agents |
  General settings, Team, Plans, Billing, Usage, Domains | Help) rows h-9
  r-6 px-2.5 text-sm font-medium text-foreground-secondary; ACTIVE = bg-card
  border border-border shadow-nav-card text-foreground + absolute 2px
  nav-active-indicator bar at the sidebar's left edge; plum Upgrade button
  (r-8, plus icon) pinned bottom. MAIN AREA = canvas bg, content inside a
  **floating white card rounded-2xl border-hairline** with ~16px gutter,
  containing the route content (its own top row: breadcrumb, centered pill
  search if present, actions).
- **Project level** (/w/$w/p/$p/*): keep the top-bar pattern but v2ed:
  breadcrumb left, CENTER tabs (coral 2px underline active, muted labels,
  overflow "+N" chip when >6), right cluster (View as, presence, bell,
  theme, settings, connect). Content full-bleed on canvas (warm), cards
  white.
- Respect the existing device-tier system (mobile drawer stays).

## 4. SURFACE RULES (sweeps)
- No hardcoded slate/pink hexes; tokens only. Statuses via badge variants.
- Plan chips → `plan` badge variant everywhere (billing, dashboards).
- Tables → 48px rows, two-line name cells (13 medium + 12 muted path).
- Page headers: title 28/semibold tracking tight + 14 muted sub.
- Empty states: centered, 15 semibold + 13 muted + primary action.
- Radius audit: badges/checkbox 4, buttons/rows/menu-items 6, inputs/menus
  8, cards/dialogs 12, floating shell card/sheets 16. No rounded-full
  except plan chips, avatars, switch, pill search.
- Spacing stays on the 4px scale; no new magic numbers.
- Icons: lucide, 16 in dense chrome, 18-20 in nav/topbar.

## 5. VERIFICATION (every wave)
Dev server: `preview_start` name-based (port 8080; guest door via /auth
"Continue without signing in"). Check both themes (top-bar toggle), typecheck,
no console errors. The `.bcms-preview-surface` (visual editor canvas) must
stay light and untouched by dark mode.
