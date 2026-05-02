'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import {
  calculatePacPrice,
  applyDiscount,
  PacPricingCoefficients,
  PacPricingBreakdown,
  formatChf,
  formatPct,
} from '@/lib/pricing'
import { useLanguage } from '@/context/LanguageContext'
import { Card, EmptyState, SectionHeader } from '@/components/ui'
import AddressSearch from './AddressSearch'
import AiPromptDialog, { type AiProposedDraft } from './AiPromptDialog'

// SiteMap uses Leaflet (DOM-only) — load client-side only
const SiteMap = dynamic(() => import('./SiteMap'), { ssr: false })

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
  /** Minimum allowable effective margin (basis points). Discounts below require approval. */
  minMarginBasisPts: number
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
  minMarginBasisPts,
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
  /** Rep-chosen discount on the engine-computed PAC price (basis points). */
  const [discountBasisPts, setDiscountBasisPts] = useState<number>(0)
  const [discountReason, setDiscountReason] = useState<string>('')
  /**
   * Aerial site map state — set when the rep picks an address from the
   * autocomplete; user can then drag the marker to fine-tune. Persisted on
   * scenario save so the PDF can render the map. (Same shape as PV form.)
   */
  const [mapState, setMapState] = useState<{ lat: number; lon: number; zoom: number } | null>(null)
  /**
   * Site info auto-populated from the address ZIP — for PAC we mainly use the
   * commune name (ElCom rate is informational, not used in PAC pricing).
   */
  const [siteInfo, setSiteInfo] = useState<{
    rateCtPerKwh: number | null
    communeName: string | null
  } | null>(null)
  const [fetchingSiteInfo, setFetchingSiteInfo] = useState(false)
  /** AI prompt dialog open state */
  const [aiOpen, setAiOpen] = useState(false)

  /**
   * Apply an AI-proposed draft. Replaces selected products with the AI's
   * proposal and fills empty customer fields. Doesn't touch fields the rep
   * already filled.
   */
  const applyAiDraft = (draft: AiProposedDraft) => {
    const productById = new Map(products.map((p) => [p.id, p]))
    const newSelected: SelectedProduct[] = []
    for (const item of draft.items) {
      const product = productById.get(item.productId)
      if (product) newSelected.push({ product, quantity: item.quantity })
    }
    setSelectedProducts(newSelected)
    setIsDirty(true)

    setProjectInfo((p) => ({
      ...p,
      customerName: p.customerName || draft.customerInfo.name || '',
      siteAddress: p.siteAddress || draft.customerInfo.siteAddress || '',
    }))
  }

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

  const enginePricing =
    selectedProducts.length > 0
      ? calculatePacPrice(pacProducts, pacCoefficients)
      : null

  // Apply rep-chosen discount on engine output. Pass-through when discount = 0.
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

  // Final pricing with discount baked into the headline numbers.
  const pricing: PacPricingBreakdown | null = enginePricing && discountResult
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
    discountBasisPts,
    discountReason: discountBasisPts > 0 && discountReason.trim() ? discountReason.trim() : undefined,
    ...projectInfo,
    // Map position — persisted on the scenario for PDF rendering
    mapLat: mapState?.lat,
    mapLon: mapState?.lon,
    mapZoom: mapState?.zoom,
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
      // Step 1: create quote with project info + map position
      const createRes = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: projectInfo.customerName || undefined,
          customerEmail: projectInfo.customerEmail || undefined,
          customerPhone: projectInfo.customerPhone || undefined,
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
      <AiPromptDialog
        scenarioType="PAC"
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onApply={applyAiDraft}
      />

      {/* Left: form */}
      <div className="flex-1 space-y-6 min-w-0">
        {/* Quick-start: AI prompt — orange accent matches PAC theme */}
        <button
          type="button"
          onClick={() => setAiOpen(true)}
          className="w-full flex items-center justify-center gap-2 text-sm font-medium text-orange-700 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg py-3 transition-colors"
        >
          <span className="text-base">✨</span>
          <span>Décrire le projet — l&apos;assistant remplit le formulaire</span>
        </button>

        {/* Project Information */}
        <div className="card-padded">
          <SectionHeader
            step={1}
            title="Client"
            description="Coordonnées du client et site d&apos;installation"
          />
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
              <AddressSearch
                value={projectInfo.siteAddress}
                onChange={(val) => setProjectInfo((p) => ({ ...p, siteAddress: val }))}
                onSelect={(address, lat, lon, zip, commune) => {
                  setProjectInfo((p) => ({ ...p, siteAddress: address }))
                  setMapState((prev) => ({ lat, lon, zoom: prev?.zoom ?? 17 }))
                  setIsDirty(true)
                  if (zip) {
                    setSiteInfo(null)
                    setFetchingSiteInfo(true)
                    const params = new URLSearchParams({
                      zip,
                      lat: String(lat),
                      lon: String(lon),
                    })
                    if (commune) params.set('commune', commune)
                    fetch(`/api/site-info?${params}`)
                      .then((r) => (r.ok ? r.json() : null))
                      .then(
                        (d) =>
                          d &&
                          setSiteInfo({
                            rateCtPerKwh: d.rateCtPerKwh,
                            communeName: d.communeName,
                          })
                      )
                      .catch(() => {})
                      .finally(() => setFetchingSiteInfo(false))
                  }
                }}
              />
              {fetchingSiteInfo && (
                <p className="text-xs text-gray-400 mt-1">Chargement…</p>
              )}
              {!fetchingSiteInfo && siteInfo?.communeName && (
                <p className="mt-1.5 text-xs text-gray-600">
                  <strong>{siteInfo.communeName}</strong>
                </p>
              )}
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

        {/* Aerial site map — appears once an address is selected. The map
            position (lat/lon/zoom) is persisted on the scenario so the PDF
            shows the same view the rep configured. */}
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
              onPositionChange={(lat, lon, zoom) => {
                setMapState({ lat, lon, zoom })
                setIsDirty(true)
              }}
            />
          </div>
        )}

        {/* Product selection — PAC category tabs */}
        <div className="card-padded">
          <SectionHeader
            step={2}
            title="Postes de l&apos;installation"
            description="Machine, accessoires, électricité, maçonnerie, etc."
          />
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

        {/* Cercle de bruit — Federal Swiss heat-pump noise verification.
            Required regulatory check before installation. Provides a
            deep-link to the FWS (Foederation Waermepumpen Schweiz) tool. */}
        <div className="card-padded">
          <SectionHeader
            title="Cercle de bruit"
            description="Vérification réglementaire du bruit de la pompe à chaleur (OFEV / FWS)"
          />
          <div className="flex items-start gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
            <svg
              className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
              />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-amber-900 font-medium">
                Calcul des distances minimales aux limites de propriété
              </p>
              <p className="text-xs text-amber-800 mt-1">
                L&apos;outil officiel FWS calcule la distance réglementaire entre la PAC
                et le voisinage en fonction du niveau sonore. À effectuer avant
                la commande pour les installations extérieures.
              </p>
              <a
                href="https://www.fws.ch/fr/cercle-bruit/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-3 text-sm font-medium text-amber-900 hover:text-amber-700 underline decoration-amber-400 underline-offset-2"
              >
                Ouvrir l&apos;outil cercle de bruit FWS
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                  aria-hidden
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
              </a>
            </div>
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
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 16.121A3 3 0 1012.015 11L11 14H9c0 .768.293 1.536.879 2.121z" />
                </svg>
              }
              title="Aucune machine sélectionnée"
              description="Choisissez une pompe à chaleur et les postes associés pour voir la structure de coût et le prix TTC."
            />
          </Card>
        )}
      </div>
    </div>
  )
}

// ─── PAC-specific price summary card ──────────────────────────────────────────

interface PacPriceSummaryCardProps {
  pricing: PacPricingBreakdown
  vatBasisPts: number
  discountBasisPts?: number
  onDiscountChange?: (bps: number) => void
  discountReason?: string
  onDiscountReasonChange?: (reason: string) => void
  requiresApproval?: boolean
  minMarginBasisPts?: number
  isDirty?: boolean
  isSaving?: boolean
  onSave?: () => void
  onSaveAsNew?: () => void
}

function PacPriceSummaryCard({
  pricing,
  vatBasisPts,
  discountBasisPts = 0,
  onDiscountChange,
  discountReason = '',
  onDiscountReasonChange,
  requiresApproval = false,
  minMarginBasisPts,
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

      {/* Discount slider */}
      {onDiscountChange && (
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Rabais commercial
            </label>
            <span className={`text-sm font-mono tabular-nums font-semibold ${
              discountBasisPts === 0
                ? 'text-gray-500'
                : requiresApproval
                  ? 'text-red-600'
                  : 'text-orange-600'
            }`}>
              {(discountBasisPts / 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2000}
            step={25}
            value={discountBasisPts}
            onChange={(e) => onDiscountChange(parseInt(e.target.value, 10))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
            <span>0%</span>
            <span>10%</span>
            <span>20%</span>
          </div>

          {requiresApproval && (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <div className="flex items-start gap-2 text-xs">
                <span className="text-red-600 font-semibold">⚠</span>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">
                    Marge sous le seuil ({minMarginBasisPts != null ? (minMarginBasisPts / 100).toFixed(1) : '20.0'}%) — approbation requise
                  </p>
                  <p className="text-red-700 mt-1">
                    Marge effective: {formatPct(pricing.effectiveMarginBasisPts)}
                  </p>
                </div>
              </div>
              {onDiscountReasonChange && (
                <textarea
                  value={discountReason}
                  onChange={(e) => onDiscountReasonChange(e.target.value)}
                  placeholder="Raison (concurrence, volume, fidélité…)"
                  rows={2}
                  className="mt-2 w-full text-xs border border-red-200 rounded px-2 py-1.5 bg-white resize-none"
                />
              )}
            </div>
          )}
        </div>
      )}

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
