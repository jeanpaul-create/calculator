import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { z } from 'zod'

const UpdateOptionSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  costRappen: z.number().int().min(0).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
})

type Params = { params: { id: string } }

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = UpdateOptionSchema.parse(body)

    const option = await prisma.costOption.update({ where: { id: params.id }, data })
    return NextResponse.json(option)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()
    await prisma.costOption.update({ where: { id: params.id }, data: { active: false } })
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Response) return err
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
