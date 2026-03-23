import { NextRequest } from 'next/server'

// Fetches ElCom electricity rate + PVGIS solar yield for a given location.
// Called client-side when address autocomplete selection fires.
// GET /api/site-info?zip=1185&lat=46.42&lon=6.35

const ELCOM_GQL = 'https://www.prix-electricite.elcom.admin.ch/api/graphql'
const ELCOM_HEADERS = {
  'Content-Type': 'application/json',
  Referer: 'https://www.prix-electricite.elcom.admin.ch/',
  Origin: 'https://www.prix-electricite.elcom.admin.ch',
}

async function fetchElcomRate(
  zip: string
): Promise<{ rateCtPerKwh: number; operatorName: string; communeName: string } | null> {
  try {
    // 1. Resolve NPA → commune name via swisstopo
    const geoRes = await fetch(
      `https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&searchText=${encodeURIComponent(zip)}&lang=fr&limit=1`,
      { signal: AbortSignal.timeout(4000) }
    )
    if (!geoRes.ok) return null
    const geoData = await geoRes.json()
    const rawLabel: string = geoData.results?.[0]?.attrs?.label ?? ''
    const communeName = rawLabel.replace(/<[^>]*>/g, '').replace(/^\d{4}\s*[-–]\s*/, '').trim()
    if (!communeName) return null

    // 2. Find ElCom municipality ID by commune name
    const searchRes = await fetch(ELCOM_GQL, {
      method: 'POST',
      headers: ELCOM_HEADERS,
      body: JSON.stringify({ query: `{ search(locale: "fr", query: ${JSON.stringify(communeName)}) { id name } }` }),
      signal: AbortSignal.timeout(5000),
    })
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const municipality: { id: string; name: string } | undefined =
      (searchData.data?.search ?? []).find((m: { id: string; name: string }) => m.name === communeName)
    if (!municipality) return null

    // 3. H4 standard total rate for the current year
    const year = new Date().getFullYear().toString()
    const rateRes = await fetch(ELCOM_GQL, {
      method: 'POST',
      headers: ELCOM_HEADERS,
      body: JSON.stringify({
        query: `{ observations(locale: "fr", filters: { municipality: [${JSON.stringify(municipality.id)}], category: "H4", product: "standard", period: [${JSON.stringify(year)}] }, observationKind: Municipality) { value(priceComponent: total) operatorLabel } }`,
      }),
      signal: AbortSignal.timeout(5000),
    })
    if (!rateRes.ok) return null
    const rateData = await rateRes.json()
    const obs = rateData.data?.observations?.[0]
    const rate: unknown = obs?.value
    return typeof rate === 'number'
      ? { rateCtPerKwh: rate, operatorName: obs.operatorLabel ?? '', communeName }
      : null
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

  if (!zip || !/^\d{4}$/.test(zip)) {
    return Response.json({ error: 'Invalid zip' }, { status: 400 })
  }

  const [elcom, pvgis] = await Promise.all([
    fetchElcomRate(zip),
    !isNaN(lat) && !isNaN(lon) ? fetchPvgisYield(lat, lon) : Promise.resolve(null),
  ])

  return Response.json({
    rateCtPerKwh: elcom?.rateCtPerKwh ?? null,
    operatorName: elcom?.operatorName ?? null,
    communeName: elcom?.communeName ?? null,
    yieldKwhPerKwp: pvgis,
  })
}
