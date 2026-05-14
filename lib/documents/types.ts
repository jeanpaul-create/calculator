/**
 * Documents framework — types.
 *
 * v1 ships with one document (Vaud annonce PAC v10) on top of the existing
 * DocumentsTab + DocRow pattern in components/quotes/QuoteDetailView.tsx.
 * The framework is intentionally thin: each document is a fill function +
 * a registry entry. No template engine, no generic data binding — just
 * direct field-name → quote-data mapping. When document #2 ships, look at
 * what differs and extract abstractions then.
 *
 *   Architecture (ASCII):
 *
 *     /quotes/[id] (Documents tab)
 *           │
 *           └─► <DocRow href={`/api/quotes/${id}/documents/{slug}`} />
 *                     │
 *                     ▼
 *           GET /api/quotes/[id]/documents/[slug]/route.ts
 *                     │
 *                     ├─► auth check (owner-or-admin)
 *                     ├─► getFullQuoteForPdf(id)
 *                     ├─► registry.get(slug).fill(quote)  ← per-doc filler
 *                     │         │
 *                     │         ├─► load template PDF (vendored)
 *                     │         ├─► [optional] qpdf-wasm preprocess
 *                     │         ├─► pdf-lib fill named fields
 *                     │         └─► return Uint8Array
 *                     │
 *                     └─► Response(buffer, application/pdf)
 */

import type { FullQuote } from '@/lib/quote-pdf'

export interface DocumentTemplate {
  /** URL slug (also the route segment) */
  slug: string
  /** Display title in the DocumentsTab DocRow */
  title: string
  /** One-line description shown under the title */
  description: string
  /** Icon hint (single unicode glyph) */
  icon: string
  /**
   * Predicate — does this document apply to this quote? (e.g. "only if
   * any scenario is PAC type"). Returns false hides the DocRow entirely.
   */
  appliesTo: (quote: FullQuote) => boolean
  /**
   * Fill the document's template with quote data. Returns the filled PDF
   * (or xlsx buffer for spreadsheet templates) ready for HTTP response.
   */
  fill: (quote: FullQuote) => Promise<{ buffer: Uint8Array; filename: string; contentType: string }>
}
