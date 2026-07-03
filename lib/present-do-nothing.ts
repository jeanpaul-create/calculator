/**
 * Screen 4 data builder — cumulative cost of electricity WITHOUT the
 * installation vs WITH it (investment paid year 0, then the residual bill).
 * Both series use the same retail-escalation assumption as calculateRoi, so
 * the curves cross exactly at the payback point shown on Screen 3.
 *
 * Lives in lib/ (not the /present page) so it can be unit-tested — Next.js
 * app-router pages may not have extra exports.
 */

import { ROI_DEFAULTS } from '@/lib/pricing'

/** Minimal structural input — PricedScenario satisfies this. */
export interface DoNothingInput {
  annualConsumptionKwh: number | null
  rateRappenPerKwh: number | null
  yearlySavingsRappen: number[] | null
  sellingPriceIncVatRappen: number
}

export interface DoNothingVM {
  withoutCumulative: number[]
  withCumulative: number[]
  lifetimeAdvantageRappen: number
  horizonYears: number
}

/**
 * Returns null when the quote lacks consumption or tariff data (PAC-only or
 * legacy quotes) — Screen 4 is simply not rendered in that case.
 */
export function buildDoNothing(s: DoNothingInput): DoNothingVM | null {
  const consumption = s.annualConsumptionKwh
  const rate = s.rateRappenPerKwh
  const savings = s.yearlySavingsRappen
  const investment = s.sellingPriceIncVatRappen
  if (!consumption || !rate || !savings || savings.length === 0 || investment <= 0) {
    return null
  }

  const escF = 1 + ROI_DEFAULTS.escalationBpsPerYear / 10000
  const horizon = savings.length
  const withoutCumulative: number[] = []
  const withCumulative: number[] = []
  let withoutSum = 0
  let savingsSum = 0
  for (let y = 0; y < horizon; y++) {
    withoutSum += Math.round(consumption * rate * Math.pow(escF, y))
    savingsSum += savings[y]
    withoutCumulative.push(withoutSum)
    // With the installation: investment up front, plus what's left of the
    // bill after self-consumption, minus export revenue = invest + without − savings.
    withCumulative.push(investment + withoutSum - savingsSum)
  }

  return {
    withoutCumulative,
    withCumulative,
    lifetimeAdvantageRappen: withoutCumulative[horizon - 1] - withCumulative[horizon - 1],
    horizonYears: horizon,
  }
}
