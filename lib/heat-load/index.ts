/**
 * Heat-load module — port of suissetec V6.6 calculator.
 *
 * Public API:
 *   - calculateHeatLoadKw(input)        — main entry point (the formula)
 *   - CLIMATE_STATIONS, CLIMATE_STATION_NAMES, getClimateStation()
 *   - FUELS, FUEL_KEYS, getFuel()
 *   - GENERATORS, GENERATOR_KEYS, getGenerator()
 *   - HeatLoadInput, HeatLoadResult, ConsumptionYear, HotWaterSource types
 *
 * Used by:
 *   - lib/documents/fillers/en-vd-3.ts          (when it lands, Lane B)
 *   - Heat-load modal form (Phase 2 UI work)
 *   - API route for persisting HeatLoadInput
 */

export {
  calculateHeatLoadKw,
  type HeatLoadInput,
  type HeatLoadResult,
  type ConsumptionYear,
  type HotWaterSource,
} from './calculate'

export {
  CLIMATE_STATIONS,
  CLIMATE_STATION_NAMES,
  getClimateStation,
  type ClimateStation,
  type ClimateStationName,
} from './climate-data'

export {
  FUELS,
  FUEL_KEYS,
  getFuel,
  type Fuel,
  type FuelKey,
} from './fuel-data'

export {
  GENERATORS,
  GENERATOR_KEYS,
  getGenerator,
  type Generator,
  type GeneratorKey,
} from './generator-data'
