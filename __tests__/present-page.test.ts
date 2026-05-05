/**
 * Tests for /present/[id] customer-facing meeting mode.
 *
 * Visibility + auth rules:
 *   unknown id      → notFound() (404)
 *   DRAFT           → notFound() (404, even to the rep — pre-send pricing
 *                     is not demo-ready)
 *   non-owner rep   → requireOwnerOrAdmin throws 403 (Response)
 *   SENT/ACCEPTED/DECLINED/EXPIRED + owner → renders normally
 *
 * View-model rules (buildPresentVM):
 *   tier-typed scenarios filter into vm.tiers; legacy untyped fall back
 *   heroScenario: Recommandé > Premium > first scenario
 *   customerFirstName extracted from "Jean Dupont" → "Jean"
 *   mapImageDataUrl pre-fetched when mapLat/mapLon present
 *
 * Mocks @/lib/auth, @/lib/quote-pdf, @/lib/i18n/customer-fr (passthrough),
 * next/navigation, and react.cache so the page is exercised in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockGetFullQuoteForPdf = vi.fn()
const mockBuildPricedScenarios = vi.fn()
const mockFetchMapImageBase64 = vi.fn()
const mockAuth = vi.fn()
const mockNotFound = vi.fn(() => {
  const err = new Error('NEXT_NOT_FOUND')
  ;(err as Error & { digest?: string }).digest = 'NEXT_NOT_FOUND'
  throw err
})
const mockRedirect = vi.fn((url: string) => {
  const err = new Error(`NEXT_REDIRECT;replace;${url}`)
  ;(err as Error & { digest?: string }).digest = `NEXT_REDIRECT;replace;${url}`
  throw err
})

vi.mock('@/lib/quote-pdf', () => ({
  getFullQuoteForPdf: (...args: unknown[]) => mockGetFullQuoteForPdf(...args),
  buildPricedScenarios: (...args: unknown[]) => mockBuildPricedScenarios(...args),
  fetchMapImageBase64: (...args: unknown[]) => mockFetchMapImageBase64(...args),
}))

vi.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}))

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
  redirect: (url: string) => mockRedirect(url),
}))

// React `cache` is a no-op in tests — passthrough.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  }
})

import PresentPage from '@/app/(present)/present/[id]/page'

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface ScenarioOverride {
  id?: string
  tier?: 'essentiel' | 'recommande' | 'premium' | null
  name?: string
  installedKwp?: number | null
  sellingPriceIncVatRappen?: number
  paybackYears?: number | null
  annualSavingsRappen?: number | null
  items?: Array<{ category: string; quantity: number }>
}

/** Minimal priced scenario satisfying the structure the page reads. */
function makeScenario(o: ScenarioOverride = {}) {
  return {
    id: o.id ?? 'scn_1',
    name: o.name ?? 'Système 8 kWp',
    tier: o.tier ?? null,
    sortOrder: 0,
    installedKwp: o.installedKwp ?? 8,
    sellingPriceIncVatRappen: o.sellingPriceIncVatRappen ?? 2_500_000,
    sellingPriceExVatRappen: 2_315_000,
    vatRappen: 185_000,
    vatPctBasisPts: 810,
    paybackYears: o.paybackYears ?? 7.5,
    annualSavingsRappen: o.annualSavingsRappen ?? 250_000,
    annualKwhYield: 8000,
    selfConsumedKwh: 4000,
    exportedKwh: 4000,
    panelCount: 18,
    panelPowerWp: 460,
    roofType: 'TUILES',
    roofSlope: 'INCLINE',
    customerBreakdown: null,
    items:
      o.items?.map((it, i) => ({
        productId: `prod_${i}`,
        category: it.category,
        quantity: it.quantity,
        name: 'Test product',
      })) ?? [],
  }
}

/** Minimal full quote satisfying the page's reads. */
function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote_id_1',
    quoteNumber: 'QUO-2026-001',
    status: 'SENT',
    customerName: 'Jean Dupont',
    customerEmail: 'jean@example.ch',
    siteAddress: 'Rue de la Paix 1',
    repId: 'rep_user_1',
    mapLat: 46.5,
    mapLon: 6.6,
    mapZoom: 17,
    scenarios: [],
    rep: { name: 'Rep Name', email: 'rep@ion-e.ch' },
    ...overrides,
  }
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockGetFullQuoteForPdf.mockReset()
  mockBuildPricedScenarios.mockReset()
  mockFetchMapImageBase64.mockReset()
  mockAuth.mockReset()
  mockNotFound.mockClear()
  mockRedirect.mockClear()

  // Defaults: auth returns a session for the quote owner, no map (overridden).
  mockAuth.mockResolvedValue({
    user: { id: 'rep_user_1', role: 'REP' },
  })
  mockFetchMapImageBase64.mockResolvedValue('data:image/jpeg;base64,abc')
  mockBuildPricedScenarios.mockResolvedValue([])
})

// Helper: extract the VM passed into <PresentScreens vm={vm} />.
function getVm(result: unknown): {
  quoteId: string
  quoteNumber: string
  customerFirstName: string | null
  customerName: string | null
  siteAddress: string | null
  backUrl: string
  map: { lat: number | null; lon: number | null; zoom: number }
  mapImageDataUrl: string | null
  tiers: Array<{
    id: string
    tier: 'essentiel' | 'recommande' | 'premium' | null
    name: string
    sellingPriceIncVat: number
    installedKwp: number | null
    rationale: string
    itemsSummary: string
  }>
  hero: {
    paybackYears: number | null
    annualSavingsRappen: number | null
    lifetimeSavingsRappen: number | null
    installedKwp: number | null
  } | null
} {
  const element = result as { props?: { vm: Record<string, unknown> } }
  if (!element?.props?.vm) {
    throw new Error('Page did not return <PresentScreens vm={...} />')
  }
  return element.props.vm as ReturnType<typeof getVm>
}

// ─── Visibility tests ────────────────────────────────────────────────────────

describe('PresentPage — visibility', () => {
  it('throws notFound for unknown id', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(null)

    await expect(
      PresentPage({ params: { id: 'unknown_id' } })
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('throws notFound for DRAFT quote (pre-send, not demo-ready)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote({ status: 'DRAFT' }))

    await expect(
      PresentPage({ params: { id: 'quote_id_1' } })
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
    // Auth check should not be reached for DRAFT
    expect(mockAuth).not.toHaveBeenCalled()
  })

  it('redirects to /login when no session', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockAuth.mockResolvedValue(null)

    await expect(
      PresentPage({ params: { id: 'quote_id_1' } })
    ).rejects.toThrow(/NEXT_REDIRECT.*\/login/)
    expect(mockRedirect).toHaveBeenCalledWith('/login')
  })

  it('returns 404 when rep is not the quote owner and not admin', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ repId: 'rep_user_OTHER' })
    )
    mockAuth.mockResolvedValue({
      user: { id: 'rep_user_1', role: 'REP' },
    })

    await expect(
      PresentPage({ params: { id: 'quote_id_1' } })
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
  })

  it('admins can view any rep\'s quote', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ repId: 'rep_user_OTHER' })
    )
    mockAuth.mockResolvedValue({
      user: { id: 'admin_user', role: 'ADMIN' },
    })

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.quoteId).toBe('quote_id_1')
  })

  it('renders SENT quote', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote({ status: 'SENT' }))

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.quoteId).toBe('quote_id_1')
    expect(vm.quoteNumber).toBe('QUO-2026-001')
  })

  it('renders ACCEPTED quote (re-meeting case)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote({ status: 'ACCEPTED' }))

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.quoteId).toBe('quote_id_1')
  })

  it('renders DECLINED quote (re-meeting case)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote({ status: 'DECLINED' }))

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.quoteId).toBe('quote_id_1')
  })

  it('renders EXPIRED quote (re-meeting case)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote({ status: 'EXPIRED' }))

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.quoteId).toBe('quote_id_1')
  })
})

// ─── View-model: customer name + back URL ────────────────────────────────────

describe('PresentPage — VM: customer + chrome', () => {
  it('extracts firstName from customerName ("Jean Dupont" → "Jean")', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ customerName: 'Jean Dupont' })
    )

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.customerFirstName).toBe('Jean')
    expect(vm.customerName).toBe('Jean Dupont')
  })

  it('returns null firstName for null customerName', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ customerName: null })
    )

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.customerFirstName).toBe(null)
  })

  it('sets backUrl to /quotes/[id]', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.backUrl).toBe('/quotes/quote_id_1')
  })
})

// ─── View-model: map prefetch ────────────────────────────────────────────────

describe('PresentPage — VM: map prefetch', () => {
  it('pre-fetches mapImageDataUrl when mapLat/mapLon present', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ mapLat: 46.5, mapLon: 6.6, mapZoom: 17 })
    )
    mockFetchMapImageBase64.mockResolvedValue('data:image/jpeg;base64,XXX')

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(mockFetchMapImageBase64).toHaveBeenCalledWith(46.5, 6.6, 17)
    expect(vm.mapImageDataUrl).toBe('data:image/jpeg;base64,XXX')
  })

  it('skips map fetch when mapLat/mapLon missing', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ mapLat: null, mapLon: null })
    )

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(mockFetchMapImageBase64).not.toHaveBeenCalled()
    expect(vm.mapImageDataUrl).toBe(null)
  })

  it('uses default zoom 17 when mapZoom is null', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(
      makeQuote({ mapLat: 46.5, mapLon: 6.6, mapZoom: null })
    )

    await PresentPage({ params: { id: 'quote_id_1' } })

    expect(mockFetchMapImageBase64).toHaveBeenCalledWith(46.5, 6.6, 17)
  })
})

// ─── View-model: tier filtering + hero ───────────────────────────────────────

describe('PresentPage — VM: tier filtering', () => {
  it('filters to tier-typed scenarios when present (AI quote)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_e', tier: 'essentiel', installedKwp: 6 }),
      makeScenario({ id: 'scn_r', tier: 'recommande', installedKwp: 8 }),
      makeScenario({ id: 'scn_p', tier: 'premium', installedKwp: 12 }),
      // A legacy untyped scenario sneaks in — must be filtered out
      makeScenario({ id: 'scn_legacy', tier: null, installedKwp: 99 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.tiers).toHaveLength(3)
    expect(vm.tiers.map((t) => t.tier).sort()).toEqual([
      'essentiel',
      'premium',
      'recommande',
    ])
    expect(vm.tiers.find((t) => t.id === 'scn_legacy')).toBeUndefined()
  })

  it('falls back to all scenarios when none have tier set (legacy quote)', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_a', tier: null, installedKwp: 8 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.tiers).toHaveLength(1)
    expect(vm.tiers[0].id).toBe('scn_a')
    expect(vm.tiers[0].tier).toBe(null)
  })

  it('hero picks Recommandé scenario when present', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_e', tier: 'essentiel', paybackYears: 9 }),
      makeScenario({ id: 'scn_r', tier: 'recommande', paybackYears: 7.5 }),
      makeScenario({ id: 'scn_p', tier: 'premium', paybackYears: 6 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.hero?.paybackYears).toBe(7.5)
  })

  it('hero falls back to Premium when no Recommandé', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_e', tier: 'essentiel', paybackYears: 9 }),
      makeScenario({ id: 'scn_p', tier: 'premium', paybackYears: 6 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.hero?.paybackYears).toBe(6)
  })

  it('hero falls back to first scenario when no Recommandé/Premium', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_legacy', tier: null, paybackYears: 8 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.hero?.paybackYears).toBe(8)
  })

  it('hero is null when no scenarios at all', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.hero).toBe(null)
    expect(vm.tiers).toHaveLength(0)
  })

  it('lifetimeSavings = annualSavings × 25', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({
        id: 'scn_r',
        tier: 'recommande',
        annualSavingsRappen: 200_000,
      }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    expect(vm.hero?.lifetimeSavingsRappen).toBe(200_000 * 25)
  })
})

// ─── View-model: itemsSummary derivation ─────────────────────────────────────

describe('PresentPage — VM: tier itemsSummary', () => {
  it('rolls up panel quantity', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({
        id: 'scn_r',
        tier: 'recommande',
        items: [
          { category: 'PANEL', quantity: 18 },
          { category: 'PANEL', quantity: 4 },
        ],
      }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.tiers[0].itemsSummary).toBe('22 panneaux')
  })

  it('joins multiple categories with " + "', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({
        id: 'scn_p',
        tier: 'premium',
        items: [
          { category: 'PANEL', quantity: 24 },
          { category: 'BATTERY', quantity: 1 },
          { category: 'EV_CHARGER', quantity: 1 },
        ],
      }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.tiers[0].itemsSummary).toBe('24 panneaux + batterie + borne VE')
  })

  it('falls back to "Configuration personnalisée" for unknown categories', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({
        id: 'scn_x',
        tier: 'essentiel',
        items: [{ category: 'WEIRD_CATEGORY', quantity: 1 }],
      }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)
    expect(vm.tiers[0].itemsSummary).toBe('Configuration personnalisée')
  })
})

// ─── View-model: rationale derivation ────────────────────────────────────────

describe('PresentPage — VM: tier rationale', () => {
  it('produces tier-specific rationale text', async () => {
    mockGetFullQuoteForPdf.mockResolvedValue(makeQuote())
    mockBuildPricedScenarios.mockResolvedValue([
      makeScenario({ id: 'scn_e', tier: 'essentiel', installedKwp: 6 }),
      makeScenario({ id: 'scn_r', tier: 'recommande', installedKwp: 8 }),
      makeScenario({ id: 'scn_p', tier: 'premium', installedKwp: 12 }),
    ])

    const result = await PresentPage({ params: { id: 'quote_id_1' } })
    const vm = getVm(result)

    const essentiel = vm.tiers.find((t) => t.tier === 'essentiel')
    const recommande = vm.tiers.find((t) => t.tier === 'recommande')
    const premium = vm.tiers.find((t) => t.tier === 'premium')

    expect(essentiel?.rationale).toContain('abordable')
    expect(recommande?.rationale).toContain('équilibre')
    expect(premium?.rationale).toContain('autoconsommation maximale')
  })
})
