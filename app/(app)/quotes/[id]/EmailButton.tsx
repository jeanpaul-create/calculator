'use client'

import { useState } from 'react'

interface Props {
  quoteId: string
  hasEmail: boolean
}

export default function EmailButton({ quoteId, hasEmail }: Props) {
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  async function handleSend() {
    setState('loading')
    setErrorMessage(null)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, { method: 'POST' })
      if (res.ok) {
        setState('sent')
      } else {
        const data = await res.json().catch(() => ({}))
        setErrorMessage(data.error ?? "Erreur lors de l'envoi.")
        setState('error')
      }
    } catch {
      setErrorMessage('Erreur réseau. Veuillez réessayer.')
      setState('error')
    }
  }

  if (!hasEmail) {
    return (
      <button disabled className="btn-secondary opacity-50 cursor-not-allowed text-center">
        ✉ Envoyer par e-mail
      </button>
    )
  }

  if (state === 'sent') {
    return (
      <div className="btn-secondary text-center opacity-75 cursor-default text-green-700 border-green-300 bg-green-50">
        ✓ Envoyé !
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={state === 'loading'}
        className="btn-secondary text-center w-full disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {state === 'loading' ? 'Envoi en cours…' : '✉ Envoyer par e-mail'}
      </button>
      {state === 'error' && errorMessage && (
        <p className="text-xs text-red-600 mt-1">{errorMessage}</p>
      )}
    </div>
  )
}
