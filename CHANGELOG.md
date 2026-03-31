# Changelog

All notable changes to this project will be documented in this file.

## [0.1.6.0] - 2026-03-31

### Added
- **Mobile hamburger navigation** — dark top bar with ☰ button appears on screens < 768px; tapping it slides in a full-width sidebar drawer with overlay dismiss; `AppShell.tsx` manages `mobileOpen` state
- **Tablet icon-only sidebar** — at 768–1023px the sidebar collapses to 48px wide showing only icons with `title` tooltips; text labels use `md:hidden lg:inline` so they return at desktop widths

### Changed
- **Active nav item** now uses brand-red accent (`bg-red-500/10` + `border-l-[3px] border-l-red-500`) instead of generic `bg-gray-700`; matches DESIGN.md spec
- **PriceSummaryCard** gains `border-l-4 border-l-red-500` left accent border — visual anchor matching the design system's intentional red accent treatment
- **Price total display size** increased from `text-3xl` (30 px) to `text-5xl` (48 px) with `leading-none` — closer to the DESIGN.md display-scale spec for the hero price figure
- **Calculator form layout** — outer flex container changes to `flex-col lg:flex-row` so form and price card stack vertically on mobile/tablet; project info and installation config grids change to `grid-cols-1 sm:grid-cols-2` with `sm:col-span-2` on Notes

### Fixed
- Calculator price card no longer overflows or compresses on mobile viewports (was always `flex` side-by-side regardless of screen width)
- Mobile users blocked from navigation — resolved by hamburger drawer (was `hidden md:flex` with no fallback)

## [0.1.5.0] - 2026-03-24

### Added
- **I.ON Energy logo in PDF header** — company logo replaces bold-text placeholder in the dark header band of all generated PDFs
- **I.ON Energy logo in sidebar** — actual logo image replaces the SVG placeholder icon + text in the app navigation sidebar
- **Quote status management UI** — detail page now shows Accepté / Refusé / Expiré action buttons when a quote is in SENT status; each requires inline confirmation before applying; powered by new `PATCH /api/quotes/[id]/status` route
- **`buildIonCoefficientsFromSettings()` utility** — extracted DRY helper in `lib/pricing.ts` consolidating the 22-key settings→IonPricingCoefficients mapping from 3 duplicate call sites
- **Pricing unit tests** — 27 new test cases covering `calculateIonPrice`, `calculatePronovoSubsidy`, `estimateTaxSavings`, and `buildIonCoefficientsFromSettings` (51 tests total)

### Changed
- Sidebar hidden on mobile (`hidden md:flex`) — content remains accessible without navigation bar on small screens
- Quotes list and status badge hardcoded to French (server components cannot read client-side language context)
- `lib/quote-pdf.ts` and `app/(app)/calculator/page.tsx` updated to use shared `buildIonCoefficientsFromSettings()`

### Fixed
- Removed dead `marginBasisPts` field from `SaveScenarioSchema` — margin is always server-authoritative, was validated but never used

## [0.1.3.0] - 2026-03-24

### Added
- **Address-driven electricity rate + solar yield** — selecting an address via autocomplete now automatically fetches the ElCom H4 tariff (ct/kWh) and PVGIS annual yield (kWh/kWp/year) for that location, displayed inline below the address field; no separate NPA field needed
- **`/api/site-info` proxy route** — server-side endpoint (`GET /api/site-info?zip=XXXX&lat=Y&lon=Z`) that fetches ElCom tariff and PVGIS yield in parallel with proper `Referer`/`Origin` headers required by the ElCom API
- **NPA extraction from address autocomplete** — `AddressSearch` now parses the Swiss postal code from the swisstopo label (e.g. `<b>1185 Mont-sur-Rolle</b>`) and passes it to the selection handler

### Fixed
- **ElCom API returning empty results** — added required `Referer: https://www.prix-electricite.elcom.admin.ch/` and `Origin` headers to all ElCom GraphQL requests; the API silently returns empty data without these headers

### Changed
- ROI and annual yield calculations now use the live address-derived rate and yield, falling back to server-side props (quote restoration via `?zip=` param)
- `yieldKwhPerKwp` in saved quote scenarios now reflects the address-derived PVGIS value when available

## [0.1.2.0] - 2026-03-19

### Added
- **PDF quote generation** — `GET /api/quotes/[id]/pdf` streams a branded A4 PDF; includes customer info, product list per scenario, pricing (HT/TVA/TTC), and ROI section (payback years, annual savings, annual kWh yield)
- **Email send** — `POST /api/quotes/[id]/send` generates PDF and delivers it via Resend to the customer's email address; requires `RESEND_API_KEY` + `RESEND_FROM_EMAIL` env vars
- **Quote detail page** — `/quotes/[id]` shows customer info, scenario summaries with TTC price, PDF download link, and email send button; fixes the broken quote-number link on the quotes list
- **Multi-scenario PDF** — multiple scenarios render as sequential page-break sections with "Option N" badges
- **ROI section in PDF** — shows estimated annual yield (kWh), annual savings (CHF), and payback period; displays "Données insuffisantes" when ZIP/rate is unavailable
- **Price snapshot** — `QuoteScenario` now stores `sellingPriceExVatRappen` and `sellingPriceIncVatRappen` at save time; PDF re-generation always shows the originally quoted price even if admin changes pricing coefficients later; old quotes (NULL) fall back to live computation
- **TODOS.md** — added project TODO tracking for logo integration and status management UI

### Changed
- `PUT /api/quotes/[id]` response now includes `sellingPriceExVatRappen` and `sellingPriceIncVatRappen`

## [0.1.1.0] - 2026-03-18

### Added
- **Language switching (FR/DE)** — FR/DE toggle in sidebar; all UI strings translated via `lib/i18n.ts`; language persisted in localStorage; default French (company is French-Swiss)
- **Save button in calculator** — "Enregistrer comme offre" button creates a new quote automatically when no `quoteId` is present, then redirects to the linked calculator view
- **Admin catalog CRUD** — full inline edit, activate/deactivate toggle, delete with confirmation, and add-new forms for products and cost options; powered by `components/admin/CatalogManager.tsx`
- **Real product catalog** — 43 products from I.ON Energy Services (Jinko, LONGi, Aiko panels; Huawei & Fronius inverters; Huawei LUNA & Fronius Reserva batteries; accessories; EV chargers)
- **EV charger category** — new `EV_CHARGER` enum value in `ProductCategory`; translations in FR/DE

### Changed
- UI language switched from German to French throughout (labels, placeholders, page titles, locale formatting `fr-CH`)
- Admin catalog page converted from read-only server component to interactive client component
- Sidebar renamed from "Solar-Kalkulator" to "I.ON Energy"; navigation labels now translated
- `?all=1` param on `/api/catalog/products` and `/api/catalog/options` returns inactive items for admin use
- Seed data completely replaced with real I.ON Energy price list (v2.1, 2026); cost options in French

## [0.1.0.2] - 2026-03-18

### Fixed
- Added `/admin` index page — admins now redirect to `/admin/catalog`, reps redirect to `/calculator` (previously returned 404)
- Relaxed `productId`/`optionId` validation from `.cuid()` to `.min(1)` in `PUT /api/quotes/[id]` to support seed data string IDs
- Removed temporary debug endpoint `GET /api/debug` that exposed environment variable presence

## [0.1.0.1] - 2026-03-18

### Fixed
- Removed broken `token?.role` check in middleware that blocked admins from `/admin` routes (database sessions don't carry role on JWT token — server-side page guards handle this correctly)
- Wrapped `deleteMany` + `create` in `prisma.$transaction()` in `PUT /api/quotes/[id]` to prevent quote losing its scenario if create fails
- Eliminated redundant second `findUnique` call in PUT handler — `customerZip` now fetched in the initial query
- Removed dead `<form>` wrapper around `NewQuoteButton` in quotes list page
- Removed unused `useEffect` import in `CalculatorForm.tsx`
- Excluded `.claude/` directory from Vitest test discovery to prevent gstack internal tests (which use `bun:test`) from running

## [0.1.0.0] - 2026-03-17

### Added
- Solar Sales Calculator — Phase 1 MVP
- Prisma schema with Quote, QuoteScenario, Product, CostOption, SwissRate, Setting models
- NextAuth credentials-based authentication with REP and ADMIN roles
- Calculator UI with live price computation, product selection by category, cost options, margin input
- Quote management: create, list, save scenario with cost snapshots
- Swiss electricity rate lookup by ZIP prefix for ROI calculation
- Pure pricing module with margin, VAT, ROI, and yield calculations (24 unit tests)
- Admin catalog management and VAT/min-margin settings
- Human-readable quote numbers (QUO-YYYY-NNNN) via Postgres sequence
- Seed data: 11 products, 9 cost options, 50 Swiss electricity rates, admin/rep demo users
- Tailwind CSS design system (brand red #d92127, Geist fonts, warm grays)
