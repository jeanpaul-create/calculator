/**
 * GET /api/swisstopo/roof?lat=X&lon=Y&west=A&south=B&east=C&north=D&w=W&h=H
 *
 * Auth-gated proxy to the swisstopo Identify API. Returns aggregated roof
 * info for the building under the click point, or { found: false } if the
 * click didn't hit a roof feature.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { fetchRoofInfo } from '@/lib/swisstopo-roof'

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

    const info = await fetchRoofInfo({
      lat,
      lon,
      bounds: { west, south, east, north },
      width,
      height,
    })

    if (!info) {
      return NextResponse.json({ found: false })
    }

    return NextResponse.json({ found: true, ...info })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/swisstopo/roof]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
