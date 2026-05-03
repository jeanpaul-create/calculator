/**
 * Server-side proxy for swisstopo's Identify API on the
 * `ch.bfe.solarenergie-eignung-daecher` layer.
 *
 *   GET https://api3.geo.admin.ch/rest/services/api/MapServer/identify
 *
 * A single click on a roof typically returns multiple features (one per
 * roof surface — a building with a hipped roof has 4-6 surfaces). We
 * aggregate by building_id: total area, total annual yield, weighted-avg
 * tilt, and the BEST suitability class found on that building.
 */

const SWISS_LAT_MIN = 45.5, SWISS_LAT_MAX = 47.9
const SWISS_LON_MIN = 5.9, SWISS_LON_MAX = 10.6

export interface RoofIdentifyInput {
  lat: number
  lon: number
  /** Map bbox in WGS84 (west, south, east, north) */
  bounds: { west: number; south: number; east: number; north: number }
  /** Image display width in pixels (used by swisstopo to size the tolerance) */
  width: number
  /** Image display height in pixels */
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

interface IdentifyFeature {
  featureId: number | string
  layerBodId: string
  properties: {
    flaeche_kollektoren?: number | string
    flaeche?: number | string
    stromertrag?: number | string
    gstrahlung?: number | string  // total kWh/year on this surface (= area × mstrahlung)
    mstrahlung?: number | string  // mean kWh/m²/year for this surface — directly per m²
    klasse?: number | string
    klasse_text?: string
    neigung?: number | string
    ausrichtung?: number | string
    building_id?: number | null
  }
}

interface IdentifyResponse {
  results?: IdentifyFeature[]
}

function num(v: number | string | undefined | null): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : 0
}

export async function fetchRoofInfo(input: RoofIdentifyInput): Promise<RoofInfo | null> {
  const { lat, lon, bounds, width, height } = input

  // Swiss bounds — guard against arbitrary coordinates being proxied
  if (
    lat < SWISS_LAT_MIN || lat > SWISS_LAT_MAX ||
    lon < SWISS_LON_MIN || lon > SWISS_LON_MAX
  ) {
    return null
  }

  const params = new URLSearchParams({
    geometry: `${lon},${lat}`,
    geometryType: 'esriGeometryPoint',
    geometryFormat: 'geojson',
    imageDisplay: `${Math.max(1, Math.round(width))},${Math.max(1, Math.round(height))},96`,
    mapExtent: `${bounds.west},${bounds.south},${bounds.east},${bounds.north}`,
    layers: 'all:ch.bfe.solarenergie-eignung-daecher',
    tolerance: '5',
    lang: 'fr',
    sr: '4326',
  })

  const url = `https://api3.geo.admin.ch/rest/services/api/MapServer/identify?${params}`

  let json: IdentifyResponse
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    json = (await res.json()) as IdentifyResponse
  } catch {
    return null
  }

  const results = json.results ?? []
  if (results.length === 0) return null

  // Filter to the same building as the first hit (don't conflate neighbours
  // when the click tolerance bleeds across a property boundary).
  const buildingId = results[0].properties.building_id ?? null
  const sameBuilding = buildingId
    ? results.filter((r) => r.properties.building_id === buildingId)
    : [results[0]]

  let totalRoofArea = 0       // sum of flaeche  — full geometric roof
  let totalCollectorArea = 0  // sum of flaeche_kollektoren — panelable subset
  let totalYield = 0
  let totalRadiation = 0
  let maxKlasse = 0
  let bestKlasseLabel = ''
  let bestIrradiation = 0
  let bestIrradiationTilt = 0

  for (const r of sameBuilding) {
    const p = r.properties
    const fullArea = num(p.flaeche)
    const collectorArea = num(p.flaeche_kollektoren)
    const yieldKwh = num(p.stromertrag)
    // mstrahlung is the canonical per-m² irradiation for the surface
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
    // Best face: highest per-m² irradiation (what a rep would quote).
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
