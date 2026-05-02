/**
 * QuotesList — interactive list with status filter chips, free-text search,
 * and per-row hover actions. Receives the full quote set from the server page;
 * filters/searches client-side (the quote count is small and queries should
 * feel instant).
 */
'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { formatChf } from '@/lib/pricing'
import { StatusPill, EmptyState, type QuoteStatusValue } from '@/components/ui'
import { cn } from '@/lib/cn'

export interface QuoteListItem {
  id: string
  quoteNumber: string
  status: QuoteStatusValue
  customerName: string | null
  customerEmail: string | null
  customerZip: string | null
  customerCanton: string | null
  totalIncVatRappen: number | null
  scenarioName: string | null
  sentAt: Date | null
  expiresAt: Date | null
  createdAt: Date
  repName: string | null
}

interface QuotesListProps {
  quotes: QuoteListItem[]
  isAdmin: boolean
}

type StatusFilter = 'ALL' | QuoteStatusValue

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: 'ALL', label: 'Toutes' },
  { value: 'DRAFT', label: 'Brouillons' },
  { value: 'SENT', label: 'Envoyées' },
  { value: 'ACCEPTED', label: 'Acceptées' },
  { value: 'DECLINED', label: 'Refusées' },
  { value: 'EXPIRED', label: 'Expirées' },
]

export default function QuotesList({ quotes, isAdmin }: QuotesListProps) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search, setSearch] = useState('')

  const counts = useMemo(() => {
    const c: Record<StatusFilter, number> = {
      ALL: quotes.length,
      DRAFT: 0,
      SENT: 0,
      ACCEPTED: 0,
      DECLINED: 0,
      EXPIRED: 0,
    }
    for (const q of quotes) c[q.status]++
    return c
  }, [quotes])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quotes.filter((quote) => {
      if (statusFilter !== 'ALL' && quote.status !== statusFilter) return false
      if (!q) return true
      return (
        quote.quoteNumber.toLowerCase().includes(q) ||
        quote.customerName?.toLowerCase().includes(q) ||
        quote.customerEmail?.toLowerCase().includes(q) ||
        quote.customerZip?.includes(q) ||
        quote.customerCanton?.toLowerCase().includes(q)
      )
    })
  }, [quotes, statusFilter, search])

  return (
    <>
      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-2">
        {/* Status chips */}
        <div className="flex items-center gap-1 flex-wrap">
          {STATUS_FILTERS.map((opt) => {
            const active = statusFilter === opt.value
            const count = counts[opt.value]
            return (
              <button
                key={opt.value}
                onClick={() => setStatusFilter(opt.value)}
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded transition-colors',
                  active
                    ? 'bg-red-50 text-red-700 ring-1 ring-red-200'
                    : 'text-gray-600 hover:bg-gray-100'
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    'ml-1.5 tabular-nums',
                    active ? 'text-red-500' : 'text-gray-400'
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px] ml-auto">
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher (n°, client, NPA…)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded
                       placeholder-gray-400 focus:outline-none focus:border-red-500
                       focus:ring-1 focus:ring-red-500"
          />
        </div>
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200">
          <EmptyState
            compact
            title="Aucun résultat"
            description={
              search
                ? `Aucune offre ne correspond à « ${search} ».`
                : 'Aucune offre dans cette catégorie.'
            }
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-2 sm:px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">N°</th>
                <th className="text-left px-2 sm:px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Client</th>
                <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">NPA</th>
                {isAdmin && (
                  <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Conseiller</th>
                )}
                <th className="text-right px-2 sm:px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden sm:table-cell">Total</th>
                <th className="text-left px-2 sm:px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Statut</th>
                <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((quote) => (
                <QuoteRow key={quote.id} quote={quote} isAdmin={isAdmin} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function QuoteRow({ quote, isAdmin }: { quote: QuoteListItem; isAdmin: boolean }) {
  const isExpiringSoon =
    quote.status === 'SENT' &&
    quote.expiresAt &&
    new Date(quote.expiresAt).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000 &&
    new Date(quote.expiresAt).getTime() > Date.now()

  return (
    <tr className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors group">
      <td className="px-2 sm:px-4 py-3 whitespace-nowrap">
        <Link
          href={`/quotes/${quote.id}`}
          className="font-mono text-xs sm:text-sm font-semibold text-red-600 hover:text-red-700 tabular-nums"
        >
          {quote.quoteNumber}
        </Link>
      </td>
      <td className="px-2 sm:px-4 py-3">
        <div className="font-medium text-gray-900 truncate max-w-[140px] sm:max-w-none">
          {quote.customerName?.trim() ? (
            quote.customerName
          ) : (
            <span className="text-gray-400 italic">Sans nom</span>
          )}
        </div>
        {quote.customerEmail && (
          <div className="text-xs text-gray-500 truncate max-w-[140px] sm:max-w-none">{quote.customerEmail}</div>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 tabular-nums hidden md:table-cell">
        {quote.customerZip ? (
          <>
            {quote.customerZip}
            {quote.customerCanton && (
              <span className="ml-1 text-gray-400">({quote.customerCanton})</span>
            )}
          </>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      {isAdmin && (
        <td className="px-4 py-3 text-sm text-gray-600 hidden lg:table-cell">
          {quote.repName ?? '—'}
        </td>
      )}
      <td className="px-2 sm:px-4 py-3 text-right text-sm tabular-nums font-mono whitespace-nowrap hidden sm:table-cell">
        {quote.totalIncVatRappen != null ? (
          <span className="font-medium text-gray-900">
            {formatChf(quote.totalIncVatRappen)}
          </span>
        ) : (
          <span className="text-gray-300">—</span>
        )}
      </td>
      <td className="px-2 sm:px-4 py-3">
        <div className="flex items-center gap-1.5">
          <StatusPill status={quote.status} />
          {isExpiringSoon && (
            <span
              title={`Expire le ${new Date(quote.expiresAt!).toLocaleDateString('fr-CH')}`}
              className="text-xs text-amber-600 font-medium"
            >
              ⚠
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums hidden md:table-cell whitespace-nowrap">
        {new Date(quote.createdAt).toLocaleDateString('fr-CH')}
      </td>
    </tr>
  )
}
