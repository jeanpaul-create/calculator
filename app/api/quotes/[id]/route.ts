import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { calculateIonPrice, DEFAULT_ION_COEFFICIENTS, IonPricingCoefficients, RoofType, RoofSlope } from '@/lib/pricing'
import { z } from 'zod'

const ScenarioItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
})

const ScenarioOptionSchema = z.object({
  optionId: z.string().min(1),
})

const SaveScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  marginBasisPts: z.number().int().min(0).max(9999),
  items: z.array(ScenarioItemSchema),
  options: z.array(ScenarioOptionSchema).optional(),
  roofType: z.enum(['tuile', 'ardoise', 'bac_acier', 'plat']).optional(),
  roofSlope: z.enum(['simple', 'moyen', 'complexe']).optional(),
  // Optional project info update
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  siteAddress: z.string().optional(),
  notes: z.string().optional(),
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
      select: { repId: true, customerZip: true },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }

    await requireOwnerOrAdmin(quote.repId)

    const body = await req.json()
    const data = SaveScenarioSchema.parse(body)

    // Fetch all app settings including pricing coefficients
    const settings = await prisma.setting.findMany({
      where: {
        key: {
          in: [
            'vat_pct_basis_pts',
            'min_margin_basis_pts',
            'pv_accessories_bps',
            'pv_frais_supp_bps',
            'pv_transport_bps',
            'pv_labor_panel_rappen',
            'pv_labor_inverter_rappen',
            'pv_raccordement_mat_rappen',
            'pv_raccordement_labor_rappen',
            'pv_pm_fixed_rappen',
            'pv_admin_fixed_rappen',
            'pv_sales_overhead_bps',
            'pv_profit_appro_bps',
            'pv_profit_constr_bps',
            'bat_pm_bps',
            'bat_admin_bps',
            'bat_profit_bps',
            'mount_tuile_rappen',
            'mount_ardoise_rappen',
            'mount_bac_acier_rappen',
            'mount_plat_rappen',
            'mount_slope_medium_bps',
            'mount_slope_steep_bps',
          ],
        },
      },
    })
    const settingsMap = Object.fromEntries(settings.map((s) => [s.key, parseInt(s.value)]))
    const vatBasisPts = settingsMap['vat_pct_basis_pts']

    if (vatBasisPts == null) {
      console.error('[PUT /api/quotes/[id]] Missing settings: vat_pct_basis_pts')
      return NextResponse.json(
        { error: 'App settings not configured. Contact your administrator.' },
        { status: 500 }
      )
    }

    // Build pricing coefficients from settings (fall back to defaults if not set)
    const ionCoefficients: IonPricingCoefficients = {
      pv_accessories_bps: settingsMap['pv_accessories_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_accessories_bps,
      pv_frais_supp_bps: settingsMap['pv_frais_supp_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_frais_supp_bps,
      pv_transport_bps: settingsMap['pv_transport_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_transport_bps,
      pv_labor_panel_rappen: settingsMap['pv_labor_panel_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_panel_rappen,
      pv_labor_inverter_rappen: settingsMap['pv_labor_inverter_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_labor_inverter_rappen,
      pv_raccordement_mat_rappen: settingsMap['pv_raccordement_mat_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_mat_rappen,
      pv_raccordement_labor_rappen: settingsMap['pv_raccordement_labor_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_raccordement_labor_rappen,
      pv_pm_fixed_rappen: settingsMap['pv_pm_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_pm_fixed_rappen,
      pv_admin_fixed_rappen: settingsMap['pv_admin_fixed_rappen'] ?? DEFAULT_ION_COEFFICIENTS.pv_admin_fixed_rappen,
      pv_sales_overhead_bps: settingsMap['pv_sales_overhead_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_sales_overhead_bps,
      pv_profit_appro_bps: settingsMap['pv_profit_appro_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_appro_bps,
      pv_profit_constr_bps: settingsMap['pv_profit_constr_bps'] ?? DEFAULT_ION_COEFFICIENTS.pv_profit_constr_bps,
      bat_pm_bps: settingsMap['bat_pm_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_pm_bps,
      bat_admin_bps: settingsMap['bat_admin_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_admin_bps,
      bat_profit_bps: settingsMap['bat_profit_bps'] ?? DEFAULT_ION_COEFFICIENTS.bat_profit_bps,
      mount_tuile_rappen: settingsMap['mount_tuile_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_tuile_rappen,
      mount_ardoise_rappen: settingsMap['mount_ardoise_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_ardoise_rappen,
      mount_bac_acier_rappen: settingsMap['mount_bac_acier_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_bac_acier_rappen,
      mount_plat_rappen: settingsMap['mount_plat_rappen'] ?? DEFAULT_ION_COEFFICIENTS.mount_plat_rappen,
      mount_slope_medium_bps: settingsMap['mount_slope_medium_bps'] ?? DEFAULT_ION_COEFFICIENTS.mount_slope_medium_bps,
      mount_slope_steep_bps: settingsMap['mount_slope_steep_bps'] ?? DEFAULT_ION_COEFFICIENTS.mount_slope_steep_bps,
      vatBasisPts,
    }

    // Resolve product costs and categories for snapshot
    const productIds = data.items.map((i) => i.productId)
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
      select: { id: true, costRappen: true, category: true },
    })
    const productCostMap = Object.fromEntries(products.map((p) => [p.id, p.costRappen]))
    const productCategoryMap = Object.fromEntries(products.map((p) => [p.id, p.category]))

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
    if (quote.customerZip) {
      const zipPrefix = quote.customerZip.slice(0, 2)
      const rate = await prisma.swissRate.findFirst({
        where: { zipPrefix },
        select: { rateRappenPerKwh: true },
      })
      rateRappenPerKwh = rate?.rateRappenPerKwh ?? null
    }

    // Compute pricing using the I.ON Energy model (before saving — we need effectiveMarginBasisPts)
    type ProductCategory = 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'
    const ionProducts = data.items.map((item) => ({
      category: productCategoryMap[item.productId] as ProductCategory,
      costRappen: productCostMap[item.productId],
      quantity: item.quantity,
    }))
    const ionOptions = (data.options ?? []).map((opt) => ({
      costRappen: optionCostMap[opt.optionId],
    }))
    const pricing = calculateIonPrice(ionProducts, ionOptions, ionCoefficients,
      (data.roofType ?? 'tuile') as RoofType,
      (data.roofSlope ?? 'simple') as RoofSlope)

    // Atomically replace the scenario (delete old + create new in one transaction)
    // In Phase 2 multi-scenario: create/update by scenario ID
    const scenario = await prisma.$transaction(async (tx) => {
      await tx.quoteScenario.deleteMany({ where: { quoteId: params.id } })
      return tx.quoteScenario.create({
        data: {
          quoteId: params.id,
          name: data.name ?? 'Scénario 1',
          marginBasisPts: pricing.effectiveMarginBasisPts,
          vatPctBasisPts: vatBasisPts,
          rateRappenPerKwh,
          roofType: data.roofType ?? 'tuile',
          roofSlope: data.roofSlope ?? 'simple',
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
    })

    // Update project info if provided
    const infoFields = ['customerName', 'customerEmail', 'customerPhone', 'siteAddress', 'notes'] as const
    const hasInfo = infoFields.some(f => data[f] !== undefined)
    if (hasInfo) {
      await prisma.quote.update({
        where: { id: params.id },
        data: {
          customerName: data.customerName,
          customerEmail: data.customerEmail || null,
          customerPhone: data.customerPhone,
          siteAddress: data.siteAddress,
          notes: data.notes,
          updatedAt: new Date(),
        },
      })
    } else {
      await prisma.quote.update({
        where: { id: params.id },
        data: { updatedAt: new Date() },
      })
    }

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
