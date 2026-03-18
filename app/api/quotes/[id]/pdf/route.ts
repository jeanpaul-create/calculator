import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { getFullQuoteForPdf, buildPricedScenarios } from '@/lib/quote-pdf'
import { prisma } from '@/lib/db'
import QuotePdf from '@/components/pdf/QuotePdf'

type Params = { params: { id: string } }

// GET /api/quotes/[id]/pdf — stream PDF, mark quote SENT
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const quote = await getFullQuoteForPdf(params.id)

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    const scenarios = await buildPricedScenarios(quote)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote, scenarios }) as any
    )

    // Fire-and-forget status update — don't block the PDF stream
    prisma.quote
      .update({
        where: { id: params.id, status: 'DRAFT' },
        data: { status: 'SENT' },
      })
      .catch((err) => console.error('[pdf/route] status update failed', err))

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${quote.quoteNumber}.pdf"`,
        'Content-Length': String(buffer.length),
      },
    })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/quotes/[id]/pdf]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
