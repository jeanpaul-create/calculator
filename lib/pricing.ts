/**
 * Pure pricing module — zero DB calls, zero side effects, 100% unit-testable.
 *
 * All monetary values are in Rappen (CHF cents, integers). Never use floats.
 *
 * Data flow:
 *
 *   products (qty × costRappen)  ──┐
 *   cost options (costRappen)    ──┼──▶  subtotalCost
 *                                  │         │
 *                             margin %  ──▶  sellingPriceExVat
 *                                  │         │
 *                              vat %  ─────▶  sellingPriceIncVat
 *                                             │
 *                                        ROI calc ──▶ paybackYears
 */

export interface PricingLineItem {
  /** Product or option cost in Rappen */
  costRappen: number
  quantity: number
}

export interface PricingInput {
  /** Line items (products + cost options combined) */
  items: PricingLineItem[]
  /**
   * Margin as basis points (e.g. 2500 = 25.00%)
   * Applied as: sellingPrice = cost / (1 - margin)
   */
  marginBasisPts: number
  /**
   * VAT as basis points (e.g. 810 = 8.10%)
   */
  vatBasisPts: number
}

export interface PricingResult {
  /** Sum of (costRappen × quantity) for all items */
  subtotalCostRappen: number
  /** Selling price before VAT (margin applied) */
  sellingPriceExVatRappen: number
  /** VAT amount in Rappen */
  vatRappen: number
  /** Selling price including VAT */
  sellingPriceIncVatRappen: number
  /** Effective margin in basis points (should match input) */
  effectiveMarginBasisPts: number
}

export interface RoiInput {
  /** Total system output in kWh per year */
  annualKwhYield: number
  /** Electricity rate in Rappen per kWh */
  rateRappenPerKwh: number
  /** Total investment (selling price inc. VAT) in Rappen */
  investmentRappen: number
}

export interface RoiResult {
  /** Annual savings in Rappen */
  annualSavingsRappen: number
  /** Simple payback period in years (to one decimal) */
  paybackYears: number
  /** Savings over 25 years in Rappen */
  savings25YearsRappen: number
}

/**
 * Calculate selling price from cost items, margin, and VAT.
 *
 * Margin formula:  sellingPrice = totalCost / (1 - marginFraction)
 *   → ensures margin is calculated on selling price, not cost.
 *   e.g. cost=1000, margin=25% → sell=1333.33... → rounded to nearest Rappen
 *
 * @throws if marginBasisPts >= 10000 (100% margin is undefined)
 */
export function calculatePrice(input: PricingInput): PricingResult {
  const { items, marginBasisPts, vatBasisPts } = input

  if (marginBasisPts >= 10000) {
    throw new Error('marginBasisPts must be < 10000 (100%)')
  }
  if (marginBasisPts < 0) {
    throw new Error('marginBasisPts must be >= 0')
  }
  if (vatBasisPts < 0) {
    throw new Error('vatBasisPts must be >= 0')
  }

  // Sum all line items (integer arithmetic throughout)
  const subtotalCostRappen = items.reduce(
    (sum, item) => sum + item.costRappen * item.quantity,
    0
  )

  // Apply margin: sell = cost / (1 - margin)
  // Use basis points: margin fraction = marginBasisPts / 10000
  // sell = cost * 10000 / (10000 - marginBasisPts)
  // Round to nearest Rappen
  const sellingPriceExVatRappen = Math.round(
    (subtotalCostRappen * 10000) / (10000 - marginBasisPts)
  )

  // Apply VAT
  const vatRappen = Math.round((sellingPriceExVatRappen * vatBasisPts) / 10000)
  const sellingPriceIncVatRappen = sellingPriceExVatRappen + vatRappen

  // Compute effective margin for verification
  const effectiveMarginBasisPts =
    subtotalCostRappen === 0
      ? 0
      : Math.round(
          ((sellingPriceExVatRappen - subtotalCostRappen) /
            sellingPriceExVatRappen) *
            10000
        )

  return {
    subtotalCostRappen,
    sellingPriceExVatRappen,
    vatRappen,
    sellingPriceIncVatRappen,
    effectiveMarginBasisPts,
  }
}

/**
 * Simple ROI / payback calculation.
 * Uses a flat annual yield — does not model degradation or rate inflation.
 */
export function calculateRoi(input: RoiInput): RoiResult {
  const { annualKwhYield, rateRappenPerKwh, investmentRappen } = input

  const annualSavingsRappen = Math.round(annualKwhYield * rateRappenPerKwh)

  const paybackYears =
    annualSavingsRappen === 0
      ? Infinity
      : Math.round((investmentRappen / annualSavingsRappen) * 10) / 10

  const savings25YearsRappen = annualSavingsRappen * 25

  return {
    annualSavingsRappen,
    paybackYears,
    savings25YearsRappen,
  }
}

/**
 * Estimate annual kWh yield from installed kWp.
 * Swiss average: ~950 kWh/kWp/year (south-facing, 30° tilt, no shading).
 * Adjust with `yieldFactor` for orientation / shading.
 */
export function estimateAnnualYield(
  installedKwp: number,
  yieldFactor = 950
): number {
  return Math.round(installedKwp * yieldFactor)
}

/**
 * Sum total kWp from a list of panels.
 */
export function sumInstalledKwp(
  panels: Array<{ powerWp: number; quantity: number }>
): number {
  const totalWp = panels.reduce((sum, p) => sum + p.powerWp * p.quantity, 0)
  return totalWp / 1000
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

/**
 * Format Rappen as CHF string with Swiss locale.
 * e.g. 123456 → "CHF 1'234.56"
 *
 * Uses `de-CH` locale which uses apostrophe as thousands separator.
 */
export function formatChf(rappen: number): string {
  const chf = rappen / 100
  return new Intl.NumberFormat('de-CH', {
    style: 'currency',
    currency: 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(chf)
}

/**
 * Format basis points as percentage string.
 * e.g. 2500 → "25.00%"
 */
export function formatPct(basisPts: number): string {
  return (basisPts / 100).toFixed(2) + '%'
}

// ─── I.ON Energy Excel Pricing Model ─────────────────────────────────────────

export interface IonPricingCoefficients {
  // PV procurement (basis points)
  pv_accessories_bps: number
  pv_frais_supp_bps: number
  pv_transport_bps: number
  // PV labor (rappen)
  pv_labor_panel_rappen: number
  pv_labor_inverter_rappen: number
  // PV fixed installation (rappen) — auto-added when PV products present
  pv_raccordement_mat_rappen: number
  pv_raccordement_labor_rappen: number
  pv_pm_fixed_rappen: number
  pv_admin_fixed_rappen: number
  // PV overhead/profit (basis points)
  pv_sales_overhead_bps: number
  pv_profit_appro_bps: number
  pv_profit_constr_bps: number
  // Battery/EV (basis points)
  bat_pm_bps: number
  bat_admin_bps: number
  bat_profit_bps: number
  // Mounting system (rappen per panel, net material cost before appro chain)
  mount_tuile_rappen: number
  mount_ardoise_rappen: number
  mount_bac_acier_rappen: number
  mount_plat_rappen: number
  // Slope complexity surcharges (basis points)
  mount_slope_medium_bps: number
  mount_slope_steep_bps: number
  // VAT
  vatBasisPts: number
}

export interface IonPricingProduct {
  category: 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'
  costRappen: number
  quantity: number
}

export interface IonPricingOption {
  costRappen: number // procurement cost
}

export interface IonPricingBreakdown {
  // Procurement costs
  pvApproRappen: number        // all PV product appro (after acc+frais_supp+transport)
  optionsApproRappen: number   // cost options appro (after acc+frais_supp)
  fixedApproRappen: number     // raccordement AC material appro
  batApproRappen: number       // battery/EV appro
  // Construction/labor costs
  pvLaborRappen: number        // panel + inverter labor
  fixedLaborRappen: number     // raccordement + PM + admin (auto-fixed)
  batConstrRappen: number      // battery PM + admin
  // Totals before markup
  totalPvApproRappen: number   // pvAppro + optionsAppro + fixedAppro
  totalPvConstrRappen: number  // pvLabor + fixedLabor
  totalBatCostRappen: number   // batAppro + batConstr
  // Markup
  pvSalesOverheadRappen: number
  pvProfitRappen: number
  batProfitRappen: number
  // Final
  sellingPriceExVatRappen: number
  vatRappen: number
  sellingPriceIncVatRappen: number
  effectiveMarginBasisPts: number // for DB storage
  rawCostRappen: number // sum of all product.costRappen × qty (for reference)
}

export const DEFAULT_ION_COEFFICIENTS: IonPricingCoefficients = {
  pv_accessories_bps: 300,
  pv_frais_supp_bps: 200,
  pv_transport_bps: 500,
  pv_labor_panel_rappen: 6500,
  pv_labor_inverter_rappen: 18000,
  pv_raccordement_mat_rappen: 50000,
  pv_raccordement_labor_rappen: 155000,
  pv_pm_fixed_rappen: 120000,
  pv_admin_fixed_rappen: 90000,
  pv_sales_overhead_bps: 1500,
  pv_profit_appro_bps: 2500,
  pv_profit_constr_bps: 2500,
  bat_pm_bps: 700,
  bat_admin_bps: 600,
  bat_profit_bps: 1925,
  mount_tuile_rappen: 10000,
  mount_ardoise_rappen: 11500,
  mount_bac_acier_rappen: 8500,
  mount_plat_rappen: 14000,
  mount_slope_medium_bps: 1500,
  mount_slope_steep_bps: 3000,
  vatBasisPts: 810,
}

export type RoofType = 'tuile' | 'ardoise' | 'bac_acier' | 'plat'
export type RoofSlope = 'simple' | 'moyen' | 'complexe'

/**
 * Calculate selling price using the I.ON Energy Excel pricing model.
 *
 * PV products (PANEL, INVERTER, ACCESSORY, MOUNTING) go through:
 *   mat_net = cost × (1 + acc_rate)
 *   appro = mat_net × (1 + frais_supp + transport)
 *   Fixed installation costs auto-added when PV products present.
 *   PRIX_HT = (APPRO × (1+profitAppro) + CONSTR × (1+profitConstr)) / (1 - salesOverhead)
 *
 * Battery/EV (BATTERY, EV_CHARGER):
 *   appro = cost
 *   constr = cost × (pm_rate + admin_rate)
 *   prix_ht = (appro + constr) × (1 + profit_rate)
 */
export function calculateIonPrice(
  products: IonPricingProduct[],
  options: IonPricingOption[],
  coeff: IonPricingCoefficients,
  roofType: RoofType = 'tuile',
  roofSlope: RoofSlope = 'simple'
): IonPricingBreakdown {
  const acc = coeff.pv_accessories_bps / 10000
  const fraisSupp = coeff.pv_frais_supp_bps / 10000
  const transport = coeff.pv_transport_bps / 10000
  const salesOverhead = coeff.pv_sales_overhead_bps / 10000
  const profitAppro = coeff.pv_profit_appro_bps / 10000
  const profitConstr = coeff.pv_profit_constr_bps / 10000
  const batPm = coeff.bat_pm_bps / 10000
  const batAdmin = coeff.bat_admin_bps / 10000
  const batProfit = coeff.bat_profit_bps / 10000
  const vat = coeff.vatBasisPts / 10000

  // Classify products
  const pvProducts = products.filter(p => ['PANEL', 'INVERTER', 'ACCESSORY', 'MOUNTING'].includes(p.category))
  const batProducts = products.filter(p => ['BATTERY', 'EV_CHARGER'].includes(p.category))
  const hasPv = pvProducts.length > 0

  // ── PV Procurement ──────────────────────────────────────────────────────────
  let pvApproRappen = 0
  let pvLaborRappen = 0
  for (const p of pvProducts) {
    const matNet = p.costRappen * (1 + acc)
    const appro = matNet * (1 + fraisSupp + transport)
    pvApproRappen += appro * p.quantity
    if (p.category === 'PANEL') pvLaborRappen += coeff.pv_labor_panel_rappen * p.quantity
    if (p.category === 'INVERTER') pvLaborRappen += coeff.pv_labor_inverter_rappen * p.quantity
  }

  // ── Mounting cost (auto-calculated per panel) ─────────────────────────────
  const panelCount = pvProducts
    .filter(p => p.category === 'PANEL')
    .reduce((sum, p) => sum + p.quantity, 0)

  if (panelCount > 0) {
    // Get base material cost per panel for selected roof type
    const mountMatPerPanel: Record<RoofType, number> = {
      tuile: coeff.mount_tuile_rappen,
      ardoise: coeff.mount_ardoise_rappen,
      bac_acier: coeff.mount_bac_acier_rappen,
      plat: coeff.mount_plat_rappen,
    }
    let mountBaseMat = mountMatPerPanel[roofType]

    // Apply slope complexity surcharge to material
    const slopeMultiplier = roofSlope === 'complexe'
      ? 1 + coeff.mount_slope_steep_bps / 10000
      : roofSlope === 'moyen'
        ? 1 + coeff.mount_slope_medium_bps / 10000
        : 1

    mountBaseMat = Math.round(mountBaseMat * slopeMultiplier)

    // Mounting material goes through ACC + frais_supp + transport chain (same as PV)
    const mountMatNet = mountBaseMat * (1 + acc)
    const mountAppro = mountMatNet * (1 + fraisSupp + transport)
    pvApproRappen += mountAppro * panelCount

    // Mounting labor = same rate as panel labor, slope multiplier also applies
    pvLaborRappen += Math.round(coeff.pv_labor_panel_rappen * slopeMultiplier) * panelCount
  }

  // ── Cost Options (services: acc + frais_supp, no transport) ─────────────────
  let optionsApproRappen = 0
  for (const o of options) {
    optionsApproRappen += o.costRappen * (1 + acc) * (1 + fraisSupp)
  }

  // ── Fixed Installation Costs (auto-added when PV products present) ──────────
  let fixedApproRappen = 0
  let fixedLaborRappen = 0
  if (hasPv) {
    const raccMatNet = coeff.pv_raccordement_mat_rappen * (1 + acc)
    fixedApproRappen = raccMatNet * (1 + fraisSupp + transport)
    fixedLaborRappen = coeff.pv_raccordement_labor_rappen + coeff.pv_pm_fixed_rappen + coeff.pv_admin_fixed_rappen
  }

  const totalPvApproRappen = pvApproRappen + optionsApproRappen + fixedApproRappen
  const totalPvConstrRappen = pvLaborRappen + fixedLaborRappen

  // ── PV Final Price ───────────────────────────────────────────────────────────
  // PRIX = (APPRO × (1+profitAppro) + CONSTR × (1+profitConstr)) / (1 - salesOverhead)
  const pvProfitRappen = Math.round(totalPvApproRappen * profitAppro + totalPvConstrRappen * profitConstr)
  const pvPriceDenominator = (1 - salesOverhead)
  const pvPriceNumerator = totalPvApproRappen * (1 + profitAppro) + totalPvConstrRappen * (1 + profitConstr)
  const pvPriceExVat = pvPriceDenominator > 0 ? pvPriceNumerator / pvPriceDenominator : pvPriceNumerator
  const pvSalesOverheadRappen = Math.round(pvPriceExVat * salesOverhead)

  // ── Battery/EV Procurement ───────────────────────────────────────────────────
  let batApproRappen = 0
  for (const p of batProducts) {
    batApproRappen += p.costRappen * p.quantity
  }
  const batConstrRappen = Math.round(batApproRappen * (batPm + batAdmin))
  const batProfitRappen = Math.round((batApproRappen + batConstrRappen) * batProfit)
  const batPriceExVat = batApproRappen + batConstrRappen + batProfitRappen
  const totalBatCostRappen = batApproRappen + batConstrRappen

  // ── Combined ─────────────────────────────────────────────────────────────────
  const sellingPriceExVatRappen = Math.round(pvPriceExVat) + batPriceExVat
  const vatRappen = Math.round(sellingPriceExVatRappen * vat)
  const sellingPriceIncVatRappen = sellingPriceExVatRappen + vatRappen

  // Raw cost for reference
  const rawCostRappen = products.reduce((s, p) => s + p.costRappen * p.quantity, 0)
    + options.reduce((s, o) => s + o.costRappen, 0)

  const effectiveMarginBasisPts = sellingPriceExVatRappen > 0
    ? Math.round(((sellingPriceExVatRappen - rawCostRappen) / sellingPriceExVatRappen) * 10000)
    : 0

  return {
    pvApproRappen: Math.round(pvApproRappen),
    optionsApproRappen: Math.round(optionsApproRappen),
    fixedApproRappen: Math.round(fixedApproRappen),
    batApproRappen,
    pvLaborRappen: Math.round(pvLaborRappen),
    fixedLaborRappen: Math.round(fixedLaborRappen),
    batConstrRappen,
    totalPvApproRappen: Math.round(totalPvApproRappen),
    totalPvConstrRappen: Math.round(totalPvConstrRappen),
    totalBatCostRappen,
    pvSalesOverheadRappen,
    pvProfitRappen,
    batProfitRappen,
    sellingPriceExVatRappen,
    vatRappen,
    sellingPriceIncVatRappen,
    effectiveMarginBasisPts,
    rawCostRappen,
  }
}
