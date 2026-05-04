/**
 * GET /api/public/quotes/[id]/pdf
 *
 * Public PDF download — keyed on `shareToken`, not Quote.id. Mirrors the
 * auth-gated /api/quotes/[id]/pdf route but without the requireOwnerOrAdmin
 * gate, since the shareToken IS the access credential.
 *
 * Visibility rules (mirroring the public page at /q/[shareToken]):
 *   DRAFT  → 404 (not yet shared)
 *   SENT / ACCEPTED / DECLINED / EXPIRED → PDF streamed
 *
 * Unlike the auth-gated PDF route, this endpoint NEVER mutates the quote
 * (no auto-SENT transition). The customer downloading the PDF is a
 * read-only action.
 */

import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { prisma } from '@/lib/db'
import { buildPricedScenarios, fetchMapImageBase64 } from '@/lib/quote-pdf'
import QuotePdf from '@/components/pdf/QuotePdf'

type Params = { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  // Param name is `id` for path-folder reasons; the value is a shareToken.
  const token = params.id

  try {
    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      include: {
        rep: { select: { name: true, email: true } },
        scenarios: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: { include: { product: true } },
            options: { include: { option: true } },
          },
        },
      },
    })

    // DRAFT or unknown token → 404. Don't leak whether the quote exists.
    if (!quote || quote.status === 'DRAFT') {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    const scenarios = await buildPricedScenarios(quote)

    const mapImageDataUrl =
      quote.mapLat != null && quote.mapLon != null
        ? await fetchMapImageBase64(quote.mapLat, quote.mapLon, quote.mapZoom ?? 17)
        : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote, scenarios, mapImageDataUrl }) as any
    )

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    console.error('[GET /api/public/quotes/[id]/pdf]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
