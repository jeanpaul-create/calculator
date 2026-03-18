import { redirect } from 'next/navigation'
import { prisma } from '@/lib/db'
import { auth } from '@/lib/auth'
import CalculatorForm from '@/components/calculator/CalculatorForm'

export const metadata = { title: 'Calculateur' }

export default async function CalculatorPage({
  searchParams,
}: {
  searchParams: { zip?: string; quoteId?: string }
}) {
  const session = await auth()
  if (!session) redirect('/login')

  const [products, costOptions, settings, rateRow] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    }),
    prisma.costOption.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    }),
    prisma.setting.findMany({
      where: { key: { in: ['vat_pct_basis_pts', 'min_margin_basis_pts'] } },
    }),
    searchParams.zip
      ? prisma.swissRate.findFirst({
          where: { zipPrefix: searchParams.zip.slice(0, 2) },
          select: { rateRappenPerKwh: true, canton: true },
        })
      : Promise.resolve(null),
  ])

  const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
  const vatBasisPts = settingsMap['vat_pct_basis_pts'] ?? 810
  const minMarginBasisPts = settingsMap['min_margin_basis_pts'] ?? 2000

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
        canton={rateRow?.canton}
        rateRappenPerKwh={rateRow?.rateRappenPerKwh}
        quoteId={searchParams.quoteId}
      />

      <CalculatorForm
        products={products}
        costOptions={costOptions}
        vatBasisPts={vatBasisPts}
        minMarginBasisPts={minMarginBasisPts}
        rateRappenPerKwh={rateRow?.rateRappenPerKwh}
        quoteId={searchParams.quoteId}
      />
    </div>
  )
}

function ZipBar({
  currentZip,
  canton,
  rateRappenPerKwh,
  quoteId,
}: {
  currentZip?: string
  canton?: string
  rateRappenPerKwh?: number
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

      {canton && rateRappenPerKwh && (
        <div className="text-sm text-gray-600">
          Canton <strong>{canton}</strong> ·{' '}
          <span className="tabular-nums font-mono">{rateRappenPerKwh} ct/kWh</span> moyen
        </div>
      )}
    </div>
  )
}
