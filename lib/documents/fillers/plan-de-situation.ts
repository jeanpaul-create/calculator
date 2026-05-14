/**
 * Plan de situation filler — composes existing infrastructure into a
 * cantonal-permit-ready cadastral plan at 1:500 scale.
 *
 * Reuse:
 *   - lib/swisstopo-cadastral.ts   — NEW: cadastral webmap WMS at scale
 *   - lib/swisstopo-parcel.ts      — cadastral polygon (customer's parcel)
 *   - lib/osm-buildings.ts         — neighbor building footprints
 *   - lib/geo.ts                   — distance + adjacency math
 *
 * v1.1 changes (from user feedback after preview test):
 *   1. Cadastral webmap layer instead of aerial swissimage — matches
 *      cantonal permit convention (a "plan de situation" is the line-
 *      art cadastre, not the photograph)
 *   2. 1:500 scale — page-print scale guarantee. Bbox computed from
 *      A4 content width × 500.
 *   3. Adjacent parcels only — buildings within ~20m of the customer's
 *      parcel boundary, approximating "on a parcel that shares an edge
 *      with mine." Replaces the previous 80m PAC-location radius which
 *      brought in too many distant buildings.
 *
 * `appliesTo`: any PAC scenario + quote has map position (mapLat+mapLon).
 */

import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DocumentTemplate } from '../types'
import {
  fetchCadastralMapBase64,
  computeBboxForScale,
} from '@/lib/swisstopo-cadastral'
import { fetchParcel } from '@/lib/swisstopo-parcel'
import { fetchNearbyBuildings, type OsmBuilding } from '@/lib/osm-buildings'
import {
  distancePointToPolygonEdge,
  minDistanceBetweenRings,
  isPointInRing,
} from '@/lib/geo'
import { PlanDeSituationPdf } from '@/components/pdf/PlanDeSituationPdf'

const SCALE_DENOMINATOR = 500
/** Distance threshold (meters) below which a building is treated as "on
 *  an adjacent parcel." Calibrated for typical Swiss residential lots
 *  where the customer's house sits 5-10m from the property line and
 *  neighbors' houses likewise — total neighbor-house-to-our-parcel-edge
 *  distance is usually 5-15m. 20m catches all adjacents plus a small
 *  buffer; further buildings are typically 2+ parcels away. */
const ADJACENT_THRESHOLD_M = 20

export const planDeSituation: DocumentTemplate = {
  slug: 'plan-de-situation',
  title: 'Plan de situation',
  description: 'Plan cadastral 1:500 avec parcelles adjacentes (permis)',
  icon: '🗺️',

  appliesTo: (quote) => {
    const hasPacScenario = quote.scenarios.some(
      (s) =>
        s.scenarioType === 'PAC' ||
        s.items?.some((it) => String(it.product.category).startsWith('PAC_'))
    )
    const hasMapPosition = quote.mapLat != null && quote.mapLon != null
    return hasPacScenario && hasMapPosition
  },

  fill: async (quote) => {
    if (quote.mapLat == null || quote.mapLon == null) {
      throw new Error('Plan de situation requires mapLat/mapLon on the quote')
    }
    const lat = quote.mapLat
    const lon = quote.mapLon

    // Compute the bbox for 1:500 scale on A4. Single source of truth —
    // the cadastral fetch + the PDF's SVG projection share this bbox so
    // overlays align with the underlying map image.
    const bbox = computeBboxForScale(lat, lon, {
      scaleDenominator: SCALE_DENOMINATOR,
    })

    // Identify-API call bounds — same as the WMS bbox, in the shape
    // swisstopo-parcel.ts expects (west/south/east/north).
    const identifyBounds = {
      west: bbox.lonMin,
      south: bbox.latMin,
      east: bbox.lonMax,
      north: bbox.latMax,
    }

    // Parallel external fetches (all cached, so cold start can be 5-10s
    // total but subsequent generations are instant)
    const [mapImageDataUrl, parcelResult, neighborsResult] = await Promise.all([
      fetchCadastralMapBase64(lat, lon, SCALE_DENOMINATOR),
      fetchParcel({
        lat,
        lon,
        bounds: identifyBounds,
        width: 1600,
        height: 1000,
      }).catch((err) => {
        console.warn('[plan-de-situation] parcel fetch failed:', err)
        return { data: null, warning: 'parcel-error' as const }
      }),
      // Search a slightly wider radius than the visible bbox so we
      // don't miss adjacent buildings whose centroid sits just outside
      // the cadastral window but whose closest-edge to our parcel is
      // within the adjacency threshold. 100m covers typical lot widths
      // (the bbox is ~91m wide).
      fetchNearbyBuildings(lat, lon, 100).catch((err) => {
        console.warn('[plan-de-situation] OSM fetch failed:', err)
        return { data: [] as OsmBuilding[], warning: 'osm-error' as const }
      }),
    ])

    const parcelInfo = parcelResult.data

    // ─── Filter buildings to adjacent-parcel only ─────────────────────
    // Two-step filter:
    //   1. Drop buildings whose centroid is INSIDE the customer's parcel
    //      (this is the customer's own building — same filter as v1.0)
    //   2. Keep only buildings within ADJACENT_THRESHOLD_M of the
    //      customer's parcel boundary (these are practically always on
    //      a directly-adjacent parcel for Swiss residential layouts)
    //
    // Without the parcel polygon, we fall back to v1.0 behavior
    // (centroid-bbox filter + show all in 100m). That's worse than
    // adjacent-only but better than nothing.
    const adjacentBuildings = parcelInfo
      ? neighborsResult.data.filter((b) => {
          // Centroid test — exclude customer's own building
          const cx = b.ring.reduce((s, p) => s + p[0], 0) / b.ring.length
          const cy = b.ring.reduce((s, p) => s + p[1], 0) / b.ring.length
          if (isPointInRing({ lat: cy, lon: cx }, parcelInfo.ring)) {
            return false
          }
          // Adjacency test — keep only buildings close to our boundary
          const minDist = minDistanceBetweenRings(b.ring, parcelInfo.ring)
          return minDist < ADJACENT_THRESHOLD_M
        })
      : neighborsResult.data

    // Compute distance from PAC location + anchor point per kept building
    const neighbors = adjacentBuildings.flatMap((b) => {
      const result = distancePointToPolygonEdge({ lat, lon }, b.ring)
      if (!result) return []
      return [
        {
          id: b.id,
          ring: b.ring,
          address: b.address,
          distanceM: result.distanceMeters,
          anchor: [result.closest.lon, result.closest.lat] as [number, number],
        },
      ]
    })

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PlanDeSituationPdf, {
        customerName: quote.customerName,
        quoteNumber: quote.quoteNumber,
        siteAddress: quote.siteAddress,
        mapImageDataUrl,
        pacLocation: { lat, lon },
        bbox,
        scaleDenominator: SCALE_DENOMINATOR,
        parcelRing: parcelInfo?.ring ?? null,
        neighbors,
        generatedAt: new Date(),
      }) as any
    )

    return {
      buffer: new Uint8Array(buffer),
      filename: `plan-de-situation-${quote.quoteNumber}.pdf`,
      contentType: 'application/pdf',
    }
  },
}
