import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import PacCalculatorForm from '@/components/calculator/PacCalculatorForm'
import { buildPacCoefficientsFromSettings, PAC_SETTING_KEYS } from '@/lib/pricing'

export const metadata = { title: 'Calculateur PAC' }

export default async function PacCalculatorPage({
  searchParams,
}: {
  searchParams: { quoteId?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: {
        active: true,
        category: {
          in: [
            'PAC_MACHINE',
            'PAC_ACCESSORY',
            'PAC_ELECTRICITE',
            'PAC_MACONNERIE',
            'PAC_ISOLATION',
            'PAC_CITERNE',
            'PAC_CONDUITE',
            'PAC_MONTAGE',
            'PAC_ADMIN',
          ],
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: ['vat_pct_basis_pts', ...PAC_SETTING_KEYS],
        },
      },
    }),
  ])

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810
  const pacCoefficients = buildPacCoefficientsFromSettings(settingsMap, vatBasisPts)

  // Cast to the type expected by PacCalculatorForm
  type PacCategory =
    | 'PAC_MACHINE'
    | 'PAC_ACCESSORY'
    | 'PAC_ELECTRICITE'
    | 'PAC_MACONNERIE'
    | 'PAC_ISOLATION'
    | 'PAC_CITERNE'
    | 'PAC_CONDUITE'
    | 'PAC_MONTAGE'
    | 'PAC_ADMIN'

  const pacProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as PacCategory,
    costRappen: p.costRappen,
    laborRappen: p.laborRappen,
  }))

  return (
    <div className="p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="page-title">Calculateur PAC</h1>
        <p className="text-sm text-gray-500 mt-1">
          Pompe à chaleur — configurer les postes et calculer le prix de vente
        </p>
      </div>

      <PacCalculatorForm
        products={pacProducts}
        vatBasisPts={vatBasisPts}
        pacCoefficients={pacCoefficients}
        quoteId={searchParams.quoteId}
      />
    </div>
  )
}
