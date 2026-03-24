import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import CalculatorForm from '@/components/calculator/CalculatorForm'
import { buildIonCoefficientsFromSettings } from '@/lib/pricing'

export const metadata = { title: 'Calculateur' }

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: { quoteId?: string }
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

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810

  const ionCoefficients = buildIonCoefficientsFromSettings(settingsMap, vatBasisPts)

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="page-title">Calculateur de prix</h1>
        <p className="text-sm text-gray-500 mt-1">
          Sélectionner des produits et calculer le prix de vente
        </p>
      </div>

      <CalculatorForm
        products={products}
        costOptions={costOptions}
        vatBasisPts={vatBasisPts}
        ionCoefficients={ionCoefficients}
        quoteId={searchParams.quoteId}
      />
    </div>
  )
}
