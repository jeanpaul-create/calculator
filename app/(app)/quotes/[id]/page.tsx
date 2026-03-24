import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { QuoteStatus } from '@prisma/client'
import QuoteStatusBadge from '@/components/ui/QuoteStatusBadge'
import EmailButton from './EmailButton'
import { getFullQuoteForPdf, buildPricedScenarios } from '@/lib/quote-pdf'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

export async function generateMetadata({ params }: Props) {
  const quote = await prisma.quote.findUnique({
    where: { id: params.id },
    select: { quoteNumber: true },
  })
  return { title: quote ? `Offerte ${quote.quoteNumber}` : 'Offerte' }
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
          options: {
            include: { option: { select: { name: true } } },
          },
        },
      },
    },
  })

  if (!quote) notFound()

  // Authorization: rep can only see their own quotes
  if (!isAdmin && quote.repId !== session.user.id) notFound()

  // Load priced scenarios for ROI breakdown (uses stored SCR + feed-in rate)
  const fullQuote = await getFullQuoteForPdf(params.id)
  const pricedScenarios = fullQuote ? await buildPricedScenarios(fullQuote) : null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link href="/quotes" className="text-sm text-gray-500 hover:text-gray-700 mb-4 inline-flex items-center gap-1">
        ← Toutes les offres
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mt-2 mb-6">
        <div>
          <h1 className="page-title font-mono">{quote.quoteNumber}</h1>
          <div className="mt-1">
            <QuoteStatusBadge status={quote.status as QuoteStatus} />
          </div>
        </div>
        <div className="text-sm text-gray-500 text-right">
          <div>Créé: {new Date(quote.createdAt).toLocaleDateString('fr-CH')}</div>
          {isAdmin && quote.rep && (
            <div className="mt-0.5">Conseiller: {quote.rep.name ?? quote.rep.email}</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Customer info */}
        <div className="card-padded">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</h2>
          {quote.customerName ? (
            <p className="font-semibold text-gray-900">{quote.customerName}</p>
          ) : (
            <p className="text-gray-400 italic text-sm">Sans nom</p>
          )}
          {quote.customerEmail && (
            <p className="text-sm text-gray-600 mt-0.5">{quote.customerEmail}</p>
          )}
          {quote.customerPhone && (
            <p className="text-sm text-gray-600 mt-0.5">{quote.customerPhone}</p>
          )}
          {quote.siteAddress && (
            <p className="text-sm text-gray-600 mt-0.5">{quote.siteAddress}</p>
          )}
          {quote.customerZip && (
            <p className="text-sm text-gray-500 mt-0.5">
              {quote.customerZip}{quote.customerCanton ? ` (${quote.customerCanton})` : ''}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="card-padded flex flex-col gap-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Actions</h2>

          {/* PDF download */}
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            download={`${quote.quoteNumber}.pdf`}
            className="btn-primary text-center"
          >
            ↓ Télécharger PDF
          </a>

          {/* Email send */}
          <EmailButton quoteId={quote.id} hasEmail={!!quote.customerEmail} />

          {!quote.customerEmail && (
            <p className="text-xs text-gray-400">
              Ajoutez un e-mail client pour envoyer le PDF par e-mail.
            </p>
          )}
        </div>
      </div>

      {/* Scenarios */}
      {quote.scenarios.length === 0 ? (
        <div className="card-padded text-center py-8">
          <p className="text-gray-500 text-sm">Aucun scénario enregistré.</p>
          <Link href={`/calculator?quoteId=${quote.id}`} className="btn-primary mt-4 inline-block">
            Saisir un scénario
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">
            {quote.scenarios.length === 1 ? 'Scénario' : `${quote.scenarios.length} Scénarios`}
          </h2>
          {quote.scenarios.map((scenario, idx) => (
            <div key={scenario.id} className="card-padded">
              <div className="flex items-center gap-2 mb-3">
                {quote.scenarios.length > 1 && (
                  <span className="bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                    Option {idx + 1}
                  </span>
                )}
                <span className="font-semibold text-gray-900">{scenario.name}</span>
              </div>

              <div className="text-xs text-gray-500 mb-2">
                Toiture: {scenario.roofType ?? '—'} · Pente: {scenario.roofSlope ?? '—'}
              </div>

              {/* Items */}
              <div className="space-y-1 mb-3">
                {scenario.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 tabular-nums w-6 text-right">{item.quantity}×</span>
                    <span className="text-gray-800">{item.product.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">{item.product.category}</span>
                  </div>
                ))}
                {scenario.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 tabular-nums w-6 text-right">1×</span>
                    <span className="text-gray-800">{opt.option.name}</span>
                    <span className="text-xs text-gray-400 ml-auto">Service</span>
                  </div>
                ))}
              </div>

              {/* Price + ROI summary */}
              <div className="border-t border-gray-100 pt-2 space-y-1">
                {scenario.sellingPriceIncVatRappen != null && (
                  <div className="text-sm flex justify-between">
                    <span className="text-gray-600">Prix TTC</span>
                    <span className="font-semibold tabular-nums">
                      CHF {(scenario.sellingPriceIncVatRappen / 100).toLocaleString('fr-CH', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}
                    </span>
                  </div>
                )}
              </div>

              {/* ROI breakdown — only shown if ROI was computed */}
              {(scenario.rateRappenPerKwh != null || scenario.yieldKwhPerKwp != null) && (() => {
                const pricedScenario = pricedScenarios?.find(s => s.id === scenario.id)
                return (
                  <div className="mt-2 border-t border-gray-100 pt-2 space-y-1">
                    {pricedScenario?.annualSavingsRappen != null && (
                      <div className="text-sm flex justify-between font-medium">
                        <span className="text-gray-700">Valeur annuelle</span>
                        <span className="tabular-nums text-green-700">
                          CHF {(pricedScenario.annualSavingsRappen / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    )}
                    {pricedScenario?.selfConsumedKwh != null && pricedScenario.selfConsumptionRatePct != null && (
                      <div className="text-xs flex justify-between text-gray-500">
                        <span>Autoconsommation ({pricedScenario.selfConsumptionRatePct}%)</span>
                        <span className="font-mono tabular-nums">
                          {pricedScenario.selfConsumedKwh.toLocaleString('fr-CH')} kWh
                        </span>
                      </div>
                    )}
                    {pricedScenario?.exportedKwh != null && pricedScenario.selfConsumptionRatePct != null && (
                      <div className="text-xs flex justify-between text-gray-500">
                        <span>Injection réseau ({100 - pricedScenario.selfConsumptionRatePct}%)</span>
                        <span className="font-mono tabular-nums">
                          {pricedScenario.exportedKwh.toLocaleString('fr-CH')} kWh
                        </span>
                      </div>
                    )}
                    {pricedScenario?.paybackYears != null && (
                      <div className="text-xs flex justify-between text-gray-500">
                        <span>Amortissement</span>
                        <span className="font-mono tabular-nums">{pricedScenario.paybackYears} ans</span>
                      </div>
                    )}
                    {scenario.rateRappenPerKwh != null && (
                      <div className="text-xs flex justify-between text-gray-400">
                        <span>Tarif consommation</span>
                        <span className="font-mono tabular-nums">{scenario.rateRappenPerKwh} ct/kWh</span>
                      </div>
                    )}
                    {pricedScenario?.feedInRateRappenPerKwh != null && (
                      <div className="text-xs flex justify-between text-gray-400">
                        <span>Tarif injection</span>
                        <span className="font-mono tabular-nums">{pricedScenario.feedInRateRappenPerKwh} ct/kWh</span>
                      </div>
                    )}
                    {scenario.yieldKwhPerKwp != null && (
                      <div className="text-xs flex justify-between text-gray-400">
                        <span>Production PVGIS</span>
                        <span className="font-mono tabular-nums">{scenario.yieldKwhPerKwp} kWh/kWp/an</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          ))}
        </div>
      )}

      {/* Notes */}
      {quote.notes && (
        <div className="mt-6 card-padded">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h2>
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
        </div>
      )}
    </div>
  )
}
