/**
 * seed-pac-products.ts
 *
 * Inserts PAC (heat pump) product catalog into the Product table.
 * Source: Sales List-PAC-2026.xlsx (Data sheet + Sales List PAC sheet), v00 2024-11-07
 *
 * Run with: npx tsx scripts/seed-pac-products.ts
 *
 * The script is idempotent: existing products with the same name + category are
 * skipped (not duplicated). Re-run safely after adding new products.
 *
 * Pricing structure (from Excel Data sheet):
 *   costRappen  = material cost (MAT1 column in example sheet)
 *   laborRappen = labor / service cost (Main-d'œuvre column in example sheet)
 *
 * For PAC_ADMIN items (permit fees, commune taxes): the cost goes through
 * the admin path in calculatePacPrice(). Stored in costRappen.
 *
 * For PAC_MONTAGE items (labor days, commissioning): cost is pure labor.
 * Stored in laborRappen (costRappen = 0).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// All costs in CHF — converted to Rappen (× 100) below
// Schema: { name, costChf, laborChf, category, description? }
type ProductSeed = {
  name: string
  costChf: number
  laborChf: number
  category: string
  description?: string
}

const PAC_PRODUCTS: ProductSeed[] = [

  // ── 1. Machine (heat pump units) ────────────────────────────────────────────
  // Source: Data sheet rows 16–21. Labor for installation is in section 8 (Montage).
  { name: 'BUDERUS WLW176i-5 AR TP70',          costChf: 6203.80,  laborChf: 0, category: 'PAC_MACHINE',     description: '5 kW A-7/W35 — air-to-water heat pump' },
  { name: 'BUDERUS WLW176i-7 AR TP70',          costChf: 6532.00,  laborChf: 0, category: 'PAC_MACHINE',     description: '7 kW A-7/W35 — air-to-water heat pump' },
  { name: 'BUDERUS WLW176i-10 AR TP70',         costChf: 8038.44,  laborChf: 0, category: 'PAC_MACHINE',     description: '10 kW A-7/W35 — air-to-water heat pump' },
  { name: 'BUDERUS WLW176i-12 AR TP70',         costChf: 8491.88,  laborChf: 0, category: 'PAC_MACHINE',     description: '12 kW A-7/W35 — air-to-water heat pump' },
  { name: 'BUDERUS KERMI 10AWE (15kW A-7/W35)', costChf: 10143.96, laborChf: 0, category: 'PAC_MACHINE',     description: '15 kW A-7/W35 — KERMI series' },
  { name: 'BUDERUS KERMI 16AWE (19kW A-7/W35)', costChf: 12762.28, laborChf: 0, category: 'PAC_MACHINE',     description: '19 kW A-7/W35 — KERMI series' },
  { name: 'VAILLANT VWL 65/6',                  costChf: 0,        laborChf: 0, category: 'PAC_MACHINE',     description: 'Prix sur demande — VAILLANT aroTherm plus' },
  { name: 'VAILLANT VWL 75/6',                  costChf: 0,        laborChf: 0, category: 'PAC_MACHINE',     description: 'Prix sur demande — VAILLANT aroTherm plus' },
  { name: 'VAILLANT VWL 105/6',                 costChf: 0,        laborChf: 0, category: 'PAC_MACHINE',     description: 'Prix sur demande — VAILLANT aroTherm plus' },
  { name: 'VAILLANT VWL 125/6',                 costChf: 0,        laborChf: 0, category: 'PAC_MACHINE',     description: 'Prix sur demande — VAILLANT aroTherm plus' },

  // ── 2. Accessoires ───────────────────────────────────────────────────────────
  // Source: Sales List PAC sheet, section 2. Costs from MAT1 column.
  { name: "Vase d'expansion",                   costChf: 438,      laborChf: 0, category: 'PAC_ACCESSORY' },
  { name: 'Vanne exogel',                       costChf: 232,      laborChf: 0, category: 'PAC_ACCESSORY' },
  { name: 'Rubber Foot',                        costChf: 27,       laborChf: 0, category: 'PAC_ACCESSORY' },
  { name: 'Vanne 3 voies',                      costChf: 215,      laborChf: 0, category: 'PAC_ACCESSORY' },

  // ── 3. Electricité ───────────────────────────────────────────────────────────
  // Source: Sales List PAC sheet, section 3.
  // Row 3.1: Résistance — material only (344 CHF mat, 0 labor)
  // Row 3.2: Câblage — 600 CHF material + 1470 CHF labor (electrician forfait)
  { name: 'Résistance électrique',              costChf: 344,      laborChf: 0,    category: 'PAC_ELECTRICITE', description: 'Résistance d\'appoint électrique — forfait' },
  { name: 'Câblage électrique',                 costChf: 600,      laborChf: 1470, category: 'PAC_ELECTRICITE', description: 'Matériel câblage + main-d\'œuvre electricien — forfait' },

  // ── 4. Maçonnerie ────────────────────────────────────────────────────────────
  // Source: Data sheet rows 71–96. All are material/service costs, no separate labor.
  { name: 'Carrotage 1',                        costChf: 300,      laborChf: 0, category: 'PAC_MACONNERIE',   description: '1 passage de paroi' },
  { name: 'Carrotage 2',                        costChf: 600,      laborChf: 0, category: 'PAC_MACONNERIE',   description: '2 passages de paroi' },
  { name: 'Carrotage 3',                        costChf: 800,      laborChf: 0, category: 'PAC_MACONNERIE',   description: '3 passages de paroi' },
  { name: 'Carrotage 4',                        costChf: 1000,     laborChf: 0, category: 'PAC_MACONNERIE',   description: '4 passages de paroi' },
  { name: 'Carrotage 5',                        costChf: 1200,     laborChf: 0, category: 'PAC_MACONNERIE',   description: '5 passages de paroi' },
  { name: 'Carrotage 6',                        costChf: 1400,     laborChf: 0, category: 'PAC_MACONNERIE',   description: '6 passages de paroi' },
  { name: 'Démolition mur en brique',           costChf: 450,      laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Démolition mur en béton',            costChf: 950,      laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Déplacement maçon',                  costChf: 200,      laborChf: 0, category: 'PAC_MACONNERIE',   description: 'Déplacement supplémentaire' },
  { name: 'Deux plots',                         costChf: 500,      laborChf: 0, category: 'PAC_MACONNERIE',   description: 'Plots béton pour unité extérieure' },
  { name: 'Dalle complète',                     costChf: 800,      laborChf: 0, category: 'PAC_MACONNERIE',   description: 'Dalle béton complète' },
  { name: 'Tranchée 1 m',                       costChf: 200,      laborChf: 0, category: 'PAC_MACONNERIE',   description: 'Longueur de tranchée — par mètre' },
  { name: 'Tranchée 2 m',                       costChf: 400,      laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 3 m',                       costChf: 600,      laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 4 m',                       costChf: 800,      laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 5 m',                       costChf: 1000,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 6 m',                       costChf: 1200,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 7 m',                       costChf: 1300,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 8 m',                       costChf: 1400,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 9 m',                       costChf: 1500,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 10 m',                      costChf: 1600,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 12 m',                      costChf: 1800,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 15 m',                      costChf: 2100,     laborChf: 0, category: 'PAC_MACONNERIE' },
  { name: 'Tranchée 20 m',                      costChf: 2600,     laborChf: 0, category: 'PAC_MACONNERIE' },

  // ── 5. Isolation ─────────────────────────────────────────────────────────────
  // Source: Data sheet rows 69–70.
  { name: 'Isolation tube standard',            costChf: 1000,     laborChf: 0, category: 'PAC_ISOLATION',    description: 'Isolation calorifuge standard' },
  { name: 'Isolation tube spécifique',          costChf: 1500,     laborChf: 0, category: 'PAC_ISOLATION',    description: 'Isolation calorifuge spécifique / haute performance' },

  // ── 6. Citerne ───────────────────────────────────────────────────────────────
  // Source: Data sheet rows 37–66. Costs = removal/disposal cost.
  // Plastic sans bac
  { name: 'Citerne plastique 1×2000L sans bac', costChf: 600,      laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 2×1000L sans bac', costChf: 780,      laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 2×2000L sans bac', costChf: 1000,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 3×2000L sans bac', costChf: 1190,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 4×2000L sans bac', costChf: 1350,     laborChf: 0, category: 'PAC_CITERNE' },
  // Plastic avec bac
  { name: 'Citerne plastique 1×2000L avec bac', costChf: 710,      laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 2×1000L avec bac', costChf: 930,      laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 2×2000L avec bac', costChf: 1270,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 3×2000L avec bac', costChf: 1550,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne plastique 4×2000L avec bac', costChf: 1750,     laborChf: 0, category: 'PAC_CITERNE' },
  // Acier prismatique cylindre (découpage)
  { name: 'Citerne acier découpage 4000L',      costChf: 2090,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 5000L',      costChf: 2200,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 6000L',      costChf: 2280,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 8000L',      costChf: 2400,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 10000L',     costChf: 2530,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 12000L',     costChf: 2750,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 14000L',     costChf: 2950,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 16000L',     costChf: 3250,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 18000L',     costChf: 3550,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne acier découpage 20000L',     costChf: 3800,     laborChf: 0, category: 'PAC_CITERNE' },
  // Enlèvement feuille souple
  { name: 'Citerne feuille souple 4000L',       costChf: 1270,     laborChf: 0, category: 'PAC_CITERNE',     description: 'Enlèvement feuille souple 4000L' },
  { name: 'Citerne feuille souple 5000L',       costChf: 1300,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 6000L',       costChf: 1380,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 8000L',       costChf: 1400,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 10000L',      costChf: 1480,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 12000L',      costChf: 1600,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 14000L',      costChf: 1700,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 16000L',      costChf: 1800,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 18000L',      costChf: 2000,     laborChf: 0, category: 'PAC_CITERNE' },
  { name: 'Citerne feuille souple 20000L',      costChf: 2050,     laborChf: 0, category: 'PAC_CITERNE' },

  // ── 7. Conduite ──────────────────────────────────────────────────────────────
  // Source: Data sheet rows 102–104 + Sales List PAC section 7.
  { name: 'Conduite DN28',                      costChf: 1000,     laborChf: 0, category: 'PAC_CONDUITE',     description: 'Conduite frigorigène DN28 — forfait' },
  { name: 'Conduite DN35',                      costChf: 1500,     laborChf: 0, category: 'PAC_CONDUITE',     description: 'Conduite frigorigène DN35 — forfait' },
  { name: 'Conduite DN42',                      costChf: 2000,     laborChf: 0, category: 'PAC_CONDUITE',     description: 'Conduite frigorigène DN42 — forfait' },
  { name: 'Conduite frigo (par m)',              costChf: 35,       laborChf: 0, category: 'PAC_CONDUITE',     description: 'Prix au mètre linéaire' },
  { name: 'Conduite suppérieure (par m)',        costChf: 40,       laborChf: 0, category: 'PAC_CONDUITE',     description: 'Prix au mètre linéaire' },

  // ── 8. Montage et mise en service ────────────────────────────────────────────
  // Source: Sales List PAC section 8. Pure labor — costRappen = 0, laborRappen = day rate.
  { name: 'Montage (1 jour)',                   costChf: 0,        laborChf: 1000, category: 'PAC_MONTAGE',   description: 'Main-d\'œuvre montage — par jour de technicien' },
  { name: 'Mise en service',                    costChf: 0,        laborChf: 800,  category: 'PAC_MONTAGE',   description: 'Mise en service et paramétrage — forfait' },

  // ── 9. Démarche administrative ───────────────────────────────────────────────
  // Source: Sales List PAC section 9. Fixed costs (permits, commune fees).
  { name: 'Démarche administrative',            costChf: 500,      laborChf: 0, category: 'PAC_ADMIN',        description: 'Dossier demande de permis / annonce de travaux — forfait' },
  { name: 'Émolument communal',                 costChf: 1000,     laborChf: 0, category: 'PAC_ADMIN',        description: 'Taxe communale pour installation PAC — montant typique' },
]

async function main() {
  console.log(`Seeding ${PAC_PRODUCTS.length} PAC products…\n`)

  let created = 0
  let skipped = 0

  for (const p of PAC_PRODUCTS) {
    const costRappen  = Math.round(p.costChf * 100)
    const laborRappen = Math.round(p.laborChf * 100)

    // Idempotent: skip if exact name + category already exists
    const existing = await prisma.product.findFirst({
      where: { name: p.name, category: p.category as never },
      select: { id: true },
    })

    if (existing) {
      console.log(`  SKIP  ${p.category.padEnd(16)} ${p.name}`)
      skipped++
      continue
    }

    await prisma.product.create({
      data: {
        name: p.name,
        description: p.description ?? null,
        category: p.category as never,
        costRappen,
        laborRappen: laborRappen > 0 ? laborRappen : null,
        active: true,
      },
    })

    const laborStr = laborRappen > 0 ? ` + CHF ${p.laborChf} labor` : ''
    console.log(`  CREATE ${p.category.padEnd(16)} ${p.name} — CHF ${p.costChf}${laborStr}`)
    created++
  }

  console.log(`\nDone: ${created} created, ${skipped} skipped.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
