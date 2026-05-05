/**
 * Screen 2 — Vos options (Agency).
 *
 * Per design doc storyboard:
 *   Emotional beat: "I have choices, not just a price"
 *   Dominant visual: the Recommandé card (red border + faint wash)
 *
 * S5 will fill this in. Right now it's a placeholder showing how many tiers
 * are loaded, so the wiring (filter scenarios with tier!=null → 3 cards) can
 * be verified end-to-end.
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'
import type { PresentTier } from './PresentScreens'

interface Props {
  tiers: PresentTier[]
  strings: CustomerFr
}

export default function Screen2Tiers({ tiers, strings }: Props) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen2.title}
      </h1>
      <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-400">
          <div className="font-mono text-sm mb-2">Screen 2 — Your tiers</div>
          <div className="text-xs">
            {tiers.length} tier{tiers.length === 1 ? '' : 's'} loaded · S5 will render the cards
          </div>
        </div>
      </div>
    </>
  )
}
