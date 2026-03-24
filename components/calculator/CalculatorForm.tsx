'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { calculateIonPrice, calculateRoi, estimateAnnualYield, estimateSelfConsumptionRate, sumInstalledKwp, calculatePronovoSubsidy, estimateTaxSavings, IonPricingCoefficients, RoofType, RoofSlope } from '@/lib/pricing'
import PriceSummaryCard from './PriceSummaryCard'
import { useLanguage } from '@/context/LanguageContext'
import AddressSearch from './AddressSearch'

const SiteMap = dynamic(() => import('./SiteMap'), { ssr: false })

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
  /** PVGIS yield factor for the install location (kWh/kWp/year) */
  yieldKwhPerKwp?: number
  customerZip?: string
  quoteId?: string
  onSaved?: (quoteId: string) => void
}

export default function CalculatorForm({
  products,
  costOptions,
  vatBasisPts,
  ionCoefficients,
  rateRappenPerKwh,
  yieldKwhPerKwp,
  customerZip,
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
  const [projectInfo, setProjectInfo] = useState({
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    siteAddress: '',
    notes: '',
  })
  const [roofType, setRoofType] = useState<RoofType>('tuile')
  const [roofSlope, setRoofSlope] = useState<RoofSlope>('simple')
  const [annualConsumptionKwh, setAnnualConsumptionKwh] = useState<string>('')
  /** Feed-in tariff in ct/kWh — editable, default Swiss average */
  const [feedInRateCtKwh, setFeedInRateCtKwh] = useState<number>(8)
  const [mapState, setMapState] = useState<{ lat: number; lon: number; zoom: number } | null>(null)
  const [siteInfo, setSiteInfo] = useState<{
    rateCtPerKwh: number | null
    communeName: string | null
    yieldKwhPerKwp: number | null
  } | null>(null)
  const [fetchingSiteInfo, setFetchingSiteInfo] = useState(false)

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
      ? calculateIonPrice(ionProducts, ionOptions, ionCoefficients, roofType, roofSlope)
      : null

  const panels = selectedProducts
    .filter((sp) => sp.product.category === 'PANEL' && sp.product.powerWp)
    .map((sp) => ({ powerWp: sp.product.powerWp!, quantity: sp.quantity }))

  const installedKwp = sumInstalledKwp(panels)
  // Prefer live site-info values over server-side props
  const activeYield = siteInfo?.yieldKwhPerKwp ?? yieldKwhPerKwp
  const activeRate = siteInfo?.rateCtPerKwh ?? rateRappenPerKwh
  const annualYield = installedKwp > 0 ? estimateAnnualYield(installedKwp, activeYield ?? 950) : null

  const hasBattery = selectedProducts.some(sp => sp.product.category === 'BATTERY')
  const consumptionKwh = annualConsumptionKwh ? parseFloat(annualConsumptionKwh) : NaN
  const selfConsumptionRate =
    annualYield && !isNaN(consumptionKwh) && consumptionKwh > 0
      ? estimateSelfConsumptionRate(annualYield, consumptionKwh, hasBattery)
      : annualYield
        ? estimateSelfConsumptionRate(annualYield, annualYield, hasBattery) // assume balanced when unknown
        : undefined

  const roi =
    annualYield && activeRate && pricing && selfConsumptionRate != null
      ? calculateRoi({
          annualKwhYield: annualYield,
          rateRappenPerKwh: activeRate,
          feedInRateRappenPerKwh: feedInRateCtKwh,
          selfConsumptionRate,
          investmentRappen: pricing.sellingPriceIncVatRappen,
        })
      : null

  // Financial incentives (shown whenever panels are present)
  const pronovoSubsidyRappen = installedKwp >= 2
    ? calculatePronovoSubsidy(installedKwp)
    : undefined
  const taxSavingsRappen = pricing
    ? estimateTaxSavings(pricing.sellingPriceExVatRappen)
    : undefined
  const effectiveInvestmentRappen =
    pricing && pronovoSubsidyRappen != null && taxSavingsRappen != null
      ? Math.max(0, pricing.sellingPriceIncVatRappen - pronovoSubsidyRappen - taxSavingsRappen)
      : undefined
  const paybackYearsWithSubsidy =
    roi && effectiveInvestmentRappen != null && roi.annualSavingsRappen > 0
      ? Math.round((effectiveInvestmentRappen / roi.annualSavingsRappen) * 10) / 10
      : undefined

  // Extract brand from product name
  const getBrand = (name: string): string => {
    const brands = ['Huawei', 'Fronius', 'Jinko', 'Longi', 'LONGi', 'Aiko', 'BYD', 'SMA', 'ABB', 'Solaredge', 'SolarEdge', 'Enphase']
    const lower = name.toLowerCase()
    for (const brand of brands) {
      if (lower.includes(brand.toLowerCase())) return brand
    }
    return name.split(' ')[0]
  }

  const CATEGORY_ORDER = ['PANEL', 'INVERTER', 'BATTERY', 'EV_CHARGER', 'ACCESSORY', 'MOUNTING']
  const CATEGORY_LABELS: Record<string, string> = {
    PANEL: t('cat_panel'),
    INVERTER: t('cat_inverter'),
    BATTERY: t('cat_battery'),
    MOUNTING: t('cat_mounting'),
    ACCESSORY: t('cat_accessory'),
    EV_CHARGER: t('cat_ev_charger'),
  }

  // Group by category, then brand within category
  const byCategory = products.reduce<Record<string, Record<string, Product[]>>>((acc, p) => {
    if (!acc[p.category]) acc[p.category] = {}
    const brand = getBrand(p.name)
    if (!acc[p.category][brand]) acc[p.category][brand] = []
    acc[p.category][brand].push(p)
    return acc
  }, {})

  // Only show tabs for categories that have products, in workflow order
  const availableCategories = CATEGORY_ORDER.filter(cat => Object.keys(byCategory[cat] ?? {}).length > 0)

  const [activeCategory, setActiveCategory] = useState<string>(availableCategories[0] ?? 'PANEL')

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
    roofType,
    roofSlope,
    yieldKwhPerKwp: activeYield,
    rateRappenPerKwh: activeRate ?? undefined,
    selfConsumptionRatePct: selfConsumptionRate != null ? Math.round(selfConsumptionRate * 100) : undefined,
    feedInRateRappenPerKwh: feedInRateCtKwh,
    annualConsumptionKwh: annualConsumptionKwh ? Math.round(parseFloat(annualConsumptionKwh)) : undefined,
    mapLat: mapState?.lat,
    mapLon: mapState?.lon,
    mapZoom: mapState?.zoom,
    ...projectInfo,
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
      // Step 1: create the quote with project info
      const createRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: projectInfo.customerName || undefined,
          customerEmail: projectInfo.customerEmail || undefined,
          customerPhone: projectInfo.customerPhone || undefined,
          customerZip: customerZip || undefined,
          siteAddress: projectInfo.siteAddress || undefined,
          notes: projectInfo.notes || undefined,
          mapLat: mapState?.lat,
          mapLon: mapState?.lon,
          mapZoom: mapState?.zoom,
        }),
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
        {/* Project Information */}
        <div className="card-padded">
          <div className="section-title mb-4">Informations du projet</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Client</label>
              <input type="text" className="input" placeholder="Nom du client"
                value={projectInfo.customerName}
                onChange={e => setProjectInfo(p => ({...p, customerName: e.target.value}))} />
            </div>
            <div>
              <label className="label">Adresse du site</label>
              <AddressSearch
                value={projectInfo.siteAddress}
                onChange={val => setProjectInfo(p => ({...p, siteAddress: val}))}
                onSelect={(address, lat, lon, zip, commune) => {
                  setProjectInfo(p => ({...p, siteAddress: address}))
                  setMapState(prev => ({ lat, lon, zoom: prev?.zoom ?? 17 }))
                  if (zip) {
                    setSiteInfo(null)
                    setFetchingSiteInfo(true)
                    const params = new URLSearchParams({ zip, lat: String(lat), lon: String(lon) })
                    if (commune) params.set('commune', commune)
                    fetch(`/api/site-info?${params}`)
                      .then(r => r.ok ? r.json() : null)
                      .then(d => d && setSiteInfo({
                        rateCtPerKwh: d.rateCtPerKwh,
                        communeName: d.communeName,
                        yieldKwhPerKwp: d.yieldKwhPerKwp,
                      }))
                      .catch(() => {})
                      .finally(() => setFetchingSiteInfo(false))
                  }
                }}
              />
              {/* Electricity rate + solar yield from address selection */}
              {fetchingSiteInfo && (
                <p className="text-xs text-gray-400 mt-1">Chargement tarif &amp; production…</p>
              )}
              {!fetchingSiteInfo && siteInfo != null && (siteInfo.rateCtPerKwh != null || siteInfo.yieldKwhPerKwp != null) && (
                <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                  {siteInfo.rateCtPerKwh != null && (
                    <div>
                      {siteInfo.communeName && <><strong>{siteInfo.communeName}</strong> · </>}
                      <span className="font-mono tabular-nums">{siteInfo.rateCtPerKwh.toFixed(2)} ct/kWh</span>
                      {' '}<span className="text-gray-400">(ElCom {new Date().getFullYear()})</span>
                    </div>
                  )}
                  {siteInfo.yieldKwhPerKwp != null && (
                    <div className="text-gray-500">
                      ☀ <span className="font-mono tabular-nums font-medium text-gray-700">{siteInfo.yieldKwhPerKwp} kWh/kWp/an</span> <span className="text-gray-400">(PVGIS)</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div>
              <label className="label">Email client</label>
              <input type="email" className="input" placeholder="client@exemple.ch"
                value={projectInfo.customerEmail}
                onChange={e => setProjectInfo(p => ({...p, customerEmail: e.target.value}))} />
            </div>
            <div>
              <label className="label">Téléphone client</label>
              <input type="tel" className="input" placeholder="+41 79 000 00 00"
                value={projectInfo.customerPhone}
                onChange={e => setProjectInfo(p => ({...p, customerPhone: e.target.value}))} />
            </div>
            <div>
              <label className="label">Consommation annuelle (kWh/an)</label>
              <input
                type="number"
                min={0}
                step={100}
                className="input"
                placeholder="ex: 4500 (cf. facture)"
                value={annualConsumptionKwh}
                onChange={e => setAnnualConsumptionKwh(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Notes internes..."
                value={projectInfo.notes}
                onChange={e => setProjectInfo(p => ({...p, notes: e.target.value}))} />
            </div>
          </div>
        </div>

        {/* Installation Configuration */}
        <div className="card-padded">
          <div className="section-title mb-4">Configuration de l&apos;installation</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Type de toiture</label>
              <select className="input" value={roofType} onChange={e => { setRoofType(e.target.value as RoofType); setIsDirty(true) }}>
                <option value="tuile">Tuile</option>
                <option value="ardoise">Ardoise</option>
                <option value="bac_acier">Bac acier / Métal</option>
                <option value="plat">Toiture plate</option>
              </select>
            </div>
            <div>
              <label className="label">Complexité / Inclinaison</label>
              <select className="input" value={roofSlope} onChange={e => { setRoofSlope(e.target.value as RoofSlope); setIsDirty(true) }}>
                <option value="simple">Simple (≤30°)</option>
                <option value="moyen">Moyenne (30–45°)</option>
                <option value="complexe">Complexe (&gt;45° ou configuration difficile)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Aerial site map */}
        {mapState && (
          <div className="card-padded">
            <div className="section-title mb-3">Vue aérienne du site</div>
            <p className="text-xs text-gray-500 mb-3">
              Déplacez le marqueur rouge pour centrer la vue sur le toit. La carte sera incluse dans le PDF.
            </p>
            <SiteMap
              initialLat={mapState.lat}
              initialLon={mapState.lon}
              initialZoom={mapState.zoom}
              onPositionChange={(lat, lon, zoom) => setMapState({ lat, lon, zoom })}
            />
          </div>
        )}

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

        {/* Product selection — category tabs */}
        <div className="card-padded">
          {/* Tab strip */}
          <div className="flex gap-1 mb-5 border-b border-gray-100 -mx-5 px-5">
            {availableCategories.map((cat) => {
              const selectedCount = selectedProducts.filter(sp => sp.product.category === cat).reduce((s, sp) => s + sp.quantity, 0)
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-t transition-colors relative -mb-px border-b-2 ${
                    isActive
                      ? 'text-red-600 border-red-500 bg-white'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200'
                  }`}
                >
                  {CATEGORY_LABELS[cat]}
                  {selectedCount > 0 && (
                    <span className={`inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-semibold ${
                      isActive ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {selectedCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Active category — products grouped by brand */}
          <div className="space-y-5">
            {Object.keys(byCategory[activeCategory] ?? {}).sort().map((brand) => (
              <div key={brand}>
                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">{brand}</div>
                <div className="space-y-2">
                  {byCategory[activeCategory][brand].map((product) => {
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
          </div>
        </div>

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
            selfConsumedKwh={roi?.selfConsumedKwh}
            exportedKwh={roi?.exportedKwh}
            selfConsumptionRate={roi?.selfConsumptionRate}
            selfConsumptionSavingsRappen={roi?.selfConsumptionSavingsRappen}
            exportRevenueRappen={roi?.exportRevenueRappen}
            feedInRateCtKwh={feedInRateCtKwh}
            onFeedInRateChange={setFeedInRateCtKwh}
            pronovoSubsidyRappen={pronovoSubsidyRappen}
            taxSavingsRappen={taxSavingsRappen}
            effectiveInvestmentRappen={effectiveInvestmentRappen}
            paybackYearsWithSubsidy={paybackYearsWithSubsidy}
            rateRappenPerKwh={activeRate ?? undefined}
            yieldKwhPerKwp={activeYield ?? undefined}
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
