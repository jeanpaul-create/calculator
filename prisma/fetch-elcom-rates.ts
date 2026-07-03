/**
 * fetch-elcom-rates.ts
 *
 * One-time script to build a comprehensive NPA → ElCom H4 2026 rate mapping.
 *
 * Run with: npx tsx prisma/fetch-elcom-rates.ts
 *
 * Output: prisma/elcom_npa_rates_2026.json
 *
 * Algorithm:
 *   1. Read PLZ CSV to build NPA → BFS municipality number mapping
 *   2. Read operator_municipalities.json to build BFS → operator mapping
 *   3. For each unique operator, fetch the H4 standard 2026 rate from ElCom API
 *      (using one representative municipality per operator)
 *   4. Build NPA → rate mapping
 *   5. Save to JSON for use in seed.ts
 */

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const PLZ_CSV = join(__dirname, 'plz_data/AMTOVZ_CSV_WGS84/AMTOVZ_CSV_WGS84.csv')
const OP_MUNI_JSON = join(__dirname, 'elcom_operator_municipalities.json')
const ALL_MUNI_JSON = join(__dirname, 'elcom_all_municipalities.json')
const OUTPUT_JSON = join(__dirname, 'elcom_npa_rates_2026.json')

// Partial results file for resumability
const PARTIAL_JSON = join(__dirname, 'elcom_operator_rates_partial.json')

const GQL_ENDPOINT = 'https://www.prix-electricite.elcom.admin.ch/api/graphql'
const GQL_QUERY = `
  fragment F on OperatorObservation { municipality municipalityLabel operator operatorLabel value(priceComponent: $priceComponent) }
  query Observations($locale: String!, $priceComponent: PriceComponent!, $filters: ObservationFilters!, $observationKind: ObservationKind) {
    observations(locale: $locale, filters: $filters, observationKind: $observationKind) { ...F }
  }
`

async function fetchCookies(): Promise<string> {
  const res = await fetch('https://www.prix-electricite.elcom.admin.ch/fr/communes/5642', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  })
  const cookies = res.headers.getSetCookie()
  return cookies.map(c => c.split(';')[0]).join('; ')
}

async function fetchRate(
  municipalityId: string,
  operatorId: string,
  cookie: string,
): Promise<number | null> {
  const referer = `https://www.prix-electricite.elcom.admin.ch/fr/communes/${municipalityId}`
  try {
    const res = await fetch(GQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': referer,
        'Origin': 'https://www.prix-electricite.elcom.admin.ch',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Cookie': cookie,
      },
      body: JSON.stringify({
        operationName: 'Observations',
        variables: {
          locale: 'fr',
          priceComponent: 'total',
          filters: {
            municipality: [municipalityId],
            operator: [operatorId],
            period: ['2026'],
            category: 'H4',
            product: 'standard',
          },
          observationKind: 'Municipality',
        },
        query: GQL_QUERY,
      }),
    })
    if (!res.ok) {
      console.warn(`  HTTP ${res.status} for muni ${municipalityId}`)
      return null
    }
    const data = (await res.json()) as any
    const obs = data?.data?.observations
    if (Array.isArray(obs) && obs.length > 0) {
      return obs[0].value
    }
    return null
  } catch (err) {
    console.warn(`  Error fetching muni ${municipalityId}:`, err)
    return null
  }
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  // ── Step 1: Build NPA → BFS number mapping ─────────────────────────────────
  console.log('Loading PLZ data...')
  const plzCsv = readFileSync(PLZ_CSV, 'utf-8')
  // Column order: Ortschaftsname;PLZ4;Zusatzziffer;ZIP_ID;Gemeindename;BFS-Nr;Kantonskürzel;...
  const npaToBfs = new Map<string, string>()
  const lines = plzCsv.split('\n').slice(1) // skip header
  for (const line of lines) {
    if (!line.trim()) continue
    const parts = line.split(';')
    const plz4 = parts[1]?.trim()
    const bfsNr = parts[5]?.trim()
    const canton = parts[6]?.trim()
    if (plz4 && bfsNr && canton) {
      // Store: NPA → BFS number (last one wins if multiple entries per NPA)
      npaToBfs.set(plz4, bfsNr)
    }
  }
  console.log(`  Loaded ${npaToBfs.size} NPA → BFS mappings`)

  // ── Step 2: Build BFS number → operator mapping ────────────────────────────
  console.log('Loading operator-municipality data...')
  const opMuniData = JSON.parse(readFileSync(OP_MUNI_JSON, 'utf-8'))
  const pairs: Array<{ municipality: number; canton: string; operator: string }> =
    opMuniData.data.operatorMunicipalities

  // Group municipalities by operator
  const operatorMunis = new Map<string, string[]>()
  for (const pair of pairs) {
    const op = pair.operator
    const muni = String(pair.municipality)
    if (!operatorMunis.has(op)) operatorMunis.set(op, [])
    operatorMunis.get(op)!.push(muni)
  }
  console.log(`  ${pairs.length} municipality-operator pairs, ${operatorMunis.size} unique operators`)

  // Load operator names from all municipalities data for logging
  const allMuniData = JSON.parse(readFileSync(ALL_MUNI_JSON, 'utf-8'))
  const muniNames = new Map<string, string>()
  for (const m of allMuniData.data.municipalities) {
    muniNames.set(String(m.id), m.name)
  }

  // ── Step 3: Load partial results (for resumability) ────────────────────────
  const operatorRates: Record<string, number> = existsSync(PARTIAL_JSON)
    ? JSON.parse(readFileSync(PARTIAL_JSON, 'utf-8'))
    : {}

  console.log(`  ${Object.keys(operatorRates).length} operators already cached`)

  // ── Step 4: Fetch rates for each operator ──────────────────────────────────
  console.log('\nFetching operator rates from ElCom API...')
  console.log('  (This will take several minutes due to rate limiting)\n')

  let cookie = await fetchCookies()
  let processed = 0
  let successCount = 0
  let errorCount = 0
  let cookieRefreshCount = 0
  const operators = Array.from(operatorMunis.entries())

  for (const [operatorId, muniIds] of operators) {
    if (operatorRates[operatorId] !== undefined) {
      processed++
      continue // Already have this rate
    }

    // Pick the first municipality for this operator
    const muniId = muniIds[0]
    const muniName = muniNames.get(muniId) ?? muniId

    process.stdout.write(`  [${processed + 1}/${operators.length}] Op ${operatorId} (${muniName})... `)

    // Refresh cookies every 50 requests
    if (processed > 0 && processed % 50 === 0) {
      cookie = await fetchCookies()
      cookieRefreshCount++
      await sleep(3000)
    }

    const rate = await fetchRate(muniId, operatorId, cookie)

    if (rate !== null) {
      operatorRates[operatorId] = rate
      console.log(`${rate.toFixed(2)} ct/kWh`)
      successCount++
    } else {
      console.log('FAILED')
      errorCount++

      // On failure, wait longer and refresh cookies
      if (errorCount > 0 && errorCount % 5 === 0) {
        console.log(`  Waiting 10s after ${errorCount} errors...`)
        await sleep(10000)
        cookie = await fetchCookies()
      }
    }

    // Save partial results after every successful fetch
    if (processed % 10 === 0) {
      writeFileSync(PARTIAL_JSON, JSON.stringify(operatorRates, null, 2))
    }

    processed++

    // Rate limiting: 2-3 seconds between requests
    await sleep(2000 + Math.random() * 1000)
  }

  // Save final partial results
  writeFileSync(PARTIAL_JSON, JSON.stringify(operatorRates, null, 2))

  console.log(`\n✓ Fetched ${successCount} rates, ${errorCount} failed`)
  console.log(`  Cookie refreshes: ${cookieRefreshCount}`)

  // ── Step 5: Build NPA → rate mapping ──────────────────────────────────────
  console.log('\nBuilding NPA → rate mapping...')

  // BFS number → operator ID
  const bfsToOperator = new Map<string, string>()
  for (const pair of pairs) {
    bfsToOperator.set(String(pair.municipality), pair.operator)
  }

  const npaRates: Record<string, number> = {}
  let mapped = 0
  let unmapped = 0

  for (const [npa, bfsNr] of npaToBfs.entries()) {
    const operatorId = bfsToOperator.get(bfsNr)
    if (!operatorId) {
      unmapped++
      continue
    }
    const rate = operatorRates[operatorId]
    if (rate === undefined) {
      unmapped++
      continue
    }
    npaRates[npa] = Math.round(rate) // Round to nearest centime
    mapped++
  }

  console.log(`  Mapped: ${mapped} NPAs, Unmapped: ${unmapped} NPAs`)

  // ── Step 6: Save output ────────────────────────────────────────────────────
  writeFileSync(OUTPUT_JSON, JSON.stringify(npaRates, null, 2))
  console.log(`\n✅ Saved NPA rates to: ${OUTPUT_JSON}`)
  console.log(`   Total: ${Object.keys(npaRates).length} ZIP codes with rates`)

  // Show sample
  const sample = Object.entries(npaRates).slice(0, 10)
  console.log('\nSample (first 10):')
  for (const [npa, rate] of sample) {
    console.log(`  ${npa}: ${rate} ct/kWh`)
  }
}

main().catch(console.error)
