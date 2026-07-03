/**
 * Screen 4 — Et si vous ne faites rien ? (The closer.)
 *
 * Emotional beat: doing nothing is not free. Two cumulative cost curves over
 * 25 years — the gray line is what the customer pays the utility anyway; the
 * red line is investment up front, then a flattening residual bill. The gap
 * at year 25 is the hero number.
 *
 *   ┌──────────────────────────────────┐
 *   │  ET SI VOUS NE FAITES RIEN ?     │
 *   │                                  │
 *   │        ___ gris (sans)           │
 *   │    ___/                          │
 *   │ __/___——— rouge (avec)           │
 *   │ /                                │
 *   │  An 1                     An 25  │
 *   │                                  │
 *   │     142'500 CHF d'avantage       │  <- hero caption
 *   └──────────────────────────────────┘
 *
 * Pure SVG, no chart lib. Both series come pre-computed from the server VM
 * (same escalation assumption as calculateRoi, so the crossing point equals
 * the Screen 3 payback year). Rendered only when vm.doNothing != null.
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'
import type { PresentVM } from './PresentScreens'

interface Props {
  doNothing: NonNullable<PresentVM['doNothing']>
  strings: CustomerFr
}

/** Swiss-apostrophe formatter, consistent with Screens 2/3. */
function formatChf(rappen: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rappen / 100)
}

const W = 720
const H = 300
const PAD = { top: 16, right: 16, bottom: 24, left: 16 }

/** Map a series to an SVG polyline points string. */
function toPoints(series: number[], maxVal: number): string {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const n = series.length
  return series
    .map((v, i) => {
      const x = PAD.left + (i / (n - 1)) * innerW
      const y = PAD.top + innerH - (v / maxVal) * innerH
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

export default function Screen4Compare({ doNothing, strings }: Props) {
  const { withoutCumulative, withCumulative, lifetimeAdvantageRappen, horizonYears } =
    doNothing

  const maxVal = Math.max(
    withoutCumulative[withoutCumulative.length - 1],
    withCumulative[0],
    withCumulative[withCumulative.length - 1]
  )
  const withoutPoints = toPoints(withoutCumulative, maxVal)
  const withPoints = toPoints(withCumulative, maxVal)

  return (
    <div className="flex-1 flex flex-col">
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen4.title}
      </h1>

      <div className="flex-1 flex flex-col items-center justify-center gap-6">
        {/* ─── Legend ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-6 text-sm">
          <span className="flex items-center gap-2 text-gray-600">
            <span className="inline-block w-6 h-[3px] bg-gray-400 rounded-full" aria-hidden="true" />
            {strings.screen4.legend.without}
          </span>
          <span className="flex items-center gap-2 text-gray-900 font-medium">
            <span className="inline-block w-6 h-[3px] bg-red-500 rounded-full" aria-hidden="true" />
            {strings.screen4.legend.with}
          </span>
        </div>

        {/* ─── Chart ───────────────────────────────────────────────── */}
        <div className="w-full max-w-3xl">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={`Coût cumulé sur ${horizonYears} ans : sans installation ${formatChf(
              withoutCumulative[withoutCumulative.length - 1]
            )} CHF, avec installation ${formatChf(
              withCumulative[withCumulative.length - 1]
            )} CHF.`}
          >
            {/* Baseline */}
            <line
              x1={PAD.left}
              y1={H - PAD.bottom}
              x2={W - PAD.right}
              y2={H - PAD.bottom}
              stroke="#e5e7eb"
              strokeWidth="1"
            />
            {/* Advantage area between the curves (subtle red tint) */}
            <polygon
              points={`${withoutPoints} ${withPoints.split(' ').reverse().join(' ')}`}
              fill="#ef4444"
              opacity="0.06"
            />
            {/* Without installation — gray, keeps climbing */}
            <polyline
              points={withoutPoints}
              fill="none"
              stroke="#9ca3af"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* With installation — red, flattens after payback */}
            <polyline
              points={withPoints}
              fill="none"
              stroke="#ef4444"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{strings.screen4.axis.year1}</span>
            <span>{strings.screen4.axis.year25}</span>
          </div>
        </div>

        {/* ─── Hero caption ────────────────────────────────────────── */}
        <div className="text-center">
          <div
            className="font-mono font-extrabold text-gray-900 leading-none tabular-nums"
            style={{ fontSize: 'clamp(40px, 8vw, 64px)', letterSpacing: '-0.03em' }}
          >
            {formatChf(lifetimeAdvantageRappen)}
          </div>
          <div className="text-base text-gray-700 mt-2 font-medium">
            {strings.screen4.advantageSuffix}
          </div>
          <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto leading-relaxed">
            {strings.screen4.subCaption}
          </p>
        </div>
      </div>
    </div>
  )
}
