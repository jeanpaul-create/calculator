/**
 * Tests for the pure aggregator/extractor functions inside lib/swisstopo-*.ts.
 *
 * These functions previously lived inside the I/O entry points; extracting
 * them lets us regression-test the multi-surface aggregation bug we shipped
 * once before (gstrahlung / flaeche_kollektoren producing impossible
 * 3000+ kWh/m²/year values) and the MultiPolygon picking bug
 * (largest-by-bbox vs containing-the-click).
 */

import { describe, it, expect } from 'vitest'
import { aggregateBuilding } from '@/lib/swisstopo-roof'
import { extractParcel } from '@/lib/swisstopo-parcel'
import type { IdentifyFeature } from '@/lib/swisstopo-identify'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roofFeature(props: Record<string, unknown>): IdentifyFeature {
  return {
    featureId: Math.random(),
    layerBodId: 'ch.bfe.solarenergie-eignung-daecher',
    properties: props,
  }
}

function polyFeature(coords: [number, number][]): IdentifyFeature {
  return {
    featureId: 'p1',
    layerBodId: 'ch.kantone.cadastralwebmap-farbe',
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

function multiPolyFeature(polys: [number, number][][]): IdentifyFeature {
  return {
    featureId: 'mp1',
    layerBodId: 'ch.kantone.cadastralwebmap-farbe',
    geometry: {
      type: 'MultiPolygon',
      coordinates: polys.map((ring) => [ring]),
    },
  }
}

// ─── aggregateBuilding ────────────────────────────────────────────────────────

describe('aggregateBuilding', () => {
  it('returns null for empty features', () => {
    expect(aggregateBuilding([])).toBeNull()
  })

  it('aggregates a single-surface building', () => {
    const result = aggregateBuilding([
      roofFeature({
        building_id: 100,
        flaeche: 50,
        flaeche_kollektoren: 40,
        stromertrag: 4000,
        gstrahlung: 60_000,
        mstrahlung: 1200,
        klasse: 4,
        klasse_text: 'Sehr gut##Très bon##Molto buono##Very good##Sehr gut',
        neigung: 30,
      }),
    ])
    expect(result).not.toBeNull()
    expect(result!.totalRoofAreaM2).toBe(50)
    expect(result!.totalCollectorAreaM2).toBe(40)
    expect(result!.annualYieldKwh).toBe(4000)
    expect(result!.annualRadiationKwh).toBe(60_000)
    expect(result!.bestIrradiationKwhPerM2).toBe(1200)
    expect(result!.bestKlasse).toBe(4)
    expect(result!.bestKlasseLabel).toBe('Très bon')
    expect(result!.bestTiltDeg).toBe(30)
    expect(result!.surfaceCount).toBe(1)
    expect(result!.buildingId).toBe(100)
  })

  it('uses MAX (not avg) of mstrahlung across surfaces — regression for the irradiation bug', () => {
    // North-facing pan (low irradiation) + south-facing pan (high). The rep
    // wants the south-facing number, not the average — that's what
    // sonnendach.ch shows.
    const result = aggregateBuilding([
      roofFeature({ building_id: 1, mstrahlung: 600, klasse: 2, neigung: 30, flaeche: 30 }),
      roofFeature({ building_id: 1, mstrahlung: 1300, klasse: 5, neigung: 30, flaeche: 30 }),
      roofFeature({ building_id: 1, mstrahlung: 900, klasse: 3, neigung: 30, flaeche: 30 }),
    ])
    expect(result!.bestIrradiationKwhPerM2).toBe(1300)
    expect(result!.bestKlasse).toBe(5)
  })

  it('sums areas + yields across surfaces of the same building', () => {
    const result = aggregateBuilding([
      roofFeature({ building_id: 1, flaeche: 30, flaeche_kollektoren: 25, stromertrag: 3000 }),
      roofFeature({ building_id: 1, flaeche: 40, flaeche_kollektoren: 30, stromertrag: 4500 }),
    ])
    expect(result!.totalRoofAreaM2).toBe(70)
    expect(result!.totalCollectorAreaM2).toBe(55)
    expect(result!.annualYieldKwh).toBe(7500)
    expect(result!.surfaceCount).toBe(2)
  })

  it('filters to the first building_id when neighbours bleed in', () => {
    // Click tolerance can grab parts of the next building over. We pick the
    // building of the first hit and ignore the others.
    const result = aggregateBuilding([
      roofFeature({ building_id: 100, flaeche: 50, mstrahlung: 1200 }),
      roofFeature({ building_id: 100, flaeche: 30, mstrahlung: 1000 }),
      roofFeature({ building_id: 999, flaeche: 999, mstrahlung: 9999 }),  // neighbour, ignored
    ])
    expect(result!.totalRoofAreaM2).toBe(80) // 50 + 30, not + 999
    expect(result!.bestIrradiationKwhPerM2).toBe(1200) // not 9999
    expect(result!.surfaceCount).toBe(2)
    expect(result!.buildingId).toBe(100)
  })

  it('returns 0 (not NaN) when surface props are missing or zero', () => {
    const result = aggregateBuilding([
      roofFeature({ building_id: 1 }),  // all data missing
    ])
    expect(result!.totalRoofAreaM2).toBe(0)
    expect(result!.totalCollectorAreaM2).toBe(0)
    expect(result!.annualYieldKwh).toBe(0)
    expect(result!.bestIrradiationKwhPerM2).toBe(0)
    expect(result!.bestKlasse).toBe(0)
    // Number.isFinite check
    expect(Number.isFinite(result!.totalRoofAreaM2)).toBe(true)
  })

  it('handles string-typed numeric props (swisstopo sometimes returns them)', () => {
    const result = aggregateBuilding([
      roofFeature({
        building_id: 1,
        flaeche: '50.5',
        mstrahlung: '1200.5',
        klasse: '4',
      }),
    ])
    expect(result!.totalRoofAreaM2).toBe(50.5)
    expect(result!.bestIrradiationKwhPerM2).toBe(1201) // rounded
    expect(result!.bestKlasse).toBe(4)
  })

  it('uses the single feature when no building_id is present (defensive)', () => {
    const result = aggregateBuilding([
      roofFeature({ flaeche: 60, mstrahlung: 1100 }),
      roofFeature({ flaeche: 999, mstrahlung: 9999 }),  // ignored: no building_id grouping
    ])
    expect(result!.totalRoofAreaM2).toBe(60)
    expect(result!.bestIrradiationKwhPerM2).toBe(1100)
  })
})

// ─── extractParcel ────────────────────────────────────────────────────────────

describe('extractParcel', () => {
  const click = { lat: 0.5, lon: 0.5 }

  it('returns null when no polygon feature is present', () => {
    const features: IdentifyFeature[] = [
      { featureId: 1, layerBodId: 'x', geometry: { type: 'Point', coordinates: [0, 0] } },
    ]
    expect(extractParcel(features, click)).toBeNull()
  })

  it('returns null for empty features', () => {
    expect(extractParcel([], click)).toBeNull()
  })

  it('extracts the outer ring from a simple Polygon', () => {
    const ring: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]
    const result = extractParcel([polyFeature(ring)], click)
    expect(result).not.toBeNull()
    expect(result!.ring).toEqual(ring)
    expect(result!.bbox).toEqual([0, 0, 1, 1])
  })

  it('picks the MultiPolygon ring containing the click — regression for the bbox-only bug', () => {
    // Two polygons in a single MultiPolygon feature:
    //   smallPoly is at (0,0)-(1,1), area = 1
    //   bigPoly   is at (5,5)-(10,10), area = 25 (much larger)
    // Click is at (0.5, 0.5) — inside smallPoly, NOT inside bigPoly.
    // Old code: picked bigPoly because it had the larger bbox area. Wrong.
    // New code: picks smallPoly because it contains the click point.
    const smallPoly: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]
    const bigPoly: [number, number][] = [
      [5, 5],
      [10, 5],
      [10, 10],
      [5, 10],
      [5, 5],
    ]
    const result = extractParcel(
      [multiPolyFeature([smallPoly, bigPoly])],
      { lat: 0.5, lon: 0.5 }
    )
    expect(result).not.toBeNull()
    expect(result!.ring).toEqual(smallPoly)
  })

  it('falls back to the largest polygon when the click is not inside any of them', () => {
    // Edge case: click lands on a shared boundary or just outside both
    // polygons. Pick the largest as a defensive fallback.
    const smallPoly: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
      [0, 0],
    ]
    const bigPoly: [number, number][] = [
      [5, 5],
      [10, 5],
      [10, 10],
      [5, 10],
      [5, 5],
    ]
    const result = extractParcel(
      [multiPolyFeature([smallPoly, bigPoly])],
      { lat: 100, lon: 100 } // far outside both
    )
    expect(result).not.toBeNull()
    expect(result!.ring).toEqual(bigPoly)
  })
})
