/**
 * POST /api/ai/parse-project
 *
 * Body: { scenarioType: 'PV' | 'PAC', description: string }
 * Returns: AiParseResult (see lib/ai/parse-project.ts)
 *
 * Auth: any authenticated user.
 * Rate limit: 50 calls per user per day (in-memory; reset on cold start —
 * acceptable for now since Vercel cold-starts our routes regularly).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { parseProjectDescription } from '@/lib/ai/parse-project'

const Schema = z.object({
  scenarioType: z.enum(['PV', 'PAC']),
  description: z.string().min(5).max(2000),
})

// Per-user daily call counts. Map user id → { count, resetAt }.
const RATE_LIMIT_PER_DAY = 50
const counts = new Map<string, { count: number; resetAt: number }>()

function checkAndIncrementRate(userId: string): { ok: boolean; remaining: number } {
  const now = Date.now()
  const tomorrow = now + 24 * 60 * 60 * 1000
  const entry = counts.get(userId)
  if (!entry || now >= entry.resetAt) {
    counts.set(userId, { count: 1, resetAt: tomorrow })
    return { ok: true, remaining: RATE_LIMIT_PER_DAY - 1 }
  }
  if (entry.count >= RATE_LIMIT_PER_DAY) {
    return { ok: false, remaining: 0 }
  }
  entry.count++
  return { ok: true, remaining: RATE_LIMIT_PER_DAY - entry.count }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await req.json()
    const { scenarioType, description } = Schema.parse(body)

    // Rate limit
    const { ok, remaining } = checkAndIncrementRate(session.user.id)
    if (!ok) {
      return NextResponse.json(
        {
          error:
            "Limite quotidienne atteinte (50 appels/jour). Réessayez demain ou écrivez la liste des produits manuellement.",
        },
        { status: 429 }
      )
    }

    const start = Date.now()
    const result = await parseProjectDescription({ scenarioType, description })
    const ms = Date.now() - start

    // Log token usage for monitoring (visible in Vercel logs)
    console.log(
      `[ai/parse-project] user=${session.user.id} type=${scenarioType} items=${result.items.length} tokens=${result.tokensUsed} ms=${ms} remaining=${remaining}`
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/ai/parse-project]', err)
    const message =
      err instanceof Error
        ? err.message
        : "Erreur lors de la génération."
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
