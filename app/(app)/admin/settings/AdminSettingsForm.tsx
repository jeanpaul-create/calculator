'use client'

import { useState } from 'react'

interface AdminSettingsFormProps {
  vatBasisPts: number
  minMarginBasisPts: number
}

export default function AdminSettingsForm({
  vatBasisPts: initialVat,
  minMarginBasisPts: initialMinMargin,
}: AdminSettingsFormProps) {
  const [vatPct, setVatPct] = useState((initialVat / 100).toFixed(2))
  const [minMarginPct, setMinMarginPct] = useState((initialMinMargin / 100).toFixed(1))
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vat_pct_basis_pts: Math.round(parseFloat(vatPct) * 100),
          min_margin_basis_pts: Math.round(parseFloat(minMarginPct) * 100),
        }),
      })

      if (!res.ok) {
        setError('Fehler beim Speichern der Einstellungen.')
        return
      }

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSave} className="card-padded space-y-6">
      <div>
        <label className="label">Mehrwertsteuersatz (%)</label>
        <div className="relative w-40">
          <input
            type="number"
            className="input"
            value={vatPct}
            min={0}
            max={30}
            step={0.1}
            onChange={(e) => setVatPct(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
        </div>
        <p className="field-hint">
          Aktuell in der Schweiz: 8.1%. Wird in allen neuen Offerten verwendet.
        </p>
      </div>

      <div>
        <label className="label">Mindestmarge (%)</label>
        <div className="relative w-40">
          <input
            type="number"
            className="input"
            value={minMarginPct}
            min={0}
            max={99}
            step={0.5}
            onChange={(e) => setMinMarginPct(e.target.value)}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
        </div>
        <p className="field-hint">
          Verkäufer können keine Offerte mit einer Marge unter diesem Wert speichern.
        </p>
      </div>

      {error && <div className="alert-error text-sm">{error}</div>}
      {saved && <div className="alert-success text-sm">Einstellungen gespeichert.</div>}

      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? 'Speichern…' : 'Einstellungen speichern'}
      </button>
    </form>
  )
}
