import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { formatChf } from '@/lib/pricing'
import { ProductCategory } from '@prisma/client'

export const metadata = { title: 'Katalog' }

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  PANEL: 'Module',
  INVERTER: 'Wechselrichter',
  BATTERY: 'Speicher',
  MOUNTING: 'Montage',
  ACCESSORY: 'Zubehör',
}

export default async function AdminCatalogPage() {
  const session = await auth()
  if (!session || session.user.role !== 'ADMIN') {
    redirect('/calculator')
  }

  const [products, costOptions] = await Promise.all([
    prisma.product.findMany({ orderBy: [{ category: 'asc' }, { name: 'asc' }] }),
    prisma.costOption.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }] }),
  ])

  return (
    <div className="p-6 max-w-5xl space-y-8">
      <h1 className="page-title">Katalog</h1>

      {/* Products */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Produkte ({products.length})</h2>
          <span className="text-xs text-gray-500">Bearbeitung via Admin-API (Phase 2: UI)</span>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Produkt</th>
                <th>Kategorie</th>
                <th>Leistung</th>
                <th className="text-right">Kosten (EK)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium text-sm">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{p.description}</div>
                    )}
                  </td>
                  <td className="text-sm">{CATEGORY_LABELS[p.category]}</td>
                  <td className="tabular-nums text-sm text-gray-600">
                    {p.powerWp ? (
                      p.powerWp >= 1000
                        ? `${(p.powerWp / 1000).toFixed(1)} kW`
                        : `${p.powerWp} Wp`
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="text-right tabular-nums font-mono text-sm">
                    {formatChf(p.costRappen)}
                  </td>
                  <td>
                    <span className={p.active ? 'badge-green' : 'badge-gray'}>
                      {p.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Cost options */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title">Zusatzkosten ({costOptions.length})</h2>
        </div>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Option</th>
                <th className="text-right">Preis</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {costOptions.map((o) => (
                <tr key={o.id}>
                  <td>
                    <div className="font-medium text-sm">{o.name}</div>
                    {o.description && (
                      <div className="text-xs text-gray-400 mt-0.5">{o.description}</div>
                    )}
                  </td>
                  <td className="text-right tabular-nums font-mono text-sm">
                    {formatChf(o.costRappen)}
                  </td>
                  <td>
                    <span className={o.active ? 'badge-green' : 'badge-gray'}>
                      {o.active ? 'Aktiv' : 'Inaktiv'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
