import { prisma } from '@/lib/db'

/**
 * Generate the next human-readable quote number via a Postgres sequence.
 * Format: QUO-YYYY-NNNN (e.g. QUO-2026-0001)
 *
 * The sequence is created once via a migration or the first call.
 * Using nextval() is atomic — no race conditions possible.
 */
export async function generateQuoteNumber(): Promise<string> {
  // Ensure the sequence exists (idempotent)
  await prisma.$executeRawUnsafe(`
    CREATE SEQUENCE IF NOT EXISTS quote_number_seq
    START WITH 1 INCREMENT BY 1 NO CYCLE
  `)

  const result = await prisma.$queryRaw<[{ nextval: bigint }]>`
    SELECT nextval('quote_number_seq')
  `
  const seq = Number(result[0].nextval)
  const year = new Date().getFullYear()
  const padded = String(seq).padStart(4, '0')
  return `QUO-${year}-${padded}`
}
