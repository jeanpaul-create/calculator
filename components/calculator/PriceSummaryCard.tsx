'use client'

import { formatChf, formatPct } from '@/lib/pricing'

interface PriceSummaryCardProps {
  subtotalCostRappen: number
  sellingPriceExVatRappen: number
  vatRappen: number
  sellingPriceIncVatRappen: number
  effectiveMarginBasisPts: number
  vatBasisPts: number
  // ROI
  annualSavingsRappen?: number
  paybackYears?: number
  // State
  isDirty?: boolean
  isSaving?: boolean
  onSave?: () => void
  onNewQuote?: () => void
}

export default function PriceSummaryCard({
  subtotalCostRappen,
  sellingPriceExVatRappen,
  vatRappen,
  sellingPriceIncVatRappen,
  effectiveMarginBasisPts,
  vatBasisPts,
  annualSavingsRappen,
  paybackYears,
  isDirty,
  isSaving,
  onSave,
  onNewQuote,
}: PriceSummaryCardProps) {
  return (
    <div className="card sticky top-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          Verkaufspreis
        </div>
        <div className="text-3xl font-semibold text-gray-900 tabular-nums">
          {formatChf(sellingPriceIncVatRappen)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">inkl. {formatPct(vatBasisPts)} MWST</div>
      </div>

      {/* Price breakdown */}
      <div className="px-5 py-4 space-y-2 border-b border-gray-100">
        <PriceRow label="Materialkosten" value={subtotalCostRappen} muted />
        <PriceRow
          label={`Marge ${formatPct(effectiveMarginBasisPts)}`}
          value={sellingPriceExVatRappen - subtotalCostRappen}
          accent
        />
        <div className="border-t border-gray-100 pt-2 mt-2">
          <PriceRow label="Preis exkl. MWST" value={sellingPriceExVatRappen} bold />
          <PriceRow label={`MWST ${formatPct(vatBasisPts)}`} value={vatRappen} muted />
        </div>
        <div className="border-t border-gray-200 pt-2">
          <PriceRow label="Total inkl. MWST" value={sellingPriceIncVatRappen} bold large />
        </div>
      </div>

      {/* ROI section */}
      {annualSavingsRappen != null && paybackYears != null && (
        <div className="px-5 py-4 border-b border-gray-100 bg-green-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Amortisation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RoiStat
              label="Jährl. Einsparung"
              value={formatChf(annualSavingsRappen)}
            />
            <RoiStat
              label="Amortisation"
              value={
                paybackYears === Infinity
                  ? '—'
                  : `${paybackYears} Jahre`
              }
              accent={paybackYears !== Infinity && paybackYears <= 12}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-4 space-y-2">
        {onSave && (
          <button
            onClick={onSave}
            disabled={isSaving || !isDirty}
            className="btn-primary w-full"
          >
            {isSaving ? 'Wird gespeichert…' : isDirty ? 'Offerte speichern' : 'Gespeichert'}
          </button>
        )}
        {onNewQuote && (
          <button onClick={onNewQuote} className="btn-secondary w-full">
            Neue Offerte
          </button>
        )}
      </div>
    </div>
  )
}

function PriceRow({
  label,
  value,
  muted,
  bold,
  large,
  accent,
}: {
  label: string
  value: number
  muted?: boolean
  bold?: boolean
  large?: boolean
  accent?: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span
        className={`text-sm ${
          muted ? 'text-gray-500' : bold ? 'font-medium text-gray-800' : 'text-gray-700'
        }`}
      >
        {label}
      </span>
      <span
        className={`tabular-nums font-mono ${
          large
            ? 'text-base font-semibold text-gray-900'
            : accent
            ? 'text-sm font-medium text-red-600'
            : muted
            ? 'text-sm text-gray-500'
            : bold
            ? 'text-sm font-medium text-gray-900'
            : 'text-sm text-gray-700'
        }`}
      >
        {formatChf(value)}
      </span>
    </div>
  )
}

function RoiStat({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div>
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div
        className={`text-base font-semibold tabular-nums ${
          accent ? 'text-green-700' : 'text-gray-800'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
