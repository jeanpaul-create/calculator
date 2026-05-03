/**
 * Server-side proxy for swisstopo's Identify API on the
 * `ch.kantone.cadastralwebmap-farbe` layer — Swiss cadastre.
 *
 * Used to identify the property parcel under a click point and return
 * its polygon for distance-to-edge calculations on the PAC map.
 */

const SWISS_LAT_MIN = 45.5, SWISS_LAT_MAX = 47.9
const SWISS_LON_MIN = 5.9, SWISS_LON_MAX = 10.6

export interface ParcelIdentifyInput {
  lat: number
  lon: number
  bounds: { west: number; south: number; east: number; north: number }
  width: number
  height: number
}

export interface ParcelInfo {
  /** swisstopo featureId */
  featureId: number | string
  /**
   * Polygon ring as [lon, lat] coordinate pairs (closed — first === last).
   * Just the outer ring; we ignore holes for distance calculations.
   */
  ring: [number, number][]
  /** Bounding box [west, south, east, north] for sanity checks */
  bbox: [number, number, number, number]
}

interface IdentifyFeature {
  featureId: number | string
  layerBodId: string
  bbox?: [number, number, number, number]
  geometry?: GeoJSON.Polygon | GeoJSON.MultiPolygon
}

interface IdentifyResponse {
  results?: IdentifyFeature[]
}

export async function fetchParcel(input: ParcelIdentifyInput): Promise<ParcelInfo | null> {
  const { lat, lon, bounds, width, height } = input

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
    layers: 'all:ch.kantone.cadastralwebmap-farbe',
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

  // The cadastre layer returns the first parcel that contains the click
  // point. Take the first feature with a polygon geometry — small overlapping
  // features (e.g. building footprints) can show up but parcels are the
  // primary feature type on this layer.
  const feature = results.find((r) =>
    r.geometry && (r.geometry.type === 'Polygon' || r.geometry.type === 'MultiPolygon')
  )
  if (!feature || !feature.geometry) return null

  // Take the OUTER ring of the (Multi)Polygon, ignoring holes.
  let ring: [number, number][]
  if (feature.geometry.type === 'Polygon') {
    ring = feature.geometry.coordinates[0] as [number, number][]
  } else {
    // For MultiPolygon, take the polygon containing the click point.
    // Rough heuristic: the largest one (parcels are usually one polygon
    // anyway; this is just a defensive fallback).
    const polygons = feature.geometry.coordinates as [number, number][][][]
    let bestArea = 0
    let bestRing: [number, number][] = polygons[0][0]
    for (const poly of polygons) {
      const ring0 = poly[0]
      const xs = ring0.map((c) => c[0])
      const ys = ring0.map((c) => c[1])
      const a = (Math.max(...xs) - Math.min(...xs)) * (Math.max(...ys) - Math.min(...ys))
      if (a > bestArea) {
        bestArea = a
        bestRing = ring0
      }
    }
    ring = bestRing
  }

  // Compute bbox if not provided
  let bbox: [number, number, number, number]
  if (feature.bbox && feature.bbox.length === 4) {
    bbox = feature.bbox as [number, number, number, number]
  } else {
    const xs = ring.map((c) => c[0])
    const ys = ring.map((c) => c[1])
    bbox = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }

  return {
    featureId: feature.featureId,
    ring,
    bbox,
  }
}
