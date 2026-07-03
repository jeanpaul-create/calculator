import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Fetches ElCom electricity rate + feed-in tariff + PVGIS solar yield for a
// given location. Called client-side when address autocomplete selection fires.
// GET /api/site-info?zip=1185&lat=46.42&lon=6.35&commune=Rolle

// Rate lookup: uses the SwissRate table. Municipality-level rows (4-digit NPA,
// seeded from prisma/zip_energy_2026.json) carry the grid operator's feed-in
// tariff; 2-digit canton-prefix rows are the legacy fallback (retail only).
async function fetchRateFromDb(
  zip: string,
  commune?: string
): Promise<{
  rateCtPerKwh: number
  feedInCtPerKwh: number | null
  operatorName: string | null
  communeName: string
} | null> {
  try {
    // Try exact 4-digit zip first (municipality-specific rate + feed-in)
    let row = await prisma.swissRate.findFirst({
      where: { zipPrefix: zip },
      select: {
        rateRappenPerKwh: true,
        feedInRappenPerKwh: true,
        operatorName: true,
        communeName: true,
      },
    })
    // Fall back to 2-digit canton prefix (retail only)
    if (!row) {
      row = await prisma.swissRate.findFirst({
        where: { zipPrefix: zip.slice(0, 2) },
        select: {
          rateRappenPerKwh: true,
          feedInRappenPerKwh: true,
          operatorName: true,
          communeName: true,
        },
      })
    }
    if (!row) return null
    return {
      rateCtPerKwh: row.rateRappenPerKwh, // already stored as ct/kWh (rappen = centimes)
      feedInCtPerKwh: row.feedInRappenPerKwh,
      operatorName: row.operatorName,
      communeName: commune ?? row.communeName ?? '',
    }
  } catch {
    return null
  }
}

// PVGIS yield at a standard Swiss pitched-roof assumption: 30° tilt, south.
// (The previous horizontal-plane query understated yield by ~10–12%. True
// azimuth/tilt are unknown at address-select time; 30°/south is the standard
// sizing assumption and the rep can still override yield per scenario.)
async function fetchPvgisYield(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&angle=30&aspect=0&outputformat=json`,
      { signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const ey = data?.outputs?.totals?.fixed?.E_y
    return typeof ey === 'number' && ey > 0 ? Math.round(ey) : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const zip = searchParams.get('zip') ?? ''
  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lon = parseFloat(searchParams.get('lon') ?? '')
  const commune = searchParams.get('commune') ?? undefined

  if (!zip || !/^\d{4}$/.test(zip)) {
    return Response.json({ error: 'Invalid zip' }, { status: 400 })
  }

  const [rate, pvgis] = await Promise.all([
    fetchRateFromDb(zip, commune),
    !isNaN(lat) && !isNaN(lon) ? fetchPvgisYield(lat, lon) : Promise.resolve(null),
  ])

  return Response.json({
    rateCtPerKwh: rate?.rateCtPerKwh ?? null,
    feedInCtPerKwh: rate?.feedInCtPerKwh ?? null,
    operatorName: rate?.operatorName ?? null,
    communeName: rate?.communeName ?? null,
    yieldKwhPerKwp: pvgis,
  })
}
