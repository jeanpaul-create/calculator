import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import {
  calculateIonPrice, buildIonCoefficientsFromSettings, RoofType, RoofSlope,
  calculatePacPrice, buildPacCoefficientsFromSettings, PAC_SETTING_KEYS,
  applyDiscount,
  bucketIonForCustomer, bucketPacForCustomer, applyDiscountToBreakdown,
  type IonPricingBreakdown, type PacPricingBreakdown, type CustomerFacingBreakdown,
} from '@/lib/pricing'
import { findOrCreateCustomer } from '@/lib/customer'
import { z } from 'zod'

const ScenarioItemSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1),
})

const ScenarioOptionSchema = z.object({
  optionId: z.string().min(1),
})

const TierSchema = z.enum(['essentiel', 'recommande', 'premium'])

/**
 * AI sibling tier — the OTHER tiers from an AI parse the rep didn't apply
 * to the form, persisted as-is alongside the primary scenario for /present/
 * Screen 2. Items only (no options, no rep edits, no discount).
 */
const AiSiblingSchema = z.object({
  tier: TierSchema,
  items: z.array(ScenarioItemSchema).min(1),
})

const SaveScenarioSchema = z.object({
  name: z.string().min(1).optional(),
  scenarioType: z.enum(['PV', 'PAC']).optional(),
  items: z.array(ScenarioItemSchema),
  options: z.array(ScenarioOptionSchema).optional(),
  roofType: z.enum(['tuile', 'ardoise', 'bac_acier', 'plat']).optional(),
  roofSlope: z.enum(['simple', 'moyen', 'complexe']).optional(),
  yieldKwhPerKwp: z.number().int().min(500).max(2000).optional(),
  rateRappenPerKwh: z.number().min(0).max(500).optional(),
  // ROI split fields
  selfConsumptionRatePct: z.number().int().min(0).max(100).optional(),
  feedInRateRappenPerKwh: z.number().int().min(0).max(200).optional(),
  annualConsumptionKwh: z.number().int().min(0).max(1000000).optional(),
  // PAC dimensioning + subsidy context (PAC scenarios only; ignored on PV)
  thermalLoadKw: z.number().min(0.5).max(200).optional(),
  pacType: z.enum(['air-eau', 'sol-eau']).optional(),
  // Rep-chosen discount (0-9999 basis points; saves with requiresApproval flag
  // when the resulting effective margin falls below min_margin_basis_pts)
  discountBasisPts: z.number().int().min(0).max(9999).optional(),
  discountReason: z.string().max(500).optional(),
  // Optional project info update
  customerName: z.string().optional(),
  customerEmail: z.string().email().optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  siteAddress: z.string().optional(),
  notes: z.string().optional(),
  // Map position for aerial view in PDF
  mapLat: z.number().optional(),
  mapLon: z.number().optional(),
  mapZoom: z.number().int().optional(),
  // ─── AI multi-scenario fields (S2) ───
  // When `tier` is set, the primary scenario carries the tier metadata.
  // When `aiSiblings` is set, the handler creates the OTHER tiers as
  // separate scenarios alongside the primary using AI-proposed items.
  // Sibling tiers must be DISJOINT from the primary `tier` (no duplicates).
  // Siblings inherit scenarioType from the primary; no per-sibling
  // scenarioType override (a single AI parse can't span PV+PAC).
  // Discount + rep edits ONLY apply to primary; siblings use AI-proposed
  // pricing as-is. By design — siblings are read-only display data.
  tier: TierSchema.optional(),
  aiSiblings: z.array(AiSiblingSchema).max(2).optional(),
})

/** Sort order derived from tier: essentiel=0, recommande=1, premium=2. */
const TIER_SORT_ORDER: Record<z.infer<typeof TierSchema>, number> = {
  essentiel: 0,
  recommande: 1,
  premium: 2,
}

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

    // ─── AI multi-scenario validation ───
    // siblings without primary tier = nonsense; reject. Sibling tiers must be
    // disjoint from primary. Sibling productIds must respect the scenarioType
    // (e.g., no PAC products on a PV save).
    if (data.aiSiblings && data.aiSiblings.length > 0) {
      if (!data.tier) {
        return NextResponse.json(
          { error: 'aiSiblings provided without a primary tier — primary scenario must declare its tier when siblings are saved.' },
          { status: 422 }
        )
      }
      const siblingTiers = data.aiSiblings.map((s) => s.tier)
      if (new Set(siblingTiers).size !== siblingTiers.length) {
        return NextResponse.json(
          { error: 'aiSiblings contains duplicate tiers — each tier must appear at most once per quote.' },
          { status: 422 }
        )
      }
      if (siblingTiers.includes(data.tier)) {
        return NextResponse.json(
          { error: `aiSiblings tier "${data.tier}" collides with primary tier — siblings must be DIFFERENT tiers from the primary.` },
          { status: 422 }
        )
      }
    }

    // Fetch all app settings including PV and PAC pricing coefficients
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
            ...PAC_SETTING_KEYS,
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
    const ionCoefficients = buildIonCoefficientsFromSettings(settingsMap, vatBasisPts)

    // Resolve product costs, labor, and categories for snapshot.
    // Includes AI sibling productIds so we fetch everything in one query —
    // siblings need the same productCostMap to compute their pricing.
    const primaryProductIds = data.items.map((i) => i.productId)
    const siblingProductIds = (data.aiSiblings ?? []).flatMap((s) =>
      s.items.map((i) => i.productId)
    )
    const allProductIds = Array.from(new Set([...primaryProductIds, ...siblingProductIds]))
    const products = await prisma.product.findMany({
      where: { id: { in: allProductIds }, active: true },
      select: { id: true, costRappen: true, laborRappen: true, category: true },
    })
    const productCostMap = Object.fromEntries(products.map((p) => [p.id, p.costRappen]))
    const productLaborMap = Object.fromEntries(products.map((p) => [p.id, p.laborRappen ?? 0]))
    const productCategoryMap = Object.fromEntries(products.map((p) => [p.id, p.category]))

    // Verify all products exist and are active (across primary + siblings)
    const missingProducts = allProductIds.filter((id) => !productCostMap[id])
    if (missingProducts.length > 0) {
      return NextResponse.json(
        { error: `Products not found or inactive: ${missingProducts.join(', ')}` },
        { status: 422 }
      )
    }

    // Sibling productId category check: a sibling on a PV scenario must not
    // contain PAC products (and vice versa). This catches inconsistent AI
    // proposals before pricing math runs.
    const scenarioTypeForCheck = data.scenarioType ?? 'PV'
    for (const sib of data.aiSiblings ?? []) {
      for (const item of sib.items) {
        const cat = productCategoryMap[item.productId] as string
        const isPac = cat?.startsWith('PAC_')
        if (scenarioTypeForCheck === 'PV' && isPac) {
          return NextResponse.json(
            { error: `Sibling tier "${sib.tier}" contains PAC product ${item.productId} on a PV scenario.` },
            { status: 422 }
          )
        }
        if (scenarioTypeForCheck === 'PAC' && !isPac) {
          return NextResponse.json(
            { error: `Sibling tier "${sib.tier}" contains PV product ${item.productId} on a PAC scenario.` },
            { status: 422 }
          )
        }
      }
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

    // Use client-sent ElCom rate if provided, otherwise fall back to SwissRate DB lookup
    let rateRappenPerKwh: number | null = null
    if (data.rateRappenPerKwh != null) {
      rateRappenPerKwh = Math.round(data.rateRappenPerKwh)
    } else if (quote.customerZip) {
      const zipPrefix = quote.customerZip.slice(0, 2)
      const rate = await prisma.swissRate.findFirst({
        where: { zipPrefix },
        select: { rateRappenPerKwh: true },
      })
      rateRappenPerKwh = rate?.rateRappenPerKwh ?? null
    }

    // Compute pricing using the appropriate engine based on scenario type
    const scenarioType = data.scenarioType ?? 'PV'

    type IonProductCategory = 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'

    let pricing: {
      sellingPriceExVatRappen: number
      sellingPriceIncVatRappen: number
      effectiveMarginBasisPts: number
      totalCostRappen?: number
      rawCostRappen?: number
      totalLaborRappen?: number
    }
    // Customer-facing 4-line breakdown — snapshotted on the scenario for the PDF.
    let customerBreakdown: CustomerFacingBreakdown

    if (scenarioType === 'PAC') {
      const pacCoefficients = buildPacCoefficientsFromSettings(settingsMap, vatBasisPts)
      const pacProducts = data.items.map((item) => ({
        costRappen: productCostMap[item.productId],
        laborRappen: productLaborMap[item.productId],
        quantity: item.quantity,
      }))
      const pacBreakdown: PacPricingBreakdown = calculatePacPrice(pacProducts, pacCoefficients)
      pricing = pacBreakdown
      customerBreakdown = bucketPacForCustomer(pacBreakdown, vatBasisPts)
    } else {
      const ionProducts = data.items.map((item) => ({
        category: productCategoryMap[item.productId] as IonProductCategory,
        costRappen: productCostMap[item.productId],
        quantity: item.quantity,
      }))
      const ionOptions = (data.options ?? []).map((opt) => ({
        costRappen: optionCostMap[opt.optionId],
      }))
      const ionBreakdown: IonPricingBreakdown = calculateIonPrice(
        ionProducts,
        ionOptions,
        ionCoefficients,
        (data.roofType ?? 'tuile') as RoofType,
        (data.roofSlope ?? 'simple') as RoofSlope
      )
      pricing = ionBreakdown
      customerBreakdown = bucketIonForCustomer(ionBreakdown, vatBasisPts)
    }

    // Apply rep-chosen discount and validate the floor.
    // Total cost basis for margin = sellingPrice * (1 - effectiveMargin/10000)
    const minMarginBasisPts = settingsMap['min_margin_basis_pts'] ?? 2000
    const discountBasisPts = data.discountBasisPts ?? 0
    const totalCostForMargin = Math.round(
      (pricing.sellingPriceExVatRappen * (10000 - pricing.effectiveMarginBasisPts)) / 10000
    )
    const discount = applyDiscount({
      sellingExVatRappen: pricing.sellingPriceExVatRappen,
      totalCostRappen: totalCostForMargin,
      discountBasisPts,
      minMarginBasisPts,
      vatBasisPts,
    })

    // Floor enforcement: requiresApproval but no reason → reject. With reason
    // → allow with the flag set so admins can sign off later.
    if (discount.requiresApproval && !data.discountReason?.trim()) {
      return NextResponse.json(
        {
          error: `Le rabais demandé fait passer la marge effective à ${(discount.effectiveMarginAfterDiscountBps / 100).toFixed(1)}% (seuil: ${(minMarginBasisPts / 100).toFixed(1)}%). Veuillez fournir une raison.`,
          requiresApproval: true,
          effectiveMarginAfterDiscountBps: discount.effectiveMarginAfterDiscountBps,
        },
        { status: 422 }
      )
    }

    // Override pricing with discounted values for downstream storage
    pricing = {
      ...pricing,
      sellingPriceExVatRappen: discount.discountedExVatRappen,
      sellingPriceIncVatRappen: discount.discountedIncVatRappen,
      effectiveMarginBasisPts:
        discountBasisPts > 0 ? discount.effectiveMarginAfterDiscountBps : pricing.effectiveMarginBasisPts,
    }
    // Discount comes off the margin line — equipment/installation/services
    // stay at cost, the rep is giving up profit.
    if (discountBasisPts > 0) {
      customerBreakdown = applyDiscountToBreakdown(
        customerBreakdown,
        discount.discountedExVatRappen,
        vatBasisPts
      )
    }

    // ─── AI sibling pricing (S2) ───
    // Compute pricing for each AI sibling using the SAME settings/coefficients
    // as the primary, but: no rep edits, no discount, no cost options. Siblings
    // are saved as the AI proposed — their job is to support /present/ Screen 2.
    type SiblingComputed = {
      tier: 'essentiel' | 'recommande' | 'premium'
      items: { productId: string; quantity: number }[]
      pricing: {
        sellingPriceExVatRappen: number
        sellingPriceIncVatRappen: number
        effectiveMarginBasisPts: number
      }
      customerBreakdown: CustomerFacingBreakdown
    }
    const siblings: SiblingComputed[] = []
    // Build PAC coefficients once if any sibling needs them (saves redundant calls)
    const pacCoefficientsForSiblings =
      scenarioType === 'PAC' && (data.aiSiblings?.length ?? 0) > 0
        ? buildPacCoefficientsFromSettings(settingsMap, vatBasisPts)
        : null
    for (const sib of data.aiSiblings ?? []) {
      let sibPricing: SiblingComputed['pricing']
      let sibBreakdown: CustomerFacingBreakdown
      if (scenarioType === 'PAC' && pacCoefficientsForSiblings) {
        const pacProducts = sib.items.map((item) => ({
          costRappen: productCostMap[item.productId],
          laborRappen: productLaborMap[item.productId],
          quantity: item.quantity,
        }))
        const breakdown: PacPricingBreakdown = calculatePacPrice(pacProducts, pacCoefficientsForSiblings)
        sibPricing = breakdown
        sibBreakdown = bucketPacForCustomer(breakdown, vatBasisPts)
      } else {
        const ionProducts = sib.items.map((item) => ({
          category: productCategoryMap[item.productId] as IonProductCategory,
          costRappen: productCostMap[item.productId],
          quantity: item.quantity,
        }))
        const breakdown: IonPricingBreakdown = calculateIonPrice(
          ionProducts,
          [], // siblings carry no cost options
          ionCoefficients,
          (data.roofType ?? 'tuile') as RoofType,
          (data.roofSlope ?? 'simple') as RoofSlope
        )
        sibPricing = breakdown
        sibBreakdown = bucketIonForCustomer(breakdown, vatBasisPts)
      }
      siblings.push({
        tier: sib.tier,
        items: sib.items,
        pricing: sibPricing,
        customerBreakdown: sibBreakdown,
      })
    }

    // Sort order derived from tier: essentiel=0, recommande=1, premium=2.
    // Primary scenario uses the tier-derived order if `tier` is set; falls
    // back to 0 for legacy non-AI scenarios (existing default).
    const primarySortOrder = data.tier ? TIER_SORT_ORDER[data.tier] : 0

    // Atomically replace all scenarios (delete old + create primary + N siblings)
    const scenario = await prisma.$transaction(async (tx) => {
      await tx.quoteScenario.deleteMany({ where: { quoteId: params.id } })
      // Create siblings first (no return needed); primary is created last and
      // returned. Ordering doesn't matter for correctness — all in one tx.
      for (const sib of siblings) {
        await tx.quoteScenario.create({
          data: {
            quoteId: params.id,
            name: sib.tier === 'essentiel' ? 'Essentiel' : sib.tier === 'recommande' ? 'Recommandé' : 'Premium',
            scenarioType,
            // PAC context is per-building, not per-tier — siblings share it
            thermalLoadKw: scenarioType === 'PAC' ? data.thermalLoadKw ?? null : null,
            pacType: scenarioType === 'PAC' ? data.pacType ?? null : null,
            marginBasisPts: sib.pricing.effectiveMarginBasisPts,
            vatPctBasisPts: vatBasisPts,
            rateRappenPerKwh,
            roofType: data.roofType ?? 'tuile',
            roofSlope: data.roofSlope ?? 'simple',
            sellingPriceExVatRappen: sib.pricing.sellingPriceExVatRappen,
            sellingPriceIncVatRappen: sib.pricing.sellingPriceIncVatRappen,
            yieldKwhPerKwp: data.yieldKwhPerKwp ?? null,
            selfConsumptionRatePct: data.selfConsumptionRatePct ?? null,
            feedInRateRappenPerKwh: data.feedInRateRappenPerKwh ?? null,
            annualConsumptionKwh: data.annualConsumptionKwh ?? null,
            // Siblings: NO discount, NO approval flag, NO rep edits
            discountBasisPts: 0,
            discountReason: null,
            requiresApproval: false,
            tier: sib.tier,
            sortOrder: TIER_SORT_ORDER[sib.tier],
            equipmentRappen: sib.customerBreakdown.equipmentRappen,
            installationRappen: sib.customerBreakdown.installationRappen,
            servicesRappen: sib.customerBreakdown.servicesRappen,
            marginRappen: sib.customerBreakdown.marginRappen,
            items: {
              create: sib.items.map((item) => ({
                productId: item.productId,
                quantity: item.quantity,
                costRappenSnapshot: productCostMap[item.productId],
                laborRappenSnapshot: productLaborMap[item.productId] || null,
              })),
            },
          },
        })
      }
      return tx.quoteScenario.create({
        data: {
          quoteId: params.id,
          name: data.name ?? (data.tier === 'essentiel' ? 'Essentiel' : data.tier === 'recommande' ? 'Recommandé' : data.tier === 'premium' ? 'Premium' : 'Scénario 1'),
          scenarioType,
          thermalLoadKw: scenarioType === 'PAC' ? data.thermalLoadKw ?? null : null,
          pacType: scenarioType === 'PAC' ? data.pacType ?? null : null,
          marginBasisPts: pricing.effectiveMarginBasisPts,
          vatPctBasisPts: vatBasisPts,
          rateRappenPerKwh,
          roofType: data.roofType ?? 'tuile',
          roofSlope: data.roofSlope ?? 'simple',
          sellingPriceExVatRappen: pricing.sellingPriceExVatRappen,
          sellingPriceIncVatRappen: pricing.sellingPriceIncVatRappen,
          yieldKwhPerKwp: data.yieldKwhPerKwp ?? null,
          selfConsumptionRatePct: data.selfConsumptionRatePct ?? null,
          feedInRateRappenPerKwh: data.feedInRateRappenPerKwh ?? null,
          annualConsumptionKwh: data.annualConsumptionKwh ?? null,
          discountBasisPts,
          discountReason: discountBasisPts > 0 ? data.discountReason?.trim() || null : null,
          requiresApproval: discount.requiresApproval,
          tier: data.tier ?? null,
          sortOrder: primarySortOrder,
          // Customer-facing 4-line breakdown (Phase 2a)
          equipmentRappen: customerBreakdown.equipmentRappen,
          installationRappen: customerBreakdown.installationRappen,
          servicesRappen: customerBreakdown.servicesRappen,
          marginRappen: customerBreakdown.marginRappen,
          items: {
            create: data.items.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              costRappenSnapshot: productCostMap[item.productId],
              laborRappenSnapshot: productLaborMap[item.productId] || null,
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

    // Update project info and map position if provided
    const infoFields = ['customerName', 'customerEmail', 'customerPhone', 'siteAddress', 'notes', 'mapLat', 'mapLon', 'mapZoom'] as const
    const hasInfo = infoFields.some(f => data[f] !== undefined)
    if (hasInfo) {
      // If customer details changed, find-or-create the Customer and re-link.
      // We only re-link when the rep actually edited identifying fields
      // (name/email/phone) — site/map updates don't trigger a re-link.
      const customerFieldChanged =
        data.customerName !== undefined ||
        data.customerEmail !== undefined ||
        data.customerPhone !== undefined
      let customerId: string | undefined
      if (customerFieldChanged) {
        const result = await findOrCreateCustomer({
          name: data.customerName,
          email: data.customerEmail || null,
          phone: data.customerPhone,
          zip: quote.customerZip,
        })
        customerId = result.id
      }

      await prisma.quote.update({
        where: { id: params.id },
        data: {
          ...(customerId ? { customerId } : {}),
          customerName: data.customerName,
          customerEmail: data.customerEmail || null,
          customerPhone: data.customerPhone,
          siteAddress: data.siteAddress,
          notes: data.notes,
          mapLat: data.mapLat ?? null,
          mapLon: data.mapLon ?? null,
          mapZoom: data.mapZoom ?? null,
          updatedAt: new Date(),
        },
      })
    } else {
      await prisma.quote.update({
        where: { id: params.id },
        data: { updatedAt: new Date() },
      })
    }

    return NextResponse.json({
      scenario,
      pricing,
      sellingPriceExVatRappen: pricing.sellingPriceExVatRappen,
      sellingPriceIncVatRappen: pricing.sellingPriceIncVatRappen,
    })
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
