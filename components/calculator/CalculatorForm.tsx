'use client'

import { useState, useEffect, useCallback } from 'react'
import { calculatePrice, calculateRoi, estimateAnnualYield, sumInstalledKwp } from '@/lib/pricing'
import PriceSummaryCard from './PriceSummaryCard'

interface Product {
  id: string
  name: string
  category: 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY'
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
  minMarginBasisPts: number
  defaultMarginBasisPts?: number
  // Electricity rate from customer ZIP (Rappen/kWh)
  rateRappenPerKwh?: number
  quoteId?: string
  onSaved?: (quoteId: string) => void
}

const CATEGORY_LABELS: Record<string, string> = {
  PANEL: 'Module',
  INVERTER: 'Wechselrichter',
  BATTERY: 'Speicher',
  MOUNTING: 'Montage',
  ACCESSORY: 'Zubehör',
}

export default function CalculatorForm({
  products,
  costOptions,
  vatBasisPts,
  minMarginBasisPts,
  defaultMarginBasisPts,
  rateRappenPerKwh,
  quoteId,
  onSaved,
}: CalculatorFormProps) {
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>([])
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set())
  const [marginPct, setMarginPct] = useState(
    ((defaultMarginBasisPts ?? minMarginBasisPts) / 100).toFixed(1)
  )
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const marginBasisPts = Math.round(parseFloat(marginPct) * 100) || 0

  // Compute pricing live from current selections
  const pricingItems = [
    ...selectedProducts.map((sp) => ({
      costRappen: sp.product.costRappen,
      quantity: sp.quantity,
    })),
    ...Array.from(selectedOptions).map((id) => {
      const opt = costOptions.find((o) => o.id === id)!
      return { costRappen: opt.costRappen, quantity: 1 }
    }),
  ]

  const pricing =
    marginBasisPts >= 0 && marginBasisPts < 10000
      ? calculatePrice({ items: pricingItems, marginBasisPts, vatBasisPts })
      : null

  // ROI calculation
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
  }

  const toggleOption = (optionId: string) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev)
      if (next.has(optionId)) next.delete(optionId)
      else next.add(optionId)
      return next
    })
    setIsDirty(true)
  }

  const handleSave = useCallback(async () => {
    if (!quoteId || !pricing) return

    setIsSaving(true)
    setSaveError(null)

    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marginBasisPts,
          items: selectedProducts.map((sp) => ({
            productId: sp.product.id,
            quantity: sp.quantity,
          })),
          options: Array.from(selectedOptions).map((id) => ({ optionId: id })),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error ?? 'Fehler beim Speichern')
        return
      }

      setIsDirty(false)
      onSaved?.(quoteId)
    } finally {
      setIsSaving(false)
    }
  }, [quoteId, pricing, marginBasisPts, selectedProducts, selectedOptions, onSaved])

  const marginTooLow = marginBasisPts < minMarginBasisPts

  return (
    <div className="flex gap-6">
      {/* Left: form */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Margin input */}
        <div className="card-padded">
          <div className="section-title mb-4">Marge</div>
          <div className="flex items-end gap-4">
            <div className="w-40">
              <label className="label">Marge (%)</label>
              <div className="relative">
                <input
                  type="number"
                  className={marginTooLow ? 'input-error' : 'input'}
                  value={marginPct}
                  min={minMarginBasisPts / 100}
                  max={99}
                  step={0.5}
                  onChange={(e) => {
                    setMarginPct(e.target.value)
                    setIsDirty(true)
                  }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                  %
                </span>
              </div>
              {marginTooLow && (
                <p className="field-error">
                  Mindestmarge: {(minMarginBasisPts / 100).toFixed(1)}%
                </p>
              )}
            </div>
            {installedKwp > 0 && (
              <div className="text-sm text-gray-500 pb-2">
                Installierte Leistung: <strong>{installedKwp.toFixed(1)} kWp</strong>
                {annualYield && (
                  <> · Ertrag ca. <strong>{annualYield.toLocaleString('de-CH')} kWh/Jahr</strong></>
                )}
              </div>
            )}
          </div>
        </div>

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
                      CHF {(product.costRappen / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
                    </div>
                    {selected ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQuantity(product.id, selected.quantity - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm"
                          aria-label="Menge verringern"
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
                          aria-label="Menge erhöhen"
                        >
                          +
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addProduct(product)}
                        className="btn-secondary text-xs px-3 py-1.5"
                      >
                        Hinzufügen
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
            <div className="section-title mb-4">Zusatzkosten</div>
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
                      CHF {(option.costRappen / 100).toLocaleString('de-CH', { minimumFractionDigits: 2 })}
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
      </div>

      {/* Right: price summary */}
      <div className="w-72 flex-shrink-0">
        {pricing ? (
          <PriceSummaryCard
            {...pricing}
            vatBasisPts={vatBasisPts}
            annualSavingsRappen={roi?.annualSavingsRappen}
            paybackYears={roi?.paybackYears}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={quoteId ? handleSave : undefined}
          />
        ) : (
          <div className="card-padded text-sm text-gray-500 text-center py-10">
            Produkte auswählen, um den Preis zu berechnen
          </div>
        )}
      </div>
    </div>
  )
}
