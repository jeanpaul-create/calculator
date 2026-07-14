/**
 * seed-sales-list-pv.ts — sync the PV catalog with the internal
 * « Sales List — Panneaux Photovoltaïques » workbook (July 2026 edition,
 * sheets: Data + GoodWe / Fronius Hybrid / Fronius Hybrid Plus / Fronius
 * String).
 *
 * Idempotent: products are matched by exact name — existing rows get cost/
 * power/active refreshed, missing rows are created. Nothing is deleted or
 * deactivated here (retiring superseded panels is a business call — see the
 * report accompanying this script).
 *
 * Also aligns pv_labor_inverter_rappen with the workbook's
 * « Main-d'œuvre Électricité » (90 CHF; the setting carried 180).
 *
 * Run with: npx tsx prisma/seed-sales-list-pv.ts   (needs DATABASE_URL)
 */

import { PrismaClient, ProductCategory } from '@prisma/client'

const prisma = new PrismaClient()

interface Row {
  name: string
  category: ProductCategory
  /** CHF HT from the workbook's « Coût HT » column */
  costChf: number
  /** Wp for panels, VA for inverters, Wh for batteries, W for EV chargers */
  powerWp: number | null
  description?: string
}

const ROWS: Row[] = [
  // ── PANNEAUX (Data!A24:G25) ────────────────────────────────────────────
  {
    name: 'LONGi EcoLife LR7-54HJD-510M 510 Wp',
    category: 'PANEL',
    costChf: 99.25,
    powerWp: 510,
    description: 'Garantie produit 30 ans · production 30 ans',
  },
  {
    name: 'AIKO Neostar G3 3S54 A495-MC 495 Wp',
    category: 'PANEL',
    costChf: 114.45,
    powerWp: 495,
    description: 'Garantie produit 25 ans · production 30 ans',
  },

  // ── ONDULEURS GoodWe ETA (all-in-one hybride) ──────────────────────────
  { name: 'GoodWe GW5K-ETA-G20', category: 'INVERTER', costChf: 1011.1, powerWp: 5000 },
  { name: 'GoodWe GW6K-ETA-G20', category: 'INVERTER', costChf: 1034.55, powerWp: 6000 },
  { name: 'GoodWe GW8K-ETA-G20', category: 'INVERTER', costChf: 1068.6, powerWp: 8000 },
  { name: 'GoodWe GW10K-ETA-G20', category: 'INVERTER', costChf: 1103.7, powerWp: 10000 },
  { name: 'GoodWe GW12K-ETA-G20', category: 'INVERTER', costChf: 1149.5, powerWp: 12000 },
  { name: 'GoodWe GW15K-ETA-G20', category: 'INVERTER', costChf: 1294.25, powerWp: 15000 },
  { name: 'GoodWe GW20K-ETA-G20', category: 'INVERTER', costChf: 1687.0, powerWp: 20000 },
  { name: 'GoodWe GW25K-ETA-G20', category: 'INVERTER', costChf: 1787.05, powerWp: 25000 },
  { name: 'GoodWe GW29.99K-ETA-G20', category: 'INVERTER', costChf: 1910.5, powerWp: 30000 },

  // ── ONDULEURS Fronius — missing 25 kW variants ─────────────────────────
  { name: 'Fronius Verto 25.0 Plus SPD 1+2', category: 'INVERTER', costChf: 3377.95, powerWp: 25000 },
  { name: 'Fronius Verto 25.0 400 SPD 1+2', category: 'INVERTER', costChf: 2239.65, powerWp: 25000 },

  // ── BATTERIES GoodWe ESA ───────────────────────────────────────────────
  { name: 'GoodWe GW5.1-BAT-D-G20 (5.1 kWh)', category: 'BATTERY', costChf: 1103.05, powerWp: 5100 },
  { name: 'GoodWe GW8.3-BAT-D-G20 (8.3 kWh)', category: 'BATTERY', costChf: 1439.95, powerWp: 8300 },
  { name: "GoodWe Kit d'extension batterie 5 kWh", category: 'BATTERY', costChf: 1342.0, powerWp: 5000 },
  { name: "GoodWe Kit d'extension batterie 8 kWh", category: 'BATTERY', costChf: 1678.8, powerWp: 8000 },
  { name: "GoodWe Kit d'extension batterie 10 kWh", category: 'BATTERY', costChf: 2445.1, powerWp: 10000 },
  { name: "GoodWe Kit d'extension batterie 13 kWh", category: 'BATTERY', costChf: 2781.9, powerWp: 13000 },
  { name: "GoodWe Kit d'extension batterie 16 kWh", category: 'BATTERY', costChf: 3118.75, powerWp: 16000 },
  { name: "GoodWe Kit d'extension batterie 18 kWh", category: 'BATTERY', costChf: 3884.95, powerWp: 18000 },
  { name: "GoodWe Kit d'extension batterie 21 kWh", category: 'BATTERY', costChf: 4221.8, powerWp: 21000 },
  { name: "GoodWe Kit d'extension batterie 24 kWh", category: 'BATTERY', costChf: 4558.65, powerWp: 24000 },
  { name: "GoodWe Kit d'extension batterie 26 kWh", category: 'BATTERY', costChf: 5324.9, powerWp: 26000 },
  { name: "GoodWe Kit d'extension batterie 29 kWh", category: 'BATTERY', costChf: 5661.75, powerWp: 29000 },
  { name: "GoodWe Kit d'extension batterie 32 kWh", category: 'BATTERY', costChf: 5998.6, powerWp: 32000 },
  { name: "GoodWe Kit d'extension batterie 34 kWh", category: 'BATTERY', costChf: 6764.8, powerWp: 34000 },
  { name: "GoodWe Kit d'extension batterie 37 kWh", category: 'BATTERY', costChf: 7101.65, powerWp: 37000 },
  { name: "GoodWe Kit d'extension batterie 39 kWh", category: 'BATTERY', costChf: 7867.85, powerWp: 39000 },
  { name: "GoodWe Kit d'extension batterie 42 kWh", category: 'BATTERY', costChf: 8204.75, powerWp: 42000 },
  { name: "GoodWe Kit d'extension batterie 45 kWh", category: 'BATTERY', costChf: 8541.6, powerWp: 45000 },
  { name: "GoodWe Kit d'extension batterie 48 kWh", category: 'BATTERY', costChf: 8878.4, powerWp: 48000 },

  // ── BORNES DE RECHARGE ─────────────────────────────────────────────────
  { name: 'GoodWe GW11K-HCA Gen2a EV Charger 11 kW', category: 'EV_CHARGER', costChf: 368.35, powerWp: 11000 },
  { name: 'GoodWe GW22K-HCA Gen2a EV Charger 22 kW', category: 'EV_CHARGER', costChf: 407.5, powerWp: 22000 },
  // Cost refresh (was 677.40)
  { name: 'Fronius Wattpilot Flex Home 22 C6', category: 'EV_CHARGER', costChf: 692.45, powerWp: 22000 },
]

async function main() {
  let created = 0
  let updated = 0
  for (const r of ROWS) {
    const costRappen = Math.round(r.costChf * 100)
    const existing = await prisma.product.findFirst({
      where: { name: r.name },
      select: { id: true, costRappen: true, powerWp: true, active: true },
    })
    if (existing) {
      if (
        existing.costRappen !== costRappen ||
        existing.powerWp !== r.powerWp ||
        !existing.active
      ) {
        await prisma.product.update({
          where: { id: existing.id },
          data: {
            costRappen,
            powerWp: r.powerWp,
            active: true,
            ...(r.description ? { description: r.description } : {}),
          },
        })
        updated++
        console.log(`~ ${r.name}: ${(existing.costRappen / 100).toFixed(2)} → ${r.costChf.toFixed(2)}`)
      }
    } else {
      await prisma.product.create({
        data: {
          name: r.name,
          category: r.category,
          costRappen,
          powerWp: r.powerWp,
          description: r.description,
          active: true,
        },
      })
      created++
      console.log(`+ ${r.name} (${r.category}, ${r.costChf.toFixed(2)} CHF)`)
    }
  }

  // The sales list defines the ONLY two panels reps may quote (user decision
  // 2026-07-14: « use only 2 panels »). Everything else in PANEL goes
  // inactive — non-destructive, existing quotes keep their cost snapshots.
  // Other categories (incl. the whole Huawei line) are deliberately untouched.
  const currentPanels = ROWS.filter((r) => r.category === 'PANEL').map((r) => r.name)
  const retired = await prisma.product.updateMany({
    where: { category: 'PANEL', name: { notIn: currentPanels }, active: true },
    data: { active: false },
  })
  if (retired.count > 0) console.log(`− ${retired.count} anciens panneaux désactivés`)

  // Align inverter labor with the workbook: « Main-d'œuvre Électricité 90 »
  // (the setting carried 180 — every PV quote overpriced by 90 CHF/onduleur
  // vs the Excel reference).
  const labor = await prisma.setting.findUnique({ where: { key: 'pv_labor_inverter_rappen' } })
  if (labor && labor.value !== '9000') {
    await prisma.setting.update({
      where: { key: 'pv_labor_inverter_rappen' },
      data: { value: '9000' },
    })
    console.log(`~ pv_labor_inverter_rappen: ${labor.value} → 9000 (sales list: 90 CHF)`)
  }

  console.log(`\nDone: ${created} created, ${updated} updated (of ${ROWS.length} rows).`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
