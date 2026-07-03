import { describe, it, expect } from 'vitest'
import { buildDoNothing } from '@/lib/present-do-nothing'
import { calculateRoi } from '@/lib/pricing'

/**
 * Screen 4 math — the sales-critical invariant is that the two curves cross
 * exactly at the payback year shown on Screen 3, because both use the same
 * escalation assumption (ROI_DEFAULTS).
 */

// A realistic VD quote: 8 kWp, 7'600 kWh yield, 30 ct retail, 14 ct feed-in,
// 4'500 kWh consumption, CHF 24'000 investment.
function realisticInputs() {
  const investmentRappen = 2_400_000
  const roi = calculateRoi({
    annualKwhYield: 7600,
    rateRappenPerKwh: 30,
    feedInRateRappenPerKwh: 14,
    selfConsumptionRate: 0.45,
    investmentRappen,
  })
  return {
    roi,
    input: {
      annualConsumptionKwh: 4500,
      rateRappenPerKwh: 30,
      yearlySavingsRappen: roi.yearlySavingsRappen,
      sellingPriceIncVatRappen: investmentRappen,
    },
  }
}

describe('buildDoNothing', () => {
  it('produces two monotonically increasing cumulative series over the horizon', () => {
    const { input } = realisticInputs()
    const vm = buildDoNothing(input)!
    expect(vm.horizonYears).toBe(25)
    expect(vm.withoutCumulative).toHaveLength(25)
    expect(vm.withCumulative).toHaveLength(25)
    for (let y = 1; y < 25; y++) {
      expect(vm.withoutCumulative[y]).toBeGreaterThan(vm.withoutCumulative[y - 1])
      // "With" increment = that year's bill − that year's savings. When the
      // system out-earns the whole bill (strong feed-in), the red curve may
      // legitimately DESCEND — so assert the identity, not monotonicity.
      const increment = vm.withCumulative[y] - vm.withCumulative[y - 1]
      const billY = vm.withoutCumulative[y] - vm.withoutCumulative[y - 1]
      expect(increment).toBe(billY - input.yearlySavingsRappen![y])
    }
  })

  it('curves cross exactly at the Screen-3 payback year', () => {
    const { roi, input } = realisticInputs()
    const vm = buildDoNothing(input)!
    // with − without = investment − cumulativeSavings, which flips sign at
    // payback. Year index = ceil(paybackYears) − 1 (0-indexed year of flip).
    const crossIndex = vm.withCumulative.findIndex(
      (w, y) => w <= vm.withoutCumulative[y]
    )
    expect(crossIndex).toBe(Math.ceil(roi.paybackYears) - 1)
  })

  it('lifetime advantage equals cumulative savings minus investment', () => {
    const { roi, input } = realisticInputs()
    const vm = buildDoNothing(input)!
    const totalSavings = roi.yearlySavingsRappen.reduce((a, b) => a + b, 0)
    expect(vm.lifetimeAdvantageRappen).toBe(totalSavings - input.sellingPriceIncVatRappen)
    // …and matches the roi horizon total
    expect(totalSavings).toBe(roi.savings25YearsRappen)
  })

  it('returns null when consumption, rate, series, or investment is missing', () => {
    const { input } = realisticInputs()
    expect(buildDoNothing({ ...input, annualConsumptionKwh: null })).toBeNull()
    expect(buildDoNothing({ ...input, rateRappenPerKwh: null })).toBeNull()
    expect(buildDoNothing({ ...input, yearlySavingsRappen: null })).toBeNull()
    expect(buildDoNothing({ ...input, yearlySavingsRappen: [] })).toBeNull()
    expect(buildDoNothing({ ...input, sellingPriceIncVatRappen: 0 })).toBeNull()
  })
})
