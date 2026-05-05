# Design System — I.ON Energy Calculator

## Product Context

**What this is:** A B2B sales tool for I.ON Energy. Two modes:
- **Rep mode** (the dashboard, calculator, quotes, admin) — internal tool for sales reps to configure systems, calculate selling prices, and generate quotes.
- **Customer mode** (`/present/[quoteId]` — the customer-facing meeting deck) — what reps show their customer on a tablet during the live sales meeting.

**Project type:** Hybrid. Rep mode is a B2B internal dashboard. Customer mode is a presentation surface (sales deck).

**Users:**
- **Sales reps** (daily) — laptop primary, tablet secondary, desktop in office.
- **Admins** (occasional) — manage catalog, settings, pricing coefficients.
- **Customers** (one-shot per meeting) — older (typically 50-70), looking at a tablet across a table from the rep, often with reading glasses.

**Memorable thing:** **Swiss-engineered precision instrument.** Every typography, color, spacing, and motion choice serves this north star. Customers and reps alike should walk away thinking "this team is serious about precision."

**Reference posture (customer mode):** UBS Private Banking on a tablet, NOT Sunrun marketing. The customer is making a 30k CHF financial decision — they want to feel SMART about it, not WARM about it. We lean on the same emotional posture as a private banking advisor showing an investment portfolio.

---

## Brand

| | |
|---|---|
| **Primary** | `#d92127` — brand red |
| **Secondary** | `#ffffff` — white |
| **Character** | Bold, energetic, trustworthy. Like a Swiss-engineered machine: no fat, no decoration, just performance. |

The brand red is non-negotiable. Everything else is a derived choice. The category convention is yellow / orange / amber — every other solar tool reaches for "sun" colors. Our red is genuinely differentiated. Keep.

---

## Color

**Approach: restrained.** No new colors. The existing palette (red + warm grays + small semantic palette) is the entire system, used in BOTH rep mode and customer mode. Restraint is the differentiator. Every competitor adds yellow, navy, sunset gradients. We don't.

### Primary — Red

Red is reserved for: primary actions, active nav states, key data highlights, CTAs. **Never** as background on large surfaces. **Never** red text on red background.

| Token | Hex | Use |
|-------|-----|-----|
| `red-50` | `#fff1f1` | Hover background on ghost buttons; recommended-tier card faint wash |
| `red-100` | `#ffe1e1` | Error field background |
| `red-200` | `#ffc7c7` | Error borders, focus outline ring |
| `red-400` | `#f15558` | Hover state of primary button |
| `red-500` | `#d92127` | **Brand primary — buttons, active nav, key accent, post-payback bars** |
| `red-600` | `#b81d22` | Pressed/active state of primary button; CTA on light surfaces |
| `red-700` | `#96181c` | Text on light red background (error messages) |
| `red-900` | `#5a0e11` | Rare dark accent |

### Neutral — Warm Gray

Warm-tinted to harmonize with red. **Never** mix warm and cool neutrals.

| Token | Hex | Use |
|-------|-----|-----|
| `gray-50` | `#fafaf9` | App background, page canvas |
| `gray-100` | `#f5f5f4` | Card background, input background, hairline-divider companion |
| `gray-200` | `#e7e5e4` | Borders, hairline dividers |
| `gray-300` | `#d6d3d1` | Disabled input borders |
| `gray-400` | `#a8a29e` | Placeholder text, secondary icons, savings-bar pre-payback |
| `gray-500` | `#78716c` | Secondary/helper text, eyebrow labels |
| `gray-600` | `#57534e` | Subdued body text, tier-card body copy |
| `gray-700` | `#44403c` | Body text |
| `gray-800` | `#292524` | Headings, strong text |
| `gray-900` | `#1c1917` | Hero numbers, page-title text, sidebar logo monogram |
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
- Margin percentage displays (rep mode only): use `green-600` when above target, `red-600` when below floor.
- Customer mode: red appears as (1) recommended-tier border + faint `red-50` wash, (2) post-payback savings bars, (3) screen-indicator active dot. Nowhere else.

---

## Typography

### Font Stack

**Primary: [Geist](https://vercel.com/font)** — modern, clean, excellent number rendering.
Fallback: `system-ui, -apple-system, sans-serif`

**Mono: Geist Mono** — for ALL CHF amounts, kW values, percentages, quote numbers.
Fallback: `ui-monospace, 'Cascadia Code', 'Fira Code', monospace`

> **Why not Inter?** Inter is the AI slop default. Every AI-generated dashboard reaches for it. Geist has identical readability, better number spacing, and instantly distinguishes this app from generic tooling. Same goes for Space Grotesk — also on the convergence-trap blacklist.

### Scale — two density modes

Base: 16px. Ratio: 1.333 (Perfect Fourth). Heading sizes rounded to nearest 2px.

#### Rep mode (dashboard, calculator, admin)

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

#### Customer mode (`/present/[quoteId]` only)

Body and headings shift one step up. Display scale roughly doubles.

| Token | Size | Weight | Line Height | Use |
|-------|------|--------|-------------|-----|
| `text-base` | **18px** | 400 | 1.65 | Body text — reading-glasses comfort |
| `text-lg` | 20px | 500 | 1.5 | Tier card name, secondary headings |
| `h3` | 28px | 600 | 1.2 | Screen subheadings |
| `h2` | 40px | 700 | 1.15 | Screen titles |
| `display-customer` | **96-128px** | 800 | 0.95 | Hero numbers (payback, total, savings) |

The customer-mode display scale is the single most distinctive typography call in the system. The headline number on each screen IS the answer the customer came for — payback in years, total CHF, lifetime savings. We render it large because UBS Wealth renders large; consumer solar tools render medium because they're afraid of the number.

### Number Display (Critical for a Pricing Tool)

All currency amounts, percentages, kW values, and quote numbers use:
```css
font-family: 'Geist Mono', monospace;
font-variant-numeric: tabular-nums;
font-feature-settings: "tnum";
```

This ensures columns align perfectly. Highest-impact CSS rule for a financial tool.

**CHF formatting (Swiss convention):**
- Always: `CHF 25'400.00` (apostrophe as thousands separator)
- Never: `CHF 25,400.00` (English convention — wrong for CH)
- Implementation: `new Intl.NumberFormat('de-CH', { style: 'currency', currency: 'CHF' }).format(amount / 100)`

### Rules

- Body text: 16px minimum (rep mode), 18px minimum (customer mode). Never below 14px for interactive elements.
- Line length: 60–75 characters max for body. `max-width: 65ch` (rep) / `60ch` (customer).
- Heading hierarchy: never skip levels (h1 → h3 without h2).
- `text-wrap: balance` on all headings.
- No letter-spacing on lowercase text.
- Use `…` (U+2026), not three dots `...`.
- Customer mode body text: 18px is a hard floor. WCAG AA assumed for 60-70 y/o readers with reading glasses.

---

## Spacing — two density modes

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

### Density modes

- **Rep mode (default):** comfortable density. Uses the scale above as-is.
- **Customer mode (`/present/`):** spacious density. Apply a 1.5× multiplier to all padding tokens. Card padding becomes 36px instead of 24px. Section gap becomes 36px instead of 24px. Major section separation becomes 96px instead of 64px.

**The grouping rule:** related elements stay 8–16px apart. Distinct sections are 32–48px apart (rep) or 48–96px apart (customer). Spacing tells the story of what belongs together.

### Tap targets

| Context | Minimum |
|---------|---------|
| Rep mode (laptop) | 32×32px |
| Rep mode (tablet) | 44×44px |
| **Customer mode** | **56×56px** (older users with reading glasses, big tap-friendly buttons) |

---

## Border Radius

Bold tool, not a bubbly consumer app. Used sparingly and hierarchically.

| Component | Radius |
|-----------|--------|
| Buttons | `6px` |
| Inputs, selects | `6px` |
| Cards, panels | `8px` |
| Badges, chips | `4px` |
| Modals | `12px` |
| Tooltips | `6px` |
| Avatars | `9999px` (full circle) |

**Rule:** Never apply the same large radius to every element. Uniform roundness is the #1 AI slop layout tell. Customer mode uses the same scale — no bigger radii on tablet.

---

## Layout & Grid

### Rep mode app shell

```
┌──────────────────────────────────────────────────────────┐
│  SIDEBAR (224px, white)       │  MAIN CONTENT            │
│  [Logo]                       │  [Page Header]           │
│                               │  [Breadcrumb]            │
│  ● Calculator     (active)    │                          │
│  ○ Quotes                     │  [Content Area]          │
│  ○ Catalog (admin)            │                          │
│  ○ Settings (admin)           │                          │
│  ─────────────────            │                          │
│  [Rep Name]                   │                          │
│  [Sign out]                   │                          │
└──────────────────────────────────────────────────────────┘
```

- Sidebar: `white` background, `gray-200` right border, dark text. Active nav: `red-50` background, `red-600` text, `3px red-500` left rail.
- Content area: `gray-50` background.
- Cards/panels: `white` surface with `gray-200` border and `2px shadow`.
- Max content width: `1200px`, centered.

### Customer mode shell (`/present/[quoteId]`)

Editorial layout, no app chrome. Built for tablet portrait + landscape.

```
┌──────────────────────────────────────────────────────────┐
│  [I.ON]  Bonjour {first_name}            ← Retour à l'offre│  ← top chrome
│ ────────────────────────────────────────────────────────── │
│                                                            │
│                                                            │
│                Hero content (full-bleed)                   │
│                                                            │
│                                                            │
│ ────────────────────────────────────────────────────────── │
│                  ●     ○     ○                             │  ← screen indicator (1/3)
└──────────────────────────────────────────────────────────┘
```

**Top chrome (rep-control region):**
- Top-left: 24×24 red square logo + "Bonjour {first_name}" in 14px gray-700
- Top-right: discrete "← Retour" link in 12px gray-500
- Bottom border: 1px hairline (`gray-100`)
- 16px vertical padding, 24px horizontal padding

**Bottom chrome (navigation):**
- Centered row of dots
- Active dot: `red-500`, 24px wide, 4px radius (rectangular pill)
- Inactive dots: `gray-300`, 8×8 circles
- 12-16px padding, 1px hairline above
- Tap each dot to jump to that screen

**Hero content area:**
- Full-bleed, no max-width constraint
- 24px outer padding (36px in spacious density mode)
- Single content column, centered or asymmetric per screen
- Customer's actual data is the visual content — no decorative imagery

---

## Customer-Facing Surfaces — `/present/[quoteId]` rules

The customer-facing flow has its own design rules that apply ONLY to `/present/`. Rep-mode rules above stay canonical for rep surfaces.

### What changes vs rep mode

| Dimension | Rep mode | Customer mode |
|---|---|---|
| Body text | 16px | 18px |
| Display scale | 56px max | 96-128px hero |
| Card padding | 24px | 36px |
| Section separation | 64px | 96px |
| Tap target | 32-44px | ≥56px |
| Motion | minimal-functional | intentional |
| Imagery | none / abstract icons | customer's actual roof from swisstopo |
| Chrome | sidebar + page header | thin top + bottom bars only |

### What stays the same

- Geist + Geist Mono typography stack
- Brand red `#d92127` and warm gray neutrals
- 4px base spacing scale (multiplied for spacious mode)
- Border radius hierarchy (no bigger radii in customer mode)
- All AI slop forbidden patterns

### Three deliberate risks (where I.ON gets its own face)

#### Risk 1: No stock photography. Anywhere.

The customer's actual roof from swisstopo (`ch.swisstopo.swissimage` aerial tile) is the only imagery on `/present/`. No family-on-couch lifestyle shots. No sunset gradients. No generic suburban roofs. No solar-panel illustrations.

**Implementation:** Screen 1 (Your roof) renders the swisstopo aerial tile as a full-bleed canvas with a 1.5px `red-500` outline marking the suitable roof surface. If swisstopo imagery is low-res for an address, fall back to the cadastre line drawing of the parcel — never a stock substitute.

**Why:** Every solar competitor uses the same family-on-couch visual language. The customer's actual house, with their actual roof, with their actual potential outlined, is uniquely persuasive in a way no stock photo can match. It says "this is YOUR specific situation," which is also the brand's "precision instrument" promise made visual.

#### Risk 2: Display number scale 96-128px on `/present/` hero screens.

Rep-mode display caps at 56px. Customer-mode display goes 2× bigger for the headline number on each screen.

**Implementation:** Screen 1 hero number ("83 m²" surface), Screen 2 tier prices ("28'450"), Screen 3 payback hero ("7.2 ans"), all rendered at 96-128px in Geist Mono with weight 800 and `letter-spacing: -0.04em`. Pair with generous whitespace above/below.

**Why:** UBS Wealth shows enormous numbers on tablet because the number IS the answer. Consumer solar tools render medium because they're afraid of the number. We are not afraid of the number.

#### Risk 3: Typographic savings chart (not a generic recharts line).

Standard pattern: a green line going up over 25 years. We replace with a typographic bar chart where each bar is the cumulative savings up to that year. Bars before payback year are `gray-100`. Bars at and after payback year flip to `red-500`. The visual moment is the color flip — that's when the customer "becomes profitable."

**Implementation:** 25 thin bars (one per year) along the bottom of Screen 3. `flex: 1` each, 2px gap, height proportional to cumulative savings (max 100% at year 25). Pre-payback: `gray-100`. Post-payback: `red-500`. Axis labels below show "An 1," "An {payback_year} (rentabilisé)," "An 25." Recharts stays in deps as a fallback if typography proves too fiddly to make responsive.

**Why:** Reads like a printed statement from a private bank, not a consumer dashboard. Reinforces "this is a financial document, not a sales pitch." The color flip at payback is a memorable visual moment — the screen does work the rep would otherwise have to do verbally.

---

## Components

### Buttons

```
PRIMARY:   bg=red-500  text=white  hover=red-600  active=red-700
           Rep mode:     padding 10×20  min-height 36  font-size 14
           Customer mode: padding 16×32  min-height 56  font-size 16
           border-radius 6px  font-weight 600

SECONDARY: bg=white  text=gray-700  border=gray-300  hover=gray-100
           Same dimensions as primary per mode

GHOST:     bg=transparent  text=gray-600  hover=gray-100
           No border. Tertiary actions only.

DANGER:    bg=red-600  text=white  hover=red-700
           Destructive actions (delete, deactivate). Always requires confirmation.
```

**Label rules:** Be specific. "Save Quote" not "Save". "Démo client" not "Présentation". "Choisir l'option Recommandé" not "Choisir" (customer mode — full sentence is clearer than abbreviation).

### Inputs & Selects

```css
border: 1px solid var(--gray-300);
border-radius: 6px;
padding: 10px 12px;
background: white;
font-size: 16px;

/* Focus */
border-color: var(--red-500);
outline: 2px solid var(--red-200);
outline-offset: 0;

/* Error */
border-color: var(--red-500);
background: var(--red-50);

/* Disabled */
background: var(--gray-100);
opacity: 0.6;
cursor: not-allowed;
```

Customer mode inputs: scale to 18px font, 14px padding. Rare — most customer screens are read-only.

### Price Summary Card (rep mode)

The most important component on the rep dashboard. Commands attention; communicates trust.

```
┌─────────────────────────────┐
│  Total Price                │  ← gray-500, text-sm, uppercase, tracking-wide
│  CHF 28'450.00              │  ← display font, gray-900, 56px, Geist Mono
│  Excl. VAT:  CHF 26'344     │  ← gray-600, text-sm, tabular-nums
│  VAT (8.1%): CHF 2'134      │
│  ─────────────────────      │
│  Margin:     28.5%  ●       │  ← green if ≥ floor, red if < floor
│  Valid until: 17.06.2026    │
└─────────────────────────────┘
border: 1px solid gray-200
border-left: 4px solid red-500   ← the ONE place this pattern is intentional
border-radius: 8px
padding: 24px
background: white
```

The colored left-border is normally an AI slop anti-pattern. Used **intentionally and only once** in the entire app, on the most important rep-side element. The exception that proves the rule.

### Tier Cards — Anti-Slop Discipline (customer mode, Screen 2)

Three cards in a row with a recommended emphasis IS the most recognizable AI slop pattern in B2B web design (the SaaS pricing grid: Starter / Pro / Enterprise with the middle one highlighted by gradient + glow + "Most Popular" badge + checkmark feature lists). Our `/present/` Screen 2 has the same shape (three tier cards) but must NOT read like SaaS pricing.

**What we DON'T do (banned):**
- ❌ No gradient highlight on the recommended card (gradients banned globally per AI Slop list)
- ❌ No checkmark feature lists ("✓ 20 panels, ✓ 5kWh battery, ✓ EV charger")
- ❌ No "Most Popular" / "Recommended" / "Best Value" floating badge
- ❌ No glowing border, no drop-shadow on hover (use the existing `2px shadow` token only)
- ❌ No icon at top-center of each card (no sun, no leaf, no checkmark, no nothing)
- ❌ No uniform card heights — do NOT use `grid-auto-rows: 1fr` to stretch shorter cards
- ❌ No comparison-table feel (no checkmarks/X's lining up across cards)
- ❌ No trial / discount / urgency copy ("Économisez 20% !" / "Offre limitée")
- ❌ No "Compare Plans" link or pricing toggle (monthly/annual)

**What we DO (specified):**
- ✅ 1.5px solid `red-500` border on the Recommandé card; the other two have 1px solid `gray-200`
- ✅ Faint linear gradient wash on Recommandé only: `linear-gradient(180deg, var(--white) 0%, var(--red-50) 200%)` — this is a permitted gradient because it's a subtle background wash, not a decorative vibrancy gradient
- ✅ Single `text-xs` uppercase eyebrow label per card ("ESSENTIEL" / "RECOMMANDÉ" / "PREMIUM"); color `gray-500` on the two non-recommended cards, `red-600` only on Recommandé
- ✅ Cards size to actual content (`align-items: start` not `stretch`); shorter rationale = shorter card
- ✅ 2-line max rationale via `line-clamp: 2`; no feature bullets, no comparison points
- ✅ Tier name (kWp size) in `text-lg` weight 600, gray-900
- ✅ Price in 22-28px Geist Mono weight 700 (intentionally smaller than the screen-3 hero number, intentionally larger than rep-mode card titles — visual middleweight)

**Test:** if you can swap "Essentiel / Recommandé / Premium" for "Starter / Pro / Enterprise" without the design feeling wrong, the anti-slop discipline has failed. The design must read as "three real solar configurations for THIS customer," not "three pricing tiers."

### Tier Cards (customer mode, Screen 2)

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ ESSENTIEL       │  │ RECOMMANDÉ      │  │ PREMIUM         │
│ 8 kWp           │  │ 9.8 kWp         │  │ 12 kWp          │
│ 16 panneaux     │  │ 20 panneaux+5kWh│  │ 24 panneaux+10  │
│                 │  │                 │  │                 │
│ 22'400          │  │ 28'450          │  │ 38'200          │
│                 │  │                 │  │                 │
│ Système         │  │ Système         │  │ Maximisation    │
│ abordable...    │  │ équilibré pour..│  │ autoconsom...   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
border: 1px solid gray-200    ← border-color: red-500 + border-width: 1.5px
border-radius: 6px               + background: linear-gradient(white→red-50)
                                 ← on the recommended card
```

- All three cards same width via CSS grid `repeat(3, 1fr)`.
- Recommended emphasis: `red-500` border at 1.5px + faint `red-50` gradient wash from top.
- Tier name (Essentiel/Recommandé/Premium): `text-xs` uppercase eyebrow.
- Price: 22-28px Geist Mono weight 700 (intentional: smaller than the screen-3 hero, larger than rep-mode card titles).
- Rationale: 10-12px gray-600, max 2 lines, line-clamp.

### Status Badges

```
DRAFT:    bg=gray-100  text=gray-600
SENT:     bg=blue-50   text=blue-700
ACCEPTED: bg=green-50  text=green-600
DECLINED: bg=red-50    text=red-700
EXPIRED:  bg=gray-100  text=gray-400  opacity: 0.7
```

Used in rep mode only. Customer mode never shows status badges (customer doesn't need to know the internal state).

---

## Navigation

### Sidebar (rep mode)

```css
background: white;
border-right: 1px solid var(--gray-200);
width: 224px;
padding: 16px 0;

/* Logo area */
padding: 20px 24px 24px;
border-bottom: 1px solid var(--gray-200);

/* Nav item */
padding: 8px 12px;
color: var(--gray-700);
font-size: 14px;
font-weight: 500;
border-radius: 6px;

/* Hover */
background: var(--gray-100);
color: var(--gray-900);

/* Active nav item */
background: var(--red-50);
color: var(--red-600);
border-left: 3px solid var(--red-500);
padding-left: calc(12px - 3px);  /* preserve 12px content alignment */
```

### Customer mode chrome

No sidebar. No page header. Just thin top + bottom bars.

**Top:**
```css
display: flex;
justify-content: space-between;
align-items: center;
padding: 16px 24px;
border-bottom: 1px solid var(--gray-100);
```

**Bottom (screen indicator):**
```css
display: flex;
justify-content: center;
gap: 8px;
padding: 12px 24px 16px;
border-top: 1px solid var(--gray-100);
```

Active dot: `red-500`, 24px wide × 8px tall, 4px radius. Inactive dots: `gray-300`, 8×8 circles. Each dot is tappable (≥44px tap area via padding) to jump screens.

---

## Motion — two modes

### Rep mode: minimal-functional

| Property | Duration | Easing |
|----------|----------|--------|
| Price updates (live) | 150ms | ease-out |
| Button hover/press | 100ms | ease-out |
| Sidebar item hover | 100ms | ease-out |
| Page transitions | 200ms | ease-in-out |
| Toast in | 200ms | ease-out (slide-up) |
| Toast out | 150ms | ease-in (fade) |
| Modal open | 200ms | ease-out (scale 0.97→1) |

### Customer mode: intentional

The live meeting is the moment of truth. Motion does presentational work — it's not just functional.

| Property | Duration | Easing | Detail |
|----------|----------|--------|--------|
| Screen swipe | 350ms | `cubic-bezier(0.32, 0.72, 0, 1)` | iOS-style rubber band |
| Tier card tap state | 120ms | ease-out | `transform: scale(1.015)` |
| Savings curve draw-in | 1200ms | ease-out | Stroke draws left-to-right on screen entry |
| Hero number count-up | 600ms | ease-out | Number counts from 0 to final value on screen entry |
| Map marker fade-in | 400ms | ease-out | Roof outline fades in 200ms after tile loads |

### Universal rules

- `prefers-reduced-motion: reduce` → all transitions become instant in BOTH modes
- Only animate `transform` and `opacity` — never width, height, layout properties
- No `transition: all` — list properties explicitly
- No bouncy / spring easings on text or numbers (jarring during live demo)

---

## AI Slop — Explicitly Forbidden

These patterns are banned across BOTH rep and customer modes. If a component library generates them by default, override or remove.

1. **3-column icon-in-circle feature grid** — most recognizable AI layout pattern
2. **Purple/violet/indigo gradients** — even though brand is red, no purple gradients
3. **Decorative SVG blobs, wavy dividers, floating circles** — empty section? Add content
4. **Centered everything** — left-align body text and descriptions; only center headlines and hero CTAs
5. **Uniform large border-radius** — radius hierarchy exists; use it
6. **Emoji in headings or as bullet points** — professional financial tool
7. **Generic microcopy** — no "Welcome to...", "Unlock the power of...", "Your all-in-one..."
8. **Stock illustration heroes** — for an internal tool, real data IS the visual; for customer mode, the customer's actual roof IS the visual
9. **`system-ui` or `-apple-system` as primary display/body font** — the "I gave up on typography" signal
10. **NEW: Stock photography of any kind on `/present/`** — no families, no homes, no panels, no installers. Customer's actual roof from swisstopo only.
11. **NEW: Yellow / orange / amber as primary or accent on `/present/`** — every solar competitor reaches for sun colors. We don't.
12. **NEW: Sunset gradients, sky photography, leaf illustrations** — eco-cliché, off-brand.

---

## Responsive

Phase 1 is laptop + tablet first. Mobile must not break.

### Rep mode

| Breakpoint | Width | Behavior |
|------------|-------|---------|
| Mobile | < 768px | Sidebar collapses to bottom nav (4 icons). Calculator single-column. |
| Tablet | 768–1024px | Sidebar collapses to icon-only (48px). Calculator 2-column. |
| Desktop | > 1024px | Full sidebar (224px). Calculator 2-column. |

### Customer mode

| Breakpoint | Width | Behavior |
|------------|-------|---------|
| Phone | < 600px | Single screen vertical, screen indicator stays. Tier cards stack vertically. |
| Tablet portrait | 600–900px | **Primary design target.** All screens optimized for this. |
| Tablet landscape | 900–1200px | Same as portrait but tier cards get more breathing room. |
| Desktop | > 1200px | Centered with max-width 1080px. Reps demoing from laptop or projector. |

### Browser matrix (customer mode)

- Safari iOS 16+ on iPad — primary
- Edge / Chrome on Surface — primary
- Chrome on Android tablet — secondary
- Firefox / IE — not supported

---

## Accessibility

- WCAG AA minimum for all text. Brand red `#d92127` on white passes AA (5.4:1).
- `focus-visible` ring on all interactive elements: `outline: 2px solid var(--red-500); outline-offset: 2px`.
- Never `outline: none` without a custom focus replacement.
- All form inputs have associated `<label>` (not just placeholder).
- Error messages use `role="alert"` and are announced to screen readers.
- Price summary updates use `aria-live="polite"` so screen readers announce changes.
- Customer mode body text: 18px floor accommodates 60-70 y/o readers with reading glasses without zoom.
- Customer mode tap targets: 56px minimum (Apple HIG comfortable target is 60×60; we go a hair under).

---

## Tone & Voice

**Languages:** French (primary), German (secondary). DE pass on `/present/` is gated on rep poll: do reps demo to German-speaking customers regularly?

**Voice rules (rep mode):**
- Direct and confident. "Enregistrer" not "Voulez-vous enregistrer ?"
- Specific button labels. "Enregistrer l'offre" not "Continuer".
- Error messages: what happened + what to do. "Marge sous le seuil minimum (20 %). Veuillez ajuster."

**Voice rules (customer mode):**
- Warm but precise. "Bonjour Müller" not "Hello User" or "Cher client".
- Customer-facing copy describes BENEFITS in customer-relevant terms ("Vous économiserez 2'760 CHF par an") not internal terms ("annualSavingsRappen").
- Numbers are in Swiss format: `CHF 25'400.00`, `28.5 %` (space before percent in French).
- Never use jargon: no "kWp" without unit explanation, no "tier IDs", no internal product codes.
- Customer never sees: margin %, cost basis, scenario IDs, settings keys, rep email.

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-03-17 | Geist over Inter for typography | Avoids generic dashboard look; better number metrics |
| 2026-03-17 | Warm gray neutrals | Harmonizes with red-500 primary; cold grays fight the brand |
| 2026-03-17 | Single colored left-border on price summary only | Intentional exception to anti-pattern rule; highest-value rep element |
| 2026-03-17 | Integer Rappen + Intl.NumberFormat('de-CH') | Swiss apostrophe thousands separator; zero float drift |
| 2026-03-17 | Desktop-first, mobile-must-not-break | Primary use case is laptop/tablet; mobile fallback required |
| 2026-03-17 | Red-500 doubles as error color | Keeps palette tight; distinguished by context (bg + text treatment) |
| 2026-05-02 | Light sidebar (white) replaces dark `gray-900` | Dark slab dominated visual weight; light sidebar matches PDF Variant D aesthetic, lets content breathe |
| 2026-05-02 | KPI top-stroke demoted from red-500 to gray-200 | Red is for the *one* most important element; 4+ red KPI strokes diluted the rule |
| 2026-05-02 | Page header "rule" changed from 12px×2px red stub to full-width 1px gray hairline | Stub read as residue; hairline acts as quiet content divider |
| 2026-05-05 | Unified design system covering rep + customer modes | `/office-hours` design doc identified customer-facing meeting mode (`/present/[quoteId]`) as next major surface; needed unified system to govern both. Memorable thing: Swiss-engineered precision instrument. |
| 2026-05-05 | Reference posture: UBS Private Banking on tablet, NOT Sunrun marketing | Solar category visual language is uniformly warm/consumer (yellow + sunset + family). Swiss customers buy on smart not warm. /present/ should mimic private banking tablet UX. |
| 2026-05-05 | No new colors added for customer mode | Restraint is the differentiator. Every competitor adds yellow/navy/sunset gradients. We don't. |
| 2026-05-05 | Customer mode body 18px floor (vs 16px rep mode) | Reading-glasses comfort for 60-70 y/o customers in live meeting. WCAG AA at this size. |
| 2026-05-05 | Customer mode display scale 96-128px (vs 56px rep mode) | Hero number IS the answer the customer came for. UBS Wealth renders large; consumer solar tools render medium because they're afraid of the number. |
| 2026-05-05 | Customer mode tap targets ≥56px (vs ≥44px rep mode) | Older customers may struggle with smaller targets; tablet usage during live meeting prioritizes comfortable taps over information density |
| 2026-05-05 | No stock photography on /present/ — customer's actual roof from swisstopo only | Differentiation. Every competitor uses family-on-couch shots. Customer's actual house is uniquely persuasive AND on-brand for "precision instrument" |
| 2026-05-05 | Typographic savings chart (bars flip from gray to red at payback year) | Reads like printed bank statement, not consumer dashboard. The color flip is a memorable moment. Recharts stays in deps as fallback. |
| 2026-05-05 | Customer mode motion is intentional (vs minimal-functional rep mode) | Live meeting is moment of truth. Screen swipe rubber-band, hero number count-up, savings curve draw-in. All disabled by prefers-reduced-motion. |
