import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { calculatePrice } from '@/lib/pricing'
import { z } from 'zod'

const ScenarioItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().min(1),
})

const ScenarioOptionSchema = z.object({
  optionId: z.string().cuid(),
})

const SaveScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  marginBasisPts: z.number().int().min(0).max(9999),
  items: z.array(ScenarioItemSchema),
  options: z.array(ScenarioOptionSchema).optional(),
})

type Params = { params: { id: string } }

// GET /api/quotes/[id] — get full quote with scenarios and items
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        rep: { select: { name: true, email: true } },
        scenarios: {
          orderBy: { sortOrder: 'asc' },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, category: true, powerWp: true },
                },
              },
            },
            options: {
              include: {
                option: {
                  select: { id: true, name: true, description: true },
                },
              },
            },
          },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    return NextResponse.json(quote)
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[GET /api/quotes/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// PUT /api/quotes/[id] — save/update a scenario with snapshotted costs
export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { repId: true },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    const body = await req.json()
    const data = SaveScenarioSchema.parse(body)

    // Fetch app settings: VAT + min margin (required — crash loudly if missing)
    const settings = await prisma.setting.findMany({
      where: { key: { in: ['vat_pct_basis_pts', 'min_margin_basis_pts'] } },
    })
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
    const vatBasisPts = settingsMap['vat_pct_basis_pts']
    const minMarginBasisPts = settingsMap['min_margin_basis_pts']

    if (vatBasisPts == null || minMarginBasisPts == null) {
      console.error('[PUT /api/quotes/[id]] Missing settings: vat_pct_basis_pts or min_margin_basis_pts')
      return NextResponse.json(
        { error: 'App settings not configured. Contact your administrator.' },
        { status: 500 }
      )
    }

    // Enforce minimum margin server-side
    if (data.marginBasisPts < minMarginBasisPts) {
      return NextResponse.json(
        {
          error: `Margin too low. Minimum is ${minMarginBasisPts / 100}%.`,
          minMarginBasisPts,
        },
        { status: 422 }
      )
    }

    // Resolve product costs for snapshot
    const productIds = data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: { id: true, costRappen: true },
    })
    const productCostMap = Object.fromEntries(products.map((p) => [p.id, p.costRappen]))

    // Verify all products exist and are active
    const missingProducts = productIds.filter((id) => !productCostMap[id])
    if (missingProducts.length > 0) {
      return NextResponse.json(
        { error: `Products not found or inactive: ${missingProducts.join(', ')}` },
        { status: 422 }
      )
    }

    // Resolve cost option costs for snapshot
    const optionIds = (data.options ?? []).map((o) => o.optionId)
    const optionCostMap: Record<string, number> = {}
    if (optionIds.length > 0) {
      const options = await prisma.costOption.findMany({
        where: { id: { in: optionIds }, active: true },
        select: { id: true, costRappen: true },
      })
      for (const o of options) optionCostMap[o.id] = o.costRappen

      const missingOptions = optionIds.filter((id) => !optionCostMap[id])
      if (missingOptions.length > 0) {
        return NextResponse.json(
          { error: `Options not found or inactive: ${missingOptions.join(', ')}` },
          { status: 422 }
        )
      }
    }

    // Resolve canton rate
    let rateRappenPerKwh: number | null = null
    if (quote) {
      const fullQuote = await prisma.quote.findUnique({
        where: { id: params.id },
        select: { customerZip: true },
      })
      if (fullQuote?.customerZip) {
        const zipPrefix = fullQuote.customerZip.slice(0, 2)
        const rate = await prisma.swissRate.findFirst({
          where: { zipPrefix },
          select: { rateRappenPerKwh: true },
        })
        rateRappenPerKwh = rate?.rateRappenPerKwh ?? null
      }
    }

    // Delete existing scenario for this quote (one scenario per quote in Phase 1)
    // In Phase 2 multi-scenario: create/update by scenario ID
    await prisma.quoteScenario.deleteMany({ where: { quoteId: params.id } })

    // Create new scenario with snapshotted costs
    const scenario = await prisma.quoteScenario.create({
      data: {
        quoteId: params.id,
        name: data.name ?? 'Szenario 1',
        marginBasisPts: data.marginBasisPts,
        vatPctBasisPts: vatBasisPts,
        rateRappenPerKwh,
        items: {
          create: data.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            costRappenSnapshot: productCostMap[item.productId],
          })),
        },
        options: {
          create: (data.options ?? []).map((opt) => ({
            optionId: opt.optionId,
            costRappenSnapshot: optionCostMap[opt.optionId],
          })),
        },
      },
      include: {
        items: true,
        options: true,
      },
    })

    // Compute pricing summary for response (using snapshotted values)
    const pricingItems = [
      ...scenario.items.map((i) => ({
        costRappen: i.costRappenSnapshot,
        quantity: i.quantity,
      })),
      ...scenario.options.map((o) => ({
        costRappen: o.costRappenSnapshot,
        quantity: 1,
      })),
    ]

    const pricing = calculatePrice({
      items: pricingItems,
      marginBasisPts: data.marginBasisPts,
      vatBasisPts,
    })

    // Update quote status to DRAFT if it was somehow not
    await prisma.quote.update({
      where: { id: params.id },
      data: { updatedAt: new Date() },
    })

    return NextResponse.json({ scenario, pricing })
  } catch (err) {
    if (err instanceof Response) return err
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors }, { status: 422 })
    }
    console.error('[PUT /api/quotes/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}

// DELETE /api/quotes/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const quote = await prisma.quote.findUnique({
      where: { id: params.id },
      select: { repId: true },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)
    await prisma.quote.delete({ where: { id: params.id } })

    return new NextResponse(null, { status: 204 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[DELETE /api/quotes/[id]]', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
