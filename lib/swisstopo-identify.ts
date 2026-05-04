/**
 * Shared swisstopo Identify-API client used by all Swiss-data libs.
 *
 *   GET https://api3.geo.admin.ch/rest/services/api/MapServer/identify
 *
 * Both `lib/swisstopo-roof.ts` and `lib/swisstopo-parcel.ts` previously
 * duplicated this URL build + fetch + JSON parse logic. Extracted here so a
 * 3rd consumer (e.g., shading mask, snow-load zones) drops in by passing a
 * layer ID + a per-feature parser.
 *
 *   Architecture (ASCII):
 *
 *     caller ──> swisstopoIdentify({ lat, lon, bounds, w, h, layer })
 *                       │
 *                       ├─► out-of-Swiss-bounds? → { data: null, warning: 'out-of-bounds' }
 *                       │
 *                       └─► fetch identify API
 *                                ├─► HTTP error → { data: null, warning: 'http-N' }
 *                                ├─► timeout    → { data: null, warning: 'timeout' }
 *                                └─► OK         → { data: IdentifyFeature[], warning: undefined }
 *
 * The pure transport layer returns the raw `IdentifyFeature[]`. Higher-level
 * libs map those to typed shapes (RoofInfo, ParcelInfo, ...).
 */

import { isInSwissBounds } from '@/lib/geo'

const IDENTIFY_URL = 'https://api3.geo.admin.ch/rest/services/api/MapServer/identify'
const DEFAULT_TIMEOUT_MS = 8000

// ─── Result shape (standardized across all Swiss-data libs) ───────────────────

/**
 * Standard return shape for any Swiss-data lookup.
 *
 *   data === null + no warning   → no feature at this point (legitimate empty)
 *   data === null + warning set  → upstream failure (HTTP, timeout, etc.)
 *   data !== null                → success
 *
 * Callers should check `warning` to distinguish "user clicked off-map" from
 * "swisstopo timed out" so the UI can react accordingly.
 */
export interface IdentifyResult<T> {
  data: T | null
  warning?: string
}

// ─── Identify API types ───────────────────────────────────────────────────────

export interface IdentifyFeature {
  featureId: number | string
  layerBodId: string
  bbox?: [number, number, number, number]
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon | GeoJSON.Point
  properties?: Record<string, unknown>
}

interface IdentifyResponse {
  results?: IdentifyFeature[]
}

// ─── Shared input ─────────────────────────────────────────────────────────────

export interface IdentifyInput {
  lat: number
  lon: number
  /** Map bbox in WGS84 (west, south, east, north) — caller's viewport. */
  bounds: { west: number; south: number; east: number; north: number }
  /** Display width in pixels (used by swisstopo to size the click tolerance). */
  width: number
  /** Display height in pixels. */
  height: number
  /** Layer BOD ID, e.g. 'ch.bfe.solarenergie-eignung-daecher'. */
  layer: string
  /** Click tolerance in pixels. Default 5. */
  tolerance?: number
  /** Locale for label translations. Default 'fr'. */
  lang?: 'fr' | 'de' | 'it' | 'en'
}

// ─── Main entry ───────────────────────────────────────────────────────────────

/**
 * Run an Identify call against swisstopo for the given layer at the click
 * point. Returns raw IdentifyFeature[] — caller maps to typed shapes.
 */
export async function swisstopoIdentify(
  input: IdentifyInput
): Promise<IdentifyResult<IdentifyFeature[]>> {
  if (!isInSwissBounds(input.lat, input.lon)) {
    return { data: null, warning: 'out-of-bounds' }
  }

  const params = new URLSearchParams({
    geometry: `${input.lon},${input.lat}`,
    geometryType: 'esriGeometryPoint',
    geometryFormat: 'geojson',
    imageDisplay: `${Math.max(1, Math.round(input.width))},${Math.max(1, Math.round(input.height))},96`,
    mapExtent: `${input.bounds.west},${input.bounds.south},${input.bounds.east},${input.bounds.north}`,
    layers: `all:${input.layer}`,
    tolerance: String(input.tolerance ?? 5),
    lang: input.lang ?? 'fr',
    sr: '4326',
  })

  const url = `${IDENTIFY_URL}?${params}`

  let json: IdentifyResponse
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS) })
    if (!res.ok) {
      console.error(`[swisstopo-identify] HTTP ${res.status} on ${input.layer}`)
      return { data: null, warning: `swisstopo-http-${res.status}` }
    }
    json = (await res.json()) as IdentifyResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[swisstopo-identify] fetch failed on ${input.layer}: ${msg}`)
    return { data: null, warning: `swisstopo-error: ${msg}` }
  }

  const results = json.results ?? []
  if (results.length === 0) {
    // Not an error — just no features at this point (e.g. clicked off a roof).
    return { data: null }
  }
  return { data: results }
}
