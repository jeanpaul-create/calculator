/**
 * Documents registry — central list of available document templates.
 *
 * v1 ships with one entry. Adding document #N is a single import + push:
 *   1. Add a filler to lib/documents/fillers/<slug>.ts
 *   2. Import + register here
 *   3. The DocumentsTab UI picks it up automatically via getDocumentsForQuote()
 *
 * No registration-time validation — the DocumentTemplate type guards shape.
 */

import { annoncePacV10 } from './fillers/annonce-pac'
import { planDeSituation } from './fillers/plan-de-situation'
import { attestationBruit } from './fillers/attestation-bruit'
import type { DocumentTemplate } from './types'
import type { FullQuote } from '@/lib/quote-pdf'

const REGISTRY: DocumentTemplate[] = [
  annoncePacV10,
  planDeSituation,
  attestationBruit,
  // Future (Phase 1+): en-vd-3, en-vd-72 (xlsx), formulaire-p, formulaire-75
]

/** All documents that apply to this quote (filtered by per-doc predicate) */
export function getDocumentsForQuote(quote: FullQuote): DocumentTemplate[] {
  return REGISTRY.filter((d) => d.appliesTo(quote))
}

/** Look up a document template by its slug (used by the API route) */
export function getDocumentBySlug(slug: string): DocumentTemplate | null {
  return REGISTRY.find((d) => d.slug === slug) ?? null
}
