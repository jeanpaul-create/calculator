/**
 * /admin/approvals — queue of below-floor discounts awaiting admin sign-off.
 *
 * A scenario lands here when the rep saved with requiresApproval=true
 * (effective margin after discount below min_margin_basis_pts) and no admin
 * has stamped discountApprovedAt yet. Approving records who/when; the quote
 * itself is untouched (the flag is an audit trail, not a blocker — per the
 * existing save flow the rep could already send).
 */

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { PageHeader } from '@/components/ui'
import ApprovalsList, { type ApprovalRow } from './ApprovalsList'

export const dynamic = 'force-dynamic'

export default async function AdminApprovalsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/')
  }

  const pending = await prisma.quoteScenario.findMany({
    where: { requiresApproval: true, discountApprovedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      name: true,
      scenarioType: true,
      sellingPriceIncVatRappen: true,
      discountBasisPts: true,
      discountReason: true,
      marginBasisPts: true,
      updatedAt: true,
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          customerName: true,
          status: true,
          rep: { select: { name: true, email: true } },
        },
      },
    },
    take: 100,
  })

  const rows: ApprovalRow[] = pending.map((s) => ({
    scenarioId: s.id,
    scenarioName: s.name,
    scenarioType: s.scenarioType as 'PV' | 'PAC',
    quoteId: s.quote.id,
    quoteNumber: s.quote.quoteNumber,
    quoteStatus: s.quote.status,
    customerName: s.quote.customerName,
    repName: s.quote.rep?.name ?? s.quote.rep?.email ?? '—',
    totalIncVatRappen: s.sellingPriceIncVatRappen,
    discountBasisPts: s.discountBasisPts ?? 0,
    discountReason: s.discountReason,
    marginBasisPts: s.marginBasisPts,
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <div className="p-6 max-w-5xl">
      <PageHeader
        title="Approbations de rabais"
        subtitle="Rabais sous le seuil de marge minimale — en attente de validation"
      />
      <ApprovalsList rows={rows} />
    </div>
  )
}
