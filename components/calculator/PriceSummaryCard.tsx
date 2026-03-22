'use client'

import { formatChf, formatPct } from '@/lib/pricing'
import { useLanguage } from '@/context/LanguageContext'

interface PriceSummaryCardProps {
  rawCostRappen: number
  sellingPriceExVatRappen: number
  vatRappen: number
  sellingPriceIncVatRappen: number
  effectiveMarginBasisPts: number
  vatBasisPts: number
  annualSavingsRappen?: number
  paybackYears?: number
  pronovoSubsidyRappen?: number
  taxSavingsRappen?: number
  effectiveInvestmentRappen?: number
  paybackYearsWithSubsidy?: number
  isDirty?: boolean
  isSaving?: boolean
  onSave?: () => void
  onSaveAsNew?: () => void
  onNewQuote?: () => void
}

export default function PriceSummaryCard({
  rawCostRappen,
  sellingPriceExVatRappen,
  vatRappen,
  sellingPriceIncVatRappen,
  effectiveMarginBasisPts,
  vatBasisPts,
  annualSavingsRappen,
  paybackYears,
  pronovoSubsidyRappen,
  taxSavingsRappen,
  effectiveInvestmentRappen,
  paybackYearsWithSubsidy,
  isDirty,
  isSaving,
  onSave,
  onSaveAsNew,
  onNewQuote,
}: PriceSummaryCardProps) {
  const { t } = useLanguage()

  return (
    <div className="card sticky top-6">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('price_selling')}
        </div>
        <div className="text-3xl font-semibold text-gray-900 tabular-nums">
          {formatChf(sellingPriceIncVatRappen)}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          {t('price_incl_vat')} {formatPct(vatBasisPts)}
        </div>
      </div>

      {/* Price breakdown */}
      <div className="px-5 py-4 space-y-2 border-b border-gray-100">
        <PriceRow label={t('price_material')} value={rawCostRappen} muted />
        <PriceRow
          label={`${t('price_margin')} ${formatPct(effectiveMarginBasisPts)}`}
          value={sellingPriceExVatRappen - rawCostRappen}
          accent
        />
        <div className="border-t border-gray-100 pt-2 mt-2">
          <PriceRow label={t('price_excl_vat')} value={sellingPriceExVatRappen} bold />
          <PriceRow label={`${t('price_vat')} ${formatPct(vatBasisPts)}`} value={vatRappen} muted />
        </div>
        <div className="border-t border-gray-200 pt-2">
          <PriceRow label={t('price_total_incl_vat')} value={sellingPriceIncVatRappen} bold large />
        </div>
      </div>

      {/* ROI section */}
      {annualSavingsRappen != null && paybackYears != null && (
        <div className="px-5 py-4 border-b border-gray-100 bg-green-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t('price_amortization')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <RoiStat
              label={t('price_annual_savings')}
              value={formatChf(annualSavingsRappen)}
            />
            <RoiStat
              label={t('price_payback')}
              value={
                paybackYears === Infinity
                  ? '—'
                  : `${paybackYears} ${t('price_payback_years')}`
              }
              accent={paybackYears !== Infinity && paybackYears <= 12}
            />
          </div>
        </div>
      )}

      {/* Subsidies & incentives */}
      {(pronovoSubsidyRappen != null || taxSavingsRappen != null) && (
        <div className="px-5 py-4 border-b border-gray-100 bg-blue-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Aides &amp; déductions
          </div>
          <div className="space-y-1.5">
            {pronovoSubsidyRappen != null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-gray-600">Subvention Pronovo (PRU)</span>
                <span className="tabular-nums font-mono text-sm font-medium text-blue-700">
                  −{formatChf(pronovoSubsidyRappen)}
                </span>
              </div>
            )}
            {taxSavingsRappen != null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-gray-600">Déduction fiscale (est. 20%)</span>
                <span className="tabular-nums font-mono text-sm font-medium text-blue-700">
                  −{formatChf(taxSavingsRappen)}
                </span>
              </div>
            )}
            {effectiveInvestmentRappen != null && (
              <div className="flex items-baseline justify-between gap-2 pt-1.5 border-t border-blue-200">
                <span className="text-sm font-medium text-gray-800">Investissement net</span>
                <span className="tabular-nums font-mono text-sm font-semibold text-gray-900">
                  {formatChf(effectiveInvestmentRappen)}
                </span>
              </div>
            )}
            {paybackYearsWithSubsidy != null && (
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm text-gray-600">Amortissement avec aides</span>
                <span className={`tabular-nums font-mono text-sm font-semibold ${paybackYearsWithSubsidy <= 10 ? 'text-green-700' : 'text-gray-800'}`}>
                  {paybackYearsWithSubsidy} ans
                </span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Subvention Pronovo indicative · Déduction fiscale estimée à 20% du HT
          </p>
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
            {isSaving
              ? t('price_saving')
              : isDirty
              ? t('price_save')
              : t('price_saved')}
          </button>
        )}
        {onSaveAsNew && (
          <button
            onClick={onSaveAsNew}
            disabled={isSaving || !isDirty}
            className="btn-primary w-full"
          >
            {isSaving ? t('price_saving') : t('price_save_as_quote')}
          </button>
        )}
        {onNewQuote && (
          <button onClick={onNewQuote} className="btn-secondary w-full">
            {t('price_new_quote')}
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
