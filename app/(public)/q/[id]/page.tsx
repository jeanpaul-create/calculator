/**
 * Public quote view — accessible without auth via /q/{shareToken}.
 *
 * The dynamic segment is named `[id]` for legacy reasons but the value is a
 * `shareToken`, never `Quote.id`. Decoupling the public URL from the row
 * primary key lets the rep revoke a leaked link by rotating the token (or
 * setting it to null) without rebuilding the quote.
 *
 * Visibility rules:
 *   DRAFT          → 404 (not yet shared by the rep — no shareToken anyway)
 *   SENT (active)  → interactive view with Accept / Decline
 *   SENT (expired) → read-only "expired" notice
 *   ACCEPTED       → "Merci, l'offre est acceptée" state
 *   DECLINED       → "L'offre a été déclinée" state
 *   EXPIRED        → read-only expired notice
 *
 * Engagement tracking:
 *   firstViewedAt  → set the first time the customer opens the link
 *   viewCount      → bumped on every page load, lets the rep see follow-up
 *                    intent ("opened 3x, never accepted")
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
import { cache } from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/db'
import { notifyRep } from '@/lib/notify-rep'
import { formatChf, formatPct } from '@/lib/pricing'
import PublicQuoteView, { type PublicQuoteVM } from '@/components/quotes/PublicQuoteView'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

/**
 * Look up the quote by shareToken. Wrapped in React.cache() so generateMetadata
 * + the default export share a single DB round trip per request — Next.js
 * dedupes inside the same render (P1.A).
 */
const getQuoteByToken = cache(async (token: string) => {
  return prisma.quote.findUnique({
    where: { shareToken: token },
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
})

export async function generateMetadata({ params }: Props) {
  const quote = await getQuoteByToken(params.id)
  if (!quote || quote.status === 'DRAFT') {
    return { title: 'Offre' }
  }
  return { title: `Offre ${quote.quoteNumber}` }
}

export default async function PublicQuotePage({ params }: Props) {
  const quote = await getQuoteByToken(params.id)

  // DRAFT quotes are never publicly accessible (and shouldn't have a token).
  // Unknown token → 404.
  if (!quote || quote.status === 'DRAFT') notFound()

  // Engagement tracking: increment viewCount on every load, stamp
  // firstViewedAt on the first view only. Fire-and-forget — never block
  // page rendering on this. Also: skip if the quote is in a terminal state
  // (ACCEPTED / DECLINED / EXPIRED) where re-opens are noise rather than
  // signal.
  if (quote.status === 'SENT') {
    const isFirstView = quote.firstViewedAt == null
    prisma.quote
      .update({
        where: { id: quote.id },
        data: {
          viewCount: { increment: 1 },
          firstViewedAt: quote.firstViewedAt ?? new Date(),
        },
      })
      .catch((err) => console.error('[/q view tracking]', err))
    // First open only — tell the rep while the lead is hot. Repeat views
    // stay silent (they're visible as viewCount on the quote page).
    if (isFirstView) void notifyRep(quote.id, 'viewed')
  }

  const firstScenario = quote.scenarios[0]
  const now = Date.now()
  const isExpired =
    quote.status === 'EXPIRED' ||
    (quote.expiresAt && quote.expiresAt.getTime() < now && quote.status === 'SENT')

  const vm: PublicQuoteVM = {
    id: quote.id,
    // shareToken is non-null here: the lookup matched on shareToken, so the
    // value can't be null. The TS check is just for the strict-null-checks lint.
    shareToken: quote.shareToken ?? params.id,
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
