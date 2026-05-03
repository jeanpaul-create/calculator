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

function numParam(url: URL, key: string): number | null {
  const v = url.searchParams.get(key)
  if (!v) return null
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

export async function GET(req: NextRequest) {
  try {
    await requireAuth()

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

    const parcel = await fetchParcel({
      lat,
      lon,
      bounds: { west, south, east, north },
      width,
      height,
    })

    if (!parcel) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({ found: true, ...parcel })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/swisstopo/parcel]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
