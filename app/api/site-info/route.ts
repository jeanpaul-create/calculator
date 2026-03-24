import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'

// Fetches ElCom electricity rate + PVGIS solar yield for a given location.
// Called client-side when address autocomplete selection fires.
// GET /api/site-info?zip=1185&lat=46.42&lon=6.35&commune=Rolle

// Rate lookup: uses the SwissRate table (seeded from ElCom canton-level data).
// Falls back gracefully when commune name is unavailable.
async function fetchRateFromDb(
  zip: string,
  commune?: string
): Promise<{ rateCtPerKwh: number; communeName: string } | null> {
  try {
    const zipPrefix = zip.slice(0, 2)
    const row = await prisma.swissRate.findFirst({
      where: { zipPrefix },
      select: { rateRappenPerKwh: true },
    })
    if (!row) return null
    return {
      rateCtPerKwh: row.rateRappenPerKwh, // already stored as ct/kWh (rappen = centimes)
      communeName: commune ?? '',
    }
  } catch {
    return null
  }
}

async function fetchPvgisYield(lat: number, lon: number): Promise<number | null> {
  try {
    const res = await fetch(
      `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&outputformat=json`,
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
    operatorName: null,
    communeName: rate?.communeName ?? null,
    yieldKwhPerKwp: pvgis,
  })
}
