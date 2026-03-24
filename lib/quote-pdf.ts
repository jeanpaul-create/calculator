/**
 * Shared helpers for PDF generation — used by both:
 *   GET /api/quotes/[id]/pdf   (download)
 *   POST /api/quotes/[id]/send (email)
 *
 * Data flow:
 *
 *   getFullQuoteForPdf(id)
 *     └─► prisma (quote + rep + scenarios + items[product] + options[option])
 *
 *   buildPricedScenarios(quote)
 *     ├─► stored prices? ──► use sellingPriceExVat/IncVat directly
 *     └─► null prices?  ──► fetch settings ──► calculateIonPrice() (fallback for old quotes)
 *                 │
 *      panels ──► estimateAnnualYield()
 *      rate   ──► calculateRoi() ──► { paybackYears, annualSavingsRappen }
 */

import { prisma } from '@/lib/db'
import {
  calculateIonPrice,
  calculateRoi,
  estimateAnnualYield,
  estimateSelfConsumptionRate,
  sumInstalledKwp,
  calculatePronovoSubsidy,
  estimateTaxSavings,
  DEFAULT_ION_COEFFICIENTS,
  IonPricingCoefficients,
  RoofType,
  RoofSlope,
} from '@/lib/pricing'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface PricedScenario {
  id: string
  name: string
  roofType: string
  roofSlope: string
  vatPctBasisPts: number
  sellingPriceExVatRappen: number
  vatRappen: number
  sellingPriceIncVatRappen: number
  /** Total installed power in kWp (null if no panels) */
  installedKwp: number | null
  /** Total number of panels */
  panelCount: number
  /** Per-panel power in Wp — set only when all panels have the same powerWp */
  panelPowerWp: number | null
  /** null if no panels or no rate data */
  annualKwhYield: number | null
  /** null if ROI cannot be computed */
  annualSavingsRappen: number | null
  paybackYears: number | null
  // ROI split breakdown
  selfConsumptionRatePct: number | null
  selfConsumedKwh: number | null
  exportedKwh: number | null
  selfConsumptionSavingsRappen: number | null
  exportRevenueRappen: number | null
  feedInRateRappenPerKwh: number | null
  annualConsumptionKwh: number | null
  /** Pronovo PRU federal subsidy in Rappen (null if < 2 kWp) */
  pronovoSubsidyRappen: number | null
  /** Estimated income tax savings from deducting installation cost */
  taxSavingsRappen: number | null
  /** Effective investment after subsidies and tax savings */
  effectiveInvestmentRappen: number | null
  /** Payback period recalculated using effectiveInvestmentRappen */
  paybackYearsWithSubsidy: number | null
  /** ElCom tariff used for ROI calculation (ct/kWh), null if not saved */
  rateRappenPerKwh: number | null
  items: Array<{ name: string; quantity: number; category: string }>
  options: Array<{ name: string }>
}

export type FullQuote = NonNullable<Awaited<ReturnType<typeof getFullQuoteForPdf>>>

// ─── Prisma query ─────────────────────────────────────────────────────────────

// ─── Aerial map image fetch (swisstopo WMS) ───────────────────────────────────

// Swiss bounds validation — prevents SSRF outside Switzerland
const SWISS_LAT_MIN = 45.5, SWISS_LAT_MAX = 47.9
const SWISS_LON_MIN = 5.9,  SWISS_LON_MAX = 10.6

export async function fetchMapImageBase64(
  lat: number,
  lon: number,
  zoom: number
): Promise<string | null> {
  if (lat < SWISS_LAT_MIN || lat > SWISS_LAT_MAX || lon < SWISS_LON_MIN || lon > SWISS_LON_MAX) {
    return null
  }
  // Convert zoom level to a reasonable degree offset for the WMS BBOX
  // zoom 17 ≈ 0.005°, zoom 18 ≈ 0.0025°, zoom 16 ≈ 0.01°
  const degOffset = 0.005 * Math.pow(2, 17 - Math.min(Math.max(zoom, 14), 20))
  const bbox = `${lon - degOffset},${lat - degOffset},${lon + degOffset},${lat + degOffset}`
  const url =
    `https://wms.geo.admin.ch/?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
    `&LAYERS=ch.swisstopo.swissimage&CRS=EPSG:4326` +
    `&BBOX=${bbox}&WIDTH=800&HEIGHT=500&FORMAT=image/jpeg`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const buffer = await res.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')
    return `data:image/jpeg;base64,${base64}`
  } catch {
    return null
  }
}

export async function getFullQuoteForPdf(id: string) {
  return prisma.quote.findUnique({
    where: { id },
    include: {
      rep: { select: { name: true, email: true } },
      scenarios: {
        orderBy: { sortOrder: 'asc' },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, category: true, powerWp: true },
              },
            },
          },
          options: {
            include: {
              option: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  })
}

// ─── Settings fetch (used only for NULL-price fallback on old quotes) ─────────

async function fetchIonCoefficients(): Promise<IonPricingCoefficients & { vatBasisPts: number }> {
  const settings = await prisma.setting.findMany({
    where: {
      key: {
        in: [
          'vat_pct_basis_pts',
          'pv_accessories_bps', 'pv_frais_supp_bps', 'pv_transport_bps',
          'pv_labor_panel_rappen', 'pv_labor_inverter_rappen',
          'pv_raccordement_mat_rappen', 'pv_raccordement_labor_rappen',
          'pv_pm_fixed_rappen', 'pv_admin_fixed_rappen',
          'pv_sales_overhead_bps', 'pv_profit_appro_bps', 'pv_profit_constr_bps',
          'bat_pm_bps', 'bat_admin_bps', 'bat_profit_bps',
          'mount_tuile_rappen', 'mount_ardoise_rappen', 'mount_bac_acier_rappen',
          'mount_plat_rappen', 'mount_slope_medium_bps', 'mount_slope_steep_bps',
        ],
      },
    },
  })
  const m = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const D = DEFAULT_ION_COEFFICIENTS
  return {
    vatBasisPts: m['vat_pct_basis_pts'] ?? 810,
    pv_accessories_bps:          m['pv_accessories_bps']          ?? D.pv_accessories_bps,
    pv_frais_supp_bps:           m['pv_frais_supp_bps']           ?? D.pv_frais_supp_bps,
    pv_transport_bps:            m['pv_transport_bps']            ?? D.pv_transport_bps,
    pv_labor_panel_rappen:       m['pv_labor_panel_rappen']       ?? D.pv_labor_panel_rappen,
    pv_labor_inverter_rappen:    m['pv_labor_inverter_rappen']    ?? D.pv_labor_inverter_rappen,
    pv_raccordement_mat_rappen:  m['pv_raccordement_mat_rappen']  ?? D.pv_raccordement_mat_rappen,
    pv_raccordement_labor_rappen:m['pv_raccordement_labor_rappen']?? D.pv_raccordement_labor_rappen,
    pv_pm_fixed_rappen:          m['pv_pm_fixed_rappen']          ?? D.pv_pm_fixed_rappen,
    pv_admin_fixed_rappen:       m['pv_admin_fixed_rappen']       ?? D.pv_admin_fixed_rappen,
    pv_sales_overhead_bps:       m['pv_sales_overhead_bps']       ?? D.pv_sales_overhead_bps,
    pv_profit_appro_bps:         m['pv_profit_appro_bps']         ?? D.pv_profit_appro_bps,
    pv_profit_constr_bps:        m['pv_profit_constr_bps']        ?? D.pv_profit_constr_bps,
    bat_pm_bps:                  m['bat_pm_bps']                  ?? D.bat_pm_bps,
    bat_admin_bps:               m['bat_admin_bps']               ?? D.bat_admin_bps,
    bat_profit_bps:              m['bat_profit_bps']              ?? D.bat_profit_bps,
    mount_tuile_rappen:          m['mount_tuile_rappen']          ?? D.mount_tuile_rappen,
    mount_ardoise_rappen:        m['mount_ardoise_rappen']        ?? D.mount_ardoise_rappen,
    mount_bac_acier_rappen:      m['mount_bac_acier_rappen']      ?? D.mount_bac_acier_rappen,
    mount_plat_rappen:           m['mount_plat_rappen']           ?? D.mount_plat_rappen,
    mount_slope_medium_bps:      m['mount_slope_medium_bps']      ?? D.mount_slope_medium_bps,
    mount_slope_steep_bps:       m['mount_slope_steep_bps']       ?? D.mount_slope_steep_bps,
  }
}

// ─── Price computation ────────────────────────────────────────────────────────

export async function buildPricedScenarios(quote: FullQuote): Promise<PricedScenario[]> {
  // Check if any scenario needs live computation (NULL prices = old quote)
  const needsLiveComputation = quote.scenarios.some(
    (s) => s.sellingPriceExVatRappen == null
  )
  const coefficients = needsLiveComputation ? await fetchIonCoefficients() : null

  return quote.scenarios.map((scenario) => {
    const items = scenario.items.map((item) => ({
      name: item.product.name,
      quantity: item.quantity,
      category: item.product.category as string,
      costRappenSnapshot: item.costRappenSnapshot,
      powerWp: item.product.powerWp,
    }))
    const options = scenario.options.map((o) => ({ name: o.option.name }))

    // Use stored snapshot prices when available; fall back to live computation
    let sellingPriceExVatRappen: number
    let sellingPriceIncVatRappen: number
    const vatPctBasisPts = scenario.vatPctBasisPts

    if (scenario.sellingPriceExVatRappen != null && scenario.sellingPriceIncVatRappen != null) {
      sellingPriceExVatRappen = scenario.sellingPriceExVatRappen
      sellingPriceIncVatRappen = scenario.sellingPriceIncVatRappen
    } else {
      // Fallback: re-compute using current settings (for pre-migration quotes)
      const coeff = coefficients!
      type ProductCategory = 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'
      const ionProducts = scenario.items.map((item) => ({
        category: item.product.category as ProductCategory,
        costRappen: item.costRappenSnapshot,
        quantity: item.quantity,
      }))
      const ionOptions = scenario.options.map((o) => ({
        costRappen: o.costRappenSnapshot,
      }))
      const pricing = calculateIonPrice(
        ionProducts,
        ionOptions,
        coeff,
        (scenario.roofType ?? 'tuile') as RoofType,
        (scenario.roofSlope ?? 'simple') as RoofSlope,
      )
      sellingPriceExVatRappen = pricing.sellingPriceExVatRappen
      sellingPriceIncVatRappen = pricing.sellingPriceIncVatRappen
    }

    const vatRappen = Math.round(sellingPriceExVatRappen * vatPctBasisPts / 10000)

    // System size
    const panelItems = items.filter((i) => i.category === 'PANEL' && i.powerWp)
    const panelCount = panelItems.reduce((sum, i) => sum + i.quantity, 0)
    const installedKwp = panelItems.length > 0
      ? sumInstalledKwp(panelItems.map((i) => ({ powerWp: i.powerWp!, quantity: i.quantity })))
      : null
    const uniquePowerWps = Array.from(new Set(panelItems.map((i) => i.powerWp!)))
    const panelPowerWp = uniquePowerWps.length === 1 ? uniquePowerWps[0] : null

    // ROI computation — use stored PVGIS factor if available, else fall back to 950
    const yieldFactor = scenario.yieldKwhPerKwp ?? 950
    const annualKwhYield = installedKwp != null ? estimateAnnualYield(installedKwp, yieldFactor) : null
    const rateRappenPerKwh = scenario.rateRappenPerKwh
    const storedFeedInRate = scenario.feedInRateRappenPerKwh
    const storedConsumption = scenario.annualConsumptionKwh

    // Resolve self-consumption rate: use stored value, or derive from consumption, or default
    let selfConsumptionRate: number | null = null
    if (scenario.selfConsumptionRatePct != null) {
      selfConsumptionRate = scenario.selfConsumptionRatePct / 100
    } else if (annualKwhYield) {
      // Legacy fallback: no stored SCR — estimate from consumption if available, else balanced assumption
      const hasBattery = items.some(i => i.category === 'BATTERY')
      selfConsumptionRate = estimateSelfConsumptionRate(
        annualKwhYield,
        storedConsumption ?? annualKwhYield, // balanced assumption if unknown
        hasBattery
      )
    }

    let annualSavingsRappen: number | null = null
    let paybackYears: number | null = null
    let selfConsumedKwh: number | null = null
    let exportedKwh: number | null = null
    let selfConsumptionSavingsRappen: number | null = null
    let exportRevenueRappen: number | null = null

    if (annualKwhYield && rateRappenPerKwh && selfConsumptionRate != null && sellingPriceIncVatRappen > 0) {
      const roi = calculateRoi({
        annualKwhYield,
        rateRappenPerKwh,
        feedInRateRappenPerKwh: storedFeedInRate ?? 8,
        selfConsumptionRate,
        investmentRappen: sellingPriceIncVatRappen,
      })
      annualSavingsRappen = roi.annualSavingsRappen
      paybackYears = roi.paybackYears
      selfConsumedKwh = roi.selfConsumedKwh
      exportedKwh = roi.exportedKwh
      selfConsumptionSavingsRappen = roi.selfConsumptionSavingsRappen
      exportRevenueRappen = roi.exportRevenueRappen
    }

    // Financial incentives
    const pronovoSubsidyRappen = installedKwp != null && installedKwp >= 2
      ? calculatePronovoSubsidy(installedKwp)
      : null
    const taxSavingsRappen = estimateTaxSavings(sellingPriceExVatRappen)

    let effectiveInvestmentRappen: number | null = null
    let paybackYearsWithSubsidy: number | null = null
    if (annualSavingsRappen != null && sellingPriceIncVatRappen > 0) {
      effectiveInvestmentRappen = Math.max(
        0,
        sellingPriceIncVatRappen - (pronovoSubsidyRappen ?? 0) - taxSavingsRappen
      )
      if (annualSavingsRappen > 0) {
        paybackYearsWithSubsidy = Math.round((effectiveInvestmentRappen / annualSavingsRappen) * 10) / 10
      }
    }

    return {
      id: scenario.id,
      name: scenario.name,
      roofType: scenario.roofType ?? 'tuile',
      roofSlope: scenario.roofSlope ?? 'simple',
      vatPctBasisPts,
      sellingPriceExVatRappen,
      vatRappen,
      sellingPriceIncVatRappen,
      installedKwp,
      panelCount,
      panelPowerWp,
      annualKwhYield,
      annualSavingsRappen,
      paybackYears,
      selfConsumptionRatePct: selfConsumptionRate != null ? Math.round(selfConsumptionRate * 100) : null,
      selfConsumedKwh,
      exportedKwh,
      selfConsumptionSavingsRappen,
      exportRevenueRappen,
      feedInRateRappenPerKwh: storedFeedInRate ?? (rateRappenPerKwh ? 8 : null),
      annualConsumptionKwh: storedConsumption ?? null,
      pronovoSubsidyRappen,
      taxSavingsRappen,
      effectiveInvestmentRappen,
      paybackYearsWithSubsidy,
      rateRappenPerKwh: rateRappenPerKwh ?? null,
      items: items.map(({ name, quantity, category }) => ({ name, quantity, category })),
      options,
    }
  })
}
