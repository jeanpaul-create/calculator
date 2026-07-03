/**
 * /present/[id] — customer-facing meeting mode.
 *
 * Rep auth required (rep is the one who launches /present/ from /quotes/[id]
 * during a customer meeting; customer is a passive viewer or interacts via
 * the rep's tablet). Same auth pattern as /api/quotes/[id]/pdf:
 *   await requireOwnerOrAdmin(quote.repId)
 *
 * Visibility rules:
 *   DRAFT or unknown id → 404
 *   SENT / ACCEPTED / DECLINED / EXPIRED → render normally (rep may demo any
 *   non-DRAFT quote; sent/accepted/declined are common in re-meetings)
 *
 * Single preload fetch (P1.A from eng review):
 *   getFullQuoteForPdf(id) — already proven on PDF + email send routes;
 *   includes scenarios + items + options + rep + all the data /present/
 *   needs for screens 1-3. No per-screen network calls in customer mode.
 *
 * Layout: this page renders its own top + bottom chrome (no app shell from
 * the (present) layout, which is intentionally minimal). Per design doc.
 */

import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'
import { auth } from '@/lib/auth'
import {
  getFullQuoteForPdf,
  buildPricedScenarios,
  fetchMapImageBase64,
  type FullQuote,
  type PricedScenario,
} from '@/lib/quote-pdf'
import { buildDoNothing } from '@/lib/present-do-nothing'
import PresentScreens, { type PresentVM, type PresentTier } from '@/components/present/PresentScreens'

export const dynamic = 'force-dynamic'

type Props = { params: { id: string } }

/**
 * Single-fetch wrapper for the quote, cached per request via React.cache().
 * generateMetadata + the default export share one DB round trip.
 */
const getQuote = cache(async (id: string) => {
  return getFullQuoteForPdf(id)
})

export async function generateMetadata({ params }: Props) {
  const quote = await getQuote(params.id)
  if (!quote || quote.status === 'DRAFT') return { title: 'Démo client' }
  const firstName = extractFirstName(quote.customerName)
  return {
    title: firstName
      ? `Démo — ${firstName}`
      : `Démo — ${quote.quoteNumber}`,
  }
}

export default async function PresentPage({ params }: Props) {
  const quote = await getQuote(params.id)

  // DRAFT quotes haven't been demo-ready yet; rep should send first.
  // Unknown id → 404.
  if (!quote || quote.status === 'DRAFT') notFound()

  // Auth: must use Next-native control flow in server components.
  // requireOwnerOrAdmin throws a raw Response which Next.js doesn't unwrap
  // outside Route Handlers — it cascades to the error boundary and renders
  // the generic "Application error" page. redirect()/notFound() are the
  // server-component-safe equivalents (matches /quotes/[id]/page.tsx).
  const session = await auth()
  if (!session) redirect('/login')
  const isAdmin = session.user.role === 'ADMIN'
  if (!isAdmin && quote.repId !== session.user.id) notFound()

  // Compute priced scenarios (ROI math, savings curve data) — same helper
  // the PDF route uses, so the numbers are identical.
  const pricedScenarios = await buildPricedScenarios(quote)

  // Pre-fetch the satellite image server-side. fetchMapImageBase64 is wrapped
  // in unstable_cache (24h revalidate) per eng review P2.B — first /present/
  // for an address pays the swisstopo round-trip; subsequent loads instant.
  const mapImageDataUrl =
    quote.mapLat != null && quote.mapLon != null
      ? await fetchMapImageBase64(quote.mapLat, quote.mapLon, quote.mapZoom ?? 17)
      : null

  // Build the customer-facing view-model. Filter to AI-tier scenarios when
  // present (any scenario with tier!=null); fall back to all scenarios for
  // legacy / non-AI quotes (single-scenario fallback per design doc empty
  // state).
  const vm: PresentVM = buildPresentVM(quote, pricedScenarios, mapImageDataUrl)

  return <PresentScreens vm={vm} />
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function extractFirstName(fullName: string | null): string | null {
  if (!fullName) return null
  const trimmed = fullName.trim()
  if (!trimmed) return null
  // "Jean Dupont" → "Jean". "Famille Müller" → "Famille" (acceptable;
  // matches the existing public quote view's tone)
  const first = trimmed.split(/\s+/)[0]
  return first.length > 0 ? first : null
}

function buildPresentVM(
  quote: FullQuote,
  pricedScenarios: PricedScenario[],
  mapImageDataUrl: string | null
): PresentVM {
  const firstName = extractFirstName(quote.customerName)

  // AI-tier scenarios (the 3 tiers from the AI builder) come first; fall back
  // to all scenarios if none have tier set (legacy / non-AI quote).
  const tieredScenarios = pricedScenarios.filter((s) => s.tier != null)
  const screen2Source = tieredScenarios.length > 0 ? tieredScenarios : pricedScenarios

  const tiers: PresentTier[] = screen2Source.map((s) => ({
    id: s.id,
    tier: (s.tier as 'essentiel' | 'recommande' | 'premium' | null) ?? null,
    name: s.name,
    sellingPriceIncVat: s.sellingPriceIncVatRappen,
    installedKwp: s.installedKwp,
    rationale: deriveRationale(s),
    itemsSummary: summarizeItems(s),
    paybackYears: s.paybackYears ?? null,
    annualSavingsRappen: s.annualSavingsRappen ?? null,
  }))

  // Hero pick: rep's explicit choice (quote.heroScenarioId) wins; stale ids
  // (scenario re-created on edit) fall through to the automatic pick
  // (recommandé → premium → first).
  const repPick = quote.heroScenarioId
    ? tiers.find((t) => t.id === quote.heroScenarioId) ?? null
    : null
  const heroScenario =
    repPick ??
    tiers.find((t) => t.tier === 'recommande') ??
    tiers.find((t) => t.tier === 'premium') ??
    tiers[0] ??
    null

  // Find the priced scenario that matches the hero tier so we can pull
  // payback / savings / annualSavings (derived numbers, not on the tier VM)
  const heroPriced = heroScenario
    ? screen2Source.find((s) => s.id === heroScenario.id) ?? null
    : null

  return {
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    customerFirstName: firstName,
    customerName: quote.customerName,
    siteAddress: quote.siteAddress,
    backUrl: `/quotes/${quote.id}`,
    map: {
      lat: quote.mapLat,
      lon: quote.mapLon,
      zoom: quote.mapZoom ?? 17,
    },
    mapImageDataUrl,
    tiers,
    heroTierId: heroScenario?.id ?? null,
    hero: heroPriced
      ? {
          paybackYears: heroPriced.paybackYears ?? null,
          annualSavingsRappen: heroPriced.annualSavingsRappen ?? null,
          // Real 25-year total (degradation + price escalation) when the
          // series is available; legacy ×25 fallback for pre-series quotes.
          lifetimeSavingsRappen:
            heroPriced.savings25YearsRappen ??
            (heroPriced.annualSavingsRappen != null
              ? heroPriced.annualSavingsRappen * 25
              : null),
          yearlySavingsRappen: heroPriced.yearlySavingsRappen ?? null,
          installedKwp: heroPriced.installedKwp ?? null,
        }
      : null,
    doNothing: heroPriced ? buildDoNothing(heroPriced) : null,
  }
}


/**
 * One-line tier rationale shown on each card. Derived from the saved scenario
 * shape since the AI's rationale string isn't currently persisted on the DB.
 * Keep it simple + truthful — the rep narrates the deeper story.
 */
function deriveRationale(s: PricedScenario): string {
  if (s.tier === 'essentiel') {
    return `Système ${s.installedKwp ?? '?'} kWp — option la plus abordable.`
  }
  if (s.tier === 'recommande') {
    return `Système ${s.installedKwp ?? '?'} kWp — équilibre prix / autoconsommation.`
  }
  if (s.tier === 'premium') {
    return `Système ${s.installedKwp ?? '?'} kWp — autoconsommation maximale.`
  }
  return `Système ${s.installedKwp ?? '?'} kWp.`
}

/**
 * Customer-friendly item summary line. E.g. "20 panneaux + batterie 5 kWh".
 * Pure function; no rep jargon. Categories grouped, qty rolled up.
 */
function summarizeItems(s: PricedScenario): string {
  const groups: Record<string, number> = {}
  for (const item of s.items ?? []) {
    const cat = item.category as string
    groups[cat] = (groups[cat] ?? 0) + item.quantity
  }
  const parts: string[] = []
  if (groups.PANEL) parts.push(`${groups.PANEL} panneaux`)
  if (groups.BATTERY) parts.push(`batterie`)
  if (groups.EV_CHARGER) parts.push(`borne VE`)
  if (groups.PAC_MACHINE) parts.push(`pompe à chaleur`)
  return parts.length > 0 ? parts.join(' + ') : 'Configuration personnalisée'
}
