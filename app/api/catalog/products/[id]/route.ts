import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAdmin } from '@/lib/auth'
import { ProductCategory } from '@prisma/client'
import { z } from 'zod'

const UpdateProductSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.nativeEnum(ProductCategory).optional(),
  costRappen: z.number().int().min(0).optional(),
  powerWp: z.number().int().positive().nullable().optional(),
  active: z.boolean().optional(),
})

type Params = { params: { id: string } }

// PATCH /api/catalog/products/[id] — admin only
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = UpdateProductSchema.parse(body)

    const product = await prisma.product.update({
      where: { id: params.id },
      data,
    })

    return NextResponse.json(product)
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[PATCH /api/catalog/products/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/catalog/products/[id] — soft delete (set active=false)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await requireAdmin()

    await prisma.product.update({
      where: { id: params.id },
      data: { active: false },
    })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[DELETE /api/catalog/products/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
