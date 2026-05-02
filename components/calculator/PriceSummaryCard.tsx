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
  // ROI breakdown
  selfConsumedKwh?: number
  exportedKwh?: number
  selfConsumptionRate?: number
  selfConsumptionSavingsRappen?: number
  exportRevenueRappen?: number
  feedInRateCtKwh?: number
  onFeedInRateChange?: (rate: number) => void
  pronovoSubsidyRappen?: number
  taxSavingsRappen?: number
  effectiveInvestmentRappen?: number
  paybackYearsWithSubsidy?: number
  /** ElCom tariff used for ROI calculation (ct/kWh) */
  rateRappenPerKwh?: number
  /** PVGIS yield factor used for annual yield estimate (kWh/kWp/year) */
  yieldKwhPerKwp?: number
  // Discount slider — rep-chosen % off engine-computed price
  discountBasisPts?: number
  onDiscountChange?: (bps: number) => void
  discountReason?: string
  onDiscountReasonChange?: (reason: string) => void
  /** True when discount drops effective margin below minMarginBasisPts */
  requiresApproval?: boolean
  /** Floor below which discounts require an approval reason */
  minMarginBasisPts?: number
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
  selfConsumedKwh,
  exportedKwh,
  selfConsumptionRate,
  selfConsumptionSavingsRappen,
  exportRevenueRappen,
  feedInRateCtKwh,
  onFeedInRateChange,
  pronovoSubsidyRappen,
  taxSavingsRappen,
  effectiveInvestmentRappen,
  paybackYearsWithSubsidy,
  rateRappenPerKwh,
  yieldKwhPerKwp,
  discountBasisPts = 0,
  onDiscountChange,
  discountReason = '',
  onDiscountReasonChange,
  requiresApproval = false,
  minMarginBasisPts,
  isDirty,
  isSaving,
  onSave,
  onSaveAsNew,
  onNewQuote,
}: PriceSummaryCardProps) {
  const { t } = useLanguage()

  return (
    <div className="card sticky top-6 border-l-4 border-l-red-500">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-100">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
          {t('price_selling')}
        </div>
        <div className="text-5xl font-semibold text-gray-900 tabular-nums leading-none">
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

      {/* Discount slider */}
      {onDiscountChange && (
        <div className="px-5 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Rabais commercial
            </label>
            <span className={`text-sm font-mono tabular-nums font-semibold ${
              discountBasisPts === 0
                ? 'text-gray-500'
                : requiresApproval
                  ? 'text-red-600'
                  : 'text-orange-600'
            }`}>
              {(discountBasisPts / 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={2000}
            step={25}
            value={discountBasisPts}
            onChange={(e) => onDiscountChange(parseInt(e.target.value, 10))}
            className="w-full accent-red-500"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-0.5">
            <span>0%</span>
            <span>10%</span>
            <span>20%</span>
          </div>

          {requiresApproval && (
            <div className="mt-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
              <div className="flex items-start gap-2 text-xs">
                <span className="text-red-600 font-semibold">⚠</span>
                <div className="flex-1">
                  <p className="text-red-800 font-medium">
                    Marge sous le seuil ({minMarginBasisPts != null ? (minMarginBasisPts / 100).toFixed(1) : '20.0'}%) — approbation requise
                  </p>
                  <p className="text-red-700 mt-1">
                    Marge effective: {formatPct(effectiveMarginBasisPts)}
                  </p>
                </div>
              </div>
              {onDiscountReasonChange && (
                <textarea
                  value={discountReason}
                  onChange={(e) => onDiscountReasonChange(e.target.value)}
                  placeholder="Raison (concurrence, volume, fidélité…)"
                  rows={2}
                  className="mt-2 w-full text-xs border border-red-200 rounded px-2 py-1.5 bg-white resize-none"
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ROI section */}
      {annualSavingsRappen != null && paybackYears != null && (
        <div className="px-5 py-4 border-b border-gray-100 bg-green-50">
          <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {t('price_amortization')}
          </div>
          <div className="grid grid-cols-2 gap-3 mb-3">
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

          {/* Self-consumption breakdown */}
          {selfConsumedKwh != null && exportedKwh != null && selfConsumptionRate != null && (
            <div className="space-y-1 mb-3 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>Autoconsommation ({Math.round(selfConsumptionRate * 100)}%)</span>
                <span className="font-mono tabular-nums">
                  {selfConsumedKwh.toLocaleString('fr-CH')} kWh
                  {selfConsumptionSavingsRappen != null && (
                    <span className="text-gray-500"> · {formatChf(selfConsumptionSavingsRappen)}</span>
                  )}
                </span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Injection réseau ({Math.round((1 - selfConsumptionRate) * 100)}%)</span>
                <span className="font-mono tabular-nums">
                  {exportedKwh.toLocaleString('fr-CH')} kWh
                  {exportRevenueRappen != null && (
                    <span className="text-gray-500"> · {formatChf(exportRevenueRappen)}</span>
                  )}
                </span>
              </div>
            </div>
          )}

          {/* Tariff context */}
          <div className="space-y-1 pt-2 border-t border-green-100">
            {rateRappenPerKwh != null && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Tarif consommation (ElCom)</span>
                <span className="font-mono tabular-nums">{rateRappenPerKwh.toFixed(2)} ct/kWh</span>
              </div>
            )}
            <div className="flex justify-between items-center text-xs text-gray-500">
              <span>Tarif injection (rachat)</span>
              {onFeedInRateChange ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={30}
                    step={0.5}
                    value={feedInRateCtKwh ?? 8}
                    onChange={e => onFeedInRateChange(parseFloat(e.target.value) || 0)}
                    className="w-14 text-right text-xs border border-green-200 rounded px-1 py-0.5 bg-white font-mono tabular-nums"
                  />
                  <span>ct/kWh</span>
                </div>
              ) : (
                <span className="font-mono tabular-nums">{(feedInRateCtKwh ?? 8).toFixed(2)} ct/kWh</span>
              )}
            </div>
            {yieldKwhPerKwp != null && (
              <div className="flex justify-between text-xs text-gray-500">
                <span>Production PVGIS</span>
                <span className="font-mono tabular-nums">{yieldKwhPerKwp} kWh/kWp/an</span>
              </div>
            )}
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
