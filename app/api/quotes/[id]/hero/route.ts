import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { z } from 'zod'

const HeroSchema = z.object({
  // null clears the pick → /present falls back to the automatic hero
  // (recommandé → premium → first).
  scenarioId: z.string().min(1).nullable(),
})

type Params = { params: { id: string } }

// PATCH /api/quotes/[id]/hero — set/clear the rep-chosen hero scenario used
// by /present Screens 3+4.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { repId: true, scenarios: { select: { id: true } } },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    const body = await req.json()
    const { scenarioId } = HeroSchema.parse(body)

    // The pick must reference one of THIS quote's scenarios.
    if (scenarioId != null && !quote.scenarios.some((s) => s.id === scenarioId)) {
      return NextResponse.json(
        { error: 'Scenario does not belong to this quote' },
        { status: 422 }
      )
    }

    const updated = await prisma.quote.update({
      where: { id: params.id },
      data: { heroScenarioId: scenarioId },
      select: { id: true, heroScenarioId: true },
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
