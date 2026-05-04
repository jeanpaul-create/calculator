/**
 * DB-backed rate limiter shared by API routes.
 *
 *   Why DB-backed?
 *   The previous per-route in-memory `Map<key,{count,resetAt}>` reset on every
 *   Vercel cold start, so a "50 calls per day" promise wasn't actually
 *   enforced — a determined caller (or a bug) could cycle through fresh
 *   workers and exceed the limit. The DB-backed counter survives cold starts
 *   and is shared across concurrent Lambda instances.
 *
 *   Architecture (ASCII):
 *
 *     route ──> enforceRateLimit({ key, windowMs, max })
 *                       │
 *                       ├─► fetch RateBucket (key)
 *                       │
 *                       └─► decideRateLimit(bucket, now, windowMs, max)
 *                                     │
 *                                     ├─► reset    : new window, count=1
 *                                     ├─► increment: count++
 *                                     └─► deny     : 429
 *                                     │
 *                                     ▼
 *                            { ok, remaining, resetAt }
 *
 *   The decision is split into a pure `decideRateLimit()` function so the
 *   logic can be unit-tested without DB. The effectful `enforceRateLimit()`
 *   wraps it in a transaction to avoid race conditions when two concurrent
 *   calls arrive at the limit boundary.
 */

import { prisma } from '@/lib/db'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RateLimitArgs {
  /**
   * Composite key — convention is `{namespace}:{identifier}`. Examples:
   *   "ai:user:cmf9..."     — per-user AI parse calls
   *   "respond:tok:abc..."  — per-token public-quote respond
   */
  key: string
  /** Window length in milliseconds. */
  windowMs: number
  /** Max requests allowed within the window. */
  max: number
}

export interface RateLimitResult {
  /** True if the call is allowed; false if denied (caller should return 429). */
  ok: boolean
  /** Remaining calls in the current window after this one is counted. */
  remaining: number
  /** When the window resets (used to compute Retry-After headers if desired). */
  resetAt: Date
}

interface BucketSnapshot {
  count: number
  resetAt: Date
}

type Decision =
  | { action: 'reset'; remaining: number; resetAt: Date }
  | { action: 'increment'; remaining: number; resetAt: Date }
  | { action: 'deny'; remaining: 0; resetAt: Date }

// ─── Pure decision (unit-testable) ────────────────────────────────────────────

/**
 * Decide what to do given the current bucket state. Pure — no I/O.
 *
 * @param bucket  Existing bucket, or null if none exists for this key.
 * @param now     Current time (caller-supplied for deterministic tests).
 * @param windowMs Window length in ms.
 * @param max     Max calls allowed in the window.
 */
export function decideRateLimit(
  bucket: BucketSnapshot | null,
  now: Date,
  windowMs: number,
  max: number
): Decision {
  // No bucket OR window has elapsed → start a new window.
  if (!bucket || bucket.resetAt.getTime() <= now.getTime()) {
    const resetAt = new Date(now.getTime() + windowMs)
    return { action: 'reset', remaining: max - 1, resetAt }
  }

  // At or above the cap → deny.
  if (bucket.count >= max) {
    return { action: 'deny', remaining: 0, resetAt: bucket.resetAt }
  }

  // Otherwise increment within the existing window.
  return {
    action: 'increment',
    remaining: max - bucket.count - 1,
    resetAt: bucket.resetAt,
  }
}

// ─── Effectful wrapper (Prisma) ───────────────────────────────────────────────

/**
 * Atomic check-and-increment for the given key. Uses a transaction so two
 * concurrent calls arriving at the cap can't both pass through.
 *
 * Returns { ok, remaining, resetAt } — caller returns 429 if !ok.
 */
export async function enforceRateLimit(
  args: RateLimitArgs
): Promise<RateLimitResult> {
  const { key, windowMs, max } = args
  const now = new Date()

  return prisma.$transaction(async (tx) => {
    const bucket = await tx.rateBucket.findUnique({ where: { key } })
    const decision = decideRateLimit(
      bucket ? { count: bucket.count, resetAt: bucket.resetAt } : null,
      now,
      windowMs,
      max
    )

    switch (decision.action) {
      case 'reset':
        await tx.rateBucket.upsert({
          where: { key },
          create: { key, count: 1, resetAt: decision.resetAt },
          update: { count: 1, resetAt: decision.resetAt },
        })
        return { ok: true, remaining: decision.remaining, resetAt: decision.resetAt }

      case 'increment':
        await tx.rateBucket.update({
          where: { key },
          data: { count: { increment: 1 } },
        })
        return { ok: true, remaining: decision.remaining, resetAt: decision.resetAt }

      case 'deny':
        return { ok: false, remaining: 0, resetAt: decision.resetAt }
    }
  })
}
