/**
 * Lightweight geo distance helpers for Swiss-scale (parcel-level) work.
 *
 * For distances under ~500m at Swiss latitudes (46–47°N), treating WGS84
 * coordinates as if they were Cartesian — after scaling longitude by
 * `cos(latitude)` — gives sub-meter accuracy. That's good enough for
 * "PAC unit to property line" calculations where the user expects whole-
 * meter precision.
 *
 * For longer distances, use proper haversine.
 */

const EARTH_RADIUS_M = 6_371_000

/**
 * Bounding box of Switzerland (WGS84). Used by every Swiss-data lib (roof,
 * parcel, OSM buildings) to short-circuit out-of-bounds requests so we don't
 * proxy arbitrary world coordinates to swisstopo / Overpass.
 *
 *   south: 45.5°N (Mendrisio area)
 *   north: 47.9°N (Schaffhausen area)
 *   west : 5.9°E  (Geneva area)
 *   east : 10.6°E (Müstair area)
 *
 * Padded slightly outside the actual border to account for cross-border
 * properties on the French / German / Italian frontier.
 */
export const SWISS_BOUNDS = {
  latMin: 45.5,
  latMax: 47.9,
  lonMin: 5.9,
  lonMax: 10.6,
} as const

/** True if the (lat, lon) pair is within (or near) the Swiss bbox. */
export function isInSwissBounds(lat: number, lon: number): boolean {
  return (
    lat >= SWISS_BOUNDS.latMin &&
    lat <= SWISS_BOUNDS.latMax &&
    lon >= SWISS_BOUNDS.lonMin &&
    lon <= SWISS_BOUNDS.lonMax
  )
}

/**
 * Distance between two WGS84 points in meters using the haversine formula.
 * Accurate at any scale.
 */
export function haversineMeters(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number }
): number {
  const φ1 = (a.lat * Math.PI) / 180
  const φ2 = (b.lat * Math.PI) / 180
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)))
}

/**
 * Project a WGS84 lat/lon to local Cartesian meters relative to an origin
 * lat/lon. Accurate to <0.5m for distances up to ~1km from the origin.
 */
function toLocalMeters(
  origin: { lat: number; lon: number },
  point: { lat: number; lon: number }
): { x: number; y: number } {
  const dLat = (point.lat - origin.lat) * (Math.PI / 180)
  const dLon = (point.lon - origin.lon) * (Math.PI / 180)
  const cosLat = Math.cos((origin.lat * Math.PI) / 180)
  return {
    x: dLon * EARTH_RADIUS_M * cosLat,
    y: dLat * EARTH_RADIUS_M,
  }
}

interface MetersPoint {
  x: number
  y: number
}

/**
 * Squared distance from point P to line segment AB, in the same units as
 * the inputs. Returns the projection point too, so callers can draw a line.
 */
function pointToSegmentSq(
  p: MetersPoint,
  a: MetersPoint,
  b: MetersPoint
): { distSq: number; closest: MetersPoint } {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) {
    // Degenerate segment — distance to endpoint
    const ex = p.x - a.x, ey = p.y - a.y
    return { distSq: ex * ex + ey * ey, closest: { x: a.x, y: a.y } }
  }
  // t = projection parameter, clamped to [0,1] to stay on the segment
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq))
  const closest = { x: a.x + t * dx, y: a.y + t * dy }
  const ex = p.x - closest.x, ey = p.y - closest.y
  return { distSq: ex * ex + ey * ey, closest }
}

/**
 * Minimum distance (meters) from a point to the boundary of a closed polygon
 * ring. Returns the closest point on the boundary too, so the caller can
 * draw a "closest distance" line.
 *
 * @param point  WGS84 lat/lon
 * @param ring   Closed polygon ring as [lon, lat] pairs (first === last). Holes ignored.
 */
export function distancePointToPolygonEdge(
  point: { lat: number; lon: number },
  ring: [number, number][]
): { distanceMeters: number; closest: { lat: number; lon: number } } | null {
  if (ring.length < 2) return null

  // Project everything to local meters relative to the point — keeps
  // accuracy and avoids cosine drift across the ring.
  const origin = point
  const pLocal = { x: 0, y: 0 } // point IS the origin
  const ringLocal = ring.map(([lon, lat]) => toLocalMeters(origin, { lat, lon }))

  let bestDistSq = Infinity
  let bestClosest: MetersPoint = { x: 0, y: 0 }

  for (let i = 0; i < ringLocal.length - 1; i++) {
    const { distSq, closest } = pointToSegmentSq(pLocal, ringLocal[i], ringLocal[i + 1])
    if (distSq < bestDistSq) {
      bestDistSq = distSq
      bestClosest = closest
    }
  }

  if (!Number.isFinite(bestDistSq)) return null

  // Convert closest point back to WGS84 (inverse of toLocalMeters)
  const cosLat = Math.cos((origin.lat * Math.PI) / 180)
  const closestLat = origin.lat + (bestClosest.y / EARTH_RADIUS_M) * (180 / Math.PI)
  const closestLon = origin.lon + (bestClosest.x / (EARTH_RADIUS_M * cosLat)) * (180 / Math.PI)

  return {
    distanceMeters: Math.sqrt(bestDistSq),
    closest: { lat: closestLat, lon: closestLon },
  }
}

/**
 * Whether a point is inside a polygon ring (ray casting). Robust enough for
 * non-self-intersecting parcel boundaries.
 */
export function isPointInRing(
  point: { lat: number; lon: number },
  ring: [number, number][]
): boolean {
  let inside = false
  const x = point.lon, y = point.lat
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0], yi = ring[i][1]
    const xj = ring[j][0], yj = ring[j][1]
    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-15) + xi
    if (intersect) inside = !inside
  }
  return inside
}
