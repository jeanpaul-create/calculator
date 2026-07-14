import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/customers/search?q=du — typeahead for the calculator customer
// fields. Matches name or email (case-insensitive), most recently active
// first. Returning customers stop being retyped from scratch.
export async function GET(req: NextRequest) {
  try {
    await requireAuth()
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim()
    if (q.length < 2) return NextResponse.json({ customers: [] })

    const customers = await prisma.customer.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      orderBy: { updatedAt: 'desc' },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        zip: true,
        canton: true,
        _count: { select: { quotes: true } },
      },
    })

    return NextResponse.json({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        phone: c.phone,
        zip: c.zip,
        canton: c.canton,
        quoteCount: c._count.quotes,
      })),
    })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
