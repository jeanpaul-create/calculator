/**
 * Server-side helper: query OpenStreetMap (Overpass API) for building
 * footprints within a radius of a point.
 *
 * Used to find neighboring buildings for FWS noise-distance calculations on
 * the PAC map. Customer's own building is filtered out client-side using
 * the cadastral parcel polygon.
 */

import { isInSwissBounds } from '@/lib/geo'

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
 * Result shape — mirrors `IdentifyResult<T[]>` from swisstopo-identify so
 * callers handle both Swiss-data sources uniformly.
 *
 *   data === [] + no warning   → Overpass returned no buildings (legitimate)
 *   data === [] + warning set  → upstream failure (HTTP, timeout, blocked)
 *   data !== []                → list of building footprints
 */
export interface NearbyBuildingsResult {
  data: OsmBuilding[]
  warning?: string
}

/**
 * Fetch all building footprints within `radiusMeters` of (lat, lon).
 *
 * Logs failures to the server console (visible in Vercel logs) so we can
 * tell the difference between "Overpass returned 0" and "Overpass blocked
 * us / timed out / errored".
 */
export async function fetchNearbyBuildings(
  lat: number,
  lon: number,
  radiusMeters: number = 80
): Promise<NearbyBuildingsResult> {
  if (!isInSwissBounds(lat, lon)) {
    return { data: [], warning: 'out-of-bounds' }
  }
  const r = Math.max(10, Math.min(500, radiusMeters))
  const query = `[out:json][timeout:10];way["building"](around:${r},${lat},${lon});out geom;`

  let json: OverpassResponse
  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        // Some Overpass mirrors require a User-Agent header
        'User-Agent': 'I.ON-Energy-Calculator/1.0 (https://calculatorsolarch.vercel.app)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      console.error(`[overpass] HTTP ${res.status}: ${await res.text().catch(() => '')}`)
      return { data: [], warning: `overpass-http-${res.status}` }
    }
    json = (await res.json()) as OverpassResponse
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[overpass] fetch failed: ${msg}`)
    return { data: [], warning: `overpass-error: ${msg}` }
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

  return { data: buildings }
}
