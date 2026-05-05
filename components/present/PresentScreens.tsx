/**
 * PresentScreens — top + bottom chrome + scroll-snap container for /present/.
 *
 * Architecture:
 *   ┌─ TopChrome ───────────────────────────────────────┐
 *   │  [logo]  Bonjour {first}        ← Retour à l'offre │
 *   ├────────────────────────────────────────────────────┤
 *   │  [Screen 1] [Screen 2] [Screen 3]  (scroll-snap)  │
 *   │     Your roof   Your tiers  Your numbers           │
 *   ├────────────────────────────────────────────────────┤
 *   │              ●   ○   ○                              │
 *   │  BottomChrome — screen indicator (tap to jump)     │
 *   └────────────────────────────────────────────────────┘
 *
 *   Swipe: native CSS scroll-snap on the horizontal container. No JS lib.
 *   Active screen tracked via IntersectionObserver — updates indicator dot
 *   + announces via aria-live region (per design review issue 6.2).
 *
 *   For S3 the 3 screens are placeholders. S4 / S5 / S6 fill them in.
 */
'use client'

import Link from 'next/link'
import { forwardRef, useEffect, useRef, useState, useCallback } from 'react'
import type { CustomerFr } from '@/lib/i18n/customer-fr'

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
  tiers: PresentTier[]
  hero: {
    paybackYears: number | null
    annualSavingsRappen: number | null
    lifetimeSavingsRappen: number | null
    installedKwp: number | null
  } | null
  strings: CustomerFr
}

const SCREEN_TITLES = ['screen1', 'screen2', 'screen3'] as const
type ScreenKey = (typeof SCREEN_TITLES)[number]

// ─── Component ─────────────────────────────────────────────────────────────

export default function PresentScreens({ vm }: { vm: PresentVM }) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const screen1Ref = useRef<HTMLDivElement>(null)
  const screen2Ref = useRef<HTMLDivElement>(null)
  const screen3Ref = useRef<HTMLDivElement>(null)
  const [activeScreen, setActiveScreen] = useState<0 | 1 | 2>(0)
  const [announce, setAnnounce] = useState('')

  // IntersectionObserver: when a screen becomes ≥80% visible in the scroller,
  // promote it to active. Drives both the indicator dot and the screen-reader
  // announcement (per design review issue 6.2).
  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return
    const screens = [screen1Ref.current, screen2Ref.current, screen3Ref.current]
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
            const index = screens.indexOf(entry.target as HTMLDivElement)
            if (index !== -1 && (index === 0 || index === 1 || index === 2)) {
              setActiveScreen(index as 0 | 1 | 2)
            }
          }
        }
      },
      { root: scroller, threshold: [0.8] }
    )
    for (const s of screens) if (s) observer.observe(s)
    return () => observer.disconnect()
  }, [])

  // Announce screen change to screen readers (debounced 200ms).
  // Format: "Écran 2 sur 3 : Vos options"
  useEffect(() => {
    const titles = [
      vm.strings.screen1.title,
      vm.strings.screen2.title,
      vm.strings.screen3.title,
    ]
    const t = setTimeout(() => {
      setAnnounce(
        vm.strings.screenIndicator.announce(activeScreen + 1, 3, titles[activeScreen])
      )
    }, 200)
    return () => clearTimeout(t)
  }, [activeScreen, vm.strings])

  const scrollToScreen = useCallback((index: 0 | 1 | 2) => {
    const refs = [screen1Ref, screen2Ref, screen3Ref]
    const target = refs[index].current
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })
    }
  }, [])

  const greeting = vm.customerFirstName
    ? vm.strings.greeting(vm.customerFirstName)
    : vm.strings.greetingFallback

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">
      {/* Skip-link for screen-reader users */}
      <a
        href="#present-main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-white focus:text-gray-900 focus:px-4 focus:py-2 focus:rounded focus:ring-2 focus:ring-red-500"
      >
        {vm.strings.skipLink}
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
          {vm.strings.backLink}
        </Link>
      </header>

      {/* Main scroll-snap container — 3 screens horizontally */}
      <main
        id="present-main"
        ref={scrollerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden flex snap-x snap-mandatory"
        style={{ scrollSnapStop: 'always' }}
      >
        <ScreenContainer ref={screen1Ref} keyName="screen1">
          <Screen1Placeholder vm={vm} />
        </ScreenContainer>
        <ScreenContainer ref={screen2Ref} keyName="screen2">
          <Screen2Placeholder vm={vm} />
        </ScreenContainer>
        <ScreenContainer ref={screen3Ref} keyName="screen3">
          <Screen3Placeholder vm={vm} />
        </ScreenContainer>
      </main>

      {/* Bottom chrome — screen indicator (tap to jump) */}
      <nav
        className="flex items-center justify-center gap-2 px-6 py-4 border-t border-gray-100 bg-white"
        aria-label={vm.strings.screenIndicator.label(activeScreen + 1, 3)}
      >
        {([0, 1, 2] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => scrollToScreen(i)}
            aria-label={vm.strings.screenIndicator.jumpAria(i + 1)}
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

const ScreenContainer = forwardRef<
  HTMLDivElement,
  { keyName: ScreenKey; children: React.ReactNode }
>(function ScreenContainer({ keyName: _keyName, children }, ref) {
  return (
    <section
      ref={ref}
      className="flex-shrink-0 w-full snap-start snap-always"
      style={{ scrollSnapAlign: 'start' }}
    >
      <div className="h-full flex flex-col p-6">{children}</div>
    </section>
  )
})

// ─── Placeholder screens (S4 / S5 / S6 will replace) ───────────────────────

function Screen1Placeholder({ vm }: { vm: PresentVM }) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
      >
        {vm.strings.screen1.title}
      </h1>
      <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-400">
          <div className="font-mono text-sm mb-2">Screen 1 — Your roof</div>
          <div className="text-xs">Static satellite + roof outline (S4)</div>
        </div>
      </div>
    </>
  )
}

function Screen2Placeholder({ vm }: { vm: PresentVM }) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
      >
        {vm.strings.screen2.title}
      </h1>
      <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-400">
          <div className="font-mono text-sm mb-2">Screen 2 — Your tiers</div>
          <div className="text-xs">
            {vm.tiers.length} tier{vm.tiers.length === 1 ? '' : 's'} loaded · S5 will render the cards
          </div>
        </div>
      </div>
    </>
  )
}

function Screen3Placeholder({ vm }: { vm: PresentVM }) {
  return (
    <>
      <h1
        tabIndex={-1}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3"
      >
        {vm.strings.screen3.title}
      </h1>
      <div className="flex-1 flex items-center justify-center bg-gray-100 border border-gray-200 rounded-lg">
        <div className="text-center text-gray-400">
          <div className="font-mono text-sm mb-2">Screen 3 — Your numbers</div>
          <div className="text-xs">
            {vm.hero?.paybackYears != null
              ? `Hero number ready: ${vm.hero.paybackYears} ans · S6 will render`
              : 'No ROI data — empty state per design (S6)'}
          </div>
        </div>
      </div>
    </>
  )
}
