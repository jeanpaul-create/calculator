import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { requireOwnerOrAdmin } from '@/lib/auth'
import { generateQuoteNumber } from '@/lib/quote-number'

type Params = { params: { id: string } }

// POST /api/quotes/[id]/duplicate — copy a quote into a fresh DRAFT.
//
// Copies: customer info + FK, site address/map, notes, permit context, and
// every scenario with its items/options (cost snapshots included, so the
// copy prices identically even if the catalog moved).
// Resets: status→DRAFT, quoteNumber (new), all lifecycle timestamps,
// shareToken, engagement counters, followUp, heroScenarioId (points at old
// scenario ids), and discount-approval stamps (a re-issued below-floor
// discount needs a fresh sign-off).
//
// The duplicate belongs to the CALLER (an admin duplicating a rep's quote
// owns the copy) — matches how re-quotes are actually worked.
export async function POST(_req: Request, { params }: Params) {
  try {
    const source = await prisma.quote.findUnique({
      where: { id: params.id },
      include: {
        scenarios: {
          orderBy: { sortOrder: 'asc' },
          include: { items: true, options: true },
        },
      },
    })
    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    const session = await requireOwnerOrAdmin(source.repId)

    const quoteNumber = await generateQuoteNumber()
    const created = await prisma.quote.create({
      data: {
        quoteNumber,
        status: 'DRAFT',
        repId: session.user.id,
        customerId: source.customerId,
        customerName: source.customerName,
        customerEmail: source.customerEmail,
        customerPhone: source.customerPhone,
        customerZip: source.customerZip,
        customerCanton: source.customerCanton,
        siteAddress: source.siteAddress,
        mapLat: source.mapLat,
        mapLon: source.mapLon,
        mapZoom: source.mapZoom,
        notes: source.notes,
        noEca: source.noEca,
        buildingAssignment: source.buildingAssignment,
        scenarios: {
          create: source.scenarios.map((s) => ({
            name: s.name,
            scenarioType: s.scenarioType,
            marginBasisPts: s.marginBasisPts,
            vatPctBasisPts: s.vatPctBasisPts,
            rateRappenPerKwh: s.rateRappenPerKwh,
            roofType: s.roofType,
            roofSlope: s.roofSlope,
            sellingPriceExVatRappen: s.sellingPriceExVatRappen,
            sellingPriceIncVatRappen: s.sellingPriceIncVatRappen,
            yieldKwhPerKwp: s.yieldKwhPerKwp,
            selfConsumptionRatePct: s.selfConsumptionRatePct,
            feedInRateRappenPerKwh: s.feedInRateRappenPerKwh,
            annualConsumptionKwh: s.annualConsumptionKwh,
            discountBasisPts: s.discountBasisPts,
            discountReason: s.discountReason,
            requiresApproval: s.requiresApproval,
            tier: s.tier,
            sortOrder: s.sortOrder,
            equipmentRappen: s.equipmentRappen,
            installationRappen: s.installationRappen,
            servicesRappen: s.servicesRappen,
            marginRappen: s.marginRappen,
            thermalLoadKw: s.thermalLoadKw,
            pacType: s.pacType,
            items: {
              create: s.items.map((it) => ({
                productId: it.productId,
                quantity: it.quantity,
                costRappenSnapshot: it.costRappenSnapshot,
                laborRappenSnapshot: it.laborRappenSnapshot,
              })),
            },
            options: {
              create: s.options.map((o) => ({
                optionId: o.optionId,
                costRappenSnapshot: o.costRappenSnapshot,
              })),
            },
          })),
        },
      },
      select: { id: true, quoteNumber: true },
    })

    return NextResponse.json(created, { status: 201 })
  } catch (err) {
    if (err instanceof Response) return err
    console.error('[POST /api/quotes/[id]/duplicate]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
