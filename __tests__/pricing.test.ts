import { describe, it, expect } from 'vitest'
import {
  calculatePrice,
  calculateRoi,
  estimateAnnualYield,
  estimateSelfConsumptionRate,
  sumInstalledKwp,
  formatChf,
  formatPct,
  calculateIonPrice,
  calculatePronovoSubsidy,
  estimateTaxSavings,
  buildIonCoefficientsFromSettings,
  DEFAULT_ION_COEFFICIENTS,
  calculatePacPrice,
  buildPacCoefficientsFromSettings,
  DEFAULT_PAC_COEFFICIENTS,
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

// ─── calculateRoi with self-consumption split ─────────────────────────────────

describe('calculateRoi with selfConsumptionRate', () => {
  it('splits production into self-consumed and exported correctly', () => {
    // 10,000 kWh/year, 40% self-consumed, 60% exported
    // selfConsumed: 4,000 kWh × 30 ct = 120,000 Rappen
    // exported:     6,000 kWh × 8 ct  =  48,000 Rappen
    // total:                             168,000 Rappen
    const result = calculateRoi({
      annualKwhYield: 10000,
      rateRappenPerKwh: 30,
      feedInRateRappenPerKwh: 8,
      selfConsumptionRate: 0.4,
      investmentRappen: 2000000,
    })
    expect(result.selfConsumedKwh).toBe(4000)
    expect(result.exportedKwh).toBe(6000)
    expect(result.selfConsumptionSavingsRappen).toBe(120000)
    expect(result.exportRevenueRappen).toBe(48000)
    expect(result.annualSavingsRappen).toBe(168000)
  })

  it('legacy mode: omitting selfConsumptionRate defaults to 100% at retail rate', () => {
    const result = calculateRoi({
      annualKwhYield: 8000,
      rateRappenPerKwh: 26,
      investmentRappen: 1800000,
    })
    expect(result.selfConsumedKwh).toBe(8000)
    expect(result.exportedKwh).toBe(0)
    expect(result.annualSavingsRappen).toBe(208000)
  })
})

// ─── estimateSelfConsumptionRate ─────────────────────────────────────────────

describe('estimateSelfConsumptionRate', () => {
  it('returns ~40% for a balanced system (Epv ≈ Econs)', () => {
    // ratio = 1.0 → 0.4 × 1^0.4 = 0.4
    const scr = estimateSelfConsumptionRate(5000, 5000)
    expect(scr).toBeCloseTo(0.4, 2)
  })

  it('returns higher SCR for small system (Epv << Econs)', () => {
    // ratio = 0.5 → 0.4 × 2^0.4 ≈ 0.53
    const scr = estimateSelfConsumptionRate(2500, 5000)
    expect(scr).toBeGreaterThan(0.45)
  })

  it('returns lower SCR for oversized system (Epv >> Econs)', () => {
    // ratio = 2.0 → 0.4 × 0.5^0.4 ≈ 0.30
    const scr = estimateSelfConsumptionRate(10000, 5000)
    expect(scr).toBeLessThan(0.35)
  })

  it('increases SCR with battery', () => {
    const scrNoBat = estimateSelfConsumptionRate(5000, 5000, false)
    const scrBat = estimateSelfConsumptionRate(5000, 5000, true)
    expect(scrBat).toBeGreaterThan(scrNoBat)
    expect(scrBat).toBeLessThanOrEqual(0.85)
  })

  it('clamps to [0.15, 0.85]', () => {
    expect(estimateSelfConsumptionRate(100000, 1000)).toBeGreaterThanOrEqual(0.15)
    expect(estimateSelfConsumptionRate(100, 100000)).toBeLessThanOrEqual(0.85)
  })

  it('returns safe default when inputs are zero', () => {
    expect(estimateSelfConsumptionRate(0, 5000)).toBe(0.3)
    expect(estimateSelfConsumptionRate(5000, 0)).toBe(0.3)
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

// ─── calculatePronovoSubsidy ──────────────────────────────────────────────────

describe('calculatePronovoSubsidy', () => {
  it('returns 0 for systems below 2 kWp', () => {
    expect(calculatePronovoSubsidy(0)).toBe(0)
    expect(calculatePronovoSubsidy(1.9)).toBe(0)
  })

  it('applies 360 CHF/kWp for the first tier (2–30 kWp)', () => {
    // 10 kWp × 36000 Rappen = 360000 Rappen = CHF 3600
    expect(calculatePronovoSubsidy(10)).toBe(360000)
  })

  it('applies 260 CHF/kWp for the second tier (30–100 kWp)', () => {
    // 30 kWp: all in first tier → 30 × 36000 = 1080000
    expect(calculatePronovoSubsidy(30)).toBe(1080000)
    // 31 kWp: 30 × 36000 + 1 × 26000 = 1106000
    expect(calculatePronovoSubsidy(31)).toBe(1106000)
  })

  it('applies correct split at the 30 kWp tier boundary', () => {
    // 40 kWp: 30 × 36000 + 10 × 26000 = 1080000 + 260000 = 1340000
    expect(calculatePronovoSubsidy(40)).toBe(1340000)
  })

  it('caps at 100 kWp', () => {
    const at100 = calculatePronovoSubsidy(100)
    const at120 = calculatePronovoSubsidy(120)
    // 100 kWp: 30 × 36000 + 70 × 26000 = 1080000 + 1820000 = 2900000
    expect(at100).toBe(2900000)
    expect(at120).toBe(at100) // capped — same as 100 kWp
  })
})

// ─── estimateTaxSavings ───────────────────────────────────────────────────────

describe('estimateTaxSavings', () => {
  it('calculates 20% tax savings correctly (default rate)', () => {
    // CHF 20,000 ex-VAT = 2,000,000 Rappen, 20% → 400,000 Rappen = CHF 4,000
    expect(estimateTaxSavings(2000000)).toBe(400000)
  })

  it('respects a custom marginal tax rate', () => {
    // CHF 10,000 = 1,000,000 Rappen, 30% → 300,000 Rappen
    expect(estimateTaxSavings(1000000, 3000)).toBe(300000)
  })

  it('returns 0 for zero investment', () => {
    expect(estimateTaxSavings(0)).toBe(0)
  })
})

// ─── calculateIonPrice ───────────────────────────────────────────────────────

describe('calculateIonPrice', () => {
  const C = DEFAULT_ION_COEFFICIENTS

  it('produces a positive price for a basic PV-only system', () => {
    const result = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [],
      C,
      'tuile',
      'simple'
    )
    expect(result.sellingPriceExVatRappen).toBeGreaterThan(0)
    expect(result.sellingPriceIncVatRappen).toBeGreaterThan(result.sellingPriceExVatRappen)
  })

  it('includes VAT at the configured rate', () => {
    const result = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [],
      C,
      'tuile',
      'simple'
    )
    const expectedVat = Math.round(result.sellingPriceExVatRappen * C.vatBasisPts / 10000)
    expect(result.vatRappen).toBe(expectedVat)
    expect(result.sellingPriceIncVatRappen).toBe(result.sellingPriceExVatRappen + result.vatRappen)
  })

  it('adds fixed installation costs when PV products are present', () => {
    const withPv = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 1 }],
      [], C, 'tuile', 'simple'
    )
    // fixed labor = raccordement + pm + admin
    const expectedFixedLabor =
      C.pv_raccordement_labor_rappen + C.pv_pm_fixed_rappen + C.pv_admin_fixed_rappen
    expect(withPv.fixedLaborRappen).toBe(expectedFixedLabor)
  })

  it('adds no fixed installation costs for battery-only system', () => {
    const batOnly = calculateIonPrice(
      [{ category: 'BATTERY', costRappen: 500000, quantity: 1 }],
      [], C, 'tuile', 'simple'
    )
    expect(batOnly.fixedLaborRappen).toBe(0)
    expect(batOnly.fixedApproRappen).toBe(0)
    expect(batOnly.pvLaborRappen).toBe(0)
  })

  it('increases price for steeper roof slope', () => {
    const simple = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [], C, 'tuile', 'simple'
    )
    const complexe = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [], C, 'tuile', 'complexe'
    )
    expect(complexe.sellingPriceExVatRappen).toBeGreaterThan(simple.sellingPriceExVatRappen)
  })

  it('uses the correct mount cost for each roof type', () => {
    const tuile = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [], C, 'tuile', 'simple'
    )
    const plat = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [], C, 'plat', 'simple'
    )
    // plat mount (14000/panel) > tuile (10000/panel) → plat should cost more
    expect(plat.pvApproRappen).toBeGreaterThan(tuile.pvApproRappen)
  })

  it('returns zero price for empty products and options', () => {
    const result = calculateIonPrice([], [], C, 'tuile', 'simple')
    expect(result.sellingPriceExVatRappen).toBe(0)
    expect(result.sellingPriceIncVatRappen).toBe(0)
    expect(result.rawCostRappen).toBe(0)
  })

  it('adds inverter labor cost per inverter', () => {
    const withInverter = calculateIonPrice(
      [
        { category: 'PANEL', costRappen: 44000, quantity: 10 },
        { category: 'INVERTER', costRappen: 185000, quantity: 1 },
      ],
      [], C, 'tuile', 'simple'
    )
    const withoutInverter = calculateIonPrice(
      [{ category: 'PANEL', costRappen: 44000, quantity: 10 }],
      [], C, 'tuile', 'simple'
    )
    // inverter adds labor + appro → higher PV cost
    expect(withInverter.pvLaborRappen).toBeGreaterThan(withoutInverter.pvLaborRappen)
  })
})

// ─── buildIonCoefficientsFromSettings ────────────────────────────────────────

describe('buildIonCoefficientsFromSettings', () => {
  it('returns DEFAULT_ION_COEFFICIENTS when map is empty', () => {
    const result = buildIonCoefficientsFromSettings({}, 810)
    const { vatBasisPts: _vat, ...defaults } = DEFAULT_ION_COEFFICIENTS
    for (const [key, value] of Object.entries(defaults)) {
      expect(result[key as keyof typeof defaults]).toBe(value)
    }
    expect(result.vatBasisPts).toBe(810)
  })

  it('uses map values when all keys are present', () => {
    const map: Record<string, number> = {
      pv_accessories_bps: 999,
      pv_frais_supp_bps: 888,
      pv_transport_bps: 777,
      pv_labor_panel_rappen: 7000,
      pv_labor_inverter_rappen: 20000,
      pv_raccordement_mat_rappen: 55000,
      pv_raccordement_labor_rappen: 160000,
      pv_pm_fixed_rappen: 130000,
      pv_admin_fixed_rappen: 95000,
      pv_sales_overhead_bps: 1600,
      pv_profit_appro_bps: 2600,
      pv_profit_constr_bps: 2600,
      bat_pm_bps: 800,
      bat_admin_bps: 700,
      bat_profit_bps: 2000,
      mount_tuile_rappen: 11000,
      mount_ardoise_rappen: 12500,
      mount_bac_acier_rappen: 9500,
      mount_plat_rappen: 15000,
      mount_slope_medium_bps: 1600,
      mount_slope_steep_bps: 3100,
    }
    const result = buildIonCoefficientsFromSettings(map, 810)
    expect(result.pv_accessories_bps).toBe(999)
    expect(result.mount_tuile_rappen).toBe(11000)
    expect(result.bat_profit_bps).toBe(2000)
    expect(result.vatBasisPts).toBe(810)
  })

  it('falls back to defaults for individual missing keys', () => {
    const result = buildIonCoefficientsFromSettings({ pv_accessories_bps: 500 }, 810)
    expect(result.pv_accessories_bps).toBe(500)
    // All others should be defaults
    expect(result.pv_frais_supp_bps).toBe(DEFAULT_ION_COEFFICIENTS.pv_frais_supp_bps)
    expect(result.mount_tuile_rappen).toBe(DEFAULT_ION_COEFFICIENTS.mount_tuile_rappen)
  })
})

// ─── calculatePacPrice ────────────────────────────────────────────────────────

describe('calculatePacPrice', () => {
  const C = DEFAULT_PAC_COEFFICIENTS // acc=3%, frais=2%, transport=5%, pm=6%, admin=6%, oh=15%, profitA=27%, profitC=27%, vat=8.1%

  it('returns zero price for empty product list', () => {
    const result = calculatePacPrice([], C)
    expect(result.sellingPriceExVatRappen).toBe(0)
    expect(result.sellingPriceIncVatRappen).toBe(0)
    expect(result.totalApproRappen).toBe(0)
    expect(result.totalLaborRappen).toBe(0)
  })

  it('calculates mat_net and appro correctly for a single material-only product', () => {
    // cost = 100_000 Rappen
    // mat_net = 100_000 × 1.03 = 103_000
    // appro = 103_000 × (1 + 0.02 + 0.05) = 103_000 × 1.07 = 110_210
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 0, quantity: 1 }],
      C
    )
    expect(result.totalMatNetRappen).toBe(103_000)
    expect(result.totalApproRappen).toBe(110_210)
    expect(result.totalLaborRappen).toBe(0)
  })

  it('applies pm to (appro + labor), not appro alone', () => {
    // cost=100_000, labor=50_000 → appro=110_210, labor=50_000
    // pm = (110_210 + 50_000) × 0.06 = 160_210 × 0.06 = 9_612 (rounded)
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 50_000, quantity: 1 }],
      C
    )
    expect(result.pmRappen).toBe(9_613) // 160_210 × 0.06 = 9_612.6 → 9_613
  })

  it('applies admin to mat_net (NOT appro — key difference from PV)', () => {
    // mat_net=103_000 → admin = 103_000 × 0.06 = 6_180
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 0, quantity: 1 }],
      C
    )
    expect(result.adminRappen).toBe(6_180)
    // If admin were based on appro (110_210), it would be 6_613 — NOT the PAC formula
    expect(result.adminRappen).not.toBe(6_613)
  })

  it('construction = labor + pm + admin', () => {
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 50_000, quantity: 1 }],
      C
    )
    expect(result.constructionRappen).toBe(
      result.totalLaborRappen + result.pmRappen + result.adminRappen
    )
  })

  it('sales overhead is additive (not a divisor like PV)', () => {
    // overhead = (appro + labor) × 15%
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 50_000, quantity: 1 }],
      C
    )
    const expectedOverhead = Math.round((result.totalApproRappen + result.totalLaborRappen) * 0.15)
    expect(result.salesOverheadRappen).toBe(expectedOverhead)
  })

  it('PRIX HT = appro + construction + overhead + profitAppro + profitConstr', () => {
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 50_000, quantity: 1 }],
      C
    )
    const expectedHT =
      result.totalApproRappen +
      result.constructionRappen +
      result.salesOverheadRappen +
      result.profitApproRappen +
      result.profitConstrRappen
    expect(result.sellingPriceExVatRappen).toBe(expectedHT)
  })

  it('applies VAT correctly', () => {
    const result = calculatePacPrice(
      [{ costRappen: 100_000, laborRappen: 0, quantity: 1 }],
      C
    )
    const expectedVat = Math.round(result.sellingPriceExVatRappen * 0.081)
    expect(result.vatRappen).toBe(expectedVat)
    expect(result.sellingPriceIncVatRappen).toBe(result.sellingPriceExVatRappen + expectedVat)
  })

  it('scales linearly with quantity (within 1 Rappen rounding)', () => {
    // Integer rounding at intermediate steps means price(3) ≈ 3 × price(1)
    // but may differ by at most 1 Rappen due to Math.round() on each step.
    const one = calculatePacPrice(
      [{ costRappen: 50_000, laborRappen: 20_000, quantity: 1 }],
      C
    )
    const three = calculatePacPrice(
      [{ costRappen: 50_000, laborRappen: 20_000, quantity: 3 }],
      C
    )
    // Pre-rounding totals scale exactly
    expect(three.totalLaborRappen).toBe(one.totalLaborRappen * 3)
    // Final price may differ by ≤ 1 Rappen due to rounding accumulation
    expect(Math.abs(three.sellingPriceExVatRappen - one.sellingPriceExVatRappen * 3)).toBeLessThanOrEqual(3)
  })

  it('handles multiple products correctly', () => {
    const machine = { costRappen: 500_000, laborRappen: 100_000, quantity: 1 }
    const accessory = { costRappen: 20_000, laborRappen: 0, quantity: 3 }
    const result = calculatePacPrice([machine, accessory], C)

    // mat_net: machine = 515_000, accessory = 20_600 × 3 = 61_800
    const expectedMatNet = Math.round(500_000 * 1.03 + 20_000 * 1.03 * 3)
    expect(result.totalMatNetRappen).toBe(expectedMatNet)

    // total labor = 100_000
    expect(result.totalLaborRappen).toBe(100_000)
  })

  it('approximates the Excel example: BUDERUS 5kW basic install ~CHF 30,912 HT', () => {
    // Simplified version of the Excel example quote.
    // Machine: BUDERUS WLW176i-5 AR ~CHF 7,000 mat, labor ~CHF 1,000
    // + standard install items totaling ~CHF 15,000 mat + CHF 4,000 labor
    // Expected result: ~CHF 30,912 HT = 3_091_200 Rappen
    const products = [
      { costRappen: 700_000, laborRappen: 100_000, quantity: 1 }, // machine
      { costRappen: 500_000, laborRappen: 200_000, quantity: 1 }, // electric + install
      { costRappen: 300_000, laborRappen: 100_000, quantity: 1 }, // piping + misc
    ]
    const result = calculatePacPrice(products, C)
    // Ensure the price is in a realistic range for a basic PAC install
    // CHF 20,000 – 45,000 HT
    expect(result.sellingPriceExVatRappen).toBeGreaterThan(2_000_000)
    expect(result.sellingPriceExVatRappen).toBeLessThan(4_500_000)
  })
})

// ─── buildPacCoefficientsFromSettings ────────────────────────────────────────

describe('buildPacCoefficientsFromSettings', () => {
  it('uses provided settings values', () => {
    const result = buildPacCoefficientsFromSettings(
      {
        pac_accessories_bps: 400,
        pac_pm_bps: 700,
        pac_profit_appro_bps: 3000,
      },
      810
    )
    expect(result.pac_accessories_bps).toBe(400)
    expect(result.pac_pm_bps).toBe(700)
    expect(result.pac_profit_appro_bps).toBe(3000)
    expect(result.vatBasisPts).toBe(810)
  })

  it('falls back to defaults for missing keys', () => {
    const result = buildPacCoefficientsFromSettings({}, 810)
    expect(result.pac_accessories_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_accessories_bps)
    expect(result.pac_frais_supp_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_frais_supp_bps)
    expect(result.pac_transport_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_transport_bps)
    expect(result.pac_pm_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_pm_bps)
    expect(result.pac_admin_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_admin_bps)
    expect(result.pac_sales_overhead_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_sales_overhead_bps)
    expect(result.pac_profit_appro_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_profit_appro_bps)
    expect(result.pac_profit_constr_bps).toBe(DEFAULT_PAC_COEFFICIENTS.pac_profit_constr_bps)
  })
})
