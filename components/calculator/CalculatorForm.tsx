'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { calculateIonPrice, calculateRoi, estimateAnnualYield, sumInstalledKwp, IonPricingCoefficients } from '@/lib/pricing'
import PriceSummaryCard from './PriceSummaryCard'
import { useLanguage } from '@/context/LanguageContext'

interface Product {
  id: string
  name: string
  category: 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'
  costRappen: number
  powerWp: number | null
}

interface CostOption {
  id: string
  name: string
  description: string | null
  costRappen: number
}

interface SelectedProduct {
  product: Product
  quantity: number
}

interface CalculatorFormProps {
  products: Product[]
  costOptions: CostOption[]
  vatBasisPts: number
  ionCoefficients: IonPricingCoefficients
  rateRappenPerKwh?: number
  quoteId?: string
  onSaved?: (quoteId: string) => void
}

export default function CalculatorForm({
  products,
  costOptions,
  vatBasisPts,
  ionCoefficients,
  rateRappenPerKwh,
  quoteId,
  onSaved,
}: CalculatorFormProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set())
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)

  const ionProducts = selectedProducts.map((sp) => ({
    category: sp.product.category,
    costRappen: sp.product.costRappen,
    quantity: sp.quantity,
  }))

  const ionOptions = Array.from(selectedOptions).map((id) => {
    const opt = costOptions.find((o) => o.id === id)!
    return { costRappen: opt.costRappen }
  })

  const pricing =
    ionProducts.length > 0 || ionOptions.length > 0
      ? calculateIonPrice(ionProducts, ionOptions, ionCoefficients)
      : null

  const panels = selectedProducts
    .filter((sp) => sp.product.category === 'PANEL' && sp.product.powerWp)
    .map((sp) => ({ powerWp: sp.product.powerWp!, quantity: sp.quantity }))

  const installedKwp = sumInstalledKwp(panels)
  const annualYield = installedKwp > 0 ? estimateAnnualYield(installedKwp) : null

  const roi =
    annualYield && rateRappenPerKwh && pricing
      ? calculateRoi({
          annualKwhYield: annualYield,
          rateRappenPerKwh,
          investmentRappen: pricing.sellingPriceIncVatRappen,
        })
      : null

  // Group products by category
  const byCategory = products.reduce<Record<string, Product[]>>((acc, p) => {
    acc[p.category] = acc[p.category] ?? []
    acc[p.category].push(p)
    return acc
  }, {})

  const CATEGORY_LABELS: Record<string, string> = {
    PANEL: t('cat_panel'),
    INVERTER: t('cat_inverter'),
    BATTERY: t('cat_battery'),
    MOUNTING: t('cat_mounting'),
    ACCESSORY: t('cat_accessory'),
    EV_CHARGER: t('cat_ev_charger'),
  }

  const addProduct = (product: Product) => {
    setSelectedProducts((prev) => {
      const existing = prev.find((sp) => sp.product.id === product.id)
      if (existing) {
        return prev.map((sp) =>
          sp.product.id === product.id
            ? { ...sp, quantity: sp.quantity + 1 }
            : sp
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
        prev.map((sp) =>
          sp.product.id === productId ? { ...sp, quantity } : sp
        )
      )
    }
    setIsDirty(true)
    setSavedQuoteNumber(null)
  }

  const toggleOption = (optionId: string) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
    setIsDirty(true)
    setSavedQuoteNumber(null)
  }

  const buildScenarioPayload = () => ({
    marginBasisPts: pricing?.effectiveMarginBasisPts ?? 0,
    items: selectedProducts.map((sp) => ({
      productId: sp.product.id,
      quantity: sp.quantity,
    })),
    options: Array.from(selectedOptions).map((id) => ({ optionId: id })),
  })

  // Save to existing quote
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
  }, [quoteId, pricing, selectedProducts, selectedOptions, onSaved])

  // Create a new quote and save the scenario to it
  const handleSaveAsNewQuote = useCallback(async () => {
    if (!pricing) return
    setIsSaving(true)
    setSaveError(null)
    try {
      // Step 1: create the quote (no customer info needed — can be filled in later)
      const createRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!createRes.ok) {
        const data = await createRes.json()
        setSaveError(data.error ?? "Erreur lors de la création de l'offre")
        return
      }
      const newQuote = await createRes.json()

      // Step 2: save the scenario to the new quote
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
      // Refresh to redirect to calculator with the new quoteId
      router.push(`/calculator?quoteId=${newQuote.id}`)
    } finally {
      setIsSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, selectedProducts, selectedOptions, onSaved, router])

  return (
    <div className="flex gap-6">
      {/* Left: form */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* System info bar (installed kWp + annual yield) */}
        {installedKwp > 0 && (
          <div className="card-padded">
            <div className="text-sm text-gray-500">
              {t('calc_installed_power')}: <strong>{installedKwp.toFixed(1)} kWp</strong>
              {annualYield && (
                <>
                  {' '}· {t('calc_annual_yield')} <strong>{annualYield.toLocaleString('fr-CH')} kWh/an</strong>
                </>
              )}
            </div>
          </div>
        )}

        {/* Product selection by category */}
        {Object.entries(byCategory).map(([category, categoryProducts]) => (
          <div key={category} className="card-padded">
            <div className="section-title mb-4">{CATEGORY_LABELS[category] ?? category}</div>
            <div className="space-y-2">
              {categoryProducts.map((product) => {
                const selected = selectedProducts.find((sp) => sp.product.id === product.id)
                return (
                  <div
                    key={product.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border transition-colors ${
                      selected
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{product.name}</div>
                      {product.powerWp && (
                        <div className="text-xs text-gray-500">
                          {product.powerWp >= 1000
                            ? `${(product.powerWp / 1000).toFixed(1)} kW`
                            : `${product.powerWp} Wp`}
                        </div>
                      )}
                    </div>
                    <div className="text-sm tabular-nums font-mono text-gray-600 w-24 text-right">
                      CHF {(product.costRappen / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
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
                          max={99}
                          value={selected.quantity}
                          onChange={(e) => setQuantity(product.id, parseInt(e.target.value) || 1)}
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

        {/* Cost options */}
        {costOptions.length > 0 && (
          <div className="card-padded">
            <div className="section-title mb-4">{t('calc_surcharges')}</div>
            <div className="space-y-2">
              {costOptions.map((option) => {
                const checked = selectedOptions.has(option.id)
                return (
                  <label
                    key={option.id}
                    className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-colors ${
                      checked
                        ? 'border-red-200 bg-red-50'
                        : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleOption(option.id)}
                      className="w-4 h-4 accent-red-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-800">{option.name}</div>
                      {option.description && (
                        <div className="text-xs text-gray-500">{option.description}</div>
                      )}
                    </div>
                    <div className="text-sm tabular-nums font-mono text-gray-600">
                      CHF {(option.costRappen / 100).toLocaleString('fr-CH', { minimumFractionDigits: 2 })}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        )}

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
      <div className="w-72 flex-shrink-0">
        {pricing ? (
          <PriceSummaryCard
            rawCostRappen={pricing.rawCostRappen}
            sellingPriceExVatRappen={pricing.sellingPriceExVatRappen}
            vatRappen={pricing.vatRappen}
            sellingPriceIncVatRappen={pricing.sellingPriceIncVatRappen}
            effectiveMarginBasisPts={pricing.effectiveMarginBasisPts}
            vatBasisPts={vatBasisPts}
            annualSavingsRappen={roi?.annualSavingsRappen}
            paybackYears={roi?.paybackYears}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={quoteId ? handleSave : undefined}
            onSaveAsNew={!quoteId ? handleSaveAsNewQuote : undefined}
          />
        ) : (
          <div className="card-padded text-sm text-gray-500 text-center py-10">
            {selectedProducts.length === 0 && selectedOptions.size === 0
              ? t('calc_select_products')
              : '…'}
          </div>
        )}
      </div>
    </div>
  )
}
