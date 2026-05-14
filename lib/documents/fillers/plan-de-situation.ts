/**
 * Plan de situation filler — composes existing infrastructure into a PDF
 * that shows the customer's parcel + adjacent buildings + distance
 * annotations on the cached swisstopo aerial.
 *
 * Reuse:
 *   - lib/quote-pdf.ts:fetchMapImageBase64()  — cached WMS image (24h)
 *   - lib/swisstopo-parcel.ts:fetchParcel()   — cadastral polygon
 *   - lib/osm-buildings.ts:fetchNearbyBuildings() — OSM neighbor footprints
 *   - lib/geo.ts:distancePointToPolygonEdge()  — distance + nearest point
 *
 * All three external fetches are cached server-side; the rep can re-
 * download the plan de situation without waiting on swisstopo/Overpass.
 *
 * `appliesTo`: any PAC scenario + quote has map position (mapLat+mapLon).
 * Without map position, no plan to draw.
 */

import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DocumentTemplate } from '../types'
import type { FullQuote } from '@/lib/quote-pdf'
import { fetchMapImageBase64 } from '@/lib/quote-pdf'
import { fetchParcel } from '@/lib/swisstopo-parcel'
import { fetchNearbyBuildings } from '@/lib/osm-buildings'
import { distancePointToPolygonEdge } from '@/lib/geo'
import { PlanDeSituationPdf } from '@/components/pdf/PlanDeSituationPdf'

export const planDeSituation: DocumentTemplate = {
  slug: 'plan-de-situation',
  title: 'Plan de situation',
  description: "Extrait swisstopo + parcelle + voisins (annexe permis)",
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
    // Both checked in appliesTo, but be defensive — caller might invoke fill()
    // directly without going through the route's appliesTo gate.
    if (quote.mapLat == null || quote.mapLon == null) {
      throw new Error('Plan de situation requires mapLat/mapLon on the quote')
    }
    const lat = quote.mapLat
    const lon = quote.mapLon
    const zoom = quote.mapZoom ?? 17

    // Build the swisstopo Identify bounds — mirrors the WMS bbox so the
    // parcel polygon comes back in the same coordinate window as the
    // aerial image.
    const degOffset = 0.005 * Math.pow(2, 17 - Math.min(Math.max(zoom, 14), 20))
    const identifyBounds = {
      west: lon - degOffset,
      south: lat - degOffset,
      east: lon + degOffset,
      north: lat + degOffset,
    }

    // Parallelize the three external fetches — all are cached so cold fetch
    // can take a few seconds, but each is independent.
    const [mapImageDataUrl, parcelResult, neighborsResult] = await Promise.all([
      fetchMapImageBase64(lat, lon, zoom),
      fetchParcel({
        lat,
        lon,
        bounds: identifyBounds,
        width: 800,
        height: 500,
      }).catch((err) => {
        console.warn('[plan-de-situation] parcel fetch failed:', err)
        return { data: null, warning: 'parcel-error' as const }
      }),
      fetchNearbyBuildings(lat, lon, 80).catch((err) => {
        console.warn('[plan-de-situation] OSM fetch failed:', err)
        return { data: [], warning: 'osm-error' as const }
      }),
    ])

    // Unwrap the IdentifyResult — null parcel is fine, we just don't draw it.
    const parcelInfo = parcelResult.data

    // Compute distances + anchor points from PAC location to each neighbor.
    // Skip degenerate rings (< 2 vertices) — distancePointToPolygonEdge
    // returns null in that case.
    const neighbors = neighborsResult.data.flatMap((b) => {
      const result = distancePointToPolygonEdge({ lat, lon }, b.ring)
      if (!result) return []
      return [
        {
          id: b.id,
          ring: b.ring,
          address: b.address,
          distanceM: result.distanceMeters,
          // Closest point on the building polygon — anchor for the
          // distance line drawn from PAC location to building
          anchor: [result.closest.lon, result.closest.lat] as [number, number],
        },
      ]
    })

    // Filter out the customer's own building if the parcel polygon
    // contains the building's center — the rep doesn't care about
    // "distance to my own building." Matches the same filter used in
    // the live PAC map (see lib/osm-buildings.ts header comment).
    const filteredNeighbors = parcelInfo
      ? neighbors.filter((n) => {
          // Centroid of the neighbor's ring
          const cx = n.ring.reduce((s, p) => s + p[0], 0) / n.ring.length
          const cy = n.ring.reduce((s, p) => s + p[1], 0) / n.ring.length
          // If centroid lies inside the parcel, this is the customer's
          // own building — exclude. (Imperfect for L-shaped parcels but
          // good enough for v1; can refine with isPointInRing later.)
          const within =
            cx >= parcelInfo.bbox[0] &&
            cx <= parcelInfo.bbox[2] &&
            cy >= parcelInfo.bbox[1] &&
            cy <= parcelInfo.bbox[3]
          return !within
        })
      : neighbors

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(PlanDeSituationPdf, {
        customerName: quote.customerName,
        quoteNumber: quote.quoteNumber,
        siteAddress: quote.siteAddress,
        mapImageDataUrl,
        pacLocation: { lat, lon },
        mapZoom: zoom,
        parcelRing: parcelInfo?.ring ?? null,
        neighbors: filteredNeighbors,
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
