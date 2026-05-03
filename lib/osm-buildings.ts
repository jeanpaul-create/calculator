/**
 * Server-side helper: query OpenStreetMap (Overpass API) for building
 * footprints within a radius of a point.
 *
 * Used to find neighboring buildings for FWS noise-distance calculations on
 * the PAC map. Customer's own building is filtered out client-side using
 * the cadastral parcel polygon.
 */

const SWISS_LAT_MIN = 45.5, SWISS_LAT_MAX = 47.9
const SWISS_LON_MIN = 5.9, SWISS_LON_MAX = 10.6

// Public Overpass instance — fine for our volume (one query per site selection)
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export interface OsmBuilding {
  /** OSM way ID (or relation ID) */
  id: number
  /** Closed polygon as [lon, lat] pairs (first === last) */
  ring: [number, number][]
  /** Optional address — useful for showing "Voisin: Av. de la Gare 24" */
  address?: string
}

interface OverpassNode {
  lat: number
  lon: number
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node'
  id: number
  geometry?: OverpassNode[]
  members?: { geometry?: OverpassNode[] }[]
  tags?: Record<string, string>
}

interface OverpassResponse {
  elements?: OverpassElement[]
}

/**
 * Fetch all building footprints within `radiusMeters` of (lat, lon).
 *
 * Returns an empty array on Overpass error, timeout, or out-of-bounds
 * coordinates — the feature should degrade silently rather than break the
 * map. Caller handles "no neighbours found" UX.
 */
export async function fetchNearbyBuildings(
  lat: number,
  lon: number,
  radiusMeters: number = 80
): Promise<OsmBuilding[]> {
  if (
    lat < SWISS_LAT_MIN || lat > SWISS_LAT_MAX ||
    lon < SWISS_LON_MIN || lon > SWISS_LON_MAX
  ) {
    return []
  }
  const r = Math.max(10, Math.min(500, radiusMeters))
  const query = `[out:json][timeout:10];way["building"](around:${r},${lat},${lon});out geom;`

  let json: OverpassResponse
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return []
    json = (await res.json()) as OverpassResponse
  } catch {
    return []
  }

  const elements = json.elements ?? []
  const buildings: OsmBuilding[] = []

  for (const el of elements) {
    if (el.type !== 'way' || !el.geometry || el.geometry.length < 3) continue
    const coords = el.geometry.map((p) => [p.lon, p.lat] as [number, number])
    // Close the ring if not already closed
    const first = coords[0]
    const last = coords[coords.length - 1]
    if (first[0] !== last[0] || first[1] !== last[1]) {
      coords.push(first)
    }
    // Build a friendly address string when available
    const tags = el.tags ?? {}
    let address: string | undefined
    if (tags['addr:street'] && tags['addr:housenumber']) {
      address = `${tags['addr:street']} ${tags['addr:housenumber']}`
    } else if (tags['addr:street']) {
      address = tags['addr:street']
    } else if (tags['name']) {
      address = tags['name']
    }
    buildings.push({ id: el.id, ring: coords, address })
  }

  return buildings
}
