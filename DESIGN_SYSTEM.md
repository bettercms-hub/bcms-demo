# BetterCMS — Design System

> The complete visual specification. Everything here is extracted from the shipped code (`src/styles.css` is the single token source). Follow it exactly and the skin is reproducible pixel for pixel. Values are literal; do not substitute "close" ones.

---

## 1. Design philosophy

- **Depth by tone, not shadow.** A 5-step surface ladder (s0–s4) expresses elevation. Shadows are reserved for floating layers (popovers, modals) only.
- **Hairline structure.** Borders are soft and neutral; the hairline (`--border-hairline`) does most structural work.
- **One accent.** Brand pink is the only saturated color in the chrome; it means "primary action / active / selected". Status hues appear only as small labels and dots.
- **Calm, dense, editorial.** 13px base type, tight line lengths, generous whitespace between sections, small caps labels.
- **Dark = neutral graphite, never tinted.** Elevation gets lighter in dark. The brand stays pink in both themes.
- **The website preview is always light.** Dark chrome frames a light "website" canvas (`.bcms-preview-surface`), Figma/Webflow style.

---

## 2. Typography

**Fonts** (Google Fonts, loaded in `__root.tsx`):
- Sans: `Inter` 400/500/600/700 — `--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif`
- Mono: `IBM Plex Mono` 400/500 — paths, tokens, code, curl examples, slugs.

**Base**: body `13px / 1.5`, antialiased, `text-rendering: optimizeLegibility`, `font-feature-settings: "cv02","cv03","cv04","cv11"`.

**Type scale (used sizes — do not invent between-steps)**:

| px | Usage |
|---|---|
| 9.5–10 | tiny chips ("staging"), kbd hints |
| 10.5 | uppercase micro-labels (`.u-label`: 600, tracking 0.08em, uppercase, muted), badge text, URL chips |
| 11 | table headers (600, uppercase, tracking-wide), fine print, hints |
| 11.5 | field labels (500, muted), secondary row text, notes |
| 12 | chip labels, small buttons, mono paths |
| 12.5 | body-secondary, menu items, descriptions, links |
| 13 | body default, nav tabs, inputs |
| 13.5 | row titles, card titles (600), primary buttons |
| 14 | section/card headings (600), dialog titles |
| 15 | reveal-dialog headings (600) |
| 22 | settings page H1 (600, tracking-tight) |
| 24 | onboarding step titles (600, tracking -0.01em) |
| 26 | hero headings (agent "How can I help you today?", auth panel) |

Headings: 600 weight, letter-spacing −0.01em to −0.02em. Never 700 except logo contexts. Mono text is always 11–12.5px.

---

## 3. Spacing, radius, grid

**Spacing scale (strict — never invent values)**: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96 px (`--space-1…24`). Common applications: card padding `p-4` (16), dialog header/footer `px-4 py-3`, settings row `px-5 py-3–4`, table cell `px-4 py-2.5`, gaps `gap-2/2.5/3`.

**Radius**: sm 6, md 8, lg 10, xl 12, 2xl 16 px. Cards/tables `rounded-xl`; dialogs `rounded-2xl`; inputs/buttons `rounded-lg`; chips `rounded-md`; pills/dots `rounded-full`.

**Layout containers**: content max `1440px`; settings pages `max-w-5xl px-8 py-10` (workspace) or `max-w-[1100px] px-10 py-12` (project); focused flows (onboarding/agent) `max-w-[560–720px]` centered, top offset `7–16vh`. Topbar h-14 equivalent; project tab row `h-12`; sidebar width 248px (settings sub-nav) / 400px (agent dock).

**Motion**: durations 80/140/200/320ms; easing `cubic-bezier(0.2,0,0,1)` (standard), `(0.3,0,0,1)` (emphasized). Step transitions: `animate-in fade-in slide-in-from-bottom-2 duration-300`. Selected-card feedback beat: 180ms before advancing.

---

## 4. Color — Light theme (verbatim tokens)

Surface ladder: `--s0 #FFFFFF` (paper: cards, modals, topbar, sidebar) · `--s1 #FAFBFC` (page canvas) · `--s2 #F4F5F7` (panels, muted fills) · `--s3 #ECEEF1` (section surfaces) · `--s4 #E4E6EB` (interactive resting).

Semantics: background=s1, card/elevated/sidebar/topbar/input-bg=s0, surface/panel/inspector/muted/accent/secondary=s2, row-hover #F4F5F7.

Text: foreground `#0F172A`, secondary `#475569`, muted-fg `#64748B`, disabled `#94A3B8`.

Borders: hairline `#EEEFF2`, border `#E3E5EA`, strong `#CFD2D9`.

Brand: primary `#EF037F`, hover `#FF1F8F`, pressed `#D6026F`, fg white, ring `#EF037F`; row-selected/nav-active = primary at 7–8% color-mix.

Status: live/success `#16A34A`, draft/warning `#D97706`, preview `#2563EB`, scheduled `#0891B2`, archived `#6B7280`, error/destructive `#B4243A`.

Category accents: media `#3B82F6`, layout `#8B5CF6`, interactive `#10B981`, action `#EF037F`, advanced `#F59E0B`.

Shadows: cards/containers NONE; popover `--shadow-2: 0 4px 14px -8px rgba(15,23,42,.12)`; modal `--shadow-3: 0 12px 32px -16px rgba(15,23,42,.16), 0 2px 6px -2px rgba(15,23,42,.06)`; focus `0 0 0 3px rgba(239,3,127,.18)`.

---

## 5. Color — Dark theme ("Graphite System", verbatim)

Neutral cool grays only — **no hue tint in any surface**. Elevation = lighter.

Ladder: `--s0 #141416` (app chrome: canvas/sidebar/topbar) · `--s1 #1C1C1F` (cards/panels/inputs) · `--s2 #222226` (inset/muted/focused) · `--s3 #28282D` (popovers, `--elevated`) · `--s4 #2E2E34` (modals, `--elevated-modal`).

Text (contrast checked, AA): foreground `#EDEDEF` (14.6:1 on s1), secondary `#C2C2C8` (9.6:1), muted-fg `#A0A0A8` (6.4:1), disabled `#6E6E76`. **Never pure white** (glare).

Borders: white alphas — hairline `rgba(255,255,255,.06)`, border `.09`, strong `.16`. Row hover `rgba(255,255,255,.045)`; selected/nav-active = `#F63E8F` at 12% mix.

Brand stays pink, lifted one step: primary `#F63E8F` (4.8:1 as text on canvas), hover `#FF5AA1`, pressed `#E02A7D`; focus ring `0 0 0 3px rgba(246,62,143,.28)`.

Status (400-level): success `#4ADE80`, warning `#FBBF24`, preview `#60A5FA`, scheduled `#22D3EE`, error `#F87171`, archived `#8B8B93`; destructive `#E5484D`. Accents: `#60A5FA / #A78BFA / #34D399 / #F63E8F / #FBBF24`.

Shadows deeper: `0 4px 12px -4px rgba(0,0,0,.4)` / `0 24px 64px -24px rgba(0,0,0,.6), 0 4px 16px -8px rgba(0,0,0,.4)`.

**Dark remap layer** (keep!): light-authored `text-{emerald|amber|rose|red|sky|blue|indigo|violet|cyan|teal}-500/600/700` utilities are lifted to 400-level in `.dark`, EXCLUDING `.bcms-preview-surface` descendants. New code should still write explicit `dark:` variants; the layer protects the long tail.

**Preview surface** (`.bcms-preview-surface`): its own light token set (#FFFFFF/#FAFAFA/#F5F5F7..., text #111827, borders #E5E7EB) so the website canvas renders light inside dark chrome. Comment bubbles over it stay light too.

**Mechanics**: Tailwind v4 `@custom-variant dark (&:is(.dark *))`; `.dark` + `data-appearance` set on `<html>` by `appearance.ts` (localStorage `bettercms.appearance.v2`; values dark/light/system; default light); `color-scheme` set per theme; themed thin scrollbars (dark thumb `rgba(255,255,255,.14)`).

---

## 6. Component recipes (copy these exactly)

**Buttons** (`ui/button.tsx` base: `rounded-lg font-medium h-8 px-3 text-[13px]`, transition 120ms):
- Primary: `bg-primary text-primary-foreground hover:bg-[var(--primary-hover)] active:bg-[var(--primary-pressed)]`
- Outline: border + card bg + row-hover on hover; Ghost: text-only. Small actions `h-7 px-2 text-[12px]`; icon buttons `h-7 w-7 grid place-items-center rounded-md`.
- Icon-in-button `h-3.5 w-3.5` with `mr-1/1.5`. Disabled: `opacity-50 cursor-not-allowed` + a visible hint elsewhere explaining why.
- Special: dashed secondary door (`border border-dashed border-color-border text-muted-foreground hover:text-foreground`).

**Inputs**: `h-9 w-full rounded-lg border border-[color:var(--color-border)] bg-card px-3 text-[13px] outline-none focus:border-[color:var(--primary)]` (hero variants h-10/h-11, text 13.5–14). Label above: `text-[11.5px] font-medium text-muted-foreground mb-1`; hint below `text-[11px] text-muted-foreground/80`. Prefix icon inputs: relative wrapper, icon `absolute left-2.5 h-3.5 w-3.5 muted`, `pl-8`. Mono editors: `font-mono text-[12–12.5px] bg-[var(--s2)] p-4 leading-relaxed`.

**Cards & sections**: `overflow-hidden rounded-xl border border-[color:var(--border-hairline)] bg-card`. Section header inside the card: `border-b bg-[color:var(--s2)] px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground` (Settings pages use the shared `SettingsSection`/`SettingsHeader`/`SettingsRow` idiom — header INSIDE the card so titles align with fields).

**Tables/lists**: header row = same uppercase 11px recipe with explicit `grid-cols-[minmax(0,1fr)_…]` columns; body `ul.divide-y divide-border-hairline`; rows `px-4 py-2.5 hover:bg-[var(--s4)]`, hover-revealed icon actions `opacity-0 group-hover:opacity-100`. Footer action rows: `border-t px-4 py-2.5 text-[12.5px] font-medium text-primary`.

**Dialogs** (portal pattern, used everywhere): `createPortal` → `fixed inset-0 z-[95]` → backdrop `bg-slate-900/45` (click closes) → panel `absolute left-1/2 top-[6–16vh] -translate-x-1/2 w-[min(440–700px,calc(100vw-24px))] max-h-[86–88vh] rounded-2xl border border-color-border bg-card shadow-2xl` → header `flex items-center gap-2.5 border-b px-4 py-3` (icon, 13.5–14px semibold title, mono subtitle, X `h-8 w-8`) → scrollable body `p-4` → footer `border-t px-4 py-3 flex justify-end|between gap-2`. Wizards add step dots: active `w-4–5 bg-primary h-1.5 rounded-full`, past `bg-primary/50`, future `bg-color-border`.

**One-time secret reveal**: emerald check disc `h-10 w-10 bg-emerald-500/10 text-emerald-600`, mono code box `bg-[var(--s2)] px-3 py-2.5 rounded-lg`, Copy button flips to outline "Copied", **Done disabled until copied**, line "it will not be shown again".

**Segmented controls / view pills**: container `flex gap-0.5 rounded-lg border border-border-hairline bg-[var(--s2)] p-0.5`; item `rounded-md px-2.5 py-1 text-[12px] font-medium`; active `bg-card text-foreground shadow-sm`; counts as tabular-nums muted.

**Chips & badges**: StatusBadge `h-5 rounded border px-2 text-[10.5px] font-medium uppercase tracking-wider` with tone classes (`bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` etc.). Status dot+label: `h-1.5 w-1.5 rounded-full bg-emerald-400` + label 12px. Primary-tinted chip: `bg-[color:color-mix(in_oklab,var(--primary)_9%,transparent)] text-primary`. kbd: `rounded border border-border-hairline bg-[var(--s2)] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70`. Email chips: pink-tinted, X button inside.

**Choice cards** (onboarding/wizards): `rounded-xl border p-4 text-left`; selected `border-[color-mix primary 45–55%] bg-[color-mix primary 5–6%] shadow-sm` + icon disc flips to `bg-primary text-primary-foreground` + bottom-right check disc; resting icon disc `h-9 w-9 rounded-lg bg-[var(--s2)] text-muted-foreground`.

**Locked/empty states**: `rounded-xl border border-dashed border-color-border bg-[var(--s2)] p-8–12 text-center` with centered muted icon, 13.5–14px semibold title, max-w-sm muted copy, optional primary CTA ("See plans").

**Banners**: info `bg-[var(--s2)] border-border-hairline px-3.5 py-2.5 text-[12.5px] muted` with lock icon; warning amber `border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200`; success/safety card uses emerald disc + "Always on" check line. Never red for usage.

**Switches**: Radix, thumb `h-4 w-4 bg-white`, checked translate-x-[18px]; ALWAYS `aria-label`. Checkbox rows: `label flex items-center gap-2 rounded-md border border-border-hairline px-2.5 py-2 text-[12.5px] hover:bg-color-row-hover`.

**Toolbar/search**: `ListToolbar` = search input (icon-prefixed, clear X) + `SegmentedFilter`, `mb-3 flex flex-wrap gap-2`.

**Icons**: lucide only. Inline 3.5/4 (14/16px); section icons in discs `h-8–9 w-8–9 rounded-lg`; decorative strokeWidth 1.75; icon color follows text color.

**Toasts**: sonner, sentence case, specific ("3 pages published", "URL copied").

---

## 7. Accessibility rules (all shipped, keep them)

- Focus: global `*:focus-visible { outline: 2px solid var(--ring); offset 2px }` + soft brand shadow ring on inputs.
- Contrast: body/muted text meets AA in both themes (numbers in §5); disabled text is exempt but still ≥3:1-ish.
- Every icon-only control has `aria-label`; dialogs have `role="dialog" aria-modal aria-label`; step flows expose "Step n of m"; menus/tabs are Radix (full keyboard).
- Keyboard-first flows: Enter submits single-input steps; number keys 1–9 pick choice cards; chips: Enter/comma add, Backspace pops.
- Cursor: pointer restored for all interactive roles; `not-allowed` on disabled (global CSS).
- Gates explain themselves in place; nothing disables silently.
- `color-scheme` declared per theme so native controls match.

---

## 8. Copy rules (hard requirements)

1. **No em dashes or en dashes anywhere in UI copy.** Use commas or periods.
2. No hype verbs: never "unlock", "seamless(ly)", "empower".
3. AI tiers are only **Lite / Balanced / Max** (speed framing). Model names appear only for user-owned BYOK keys.
4. Sentence case everywhere except uppercase micro-labels. Buttons are verbs ("Create workspace", "Publish all (4)").
5. Numbers stay honest and specific ("12 credits, Balanced speed", "first 50 used"). Usage is never red.
6. Empty/locked states: one calm sentence of value + one clear action.
