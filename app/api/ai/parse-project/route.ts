/**
 * POST /api/ai/parse-project
 *
 * Body: { scenarioType: 'PV' | 'PAC', description: string }
 * Returns: AiParseResult (see lib/ai/parse-project.ts)
 *
 * Auth: any authenticated user.
 * Rate limit: 50 calls per user per day (DB-backed via lib/rate-limit.ts so
 * the limit survives Vercel cold starts and is shared across instances).
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth'
import { parseProjectDescription } from '@/lib/ai/parse-project'
import { enforceRateLimit } from '@/lib/rate-limit'

const Schema = z.object({
  scenarioType: z.enum(['PV', 'PAC']),
  description: z.string().min(5).max(2000),
})

const RATE_LIMIT_PER_DAY = 50
const ONE_DAY_MS = 24 * 60 * 60 * 1000

export async function POST(req: NextRequest) {
  try {
    const session = await requireAuth()

    const body = await req.json()
    const { scenarioType, description } = Schema.parse(body)

    // Rate limit — per-user, per-day (DB-backed)
    const { ok, remaining } = await enforceRateLimit({
      key: `ai:user:${session.user.id}`,
      windowMs: ONE_DAY_MS,
      max: RATE_LIMIT_PER_DAY,
    })
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
      `[ai/parse-project] user=${session.user.id} type=${scenarioType} proposals=${result.proposals.length} tokens=${result.tokensUsed} ms=${ms} remaining=${remaining}`
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
