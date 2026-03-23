import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'
import { generateQuoteNumber } from '@/lib/quote-number'
import { z } from 'zod'

const CreateQuoteSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerEmail: z.string().email().optional(),
  customerPhone: z.string().optional(),
  customerZip: z.string().min(4).max(4).optional(),
  siteAddress: z.string().optional(),
  notes: z.string().optional(),
  mapLat: z.number().optional(),
  mapLon: z.number().optional(),
  mapZoom: z.number().int().optional(),
})

// GET /api/quotes — list quotes for the current rep (all for admin)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const isAdmin = session.user.role === 'ADMIN'

    const quotes = await prisma.quote.findMany({
      where: isAdmin ? undefined : { repId: session.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        quoteNumber: true,
        status: true,
        customerName: true,
        customerZip: true,
        customerCanton: true,
        createdAt: true,
        rep: { select: { name: true, email: true } },
        scenarios: {
          select: { id: true, name: true },
          take: 1,
        },
      },
    })

    return NextResponse.json(quotes)
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/quotes]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/quotes — create a new draft quote
export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()
    const body = await req.json()
    const data = CreateQuoteSchema.parse(body)

    // Resolve canton from ZIP if provided
    let customerCanton: string | undefined
    if (data.customerZip) {
      const zipPrefix = data.customerZip.slice(0, 2)
      const rate = await prisma.swissRate.findFirst({
        where: { zipPrefix },
        select: { canton: true },
      })
      customerCanton = rate?.canton
    }

    const quoteNumber = await generateQuoteNumber()

    const quote = await prisma.quote.create({
      data: {
        quoteNumber,
        repId: session.user.id,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        customerZip: data.customerZip,
        customerCanton,
        siteAddress: data.siteAddress,
        notes: data.notes,
        mapLat: data.mapLat,
        mapLon: data.mapLon,
        mapZoom: data.mapZoom,
      },
    })

    return NextResponse.json(quote, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/quotes]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
