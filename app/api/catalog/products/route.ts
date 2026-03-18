import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireAuth, requireAdmin } from '@/lib/auth'
import { ProductCategory } from '@prisma/client'
import { z } from 'zod'

const CreateProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.nativeEnum(ProductCategory),
  costRappen: z.number().int().min(0),
  powerWp: z.number().int().positive().optional(),
})

// GET /api/catalog/products — all active products (any authenticated user)
// ?all=1 returns including inactive (admin only)
export async function GET(req: NextRequest) {
  try {
    const session = await requireAuth()
    const showAll = req.nextUrl.searchParams.get('all') === '1' && session.user.role === 'ADMIN'

    const products = await prisma.product.findMany({
      where: showAll ? undefined : { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    })

    return NextResponse.json(products)
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/catalog/products]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// POST /api/catalog/products — admin only
export async function POST(req: NextRequest) {
  try {
    await requireAdmin()

    const body = await req.json()
    const data = CreateProductSchema.parse(body)

    const product = await prisma.product.create({ data })
    return NextResponse.json(product, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[POST /api/catalog/products]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
