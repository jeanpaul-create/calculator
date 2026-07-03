import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'

type Params = { params: { scenarioId: string } }

// PATCH /api/admin/approvals/[scenarioId] — admin signs off a below-floor
// discount. Stamps discountApprovedAt/By; requiresApproval stays true as
// the historical flag (the pending queue filters on approvedAt == null).
export async function PATCH(_req: Request, { params }: Params) {
  try {
    const session = await requireAdmin()

    const scenario = await prisma.quoteScenario.findUnique({
      where: { id: params.scenarioId },
      select: { id: true, requiresApproval: true, discountApprovedAt: true },
    })
    if (!scenario) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    if (!scenario.requiresApproval) {
      return NextResponse.json({ error: 'Nothing to approve' }, { status: 422 })
    }
    if (scenario.discountApprovedAt) {
      return NextResponse.json({ ok: true, alreadyApproved: true })
    }

    await prisma.quoteScenario.update({
      where: { id: params.scenarioId },
      data: {
        discountApprovedAt: new Date(),
        discountApprovedBy: session.user.name ?? session.user.email ?? 'admin',
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
