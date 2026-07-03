/**
 * Rep notification emails — fired when the customer interacts with a quote:
 *   'viewed'   → first open of the public /q/ link (once per quote)
 *   'accepted' → customer clicked « Accepter »
 *   'declined' → customer clicked « Refuser »
 *
 * Fire-and-forget by design: call sites never await the outcome and a failure
 * must never affect the customer-facing request. All guards are internal —
 * missing env config or a missing rep email silently no-ops.
 */

import { Resend } from 'resend'
import { prisma } from '@/lib/db'

export type RepNotifyEvent = 'viewed' | 'accepted' | 'declined'

function appUrl(): string {
  return (
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://calculatorsolarch.vercel.app')
  )
}

export async function notifyRep(quoteId: string, event: RepNotifyEvent): Promise<void> {
  try {
    const apiKey = process.env.RESEND_API_KEY
    const from = process.env.RESEND_FROM_EMAIL
    if (!apiKey || !from) return

    const quote = await prisma.quote.findUnique({
      where: { id: quoteId },
      select: {
        quoteNumber: true,
        customerName: true,
        viewCount: true,
        rep: { select: { email: true, name: true } },
      },
    })
    if (!quote?.rep?.email) return

    const customer = quote.customerName ?? 'Votre client'
    const quoteUrl = `${appUrl()}/quotes/${quoteId}`

    const content: Record<RepNotifyEvent, { subject: string; lead: string; cta: string }> = {
      viewed: {
        subject: `👀 ${customer} a ouvert l’offre ${quote.quoteNumber}`,
        lead: `${customer} vient d’ouvrir votre offre pour la première fois. C’est le meilleur moment pour un appel de suivi.`,
        cta: 'Voir l’offre et l’engagement',
      },
      accepted: {
        subject: `✅ Offre ${quote.quoteNumber} acceptée par ${customer}`,
        lead: `${customer} a accepté votre offre en ligne. Prochaine étape : confirmer le rendez-vous de signature.`,
        cta: 'Ouvrir l’offre acceptée',
      },
      declined: {
        subject: `❌ Offre ${quote.quoteNumber} refusée par ${customer}`,
        lead: `${customer} a refusé l’offre en ligne. Le motif éventuel est visible sur la fiche — un appel peut encore retourner la situation.`,
        cta: 'Voir le détail et le motif',
      },
    }
    const c = content[event]

    const resend = new Resend(apiKey)
    await resend.emails.send({
      from,
      to: quote.rep.email,
      subject: c.subject,
      html: `
        <div style="font-family: -apple-system, Segoe UI, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
          <p style="font-size: 15px; color: #111827; line-height: 1.5;">
            Bonjour ${quote.rep.name ?? ''},
          </p>
          <p style="font-size: 15px; color: #111827; line-height: 1.5;">${c.lead}</p>
          <p style="margin: 28px 0;">
            <a href="${quoteUrl}"
               style="background: #d92127; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; font-size: 14px;">
              ${c.cta}
            </a>
          </p>
          <p style="font-size: 12px; color: #9ca3af;">
            Offre ${quote.quoteNumber} — notification automatique I.ON Energy.
          </p>
        </div>
      `,
    })
  } catch (err) {
    // Never let a notification failure surface to the customer request.
    console.error('[notify-rep]', event, err)
  }
}
