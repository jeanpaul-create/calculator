/**
 * Cadastre parcel lookup on top of `ch.kantone.cadastralwebmap-farbe`.
 *
 * Identifies the property parcel under a click point and returns its outer
 * polygon ring for distance-to-edge calculations on the PAC map.
 *
 *   Architecture (ASCII):
 *
 *     fetchParcel(input)
 *           │
 *           └─► swisstopoIdentify(layer='ch.kantone.cadastralwebmap-farbe')
 *                     │
 *                     └─► extractParcel(features)  ← pure, unit-testable
 *                               │
 *                               ├─► find first Polygon/MultiPolygon feature
 *                               ├─► Polygon → outer ring
 *                               └─► MultiPolygon → largest polygon's outer ring
 */

import {
  swisstopoIdentify,
  type IdentifyFeature,
  type IdentifyResult,
} from '@/lib/swisstopo-identify'
import { isPointInRing } from '@/lib/geo'

const LAYER = 'ch.kantone.cadastralwebmap-farbe'

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

// ─── Pure feature → ParcelInfo extraction (unit-testable) ─────────────────────

/**
 * Pick the right parcel polygon for the click point.
 *
 *   Single Polygon → outer ring
 *   MultiPolygon   → polygon containing the click (point-in-ring); falls
 *                    back to largest by bbox area if no ring contains the
 *                    click (edge case — click on shared boundary).
 *
 * The previous version always picked the largest polygon by bbox area,
 * which silently misidentified the parcel when the click was inside a
 * smaller polygon of a MultiPolygon parcel. Fixed (covered by T4 tests).
 *
 * @param features  Identify features for the layer at the click.
 * @param clickPoint  Lat/lon of the click — used to disambiguate MultiPolygon.
 */
export function extractParcel(
  features: IdentifyFeature[],
  clickPoint: { lat: number; lon: number }
): ParcelInfo | null {
  const feature = features.find(
    (r) =>
      r.geometry &&
      (r.geometry.type === 'Polygon' || r.geometry.type === 'MultiPolygon')
  )
  if (!feature || !feature.geometry) return null

  let ring: [number, number][]
  if (feature.geometry.type === 'Polygon') {
    ring = feature.geometry.coordinates[0] as [number, number][]
  } else {
    // MultiPolygon: prefer the polygon whose outer ring contains the click
    // point. Fall back to the largest by bbox area if none contains the
    // click (e.g. click landed exactly on a shared edge).
    const polygons = feature.geometry.coordinates as [number, number][][][]
    const containing = polygons.find((poly) =>
      isPointInRing(clickPoint, poly[0])
    )
    if (containing) {
      ring = containing[0]
    } else {
      let bestArea = 0
      let bestRing: [number, number][] = polygons[0][0]
      for (const poly of polygons) {
        const ring0 = poly[0]
        const xs = ring0.map((c) => c[0])
        const ys = ring0.map((c) => c[1])
        const a =
          (Math.max(...xs) - Math.min(...xs)) *
          (Math.max(...ys) - Math.min(...ys))
        if (a > bestArea) {
          bestArea = a
          bestRing = ring0
        }
      }
      ring = bestRing
    }
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

// ─── Effectful entry ──────────────────────────────────────────────────────────

export async function fetchParcel(
  input: ParcelIdentifyInput
): Promise<IdentifyResult<ParcelInfo>> {
  const result = await swisstopoIdentify({ ...input, layer: LAYER })

  if (result.warning) return { data: null, warning: result.warning }
  if (!result.data) return { data: null }

  const parcel = extractParcel(result.data, { lat: input.lat, lon: input.lon })
  return { data: parcel }
}
