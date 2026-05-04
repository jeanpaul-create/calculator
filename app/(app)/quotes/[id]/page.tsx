import { notFound, redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { getFullQuoteForPdf, buildPricedScenarios } from '@/lib/quote-pdf'
import QuoteDetailView, {
  type QuoteDetailVM,
  type ScenarioVM,
} from '@/components/quotes/QuoteDetailView'
import type { QuoteStatusValue } from '@/components/ui'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { quoteNumber: true },
  })
  return { title: quote ? `Offre ${quote.quoteNumber}` : 'Offre' }
}

export default async function QuoteDetailPage({ params }: Props) {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      rep: { select: { name: true, email: true } },
      scenarios: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            include: { product: { select: { name: true, category: true } } },
          },
          options: { include: { option: { select: { name: true } } } },
        },
      },
    },
  })

  if (!quote) notFound()
  if (!isAdmin && quote.repId !== session.user.id) notFound()

  // Load priced scenarios for ROI breakdown (uses stored SCR + feed-in rate)
  const fullQuote = await getFullQuoteForPdf(params.id)
  const pricedScenarios = fullQuote ? await buildPricedScenarios(fullQuote) : null

  // Map to a JSON-safe view-model for the client component
  const scenarios: ScenarioVM[] = quote.scenarios.map((s) => {
    const priced = pricedScenarios?.find((ps) => ps.id === s.id)
    return {
      id: s.id,
      name: s.name,
      scenarioType: s.scenarioType,
      roofType: s.roofType,
      roofSlope: s.roofSlope,
      sellingPriceExVatRappen: s.sellingPriceExVatRappen,
      sellingPriceIncVatRappen: s.sellingPriceIncVatRappen,
      vatPctBasisPts: s.vatPctBasisPts,
      marginBasisPts: s.marginBasisPts,
      discountBasisPts: s.discountBasisPts ?? 0,
      discountReason: s.discountReason ?? null,
      requiresApproval: s.requiresApproval ?? false,
      rateRappenPerKwh: s.rateRappenPerKwh,
      yieldKwhPerKwp: s.yieldKwhPerKwp,
      feedInRateRappenPerKwh: s.feedInRateRappenPerKwh,
      selfConsumptionRatePct: s.selfConsumptionRatePct,
      annualSavingsRappen: priced?.annualSavingsRappen ?? null,
      selfConsumedKwh: priced?.selfConsumedKwh ?? null,
      exportedKwh: priced?.exportedKwh ?? null,
      paybackYears: priced?.paybackYears ?? null,
      installedKwp: priced?.installedKwp ?? null,
      annualKwhYield: priced?.annualKwhYield ?? null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      items: s.items.map((it) => ({
        name: it.product.name,
        quantity: it.quantity,
        category: it.product.category as any,
      })),
      options: s.options.map((o) => ({ name: o.option.name })),
    }
  })

  const vm: QuoteDetailVM = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status as QuoteStatusValue,
    customerName: quote.customerName,
    customerEmail: quote.customerEmail,
    customerPhone: quote.customerPhone,
    customerZip: quote.customerZip,
    customerCanton: quote.customerCanton,
    siteAddress: quote.siteAddress,
    notes: quote.notes,
    createdAt: quote.createdAt.toISOString(),
    updatedAt: quote.updatedAt.toISOString(),
    sentAt: quote.sentAt?.toISOString() ?? null,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    followUpAt: quote.followUpAt?.toISOString() ?? null,
    repName: quote.rep?.name ?? null,
    repEmail: quote.rep?.email ?? null,
    shareToken: quote.shareToken ?? null,
    firstViewedAt: quote.firstViewedAt?.toISOString() ?? null,
    viewCount: quote.viewCount ?? 0,
    scenarios,
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <QuoteDetailView quote={vm} isAdmin={isAdmin} />
    </div>
  )
}
