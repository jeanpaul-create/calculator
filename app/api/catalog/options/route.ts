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

export async function GET(_req: NextRequest) {
  try {
    await requireAuth()

    const options = await prisma.costOption.findMany({
      where: { active: true },
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
