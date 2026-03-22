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
  sumInstalledKwp,
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
  items: Array<{ name: string; quantity: number; category: string }>
  options: Array<{ name: string }>
}

export type FullQuote = NonNullable<Awaited<ReturnType<typeof getFullQuoteForPdf>>>

// ─── Prisma query ─────────────────────────────────────────────────────────────

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

    let annualSavingsRappen: number | null = null
    let paybackYears: number | null = null

    if (annualKwhYield && rateRappenPerKwh && sellingPriceIncVatRappen > 0) {
      const roi = calculateRoi({
        annualKwhYield,
        rateRappenPerKwh,
        investmentRappen: sellingPriceIncVatRappen,
      })
      annualSavingsRappen = roi.annualSavingsRappen
      paybackYears = roi.paybackYears
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
      items: items.map(({ name, quantity, category }) => ({ name, quantity, category })),
      options,
    }
  })
}
