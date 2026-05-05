/**
 * Screen 2 — Vos options (Agency).
 *
 * Per design doc storyboard:
 *   Emotional beat: "I have choices, not just a price"
 *   Dominant visual: the Recommandé card (red border + faint red-50 wash)
 *
 * Anti-slop discipline (per DESIGN.md "Tier Cards — Anti-Slop Discipline"):
 *   - 1.5px red-500 border on Recommandé only; others get 1px gray-200
 *   - Faint red-50 background wash on Recommandé only (subtle, not vibrant)
 *   - text-xs uppercase eyebrow per card; red-600 only on Recommandé
 *   - Cards size to actual content (no min-height stretching)
 *   - 2-line max rationale via line-clamp-2
 *   - NO gradient highlight, NO checkmark feature lists, NO "Most Popular"
 *     badge, NO glowing border, NO icon top-center, NO uniform heights
 *   Swap test: replace tier names with "Starter / Pro / Enterprise" — if
 *   it still feels right, the discipline failed. Each tier here is a real
 *   solar configuration, not a pricing tier.
 *
 * Layout (per design review issue 6.1):
 *   - Portrait (default): vertical stack, Recommandé first (most-important
 *     visible without scroll); Essentiel + Premium below
 *   - Landscape (md+): 3-column row, equal widths, Recommandé in the middle
 *
 * Empty states:
 *   - 1-tier (legacy non-AI quote): render single card framed as Recommandé
 *     with the "fallbackToRecommande" copy
 *   - 0 tiers: show "no scenarios" message (defensive — should never happen
 *     in practice since /present/ requires the quote to have scenarios)
 */
'use client'

import type { CustomerFr } from '@/lib/i18n/customer-fr'
import type { PresentTier } from './PresentScreens'

interface Props {
  tiers: PresentTier[]
  strings: CustomerFr
}

const TIER_ORDER = { essentiel: 0, recommande: 1, premium: 2 } as const

/** Customer-mode CHF formatter — just the number, no "CHF" prefix, no decimals.
 *  Tier price is the headline number on each card; the unit context comes
 *  from the surrounding visual hierarchy (ChF prefix on the page chrome
 *  if needed, but cards stand alone). Swiss apostrophe thousands separator. */
function formatChfCustomer(rappen: number): string {
  return new Intl.NumberFormat('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rappen / 100)
}

export default function Screen2Tiers({ tiers, strings }: Props) {
  // Edge case: 0 tiers loaded — defensive, should not happen
  if (tiers.length === 0) {
    return (
      <>
        <h1
          tabIndex={-1}
          className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
        >
          {strings.screen2.title}
        </h1>
        <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
          <p className="text-base text-gray-500">Aucune configuration disponible</p>
        </div>
      </>
    )
  }

  // Sort: tier-typed scenarios use canonical order (essentiel→reco→premium);
  // untyped (legacy single scenario) treated as Recommandé fallback.
  const sortedTiers =
    tiers.filter((t) => t.tier != null).length > 0
      ? [...tiers].sort((a, b) => {
          const ai = a.tier ? TIER_ORDER[a.tier] : 99
          const bi = b.tier ? TIER_ORDER[b.tier] : 99
          return ai - bi
        })
      : tiers

  // For portrait stacking: Recommandé first if it exists, then Essentiel,
  // then Premium. Done via reordered array; landscape uses CSS grid order.
  const recommended = sortedTiers.find((t) => t.tier === 'recommande')
  const portraitOrder = recommended
    ? [recommended, ...sortedTiers.filter((t) => t.tier !== 'recommande')]
    : sortedTiers

  // Single-tier fallback (legacy non-AI quote): frame the only scenario as
  // the recommended option per design doc empty state.
  const isLegacySingleScenario = sortedTiers.length === 1 && sortedTiers[0].tier == null

  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded"
      >
        {strings.screen2.title}
      </h1>

      {isLegacySingleScenario ? (
        <SingleScenarioFallback tier={sortedTiers[0]} strings={strings} />
      ) : (
        // Grid: portrait stacks 1 col, landscape 3 cols (md = 768px+)
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 content-start">
          {portraitOrder.map((tier) => (
            <TierCard key={tier.id} tier={tier} strings={strings} />
          ))}
        </div>
      )}
    </>
  )
}

// ─── Cards ────────────────────────────────────────────────────────────────

function TierCard({ tier, strings }: { tier: PresentTier; strings: CustomerFr }) {
  const isRecommended = tier.tier === 'recommande'
  const eyebrowLabel = tier.tier
    ? strings.screen2.eyebrow[tier.tier]
    : strings.screen2.eyebrow.recommande

  // Tier name — prefer "X kWp" derived from installedKwp if available, else
  // fall back to the saved scenario name. Customer reads the kWp number as
  // the system-size identifier; matches the design preview HTML.
  const displayName = tier.installedKwp != null ? `${tier.installedKwp} kWp` : tier.name

  return (
    <button
      type="button"
      // Tap-state highlight via :active scale; otherwise non-interactive
      // navigation-wise (per design constraint "customer cannot edit").
      // Wrapping in <button> only for tap a11y + keyboard focus on tablet.
      className={[
        'text-left p-5 rounded-md border transition-transform duration-100',
        'active:scale-[1.015] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2',
        // Recommended: 1.5px border, red-50 wash from top
        // Others: 1px border, white background
        // NO gradient highlight, NO drop-shadow on hover (per anti-slop)
        isRecommended
          ? 'border-[1.5px] border-red-500 bg-gradient-to-b from-white to-red-50'
          : 'border border-gray-200 bg-white',
        // No min-height — cards size to content (anti-slop rule)
      ].join(' ')}
    >
      <div
        className={[
          'text-xs font-bold uppercase tracking-wider mb-2',
          isRecommended ? 'text-red-600' : 'text-gray-500',
        ].join(' ')}
      >
        {eyebrowLabel}
      </div>
      <div className="text-lg font-semibold text-gray-900 mb-1">{displayName}</div>
      <div className="text-sm text-gray-500 mb-4 font-mono tabular-nums">
        {tier.itemsSummary}
      </div>
      <div className="text-2xl md:text-3xl font-bold text-gray-900 font-mono tabular-nums tracking-tight leading-none mb-4">
        {formatChfCustomer(tier.sellingPriceIncVat)}
      </div>
      <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">{tier.rationale}</p>
    </button>
  )
}

function SingleScenarioFallback({
  tier,
  strings,
}: {
  tier: PresentTier
  strings: CustomerFr
}) {
  // Render a single card centered, framed as the recommended option.
  // No "Recommandé" eyebrow because it's not from the AI tier system —
  // use the fallback copy from i18n.
  const displayName = tier.installedKwp != null ? `${tier.installedKwp} kWp` : tier.name
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="max-w-md w-full text-left p-6 rounded-md border-[1.5px] border-red-500 bg-gradient-to-b from-white to-red-50">
        <div className="text-xs font-bold uppercase tracking-wider text-red-600 mb-2">
          {strings.screen2.eyebrow.recommande}
        </div>
        <div className="text-2xl font-semibold text-gray-900 mb-1">{displayName}</div>
        <div className="text-sm text-gray-500 mb-4 font-mono tabular-nums">
          {tier.itemsSummary}
        </div>
        <div className="text-4xl font-bold text-gray-900 font-mono tabular-nums tracking-tight leading-none mb-4">
          {formatChfCustomer(tier.sellingPriceIncVat)}
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">
          {strings.screen2.fallbackToRecommande}
        </p>
      </div>
    </div>
  )
}
