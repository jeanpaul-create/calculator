import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { Resend } from 'resend'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { getFullQuoteForPdf, buildPricedScenarios, fetchMapImageBase64 } from '@/lib/quote-pdf'
import { prisma } from '@/lib/db'
import QuotePdf from '@/components/pdf/QuotePdf'

type Params = { params: { id: string } }

// POST /api/quotes/[id]/send — generate PDF, email to customer, mark SENT
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const quote = await getFullQuoteForPdf(params.id)

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    if (!quote.customerEmail) {
      return NextResponse.json(
        { error: 'This quote has no customer email address.' },
        { status: 422 }
      )
    }

    const apiKey = process.env.RESEND_API_KEY
    const fromEmail = process.env.RESEND_FROM_EMAIL

    if (!apiKey || !fromEmail) {
      console.error('[send/route] Missing RESEND_API_KEY or RESEND_FROM_EMAIL')
      return NextResponse.json(
        { error: 'Email service not configured. Contact your administrator.' },
        { status: 500 }
      )
    }

    const scenarios = await buildPricedScenarios(quote)

    const mapImageDataUrl =
      quote.mapLat != null && quote.mapLon != null
        ? await fetchMapImageBase64(quote.mapLat, quote.mapLon, quote.mapZoom ?? 17)
        : null

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote, scenarios, mapImageDataUrl }) as any
    )

    const resend = new Resend(apiKey)

    const customerName = quote.customerName ?? 'Client'

    // Detect scenario type for friendlier subject lines.
    const isPac = quote.scenarios[0]?.scenarioType === 'PAC'
    const offerLabel = isPac ? 'pompe à chaleur' : 'photovoltaïque'
    const subject = `Votre offre I.ON Energy — ${quote.quoteNumber}`

    // Resolve the canonical app URL for the public quote link.
    // NEXTAUTH_URL is the authoritative one (set per env). VERCEL_URL is the
    // preview deploy URL — only used as a last-resort fallback.
    const baseUrl =
      process.env.NEXTAUTH_URL?.replace(/\/$/, '') ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://calculatorsolarch.vercel.app')
    const publicQuoteUrl = `${baseUrl}/q/${quote.id}`

    const { error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: quote.customerEmail,
      subject,
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; color: #1c1917; line-height: 1.5;">
          <p style="margin: 0 0 16px 0;">Bonjour ${customerName},</p>

          <p style="margin: 0 0 16px 0;">
            Veuillez trouver ci-joint votre offre commerciale
            <strong>${quote.quoteNumber}</strong> pour votre installation
            ${offerLabel}.
          </p>

          <p style="margin: 0 0 24px 0;">
            Vous pouvez consulter et répondre à l'offre directement en ligne :
          </p>

          <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 24px 0;">
            <tr>
              <td style="background-color: #d92127; border-radius: 6px;">
                <a href="${publicQuoteUrl}"
                   style="display: inline-block; padding: 12px 24px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
                  Voir et accepter l'offre →
                </a>
              </td>
            </tr>
          </table>

          <p style="margin: 0 0 16px 0; font-size: 14px; color: #57534e;">
            Le document PDF est également joint à cet e-mail. N'hésitez pas
            à nous contacter pour toute question.
          </p>

          <p style="margin: 32px 0 0 0; font-size: 14px;">
            Cordialement,<br>
            <strong>I.ON Energy Services</strong>
          </p>

          <p style="margin: 24px 0 0 0; font-size: 11px; color: #a8a29e; border-top: 1px solid #e7e5e4; padding-top: 12px;">
            Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :<br>
            <span style="color: #57534e; word-break: break-all;">${publicQuoteUrl}</span>
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `${quote.quoteNumber}.pdf`,
          content: buffer,
        },
      ],
    })

    if (resendError) {
      console.error('[send/route] Resend error', resendError)
      return NextResponse.json(
        { error: 'Failed to send email. Please try again.' },
        { status: 502 }
      )
    }

    // Fire-and-forget status update
    // Stamps sentAt + expiresAt (sentAt + 30 days) on first SENT transition.
    const sentAt = new Date()
    const expiresAt = new Date(sentAt.getTime() + 30 * 24 * 60 * 60 * 1000)
    prisma.quote
      .update({
        where: { id: params.id, status: 'DRAFT' },
        data: { status: 'SENT', sentAt, expiresAt },
      })
      .catch((err) => console.error('[send/route] status update failed', err))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[POST /api/quotes/[id]/send]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
