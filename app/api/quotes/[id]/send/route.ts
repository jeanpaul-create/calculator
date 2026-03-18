import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { Resend } from 'resend'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { getFullQuoteForPdf, buildPricedScenarios } from '@/lib/quote-pdf'
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote, scenarios }) as any
    )

    const resend = new Resend(apiKey)

    const customerName = quote.customerName ?? 'Client'
    const subject = `Votre offre photovoltaïque — ${quote.quoteNumber}`

    const { error: resendError } = await resend.emails.send({
      from: fromEmail,
      to: quote.customerEmail,
      subject,
      html: `
        <p>Bonjour ${customerName},</p>
        <p>Veuillez trouver ci-joint votre offre commerciale <strong>${quote.quoteNumber}</strong> pour l'installation de votre système photovoltaïque.</p>
        <p>N'hésitez pas à nous contacter pour toute question.</p>
        <p>Cordialement,<br>I.ON Energy Services</p>
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
    prisma.quote
      .update({
        where: { id: params.id, status: 'DRAFT' },
        data: { status: 'SENT' },
      })
      .catch((err) => console.error('[send/route] status update failed', err))

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[POST /api/quotes/[id]/send]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
