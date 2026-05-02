/**
 * AiPromptDialog — chat-style input that turns a free-text project description
 * into a structured quote draft.
 *
 *   Rep types: "Famille Müller à Yverdon, toit en tuile, 10 kWp avec batterie"
 *   AI responds with a list of catalog items + customer info + roof attrs.
 *   Rep reviews the proposed items (uncheck any), clicks "Appliquer", form fills.
 *
 * Stays out of the way: dismissible modal, never auto-applies. Rep is in
 * control. Failures show actionable error messages, not "something went wrong".
 */
'use client'

import { useState, useEffect, useRef } from 'react'
import { Card } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface AiProposedItem {
  productId: string
  productName: string
  quantity: number
  category: string
}

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
}

interface AiPromptDialogProps {
  scenarioType: 'PV' | 'PAC'
  open: boolean
  onClose: () => void
  /** Called when the rep accepts a draft. Caller applies it to form state. */
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

export default function AiPromptDialog({
  scenarioType,
  open,
  onClose,
  onApply,
}: AiPromptDialogProps) {
  const [description, setDescription] = useState('')
  const [draft, setDraft] = useState<AiProposedDraft | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Focus textarea when opened; reset state when closed.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => textareaRef.current?.focus(), 50)
      return () => clearTimeout(t)
    } else {
      setDraft(null)
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
  const accentColor = scenarioType === 'PAC' ? 'orange' : 'red'

  async function handleGenerate() {
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    setDraft(null)
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
      setDraft(data as AiProposedDraft)
    } catch (e) {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLoading(false)
    }
  }

  function handleApply() {
    if (!draft) return
    const filtered: AiProposedDraft = {
      ...draft,
      items: draft.items.filter((it) => !excluded.has(it.productId)),
    }
    onApply(filtered)
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
          accentColor === 'orange' ? 'bg-orange-50' : 'bg-red-50'
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
          {!draft ? (
            <>
              <p className="text-sm text-gray-600 mb-3">
                Décrivez le projet du client. L&apos;assistant proposera les produits du
                catalogue qui correspondent à votre description.
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

              {/* Examples */}
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
            // Result view — proposed items + warnings
            <div className="space-y-4">
              {draft.items.length === 0 ? (
                <div className="text-sm text-gray-600 italic">
                  Aucun produit n&apos;a pu être proposé d&apos;après cette description.
                  Précisez davantage ou choisissez les produits manuellement.
                </div>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      Produits proposés ({draft.items.length})
                    </p>
                    <div className="space-y-1.5">
                      {draft.items.map((item) => {
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
                            <span className={cn('text-sm flex-1', isExcluded ? 'text-gray-500 line-through' : 'text-gray-900')}>
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

                  {/* Customer + roof inferred */}
                  {(draft.customerInfo.name ||
                    draft.customerInfo.siteAddress ||
                    draft.customerInfo.annualConsumptionKwh ||
                    draft.roofType ||
                    draft.roofSlope) && (
                    <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-700 space-y-1">
                      {draft.customerInfo.name && (
                        <div><span className="text-gray-500">Client :</span> {draft.customerInfo.name}</div>
                      )}
                      {draft.customerInfo.siteAddress && (
                        <div><span className="text-gray-500">Adresse :</span> {draft.customerInfo.siteAddress}</div>
                      )}
                      {draft.customerInfo.annualConsumptionKwh && (
                        <div><span className="text-gray-500">Consommation :</span> {draft.customerInfo.annualConsumptionKwh.toLocaleString('fr-CH')} kWh/an</div>
                      )}
                      {draft.roofType && (
                        <div><span className="text-gray-500">Toiture :</span> {draft.roofType}</div>
                      )}
                      {draft.roofSlope && (
                        <div><span className="text-gray-500">Pente :</span> {draft.roofSlope}</div>
                      )}
                    </div>
                  )}
                </>
              )}

              {draft.warnings.length > 0 && (
                <div className="rounded bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800 space-y-1">
                  <p className="font-semibold uppercase tracking-wider text-[10px]">À vérifier</p>
                  {draft.warnings.map((w, i) => (
                    <div key={i}>· {w}</div>
                  ))}
                </div>
              )}

              {draft.notes && (
                <div className="text-xs text-gray-600 italic">
                  Note de l&apos;assistant : {draft.notes}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2">
          {!draft ? (
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
                  '✨ Générer'
                )}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setDraft(null)
                  setExcluded(new Set())
                }}
                className="btn-secondary text-xs px-3 py-1.5"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={draft.items.every((it) => excluded.has(it.productId)) && draft.items.length > 0}
                className="btn-primary text-xs px-4 py-1.5"
              >
                Appliquer ({draft.items.filter((it) => !excluded.has(it.productId)).length})
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
