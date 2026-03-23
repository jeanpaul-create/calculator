import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import CalculatorForm from '@/components/calculator/CalculatorForm'
import { DEFAULT_ION_COEFFICIENTS, IonPricingCoefficients } from '@/lib/pricing'

// ─── PVGIS helpers ────────────────────────────────────────────────────────────

async function geocodeZip(zip: string): Promise<{ lat: number; lon: number } | null> {
  try {
    const res = await fetch(
      `https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&searchText=${zip}&lang=fr&limit=1`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) }
    )
    if (!res.ok) return null
    const data = await res.json()
    const attrs = data.results?.[0]?.attrs
    if (!attrs?.lat || !attrs?.lon) return null
    return { lat: attrs.lat, lon: attrs.lon }
  } catch {
    return null
  }
}

// ─── ElCom electricity rate ───────────────────────────────────────────────────
// Fetches the current-year H4 standard total rate (ct/kWh) for a given NPA
// via the ElCom GraphQL API. Returns null on any failure.

async function fetchElcomRate(zip: string): Promise<{ rateCtPerKwh: number; communeName: string } | null> {
  try {
    // 1. Resolve NPA → commune name via swisstopo (label: "<b>1180 - Rolle</b>")
    const geoRes = await fetch(
      `https://api3.geo.admin.ch/rest/services/ech/SearchServer?type=locations&searchText=${encodeURIComponent(zip)}&lang=fr&limit=1`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) }
    )
    if (!geoRes.ok) return null
    const geoData = await geoRes.json()
    const rawLabel: string = geoData.results?.[0]?.attrs?.label ?? ''
    const communeName = rawLabel.replace(/<[^>]*>/g, '').replace(/^\d{4}\s*[-–]\s*/, '').trim()
    if (!communeName) return null

    // 2. Find ElCom municipality ID by commune name
    const searchRes = await fetch('https://www.prix-electricite.elcom.admin.ch/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: `{ search(locale: "fr", query: ${JSON.stringify(communeName)}) { id name } }` }),
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    } as RequestInit)
    if (!searchRes.ok) return null
    const searchData = await searchRes.json()
    const municipality: { id: string; name: string } | undefined =
      (searchData.data?.search ?? []).find((m: { id: string; name: string }) => m.name === communeName)
    if (!municipality) return null

    // 3. Query H4 standard total rate for the current period
    const currentYear = new Date().getFullYear().toString()
    const rateRes = await fetch('https://www.prix-electricite.elcom.admin.ch/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `{ observations(locale: "fr", filters: { municipality: [${JSON.stringify(municipality.id)}], category: "H4", product: "standard", period: [${JSON.stringify(currentYear)}] }, observationKind: Municipality) { value(priceComponent: total) } }`,
      }),
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    } as RequestInit)
    if (!rateRes.ok) return null
    const rateData = await rateRes.json()
    const rate: unknown = rateData.data?.observations?.[0]?.value
    return typeof rate === 'number' ? { rateCtPerKwh: rate, communeName } : null
  } catch {
    return null
  }
}

async function fetchPvgisYield(lat: number, lon: number): Promise<number> {
  try {
    const res = await fetch(
      `https://re.jrc.ec.europa.eu/api/v5_3/PVcalc?lat=${lat}&lon=${lon}&peakpower=1&loss=14&outputformat=json`,
      { next: { revalidate: 86400 }, signal: AbortSignal.timeout(6000) }
    )
    if (!res.ok) return 950
    const data = await res.json()
    const ey = data?.outputs?.totals?.fixed?.E_y
    return typeof ey === 'number' && ey > 0 ? Math.round(ey) : 950
  } catch {
    return 950
  }
}

export const metadata = { title: 'Calculateur' }

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: { zip?: string; quoteId?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const [products, costOptions, settings] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.costOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: [
            'vat_pct_basis_pts',
            'min_margin_basis_pts',
            'pv_accessories_bps',
            'pv_frais_supp_bps',
            'pv_transport_bps',
            'pv_labor_panel_rappen',
            'pv_labor_inverter_rappen',
            'pv_raccordement_mat_rappen',
            'pv_raccordement_labor_rappen',
            'pv_pm_fixed_rappen',
            'pv_admin_fixed_rappen',
            'pv_sales_overhead_bps',
            'pv_profit_appro_bps',
            'pv_profit_constr_bps',
            'bat_pm_bps',
            'bat_admin_bps',
            'bat_profit_bps',
            'mount_tuile_rappen',
            'mount_ardoise_rappen',
            'mount_bac_acier_rappen',
            'mount_plat_rappen',
            'mount_slope_medium_bps',
            'mount_slope_steep_bps',
          ],
        },
      },
    }),
  ])

  // ElCom rate + PVGIS yield + geolocation (all run in parallel)
  let yieldKwhPerKwp: number | undefined
  let zipCoords: { lat: number; lon: number } | null = null
  let elcomRate: { rateCtPerKwh: number; communeName: string } | null = null
  if (searchParams.zip) {
    ;[zipCoords, elcomRate] = await Promise.all([
      geocodeZip(searchParams.zip),
      fetchElcomRate(searchParams.zip),
    ])
    if (zipCoords) {
      yieldKwhPerKwp = await fetchPvgisYield(zipCoords.lat, zipCoords.lon)
    }
  }

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810

  const ionCoefficients: IonPricingCoefficients = {
    pv_accessories_bps: settingsMap['pv_accessories_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_accessories_bps,
    pv_frais_supp_bps: settingsMap['pv_frais_supp_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_frais_supp_bps,
    pv_transport_bps: settingsMap['pv_transport_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_transport_bps,
    pv_labor_panel_rappen: settingsMap['pv_labor_panel_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_panel_rappen,
    pv_labor_inverter_rappen: settingsMap['pv_labor_inverter_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_inverter_rappen,
    pv_raccordement_mat_rappen: settingsMap['pv_raccordement_mat_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_mat_rappen,
    pv_raccordement_labor_rappen: settingsMap['pv_raccordement_labor_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_labor_rappen,
    pv_pm_fixed_rappen: settingsMap['pv_pm_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_pm_fixed_rappen,
    pv_admin_fixed_rappen: settingsMap['pv_admin_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_admin_fixed_rappen,
    pv_sales_overhead_bps: settingsMap['pv_sales_overhead_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_sales_overhead_bps,
    pv_profit_appro_bps: settingsMap['pv_profit_appro_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_appro_bps,
    pv_profit_constr_bps: settingsMap['pv_profit_constr_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_constr_bps,
    bat_pm_bps: settingsMap['bat_pm_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_pm_bps,
    bat_admin_bps: settingsMap['bat_admin_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_admin_bps,
    bat_profit_bps: settingsMap['bat_profit_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_profit_bps,
    mount_tuile_rappen: settingsMap['mount_tuile_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_tuile_rappen,
    mount_ardoise_rappen: settingsMap['mount_ardoise_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_ardoise_rappen,
    mount_bac_acier_rappen: settingsMap['mount_bac_acier_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_bac_acier_rappen,
    mount_plat_rappen: settingsMap['mount_plat_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_plat_rappen,
    mount_slope_medium_bps: settingsMap['mount_slope_medium_bps'] ?? DEFAULT_ION_COEFFICIENTS.mount_slope_medium_bps,
    mount_slope_steep_bps: settingsMap['mount_slope_steep_bps'] ?? DEFAULT_ION_COEFFICIENTS.mount_slope_steep_bps,
    vatBasisPts,
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="page-title">Calculateur de prix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sélectionner des produits et calculer le prix de vente
        </p>
      </div>

      <ZipBar
        currentZip={searchParams.zip}
        communeName={elcomRate?.communeName}
        rateCtPerKwh={elcomRate?.rateCtPerKwh}
        yieldKwhPerKwp={yieldKwhPerKwp}
        quoteId={searchParams.quoteId}
      />

      <CalculatorForm
        products={products}
        costOptions={costOptions}
        vatBasisPts={vatBasisPts}
        ionCoefficients={ionCoefficients}
        rateRappenPerKwh={elcomRate?.rateCtPerKwh}
        yieldKwhPerKwp={yieldKwhPerKwp}
        customerZip={searchParams.zip}
        quoteId={searchParams.quoteId}
      />
    </div>
  )
}

function ZipBar({
  currentZip,
  communeName,
  rateCtPerKwh,
  yieldKwhPerKwp,
  quoteId,
}: {
  currentZip?: string
  communeName?: string
  rateCtPerKwh?: number
  yieldKwhPerKwp?: number
  quoteId?: string
}) {
  return (
    <div className="flex items-center gap-4 mb-6 p-4 card">
      <form className="flex items-end gap-3">
        <div>
          <label className="label">NPA (pour tarif &amp; amortissement)</label>
          <input
            name="zip"
            type="text"
            pattern="[0-9]{4}"
            maxLength={4}
            defaultValue={currentZip ?? ''}
            placeholder="ex. 1180"
            className="input w-28"
          />
        </div>
        {quoteId && <input type="hidden" name="quoteId" value={quoteId} />}
        <button type="submit" className="btn-secondary">
          Charger tarif
        </button>
      </form>

      {rateCtPerKwh != null && (
        <div className="text-sm text-gray-600 space-y-0.5">
          <div>
            {communeName && <><strong>{communeName}</strong> · </>}
            <span className="tabular-nums font-mono">{rateCtPerKwh.toFixed(2)} ct/kWh</span>
            {' '}<span className="text-gray-400 text-xs">(ElCom {new Date().getFullYear()})</span>
          </div>
          {yieldKwhPerKwp && (
            <div className="text-xs text-gray-500">
              ☀ Production estimée : <span className="font-mono tabular-nums font-medium text-gray-700">{yieldKwhPerKwp} kWh/kWp/an</span> <span className="text-gray-400">(PVGIS)</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
