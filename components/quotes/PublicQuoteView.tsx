/**
 * PublicQuoteView — what the customer sees when they open a /q/{id} link.
 *
 * Two modes:
 *   - canRespond: Accept / Decline buttons live, customer can act
 *   - read-only: Already accepted / declined / expired
 *
 * Stateless w.r.t. the quote (server-rendered VM); accepting/declining hits
 * the public response API which redirects back to this same URL.
 */
'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface PublicQuoteVM {
  id: string
  quoteNumber: string
  status: string
  customerName: string | null
  siteAddress: string | null
  sentAt: string | null
  expiresAt: string | null
  acceptedAt: string | null
  declinedAt: string | null
  isExpired: boolean
  canRespond: boolean
  scenario: {
    name: string
    scenarioType: string
    sellingPriceExVat: string | null
    sellingPriceIncVat: string | null
    vatRate: string
    vatAmount: string | null
    items: { name: string; quantity: number; category: string }[]
    options: { name: string }[]
  } | null
}

const CATEGORY_FR: Record<string, string> = {
  PANEL: 'Panneau',
  INVERTER: 'Onduleur',
  BATTERY: 'Batterie',
  MOUNTING: 'Fixation',
  ACCESSORY: 'Accessoire',
  EV_CHARGER: 'Borne EV',
  PAC_MACHINE: 'Pompe à chaleur',
  PAC_ACCESSORY: 'Accessoire PAC',
  PAC_ELECTRICITE: 'Électricité',
  PAC_MACONNERIE: 'Maçonnerie',
  PAC_ISOLATION: 'Isolation',
  PAC_CITERNE: 'Citerne',
  PAC_CONDUITE: 'Conduite',
  PAC_MONTAGE: 'Montage',
  PAC_ADMIN: 'Administratif',
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function PublicQuoteView({ quote }: { quote: PublicQuoteVM }) {
  const [decliningOpen, setDecliningOpen] = useState(false)
  const [declineReason, setDeclineReason] = useState('')
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [responded, setResponded] = useState<'accepted' | 'declined' | null>(null)

  async function respond(action: 'accept' | 'decline') {
    setPending(action)
    setError(null)
    try {
      const res = await fetch(`/api/public/quotes/${quote.id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'decline' ? declineReason.trim() || undefined : undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Une erreur est survenue.')
        return
      }
      setResponded(action === 'accept' ? 'accepted' : 'declined')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setPending(null)
    }
  }

  const acceptedView = quote.status === 'ACCEPTED' || responded === 'accepted'
  const declinedView = quote.status === 'DECLINED' || responded === 'declined'

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Brand header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-red-500 rounded flex items-center justify-center">
              <span className="text-white text-sm font-bold tracking-tight">I.ON</span>
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">I.ON Energy</div>
              <div className="text-xs text-gray-500">Solar &amp; pompes à chaleur</div>
            </div>
          </div>
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            className="text-xs text-red-600 hover:text-red-700 font-medium underline decoration-red-300 underline-offset-2"
          >
            Télécharger PDF
          </a>
        </div>

        {/* Hero band */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
          <div className="-mt-6 -mx-6 mb-5 h-0.5 bg-red-500 rounded-t-lg" />

          <div className="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
            <span className="text-xs font-mono text-red-600 font-semibold tabular-nums">
              {quote.quoteNumber}
            </span>
            {quote.expiresAt && (
              <span className="text-xs text-gray-500">
                Valable jusqu&apos;au {formatDate(quote.expiresAt)}
              </span>
            )}
          </div>

          <h1 className="text-xl font-semibold text-gray-900 tracking-tight mb-1">
            Offre commerciale
          </h1>
          {quote.customerName && (
            <p className="text-sm text-gray-700">
              Préparée pour <span className="font-semibold">{quote.customerName}</span>
            </p>
          )}
          {quote.siteAddress && (
            <p className="text-sm text-gray-500 mt-0.5">
              Site : {quote.siteAddress}
            </p>
          )}
        </div>

        {/* Total */}
        {quote.scenario?.sellingPriceIncVat && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Total TTC
            </div>
            <div className="text-4xl font-semibold text-red-600 tabular-nums font-mono leading-tight">
              {quote.scenario.sellingPriceIncVat}
            </div>
            <div className="text-xs text-gray-500 mt-2 space-y-0.5">
              {quote.scenario.sellingPriceExVat && (
                <div>
                  Prix HT&nbsp;: <span className="font-mono tabular-nums">{quote.scenario.sellingPriceExVat}</span>
                </div>
              )}
              {quote.scenario.vatAmount && (
                <div>
                  TVA ({quote.scenario.vatRate})&nbsp;:{' '}
                  <span className="font-mono tabular-nums">{quote.scenario.vatAmount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scenario / items */}
        {quote.scenario && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">{quote.scenario.name}</h2>
            <p className="text-xs text-gray-500 mb-4">
              {quote.scenario.scenarioType === 'PAC' ? 'Pompe à chaleur' : 'Installation photovoltaïque'}
            </p>
            <div className="space-y-1.5">
              {quote.scenario.items.map((item, i) => (
                <div key={i} className="flex items-center gap-3 py-1 text-sm">
                  <span className="font-mono text-red-600 font-semibold tabular-nums w-8 text-right">
                    {item.quantity}×
                  </span>
                  <span className="text-gray-900 flex-1">{item.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                    {CATEGORY_FR[item.category] ?? item.category}
                  </span>
                </div>
              ))}
              {quote.scenario.options.map((opt, i) => (
                <div key={i} className="flex items-center gap-3 py-1 text-sm">
                  <span className="font-mono text-red-600 font-semibold tabular-nums w-8 text-right">
                    1×
                  </span>
                  <span className="text-gray-900 flex-1">{opt.name}</span>
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Service</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action */}
        {acceptedView ? (
          <div className="bg-green-50 rounded-lg border border-green-200 p-6 text-center">
            <div className="text-2xl mb-2">✓</div>
            <h2 className="text-base font-semibold text-green-900 mb-1">Offre acceptée</h2>
            <p className="text-sm text-green-800">
              Merci ! Votre conseiller vous contactera pour la suite.
            </p>
            {quote.acceptedAt && (
              <p className="text-xs text-green-700 mt-2 tabular-nums">
                Acceptée le {formatDate(quote.acceptedAt)}
              </p>
            )}
          </div>
        ) : declinedView ? (
          <div className="bg-gray-100 rounded-lg border border-gray-200 p-6 text-center">
            <h2 className="text-base font-semibold text-gray-700 mb-1">Offre déclinée</h2>
            <p className="text-sm text-gray-600">
              Cette offre a été déclinée. Si c&apos;est une erreur, contactez votre conseiller.
            </p>
            {quote.declinedAt && (
              <p className="text-xs text-gray-500 mt-2 tabular-nums">
                Le {formatDate(quote.declinedAt)}
              </p>
            )}
          </div>
        ) : quote.isExpired ? (
          <div className="bg-amber-50 rounded-lg border border-amber-200 p-6 text-center">
            <h2 className="text-base font-semibold text-amber-900 mb-1">Offre expirée</h2>
            <p className="text-sm text-amber-800">
              Cette offre est expirée. Demandez à votre conseiller de générer une nouvelle offre actualisée.
            </p>
          </div>
        ) : quote.canRespond ? (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            {!decliningOpen ? (
              <>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Votre réponse</h2>
                <button
                  onClick={() => respond('accept')}
                  disabled={pending !== null}
                  className="btn-primary w-full text-base py-3 mb-2 disabled:opacity-50"
                >
                  {pending === 'accept' ? 'Enregistrement…' : '✓ Accepter cette offre'}
                </button>
                <button
                  onClick={() => setDecliningOpen(true)}
                  disabled={pending !== null}
                  className="text-sm text-gray-500 hover:text-gray-700 underline w-full py-2"
                >
                  Décliner l&apos;offre
                </button>
              </>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Décliner l&apos;offre</h2>
                <p className="text-xs text-gray-500 mb-3">
                  Si vous le souhaitez, indiquez la raison — cela aide votre conseiller à
                  vous proposer une meilleure offre la prochaine fois.
                </p>
                <textarea
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  rows={3}
                  maxLength={500}
                  placeholder="Optionnel : prix trop élevé, décalage du projet, etc."
                  className="w-full text-sm border border-gray-300 rounded p-2 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 resize-none"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => respond('decline')}
                    disabled={pending !== null}
                    className="btn-secondary text-sm px-4 py-2 flex-1 disabled:opacity-50"
                  >
                    {pending === 'decline' ? 'Enregistrement…' : 'Confirmer le refus'}
                  </button>
                  <button
                    onClick={() => {
                      setDecliningOpen(false)
                      setDeclineReason('')
                    }}
                    disabled={pending !== null}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3"
                  >
                    Annuler
                  </button>
                </div>
              </>
            )}
            {error && (
              <p className="text-xs text-red-600 mt-3 text-center">{error}</p>
            )}
          </div>
        ) : null}

        {/* Footer */}
        <p className="text-center text-[10px] text-gray-400 mt-6 tracking-wide">
          Cette offre est confidentielle et destinée à son destinataire.
          Pour toute question, contactez votre conseiller I.ON.
        </p>
      </div>
    </div>
  )
}
