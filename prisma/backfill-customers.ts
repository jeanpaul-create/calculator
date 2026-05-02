/**
 * Customer extraction backfill (one-shot, idempotent).
 *
 * Reads every Quote that has no customerId, groups them by
 * (customerEmail || customerName+customerZip), creates one Customer per
 * group, then links the Quote.customerId FK.
 *
 * Safe to re-run: skips quotes that already have customerId, and reuses
 * existing Customer rows when the dedup key matches.
 *
 * Runs as part of `prisma db push && tsx prisma/backfill-customers.ts`
 * during the Vercel build step.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Dedup key: prefer email (lowercase, trimmed); fall back to name+zip combo;
// final fallback to name alone. Returns null if no usable identifier.
function dedupKey(q: {
  customerEmail: string | null
  customerName: string | null
  customerZip: string | null
}): string | null {
  if (q.customerEmail && q.customerEmail.trim()) {
    return `e:${q.customerEmail.trim().toLowerCase()}`
  }
  if (q.customerName && q.customerName.trim()) {
    const nm = q.customerName.trim().toLowerCase()
    return q.customerZip ? `nz:${nm}|${q.customerZip.trim()}` : `n:${nm}`
  }
  return null
}

async function main() {
  const quotes = await prisma.quote.findMany({
    where: { customerId: null },
    select: {
      id: true,
      customerName: true,
      customerEmail: true,
      customerPhone: true,
      customerZip: true,
      customerCanton: true,
    },
  })

  if (quotes.length === 0) {
    console.log('[backfill-customers] No quotes need backfill — done.')
    return
  }

  console.log(`[backfill-customers] Backfilling ${quotes.length} quote(s)…`)

  type QuoteRow = (typeof quotes)[number]

  // Group quotes by dedup key. Quotes with no usable identifier get their own
  // anonymous Customer (one per quote) so we never lose data.
  const groups = new Map<string, QuoteRow[]>()
  const anonymous: QuoteRow[] = []

  for (const q of quotes) {
    const key = dedupKey(q)
    if (!key) {
      anonymous.push(q)
      continue
    }
    const existing = groups.get(key) ?? []
    existing.push(q)
    groups.set(key, existing)
  }

  let created = 0
  let reused = 0
  let linked = 0

  // Process named groups
  for (const [key, group] of Array.from(groups.entries())) {
    // Pick the most "complete" record as the canonical Customer source —
    // prefer one with email, phone, full address.
    const score = (q: QuoteRow) =>
      (q.customerEmail ? 4 : 0) +
      (q.customerPhone ? 2 : 0) +
      (q.customerZip ? 1 : 0) +
      (q.customerCanton ? 1 : 0)
    const best = group.reduce((a: QuoteRow, b: QuoteRow) =>
      score(b) > score(a) ? b : a
    )

    // Try to reuse an existing Customer by email match
    let customerId: string | null = null
    if (best.customerEmail) {
      const existing = await prisma.customer.findFirst({
        where: { email: best.customerEmail.trim().toLowerCase() },
      })
      if (existing) {
        customerId = existing.id
        reused++
      }
    }

    if (!customerId) {
      const customer = await prisma.customer.create({
        data: {
          name: best.customerName?.trim() || '(Sans nom)',
          email: best.customerEmail?.trim().toLowerCase() || null,
          phone: best.customerPhone?.trim() || null,
          zip: best.customerZip?.trim() || null,
          canton: best.customerCanton?.trim() || null,
        },
      })
      customerId = customer.id
      created++
    }

    // Link every quote in the group to this customer
    await prisma.quote.updateMany({
      where: { id: { in: group.map((q: QuoteRow) => q.id) } },
      data: { customerId },
    })
    linked += group.length
    console.log(`[backfill-customers]   "${key}" → ${customerId} (${group.length} quote(s))`)
  }

  // Anonymous quotes — one Customer each, named "(Sans nom)"
  for (const q of anonymous) {
    const customer = await prisma.customer.create({
      data: {
        name: '(Sans nom)',
        zip: q.customerZip?.trim() || null,
        canton: q.customerCanton?.trim() || null,
      },
    })
    await prisma.quote.update({
      where: { id: q.id },
      data: { customerId: customer.id },
    })
    created++
    linked++
  }

  console.log(
    `[backfill-customers] Done. Created ${created} customer(s), reused ${reused}, linked ${linked} quote(s).`
  )
}

main()
  .catch((err) => {
    console.error('[backfill-customers] FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
