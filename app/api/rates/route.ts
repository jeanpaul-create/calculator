import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth } from '@/lib/auth'

// GET /api/rates?zip=8001 — look up electricity rate by ZIP
export async function GET(req: NextRequest) {
  try {
    await requireAuth()

    const zip = req.nextUrl.searchParams.get('zip')
    if (!zip || zip.length < 4) {
      return NextResponse.json({ error: 'zip parameter required (4 digits)' }, { status: 400 })
    }

    const zipPrefix = zip.slice(0, 2)
    const rate = await prisma.swissRate.findFirst({
      where: { zipPrefix },
      select: { canton: true, rateRappenPerKwh: true },
    })

    if (!rate) {
      return NextResponse.json({ error: 'Rate not found for this ZIP' }, { status: 404 })
    }

    return NextResponse.json(rate)
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/rates]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
