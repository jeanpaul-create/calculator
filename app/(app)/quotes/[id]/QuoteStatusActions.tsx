'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

interface Props {
  quoteId: string
  currentStatus: QuoteStatus
}

const ACTIONS: { status: QuoteStatus; label: string; className: string }[] = [
  { status: 'ACCEPTED', label: '✓ Accepté',  className: 'btn-status-green' },
  { status: 'DECLINED', label: '✗ Refusé',   className: 'btn-status-red'   },
  { status: 'EXPIRED',  label: '⏱ Expiré',   className: 'btn-status-gray'  },
]

export default function QuoteStatusActions({ quoteId, currentStatus }: Props) {
  const router = useRouter()
  const [pending, setPending] = useState<QuoteStatus | null>(null)
  const [confirming, setConfirming] = useState<QuoteStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Only show on SENT status — terminal states (ACCEPTED/DECLINED/EXPIRED) have no actions
  if (currentStatus !== 'SENT') return null

  async function handleConfirm(status: QuoteStatus) {
    setPending(status)
    setError(null)
    setConfirming(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Erreur lors de la mise à jour.')
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setPending(null)
    }
  }

  // Inline confirmation: when a status is being confirmed, replace the three
  // buttons with a "Confirmer mark as X?" / Yes / No prompt — keeps the action
  // row's horizontal rhythm intact.
  if (confirming) {
    const action = ACTIONS.find((a) => a.status === confirming)!
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-gray-600">Marquer comme {action.label.replace(/^[^\w]+/, '').toLowerCase()} ?</span>
        <button
          onClick={() => handleConfirm(action.status)}
          disabled={pending !== null}
          className="btn-primary text-xs px-3 py-1.5"
        >
          {pending === action.status ? 'Mise à jour…' : 'Confirmer'}
        </button>
        <button
          onClick={() => setConfirming(null)}
          className="btn-secondary text-xs px-3 py-1.5"
        >
          Annuler
        </button>
        {error && <p className="text-xs text-red-600 ml-2">{error}</p>}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {ACTIONS.map(({ status, label, className }) => (
        <button
          key={status}
          onClick={() => setConfirming(status)}
          disabled={pending !== null}
          className={`${className} text-xs px-3 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {label}
        </button>
      ))}
      {error && <p className="text-xs text-red-600 ml-2">{error}</p>}
    </div>
  )
}
