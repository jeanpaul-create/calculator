/**
 * Attestation de protection contre le bruit (OPB) — filler.
 *
 * Composes:
 *   - Quote data (customer, address)
 *   - First PAC scenario's primary PAC_MACHINE product
 *     → label + acousticPowerDb2C
 *   - lib/osm-buildings: nearest neighbor buildings + distances (same
 *     source as plan-de-situation; cached so repeat fills are instant)
 *   - lib/noise: calculate level at each receiver, OPB Class II compliance
 *
 * Required data:
 *   - Quote: mapLat + mapLon (for OSM neighbor query)
 *   - At least one PAC product with `acousticPowerDb2C` set
 *
 * Graceful degradation:
 *   - No PAC product or missing acoustic power → renders with "—" in
 *     those fields + a warning banner. Rep can hand-fill before sending.
 *   - No map position → returns 400 error from the route
 */

import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import type { DocumentTemplate } from '../types'
import { fetchNearbyBuildings } from '@/lib/osm-buildings'
import { distancePointToPolygonEdge } from '@/lib/geo'
import { calculateNoiseAtReceiver, type NoiseAtReceiver } from '@/lib/noise'
import { AttestationBruitPdf } from '@/components/pdf/AttestationBruitPdf'

export const attestationBruit: DocumentTemplate = {
  slug: 'attestation-bruit',
  title: 'Attestation bruit (OPB)',
  description: 'Évaluation acoustique aux récepteurs voisins',
  icon: '🔊',

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
      throw new Error('Attestation bruit requires mapLat/mapLon on the quote')
    }
    const lat = quote.mapLat
    const lon = quote.mapLon

    // Find the first PAC_MACHINE product across scenarios. For multi-
    // scenario quotes (e.g. 3 PAC variants), v1 picks the first; v1.x
    // could generate one attestation per scenario or use the
    // recommended tier.
    const pacMachineItem = quote.scenarios
      .flatMap((s) => s.items ?? [])
      .find((it) => it.product.category === 'PAC_MACHINE')

    const pacMachineLabel = pacMachineItem?.product.name ?? null
    // Reading acousticPowerDb2C requires the catalog to have it set. The
    // schema migration added the column nullable; products without a
    // catalog update won't have a value yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const productAny: any = pacMachineItem?.product
    const acousticPowerDbA: number | null =
      typeof productAny?.acousticPowerDb2C === 'number'
        ? productAny.acousticPowerDb2C
        : null

    // Fetch neighbors (same source as plan-de-situation, cached)
    const neighborsResult = await fetchNearbyBuildings(lat, lon, 80).catch(
      (err) => {
        console.warn('[attestation-bruit] OSM fetch failed:', err)
        return { data: [] as const, warning: 'osm-error' as const }
      }
    )

    // Compute distance to each neighbor's nearest edge + noise level.
    // If acousticPowerDbA is null, skip the noise calc — receivers
    // array gets distance only, the noise levelDbA will not be set
    // (we represent this by zeroing the noise threshold check —
    // safer than fabricating numbers).
    const receivers: Array<{
      label: string
      distanceM: number
      noise: NoiseAtReceiver
    }> = []

    for (let i = 0; i < neighborsResult.data.length; i++) {
      const b = neighborsResult.data[i]
      const dist = distancePointToPolygonEdge({ lat, lon }, b.ring)
      if (!dist) continue
      const label = b.address ?? `Bâtiment voisin ${i + 1}`
      if (acousticPowerDbA != null) {
        receivers.push({
          label,
          distanceM: dist.distanceMeters,
          noise: calculateNoiseAtReceiver(acousticPowerDbA, dist.distanceMeters),
        })
      } else {
        // Render distance only; noise calc is impossible without acoustic
        // power. Pretend-compliant flags so the table still renders.
        // The "data incomplete" warning at top of PDF flags this.
        receivers.push({
          label,
          distanceM: dist.distanceMeters,
          noise: {
            distanceM: dist.distanceMeters,
            levelDbA: NaN,
            compliesDayClassII: true,
            compliesNightClassII: true,
          },
        })
      }
    }

    // Sort by distance ascending — closest receivers first (most relevant
    // for compliance)
    receivers.sort((a, b) => a.distanceM - b.distanceM)

    const buffer = await renderToBuffer(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      React.createElement(AttestationBruitPdf, {
        customerName: quote.customerName,
        quoteNumber: quote.quoteNumber,
        siteAddress: quote.siteAddress,
        pacMachineLabel,
        acousticPowerDbA,
        receivers,
        repName: quote.rep?.name ?? null,
        generatedAt: new Date(),
      }) as any
    )

    return {
      buffer: new Uint8Array(buffer),
      filename: `attestation-bruit-${quote.quoteNumber}.pdf`,
      contentType: 'application/pdf',
    }
  },
}
