/**
 * shareToken backfill (one-shot, idempotent).
 *
 * Background: until A1, the public quote URL was /q/{Quote.id}. To support
 * revocation we introduced a separate `shareToken` column. Existing quotes
 * already have URLs in the wild (sent via email) keyed by their `id` — we
 * preserve them by setting `shareToken = id` for non-DRAFT quotes that don't
 * yet have a token. Future SENT transitions generate cryptographically
 * random tokens via crypto.randomBytes(16).toString('hex').
 *
 * Safe to re-run: skips quotes that already have a shareToken set.
 *
 * Runs as part of `prisma db push && tsx prisma/backfill-customers.ts &&
 * tsx prisma/backfill-share-tokens.ts` during the Vercel build step.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find non-DRAFT quotes without a shareToken. DRAFT quotes don't need a
  // token (they're never publicly accessible).
  const quotes = await prisma.quote.findMany({
    where: {
      shareToken: null,
      status: { not: 'DRAFT' },
    },
    select: { id: true },
  })

  if (quotes.length === 0) {
    console.log('[backfill-share-tokens] No quotes need backfill — done.')
    return
  }

  console.log(`[backfill-share-tokens] Backfilling ${quotes.length} quote(s)…`)

  // Set shareToken = id for legacy quotes so existing email links keep working.
  // The cuid is unguessable enough for grandfathering; new tokens will be
  // crypto-random hex.
  let updated = 0
  for (const q of quotes) {
    try {
      await prisma.quote.update({
        where: { id: q.id },
        data: { shareToken: q.id },
      })
      updated++
    } catch (err) {
      // Unique constraint violation theoretically possible if some other quote
      // already has shareToken === this.id — log and skip.
      console.error(`[backfill-share-tokens]   skip ${q.id}: ${(err as Error).message}`)
    }
  }

  console.log(`[backfill-share-tokens] Done. Updated ${updated} quote(s).`)
}

main()
  .catch((err) => {
    console.error('[backfill-share-tokens] FAILED:', err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
