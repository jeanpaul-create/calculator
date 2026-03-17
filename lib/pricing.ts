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
