/**
 * GET /api/cron/daily — Vercel Cron (see vercel.json, 07:00 UTC).
 *
 * Two pipeline chores, both idempotent:
 *   1. AUTO-EXPIRY: SENT quotes past expiresAt → EXPIRED. Until now reps
 *      flipped these by hand (or didn't, leaving stale pipeline numbers).
 *   2. EXPIRY WARNING: SENT quotes expiring in ≤3 days get one customer
 *      email (« votre offre expire bientôt ») with the /q/ link. Stamped
 *      via expiryWarnedAt so it never sends twice.
 *
 * Auth: Vercel sends `Authorization: Bearer ${CRON_SECRET}` when the env
 * var is set. Requests without the exact header are rejected — the route
 * must not be publicly triggerable (it sends customer email).
 */

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { prisma } from '@/lib/db'

export const dynamic = 'force-dynamic'

function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://calculatorsolarch.vercel.app')
  )
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()

  // ── 1. Auto-expire ────────────────────────────────────────────────────
  const expired = await prisma.quote.updateMany({
    where: { status: 'SENT', expiresAt: { lt: now } },
    data: { status: 'EXPIRED', updatedAt: now },
  })

  // ── 2. Expiry warnings (≤3 days left, not yet warned) ────────────────
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000)
  const expiring = await prisma.quote.findMany({
    where: {
      status: 'SENT',
      expiryWarnedAt: null,
      customerEmail: { not: null },
      shareToken: { not: null },
      expiresAt: { gt: now, lte: soon },
    },
    select: {
      id: true,
      quoteNumber: true,
      customerName: true,
      customerEmail: true,
      shareToken: true,
      expiresAt: true,
    },
    take: 50, // safety cap per run; the cron is daily and idempotent
  })

  let warned = 0
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  if (apiKey && from && expiring.length > 0) {
    const resend = new Resend(apiKey)
    for (const q of expiring) {
      const daysLeft = Math.max(
        1,
        Math.ceil((q.expiresAt!.getTime() - now.getTime()) / 86400000)
      )
      const url = `${appUrl()}/q/${q.shareToken}`
      try {
        await resend.emails.send({
          from,
          to: q.customerEmail!,
          subject: `Votre offre I.ON Energy expire dans ${daysLeft} jour${daysLeft > 1 ? 's' : ''}`,
          html: `
            <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
              <p style="font-size: 15px; color: #111827; line-height: 1.5;">
                Bonjour${q.customerName ? ` ${q.customerName}` : ''},
              </p>
              <p style="font-size: 15px; color: #111827; line-height: 1.5;">
                Votre offre <strong>${q.quoteNumber}</strong> est encore valable
                ${daysLeft > 1 ? `${daysLeft} jours` : `jusqu’à demain`}.
                Passé ce délai, les prix et subventions indiqués ne seront plus garantis.
              </p>
              <p style="margin: 28px 0;">
                <a href="${url}"
                   style="background: #d92127; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
                  Consulter et accepter l’offre
                </a>
              </p>
              <p style="font-size: 12px; color: #9ca3af;">
                Une question ? Répondez simplement à cet e-mail — votre conseiller I.ON Energy vous recontacte.
              </p>
            </div>
          `,
        })
        await prisma.quote.update({
          where: { id: q.id },
          data: { expiryWarnedAt: now },
        })
        warned++
      } catch (err) {
        // Log and continue — one bounce must not block the batch. Not
        // stamped, so it retries tomorrow.
        console.error('[cron/daily] warning email failed', q.quoteNumber, err)
      }
    }
  }

  return NextResponse.json({ ok: true, expired: expired.count, warned })
}
