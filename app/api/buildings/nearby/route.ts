/**
 * GET /api/buildings/nearby?lat=X&lon=Y&radius=80
 *
 * Auth-gated proxy to OpenStreetMap (Overpass API). Returns building
 * footprint polygons within the radius — used on the PAC map to compute
 * distances to neighboring buildings.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchNearbyBuildings } from '@/lib/osm-buildings'
import { enforceRateLimit } from '@/lib/rate-limit'

const RATE_LIMIT_PER_MIN = 100
const ONE_MIN_MS = 60_000

function numParam(url: URL, key: string): number | null {
  const v = url.searchParams.get(key)
  if (!v) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()

    // Per-user rate limit (100/min). Overpass has fair-use limits — protect
    // our egress IP from being banned by buggy useEffect loops.
    const { ok } = await enforceRateLimit({
      key: `osm-nearby:user:${session.user.id}`,
      windowMs: ONE_MIN_MS,
      max: RATE_LIMIT_PER_MIN,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    }

    const url = new URL(req.url)
    const lat = numParam(url, 'lat')
    const lon = numParam(url, 'lon')
    const radius = numParam(url, 'radius') ?? 80

    if (lat === null || lon === null) {
      return NextResponse.json({ error: 'Missing or invalid coordinates' }, { status: 422 })
    }

    const result = await fetchNearbyBuildings(lat, lon, radius)

    // Backwards-compatible response shape: { buildings, warning? }. The lib
    // now uses { data, warning? } internally for consistency with the
    // swisstopo libs, but the route output stays stable so SiteMap.tsx
    // doesn't need to change.
    return NextResponse.json({ buildings: result.data, warning: result.warning })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/buildings/nearby]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
