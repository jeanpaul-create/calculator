'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatChf } from '@/lib/pricing'
import { Card, EmptyState } from '@/components/ui'

export interface ApprovalRow {
  scenarioId: string
  scenarioName: string
  scenarioType: 'PV' | 'PAC'
  quoteId: string
  quoteNumber: string
  quoteStatus: string
  customerName: string | null
  repName: string
  totalIncVatRappen: number | null
  discountBasisPts: number
  discountReason: string | null
  marginBasisPts: number
  updatedAt: string
}

export default function ApprovalsList({ rows }: { rows: ApprovalRow[] }) {
  const [approved, setApproved] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState<string | null>(null)

  const approve = async (scenarioId: string) => {
    setBusy(scenarioId)
    try {
      const res = await fetch(`/api/admin/approvals/${scenarioId}`, { method: 'PATCH' })
      if (res.ok) setApproved((prev) => new Set(prev).add(scenarioId))
    } finally {
      setBusy(null)
    }
  }

  const pending = rows.filter((r) => !approved.has(r.scenarioId))

  if (pending.length === 0) {
    return (
      <Card>
        <EmptyState
          compact
          title="Aucun rabais en attente"
          description="Tous les rabais sous le seuil ont été validés."
        />
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {pending.map((r) => (
        <Card key={r.scenarioId}>
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href={`/quotes/${r.quoteId}`}
              className="font-mono text-xs text-red-600 font-semibold tabular-nums hover:underline"
            >
              {r.quoteNumber}
            </Link>
            <span className="font-medium text-sm text-gray-900 flex-1 truncate">
              {r.customerName?.trim() || <span className="text-gray-400 italic">Sans nom</span>}
            </span>
            <span className="text-xs text-gray-500">{r.scenarioType}</span>
            <span className="text-xs text-gray-500">par {r.repName}</span>
            {r.totalIncVatRappen != null && (
              <span className="font-mono tabular-nums text-sm text-gray-700">
                {formatChf(r.totalIncVatRappen)}
              </span>
            )}
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 tabular-nums">
              −{(r.discountBasisPts / 100).toFixed(1)}%
            </span>
            <button
              type="button"
              onClick={() => approve(r.scenarioId)}
              disabled={busy === r.scenarioId}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {busy === r.scenarioId ? '…' : 'Approuver'}
            </button>
          </div>
          {r.discountReason && (
            <p className="text-xs text-gray-600 mt-2 pl-1 border-l-2 border-gray-200 ml-1">
              {r.discountReason}
            </p>
          )}
        </Card>
      ))}
    </div>
  )
}
