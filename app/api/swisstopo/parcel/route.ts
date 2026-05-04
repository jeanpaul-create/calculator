/**
 * GET /api/swisstopo/parcel?lat=X&lon=Y&west=…&south=…&east=…&north=…&w=…&h=…
 *
 * Auth-gated proxy to swisstopo's cadastre Identify API. Returns the polygon
 * (outer ring) of the property parcel under the click point, for use in
 * distance-to-property-line calculations on the PAC map.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchParcel } from '@/lib/swisstopo-parcel'
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

    // Per-user rate limit (100/min) — same protection as the roof route.
    const { ok } = await enforceRateLimit({
      key: `swisstopo-parcel:user:${session.user.id}`,
      windowMs: ONE_MIN_MS,
      max: RATE_LIMIT_PER_MIN,
    })
    if (!ok) {
      return NextResponse.json({ error: 'Trop de requêtes' }, { status: 429 })
    }

    const url = new URL(req.url)
    const lat = numParam(url, 'lat')
    const lon = numParam(url, 'lon')
    const west = numParam(url, 'west')
    const south = numParam(url, 'south')
    const east = numParam(url, 'east')
    const north = numParam(url, 'north')
    const width = numParam(url, 'w') ?? 1280
    const height = numParam(url, 'h') ?? 720

    if (
      lat === null || lon === null ||
      west === null || south === null || east === null || north === null
    ) {
      return NextResponse.json({ error: 'Missing or invalid coordinates' }, { status: 422 })
    }

    const result = await fetchParcel({
      lat,
      lon,
      bounds: { west, south, east, north },
      width,
      height,
    })

    if (!result.data) {
      return NextResponse.json({ found: false, warning: result.warning })
    }

    return NextResponse.json({ found: true, ...result.data })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/swisstopo/parcel]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
