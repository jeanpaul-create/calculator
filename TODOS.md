# TODOS

## PAC / Heat Pump Calculator

**CECB/OFEN Heat Pump Subsidy Rates**
**Priority:** P1 — blocks the subsidy feature
**What:** Research all 26 Swiss cantonal rates for CECB/OFEN heat pump replacement subsidies and hardcode into `calculateHeatPumpSubsidy(canton)` in `lib/pricing.ts`. Document the source URL and an annual update procedure.
**Why:** Without this the function returns 0 for all cantons, making the subsidy display useless. Swiss cantons pay CHF 3–8k for oil-to-heat-pump replacements — a key deal-closer.
**Pros:** Closes the "what's my net cost?" objection; mirrors existing Pronovo subsidy for PV.
**Cons:** Rates change annually; requires a yearly update pass each January.
**Context:** Found by /plan-ceo-review on 2026-03-30. Reference sources: EnergieSchweiz (energieschweiz.ch), cantonal energy agencies. Start with the 10 most common cantons (VD, GE, ZH, BE, AG, BS, BL, SO, FR, VS).
**Effort:** S
**Depends on:** PAC calculator PR (schema + function skeleton)

---

**Admin UI for PAC Pricing Coefficients**
**Priority:** P2
**What:** Add PAC coefficient fields to the admin settings page (pac_accessories_bps, pac_frais_supp_bps, pac_transport_bps, pac_pm_bps, pac_admin_bps, pac_sales_overhead_bps, pac_profit_appro_bps, pac_profit_constr_bps).
**Why:** Without this, I.ON can only adjust PAC margins via a code deploy. The PV coefficients already have admin UI — PAC should match.
**Pros:** Operations can tune margins without developer involvement; mirrors existing PV pattern.
**Cons:** None meaningful — it's a straightforward form extension.
**Context:** Found by /plan-eng-review on 2026-03-30. The admin settings page already renders PV coefficient inputs. PAC keys follow the same `pac_*_bps` / `pac_*_rappen` naming convention. `buildPacCoefficientsFromSettings()` and `PAC_SETTING_KEYS` (new export from `lib/pricing.ts`) are the integration points.
**Effort:** S
**Depends on:** PAC calculator PR

---

**PAC Product DB Seed Script**
**Priority:** P1 — blocks shipping
**What:** Write `scripts/seed-pac-products.ts` that reads `Sales List-PAC-2026.xlsx` and inserts all heat pump products into the Product table with correct `category`, `costRappen`, and `laborRappen`.
**Why:** Manual entry of 30+ products (BUDERUS, VAILLANT, accessories, oil tanks) via the admin UI is error-prone. The Excel is the authoritative price source.
**Pros:** Reproducible, tied to Excel source, runnable on any environment.
**Cons:** If Excel prices change, the script must be re-run (or build an import UI later).
**Context:** Found by /plan-ceo-review on 2026-03-30. The Excel at `Sales List-PAC-2026.xlsx` has sheets: `Data` (products + coefficients) and `Sales List PAC` (example quote). Use `xlsx` npm package (already in node_modules via Next.js). Run via `npx tsx scripts/seed-pac-products.ts`.
**Effort:** S
**Depends on:** PAC calculator PR (schema migration with new ProductCategory enum values)

---

**Combined PV+PAC Shared Electricity ROI (Phase 2)**
**Priority:** P2
**What:** Model heat pump electricity consumption (kWh/year = heating load / COP) as a self-consumption load on the PV system, then recalculate PV ROI with reduced grid exports and reduced heat pump grid draw.
**Why:** The combined pitch "your solar panels power your heat pump for near-zero running cost" is far more compelling than simply summing two separate ROI calculations. This is the killer sales argument for combined PV+PAC installs.
**Pros:** Differentiating; accurate energy model; closes combined installs faster.
**Cons:** Requires COP input per heat pump model (A-7/W35 benchmark available from manufacturer datasheets); more complex `calculateCombinedRoi()` function.
**Context:** Found by /plan-ceo-review on 2026-03-30. Phase 1 (this PR) shows combined total investment and a simple sum of PV savings + PAC savings. Phase 2 adds the shared electricity model. COP values for BUDERUS WLW176i range from 2.8–3.5. Formula: PAC electricity draw = annual_heat_kWh / COP; new PV self-consumption rate accounts for PAC load.
**Effort:** M
**Depends on:** PAC calculator PR + Combined quote mode

---

## PDF / Quote Workflow


## Design / UX

**Mobile navigation: hamburger menu for small screens**
~~**Priority:** P3~~
**Completed:** 2026-03-31 — Fixed by /design-review (FINDING-004). `AppShell.tsx` now manages `mobileOpen` state with a dark mobile top bar (hamburger ☰, brand mark, "I.ON Energy" text). `Sidebar.tsx` refactored to `fixed md:relative`, icon-only 48px at tablet (`md:w-12`), full 224px at desktop (`lg:w-56`). Text labels use `md:hidden lg:inline` breakpoints.

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
