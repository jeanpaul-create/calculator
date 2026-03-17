import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const UpdateSettingsSchema = z.object({
  vat_pct_basis_pts: z.number().int().min(0).max(3000).optional(),
  min_margin_basis_pts: z.number().int().min(0).max(9999).optional(),
})

// GET /api/settings — returns VAT and min margin (any authenticated user can read)
export async function GET(_req: NextRequest) {
  try {
    await requireAuth()

    const settings = await prisma.setting.findMany({
      where: { key: { in: ['vat_pct_basis_pts', 'min_margin_basis_pts'] } },
    })

    const result = Object.fromEntries(
      settings.map((s) => [s.key, parseInt(s.value)])
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/settings — admin only
export async function PUT(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = UpdateSettingsSchema.parse(body)

    await Promise.all(
      Object.entries(data)
        .filter(([, v]) => v !== undefined)
        .map(([key, value]) =>
          prisma.setting.upsert({
            where: { key },
            update: { value: String(value) },
            create: { key, value: String(value) },
          })
        )
    )

    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
