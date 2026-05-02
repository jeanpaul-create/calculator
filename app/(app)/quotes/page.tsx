import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageHeader, EmptyState, KpiCard, type QuoteStatusValue } from '@/components/ui'
import QuotesList, { type QuoteListItem } from '@/components/quotes/QuotesList'
import { formatChf } from '@/lib/pricing'

export const metadata = { title: 'Offres' }

export default async function QuotesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  const quotesRaw = await prisma.quote.findMany({
    where: isAdmin ? undefined : { repId: session.user.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerName: true,
      customerEmail: true,
      customerZip: true,
      customerCanton: true,
      sentAt: true,
      expiresAt: true,
      createdAt: true,
      rep: { select: { name: true } },
      scenarios: {
        select: { name: true, sellingPriceIncVatRappen: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
      },
    },
  })

  // Shape for the client list — flatten the first scenario's price up.
  const quotes: QuoteListItem[] = quotesRaw.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    status: q.status as QuoteStatusValue,
    customerName: q.customerName,
    customerEmail: q.customerEmail,
    customerZip: q.customerZip,
    customerCanton: q.customerCanton,
    totalIncVatRappen: q.scenarios[0]?.sellingPriceIncVatRappen ?? null,
    scenarioName: q.scenarios[0]?.name ?? null,
    sentAt: q.sentAt,
    expiresAt: q.expiresAt,
    createdAt: q.createdAt,
    repName: q.rep?.name ?? null,
  }))

  // ── KPI computations (one pass over the result set) ──
  const now = Date.now()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfYear = new Date()
  startOfYear.setMonth(0, 1)
  startOfYear.setHours(0, 0, 0, 0)
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  let sentThisMonth = 0
  let pipelineRappen = 0
  let pipelineCount = 0
  let expiringSoon = 0
  let wonYtdRappen = 0
  let wonYtdCount = 0

  for (const q of quotes) {
    if (q.sentAt && q.sentAt.getTime() >= startOfMonth.getTime()) sentThisMonth++
    if (q.status === 'SENT') {
      pipelineCount++
      if (q.totalIncVatRappen) pipelineRappen += q.totalIncVatRappen
      if (q.expiresAt) {
        const ms = q.expiresAt.getTime() - now
        if (ms > 0 && ms <= sevenDays) expiringSoon++
      }
    }
    if (q.status === 'ACCEPTED' && q.createdAt.getTime() >= startOfYear.getTime()) {
      wonYtdCount++
      if (q.totalIncVatRappen) wonYtdRappen += q.totalIncVatRappen
    }
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Offres"
        subtitle={`${quotes.length} offre${quotes.length > 1 ? 's' : ''}${isAdmin ? ' au total' : ''}`}
        actions={<NewQuoteButton />}
      />

      {/* KPI row */}
      {quotes.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Envoyées ce mois"
            value={sentThisMonth.toString()}
            context={sentThisMonth === 0 ? 'Aucune offre envoyée' : 'Depuis le 1er du mois'}
          />
          <KpiCard
            label="En pipeline"
            value={formatChf(pipelineRappen)}
            context={`${pipelineCount} offre${pipelineCount !== 1 ? 's' : ''} en attente`}
          />
          <KpiCard
            label="Expire ≤ 7 jours"
            value={expiringSoon.toString()}
            context={expiringSoon > 0 ? 'À relancer rapidement' : 'Aucune offre urgente'}
            emphasis={expiringSoon > 0 ? 'primary' : 'muted'}
          />
          <KpiCard
            label="Gagnées YTD"
            value={formatChf(wonYtdRappen)}
            context={`${wonYtdCount} offre${wonYtdCount !== 1 ? 's' : ''} acceptée${wonYtdCount !== 1 ? 's' : ''}`}
          />
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <EmptyState
            icon={
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
            title="Aucune offre pour le moment"
            description="Créez votre première offre depuis le calculateur."
            action={<NewQuoteButton />}
          />
        </div>
      ) : (
        <QuotesList quotes={quotes} isAdmin={isAdmin} />
      )}
    </div>
  )
}

function NewQuoteButton() {
  return (
    <Link href="/calculator" className="btn-primary">
      + Nouvelle offre
    </Link>
  )
}
