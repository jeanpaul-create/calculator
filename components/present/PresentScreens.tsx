/**
 * PresentScreens — top + bottom chrome + scroll-snap container for /present/.
 *
 * Architecture:
 *   ┌─ TopChrome ───────────────────────────────────────┐
 *   │  [logo]  Bonjour {first}        ← Retour à l'offre │
 *   ├────────────────────────────────────────────────────┤
 *   │  [Screen 1] [Screen 2] [Screen 3] ([Screen 4])     │
 *   │   Your roof   Your tiers  Your numbers  Do nothing │
 *   ├────────────────────────────────────────────────────┤
 *   │              ●   ○   ○   (○)                       │
 *   │  BottomChrome — screen indicator (tap to jump)     │
 *   └────────────────────────────────────────────────────┘
 *
 *   Swipe: native CSS scroll-snap on the horizontal container. No JS lib.
 *   Active screen tracked via IntersectionObserver — updates indicator dot
 *   + announces via aria-live region (per design review issue 6.2).
 *
 *   Screen 4 (« Et si vous ne faites rien ? ») renders only when the quote
 *   carries consumption + tariff data (vm.doNothing != null) — the deck is
 *   3 screens otherwise. All screen bookkeeping is index-based so both
 *   configurations share one code path.
 */
'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useRef, useState, useCallback } from 'react'
import { customerFr } from '@/lib/i18n/customer-fr'
import Screen1Roof from './Screen1Roof'
import Screen2Tiers from './Screen2Tiers'
import Screen3Numbers from './Screen3Numbers'
import Screen4Compare from './Screen4Compare'

// ─── Types ─────────────────────────────────────────────────────────────────

export type PresentTier = {
  id: string
  tier: 'essentiel' | 'recommande' | 'premium' | null
  name: string
  /** ex-VAT or inc-VAT? Inc-VAT, customer-facing. Rappen. */
  sellingPriceIncVat: number
  installedKwp: number | null
  rationale: string
  itemsSummary: string
  /** Comparison facts — null when the scenario lacks ROI data. */
  paybackYears: number | null
  annualSavingsRappen: number | null
}

export type PresentVM = {
  quoteId: string
  quoteNumber: string
  customerFirstName: string | null
  customerName: string | null
  siteAddress: string | null
  /** URL to navigate back to the rep app after the demo. */
  backUrl: string
  map: {
    lat: number | null
    lon: number | null
    zoom: number
  }
  /**
   * Pre-fetched satellite image as a data URL (or null if no map position
   * or fetch failed). Done server-side via cached fetchMapImageBase64 so
   * Screen 1 paints instantly without an extra round trip.
   */
  mapImageDataUrl: string | null
  tiers: PresentTier[]
  /**
   * Id of the tier driving Screens 3+4 (rep pick or automatic). Screen 2
   * frames this card in red so the whole deck tells one coherent story.
   */
  heroTierId: string | null
  hero: {
    paybackYears: number | null
    annualSavingsRappen: number | null
    lifetimeSavingsRappen: number | null
    /** Per-year savings series (length 25) — drives the Screen 3 bars. */
    yearlySavingsRappen: number[] | null
    installedKwp: number | null
  } | null
  /**
   * Screen 3 PAC variant — the subsidy story. Set only for PAC hero
   * scenarios with a verified cantonal subsidy + persisted dimensioning.
   */
  pacHero: {
    thermalKw: number
    pacType: 'air-eau' | 'sol-eau'
    canton: string
    subsidyYear: number
    subsidyRappen: number
    netCostRappen: number
  } | null
  /**
   * Screen 4 data — cumulative electricity cost without vs with the
   * installation. null → Screen 4 is not rendered (3-screen deck).
   */
  doNothing: {
    withoutCumulative: number[]
    withCumulative: number[]
    lifetimeAdvantageRappen: number
    horizonYears: number
  } | null
  // NOTE: do NOT add `strings: CustomerFr` here — the i18n object contains
  // arrow functions (greeting, lifetimeSavings, payback, screenIndicator
  // helpers) which can't cross the RSC server→client serialization boundary.
  // Each client component imports customerFr directly. The server passes
  // only data; strings are resolved on the client.
}

// ─── Component ─────────────────────────────────────────────────────────────

export default function PresentScreens({ vm }: { vm: PresentVM }) {
  const hasScreen4 = vm.doNothing != null
  const screenCount = hasScreen4 ? 4 : 3
  const screenTitles = [
    customerFr.screen1.title,
    customerFr.screen2.title,
    customerFr.screen3.title,
    ...(hasScreen4 ? [customerFr.screen4.title] : []),
  ]

  const scrollerRef = useRef<HTMLDivElement>(null)
  const screenRefs = useRef<Array<HTMLDivElement | null>>([])
  const [activeScreen, setActiveScreen] = useState(0)
  const [announce, setAnnounce] = useState('')

  // IntersectionObserver: when a screen becomes ≥80% visible in the scroller,
  // promote it to active. Drives both the indicator dot and the screen-reader
  // announcement (per design review issue 6.2).
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const screens = screenRefs.current.slice(0, screenCount)
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            const index = screens.indexOf(entry.target as HTMLDivElement)
            if (index !== -1) setActiveScreen(index)
          }
        }
      },
      { root: scroller, threshold: [0.8] }
    )
    for (const s of screens) if (s) observer.observe(s)
    return () => observer.disconnect()
  }, [screenCount])

  // Announce screen change to screen readers (debounced 200ms).
  // Format: "Écran 2 sur 4 : Vos options"
  useEffect(() => {
    const t = setTimeout(() => {
      setAnnounce(
        customerFr.screenIndicator.announce(
          activeScreen + 1,
          screenCount,
          screenTitles[activeScreen]
        )
      )
    }, 200)
    return () => clearTimeout(t)
    // screenTitles derives from screenCount; customerFr is a static import
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScreen, screenCount])

  const scrollToScreen = useCallback((index: number) => {
    const target = screenRefs.current[index]
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
  }, [])

  const greeting = vm.customerFirstName
    ? customerFr.greeting(vm.customerFirstName)
    : customerFr.greetingFallback

  const setScreenRef = (index: number) => (el: HTMLDivElement | null) => {
    screenRefs.current[index] = el
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Skip-link for screen-reader users */}
      <a
        href="#present-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-gray-900 focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-red-500"
      >
        {customerFr.skipLink}
      </a>

      {/* aria-live region for screen-reader announcements (visually hidden) */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      {/* Top chrome */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-white">
        <div className="flex items-center gap-3">
          <div className="w-6 h-6 bg-red-500 rounded" aria-hidden="true" />
          <span className="text-sm font-medium text-gray-700">{greeting}</span>
        </div>
        <Link
          href={vm.backUrl}
          className="text-xs text-gray-500 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded px-1"
        >
          {customerFr.backLink}
        </Link>
      </header>

      {/* Main scroll-snap container — 3 or 4 screens horizontally */}
      <main
        id="present-main"
        ref={scrollerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory"
        style={{ scrollSnapStop: 'always' }}
      >
        <ScreenContainer ref={setScreenRef(0)}>
          <Screen1Roof
            mapImageDataUrl={vm.mapImageDataUrl}
            hasMapPosition={vm.map.lat != null && vm.map.lon != null}
            customerFirstName={vm.customerFirstName}
            strings={customerFr}
          />
        </ScreenContainer>
        <ScreenContainer ref={setScreenRef(1)}>
          <Screen2Tiers tiers={vm.tiers} heroTierId={vm.heroTierId} strings={customerFr} />
        </ScreenContainer>
        <ScreenContainer ref={setScreenRef(2)}>
          <Screen3Numbers hero={vm.hero} pacHero={vm.pacHero} strings={customerFr} />
        </ScreenContainer>
        {hasScreen4 && (
          <ScreenContainer ref={setScreenRef(3)}>
            <Screen4Compare doNothing={vm.doNothing!} strings={customerFr} />
          </ScreenContainer>
        )}
      </main>

      {/* Bottom chrome — screen indicator (tap to jump) */}
      <nav
        className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-100 bg-white"
        aria-label={customerFr.screenIndicator.label(activeScreen + 1, screenCount)}
      >
        {Array.from({ length: screenCount }, (_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollToScreen(i)}
            aria-label={customerFr.screenIndicator.jumpAria(i + 1)}
            aria-current={activeScreen === i ? 'true' : undefined}
            className={
              activeScreen === i
                ? 'w-6 h-2 bg-red-500 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
                : 'w-2 h-2 bg-gray-300 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2'
            }
          />
        ))}
      </nav>
    </div>
  )
}

// ─── Screen container (sets snap-align + flex sizing) ──────────────────────

const ScreenContainer = forwardRef<HTMLDivElement, { children: React.ReactNode }>(
  function ScreenContainer({ children }, ref) {
    return (
      <section
        ref={ref}
        className="flex-shrink-0 w-full snap-start snap-always"
        style={{ scrollSnapAlign: 'start' }}
      >
        <div className="h-full flex flex-col p-6">{children}</div>
      </section>
    )
  }
)
