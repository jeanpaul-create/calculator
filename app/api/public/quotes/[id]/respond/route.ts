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
import { notifyRep, sendCustomerAcceptConfirmation } from '@/lib/notify-rep'
import { enforceRateLimit } from '@/lib/rate-limit'

const Schema = z.object({
  action: z.enum(['accept', 'decline']),
  reason: z.string().max(500).optional(),
  /** Configuration the customer chose (tier picker on /q). Must belong to
   *  this quote. Optional for legacy clients — falls back to unrecorded. */
  scenarioId: z.string().min(1).optional(),
  /** Signature simple: full name typed to accept. Required on accept. */
  signedName: z.string().min(3).max(120).optional(),
})

const PER_QUOTE_LIMIT = 10
const WINDOW_MS = 60_000

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  // Rename for clarity — the path segment is named "id" for legacy reasons,
  // but the value passed by the client is a shareToken.
  const token = params.id

  try {
    // Rate limit — per-token, per-minute (DB-backed)
    const { ok } = await enforceRateLimit({
      key: `respond:tok:${token}`,
      windowMs: WINDOW_MS,
      max: PER_QUOTE_LIMIT,
    })
    if (!ok) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Veuillez réessayer dans une minute.' },
        { status: 429 }
      )
    }

    const body = await req.json()
    const { action, reason, scenarioId, signedName } = Schema.parse(body)

    if (action === 'accept' && (!signedName || signedName.trim().length < 3)) {
      return NextResponse.json(
        { error: 'Veuillez saisir votre nom complet pour accepter l’offre.' },
        { status: 422 }
      )
    }

    const quote = await prisma.quote.findUnique({
      where: { shareToken: token },
      select: { id: true, status: true, expiresAt: true, scenarios: { select: { id: true } } },
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

    // The chosen configuration must belong to THIS quote (ignore stale ids).
    const validScenarioId =
      scenarioId && quote.scenarios.some((s) => s.id === scenarioId) ? scenarioId : null

    // Signature-simple audit trail: who accepted, from where, with what.
    const ip =
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      req.headers.get('x-real-ip') ??
      null
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

    const now = new Date()
    const updated = await prisma.quote.update({
      where: { id: quote.id },
      data:
        action === 'accept'
          ? {
              status: 'ACCEPTED',
              acceptedAt: now,
              acceptedScenarioId: validScenarioId,
              acceptedByName: signedName!.trim(),
              acceptedIp: ip,
              acceptedUserAgent: userAgent,
              updatedAt: now,
            }
          : {
              status: 'DECLINED',
              declinedAt: now,
              declineReason: reason ?? null,
              updatedAt: now,
            },
      select: { status: true },
    })

    // Tell the rep immediately — fire-and-forget, never blocks the customer.
    void notifyRep(quote.id, action === 'accept' ? 'accepted' : 'declined')
    // …and confirm to the customer (accept only) with the chosen config.
    if (action === 'accept') void sendCustomerAcceptConfirmation(quote.id)

    return NextResponse.json({ ok: true, status: updated.status })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/public/quotes/[id]/respond]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
