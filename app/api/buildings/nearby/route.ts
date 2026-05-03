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
    const radius = numParam(url, 'radius') ?? 80

    if (lat === null || lon === null) {
      return NextResponse.json({ error: 'Missing or invalid coordinates' }, { status: 422 })
    }

    const result = await fetchNearbyBuildings(lat, lon, radius)

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/buildings/nearby]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
