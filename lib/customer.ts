/**
 * Customer entity helpers.
 *
 * findOrCreateCustomer dedupes by email (canonical lowercase, trimmed) — if
 * an existing Customer matches, it's returned; otherwise a new row is created.
 * Falls back to (name + zip) match when no email is provided.
 *
 * During Phase 1 transition, callers also continue to write the denormalized
 * customerName/Email/Zip/Canton fields on Quote so older read paths keep
 * working. Those fields will be dropped once all read paths are migrated.
 */

import { prisma } from '@/lib/db'

export interface CustomerInput {
  name?: string | null
  email?: string | null
  phone?: string | null
  zip?: string | null
  canton?: string | null
}

export async function findOrCreateCustomer(
  input: CustomerInput
): Promise<{ id: string; isNew: boolean }> {
  const email = input.email?.trim().toLowerCase() || null
  const name = input.name?.trim() || '(Sans nom)'
  const phone = input.phone?.trim() || null
  const zip = input.zip?.trim() || null
  const canton = input.canton?.trim() || null

  // Best effort dedup: prefer email, fall back to name+zip.
  if (email) {
    const existing = await prisma.customer.findFirst({ where: { email } })
    if (existing) {
      // Backfill any missing fields from the new input (non-destructive — only
      // fills nulls; never overwrites existing data)
      const updates: { phone?: string; zip?: string; canton?: string } = {}
      if (!existing.phone && phone) updates.phone = phone
      if (!existing.zip && zip) updates.zip = zip
      if (!existing.canton && canton) updates.canton = canton
      if (Object.keys(updates).length > 0) {
        await prisma.customer.update({
          where: { id: existing.id },
          data: updates,
        })
      }
      return { id: existing.id, isNew: false }
    }
  } else if (name && zip) {
    const existing = await prisma.customer.findFirst({
      where: { name: { equals: name, mode: 'insensitive' }, zip },
    })
    if (existing) return { id: existing.id, isNew: false }
  }

  const customer = await prisma.customer.create({
    data: { name, email, phone, zip, canton },
  })
  return { id: customer.id, isNew: true }
}
