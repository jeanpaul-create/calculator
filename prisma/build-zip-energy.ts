/**
 * build-zip-energy.ts
 *
 * Offline join producing one energy-info row per Swiss ZIP (NPA):
 *
 *   PLZ CSV (NPA → BFS commune, canton)
 *     × elcom_operator_municipalities.json (BFS → grid operator)
 *     × sunshine_tariffs.json (operator → 2026 feed-in tariff EH4, ct/kWh)
 *     × elcom_npa_rates_2026.json (NPA → 2026 H4 retail rate, ct/kWh) [optional —
 *       produced by fetch-elcom-rates.ts; rows fall back to canton median at seed time]
 *
 * Run with: npx tsx prisma/build-zip-energy.ts
 * Output:   prisma/zip_energy_2026.json
 *
 * A ZIP can span several communes/operators. We pick the operator serving the
 * most communes within the ZIP (tie → lowest operator id) — this is a prefill
 * aid for the calculator, and the rep can always override the rates per quote.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PLZ_CSV = join(__dirname, 'plz_data/AMTOVZ_CSV_WGS84/AMTOVZ_CSV_WGS84.csv')
const OP_MUNI_JSON = join(__dirname, 'elcom_operator_municipalities.json')
const SUNSHINE_JSON = join(__dirname, 'sunshine_tariffs.json')
const NPA_RATES_JSON = join(__dirname, 'elcom_npa_rates_2026.json')
const OUTPUT_JSON = join(__dirname, 'zip_energy_2026.json')

interface ZipEnergyRow {
  zip: string
  canton: string
  commune: string
  operatorId: number | null
  operatorName: string | null
  /** Feed-in tariff (injection) 2026, ct/kWh — sunshine EH4 */
  feedInCt: number | null
  /** Retail rate H4 2026, ct/kWh — null until fetch-elcom-rates.ts has run */
  retailCt: number | null
}

// ── 1. PLZ CSV → per-ZIP commune/canton/BFS sets ─────────────────────────────
const csv = readFileSync(PLZ_CSV, 'utf8').replace(/^﻿/, '')
const lines = csv.split('\n').slice(1).filter((l) => l.trim())

interface PlzEntry { bfs: number; commune: string; canton: string }
const plzMap = new Map<string, PlzEntry[]>()
for (const line of lines) {
  const cols = line.split(';')
  const plz4 = cols[1]?.trim()
  const commune = cols[4]?.trim()
  const bfs = parseInt(cols[5]?.trim() ?? '')
  const canton = cols[6]?.trim()
  if (!plz4 || !/^\d{4}$/.test(plz4) || isNaN(bfs) || !canton) continue
  const arr = plzMap.get(plz4) ?? []
  if (!arr.some((e) => e.bfs === bfs)) arr.push({ bfs, commune, canton })
  plzMap.set(plz4, arr)
}

// ── 2. BFS → operator(s) ─────────────────────────────────────────────────────
const opMuni = JSON.parse(readFileSync(OP_MUNI_JSON, 'utf8')) as {
  data: { operatorMunicipalities: Array<{ municipality: number; canton: string; operator: string }> }
}
const bfsToOperators = new Map<number, number[]>()
for (const row of opMuni.data.operatorMunicipalities) {
  const arr = bfsToOperators.get(row.municipality) ?? []
  const opId = parseInt(row.operator)
  if (!isNaN(opId) && !arr.includes(opId)) arr.push(opId)
  bfsToOperators.set(row.municipality, arr)
}

// ── 3. Operator → feed-in tariff ─────────────────────────────────────────────
const sunshine = JSON.parse(readFileSync(SUNSHINE_JSON, 'utf8')) as {
  data: { sunshineTariffs: Array<{ operatorId: number; name: string; period: string; tariffEH4: number | null }> }
}
const operatorInfo = new Map<number, { name: string; feedInCt: number | null }>()
for (const t of sunshine.data.sunshineTariffs) {
  operatorInfo.set(t.operatorId, {
    name: t.name,
    feedInCt: typeof t.tariffEH4 === 'number' && t.tariffEH4 > 0 ? t.tariffEH4 : null,
  })
}

// ── 4. Optional NPA retail rates (from fetch-elcom-rates.ts) ─────────────────
let npaRates = new Map<string, number>()
if (existsSync(NPA_RATES_JSON)) {
  const raw = JSON.parse(readFileSync(NPA_RATES_JSON, 'utf8')) as Record<string, number>
  npaRates = new Map(Object.entries(raw).filter(([, v]) => typeof v === 'number' && v > 0))
  console.log(`Loaded ${npaRates.size} NPA retail rates`)
} else {
  console.log('No elcom_npa_rates_2026.json yet — retailCt left null (canton-median fallback at seed time)')
}

// ── 5. Join per ZIP ──────────────────────────────────────────────────────────
const out: ZipEnergyRow[] = []
let noOperator = 0
let noFeedIn = 0

for (const [zip, entries] of [...plzMap.entries()].sort()) {
  // Majority canton + commune (most rows in the CSV for this ZIP)
  const canton = entries[0].canton
  const commune = entries[0].commune

  // Count operator occurrences across the ZIP's communes
  const counts = new Map<number, number>()
  for (const e of entries) {
    for (const op of bfsToOperators.get(e.bfs) ?? []) {
      counts.set(op, (counts.get(op) ?? 0) + 1)
    }
  }
  let operatorId: number | null = null
  if (counts.size > 0) {
    operatorId = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
  } else {
    noOperator++
  }

  const info = operatorId != null ? operatorInfo.get(operatorId) : undefined
  if (operatorId != null && (!info || info.feedInCt == null)) noFeedIn++

  out.push({
    zip,
    canton,
    commune,
    operatorId,
    operatorName: info?.name ?? null,
    feedInCt: info?.feedInCt ?? null,
    retailCt: npaRates.get(zip) ?? null,
  })
}

writeFileSync(OUTPUT_JSON, JSON.stringify(out, null, 1))
const withFeedIn = out.filter((r) => r.feedInCt != null).length
const withRetail = out.filter((r) => r.retailCt != null).length
console.log(
  `Wrote ${out.length} ZIP rows → ${OUTPUT_JSON}\n` +
    `  feed-in coverage: ${withFeedIn}/${out.length}\n` +
    `  retail coverage:  ${withRetail}/${out.length}\n` +
    `  ZIPs w/o operator: ${noOperator}, operators w/o feed-in: ${noFeedIn}`
)
