import { describe, it, expect } from 'vitest'
import { calculateHeatPumpSubsidy, subsidyCantons } from '@/lib/subsidies'

describe('calculateHeatPumpSubsidy', () => {
  it('VD air-eau: 3500 + 150/kW', () => {
    // 10.5 kW design load (Payerne pellets ground-truth example)
    const r = calculateHeatPumpSubsidy('VD', 'air-eau', 10.5)
    expect(r).not.toBeNull()
    // 350'000 + 10.5 × 15'000 = 507'500 Rappen = CHF 5'075
    expect(r!.subsidyRappen).toBe(507_500)
    expect(r!.rule.year).toBe(2026)
  })

  it('VD sol-eau: 5000 + 300/kW', () => {
    const r = calculateHeatPumpSubsidy('VD', 'sol-eau', 12)
    // 500'000 + 12 × 30'000 = 860'000 Rappen = CHF 8'600
    expect(r!.subsidyRappen).toBe(860_000)
  })

  it('clamps thermal power to the canton cap (VD: 70 kW)', () => {
    const capped = calculateHeatPumpSubsidy('VD', 'air-eau', 120)
    const atCap = calculateHeatPumpSubsidy('VD', 'air-eau', 70)
    expect(capped!.subsidyRappen).toBe(atCap!.subsidyRappen)
  })

  it('is case/whitespace tolerant on canton code', () => {
    expect(calculateHeatPumpSubsidy(' vd ', 'air-eau', 10)).not.toBeNull()
  })

  it('returns null for cantons without a verified entry (never CHF 0)', () => {
    expect(calculateHeatPumpSubsidy('ZH', 'air-eau', 10)).toBeNull()
    expect(calculateHeatPumpSubsidy('GE', 'sol-eau', 10)).toBeNull()
  })

  it('returns null for invalid thermal power', () => {
    expect(calculateHeatPumpSubsidy('VD', 'air-eau', 0)).toBeNull()
    expect(calculateHeatPumpSubsidy('VD', 'air-eau', NaN)).toBeNull()
    expect(calculateHeatPumpSubsidy('VD', 'air-eau', -5)).toBeNull()
  })

  it('exposes the verified canton list', () => {
    expect(subsidyCantons()).toContain('VD')
  })
})
