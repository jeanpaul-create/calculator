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

  return (
    <div className="border-t border-gray-100 pt-3 mt-1">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Clôturer le devis
      </p>
      <div className="flex flex-col gap-2">
        {ACTIONS.map(({ status, label, className }) => (
          <div key={status}>
            {confirming === status ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-600 flex-1">Confirmer ?</span>
                <button
                  onClick={() => handleConfirm(status)}
                  disabled={pending !== null}
                  className="text-xs px-3 py-1 rounded bg-gray-800 text-white hover:bg-gray-700 disabled:opacity-50"
                >
                  Oui
                </button>
                <button
                  onClick={() => setConfirming(null)}
                  className="text-xs px-3 py-1 rounded border border-gray-300 text-gray-600 hover:bg-gray-50"
                >
                  Annuler
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(status)}
                disabled={pending !== null}
                className={`${className} text-center w-full disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                {pending === status ? 'Mise à jour…' : label}
              </button>
            )}
          </div>
        ))}
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  )
}
