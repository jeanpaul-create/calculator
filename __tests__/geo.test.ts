import { describe, it, expect } from 'vitest'
import {
  haversineMeters,
  distancePointToPolygonEdge,
  isPointInRing,
} from '@/lib/geo'

// ─── haversineMeters ──────────────────────────────────────────────────────────

describe('haversineMeters', () => {
  it('returns 0 for the same point', () => {
    const p = { lat: 46.5, lon: 6.6 }
    expect(haversineMeters(p, p)).toBe(0)
  })

  it('matches a known Geneva → Zurich distance (~224 km)', () => {
    // Reference: ~224 km airline distance, ±2 km tolerance for great-circle vs road
    const geneva = { lat: 46.2044, lon: 6.1432 }
    const zurich = { lat: 47.3769, lon: 8.5417 }
    const d = haversineMeters(geneva, zurich)
    expect(d).toBeGreaterThan(222_000)
    expect(d).toBeLessThan(226_000)
  })

  it('is symmetric (a→b === b→a)', () => {
    const a = { lat: 46.95, lon: 7.45 } // Bern
    const b = { lat: 46.5, lon: 6.6 } // Lausanne
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 5)
  })

  it('produces finite results for antipodal points', () => {
    const a = { lat: 0, lon: 0 }
    const b = { lat: 0, lon: 180 }
    const d = haversineMeters(a, b)
    expect(Number.isFinite(d)).toBe(true)
    // ~half the Earth's circumference (~20,015 km)
    expect(d).toBeGreaterThan(19_900_000)
    expect(d).toBeLessThan(20_100_000)
  })

  it('handles small (parcel-scale) distances accurately', () => {
    // 1 minute of latitude ≈ 1852 m at any longitude
    const a = { lat: 46.5, lon: 6.6 }
    const b = { lat: 46.5 + 1 / 60, lon: 6.6 }
    const d = haversineMeters(a, b)
    expect(d).toBeGreaterThan(1850)
    expect(d).toBeLessThan(1855)
  })
})

// ─── distancePointToPolygonEdge ───────────────────────────────────────────────

describe('distancePointToPolygonEdge', () => {
  // Helper: a 20m-side square ring centered on (46.5, 6.6).
  // Roughly ±0.00009° lat = ±10m, ±0.00013° lon = ±10m at this latitude.
  const dLat = 10 / 111_320 // meters→degrees latitude
  const dLon = 10 / (111_320 * Math.cos((46.5 * Math.PI) / 180))
  const square: [number, number][] = [
    [6.6 - dLon, 46.5 - dLat],
    [6.6 + dLon, 46.5 - dLat],
    [6.6 + dLon, 46.5 + dLat],
    [6.6 - dLon, 46.5 + dLat],
    [6.6 - dLon, 46.5 - dLat], // close the ring
  ]

  it('returns null for a degenerate (single-point) ring', () => {
    expect(distancePointToPolygonEdge({ lat: 46.5, lon: 6.6 }, [])).toBeNull()
    expect(
      distancePointToPolygonEdge({ lat: 46.5, lon: 6.6 }, [[6.6, 46.5]])
    ).toBeNull()
  })

  it('reports ~10m from the center to the edge of a 20m square', () => {
    const result = distancePointToPolygonEdge({ lat: 46.5, lon: 6.6 }, square)
    expect(result).not.toBeNull()
    expect(result!.distanceMeters).toBeGreaterThan(9.5)
    expect(result!.distanceMeters).toBeLessThan(10.5)
  })

  it('reports ~5m for a point 5m outside the right edge', () => {
    // 5m east of the right edge → 15m east of center
    const point = { lat: 46.5, lon: 6.6 + (15 / (111_320 * Math.cos((46.5 * Math.PI) / 180))) }
    const result = distancePointToPolygonEdge(point, square)
    expect(result).not.toBeNull()
    expect(result!.distanceMeters).toBeGreaterThan(4.5)
    expect(result!.distanceMeters).toBeLessThan(5.5)
  })

  it('reports ~0m for a point on the boundary', () => {
    const onEdge = { lat: 46.5 - dLat, lon: 6.6 }
    const result = distancePointToPolygonEdge(onEdge, square)
    expect(result).not.toBeNull()
    expect(result!.distanceMeters).toBeLessThan(0.1)
  })

  it('returns the closest point lat/lon coherently', () => {
    // Point well outside the square to the north → closest should be on the
    // northern edge (same longitude as the point, lat = top edge).
    const north = { lat: 46.5 + dLat * 5, lon: 6.6 }
    const result = distancePointToPolygonEdge(north, square)
    expect(result).not.toBeNull()
    // Closest lat ≈ top of square (46.5 + dLat); lon ≈ point's lon (6.6)
    expect(result!.closest.lat).toBeCloseTo(46.5 + dLat, 4)
    expect(result!.closest.lon).toBeCloseTo(6.6, 4)
  })

  it('handles a degenerate segment (two identical adjacent points)', () => {
    const ringWithDup: [number, number][] = [
      [6.6, 46.5],
      [6.6, 46.5], // duplicate — degenerate segment
      [6.6 + dLon, 46.5 + dLat],
      [6.6, 46.5],
    ]
    const result = distancePointToPolygonEdge({ lat: 46.5 + 0.0001, lon: 6.6 }, ringWithDup)
    expect(result).not.toBeNull()
    expect(Number.isFinite(result!.distanceMeters)).toBe(true)
  })
})

// ─── isPointInRing ────────────────────────────────────────────────────────────

describe('isPointInRing', () => {
  // A simple unit square in lon/lat (closed)
  const square: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]

  it('returns true for a point clearly inside', () => {
    expect(isPointInRing({ lat: 0.5, lon: 0.5 }, square)).toBe(true)
  })

  it('returns false for a point clearly outside', () => {
    expect(isPointInRing({ lat: -0.5, lon: 0.5 }, square)).toBe(false)
    expect(isPointInRing({ lat: 0.5, lon: 1.5 }, square)).toBe(false)
    expect(isPointInRing({ lat: 2, lon: 2 }, square)).toBe(false)
  })

  it('does not crash on a vertex (boundary case)', () => {
    // Boundary is technically undefined in ray-casting; assert no crash
    expect(() => isPointInRing({ lat: 0, lon: 0 }, square)).not.toThrow()
  })

  it('correctly identifies inside for an irregular convex polygon', () => {
    const triangle: [number, number][] = [
      [0, 0],
      [4, 0],
      [2, 3],
      [0, 0],
    ]
    expect(isPointInRing({ lat: 1, lon: 2 }, triangle)).toBe(true)
    expect(isPointInRing({ lat: 4, lon: 2 }, triangle)).toBe(false)
  })
})
