import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import PacCalculatorForm, { type PacCalculatorInitial } from '@/components/calculator/PacCalculatorForm'
import { buildPacCoefficientsFromSettings, PAC_SETTING_KEYS } from '@/lib/pricing'
import { PageHeader } from '@/components/ui'

export const metadata = { title: 'Calculateur PAC' }

/**
 * Edit-mode prefill: load the quote + its first PAC scenario and map it to
 * the form's initial state. Returns null for unknown ids or quotes the rep
 * doesn't own — the form then behaves as a fresh quote.
 */
async function loadInitial(
  quoteId: string,
  userId: string,
  isAdmin: boolean
): Promise<PacCalculatorInitial | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      scenarios: {
        orderBy: { sortOrder: 'asc' },
        include: { items: true },
      },
    },
  })
  if (!quote) return null
  if (!isAdmin && quote.repId !== userId) return null

  const s = quote.scenarios.find((sc) => sc.scenarioType === 'PAC') ?? null
  return {
    customerName: quote.customerName ?? '',
    customerEmail: quote.customerEmail ?? '',
    customerPhone: quote.customerPhone ?? '',
    siteAddress: quote.siteAddress ?? '',
    notes: quote.notes ?? '',
    customerZip: quote.customerZip ?? '',
    customerCanton: quote.customerCanton ?? null,
    mapLat: quote.mapLat,
    mapLon: quote.mapLon,
    mapZoom: quote.mapZoom,
    discountBasisPts: s?.discountBasisPts ?? 0,
    discountReason: s?.discountReason ?? '',
    pacType: s?.pacType === 'sol-eau' ? 'sol-eau' : 'air-eau',
    thermalKw: s?.thermalLoadKw ?? null,
    items: (s?.items ?? []).map((it) => ({ productId: it.productId, quantity: it.quantity })),
  }
}

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
          in: ['vat_pct_basis_pts', 'min_margin_basis_pts', ...PAC_SETTING_KEYS],
        },
      },
    }),
  ])

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810
  const minMarginBasisPts = settingsMap['min_margin_basis_pts'] ?? 2000
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
    | 'PAC_TANK'

  const pacProducts = products.map((p) => ({
    id: p.id,
    name: p.name,
    category: p.category as PacCategory,
    costRappen: p.costRappen,
    laborRappen: p.laborRappen,
  }))

  const initial = searchParams.quoteId
    ? await loadInitial(searchParams.quoteId, session.user.id, session.user.role === 'ADMIN')
    : null

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title="Calculateur pompe à chaleur"
        subtitle="Configurer les postes et calculer le prix de vente"
      />

      <PacCalculatorForm
        products={pacProducts}
        vatBasisPts={vatBasisPts}
        minMarginBasisPts={minMarginBasisPts}
        pacCoefficients={pacCoefficients}
        quoteId={initial ? searchParams.quoteId : undefined}
        initial={initial}
      />
    </div>
  )
}
