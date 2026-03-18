import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AdminSettingsForm from './AdminSettingsForm'
import { DEFAULT_ION_COEFFICIENTS } from '@/lib/pricing'

export const metadata = { title: 'Paramètres' }

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/calculator')
  }

  const settings = await prisma.setting.findMany({
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
        ],
      },
    },
  })
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))

  return (
    <div className="p-6 max-w-2xl">
      <h1 className="page-title mb-6">Paramètres</h1>
      <AdminSettingsForm
        vatBasisPts={settingsMap['vat_pct_basis_pts'] ?? 810}
        minMarginBasisPts={settingsMap['min_margin_basis_pts'] ?? 2000}
        pvAccessoriesBps={settingsMap['pv_accessories_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_accessories_bps}
        pvFraisSuppBps={settingsMap['pv_frais_supp_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_frais_supp_bps}
        pvTransportBps={settingsMap['pv_transport_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_transport_bps}
        pvLaborPanelRappen={settingsMap['pv_labor_panel_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_panel_rappen}
        pvLaborInverterRappen={settingsMap['pv_labor_inverter_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_inverter_rappen}
        pvRaccordementMatRappen={settingsMap['pv_raccordement_mat_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_mat_rappen}
        pvRaccordementLaborRappen={settingsMap['pv_raccordement_labor_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_labor_rappen}
        pvPmFixedRappen={settingsMap['pv_pm_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_pm_fixed_rappen}
        pvAdminFixedRappen={settingsMap['pv_admin_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_admin_fixed_rappen}
        pvSalesOverheadBps={settingsMap['pv_sales_overhead_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_sales_overhead_bps}
        pvProfitApproBps={settingsMap['pv_profit_appro_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_appro_bps}
        pvProfitConstrBps={settingsMap['pv_profit_constr_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_constr_bps}
        batPmBps={settingsMap['bat_pm_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_pm_bps}
        batAdminBps={settingsMap['bat_admin_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_admin_bps}
        batProfitBps={settingsMap['bat_profit_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_profit_bps}
      />
    </div>
  )
}
