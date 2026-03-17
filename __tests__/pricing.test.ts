import { describe, it, expect } from 'vitest'
import {
  calculatePrice,
  calculateRoi,
  estimateAnnualYield,
  sumInstalledKwp,
  formatChf,
  formatPct,
} from '@/lib/pricing'

// ─── calculatePrice ───────────────────────────────────────────────────────────

describe('calculatePrice', () => {
  it('calculates selling price ex-VAT with margin on selling price', () => {
    // cost=CHF 1000, margin=25% → sell = 1000 / 0.75 = 1333.33... → 1333 Rappen rounded
    const result = calculatePrice({
      items: [{ costRappen: 100000, quantity: 1 }],
      marginBasisPts: 2500,
      vatBasisPts: 0,
    })
    expect(result.subtotalCostRappen).toBe(100000)
    // 100000 / (1 - 0.25) = 133333.33 → rounded = 133333
    expect(result.sellingPriceExVatRappen).toBe(133333)
    expect(result.vatRappen).toBe(0)
    expect(result.sellingPriceIncVatRappen).toBe(133333)
  })

  it('applies Swiss VAT (8.10%) correctly', () => {
    const result = calculatePrice({
      items: [{ costRappen: 100000, quantity: 1 }],
      marginBasisPts: 2000, // 20%
      vatBasisPts: 810, // 8.10%
    })
    // sell ex-VAT = 100000 / 0.80 = 125000
    expect(result.sellingPriceExVatRappen).toBe(125000)
    // VAT = 125000 * 0.081 = 10125
    expect(result.vatRappen).toBe(10125)
    // inc-VAT = 135125
    expect(result.sellingPriceIncVatRappen).toBe(135125)
  })

  it('sums multiple line items correctly', () => {
    const result = calculatePrice({
      items: [
        { costRappen: 44000, quantity: 10 }, // 10 panels × CHF 440
        { costRappen: 185000, quantity: 1 }, // 1 inverter
        { costRappen: 85000, quantity: 1 }, // scaffolding
      ],
      marginBasisPts: 2500, // 25%
      vatBasisPts: 810,
    })
    // total cost = 440000 + 185000 + 85000 = 710000
    expect(result.subtotalCostRappen).toBe(710000)
    // sell ex-VAT = 710000 / 0.75 = 946666.67 → 946667
    expect(result.sellingPriceExVatRappen).toBe(946667)
  })

  it('handles quantity > 1', () => {
    const result = calculatePrice({
      items: [{ costRappen: 22000, quantity: 20 }],
      marginBasisPts: 0,
      vatBasisPts: 0,
    })
    expect(result.subtotalCostRappen).toBe(440000)
    expect(result.sellingPriceExVatRappen).toBe(440000)
  })

  it('returns zero prices for zero cost', () => {
    const result = calculatePrice({
      items: [],
      marginBasisPts: 2500,
      vatBasisPts: 810,
    })
    expect(result.subtotalCostRappen).toBe(0)
    expect(result.sellingPriceExVatRappen).toBe(0)
    expect(result.vatRappen).toBe(0)
    expect(result.sellingPriceIncVatRappen).toBe(0)
    expect(result.effectiveMarginBasisPts).toBe(0)
  })

  it('throws when marginBasisPts is 10000 (100%)', () => {
    expect(() =>
      calculatePrice({ items: [], marginBasisPts: 10000, vatBasisPts: 0 })
    ).toThrow('marginBasisPts must be < 10000')
  })

  it('throws when marginBasisPts is negative', () => {
    expect(() =>
      calculatePrice({ items: [], marginBasisPts: -1, vatBasisPts: 0 })
    ).toThrow('marginBasisPts must be >= 0')
  })

  it('throws when vatBasisPts is negative', () => {
    expect(() =>
      calculatePrice({ items: [], marginBasisPts: 0, vatBasisPts: -1 })
    ).toThrow('vatBasisPts must be >= 0')
  })

  it('effective margin matches input margin (within 1bp rounding)', () => {
    const marginBasisPts = 3000 // 30%
    const result = calculatePrice({
      items: [{ costRappen: 500000, quantity: 1 }],
      marginBasisPts,
      vatBasisPts: 0,
    })
    expect(Math.abs(result.effectiveMarginBasisPts - marginBasisPts)).toBeLessThanOrEqual(1)
  })

  it('handles minimum margin of 0% (no markup)', () => {
    const result = calculatePrice({
      items: [{ costRappen: 50000, quantity: 2 }],
      marginBasisPts: 0,
      vatBasisPts: 0,
    })
    expect(result.subtotalCostRappen).toBe(100000)
    expect(result.sellingPriceExVatRappen).toBe(100000)
  })
})

// ─── calculateRoi ─────────────────────────────────────────────────────────────

describe('calculateRoi', () => {
  it('calculates payback years correctly', () => {
    // Investment: CHF 18,000 = 1,800,000 Rappen
    // Annual yield: 8,000 kWh @ 26 Rappen/kWh = 208,000 Rappen = CHF 2,080/year
    // Payback = 1,800,000 / 208,000 = 8.65... → 8.7 years
    const result = calculateRoi({
      annualKwhYield: 8000,
      rateRappenPerKwh: 26,
      investmentRappen: 1800000,
    })
    expect(result.annualSavingsRappen).toBe(208000)
    expect(result.paybackYears).toBe(8.7)
    expect(result.savings25YearsRappen).toBe(208000 * 25)
  })

  it('returns Infinity payback when annual savings is zero', () => {
    const result = calculateRoi({
      annualKwhYield: 0,
      rateRappenPerKwh: 26,
      investmentRappen: 1000000,
    })
    expect(result.paybackYears).toBe(Infinity)
    expect(result.annualSavingsRappen).toBe(0)
  })

  it('returns Infinity when rate is zero', () => {
    const result = calculateRoi({
      annualKwhYield: 8000,
      rateRappenPerKwh: 0,
      investmentRappen: 1000000,
    })
    expect(result.paybackYears).toBe(Infinity)
  })

  it('rounds payback to one decimal place', () => {
    const result = calculateRoi({
      annualKwhYield: 10000,
      rateRappenPerKwh: 25,
      investmentRappen: 1333333,
    })
    // savings = 250000, payback = 1333333 / 250000 = 5.333 → 5.3
    expect(result.paybackYears).toBe(5.3)
  })
})

// ─── estimateAnnualYield ──────────────────────────────────────────────────────

describe('estimateAnnualYield', () => {
  it('uses 950 kWh/kWp as default Swiss factor', () => {
    expect(estimateAnnualYield(10)).toBe(9500)
  })

  it('applies custom yield factor', () => {
    // East/west orientation typically ~800 kWh/kWp
    expect(estimateAnnualYield(8, 800)).toBe(6400)
  })

  it('rounds to nearest integer', () => {
    // 5.3 kWp × 950 = 5035
    expect(estimateAnnualYield(5.3)).toBe(5035)
  })
})

// ─── sumInstalledKwp ──────────────────────────────────────────────────────────

describe('sumInstalledKwp', () => {
  it('converts Wp to kWp correctly', () => {
    // 20 panels × 415 Wp = 8,300 Wp = 8.3 kWp
    expect(sumInstalledKwp([{ powerWp: 415, quantity: 20 }])).toBe(8.3)
  })

  it('sums multiple panel types', () => {
    expect(
      sumInstalledKwp([
        { powerWp: 440, quantity: 10 },
        { powerWp: 400, quantity: 5 },
      ])
    ).toBe(6.4) // 4400 + 2000 = 6400 Wp = 6.4 kWp
  })

  it('returns 0 for empty array', () => {
    expect(sumInstalledKwp([])).toBe(0)
  })
})

// ─── formatChf ────────────────────────────────────────────────────────────────

describe('formatChf', () => {
  it('formats Rappen as CHF with Swiss locale', () => {
    // 123456 Rappen = CHF 1234.56
    const result = formatChf(123456)
    expect(result).toContain('1')
    expect(result).toContain('234')
    expect(result).toContain('56')
    expect(result).toContain('CHF')
  })

  it('formats zero correctly', () => {
    expect(formatChf(0)).toContain('0.00')
  })

  it('always has 2 decimal places', () => {
    const result = formatChf(100000) // CHF 1000.00
    expect(result).toMatch(/\.00$|,00$/)
  })
})

// ─── formatPct ────────────────────────────────────────────────────────────────

describe('formatPct', () => {
  it('converts basis points to percentage string', () => {
    expect(formatPct(2500)).toBe('25.00%')
    expect(formatPct(810)).toBe('8.10%')
    expect(formatPct(0)).toBe('0.00%')
    expect(formatPct(10000)).toBe('100.00%')
  })
})
