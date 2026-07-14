/**
 * Tests for lib/heat-load/calculate.ts — the suissetec V6.6 formula port.
 *
 * The CRITICAL test is the xlsx-ground-truth fixture: I.ON Energy's own
 * worked example from the suissetec V6.6 spreadsheet (Payerne, 207 m²,
 * Pellets, "Chaudière à pellets", 5 × 7000 kg/a, Avec chauffage) produces
 * G49 = 10.525 kW in the xlsx. If our port produces a different number
 * for the same inputs, we've ported the math wrong.
 *
 * The other tests cover the validation + edge-case paths.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateHeatLoadKw,
  CLIMATE_STATIONS,
  FUELS,
  GENERATORS,
  type HeatLoadInput,
} from '@/lib/heat-load'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/**
 * The xlsx-ground-truth fixture. Source:
 *   File: Outil de calcul pour les besoins de chaleur (version 6.6 juni21).xlsx
 *   Sheet: "Calcul puissance"
 *   Inputs: G18=Payerne, G21=Maison individuelle, G22=207, G25=Avec chauffage,
 *           G28=Pellets en kg, G29=Chaudière à pellets,
 *           D37..D41 = 7000 (5 years), B37..B41 = 2020..2016
 *   Expected: G49 = 10.525 kW (heat load), G54 = 11.482 kW (with delestage)
 */
const PAYERNE_PELLETS: HeatLoadInput = {
  climateRegion: 'Payerne',
  hotWaterSource: 'with_heating',
  fuelType: 'pellets_en_kg',
  generatorType: 'chaudiere_a_pellets',
  consumptionYears: [
    { year: 2020, djc: 2994.3, consumption: 7000 },
    { year: 2019, djc: 3095.8, consumption: 7000 },
    { year: 2018, djc: 2902.4, consumption: 7000 },
    { year: 2017, djc: 3243.4, consumption: 7000 },
    { year: 2016, djc: 3347.7, consumption: 7000 },
  ],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('calculateHeatLoadKw — xlsx ground truth (CRITICAL)', () => {
  it('Payerne + Pellets + 5×7000 kg/a → ~10.5 kW (matches xlsx G49)', () => {
    const result = calculateHeatLoadKw(PAYERNE_PELLETS)
    // xlsx says 10.525; tolerate ±0.1 for floating-point rounding
    expect(result.heatLoadKw).toBeGreaterThan(10.4)
    expect(result.heatLoadKw).toBeLessThan(10.7)
  })

  it('Payerne + Pellets → ~11.5 kW with default delestage (matches xlsx G54)', () => {
    const result = calculateHeatLoadKw(PAYERNE_PELLETS)
    // xlsx says 11.482; tolerate ±0.1
    expect(result.heatLoadWithDelestageKw).toBeGreaterThan(11.4)
    expect(result.heatLoadWithDelestageKw).toBeLessThan(11.6)
  })

  it('intermediate values match the xlsx chain', () => {
    const r = calculateHeatLoadKw(PAYERNE_PELLETS)
    // G42 (avg normalized consumption) ≈ 7066.9 in xlsx
    expect(r.intermediate.avgNormalizedConsumption).toBeGreaterThan(7050)
    expect(r.intermediate.avgNormalizedConsumption).toBeLessThan(7080)
    // G45 (total annual heat) ≈ 35334 in xlsx
    expect(r.intermediate.totalAnnualHeatKwh).toBeGreaterThan(35200)
    expect(r.intermediate.totalAnnualHeatKwh).toBeLessThan(35450)
    // Caloric, efficiency, hours match xlsx
    expect(r.intermediate.caloricValue).toBe(5) // pellets en kg
    expect(r.intermediate.efficiency).toBe(0.7) // chaudière pellets + avec chauffage
    expect(r.intermediate.operatingHours).toBe(2350) // Payerne avec chauffage
  })
})

// ─── Validation tests ────────────────────────────────────────────────────────

describe('calculateHeatLoadKw — input validation', () => {
  it('unknown climate region throws', () => {
    expect(() =>
      calculateHeatLoadKw({ ...PAYERNE_PELLETS, climateRegion: 'Atlantis' })
    ).toThrow(/Unknown climate station: Atlantis/)
  })

  it('unknown fuel throws', () => {
    expect(() =>
      calculateHeatLoadKw({ ...PAYERNE_PELLETS, fuelType: 'unicorn_dust' })
    ).toThrow(/Unknown fuel: unicorn_dust/)
  })

  it('unknown generator throws', () => {
    expect(() =>
      calculateHeatLoadKw({ ...PAYERNE_PELLETS, generatorType: 'fusion_reactor' })
    ).toThrow(/Unknown generator: fusion_reactor/)
  })

  it('empty consumption history throws', () => {
    expect(() =>
      calculateHeatLoadKw({ ...PAYERNE_PELLETS, consumptionYears: [] })
    ).toThrow(/At least 1 year of consumption history is required/)
  })

  it('zero DJC throws (would divide by zero)', () => {
    expect(() =>
      calculateHeatLoadKw({
        ...PAYERNE_PELLETS,
        consumptionYears: [{ year: 2020, djc: 0, consumption: 7000 }],
      })
    ).toThrow(/Invalid DJC for year 2020/)
  })

  it('Radiateur électrique direct + with_heating throws (no DHW capability)', () => {
    expect(() =>
      calculateHeatLoadKw({
        ...PAYERNE_PELLETS,
        generatorType: 'radiateur_electrique_direct',
        hotWaterSource: 'with_heating',
      })
    ).toThrow(/doesn't support ECS source/)
  })
})

// ─── Behavior tests ──────────────────────────────────────────────────────────

describe('calculateHeatLoadKw — behavior', () => {
  it('zero consumption returns 0 kW (no heat demand)', () => {
    const r = calculateHeatLoadKw({
      ...PAYERNE_PELLETS,
      consumptionYears: [{ year: 2020, djc: 2994.3, consumption: 0 }],
    })
    expect(r.heatLoadKw).toBe(0)
    expect(r.heatLoadWithDelestageKw).toBe(0)
  })

  it('1 year of consumption produces a valid result (no avg over 5)', () => {
    const r = calculateHeatLoadKw({
      ...PAYERNE_PELLETS,
      consumptionYears: [{ year: 2020, djc: 2994.3, consumption: 7000 }],
    })
    // Single-year normalized = 7000/2994.3 × 3138.09 ≈ 7335.6
    // heat = 7335.6 × 5 × 0.7 / 2350 ≈ 10.93
    expect(r.heatLoadKw).toBeGreaterThan(10.5)
    expect(r.heatLoadKw).toBeLessThan(11.3)
  })

  it('separate DHW uses different efficiency + operating hours', () => {
    const withHeating = calculateHeatLoadKw(PAYERNE_PELLETS)
    const separate = calculateHeatLoadKw({
      ...PAYERNE_PELLETS,
      hotWaterSource: 'separate',
    })
    // Efficiency for chaudiere_a_pellets: separate=0.75, with_heating=0.7
    // Operating hours for Payerne: separate=2050, with_heating=2350
    expect(separate.intermediate.efficiency).toBe(0.75)
    expect(separate.intermediate.operatingHours).toBe(2050)
    expect(withHeating.intermediate.efficiency).toBe(0.7)
    expect(withHeating.intermediate.operatingHours).toBe(2350)
    // Numbers differ — the formula is sensitive to ECS source
    expect(separate.heatLoadKw).not.toBeCloseTo(withHeating.heatLoadKw, 1)
  })
})

// ─── Data integrity tests ────────────────────────────────────────────────────

describe('lookup-table integrity', () => {
  it('all climate stations have ≥9 years of DJC data', () => {
    for (const station of CLIMATE_STATIONS) {
      const years = Object.keys(station.djcByYear)
      expect(years.length).toBeGreaterThanOrEqual(9)
    }
  })

  it('all climate stations have positive djcLongTermAvg, operating hours, area-temps', () => {
    for (const station of CLIMATE_STATIONS) {
      expect(station.djcLongTermAvg).toBeGreaterThan(0)
      expect(station.fullLoadHoursSepare).toBeGreaterThan(0)
      expect(station.fullLoadHoursAvecChauffage).toBeGreaterThan(0)
    }
  })

  it('all fuels have positive caloric value', () => {
    for (const fuel of FUELS) {
      expect(fuel.caloric).toBeGreaterThan(0)
    }
  })

  it('all generators have positive separate efficiency', () => {
    for (const generator of GENERATORS) {
      expect(generator.efficiencySepare).toBeGreaterThan(0)
      expect(generator.efficiencySepare).toBeLessThanOrEqual(1)
    }
  })

  it('exactly one generator has null efficiencyWithHeating (radiateur électrique)', () => {
    const noDhw = GENERATORS.filter((g) => g.efficiencyWithHeating === null)
    expect(noDhw).toHaveLength(1)
    expect(noDhw[0].key).toBe('radiateur_electrique_direct')
  })

  it('FUEL_KEYS and GENERATOR_KEYS are unique', () => {
    const fuelKeys = FUELS.map((f) => f.key)
    expect(new Set(fuelKeys).size).toBe(fuelKeys.length)
    const genKeys = GENERATORS.map((g) => g.key)
    expect(new Set(genKeys).size).toBe(genKeys.length)
  })
})

// ─── Climate data integrity ───────────────────────────────────────────────
//
// Regression net for the St. Gallen / Schaffhausen / Scuol / Sion incident:
// the 2012–2020 year blocks were rotated one station off during extraction,
// which made yearly DJC physically inconsistent with each station's own
// long-term average (e.g. Schaffhausen showed ~4580/yr against an avg of
// 3443 — impossible). Invariant: 2012–2020 were warm years, so every
// station's yearly mean must sit BELOW its long-term average, within a
// plausible band.
describe('climate data integrity', () => {
  it('every station: mean(djcByYear) is 75–105% of djcLongTermAvg', () => {
    for (const s of CLIMATE_STATIONS) {
      const years = Object.values(s.djcByYear)
      const mean = years.reduce((a, b) => a + b, 0) / years.length
      const ratio = mean / s.djcLongTermAvg
      expect(ratio, `${s.name}: yearly mean ${Math.round(mean)} vs avg ${s.djcLongTermAvg}`).toBeGreaterThan(0.75)
      expect(ratio, `${s.name}: yearly mean ${Math.round(mean)} vs avg ${s.djcLongTermAvg}`).toBeLessThan(1.05)
    }
  })
})
