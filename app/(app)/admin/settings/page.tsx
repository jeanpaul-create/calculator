import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import AdminSettingsForm from './AdminSettingsForm'

export const metadata = { title: 'Einstellungen' }

export default async function AdminSettingsPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/calculator')
  }

  const settings = await prisma.setting.findMany({
    where: { key: { in: ['vat_pct_basis_pts', 'min_margin_basis_pts'] } },
  })
  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))

  return (
    <div className="p-6 max-w-lg">
      <h1 className="page-title mb-6">Einstellungen</h1>
      <AdminSettingsForm
        vatBasisPts={settingsMap['vat_pct_basis_pts'] ?? 810}
        minMarginBasisPts={settingsMap['min_margin_basis_pts'] ?? 2000}
      />
    </div>
  )
}
