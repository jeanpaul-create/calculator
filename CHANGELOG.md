# Changelog

All notable changes to this project will be documented in this file.

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
