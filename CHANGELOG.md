# Changelog

All notable changes to this project will be documented in this file.

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
