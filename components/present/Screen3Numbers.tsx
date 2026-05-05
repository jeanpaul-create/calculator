/**
 * Screen 3 — Vos chiffres (Decision).
 *
 * Per design doc storyboard:
 *   Emotional beat: "this is real, this works for me"
 *   Dominant visual: the hero number (96-128px Geist Mono)
 *
 * Layout (per DESIGN.md "Risk 2" + "Risk 3"):
 *   ┌──────────────────────────────────┐
 *   │  VOS CHIFFRES (eyebrow)          │
 *   │                                  │
 *   │        Rentabilisé en            │
 *   │                                  │
 *   │             7.2                  │  <- hero 96-128px Geist Mono w800
 *   │                                  │
 *   │             ans                  │
 *   │                                  │
 *   │   Économies cumulées sur 25 ans: │
 *   │             142'500              │
 *   │                                  │
 *   │  ┌────────────────────────────┐  │
 *   │  │ ░░░░▓▓▓▓██████████████████ │  │  <- 25 bars, gray→red at payback
 *   │  └────────────────────────────┘  │
 *   │  An 1   An 7 (rentabilisé)  An 25│
 *   └──────────────────────────────────┘
 *
 * Per DESIGN.md "Risk 3" (Typographic savings chart):
 *   - 25 thin bars (one per year), flex:1 each, 2px gap
 *   - Pre-payback: gray-100; post-payback: red-500
 *   - Heights proportional to cumulative savings (linear ramp since we
 *     don't model panel degradation/electricity price rise in v1 — the
 *     color flip is what matters, not the curve shape)
 *
 * Empty state (per design review issue 2.2 + i18n):
 *   - hero null OR paybackYears null OR annualSavingsRappen null →
 *     "Données ROI indisponibles, contactez votre conseiller"
 *
 * Animations deferred to v1.x (added to TODOS during S6):
 *   - Hero number count-up 600ms ease-out on screen entry
 *   - Bars draw-in left-to-right
 *   Both must respect prefers-reduced-motion per DESIGN.md.
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'
import type { PresentVM } from './PresentScreens'

interface Props {
  hero: PresentVM['hero']
  strings: CustomerFr
}

/** Same Swiss-apostrophe formatter as Screen 2 — keeps the visual currency
 *  language consistent across screens. No "CHF" prefix; the surrounding
 *  caption ("Économies cumulées sur 25 ans :") provides the unit context. */
function formatChf(rappen: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rappen / 100)
}

/** Payback display: "7.2" not "7" — 1 decimal makes it feel computed rather
 *  than rounded. Hide the decimal if the payback is a clean integer (e.g.
 *  exactly 7.0 → "7", not "7.0"; rare edge case but cleaner). */
function formatPayback(years: number): string {
  const rounded = Math.round(years * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

export default function Screen3Numbers({ hero, strings }: Props) {
  // Empty state — pre-Phase-2 quote (no ROI data) or scenario lacked the
  // tariff data needed to compute payback. Per design review C1 — fall
  // back gracefully, don't show "—" or zeros.
  const hasRoi =
    hero != null &&
    hero.paybackYears != null &&
    hero.annualSavingsRappen != null &&
    hero.lifetimeSavingsRappen != null

  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen3.title}
      </h1>

      {hasRoi ? (
        <RoiContent hero={hero} strings={strings} />
      ) : (
        <EmptyState message={strings.screen3.fallback.noRoiData} />
      )}
    </>
  )
}

// ─── ROI content ──────────────────────────────────────────────────────────

function RoiContent({
  hero,
  strings,
}: {
  hero: NonNullable<PresentVM['hero']>
  strings: CustomerFr
}) {
  // Non-null after the hasRoi gate in the parent. Cast for clarity.
  const paybackYears = hero.paybackYears as number
  const annualSavingsRappen = hero.annualSavingsRappen as number
  const lifetimeSavingsRappen = hero.lifetimeSavingsRappen as number

  // The payback BAR INDEX (0-indexed). paybackYears = 7.2 → year 8 is
  // when you're net positive (year 7 cumulative still negative, year 8
  // crosses zero). Math.ceil gives that.
  // Clamp to [1, 25] — degenerate input shouldn't blow up the layout.
  const paybackBarIndex = Math.max(
    1,
    Math.min(25, Math.ceil(paybackYears))
  )

  // 25 bars, indices 1..25. Pre-payback: gray-100. At/post payback: red-500.
  const bars = Array.from({ length: 25 }, (_, i) => i + 1)

  return (
    <div className="flex-1 flex flex-col items-center justify-between py-4">
      {/* ─── Hero number stack (top half) ─────────────────────────── */}
      <div className="flex flex-col items-center text-center pt-4">
        <div className="text-sm text-gray-500 mb-2">
          {strings.screen3.label.paybackPrefix}
        </div>
        <div
          className="font-mono font-extrabold text-gray-900 leading-none tabular-nums"
          style={{
            fontSize: 'clamp(96px, 18vw, 128px)',
            letterSpacing: '-0.04em',
          }}
        >
          {formatPayback(paybackYears)}
        </div>
        <div className="text-xl text-gray-700 mt-2 font-medium">
          {strings.screen3.label.paybackSuffix}
        </div>
      </div>

      {/* ─── Lifetime savings caption (middle) ────────────────────── */}
      <div className="text-center mt-6 mb-6">
        <div className="text-sm text-gray-500 mb-1">
          {strings.screen3.label.lifetimeSavings(formatChf(lifetimeSavingsRappen))}
        </div>
      </div>

      {/* ─── Typographic savings bars (bottom) ────────────────────── */}
      <div className="w-full max-w-3xl">
        <div
          className="flex items-end gap-[2px] h-32"
          role="img"
          aria-label={`Économies cumulées sur 25 ans, rentabilisé à l'année ${paybackBarIndex}`}
        >
          {bars.map((year) => {
            // Linear ramp: bar height = (year / 25) of full height.
            const heightPct = (year / 25) * 100
            const isPostPayback = year >= paybackBarIndex
            return (
              <div
                key={year}
                className={[
                  'flex-1 rounded-sm',
                  isPostPayback ? 'bg-red-500' : 'bg-gray-200',
                ].join(' ')}
                style={{ height: `${heightPct}%` }}
              />
            )
          })}
        </div>

        {/* Axis labels: An 1 ... An N (rentabilisé) ... An 25.
            Use a 3-column grid so the middle label centers under the
            transition column rather than under bar #13.
            Edge case: if payback is at year 1 or 25, the middle label
            collapses against the edge — acceptable visually since the
            bar pattern itself communicates the answer. */}
        <div className="flex justify-between text-xs text-gray-500 mt-2 px-0">
          <span>{strings.screen3.axis.year1}</span>
          <span className="text-red-600 font-medium">
            {strings.screen3.axis.payback(paybackBarIndex)}
          </span>
          <span>{strings.screen3.axis.year25}</span>
        </div>
      </div>

      {/* sr-only annual savings — useful context for screen-reader users
          who can't see the bars. Not visible to sighted users (the bars
          + lifetime caption convey it visually). */}
      <span className="sr-only">
        Économies annuelles : {formatChf(annualSavingsRappen)} CHF par an.
      </span>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
      <div className="text-center max-w-md px-6">
        <div className="text-5xl text-gray-300 mb-4" aria-hidden="true">
          {/* Same placeholder mark family as Screen 1 — no decorative blob */}
          ◷
        </div>
        <p className="text-base text-gray-600 leading-relaxed">{message}</p>
      </div>
    </div>
  )
}
