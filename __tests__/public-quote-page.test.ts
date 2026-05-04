/**
 * Tests for the public quote page visibility rules at /q/[shareToken].
 *
 * The page is a Next.js server component. We test the data-fetching +
 * visibility logic by mocking @/lib/db and @/lib/pricing, then directly
 * invoking the default export.
 *
 *   DRAFT or unknown token  → notFound() throws (404)
 *   SENT (active)           → returns VM with canRespond=true, isExpired=false
 *   SENT (expired)          → returns VM with canRespond=false, isExpired=true
 *   ACCEPTED                → returns VM with status=ACCEPTED
 *   DECLINED                → returns VM with status=DECLINED
 *
 * The page also bumps viewCount + firstViewedAt on SENT renders — we
 * verify the side-effect was kicked off.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockNotFound = vi.fn(() => {
  // notFound() throws an internal Next.js error to short-circuit rendering
  const err = new Error('NEXT_NOT_FOUND')
  ;(err as Error & { digest?: string }).digest = 'NEXT_NOT_FOUND'
  throw err
})

vi.mock('@/lib/db', () => ({
  prisma: {
    quote: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

vi.mock('next/navigation', () => ({
  notFound: () => mockNotFound(),
}))

// React `cache` is a no-op in tests — it just returns the function.
vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react')
  return {
    ...actual,
    cache: <T extends (...args: never[]) => unknown>(fn: T): T => fn,
  }
})

import PublicQuotePage from '@/app/(public)/q/[id]/page'

// Helper: extract the VM from the page's React element output. The page
// returns <PublicQuoteView quote={vm} />, which is a React.createElement
// object with .props.quote.
function getVm(result: unknown): {
  canRespond: boolean
  isExpired: boolean
  status: string
  acceptedAt: string | null
  declinedAt: string | null
  shareToken: string
  id: string
} {
  const element = result as { props?: { quote: Record<string, unknown> } }
  if (!element?.props?.quote) {
    throw new Error('Page did not return <PublicQuoteView quote={...} />')
  }
  return element.props.quote as ReturnType<typeof getVm>
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    id: 'quote_id_1',
    quoteNumber: 'QUO-2026-001',
    status: 'SENT',
    customerName: 'Jean Dupont',
    siteAddress: 'Rue de la Paix 1',
    sentAt: new Date('2026-04-01'),
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30d
    acceptedAt: null,
    declinedAt: null,
    shareToken: 'tok_abc',
    firstViewedAt: null,
    viewCount: 0,
    scenarios: [
      {
        name: 'Système Recommandé',
        scenarioType: 'PV',
        sortOrder: 0,
        sellingPriceExVatRappen: 1_485_000,
        sellingPriceIncVatRappen: 1_605_285,
        vatPctBasisPts: 810,
        items: [
          {
            quantity: 22,
            product: { name: 'Panel Mid 460Wp', category: 'PANEL', powerWp: 460 },
          },
        ],
        options: [],
      },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockNotFound.mockClear()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PublicQuotePage — visibility', () => {
  it('throws notFound for unknown shareToken', async () => {
    mockFindUnique.mockResolvedValue(null)

    await expect(
      PublicQuotePage({ params: { id: 'unknown_token' } })
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
    expect(mockNotFound).toHaveBeenCalled()
  })

  it('throws notFound for DRAFT quotes (privacy)', async () => {
    mockFindUnique.mockResolvedValue(makeQuote({ status: 'DRAFT' }))

    await expect(
      PublicQuotePage({ params: { id: 'tok_abc' } })
    ).rejects.toThrow(/NEXT_NOT_FOUND/)
  })

  it('renders SENT live quote with canRespond=true', async () => {
    mockFindUnique.mockResolvedValue(makeQuote({ status: 'SENT' }))
    mockUpdate.mockResolvedValue({})

    const result = await PublicQuotePage({ params: { id: 'tok_abc' } })
    const vm = getVm(result)
    expect(vm.canRespond).toBe(true)
    expect(vm.isExpired).toBe(false)
    expect(vm.status).toBe('SENT')
  })

  it('renders SENT-but-expired quote with canRespond=false, isExpired=true', async () => {
    mockFindUnique.mockResolvedValue(
      makeQuote({
        status: 'SENT',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1d ago
      })
    )
    mockUpdate.mockResolvedValue({})

    const result = await PublicQuotePage({ params: { id: 'tok_abc' } })
    const vm = getVm(result)
    expect(vm.canRespond).toBe(false)
    expect(vm.isExpired).toBe(true)
  })

  it('renders ACCEPTED quote with canRespond=false', async () => {
    mockFindUnique.mockResolvedValue(
      makeQuote({ status: 'ACCEPTED', acceptedAt: new Date('2026-04-15') })
    )

    const result = await PublicQuotePage({ params: { id: 'tok_abc' } })
    const vm = getVm(result)
    expect(vm.canRespond).toBe(false)
    expect(vm.status).toBe('ACCEPTED')
    expect(vm.acceptedAt).toBeTruthy()
  })

  it('renders DECLINED quote with canRespond=false', async () => {
    mockFindUnique.mockResolvedValue(
      makeQuote({ status: 'DECLINED', declinedAt: new Date('2026-04-15') })
    )

    const result = await PublicQuotePage({ params: { id: 'tok_abc' } })
    const vm = getVm(result)
    expect(vm.canRespond).toBe(false)
    expect(vm.status).toBe('DECLINED')
    expect(vm.declinedAt).toBeTruthy()
  })

  it('looks up by shareToken (not id)', async () => {
    mockFindUnique.mockResolvedValue(makeQuote())
    mockUpdate.mockResolvedValue({})

    await PublicQuotePage({ params: { id: 'tok_abc' } })

    // The first call (default export) should query by shareToken
    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { shareToken: 'tok_abc' } })
    )
  })
})

describe('PublicQuotePage — view tracking', () => {
  it('increments viewCount + sets firstViewedAt on SENT quotes', async () => {
    mockFindUnique.mockResolvedValue(
      makeQuote({ status: 'SENT', firstViewedAt: null, viewCount: 0 })
    )
    mockUpdate.mockResolvedValue({})

    await PublicQuotePage({ params: { id: 'tok_abc' } })

    // Allow microtask for the fire-and-forget update to register
    await Promise.resolve()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quote_id_1' },
        data: expect.objectContaining({
          viewCount: { increment: 1 },
          firstViewedAt: expect.any(Date),
        }),
      })
    )
  })

  it('preserves an existing firstViewedAt on subsequent views', async () => {
    const originalView = new Date('2026-04-10T10:00:00Z')
    mockFindUnique.mockResolvedValue(
      makeQuote({
        status: 'SENT',
        firstViewedAt: originalView,
        viewCount: 1,
      })
    )
    mockUpdate.mockResolvedValue({})

    await PublicQuotePage({ params: { id: 'tok_abc' } })

    await Promise.resolve()
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          // firstViewedAt is preserved (??= semantics)
          firstViewedAt: originalView,
        }),
      })
    )
  })

  it('does NOT track views on terminal states (ACCEPTED/DECLINED/EXPIRED)', async () => {
    mockFindUnique.mockResolvedValue(makeQuote({ status: 'ACCEPTED' }))

    await PublicQuotePage({ params: { id: 'tok_abc' } })
    await Promise.resolve()

    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
