/**
 * Heat-load calculation — port of suissetec V6.6 ("Outil de calcul pour
 * les besoins de chaleur", juni 2021) "Calcul puissance" sheet.
 *
 *   Formula chain (xlsx cell references in comments — see PROCESS.md for
 *   re-extraction recipe):
 *
 *     G37..G41:  normalized[year]    = consumption[year] / djc[year] × avg_djc
 *     G42:       avg_normalized      = mean(G37..G41)
 *     G45:       total_heat_kWh_a    = G42 × caloric_value_per_unit
 *     G49 (★):   heat_load_kW        = G42 × caloric × efficiency / operating_hours
 *     G54:       with_delestage_kW   = G49 × 24 / (22 - extra_delestage_hours)
 *
 *   Inputs:
 *     - climateRegion          → station lookup (djc_per_year, op_hours)
 *     - hotWaterSource         → 'with_heating' | 'separate'
 *     - fuelType               → caloric value
 *     - generatorType          → efficiency by ECS source
 *     - consumptionYears       → array of {year, djc, consumption}
 *
 *   Output:
 *     - heatLoadKw             — base requirement (G49)
 *     - heatLoadWithDelestageKw — base × 1.0909 (2h/day delestage already
 *                                 baked into 22/24 ratio)
 *     - intermediate           — debug fields (per-year normalized, mean,
 *                                 caloric, efficiency, operating hours)
 *
 *   Edge cases / errors:
 *     - Unknown station/fuel/generator → throws with descriptive message
 *     - Empty consumption history     → throws ('at least 1 year required')
 *     - djc[year] = 0                  → throws ('invalid DJC')
 *     - All consumption = 0            → returns 0 (no heat demand)
 */

import { getClimateStation } from './climate-data'
import { getFuel } from './fuel-data'
import { getGenerator } from './generator-data'

export type HotWaterSource = 'with_heating' | 'separate'

export interface ConsumptionYear {
  /** Year (e.g. 2020). Used only for traceability — the calc uses djc + consumption. */
  year: number
  /** Heating degree-days for that year at the chosen climate station. */
  djc: number
  /** Rep-entered fuel consumption in the fuel's native unit (e.g. kg for pellets). */
  consumption: number
}

export interface HeatLoadInput {
  climateRegion: string
  hotWaterSource: HotWaterSource
  fuelType: string
  generatorType: string
  consumptionYears: ConsumptionYear[]
}

export interface HeatLoadResult {
  /** Main result — base heat-load requirement [kW]. Maps to xlsx cell G49. */
  heatLoadKw: number
  /** With 2h/day delestage uplift [kW]. Maps to xlsx cell G54 with extra_delestage=0. */
  heatLoadWithDelestageKw: number
  /** Debug / traceability — intermediate values from the formula chain. */
  intermediate: {
    avgDjcOverYears: number
    perYearNormalizedConsumption: number[]
    avgNormalizedConsumption: number
    caloricValue: number
    efficiency: number
    operatingHours: number
    totalAnnualHeatKwh: number
  }
}

export function calculateHeatLoadKw(input: HeatLoadInput): HeatLoadResult {
  // Validate inputs (throws with descriptive message)
  const station = getClimateStation(input.climateRegion)
  const fuel = getFuel(input.fuelType)
  const generator = getGenerator(input.generatorType)

  if (input.consumptionYears.length === 0) {
    throw new Error('At least 1 year of consumption history is required')
  }

  // ─── Step 1: average DJC over the captured year range (xlsx col V) ────
  // Matches the xlsx B42="Moyenne annuelle" cell — simple mean of the
  // station's per-year DJC values (2012-2020). NOT the SIA 2028 long-
  // term avg (col W) — the xlsx formula uses the simple mean.
  const djcValues = Object.values(station.djcByYear)
  const avgDjcOverYears = djcValues.reduce((s, v) => s + v, 0) / djcValues.length

  // ─── Step 2: normalize each year's consumption to long-term average ──
  // normalized = consumption / djc_year × ref_djc
  // If a heating year was warmer than average, the rep used less fuel —
  // we scale UP to estimate "what would they have used in a normal year".
  // Inverse holds for colder years.
  const perYearNormalized = input.consumptionYears.map((y) => {
    if (y.djc <= 0) {
      throw new Error(`Invalid DJC for year ${y.year}: ${y.djc}`)
    }
    return (y.consumption / y.djc) * avgDjcOverYears
  })

  // ─── Step 3: average normalized consumption (xlsx G42) ───────────────
  const avgNormalized =
    perYearNormalized.reduce((s, v) => s + v, 0) / perYearNormalized.length

  // ─── Step 4: efficiency + operating hours by ECS source ──────────────
  const efficiency =
    input.hotWaterSource === 'with_heating'
      ? generator.efficiencyWithHeating
      : generator.efficiencySepare

  if (efficiency == null) {
    // E.g. "Radiateur électrique direct" can't produce DHW by itself
    throw new Error(
      `Generator "${generator.label}" doesn't support ECS source "${input.hotWaterSource}"`
    )
  }

  const operatingHours =
    input.hotWaterSource === 'with_heating'
      ? station.fullLoadHoursAvecChauffage
      : station.fullLoadHoursSepare

  // ─── Step 5: heat load (xlsx G49) ────────────────────────────────────
  // heat_kW = avg_normalized × caloric × efficiency / operating_hours
  // Units: ({unit}/a) × (kWh/{unit}) × (dimensionless) / h
  //      = kWh/a × 1/h = kW (when /a and /h are normalized to /yr basis,
  //        operating_hours already in h/year)
  const totalAnnualHeatKwh = avgNormalized * fuel.caloric
  const heatLoadKw = (totalAnnualHeatKwh * efficiency) / operatingHours

  // ─── Step 6: with default delestage uplift (xlsx G54 with G53=0) ─────
  // Default 2h/day delestage already in the 22/24 ratio. If rep enters
  // additional delestage, multiply the denominator. v1 = no extra delestage.
  const heatLoadWithDelestageKw = (heatLoadKw * 24) / 22

  return {
    heatLoadKw,
    heatLoadWithDelestageKw,
    intermediate: {
      avgDjcOverYears,
      perYearNormalizedConsumption: perYearNormalized,
      avgNormalizedConsumption: avgNormalized,
      caloricValue: fuel.caloric,
      efficiency,
      operatingHours,
      totalAnnualHeatKwh,
    },
  }
}
