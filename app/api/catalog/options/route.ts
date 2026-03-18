import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const CreateOptionSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  costRappen: z.number().int().min(0),
  sortOrder: z.number().int().optional(),
})

// GET /api/catalog/options — active options (any authenticated user)
// ?all=1 returns including inactive (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const showAll = req.nextUrl.searchParams.get('all') === '1' && session.user.role === 'ADMIN'

    const options = await prisma.costOption.findMany({
      where: showAll ? undefined : { active: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(options)
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = CreateOptionSchema.parse(body)

    const option = await prisma.costOption.create({ data })
    return NextResponse.json(option, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
