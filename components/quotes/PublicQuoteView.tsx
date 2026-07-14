'use client'

/**
 * PublicQuoteView — what the customer sees at /q/[shareToken].
 *
 * Wave B upgrade: the customer now CHOOSES their configuration at accept
 * time. All tiers (Essentiel / Recommandé / Premium) render as selectable
 * cards with the rep's hero pick pre-selected — the anchoring built in
 * /present no longer evaporates at the decision point. Accepting requires
 * typing a full name (signature simple; recorded with IP + user-agent
 * server-side) and records acceptedScenarioId.
 *
 * Data NOT shown here: rep identity, costs, margins, discounts, notes.
 */

import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface PublicScenarioVM {
  id: string
  tier: 'essentiel' | 'recommande' | 'premium' | null
  name: string
  scenarioType: string
  sellingPriceExVat: string | null
  sellingPriceIncVat: string | null
  vatRate: string
  vatAmount: string | null
  /** Indicative monthly payment (mortgage-increase framing, 2%/20y). */
  monthlyChf: string | null
  items: { name: string; quantity: number; category: string }[]
  options: { name: string }[]
}

export interface PublicQuoteVM {
  /**
   * Internal Quote.id — used for the customer-facing copy header only.
   * NEVER passed to public APIs — those key on `shareToken`.
   */
  id: string
  /**
   * Public share token. Used by every outbound URL on this page (respond,
   * PDF download). Decoupled from Quote.id so a leaked link can be revoked.
   */
  shareToken: string
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
  /** Pre-selected card: rep's hero pick (or automatic fallback). */
  heroScenarioId: string | null
  /** Set once the customer accepted a specific configuration. */
  acceptedScenarioId: string | null
  /** Canonical order: essentiel → recommandé → premium → untiered. */
  scenarios: PublicScenarioVM[]
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
  PAC_TANK: 'Ballon / Réservoir',
}

const TIER_LABEL: Record<string, string> = {
  essentiel: 'ESSENTIEL',
  recommande: 'RECOMMANDÉ',
  premium: 'PREMIUM',
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
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [signedName, setSignedName] = useState('')
  const [declineReason, setDeclineReason] = useState('')
  const [pending, setPending] = useState<'accept' | 'decline' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [responded, setResponded] = useState<'accepted' | 'declined' | null>(null)

  // Selected configuration: the accepted one (terminal states), else the
  // rep's hero pick, else the first scenario.
  const [selectedId, setSelectedId] = useState<string | null>(
    quote.acceptedScenarioId ?? quote.heroScenarioId ?? quote.scenarios[0]?.id ?? null
  )
  const selected =
    quote.scenarios.find((s) => s.id === selectedId) ?? quote.scenarios[0] ?? null

  const acceptedView = quote.status === 'ACCEPTED' || responded === 'accepted'
  const declinedView = quote.status === 'DECLINED' || responded === 'declined'
  const showPicker = quote.scenarios.length > 1 && quote.canRespond && responded === null

  async function respond(action: 'accept' | 'decline') {
    setPending(action)
    setError(null)
    try {
      const res = await fetch(`/api/public/quotes/${quote.shareToken}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          scenarioId: selected?.id,
          signedName: action === 'accept' ? signedName.trim() : undefined,
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
            href={`/api/public/quotes/${quote.shareToken}/pdf`}
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

        {/* Configuration picker — the tier choice, hero pre-selected */}
        {showPicker && (
          <div className="mb-4">
            <h2 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
              Choisissez votre configuration
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {quote.scenarios.map((s) => {
                const isSelected = s.id === selected?.id
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-pressed={isSelected}
                    className={cn(
                      'text-left p-3 rounded-lg border bg-white transition-colors',
                      isSelected
                        ? 'border-[1.5px] border-red-500 ring-1 ring-red-100'
                        : 'border-gray-200 hover:border-gray-300'
                    )}
                  >
                    <div
                      className={cn(
                        'text-[10px] font-bold uppercase tracking-wider mb-1',
                        isSelected ? 'text-red-600' : 'text-gray-500'
                      )}
                    >
                      {s.tier ? TIER_LABEL[s.tier] : s.name}
                    </div>
                    {s.sellingPriceIncVat && (
                      <div className="text-base font-semibold text-gray-900 font-mono tabular-nums">
                        {s.sellingPriceIncVat}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500 mt-0.5">TTC</div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Total (selected configuration) */}
        {selected?.sellingPriceIncVat && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
            <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Total TTC{selected.tier ? ` — ${TIER_LABEL[selected.tier]}` : ''}
            </div>
            <div className="text-4xl font-semibold text-red-600 tabular-nums font-mono leading-tight">
              {selected.sellingPriceIncVat}
            </div>
            {selected.monthlyChf && (
              <div className="text-sm text-gray-700 mt-1.5">
                soit ≈ <span className="font-semibold font-mono tabular-nums">{selected.monthlyChf}/mois</span>
                <span className="text-xs text-gray-400"> via augmentation hypothécaire*</span>
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2 space-y-0.5">
              {selected.sellingPriceExVat && (
                <div>
                  Prix HT&nbsp;: <span className="font-mono tabular-nums">{selected.sellingPriceExVat}</span>
                </div>
              )}
              {selected.vatAmount && (
                <div>
                  TVA ({selected.vatRate})&nbsp;:{' '}
                  <span className="font-mono tabular-nums">{selected.vatAmount}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scenario / items (selected configuration) */}
        {selected && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 mb-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">{selected.name}</h2>
            <p className="text-xs text-gray-500 mb-4">
              {selected.scenarioType === 'PAC' ? 'Pompe à chaleur' : 'Installation photovoltaïque'}
            </p>
            <div className="space-y-1.5">
              {selected.items.map((item, i) => (
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
              {selected.options.map((opt, i) => (
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
              Une confirmation vous a été envoyée par e-mail.
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
            {acceptOpen ? (
              <>
                <h2 className="text-sm font-semibold text-gray-900 mb-2">
                  Accepter l&apos;offre{selected?.tier ? ` — ${TIER_LABEL[selected.tier]}` : ''}
                </h2>
                <p className="text-xs text-gray-500 mb-3">
                  Saisissez votre nom complet pour confirmer votre accord.
                  Cette confirmation vaut acceptation de l&apos;offre
                  {selected?.sellingPriceIncVat ? ` (${selected.sellingPriceIncVat} TTC)` : ''}.
                </p>
                <input
                  type="text"
                  value={signedName}
                  onChange={(e) => setSignedName(e.target.value)}
                  placeholder="Prénom et nom"
                  autoComplete="name"
                  className="w-full text-sm border border-gray-300 rounded p-2.5 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => respond('accept')}
                    disabled={pending !== null || signedName.trim().length < 3}
                    className="btn-primary text-sm px-4 py-2.5 flex-1 disabled:opacity-50"
                  >
                    {pending === 'accept' ? 'Enregistrement…' : '✓ Confirmer et accepter'}
                  </button>
                  <button
                    onClick={() => setAcceptOpen(false)}
                    disabled={pending !== null}
                    className="text-sm text-gray-500 hover:text-gray-700 px-3"
                  >
                    Annuler
                  </button>
                </div>
              </>
            ) : !decliningOpen ? (
              <>
                <h2 className="text-sm font-semibold text-gray-900 mb-3">Votre réponse</h2>
                <button
                  onClick={() => setAcceptOpen(true)}
                  disabled={pending !== null}
                  className="btn-primary w-full text-base py-3 mb-2 disabled:opacity-50"
                >
                  ✓ Accepter cette offre
                  {selected?.sellingPriceIncVat ? ` — ${selected.sellingPriceIncVat}` : ''}
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
          <br />
          *Mensualité indicative : augmentation hypothécaire à 2% sur 20 ans —
          hors frais bancaires, sous réserve d&apos;acceptation par votre banque.
        </p>
      </div>
    </div>
  )
}
