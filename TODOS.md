# TODOS

## PDF / Quote Workflow

**PDF: Add I.ON Energy logo to PDF header**
**Priority:** P2
**What:** Add `public/logo.png`, update `components/pdf/QuotePdf.tsx` to use `<Image>` in the header instead of the current bold-text "I.ON Energy Services" placeholder.
**Why:** More professional PDF appearance for customer-facing documents.
**Pros:** Strengthens brand identity in the most customer-visible output.
**Cons:** Requires the actual logo asset (PNG/SVG) — can't ship without it.
**Context:** The PDF feature shipped in v0.1.2.0. `QuotePdf.tsx` uses `@react-pdf/renderer`'s `<Image src={...}>` component. The image must be accessible at a URL or bundled as a base64 string. See `components/pdf/QuotePdf.tsx` header section.
**Effort:** S | **Depends on:** Having the logo file

---

**Quote status management UI on detail page**
**Priority:** P2
**What:** Action buttons on `/quotes/[id]` to let the rep manually update status: SENT → ACCEPTED / DECLINED / EXPIRED. New `PATCH /api/quotes/[id]/status` route.
**Why:** Closes the sales tracking loop. Right now status auto-updates DRAFT → SENT on PDF download, but there's no way to mark a quote as won or lost.
**Pros:** Gives reps a lightweight CRM-like tracking signal. Admin can see win/loss rates.
**Cons:** Small scope creep; needs confirmation dialogs for irreversible status changes.
**Context:** `QuoteStatus` enum in Prisma schema already has DRAFT, SENT, ACCEPTED, DECLINED, EXPIRED. The detail page (`app/(app)/quotes/[id]/page.tsx`) is the right place for these buttons. The quotes list page already shows `QuoteStatusBadge`.
**Effort:** S

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

## Completed

<!-- Items completed in future PRs will be moved here -->
