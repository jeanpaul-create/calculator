import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import QuoteStatusBadge from '@/components/ui/QuoteStatusBadge'
import { QuoteStatus } from '@prisma/client'

export const metadata = { title: 'Offres' }

export default async function QuotesPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'

  const quotes = await prisma.quote.findMany({
    where: isAdmin ? undefined : { repId: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: {
      rep: { select: { name: true } },
      scenarios: {
        select: { marginBasisPts: true, vatPctBasisPts: true, items: true, options: true },
        take: 1,
      },
    },
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="page-title">Offres</h1>
        <NewQuoteButton />
      </div>

      {quotes.length === 0 ? (
        <div className="card-padded text-center py-16">
          <div className="text-gray-400 mb-3">
            <svg className="w-10 h-10 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-4">Aucune offre pour le moment.</p>
          <NewQuoteButton />
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Client</th>
                <th>NPA / Canton</th>
                {isAdmin && <th>Conseiller</th>}
                <th>Statut</th>
                <th className="text-right">Date</th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((quote) => (
                <tr key={quote.id}>
                  <td>
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="font-mono text-sm font-medium text-red-600 hover:text-red-700 hover:underline tabular-nums"
                    >
                      {quote.quoteNumber}
                    </Link>
                  </td>
                  <td>
                    <div className="font-medium text-gray-800">
                      {quote.customerName ?? <span className="text-gray-400 italic">sans nom</span>}
                    </div>
                    {quote.customerEmail && (
                      <div className="text-xs text-gray-500">{quote.customerEmail}</div>
                    )}
                  </td>
                  <td className="tabular-nums text-sm">
                    {quote.customerZip && <span>{quote.customerZip}</span>}
                    {quote.customerCanton && (
                      <span className="ml-1 text-gray-500">({quote.customerCanton})</span>
                    )}
                  </td>
                  {isAdmin && (
                    <td className="text-sm text-gray-600">{quote.rep?.name ?? '—'}</td>
                  )}
                  <td>
                    <QuoteStatusBadge status={quote.status as QuoteStatus} />
                  </td>
                  <td className="text-right tabular-nums text-sm text-gray-500">
                    {new Date(quote.createdAt).toLocaleDateString('fr-CH')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function NewQuoteButton() {
  return (
    <Link href="/calculator" className="btn-primary">
      + Nouvelle offre
    </Link>
  )
}
