import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import CalculatorForm, { type CalculatorInitial } from '@/components/calculator/CalculatorForm'
import { buildIonCoefficientsFromSettings, type RoofType, type RoofSlope } from '@/lib/pricing'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Calculateur' }

/**
 * Edit-mode prefill: load the quote + its first PV scenario and map it to
 * the form's initial state. Returns null for unknown ids or quotes the rep
 * doesn't own (admin sees all) — the form then behaves as a fresh quote.
 */
async function loadInitial(
  quoteId: string,
  userId: string,
  isAdmin: boolean
): Promise<CalculatorInitial | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      scenarios: {
        orderBy: { sortOrder: 'asc' },
        include: { items: true, options: true },
      },
    },
  })
  if (!quote) return null
  if (!isAdmin && quote.repId !== userId) return null

  const s = quote.scenarios.find((sc) => sc.scenarioType === 'PV') ?? null
  return {
    customerName: quote.customerName ?? '',
    customerEmail: quote.customerEmail ?? '',
    customerPhone: quote.customerPhone ?? '',
    siteAddress: quote.siteAddress ?? '',
    notes: quote.notes ?? '',
    customerZip: quote.customerZip ?? '',
    roofType: (s?.roofType as RoofType | null) ?? null,
    roofSlope: (s?.roofSlope as RoofSlope | null) ?? null,
    annualConsumptionKwh: s?.annualConsumptionKwh ?? null,
    feedInRateCtKwh: s?.feedInRateRappenPerKwh ?? null,
    rateCtPerKwh: s?.rateRappenPerKwh ?? null,
    yieldKwhPerKwp: s?.yieldKwhPerKwp ?? null,
    mapLat: quote.mapLat,
    mapLon: quote.mapLon,
    mapZoom: quote.mapZoom,
    discountBasisPts: s?.discountBasisPts ?? 0,
    discountReason: s?.discountReason ?? '',
    items: (s?.items ?? []).map((it) => ({ productId: it.productId, quantity: it.quantity })),
    optionIds: (s?.options ?? []).map((o) => o.optionId),
  }
}

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: { quoteId?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const [products, costOptions, settings] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        category: { in: ['PANEL', 'INVERTER', 'BATTERY', 'MOUNTING', 'ACCESSORY', 'EV_CHARGER'] },
      },
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

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810
  const minMarginBasisPts = settingsMap['min_margin_basis_pts'] ?? 2000

  const ionCoefficients = buildIonCoefficientsFromSettings(settingsMap, vatBasisPts)

  const initial = searchParams.quoteId
    ? await loadInitial(searchParams.quoteId, session.user.id, session.user.role === 'ADMIN')
    : null

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Calculateur photovoltaïque"
        subtitle="Configurer un système et calculer le prix de vente"
      />

      <CalculatorForm
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        products={products as any}
        costOptions={costOptions}
        vatBasisPts={vatBasisPts}
        minMarginBasisPts={minMarginBasisPts}
        ionCoefficients={ionCoefficients}
        quoteId={initial ? searchParams.quoteId : undefined}
        initial={initial}
      />
    </div>
  )
}
