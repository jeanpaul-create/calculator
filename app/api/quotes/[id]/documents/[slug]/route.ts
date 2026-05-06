/**
 * GET /api/quotes/[id]/documents/[slug]
 *
 * Generic document download endpoint — looks up the requested document in
 * the registry, fills it with quote data, and streams the result back.
 *
 * Auth: same pattern as /api/quotes/[id]/pdf — requireOwnerOrAdmin throws
 * a Response on failure (works inside Route Handlers; do NOT mirror this
 * pattern in Server Components — see /present/[id]/page.tsx for the
 * Server-Component-safe equivalent).
 *
 * Slugs handled:
 *   annonce-pac → Vaud Formulaire d'annonce PAC v10
 *
 * Future slugs (not yet registered): en-vd-3, en-vd-72, formulaire-p,
 * formulaire-75, plan-de-situation, attestation-bruit
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { getFullQuoteForPdf } from '@/lib/quote-pdf'
import { getDocumentBySlug } from '@/lib/documents/registry'

type Params = { params: { id: string; slug: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const quote = await getFullQuoteForPdf(params.id)
    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await requireOwnerOrAdmin(quote.repId)

    const template = getDocumentBySlug(params.slug)
    if (!template) {
      return NextResponse.json({ error: `Unknown document: ${params.slug}` }, { status: 404 })
    }

    if (!template.appliesTo(quote)) {
      return NextResponse.json(
        { error: `Document ${params.slug} does not apply to this quote` },
        { status: 400 }
      )
    }

    const { buffer, filename, contentType } = await template.fill(quote)

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(buffer.byteLength),
      },
    })
  } catch (e) {
    if (e instanceof Response) return e
    console.error(`[api/quotes/${params.id}/documents/${params.slug}] error:`, e)
    return NextResponse.json({ error: 'Document generation failed' }, { status: 500 })
  }
}
