# TODOS

## PDF / Quote Workflow


## Design / UX

**Mobile navigation: hamburger menu for small screens**
**Priority:** P3
**What:** Add a hamburger button (e.g. in a top bar on mobile) that toggles sidebar visibility on screens < 768px.
**Why:** After FINDING-001 fix, the sidebar is now `hidden md:flex` — mobile users can see content but have no way to navigate between pages.
**Pros:** Completes mobile UX; very common pattern.
**Cons:** Requires a thin `<header>` bar on mobile to hold the button, adding a layout layer.
**Context:** Found by /design-review on 2026-03-24. The sidebar (`components/layout/Sidebar.tsx`) is already self-contained. `AppShell.tsx` would need a `useState` toggle and a mobile header row. No backend work needed.
**Effort:** S

---

**Cookie-based language for server components**
**Priority:** P3
**What:** Store the active language in a cookie (in addition to localStorage) so Next.js server components can read it via `cookies()` and render in the correct language.
**Why:** Server-rendered pages (quotes list, quote detail, status badge) currently can't access the client-side `LanguageContext`. They were fixed to French in this PR, but switching to DE will not affect those strings.
**Pros:** True bilingual app — all strings respond to language toggle.
**Cons:** Requires reading the cookie server-side (minor architecture change to `LanguageContext` and page components).
**Context:** Found by /design-review on 2026-03-24. Fixed as FINDING-002 by hardcoding French. The i18n translations already exist in `lib/i18n.ts` for both FR and DE. Need to set `lang` cookie on `setLang()` in `LanguageContext.tsx`, then read via `cookies()` in server components.
**Effort:** M

## Performance / Infrastructure

**Cache PVGIS solar yield API responses**
**Priority:** P3
**What:** Cache responses from the PVGIS EU API in `fetchPvgisYield()` (keyed by lat/lon rounded to 2 decimal places), using Next.js `unstable_cache` or a `PvgisCache` DB table with a long TTL.
**Why:** PVGIS data is historical irradiance — it doesn't change. Every calculator interaction currently hits the live API with a 6-second timeout. Under flaky connectivity this stalls the save flow.
**Pros:** Eliminates redundant API calls; makes the calculator feel instant on repeat locations; reduces PVGIS API load.
**Cons:** Adds a caching layer to manage; minor stale-data risk if PVGIS dataset is re-published (rare, ~annually).
**Context:** Found by /plan-eng-review on 2026-03-24. `fetchPvgisYield()` is in `app/api/site-info/route.ts`. At current B2B usage volume this isn't causing pain, but worth addressing before scaling to more reps.
**Effort:** S

---

## Completed

**App sidebar: replace SVG placeholder with I.ON Energy logo**
**Completed:** 2026-03-24 — SVG icon + "I.ON Energy" text replaced with `<Image src="/logo.png">` in `Sidebar.tsx` using Next.js `next/image`.

**PDF: Add I.ON Energy logo to PDF header**
**Completed:** 2026-03-24 — Logo added to `public/logo.png`, `QuotePdf.tsx` updated to use `<Image>` in the dark header band.

**Quote status management UI on detail page**
**Completed:** 2026-03-24 — `QuoteStatusActions` client component added to `/quotes/[id]`. Buttons appear when status is SENT: ✓ Accepté, ✗ Refusé, ⏱ Expiré. Each requires inline confirmation. `PATCH /api/quotes/[id]/status` route created.
