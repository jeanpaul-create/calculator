/**
 * POST /api/public/quotes/[id]/respond
 *
 * No auth — the dynamic segment value is a `shareToken`, not Quote.id.
 * Decoupling the public URL from the row primary key lets the rep revoke a
 * leaked link by rotating the token. Body:
 *   { action: 'accept' | 'decline', reason?: string }
 *
 * Pre-conditions:
 *   - Quote exists (shareToken match)
 *   - Quote.status === 'SENT' (DRAFT can't respond, ACCEPTED/DECLINED is final)
 *   - Quote not expired (expiresAt is in the future or null)
 *
 * On success: updates the quote, returns { ok: true, status }.
 * On already-responded or expired: returns 409 with a clear message.
 *
 * Rate limited: 10 attempts per token per minute (in-memory; resets on cold
 * start). Prevents trivial abuse via the public URL.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'

const Schema = z.object({
  action: z.enum(['accept', 'decline']),
  reason: z.string().max(500).optional(),
})

// Per-token attempt counter (memory). Resets on cold start.
const attempts = new Map<string, { count: number; resetAt: number }>()
const PER_QUOTE_LIMIT = 10
const WINDOW_MS = 60_000

function checkRate(token: string): boolean {
  const now = Date.now()
  const entry = attempts.get(token)
  if (!entry || now >= entry.resetAt) {
    attempts.set(token, { count: 1, resetAt: now + WINDOW_MS })
    return true
  }
  if (entry.count >= PER_QUOTE_LIMIT) return false
  entry.count++
  return true
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rename for clarity — the path segment is named "id" for legacy reasons,
  // but the value passed by the client is a shareToken.
  const token = params.id

  try {
    if (!checkRate(token)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez réessayer dans une minute.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { action, reason } = Schema.parse(body)

    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      select: { id: true, status: true, expiresAt: true },
    })

    if (!quote || quote.status === 'DRAFT') {
      return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 })
    }

    if (quote.status !== 'SENT') {
      return NextResponse.json(
        {
          error:
            quote.status === 'ACCEPTED'
              ? "Cette offre a déjà été acceptée."
              : quote.status === 'DECLINED'
                ? "Cette offre a déjà été déclinée."
                : "Cette offre n'est plus active.",
        },
        { status: 409 }
      )
    }

    if (quote.expiresAt && quote.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { error: "Cette offre est expirée. Contactez votre conseiller pour une nouvelle offre." },
        { status: 409 }
      )
    }

    const now = new Date()
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data:
        action === 'accept'
          ? { status: 'ACCEPTED', acceptedAt: now, updatedAt: now }
          : {
              status: 'DECLINED',
              declinedAt: now,
              declineReason: reason ?? null,
              updatedAt: now,
            },
      select: { status: true },
    })

    return NextResponse.json({ ok: true, status: updated.status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/public/quotes/[id]/respond]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
