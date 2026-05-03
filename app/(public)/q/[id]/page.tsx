/**
 * Public quote view — accessible without auth via /q/{id}.
 *
 * The quote `id` (cuid) acts as the share token. Anyone with the link can
 * view the quote and accept or decline. Reps share the URL via email; the
 * customer reads the offer in their browser without needing an account.
 *
 * Visibility rules:
 *   DRAFT          → 404 (not yet shared by the rep)
 *   SENT (active)  → interactive view with Accept / Decline
 *   SENT (expired) → read-only "expired" notice
 *   ACCEPTED       → "Merci, l'offre est acceptée" state
 *   DECLINED       → "L'offre a été déclinée" state
 *   EXPIRED        → read-only expired notice
 *
 * Data shown to the customer (intentionally LIMITED — no internal data):
 *   - Customer name (so they know it's theirs)
 *   - Quote number
 *   - Total TTC + VAT breakdown
 *   - Scenario summary (named items, no costs)
 *   - Validity date
 *   - PDF download link
 *
 * Data NOT shown to the customer:
 *   - Rep name / email
 *   - Cost basis, margin, discount percentage
 *   - Internal notes
 *   - Other quotes belonging to the same customer
 */
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { formatChf, formatPct } from '@/lib/pricing'
import PublicQuoteView, { type PublicQuoteVM } from '@/components/quotes/PublicQuoteView'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { quoteNumber: true, status: true },
  })
  if (!quote || quote.status === 'DRAFT') {
    return { title: 'Offre' }
  }
  return { title: `Offre ${quote.quoteNumber}` }
}

export default async function PublicQuotePage({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    include: {
      scenarios: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: { include: { product: { select: { name: true, category: true, powerWp: true } } } },
          options: { include: { option: { select: { name: true } } } },
        },
      },
    },
  })

  // DRAFT quotes are not yet shared — pretend they don't exist
  if (!quote || quote.status === 'DRAFT') notFound()

  const firstScenario = quote.scenarios[0]
  const now = Date.now()
  const isExpired =
    quote.status === 'EXPIRED' ||
    (quote.expiresAt && quote.expiresAt.getTime() < now && quote.status === 'SENT')

  const vm: PublicQuoteVM = {
    id: quote.id,
    quoteNumber: quote.quoteNumber,
    status: quote.status,
    customerName: quote.customerName,
    siteAddress: quote.siteAddress,
    sentAt: quote.sentAt?.toISOString() ?? null,
    expiresAt: quote.expiresAt?.toISOString() ?? null,
    acceptedAt: quote.acceptedAt?.toISOString() ?? null,
    declinedAt: quote.declinedAt?.toISOString() ?? null,
    isExpired: !!isExpired,
    canRespond: quote.status === 'SENT' && !isExpired,
    scenario: firstScenario
      ? {
          name: firstScenario.name,
          scenarioType: firstScenario.scenarioType,
          sellingPriceExVat: firstScenario.sellingPriceExVatRappen
            ? formatChf(firstScenario.sellingPriceExVatRappen)
            : null,
          sellingPriceIncVat: firstScenario.sellingPriceIncVatRappen
            ? formatChf(firstScenario.sellingPriceIncVatRappen)
            : null,
          vatRate: formatPct(firstScenario.vatPctBasisPts),
          vatAmount:
            firstScenario.sellingPriceExVatRappen && firstScenario.sellingPriceIncVatRappen
              ? formatChf(
                  firstScenario.sellingPriceIncVatRappen - firstScenario.sellingPriceExVatRappen
                )
              : null,
          items: firstScenario.items.map((it) => ({
            name: it.product.name,
            quantity: it.quantity,
            category: it.product.category,
          })),
          options: firstScenario.options.map((o) => ({ name: o.option.name })),
        }
      : null,
  }

  return <PublicQuoteView quote={vm} />
}
