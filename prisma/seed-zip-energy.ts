/**
 * seed-zip-energy.ts
 *
 * Seeds SwissRate with one row per Swiss ZIP (4-digit NPA) from
 * prisma/zip_energy_2026.json (built by build-zip-energy.ts).
 *
 *   - retail rate: per-NPA H4 rate when available, else the 2026 canton median
 *   - feed-in tariff + operator + commune: from the ElCom sunshine join
 *
 * Existing 2-digit canton-prefix rows are left untouched (they remain the
 * fallback for ZIPs missing here). 4-digit rows are replaced wholesale —
 * they are pure derived data.
 *
 * Run with: npx tsx prisma/seed-zip-energy.ts   (needs DATABASE_URL)
 */

import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

interface ZipEnergyRow {
  zip: string
  canton: string
  commune: string
  operatorId: number | null
  operatorName: string | null
  feedInCt: number | null
  retailCt: number | null
}

async function main() {
  const rows = JSON.parse(
    readFileSync(join(__dirname, 'zip_energy_2026.json'), 'utf8')
  ) as ZipEnergyRow[]

  const cantonMedians = JSON.parse(
    readFileSync(join(__dirname, 'elcom_canton_medians_2026.json'), 'utf8')
  ) as Record<string, number>

  let withNpaRate = 0
  const data = rows.map((r) => {
    const retail = r.retailCt ?? cantonMedians[r.canton] ?? null
    if (r.retailCt != null) withNpaRate++
    return {
      canton: r.canton,
      zipPrefix: r.zip,
      rateRappenPerKwh: Math.round(retail ?? 27), // 27 ct = national ballpark, only if canton unknown
      feedInRappenPerKwh: r.feedInCt,
      operatorName: r.operatorName,
      communeName: r.commune,
    }
  })

  // Replace all 4-digit rows atomically-ish (derived data, safe to rebuild)
  const deleted = await prisma.swissRate.deleteMany({
    where: { zipPrefix: { in: rows.map((r) => r.zip) } },
  })
  const created = await prisma.swissRate.createMany({ data, skipDuplicates: true })

  console.log(
    `Deleted ${deleted.count} old NPA rows, created ${created.count}.\n` +
      `Retail source: ${withNpaRate} per-NPA, ${created.count - withNpaRate} canton-median fallback.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
