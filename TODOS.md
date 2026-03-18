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

## Completed

<!-- Items completed in future PRs will be moved here -->
