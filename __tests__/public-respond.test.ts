/**
 * Tests for the public quote respond route.
 *
 *   POST /api/public/quotes/[id]/respond
 *
 * No auth — the path segment is a shareToken. State machine:
 *   SENT (active)         → updates to ACCEPTED / DECLINED, returns 200
 *   DRAFT or unknown      → 404 ("Offre introuvable")
 *   ACCEPTED / DECLINED   → 409 (already responded)
 *   SENT (expired)        → 409 (expired)
 *   any > 10/min/token    → 429 (rate limit)
 *
 * Mocks @/lib/db (prisma) and @/lib/rate-limit (enforceRateLimit) so tests
 * are deterministic without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFindUnique = vi.fn()
const mockUpdate = vi.fn()
const mockEnforceRateLimit = vi.fn()

vi.mock('@/lib/db', () => ({
  prisma: {
    quote: {
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}))

vi.mock('@/lib/rate-limit', () => ({
  enforceRateLimit: (...args: unknown[]) => mockEnforceRateLimit(...args),
}))

// Import AFTER the mocks are set up so the route picks them up.
import { POST } from '@/app/api/public/quotes/[id]/respond/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/public/quotes/abc/respond', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockEnforceRateLimit.mockReset()
  // Default: rate limit allows the call. Override per-test for 429 cases.
  mockEnforceRateLimit.mockResolvedValue({ ok: true, remaining: 9, resetAt: new Date() })
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/public/quotes/[id]/respond — happy paths', () => {
  it('SENT → accept transitions the quote to ACCEPTED', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'SENT',
      expiresAt: null,
    })
    mockUpdate.mockResolvedValue({ status: 'ACCEPTED' })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true, status: 'ACCEPTED' })
    // Quote was looked up by shareToken (not id), scenarios included so the
    // chosen configuration can be validated against this quote
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { shareToken: 'tok_abc' },
      select: { id: true, status: true, expiresAt: true, scenarios: { select: { id: true } } },
    })
    // Update was called with ACCEPTED + acceptedAt + signature-simple trail
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'quote_id_1' },
        data: expect.objectContaining({
          status: 'ACCEPTED',
          acceptedAt: expect.any(Date),
          acceptedByName: 'Jean Dupont',
        }),
      })
    )
  })

  it('SENT → decline transitions the quote to DECLINED with reason', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'SENT',
      expiresAt: null,
    })
    mockUpdate.mockResolvedValue({ status: 'DECLINED' })

    const res = await POST(
      buildRequest({ action: 'decline', reason: 'Prix trop élevé' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json).toEqual({ ok: true, status: 'DECLINED' })
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DECLINED',
          declineReason: 'Prix trop élevé',
          declinedAt: expect.any(Date),
        }),
      })
    )
  })

  it('SENT → decline without reason persists null declineReason', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'SENT',
      expiresAt: null,
    })
    mockUpdate.mockResolvedValue({ status: 'DECLINED' })

    await POST(buildRequest({ action: 'decline' }), { params: { id: 'tok_abc' } })

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ declineReason: null }),
      })
    )
  })
})

// ─── Tests — error states ─────────────────────────────────────────────────────

describe('POST /api/public/quotes/[id]/respond — privacy + state machine', () => {
  it('returns 404 when no quote matches the shareToken', async () => {
    mockFindUnique.mockResolvedValue(null)

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'GHOST_TOKEN' } }
    )

    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toMatch(/introuvable/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 404 for DRAFT quotes (privacy: never expose drafts)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'DRAFT',
      expiresAt: null,
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(404)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 409 when quote is already ACCEPTED', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'ACCEPTED',
      expiresAt: null,
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/déjà été acceptée/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('returns 409 when quote is already DECLINED', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'DECLINED',
      expiresAt: null,
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/déjà été déclinée/i)
  })

  it('returns 409 when quote is EXPIRED (status enum)', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'EXPIRED',
      expiresAt: null,
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(409)
  })

  it('returns 409 when quote is SENT but expiresAt is in the past', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'SENT',
      expiresAt: new Date(Date.now() - 60 * 60 * 1000), // 1h ago
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toMatch(/expirée/i)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ─── Tests — input validation ─────────────────────────────────────────────────

describe('POST /api/public/quotes/[id]/respond — input validation', () => {
  it('returns 422 for invalid action', async () => {
    const res = await POST(
      buildRequest({ action: 'maybe' }),
      { params: { id: 'tok_abc' } }
    )
    expect(res.status).toBe(422)
  })

  it('returns 422 when action is missing', async () => {
    const res = await POST(
      buildRequest({ reason: 'too expensive' }),
      { params: { id: 'tok_abc' } }
    )
    expect(res.status).toBe(422)
  })
})

// ─── Tests — rate limiting ────────────────────────────────────────────────────

describe('POST /api/public/quotes/[id]/respond — rate limit', () => {
  it('returns 429 when the rate limiter denies', async () => {
    mockEnforceRateLimit.mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAt: new Date(Date.now() + 60_000),
    })

    const res = await POST(
      buildRequest({ action: 'accept', signedName: 'Jean Dupont' }),
      { params: { id: 'tok_abc' } }
    )

    expect(res.status).toBe(429)
    const json = await res.json()
    expect(json.error).toMatch(/Trop de tentatives/i)
    // Quote was never even looked up
    expect(mockFindUnique).not.toHaveBeenCalled()
  })

  it('uses a per-token rate limit key', async () => {
    mockFindUnique.mockResolvedValue({
      id: 'quote_id_1',
      status: 'SENT',
      expiresAt: null,
    })
    mockUpdate.mockResolvedValue({ status: 'ACCEPTED' })

    await POST(buildRequest({ action: 'accept', signedName: 'Jean Dupont' }), { params: { id: 'tok_xyz' } })

    expect(mockEnforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'respond:tok:tok_xyz',
        max: 10,
        windowMs: 60_000,
      })
    )
  })
})
