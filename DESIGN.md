# Design System — Solar Sales Calculator

## Product Context

**What this is:** An internal sales tool for solar installation teams. Reps configure systems, calculate selling prices, and generate quotes. Used on desktop and tablets, often during customer visits.

**Project type:** B2B internal web application (dashboard)

**Users:** Sales reps (daily), admins (occasional)

**Design goal:** Fast, confident, precise. A rep should be able to open this, build a quote, and save it in under 3 minutes. Nothing should slow them down or require explanation.

---

## Brand

| | |
|---|---|
| **Primary** | `#d92127` — brand red |
| **Secondary** | `#ffffff` — white |
| **Character** | Bold, energetic, trustworthy. Like a Swiss-engineered machine: no fat, no decoration, just performance. |

---

## Color

### Primary — Red

Red is reserved for: primary actions, active nav states, key data highlights, and CTAs.
**Never use as background on large surfaces. Never pair red text on red background.**

| Token | Hex | Use |
|-------|-----|-----|
| `red-50` | `#fff1f1` | Hover background on ghost buttons |
| `red-100` | `#ffe1e1` | Error field background |
| `red-200` | `#ffc7c7` | Error borders |
| `red-400` | `#f15558` | Hover state of primary button |
| `red-500` | `#d92127` | **Brand primary — buttons, active nav, key accent** |
| `red-600` | `#b81d22` | Pressed/active state of primary button |
| `red-700` | `#96181c` | Text on light red background (error messages) |
| `red-900` | `#5a0e11` | Rare dark accent |

### Neutral — Warm Gray

Neutral palette is warm-tinted to harmonize with the red brand color. Never mix warm and cool neutrals.

| Token | Hex | Use |
|-------|-----|-----|
| `gray-50` | `#fafaf9` | App background, page canvas |
| `gray-100` | `#f5f5f4` | Card background, input background |
| `gray-200` | `#e7e5e4` | Borders, dividers |
| `gray-300` | `#d6d3d1` | Disabled input borders |
| `gray-400` | `#a8a29e` | Placeholder text, secondary icons |
| `gray-500` | `#78716c` | Secondary/helper text |
| `gray-600` | `#57534e` | Subdued body text |
| `gray-700` | `#44403c` | Body text |
| `gray-800` | `#292524` | Headings, strong text |
| `gray-900` | `#1c1917` | Sidebar background, nav |
| `white` | `#ffffff` | Card surfaces, content backgrounds |

### Semantic

| Intent | Color | Hex |
|--------|-------|-----|
| **Success** | Green | `#16a34a` |
| **Warning** | Amber | `#d97706` |
| **Error** | Brand Red | `#d92127` |
| **Info** | Blue | `#2563eb` |

The brand red doubling as the error color is intentional — it keeps the palette tight. Use `red-100` background + `red-700` text for error messages so they read as informational, not alarming.

### Usage Rules

- Red on white: always. White on red: always. Red on gray: check contrast (4.5:1 minimum).
- **Never** use red as a section background or page-level color wash.
- **Never** use red for both a CTA and an error state in the same view — use `red-600` for CTA, `red-500` for error label, `red-100` for error background.
- Margin percentage displays: use `green-600` when above target, `red-600` when below floor.

---

## Typography

### Font Stack

**Primary: [Geist](https://vercel.com/font)** — modern, clean, excellent number rendering.
Fallback: `system-ui, -apple-system, sans-serif`

**Mono: Geist Mono** — for all CHF amounts, kW values, percentages, quote numbers.
Fallback: `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`

> **Why not Inter?** Inter is the default choice for every AI-generated dashboard. Geist has identical readability, better number spacing, and instantly distinguishes this app from generic tooling.

### Scale

Base: 16px. Ratio: 1.333 (Perfect Fourth). All heading sizes rounded to nearest 2px.

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `text-xs` | 12px | 400 | 1.5 | Captions, labels, badge text |
| `text-sm` | 14px | 400/500 | 1.5 | Helper text, table metadata |
| `text-base` | 16px | 400 | 1.6 | Body text, form labels |
| `text-lg` | 18px | 500 | 1.5 | Emphasized body, card titles |
| `h4` | 20px | 600 | 1.25 | Section subheadings |
| `h3` | 24px | 600 | 1.2 | Card/panel headings |
| `h2` | 32px | 700 | 1.15 | Page section titles |
| `h1` | 42px | 800 | 1.1 | Page titles (rare in dashboards) |
| `display` | 56px | 800 | 1.0 | Price totals, hero numbers only |

### Number Display (Critical for a Pricing Tool)

All currency amounts, percentages, kW values, and quote numbers use:
```css
font-family: 'Geist Mono', monospace;
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum";
```

This ensures columns of numbers align perfectly. It's the single highest-impact CSS rule for a financial tool.

**CHF formatting:**
- Always: `CHF 25'400.00` (Swiss convention: apostrophe as thousands separator)
- Never: `CHF 25,400.00` (English convention — wrong for CH market)
- Implementation: `new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount / 100)`

### Rules

- Body text: 16px minimum. Never below 14px for interactive elements.
- Line length: 60–75 characters max for body. Use `max-width: 65ch` on prose.
- Heading hierarchy: never skip levels (h1 → h3 without h2).
- `text-wrap: balance` on all headings.
- No letter-spacing on lowercase text.
- Use `…` (U+2026), not three dots `...`.

---

## Spacing

**Base unit: 4px.** All spacing values are multiples of 4.

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Icon padding, tight inline gaps |
| `space-2` | 8px | Between label and input, badge padding |
| `space-3` | 12px | Form field gap, list item gap |
| `space-4` | 16px | Section padding (mobile), card padding |
| `space-5` | 20px | — |
| `space-6` | 24px | Card padding (desktop), section gap |
| `space-8` | 32px | Between major sections |
| `space-10` | 40px | Large section padding |
| `space-12` | 48px | Page-level vertical rhythm |
| `space-16` | 64px | Major section separation |

**The grouping rule:** related elements are 8–16px apart. Distinct sections are 32–48px apart. The spacing tells the story of what belongs together.

---

## Border Radius

This is a bold, energetic tool — not a bubbly, consumer app. Radius is used sparingly and hierarchically.

| Component | Radius |
|-----------|--------|
| Buttons | `6px` |
| Inputs, selects | `6px` |
| Cards, panels | `8px` |
| Badges, chips | `4px` |
| Modals | `12px` |
| Tooltips | `6px` |
| Avatars | `9999px` (full circle) |

**Rule:** Never apply the same large radius to every element. Uniform roundness is the #1 AI slop layout tell.

---

## Layout & Grid

### App Shell

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (240px, gray-900)    │  MAIN CONTENT            │
│                               │                          │
│  [Logo]                       │  [Page Header]           │
│                               │  [Breadcrumb]            │
│  ● Calculator     (active)    │                          │
│  ○ Quotes                     │  [Content Area]          │
│  ○ Catalog (admin)            │                          │
│  ○ Settings (admin)           │                          │
│                               │                          │
│  ─────────────────            │                          │
│  [Rep Name]                   │                          │
│  [Sign out]                   │                          │
└──────────────────────────────────────────────────────────┘
```

- Sidebar: `gray-900` background, white text, `red-500` left border on active item
- Content area: `gray-50` background
- Cards/panels: `white` surface with `gray-200` border and `2px shadow`
- Max content width: `1200px`, centered

### Calculator Layout (Phase 1)

```
┌──────────────────────────────────────────────────────────┐
│  INPUTS (60%)                 │  PRICE SUMMARY (40%)     │
│                               │  ┌──────────────────┐   │
│  Customer info                │  │ CHF 28'450.00     │   │  ← display font, bold
│  System size                  │  │ Incl. 8.1% VAT   │   │
│  Panel selection              │  │                  │   │
│  Inverter selection           │  │ Cost:   18'200   │   │
│  Cost options                 │  │ Margin:    28.5% │   │
│  ZIP code                     │  │ VAT:     2'106   │   │
│  Margin %                     │  └──────────────────┘   │
│                               │                          │
│  [Save Quote]  [Clear]        │  [Save Quote]            │
└──────────────────────────────────────────────────────────┘
```

The price summary panel is **sticky** on desktop — it stays visible as the rep scrolls through a long form.

---

## Components

### Buttons

```
PRIMARY:   bg=red-500  text=white  hover=red-600  active=red-700
           border-radius: 6px  padding: 10px 20px  font-weight: 600

SECONDARY: bg=white  text=gray-700  border=gray-300  hover=gray-100
           Same radius and padding as primary

GHOST:     bg=transparent  text=gray-600  hover=gray-100
           No border. Use for tertiary actions only.

DANGER:    bg=red-600  text=white  hover=red-700
           Reserved for destructive actions (delete, deactivate).
           Always requires a confirmation step.
```

**Label rules:** Be specific. "Save Quote" not "Save". "Add Product" not "Add". "Deactivate" not "Delete" (unless it truly deletes).

### Inputs & Selects

```css
/* Base state */
border: 1px solid var(--gray-300);
border-radius: 6px;
padding: 10px 12px;
background: white;
font-size: 16px;

/* Focus */
border-color: var(--red-500);
outline: 2px solid var(--red-200);
outline-offset: 0px;

/* Error */
border-color: var(--red-500);
background: var(--red-50);

/* Disabled */
background: var(--gray-100);
opacity: 0.6;
cursor: not-allowed;
```

### Price Summary Card

The most important component in the app. It must command attention and communicate trust.

```
┌─────────────────────────────┐
│  Total Price                │  ← gray-500, text-sm, uppercase, tracking-wide
│                             │
│  CHF 28'450.00              │  ← display font, gray-900, 48px, Geist Mono
│                             │
│  Excl. VAT:  CHF 26'344     │  ← gray-600, text-sm, tabular-nums
│  VAT (8.1%): CHF 2'134      │
│  ─────────────────────      │
│  Margin:     28.5%  ●       │  ← green if ≥ floor, red if < floor
│                             │
│  Valid until: 17.06.2026    │
└─────────────────────────────┘
border: 1px solid gray-200
border-left: 4px solid red-500   ← the ONE place this pattern is intentional
border-radius: 8px
padding: 24px
background: white
```

The colored left-border is normally an AI slop anti-pattern. Here it's used **intentionally and only once** in the entire app, on the most important element, using the brand color. This is the exception that proves the rule.

### Status Badges

```
DRAFT:    bg=gray-100  text=gray-600
SENT:     bg=blue-50   text=blue-700
ACCEPTED: bg=green-50  text=green-700
REJECTED: bg=red-50    text=red-700
EXPIRED:  bg=gray-100  text=gray-400  opacity: 0.7
```

---

## Navigation

### Sidebar

```css
background: var(--gray-900);     /* near black, warm tint */
width: 240px;
padding: 24px 0;

/* Logo area */
padding: 20px 24px 32px;

/* Nav item */
padding: 10px 24px;
color: var(--gray-400);
font-size: 14px;
font-weight: 500;
border-left: 3px solid transparent;

/* Active nav item */
color: white;
background: rgba(217, 33, 39, 0.1);   /* red-500 at 10% opacity */
border-left: 3px solid var(--red-500);
```

---

## Motion

All transitions are purposeful. No animations for their own sake.

| Property | Duration | Easing |
|----------|----------|--------|
| Price updates (live) | 150ms | ease-out |
| Button hover/press | 100ms | ease-out |
| Sidebar item hover | 100ms | ease-out |
| Page transitions | 200ms | ease-in-out |
| Toast in | 200ms | ease-out (slide-up) |
| Toast out | 150ms | ease-in (fade) |
| Modal open | 200ms | ease-out (scale 0.97→1) |

**Rules:**
- `prefers-reduced-motion`: all transitions disabled when set
- Only animate `transform` and `opacity` — never width, height, or layout properties
- No `transition: all` — list properties explicitly

---

## AI Slop — Explicitly Forbidden

These patterns are banned. If a developer installs a component library that generates any of these by default, override or remove them:

1. **3-column icon-in-circle feature grid** — the most recognizable AI layout pattern
2. **Purple/violet/indigo gradients** — even if the brand uses red, no purple gradients allowed
3. **Decorative SVG blobs, wavy dividers, floating circles** — if a section feels empty, add content
4. **Centered everything** — left-align body text and descriptions; only center headlines and CTAs
5. **Uniform large border-radius** — we've defined a radius hierarchy; use it
6. **Emoji in headings or as bullet points** — this is a professional financial tool
7. **Generic microcopy** — no "Welcome to...", "Unlock the power of...", "Your all-in-one..."
8. **Stock illustration heroes** — for an internal tool, use real data/numbers in the UI as the visual
9. **Cookie-cutter section rhythm** — not applicable (dashboard, not landing page), but worth noting for the admin catalog page

---

## Responsive

Phase 1 is desktop-first (reps primarily use laptops or tablets). But mobile must not break.

| Breakpoint | Width | Behavior |
|------------|-------|---------|
| Mobile | < 768px | Sidebar collapses to bottom nav (4 icons). Calculator is single-column. |
| Tablet | 768–1024px | Sidebar collapses to icon-only (48px). Calculator is 2-column. |
| Desktop | > 1024px | Full sidebar (240px). Calculator is 2-column. |

**Touch targets:** All interactive elements ≥ 44px on touch devices. The margin % input and option checkboxes are the highest-risk elements for being too small on tablet.

---

## Accessibility

- WCAG AA minimum for all text. Brand red `#d92127` on white passes AA (contrast ratio 5.4:1).
- `focus-visible` ring on all interactive elements: `outline: 2px solid var(--red-500); outline-offset: 2px`
- Never `outline: none` without a custom focus replacement
- All form inputs have associated `<label>` (not just placeholder)
- Error messages use `role="alert"` and are announced to screen readers
- Price summary updates use `aria-live="polite"` so screen readers announce changes

---

## Tone & Voice

**Language:** German (primary), French (secondary). Phase 2. Phase 1 is German-only.

**Voice rules:**
- Direct and confident. "Speichern" not "Möchten Sie speichern?"
- Specific button labels. "Offerte speichern" not "Weiter"
- Error messages: what happened + what to do. "Marge unter Mindestgrenze (20%). Bitte anpassen."
- Numbers in Swiss format: `CHF 25'400.00`, `28.5 %` (space before percent in French, not in German)

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-17 | Geist over Inter for typography | Avoids generic dashboard look; better number metrics |
| 2026-03-17 | Warm gray neutrals | Harmonizes with red-500 primary; cold grays fight the brand |
| 2026-03-17 | Single colored left-border on price summary only | Intentional exception to anti-pattern rule; highest-value element |
| 2026-03-17 | Integer Rappen + Intl.NumberFormat('de-CH') | Swiss apostrophe thousands separator; zero float drift |
| 2026-03-17 | Desktop-first, mobile-must-not-break | Primary use case is laptop/tablet; mobile fallback required |
| 2026-03-17 | Red-500 doubles as error color | Keeps palette tight; distinguished by context (bg + text treatment) |
