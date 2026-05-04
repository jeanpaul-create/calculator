/**
 * Roof-info aggregator on top of `ch.bfe.solarenergie-eignung-daecher`.
 *
 * A single click on a roof typically returns multiple features (one per
 * roof surface — a building with a hipped roof has 4-6 surfaces). We
 * aggregate by building_id: total area, total annual yield, max-irradiation
 * surface (the headline number a rep would quote), and best suitability
 * class on that building.
 *
 *   Architecture (ASCII):
 *
 *     fetchRoofInfo(input)
 *           │
 *           └─► swisstopoIdentify(layer='ch.bfe.solarenergie-eignung-daecher')
 *                     │
 *                     └─► aggregateBuilding(features)  ← pure, unit-testable
 *                               │
 *                               ├─► filter to first building_id
 *                               ├─► sum flaeche / flaeche_kollektoren
 *                               ├─► sum stromertrag / gstrahlung
 *                               ├─► max(mstrahlung) for headline irradiation
 *                               └─► best klasse + label
 */

import {
  swisstopoIdentify,
  type IdentifyFeature,
  type IdentifyResult,
} from '@/lib/swisstopo-identify'

const LAYER = 'ch.bfe.solarenergie-eignung-daecher'

export interface RoofIdentifyInput {
  lat: number
  lon: number
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
}

export interface RoofInfo {
  /**
   * Total roof surface area (m²), sum of `flaeche` across all surfaces of
   * the same building. This matches what sonnendach.ch displays as
   * "Dachfläche / Surface du toit" — the geometric roof area, not the
   * collector subset.
   */
  totalRoofAreaM2: number
  /**
   * Total panelable / collector area (m²), sum of `flaeche_kollektoren`.
   * Subset of totalRoofAreaM2 — accounts for setbacks, dormers, chimneys.
   * Often 0 in the dataset for some buildings (then we hide it).
   */
  totalCollectorAreaM2: number
  /**
   * Estimated annual electric yield in kWh/year (sum of `stromertrag`).
   * Computed by swisstopo assuming the panelable subset is fitted with PV.
   */
  annualYieldKwh: number
  /** Total annual solar radiation reaching the roof (kWh) */
  annualRadiationKwh: number
  /**
   * Best per-m² irradiation across the building's surfaces (kWh/m²/year).
   * This is the headline number a rep would quote — it's the south-facing
   * surface, not the building's weighted average (which would include
   * shaded / north-facing pans and drag the figure down).
   *
   * Computed as max(mstrahlung) across the building's surfaces. Don't use
   * gstrahlung / flaeche_kollektoren — the swisstopo dataset uses inconsistent
   * area conventions (gstrahlung is sometimes computed over full roof area
   * while flaeche_kollektoren is the panelable subset), which can produce
   * physically impossible values like 3000+ kWh/m²/year.
   */
  bestIrradiationKwhPerM2: number
  /** Highest suitability class found on the building (1=Faible … 5=Excellent) */
  bestKlasse: number
  /** Localized label for the best class ("Excellent", "Très bon", …) */
  bestKlasseLabel: string
  /** Tilt of the best (max-mstrahlung) surface in degrees */
  bestTiltDeg: number
  /** Number of distinct roof surfaces aggregated */
  surfaceCount: number
  /** Swiss building ID (BFE/EGID — useful for cross-referencing) */
  buildingId: number | null
}

const SUITABILITY_LABEL_FR: Record<number, string> = {
  1: 'Faible',
  2: 'Moyen',
  3: 'Bon',
  4: 'Très bon',
  5: 'Excellent',
}

function pickFrenchLabel(klasse_text: string | undefined, klasse: number): string {
  // klasse_text format: "DE##FR##IT##EN##DE" — index 1 is French.
  if (klasse_text) {
    const parts = klasse_text.split('##')
    if (parts[1]) return parts[1]
  }
  return SUITABILITY_LABEL_FR[klasse] ?? `Classe ${klasse}`
}

interface RoofProps {
  flaeche_kollektoren?: number | string
  flaeche?: number | string
  stromertrag?: number | string
  gstrahlung?: number | string
  mstrahlung?: number | string
  klasse?: number | string
  klasse_text?: string
  neigung?: number | string
  ausrichtung?: number | string
  building_id?: number | null
}

function num(v: number | string | undefined | null): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

// ─── Pure aggregator (unit-testable) ──────────────────────────────────────────

/**
 * Aggregate raw Identify features into a single RoofInfo by filtering to
 * the building under the click and computing area / yield / irradiation
 * totals. Pure — no I/O. T4 covers this with regression tests.
 */
export function aggregateBuilding(
  features: IdentifyFeature[]
): RoofInfo | null {
  if (features.length === 0) return null

  // Filter to the same building as the first hit (don't conflate neighbours
  // when the click tolerance bleeds across a property boundary).
  const firstProps = (features[0].properties ?? {}) as RoofProps
  const buildingId = firstProps.building_id ?? null
  const sameBuilding = buildingId
    ? features.filter((r) => (r.properties as RoofProps | undefined)?.building_id === buildingId)
    : [features[0]]

  let totalRoofArea = 0
  let totalCollectorArea = 0
  let totalYield = 0
  let totalRadiation = 0
  let maxKlasse = 0
  let bestKlasseLabel = ''
  let bestIrradiation = 0
  let bestIrradiationTilt = 0

  for (const r of sameBuilding) {
    const p = (r.properties ?? {}) as RoofProps
    const fullArea = num(p.flaeche)
    const collectorArea = num(p.flaeche_kollektoren)
    const yieldKwh = num(p.stromertrag)
    const meanIrradPerM2 = num(p.mstrahlung)
    const totalRadOnSurface = num(p.gstrahlung)
    const klasse = Math.round(num(p.klasse))
    const tilt = num(p.neigung)

    totalRoofArea += fullArea
    totalCollectorArea += collectorArea
    totalYield += yieldKwh
    totalRadiation += totalRadOnSurface

    if (klasse > maxKlasse) {
      maxKlasse = klasse
      bestKlasseLabel = pickFrenchLabel(p.klasse_text, klasse)
    }
    if (meanIrradPerM2 > bestIrradiation) {
      bestIrradiation = meanIrradPerM2
      bestIrradiationTilt = tilt
    }
  }

  return {
    totalRoofAreaM2: Math.round(totalRoofArea * 10) / 10,
    totalCollectorAreaM2: Math.round(totalCollectorArea * 10) / 10,
    annualYieldKwh: Math.round(totalYield),
    annualRadiationKwh: Math.round(totalRadiation),
    bestIrradiationKwhPerM2: Math.round(bestIrradiation),
    bestKlasse: maxKlasse,
    bestKlasseLabel: bestKlasseLabel || pickFrenchLabel(undefined, maxKlasse),
    bestTiltDeg: Math.round(bestIrradiationTilt),
    surfaceCount: sameBuilding.length,
    buildingId,
  }
}

// ─── Effectful entry ──────────────────────────────────────────────────────────

export async function fetchRoofInfo(
  input: RoofIdentifyInput
): Promise<IdentifyResult<RoofInfo>> {
  const result = await swisstopoIdentify({ ...input, layer: LAYER })

  // Upstream error or out-of-bounds → propagate the warning.
  if (result.warning) return { data: null, warning: result.warning }
  // Empty result (no features) → null data, no warning. Customer just clicked
  // off a roof.
  if (!result.data) return { data: null }

  const aggregated = aggregateBuilding(result.data)
  return { data: aggregated }
}
