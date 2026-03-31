'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  calculatePacPrice,
  PacPricingCoefficients,
  PacPricingBreakdown,
  formatChf,
  formatPct,
} from '@/lib/pricing'
import { useLanguage } from '@/context/LanguageContext'

interface PacProduct {
  id: string
  name: string
  category:
    | 'PAC_MACHINE'
    | 'PAC_ACCESSORY'
    | 'PAC_ELECTRICITE'
    | 'PAC_MACONNERIE'
    | 'PAC_ISOLATION'
    | 'PAC_CITERNE'
    | 'PAC_CONDUITE'
    | 'PAC_MONTAGE'
    | 'PAC_ADMIN'
  costRappen: number
  laborRappen: number | null
}

interface SelectedProduct {
  product: PacProduct
  quantity: number
}

interface PacCalculatorFormProps {
  products: PacProduct[]
  vatBasisPts: number
  pacCoefficients: PacPricingCoefficients
  quoteId?: string
  onSaved?: (quoteId: string) => void
}

const CATEGORY_ORDER = [
  'PAC_MACHINE',
  'PAC_ACCESSORY',
  'PAC_ELECTRICITE',
  'PAC_MACONNERIE',
  'PAC_ISOLATION',
  'PAC_CITERNE',
  'PAC_CONDUITE',
  'PAC_MONTAGE',
  'PAC_ADMIN',
] as const

const CATEGORY_LABELS: Record<string, string> = {
  PAC_MACHINE: 'Machine',
  PAC_ACCESSORY: 'Accessoires',
  PAC_ELECTRICITE: 'Électricité',
  PAC_MACONNERIE: 'Maçonnerie',
  PAC_ISOLATION: 'Isolation',
  PAC_CITERNE: 'Citerne',
  PAC_CONDUITE: 'Conduite',
  PAC_MONTAGE: 'Montage',
  PAC_ADMIN: 'Administratif',
}

export default function PacCalculatorForm({
  products,
  vatBasisPts,
  pacCoefficients,
  quoteId,
  onSaved,
}: PacCalculatorFormProps) {
  const { t } = useLanguage()
  const router = useRouter()

  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    siteAddress: '',
    notes: '',
  })

  // Group products by category, then by brand within category
  const getBrand = (name: string): string => {
    const brands = ['BUDERUS', 'VAILLANT', 'Buderus', 'Vaillant']
    for (const brand of brands) {
      if (name.includes(brand)) return brand
    }
    return name.split(' ')[0]
  }

  const byCategory = products.reduce<Record<string, Record<string, PacProduct[]>>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = {}
    const brand = getBrand(p.name)
    if (!acc[p.category][brand]) acc[p.category][brand] = []
    acc[p.category][brand].push(p)
    return acc
  }, {})

  const availableCategories = CATEGORY_ORDER.filter(
    (cat) => Object.keys(byCategory[cat] ?? {}).length > 0
  )

  const [activeCategory, setActiveCategory] = useState<string>(
    availableCategories[0] ?? 'PAC_MACHINE'
  )

  // Compute live pricing
  const pacProducts = selectedProducts.map((sp) => ({
    costRappen: sp.product.costRappen,
    laborRappen: sp.product.laborRappen ?? 0,
    quantity: sp.quantity,
  }))

  const pricing =
    selectedProducts.length > 0
      ? calculatePacPrice(pacProducts, pacCoefficients)
      : null

  // Product interaction handlers
  const addProduct = (product: PacProduct) => {
    setSelectedProducts((prev) => {
      const existing = prev.find((sp) => sp.product.id === product.id)
      if (existing) {
        return prev.map((sp) =>
          sp.product.id === product.id ? { ...sp, quantity: sp.quantity + 1 } : sp
        )
      }
      return [...prev, { product, quantity: 1 }]
    })
    setIsDirty(true)
    setSavedQuoteNumber(null)
  }

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      setSelectedProducts((prev) => prev.filter((sp) => sp.product.id !== productId))
    } else {
      setSelectedProducts((prev) =>
        prev.map((sp) => (sp.product.id === productId ? { ...sp, quantity } : sp))
      )
    }
    setIsDirty(true)
    setSavedQuoteNumber(null)
  }

  const buildScenarioPayload = () => ({
    scenarioType: 'PAC' as const,
    ...projectInfo,
    items: selectedProducts.map((sp) => ({
      productId: sp.product.id,
      quantity: sp.quantity,
    })),
  })

  const handleSave = useCallback(async () => {
    if (!quoteId || !pricing) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildScenarioPayload()),
      })
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? "Erreur lors de l'enregistrement")
        return
      }
      setIsDirty(false)
      onSaved?.(quoteId)
    } finally {
      setIsSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, pricing, selectedProducts, onSaved])

  const handleSaveAsNewQuote = useCallback(async () => {
    if (!pricing) return
    setIsSaving(true)
    setSaveError(null)
    try {
      // Step 1: create quote with project info
      const createRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: projectInfo.customerName || undefined,
          customerEmail: projectInfo.customerEmail || undefined,
          customerPhone: projectInfo.customerPhone || undefined,
          siteAddress: projectInfo.siteAddress || undefined,
          notes: projectInfo.notes || undefined,
        }),
      })
      if (!createRes.ok) {
        const data = await createRes.json()
        setSaveError(data.error ?? "Erreur lors de la création de l'offre")
        return
      }
      const newQuote = await createRes.json()

      // Step 2: save PAC scenario
      const saveRes = await fetch(`/api/quotes/${newQuote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildScenarioPayload()),
      })
      if (!saveRes.ok) {
        const data = await saveRes.json()
        setSaveError(data.error ?? "Erreur lors de l'enregistrement du scénario")
        return
      }

      setIsDirty(false)
      setSavedQuoteNumber(newQuote.quoteNumber)
      onSaved?.(newQuote.id)
      router.push(`/calculator/pac?quoteId=${newQuote.id}`)
    } finally {
      setIsSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, selectedProducts, onSaved, router])

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Left: form */}
      <div className="flex-1 space-y-6 min-w-0">

        {/* Project Information */}
        <div className="card-padded">
          <div className="section-title mb-4">Informations du projet</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Client</label>
              <input
                type="text"
                className="input"
                placeholder="Nom du client"
                value={projectInfo.customerName}
                onChange={(e) => setProjectInfo((p) => ({ ...p, customerName: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Adresse du site</label>
              <input
                type="text"
                className="input"
                placeholder="Rue, NPA, localité"
                value={projectInfo.siteAddress}
                onChange={(e) => setProjectInfo((p) => ({ ...p, siteAddress: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Email client</label>
              <input
                type="email"
                className="input"
                placeholder="client@exemple.ch"
                value={projectInfo.customerEmail}
                onChange={(e) => setProjectInfo((p) => ({ ...p, customerEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Téléphone client</label>
              <input
                type="tel"
                className="input"
                placeholder="+41 79 000 00 00"
                value={projectInfo.customerPhone}
                onChange={(e) => setProjectInfo((p) => ({ ...p, customerPhone: e.target.value }))}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea
                className="input resize-none"
                rows={2}
                placeholder="Notes internes..."
                value={projectInfo.notes}
                onChange={(e) => setProjectInfo((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
        </div>

        {/* Product selection — PAC category tabs */}
        <div className="card-padded">
          {/* Tab strip */}
          <div className="flex gap-1 mb-5 border-b border-gray-100 -mx-5 px-5 overflow-x-auto">
            {availableCategories.map((cat) => {
              const selectedCount = selectedProducts
                .filter((sp) => sp.product.category === cat)
                .reduce((s, sp) => s + sp.quantity, 0)
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t transition-colors relative -mb-px border-b-2 whitespace-nowrap ${
                    isActive
                      ? 'text-orange-600 border-orange-500 bg-white'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {selectedCount > 0 && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold ${
                        isActive
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {selectedCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active category — products grouped by brand */}
          <div className="space-y-5">
            {Object.keys(byCategory[activeCategory] ?? {})
              .sort()
              .map((brand) => (
                <div key={brand}>
                  <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                    {brand}
                  </div>
                  <div className="space-y-2">
                    {byCategory[activeCategory][brand].map((product) => {
                      const selected = selectedProducts.find(
                        (sp) => sp.product.id === product.id
                      )
                      const hasLabor = product.laborRappen && product.laborRappen > 0
                      const isPrixSurDemande = product.costRappen === 0
                      return (
                        <div
                          key={product.id}
                          className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                            selected
                              ? 'border-orange-200 bg-orange-50'
                              : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-gray-800">{product.name}</div>
                            <div className="text-xs text-gray-500 mt-0.5 space-x-2">
                              {isPrixSurDemande ? (
                                <span className="italic text-amber-600">Prix sur demande</span>
                              ) : (
                                <span>
                                  Mat.{' '}
                                  <span className="font-mono tabular-nums">
                                    {formatChf(product.costRappen)}
                                  </span>
                                </span>
                              )}
                              {hasLabor && (
                                <span>
                                  · MO{' '}
                                  <span className="font-mono tabular-nums">
                                    {formatChf(product.laborRappen!)}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                          {selected ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setQuantity(product.id, selected.quantity - 1)}
                                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm"
                                aria-label="Diminuer quantité"
                              >
                                −
                              </button>
                              <input
                                type="number"
                                min={1}
                                max={999}
                                value={selected.quantity}
                                onChange={(e) =>
                                  setQuantity(product.id, parseInt(e.target.value) || 1)
                                }
                                className="w-12 text-center text-sm border border-gray-200 rounded py-1 tabular-nums"
                              />
                              <button
                                onClick={() => setQuantity(product.id, selected.quantity + 1)}
                                className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm"
                                aria-label="Augmenter quantité"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => addProduct(product)}
                              className="btn-secondary text-xs px-3 py-1.5"
                            >
                              {t('calc_add')}
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
          </div>
        </div>

        {saveError && (
          <div className="alert-error">
            <span>{saveError}</span>
          </div>
        )}

        {savedQuoteNumber && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            ✓ {savedQuoteNumber} – {t('price_saved')}
          </div>
        )}
      </div>

      {/* Right: price summary */}
      <div className="w-full lg:w-72 lg:flex-shrink-0">
        {pricing ? (
          <PacPriceSummaryCard
            pricing={pricing}
            vatBasisPts={vatBasisPts}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={quoteId ? handleSave : undefined}
            onSaveAsNew={!quoteId ? handleSaveAsNewQuote : undefined}
          />
        ) : (
          <div className="card-padded text-sm text-gray-500 text-center py-10">
            {selectedProducts.length === 0
              ? 'Sélectionnez des produits pour calculer le prix'
              : '…'}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── PAC-specific price summary card ──────────────────────────────────────────

interface PacPriceSummaryCardProps {
  pricing: PacPricingBreakdown
  vatBasisPts: number
  isDirty?: boolean
  isSaving?: boolean
  onSave?: () => void
  onSaveAsNew?: () => void
}

function PacPriceSummaryCard({
  pricing,
  vatBasisPts,
  isDirty,
  isSaving,
  onSave,
  onSaveAsNew,
}: PacPriceSummaryCardProps) {
  const { t } = useLanguage()

  return (
    <div className="card sticky top-6 border-l-4 border-l-orange-500">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Prix de vente PAC
        </div>
        <div className="text-5xl font-semibold text-gray-900 tabular-nums leading-none">
          {formatChf(pricing.sellingPriceIncVatRappen)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {t('price_incl_vat')} {formatPct(vatBasisPts)}
        </div>
      </div>

      {/* Price breakdown */}
      <div className="px-5 py-4 border-b border-gray-100 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Prix HT</span>
          <span className="tabular-nums font-mono">
            {formatChf(pricing.sellingPriceExVatRappen)}
          </span>
        </div>
        <div className="flex justify-between text-gray-500 text-xs">
          <span>TVA {formatPct(vatBasisPts)}</span>
          <span className="tabular-nums font-mono">{formatChf(pricing.vatRappen)}</span>
        </div>
        <div className="border-t border-gray-100 pt-2 flex justify-between font-semibold">
          <span>Total TTC</span>
          <span className="tabular-nums font-mono">
            {formatChf(pricing.sellingPriceIncVatRappen)}
          </span>
        </div>
      </div>

      {/* Margin info */}
      <div className="px-5 py-3 border-b border-gray-100 text-xs text-gray-500 space-y-1">
        <div className="flex justify-between">
          <span>Coût matériel net</span>
          <span className="tabular-nums font-mono">{formatChf(pricing.rawCostRappen)}</span>
        </div>
        <div className="flex justify-between">
          <span>Main-d&apos;œuvre</span>
          <span className="tabular-nums font-mono">{formatChf(pricing.totalLaborRappen)}</span>
        </div>
        <div className="flex justify-between">
          <span>Marge effective</span>
          <span className="tabular-nums font-semibold text-orange-700">
            {formatPct(pricing.effectiveMarginBasisPts)}
          </span>
        </div>
      </div>

      {/* Cost structure detail */}
      <div className="px-5 py-3 border-b border-gray-100 space-y-1">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
          Structure du coût
        </div>
        <PacCostRow label="Appro (mat + frais)" value={pricing.totalApproRappen} />
        <PacCostRow label="Construction (MO + PM + Admin)" value={pricing.constructionRappen} />
        <PacCostRow label="Frais généraux" value={pricing.salesOverheadRappen} />
        <PacCostRow label="Profit appro" value={pricing.profitApproRappen} />
        <PacCostRow label="Profit construction" value={pricing.profitConstrRappen} />
      </div>

      {/* Save actions */}
      <div className="px-5 py-4 space-y-2">
        {onSave && (
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="btn-primary w-full text-sm"
          >
            {isSaving ? 'Enregistrement…' : t('price_save')}
          </button>
        )}
        {onSaveAsNew && (
          <button
            onClick={onSaveAsNew}
            disabled={isSaving}
            className="btn-primary w-full text-sm"
          >
            {isSaving ? 'Enregistrement…' : 'Sauvegarder comme nouvelle offre'}
          </button>
        )}
      </div>
    </div>
  )
}

function PacCostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between text-xs text-gray-500">
      <span>{label}</span>
      <span className="tabular-nums font-mono">{formatChf(value)}</span>
    </div>
  )
}
