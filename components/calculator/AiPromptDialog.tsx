/**
 * AiPromptDialog — chat-style input that turns a free-text project description
 * into UP TO THREE tier-labeled quote drafts (Essentiel / Recommandé / Premium).
 *
 *   Rep types: "Famille Müller à Yverdon, toit en tuile, 10 kWp avec batterie"
 *   AI responds with up to 3 tiered proposals.
 *   Rep picks a tier (tabs), optionally unchecks items, clicks Appliquer.
 *
 * Stays out of the way: dismissible modal, never auto-applies. Rep is in
 * control. Failures show actionable error messages, not "something went wrong".
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

export interface AiProposedItem {
  productId: string
  productName: string
  quantity: number
  category: string
}

export type ProposalTier = 'essentiel' | 'recommande' | 'premium'

export interface AiProposal {
  tier: ProposalTier
  label: string
  rationale: string
  items: AiProposedItem[]
  warnings: string[]
}

/**
 * The "ghost" tier proposals that ride alongside the applied tier when the
 * rep saves. These are the 2 tiers the rep DID NOT pick, captured as the AI
 * proposed them. They're persisted as-is at save time so /present/ Screen 2
 * can render all 3 cards from real catalog data.
 */
export interface AiSibling {
  tier: ProposalTier
  items: AiProposedItem[]
}

/**
 * Single proposal applied to the form, plus shadow data for the other 2 tiers.
 *
 * `items` and the customer/roof fields are flattened from the rep-chosen tier
 * (so the form's existing applyAiDraft logic still works unchanged). The new
 * `tier` and `aiSiblings` fields carry the durable record needed by S2's
 * 3-scenario save: the form keeps them in state and includes them in the PUT
 * payload, and the PUT handler creates 1 scenario from form state (the
 * applied + edited tier) plus N from the siblings (the as-AI-proposed tiers).
 *
 * Non-AI applies (when this struct isn't used at all) → save behaves as
 * legacy: one scenario, tier=null. /present/ falls back to render the single
 * scenario as Recommandé per the design doc empty state.
 */
export interface AiProposedDraft {
  items: AiProposedItem[]
  customerInfo: {
    name?: string
    siteAddress?: string
    annualConsumptionKwh?: number
  }
  roofType?: 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
  roofSlope?: 'simple' | 'moyen' | 'complexe'
  notes?: string
  warnings: string[]
  /** Tier the rep applied to the form (the editable one). */
  tier?: ProposalTier
  /** The OTHER tiers from the same AI response, for save-time persistence. */
  aiSiblings?: AiSibling[]
}

interface AiResponse {
  proposals: AiProposal[]
  customerInfo: AiProposedDraft['customerInfo']
  roofType?: AiProposedDraft['roofType']
  roofSlope?: AiProposedDraft['roofSlope']
  notes?: string
  globalWarnings: string[]
}

interface AiPromptDialogProps {
  scenarioType: 'PV' | 'PAC'
  open: boolean
  onClose: () => void
  /** Called when the rep applies a single chosen proposal. */
  onApply: (draft: AiProposedDraft) => void
}

const EXAMPLES_PV = [
  "Famille de 4 à Lausanne, toit en tuile, ~8 kWp avec batterie 7 kWh, déjà une voiture électrique.",
  "Maison individuelle à Sion, toit ardoise pente moyenne, 12 panneaux LONGi sans batterie.",
]

const EXAMPLES_PAC = [
  "Remplacement de chaudière mazout, 180 m², BUDERUS 8 kW air-eau, démontage citerne incluse.",
  "Villa Genève, VAILLANT 10 kW, tranchée 15 m, raccordement électrique standard.",
]

const TIER_ORDER: ProposalTier[] = ['essentiel', 'recommande', 'premium']

const TIER_ACCENT: Record<ProposalTier, { active: string; idle: string; chip: string }> = {
  essentiel: {
    active: 'border-gray-700 text-gray-900 bg-gray-50',
    idle: 'border-gray-200 text-gray-600 hover:border-gray-300',
    chip: 'bg-gray-100 text-gray-700',
  },
  recommande: {
    active: 'border-red-500 text-red-700 bg-red-50',
    idle: 'border-gray-200 text-gray-600 hover:border-gray-300',
    chip: 'bg-red-100 text-red-700',
  },
  premium: {
    active: 'border-amber-600 text-amber-900 bg-amber-50',
    idle: 'border-gray-200 text-gray-600 hover:border-gray-300',
    chip: 'bg-amber-100 text-amber-800',
  },
}

export default function AiPromptDialog({
  scenarioType,
  open,
  onClose,
  onApply,
}: AiPromptDialogProps) {
  const [description, setDescription] = useState('')
  const [response, setResponse] = useState<AiResponse | null>(null)
  const [activeTier, setActiveTier] = useState<ProposalTier>('recommande')
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setResponse(null)
      setError(null)
      setExcluded(new Set())
    }
  }, [open])

  // ESC to close
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const examples = scenarioType === 'PAC' ? EXAMPLES_PAC : EXAMPLES_PV

  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setResponse(null)
    setExcluded(new Set())
    try {
      const res = await fetch('/api/ai/parse-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenarioType, description: description.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Erreur de génération')
        return
      }
      const r = data as AiResponse
      setResponse(r)
      // Default the active tier: recommande if present, else first available
      const hasRecommande = r.proposals.some((p) => p.tier === 'recommande')
      setActiveTier(hasRecommande ? 'recommande' : r.proposals[0]?.tier ?? 'recommande')
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!response) return
    const proposal = response.proposals.find((p) => p.tier === activeTier)
    if (!proposal) return
    // The OTHER tiers from this AI response — saved as-is alongside the applied
    // tier so /present/ Screen 2 has real catalog data for all 3 cards.
    // Excluded items only filter the APPLIED tier (rep's editable view); the
    // siblings keep the AI proposal intact.
    const aiSiblings: AiSibling[] = response.proposals
      .filter((p) => p.tier !== activeTier)
      .map((p) => ({
        tier: p.tier,
        items: p.items,
      }))
    const draft: AiProposedDraft = {
      items: proposal.items.filter((it) => !excluded.has(it.productId)),
      customerInfo: response.customerInfo,
      roofType: response.roofType,
      roofSlope: response.roofSlope,
      notes: response.notes,
      warnings: [...response.globalWarnings, ...proposal.warnings],
      tier: activeTier,
      aiSiblings: aiSiblings.length > 0 ? aiSiblings : undefined,
    }
    onApply(draft)
    onClose()
  }

  function toggleItem(productId: string) {
    setExcluded((prev) => {
      const next = new Set(prev)
      if (next.has(productId)) next.delete(productId)
      else next.add(productId)
      return next
    })
  }

  // Reset excluded items when switching tiers
  function switchTier(tier: ProposalTier) {
    setActiveTier(tier)
    setExcluded(new Set())
  }

  const activeProposal = response?.proposals.find((p) => p.tier === activeTier) ?? null
  const isPac = scenarioType === 'PAC'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg border border-gray-200 shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={cn(
          'px-5 py-4 border-b border-gray-200 flex items-center justify-between',
          isPac ? 'bg-orange-50' : 'bg-red-50'
        )}>
          <div className="flex items-center gap-2">
            <span className="text-lg">✨</span>
            <h2 className="text-base font-semibold text-gray-900">
              Décrire le projet en français
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 p-1 -m-1"
            aria-label="Fermer"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 overflow-y-auto flex-1">
          {!response ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Décrivez le projet du client. L&apos;assistant proposera trois variantes
                — Essentiel, Recommandé, Premium — pour discuter avec votre client.
              </p>

              <textarea
                ref={textareaRef}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault()
                    handleGenerate()
                  }
                }}
                placeholder={examples[0]}
                rows={5}
                maxLength={2000}
                className="w-full text-sm border border-gray-300 rounded-md p-3
                           placeholder-gray-400 focus:outline-none focus:border-red-500
                           focus:ring-1 focus:ring-red-500 resize-none"
                disabled={loading}
              />
              <div className="flex items-center justify-between mt-1">
                <span className="text-[10px] text-gray-400">
                  {description.length} / 2000 · ⌘↵ pour générer
                </span>
              </div>

              <div className="mt-4">
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  Exemples
                </p>
                <div className="space-y-1.5">
                  {examples.map((ex, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setDescription(ex)}
                      className="text-left text-xs text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded px-2 py-1.5 w-full transition-colors"
                    >
                      <span className="text-gray-400 mr-1.5">→</span>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="mt-4 rounded bg-red-50 border border-red-200 text-red-700 text-xs px-3 py-2">
                  {error}
                </div>
              )}
            </>
          ) : (
            // Result view — tier tabs + active proposal items
            <div className="space-y-3">
              {response.proposals.length === 0 ? (
                <div className="text-sm text-gray-600 italic">
                  Aucune proposition n&apos;a pu être générée. Précisez davantage.
                </div>
              ) : (
                <>
                  {/* Tier tabs — only show tiers actually returned */}
                  <div className="flex gap-2">
                    {TIER_ORDER.filter((t) =>
                      response.proposals.some((p) => p.tier === t)
                    ).map((tier) => {
                      const proposal = response.proposals.find((p) => p.tier === tier)!
                      const accent = TIER_ACCENT[tier]
                      const active = activeTier === tier
                      return (
                        <button
                          key={tier}
                          type="button"
                          onClick={() => switchTier(tier)}
                          className={cn(
                            'flex-1 border rounded-md px-3 py-2 text-left transition-colors',
                            active ? accent.active : accent.idle
                          )}
                        >
                          <div className={cn(
                            'text-[10px] font-semibold uppercase tracking-wider',
                            active ? '' : 'text-gray-500'
                          )}>
                            {proposal.label}
                          </div>
                          <div className={cn(
                            'text-xs mt-0.5',
                            active ? '' : 'text-gray-500'
                          )}>
                            {proposal.items.length} produit{proposal.items.length !== 1 ? 's' : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Active proposal */}
                  {activeProposal && (
                    <>
                      {activeProposal.rationale && (
                        <div className="text-xs text-gray-700 italic px-1">
                          {activeProposal.rationale}
                        </div>
                      )}

                      <div>
                        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                          Produits ({activeProposal.items.length})
                        </p>
                        <div className="space-y-1.5">
                          {activeProposal.items.map((item) => {
                            const isExcluded = excluded.has(item.productId)
                            return (
                              <label
                                key={item.productId}
                                className={cn(
                                  'flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors',
                                  isExcluded
                                    ? 'border-gray-200 bg-gray-50 opacity-60'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                )}
                              >
                                <input
                                  type="checkbox"
                                  checked={!isExcluded}
                                  onChange={() => toggleItem(item.productId)}
                                  className="w-4 h-4 accent-red-500 cursor-pointer"
                                />
                                <span className="font-mono text-xs text-red-600 font-semibold tabular-nums w-8 text-right">
                                  {item.quantity}×
                                </span>
                                <span className={cn(
                                  'text-sm flex-1',
                                  isExcluded ? 'text-gray-500 line-through' : 'text-gray-900'
                                )}>
                                  {item.productName}
                                </span>
                                <span className="text-[10px] text-gray-400 uppercase tracking-wider">
                                  {item.category.replace('PAC_', '')}
                                </span>
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    </>
                  )}

                  {/* Customer + roof inferred (shared across tiers) */}
                  {(response.customerInfo.name ||
                    response.customerInfo.siteAddress ||
                    response.customerInfo.annualConsumptionKwh ||
                    response.roofType ||
                    response.roofSlope) && (
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 space-y-1">
                      {response.customerInfo.name && (
                        <div><span className="text-gray-500">Client :</span> {response.customerInfo.name}</div>
                      )}
                      {response.customerInfo.siteAddress && (
                        <div><span className="text-gray-500">Adresse :</span> {response.customerInfo.siteAddress}</div>
                      )}
                      {response.customerInfo.annualConsumptionKwh && (
                        <div><span className="text-gray-500">Consommation :</span> {response.customerInfo.annualConsumptionKwh.toLocaleString('fr-CH')} kWh/an</div>
                      )}
                      {response.roofType && (
                        <div><span className="text-gray-500">Toiture :</span> {response.roofType}</div>
                      )}
                      {response.roofSlope && (
                        <div><span className="text-gray-500">Pente :</span> {response.roofSlope}</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Warnings */}
              {(response.globalWarnings.length > 0 ||
                (activeProposal && activeProposal.warnings.length > 0)) && (
                <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold uppercase tracking-wider text-[10px]">À vérifier</p>
                  {response.globalWarnings.map((w, i) => (
                    <div key={`g-${i}`}>· {w}</div>
                  ))}
                  {activeProposal?.warnings.map((w, i) => (
                    <div key={`p-${i}`}>· {w}</div>
                  ))}
                </div>
              )}

              {response.notes && (
                <div className="text-xs text-gray-600 italic">
                  Note de l&apos;assistant : {response.notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          {!response ? (
            <>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary text-xs px-3 py-1.5"
                disabled={loading}
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading || description.trim().length < 5}
                className="btn-primary text-xs px-4 py-1.5"
              >
                {loading ? (
                  <>
                    <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin mr-1" />
                    Analyse…
                  </>
                ) : (
                  '✨ Générer 3 propositions'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setResponse(null)
                  setExcluded(new Set())
                }}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={
                  !activeProposal ||
                  (activeProposal.items.length > 0 &&
                    activeProposal.items.every((it) => excluded.has(it.productId)))
                }
                className="btn-primary text-xs px-4 py-1.5"
              >
                Appliquer{' '}
                {activeProposal
                  ? `${activeProposal.label} (${activeProposal.items.filter((it) => !excluded.has(it.productId)).length})`
                  : ''}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
