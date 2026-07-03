import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { z } from 'zod'

const FollowUpSchema = z.object({
  // ISO date (yyyy-mm-dd) or null to clear the reminder.
  followUpAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
})

type Params = { params: { id: string } }

// PATCH /api/quotes/[id]/follow-up — set/clear the rep's follow-up reminder.
// Due reminders surface at the top of the dashboard « Relances à faire ».
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { repId: true },
    })
    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    await requireOwnerOrAdmin(quote.repId)

    const body = await req.json()
    const { followUpAt } = FollowUpSchema.parse(body)

    const updated = await prisma.quote.update({
      where: { id: params.id },
      data: { followUpAt: followUpAt ? new Date(`${followUpAt}T09:00:00`) : null },
      select: { id: true, followUpAt: true },
    })
    return NextResponse.json(updated)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
