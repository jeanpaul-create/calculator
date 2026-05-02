import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { z } from 'zod'

const StatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'DECLINED', 'EXPIRED']),
})

type Params = { params: { id: string } }

// PATCH /api/quotes/[id]/status — manually update quote status
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { repId: true, status: true },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    const body = await req.json()
    const { status } = StatusSchema.parse(body)

    // Stamp sentAt on first SENT transition; otherwise leave timestamps alone.
    // status enum currently doesn't include SENT here, but kept defensive in case it widens.
    const data: { status: typeof status; updatedAt: Date; sentAt?: Date; expiresAt?: Date } = {
      status,
      updatedAt: new Date(),
    }
    if ((status as string) === 'SENT' && quote.status === 'DRAFT') {
      const sentAt = new Date()
      data.sentAt = sentAt
      data.expiresAt = new Date(sentAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    }

    const updated = await prisma.quote.update({
      where: { id: params.id },
      data,
      select: { id: true, status: true },
    })

    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[PATCH /api/quotes/[id]/status]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
