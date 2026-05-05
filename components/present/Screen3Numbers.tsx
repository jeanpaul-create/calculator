/**
 * Screen 3 — Vos chiffres (Decision).
 *
 * Per design doc storyboard:
 *   Emotional beat: "this is real, this works for me"
 *   Dominant visual: the hero number (96-128px Geist Mono)
 *
 * S6 will fill this in. Right now it's a placeholder showing whether the
 * hero data was resolved (paybackYears != null), so the wiring (priced
 * scenario → hero number → bar chart) can be verified end-to-end.
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'
import type { PresentVM } from './PresentScreens'

interface Props {
  hero: PresentVM['hero']
  strings: CustomerFr
}

export default function Screen3Numbers({ hero, strings }: Props) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen3.title}
      </h1>
      <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-400">
          <div className="font-mono text-sm mb-2">Screen 3 — Your numbers</div>
          <div className="text-xs">
            {hero?.paybackYears != null
              ? `Hero data ready: ${hero.paybackYears} ans payback · S6 will render`
              : strings.screen3.fallback.noRoiData + ' · S6 will render the empty state'}
          </div>
        </div>
      </div>
    </>
  )
}
