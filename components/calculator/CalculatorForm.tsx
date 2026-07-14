'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { calculateIonPrice, calculateRoi, estimateAnnualYield, estimateSelfConsumptionRate, sumInstalledKwp, calculatePronovoSubsidy, estimateTaxSavings, applyDiscount, formatChf, IonPricingCoefficients, RoofType, RoofSlope } from '@/lib/pricing'
import PriceSummaryCard from './PriceSummaryCard'
import { useFormDraft, draftAgeLabel } from '@/lib/use-form-draft'
import { useLanguage } from '@/context/LanguageContext'
import AddressSearch from './AddressSearch'
import CustomerSearch from './CustomerSearch'
import AiPromptDialog, { type AiProposedDraft, type AiSibling } from './AiPromptDialog'
import { Card, EmptyState, SectionHeader } from '@/components/ui'

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

/**
 * Snapshot of an existing quote used to prefill the form in edit mode
 * (?quoteId=). Built server-side by the calculator page from the quote +
 * its first matching scenario. Before this existed, « Modifier » opened a
 * blank form and a hasty save destroyed the previous configuration.
 */
export interface CalculatorInitial {
  customerName: string
  customerEmail: string
  customerPhone: string
  siteAddress: string
  notes: string
  customerZip: string
  roofType: RoofType | null
  roofSlope: RoofSlope | null
  annualConsumptionKwh: number | null
  feedInRateCtKwh: number | null
  rateCtPerKwh: number | null
  yieldKwhPerKwp: number | null
  mapLat: number | null
  mapLon: number | null
  mapZoom: number | null
  discountBasisPts: number
  discountReason: string
  items: Array<{ productId: string; quantity: number }>
  optionIds: string[]
}

interface CalculatorFormProps {
  products: Product[]
  costOptions: CostOption[]
  vatBasisPts: number
  /** Minimum allowable effective margin (basis points). Discounts below this require approval. */
  minMarginBasisPts: number
  ionCoefficients: IonPricingCoefficients
  quoteId?: string
  /** Edit-mode prefill (present only when quoteId matches an existing quote). */
  initial?: CalculatorInitial | null
  onSaved?: (quoteId: string) => void
}

export default function CalculatorForm({
  products,
  costOptions,
  vatBasisPts,
  minMarginBasisPts,
  ionCoefficients,
  quoteId,
  initial,
  onSaved,
}: CalculatorFormProps) {
  const { t } = useLanguage()
  const router = useRouter()
  const [selectedProducts, setSelectedProducts] = useState<SelectedProduct[]>(() =>
    initial
      ? initial.items.flatMap((it) => {
          // Catalog products can be deactivated since the quote was saved —
          // skip silently (same safety net as applyAiDraft).
          const product = products.find((p) => p.id === it.productId)
          return product ? [{ product, quantity: it.quantity }] : []
        })
      : []
  )
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(
    () => new Set(initial?.optionIds ?? [])
  )
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedQuoteNumber, setSavedQuoteNumber] = useState<string | null>(null)
  const [projectInfo, setProjectInfo] = useState({
    customerName: initial?.customerName ?? '',
    customerEmail: initial?.customerEmail ?? '',
    customerPhone: initial?.customerPhone ?? '',
    siteAddress: initial?.siteAddress ?? '',
    notes: initial?.notes ?? '',
  })
  const [roofType, setRoofType] = useState<RoofType>(initial?.roofType ?? 'tuile')
  const [roofSlope, setRoofSlope] = useState<RoofSlope>(initial?.roofSlope ?? 'simple')
  /** 4-digit NPA from the address autocomplete — persisted on the quote so
   *  customer dedupe (name+zip), the list NPA column, and canton resolution
   *  work. Previously dropped after the site-info fetch. */
  const [customerZip, setCustomerZip] = useState<string>(initial?.customerZip ?? '')
  const [annualConsumptionKwh, setAnnualConsumptionKwh] = useState<string>(
    initial?.annualConsumptionKwh != null ? String(initial.annualConsumptionKwh) : ''
  )
  /** Feed-in tariff in ct/kWh — editable, default Swiss average */
  const [feedInRateCtKwh, setFeedInRateCtKwh] = useState<number>(
    initial?.feedInRateCtKwh ?? 8
  )
  const [mapState, setMapState] = useState<{ lat: number; lon: number; zoom: number } | null>(
    initial?.mapLat != null && initial?.mapLon != null
      ? { lat: initial.mapLat, lon: initial.mapLon, zoom: initial.mapZoom ?? 17 }
      : null
  )
  const [siteInfo, setSiteInfo] = useState<{
    rateCtPerKwh: number | null
    feedInCtPerKwh: number | null
    operatorName: string | null
    communeName: string | null
    yieldKwhPerKwp: number | null
  } | null>(
    // Edit mode: restore the stored tariff + yield so pricing/ROI display
    // matches the saved scenario without re-picking the address.
    initial && (initial.rateCtPerKwh != null || initial.yieldKwhPerKwp != null)
      ? {
          rateCtPerKwh: initial.rateCtPerKwh,
          feedInCtPerKwh: initial.feedInRateCtKwh,
          operatorName: null,
          communeName: null,
          yieldKwhPerKwp: initial.yieldKwhPerKwp,
        }
      : null
  )
  const [fetchingSiteInfo, setFetchingSiteInfo] = useState(false)
  /** Rep-chosen discount on the engine-computed price (basis points; 500 = 5%). */
  const [discountBasisPts, setDiscountBasisPts] = useState<number>(initial?.discountBasisPts ?? 0)
  const [discountReason, setDiscountReason] = useState<string>(initial?.discountReason ?? '')
  /** AI prompt dialog open state */
  const [aiOpen, setAiOpen] = useState(false)
  /**
   * AI tier metadata. Set when the rep applies an AI proposal; cleared when
   * the rep manually adjusts products to a non-AI configuration. Travels with
   * the save payload so the PUT handler can persist all 3 scenarios with
   * tier values for /present/[shareToken] Screen 2.
   */
  const [aiTier, setAiTier] = useState<'essentiel' | 'recommande' | 'premium' | null>(null)
  const [aiSiblings, setAiSiblings] = useState<AiSibling[] | null>(null)

  // ── Draft autosave + unload guard ─────────────────────────────────────────
  // Everything the rep can type/pick, serialized. Restored via the banner
  // below; cleared on successful save.
  const draftSnapshot = {
    projectInfo,
    customerZip,
    roofType,
    roofSlope,
    annualConsumptionKwh,
    feedInRateCtKwh,
    mapState,
    discountBasisPts,
    discountReason,
    items: selectedProducts.map((sp) => ({ productId: sp.product.id, quantity: sp.quantity })),
    optionIds: Array.from(selectedOptions),
    aiTier,
    aiSiblings,
  }
  const draft = useFormDraft(`calc-draft:pv:${quoteId ?? 'new'}`, draftSnapshot)

  const restoreDraft = () => {
    if (!draft.pending) return
    const d = draft.pending.data
    setProjectInfo(d.projectInfo)
    setCustomerZip(d.customerZip)
    setRoofType(d.roofType)
    setRoofSlope(d.roofSlope)
    setAnnualConsumptionKwh(d.annualConsumptionKwh)
    setFeedInRateCtKwh(d.feedInRateCtKwh)
    setMapState(d.mapState)
    setDiscountBasisPts(d.discountBasisPts)
    setDiscountReason(d.discountReason)
    setSelectedProducts(
      d.items.flatMap((it) => {
        const product = products.find((p) => p.id === it.productId)
        return product ? [{ product, quantity: it.quantity }] : []
      })
    )
    setSelectedOptions(new Set(d.optionIds))
    setAiTier(d.aiTier)
    setAiSiblings(d.aiSiblings)
    setIsDirty(true)
    draft.dismissPending()
  }

  /**
   * Apply an AI-proposed draft to the form. Replaces selected products with
   * the AI's proposal (rep can still tweak), updates customer info / roof
   * attrs / consumption only when the rep didn't have a value already (so we
   * never overwrite their work).
   */
  const applyAiDraft = (draft: AiProposedDraft) => {
    // Map proposed productIds back to full Product objects. The AI may have
    // referenced products that aren't in the current `products` prop (e.g.
    // PAC products on a PV calculator); skip silently — the parse-project
    // server already filtered those, so this is just a safety net.
    const productById = new Map(products.map((p) => [p.id, p]))
    const newSelected: SelectedProduct[] = []
    for (const item of draft.items) {
      const product = productById.get(item.productId)
      if (product) newSelected.push({ product, quantity: item.quantity })
    }
    setSelectedProducts(newSelected)
    setIsDirty(true)

    // Customer fields — only fill empty ones (don't trample what the rep typed)
    setProjectInfo((p) => ({
      ...p,
      customerName: p.customerName || draft.customerInfo.name || '',
      siteAddress: p.siteAddress || draft.customerInfo.siteAddress || '',
    }))

    if (draft.customerInfo.annualConsumptionKwh && !annualConsumptionKwh) {
      setAnnualConsumptionKwh(String(draft.customerInfo.annualConsumptionKwh))
    }

    if (draft.roofType) setRoofType(draft.roofType)
    if (draft.roofSlope) setRoofSlope(draft.roofSlope)

    // Track tier + siblings for save-time multi-scenario persistence.
    setAiTier(draft.tier ?? null)
    setAiSiblings(draft.aiSiblings ?? null)
  }

  const ionProducts = selectedProducts.map((sp) => ({
    category: sp.product.category,
    costRappen: sp.product.costRappen,
    quantity: sp.quantity,
  }))

  const ionOptions = Array.from(selectedOptions).map((id) => {
    const opt = costOptions.find((o) => o.id === id)!
    return { costRappen: opt.costRappen }
  })

  const enginePricing =
    ionProducts.length > 0 || ionOptions.length > 0
      ? calculateIonPrice(ionProducts, ionOptions, ionCoefficients, roofType, roofSlope)
      : null

  // Apply rep-chosen discount on top of engine pricing. When discount = 0,
  // discounted figures equal engine figures (passes through).
  const discountResult = enginePricing
    ? applyDiscount({
        sellingExVatRappen: enginePricing.sellingPriceExVatRappen,
        totalCostRappen: Math.round(
          (enginePricing.sellingPriceExVatRappen * (10000 - enginePricing.effectiveMarginBasisPts)) / 10000
        ),
        discountBasisPts,
        minMarginBasisPts,
        vatBasisPts,
      })
    : null

  // Final pricing object passed to the summary card — engine numbers
  // overridden with discounted versions when discount > 0.
  const pricing = enginePricing && discountResult
    ? {
        ...enginePricing,
        sellingPriceExVatRappen: discountResult.discountedExVatRappen,
        vatRappen: discountResult.vatRappen,
        sellingPriceIncVatRappen: discountResult.discountedIncVatRappen,
        effectiveMarginBasisPts:
          discountBasisPts > 0
            ? discountResult.effectiveMarginAfterDiscountBps
            : enginePricing.effectiveMarginBasisPts,
      }
    : null

  const requiresApproval = discountResult?.requiresApproval ?? false

  const panels = selectedProducts
    .filter((sp) => sp.product.category === 'PANEL' && sp.product.powerWp)
    .map((sp) => ({ powerWp: sp.product.powerWp!, quantity: sp.quantity }))

  const installedKwp = sumInstalledKwp(panels)
  const activeYield = siteInfo?.yieldKwhPerKwp ?? undefined
  const activeRate = siteInfo?.rateCtPerKwh ?? undefined
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
    discountBasisPts,
    discountReason: discountBasisPts > 0 && discountReason.trim() ? discountReason.trim() : undefined,
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
    // AI multi-scenario fields. When `tier` + `aiSiblings` are set, the PUT
    // handler creates 3 scenarios (the primary from form state + 2 siblings
    // from the as-AI-proposed items). When absent, legacy 1-scenario behavior.
    tier: aiTier ?? undefined,
    aiSiblings: aiSiblings ?? undefined,
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
      draft.clear()
      onSaved?.(quoteId)
      // Land on the quote page — where Envoyer / Démo client / documents
      // live. Saving used to dead-end on the calculator with a banner.
      router.push(`/quotes/${quoteId}`)
    } finally {
      setIsSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteId, pricing, selectedProducts, selectedOptions, onSaved, router])

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
      draft.clear()
      setSavedQuoteNumber(newQuote.quoteNumber)
      onSaved?.(newQuote.id)
      // Land on the quote page — where Envoyer / Démo client / documents
      // live. Saving used to dead-end back on the calculator.
      router.push(`/quotes/${newQuote.id}`)
    } finally {
      setIsSaving(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pricing, selectedProducts, selectedOptions, onSaved, router])

  return (
    <>
      {draft.pending && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="flex-1">
            Brouillon non enregistré trouvé ({draftAgeLabel(draft.pending.at)}).
          </span>
          <button type="button" onClick={restoreDraft} className="btn-primary text-xs px-3 py-1.5">
            Restaurer
          </button>
          <button
            type="button"
            onClick={draft.dismissPending}
            className="text-xs text-amber-700 hover:text-amber-900 px-1"
          >
            Ignorer
          </button>
        </div>
      )}
    <div className="flex flex-col lg:flex-row gap-6">
      <AiPromptDialog
        scenarioType="PV"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={applyAiDraft}
      />

      {/* Left: form */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Quick-start: AI prompt */}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg py-3 transition-colors"
        >
          <span className="text-base">✨</span>
          <span>Décrire le projet — l&apos;assistant remplit le formulaire</span>
        </button>

        {/* Project Information */}
        <div className="card-padded">
          <SectionHeader
            step={1}
            title="Client"
            description="Coordonnées du client et adresse du site"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Client</label>
              <CustomerSearch
                value={projectInfo.customerName}
                onChange={(v) => setProjectInfo(p => ({...p, customerName: v}))}
                onPick={(c) => {
                  setProjectInfo(p => ({
                    ...p,
                    customerName: c.name,
                    customerEmail: c.email ?? p.customerEmail,
                    customerPhone: c.phone ?? p.customerPhone,
                  }))
                  if (c.zip) setCustomerZip(c.zip)
                }}
              />
            </div>
            <div>
              <label className="label">Adresse du site</label>
              <AddressSearch
                value={projectInfo.siteAddress}
                onChange={val => setProjectInfo(p => ({...p, siteAddress: val}))}
                onSelect={(address, lat, lon, zip, commune) => {
                  setProjectInfo(p => ({...p, siteAddress: address}))
                  setMapState(prev => ({ lat, lon, zoom: prev?.zoom ?? 17 }))
                  if (zip) setCustomerZip(zip)
                  if (zip) {
                    setSiteInfo(null)
                    setFetchingSiteInfo(true)
                    const params = new URLSearchParams({ zip, lat: String(lat), lon: String(lon) })
                    if (commune) params.set('commune', commune)
                    fetch(`/api/site-info?${params}`)
                      .then(r => r.ok ? r.json() : null)
                      .then(d => {
                        if (!d) return
                        setSiteInfo({
                          rateCtPerKwh: d.rateCtPerKwh,
                          feedInCtPerKwh: d.feedInCtPerKwh,
                          operatorName: d.operatorName,
                          communeName: d.communeName,
                          yieldKwhPerKwp: d.yieldKwhPerKwp,
                        })
                        // Prefill the feed-in tariff with the local operator's
                        // published rate (rep can still edit it afterwards).
                        if (typeof d.feedInCtPerKwh === 'number' && d.feedInCtPerKwh > 0) {
                          setFeedInRateCtKwh(Math.round(d.feedInCtPerKwh * 10) / 10)
                        }
                      })
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
                  {siteInfo.feedInCtPerKwh != null && (
                    <div className="text-gray-500">
                      ↩ Reprise <span className="font-mono tabular-nums font-medium text-gray-700">{siteInfo.feedInCtPerKwh.toFixed(2)} ct/kWh</span>
                      {siteInfo.operatorName && <span className="text-gray-400"> ({siteInfo.operatorName})</span>}
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
            <div className="sm:col-span-2">
              <label className="label">Notes</label>
              <textarea className="input resize-none" rows={2} placeholder="Notes internes..."
                value={projectInfo.notes}
                onChange={e => setProjectInfo(p => ({...p, notes: e.target.value}))} />
            </div>
          </div>
        </div>

        {/* Installation Configuration */}
        <div className="card-padded">
          <SectionHeader
            step={2}
            title="Configuration de l&apos;installation"
            description="Type de toiture et complexité d&apos;intégration"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <SectionHeader
              title="Vue aérienne du site"
              description="Déplacez le marqueur rouge pour centrer la vue. La carte sera incluse dans le PDF."
            />
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
          <SectionHeader
            step={3}
            title="Équipement"
            description="Sélectionner panneaux, onduleurs, batterie et accessoires"
          />
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
            <SectionHeader
              step={4}
              title={t('calc_surcharges')}
              description="Suppléments optionnels (échafaudage, complexité…)"
            />
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
      <div className="w-full lg:w-72 lg:flex-shrink-0">
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
            rateRappenPerKwh={activeRate}
            yieldKwhPerKwp={activeYield}
            discountBasisPts={discountBasisPts}
            onDiscountChange={(bps) => { setDiscountBasisPts(bps); setIsDirty(true) }}
            discountReason={discountReason}
            onDiscountReasonChange={(s) => { setDiscountReason(s); setIsDirty(true) }}
            requiresApproval={requiresApproval}
            minMarginBasisPts={minMarginBasisPts}
            isDirty={isDirty}
            isSaving={isSaving}
            onSave={quoteId ? handleSave : undefined}
            onSaveAsNew={!quoteId ? handleSaveAsNewQuote : undefined}
          />
        ) : (
          <Card padding="none" className="sticky top-6">
            <EmptyState
              compact
              icon={
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Le panier est vide"
              description="Sélectionnez des panneaux, onduleurs ou batteries pour voir le prix de vente et les indicateurs ROI apparaître ici."
            />
          </Card>
        )}
      </div>
    </div>
    {/* Mobile sticky bar — below lg the price card (and its save button)
        sits under ~6 cards of form; keep the total + save in thumb reach. */}
    {pricing && (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white/95 backdrop-blur px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-lg font-bold font-mono tabular-nums text-gray-900 leading-none truncate">
            {formatChf(pricing.sellingPriceIncVatRappen)}
          </div>
          <div className="text-[10px] text-gray-500 uppercase tracking-wider">Total TTC</div>
        </div>
        <button
          type="button"
          onClick={quoteId ? handleSave : handleSaveAsNewQuote}
          disabled={isSaving}
          className="btn-primary text-sm px-5 py-2.5"
        >
          {isSaving ? '…' : 'Enregistrer'}
        </button>
      </div>
    )}
    {/* Spacer so the fixed bar never covers the last card on mobile */}
    {pricing && <div className="h-16 lg:hidden" aria-hidden="true" />}
    </>
  )
}
