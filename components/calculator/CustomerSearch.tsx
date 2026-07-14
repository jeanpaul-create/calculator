'use client'

/**
 * Customer name input with typeahead against the Customer master.
 *
 * The Customer table has existed since Phase 1 (find-or-create on every
 * save) but was invisible to reps — every quote retyped name/email/phone.
 * Picking a suggestion prefills the contact fields via onPick; free typing
 * still works exactly like the plain input it replaces.
 */

import { useEffect, useRef, useState } from 'react'

export interface CustomerHit {
  id: string
  name: string
  email: string | null
  phone: string | null
  zip: string | null
  canton: string | null
  quoteCount: number
}

interface Props {
  value: string
  onChange: (name: string) => void
  onPick: (customer: CustomerHit) => void
  placeholder?: string
}

export default function CustomerSearch({ value, onChange, onPick, placeholder }: Props) {
  const [hits, setHits] = useState<CustomerHit[]>([])
  const [open, setOpen] = useState(false)
  // Suppress the refetch triggered by the onChange that a pick performs.
  const justPickedRef = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (justPickedRef.current) {
      justPickedRef.current = false
      return
    }
    const q = value.trim()
    if (q.length < 2) {
      setHits([])
      setOpen(false)
      return
    }
    const t = setTimeout(() => {
      fetch(`/api/customers/search?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (d?.customers) {
            setHits(d.customers)
            setOpen(d.customers.length > 0)
          }
        })
        .catch(() => {})
    }, 250)
    return () => clearTimeout(t)
  }, [value])

  // Close on outside tap (tablet-friendly; no keyboard nav needed v1).
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [])

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        className="input"
        placeholder={placeholder ?? 'Nom du client'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => hits.length > 0 && setOpen(true)}
        autoComplete="off"
      />
      {open && (
        <ul className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-64 overflow-y-auto">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none"
                onClick={() => {
                  justPickedRef.current = true
                  onPick(c)
                  setOpen(false)
                }}
              >
                <span className="text-sm font-medium text-gray-900">{c.name}</span>
                <span className="block text-xs text-gray-500 truncate">
                  {[c.email, c.zip && `${c.zip}${c.canton ? ` ${c.canton}` : ''}`, `${c.quoteCount} offre${c.quoteCount > 1 ? 's' : ''}`]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
