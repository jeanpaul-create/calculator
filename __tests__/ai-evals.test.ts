/**
 * AI evaluation suite — golden-set descriptions exercised against the
 * deterministic post-Anthropic pipeline (validateAndShape).
 *
 * Why this exists:
 *   - The Anthropic call is non-deterministic (model output varies per call,
 *     and across model upgrades). We can't snapshot raw tool_use output.
 *   - But the VALIDATOR is deterministic. Given a representative
 *     tool_use payload, we can lock in expected invariants on the final
 *     AiParseResult shape (tier order, dropped SKUs, warnings surfaced).
 *
 * What this catches:
 *   - Regressions in validateAndShape() (e.g., an accidental change to the
 *     cross-category filter that lets PAC products through on PV quotes)
 *   - Schema drift if we evolve AiProposal / AiParseResult
 *
 * What this does NOT catch:
 *   - Anthropic model output regressions (model returns weird tool inputs)
 *     → for that, you need a live-API eval. See "Live eval extension" at
 *       the bottom of this file.
 *
 * Each golden case below represents a real-world rep description we expect
 * the AI to handle gracefully. The mockedToolInput represents a CORRECTLY
 * SHAPED model output for that description. The asserts capture the
 * invariants we want to hold regardless of model variation.
 */

import { describe, it, expect } from 'vitest'
import {
  validateAndShape,
  type CatalogProduct,
} from '@/lib/ai/parse-project'

// ─── Shared seed catalog (mimics a small but realistic I.ON setup) ────────────

const PV_CATALOG: CatalogProduct[] = [
  { id: 'pv_panel_basic', name: 'Panel Basic 410Wp', description: null, category: 'PANEL', costRappen: 18_000, powerWp: 410 },
  { id: 'pv_panel_mid', name: 'Panel Mid 460Wp', description: null, category: 'PANEL', costRappen: 24_000, powerWp: 460 },
  { id: 'pv_panel_premium', name: 'Panel Premium 500Wp', description: null, category: 'PANEL', costRappen: 32_000, powerWp: 500 },
  { id: 'pv_inv_5', name: 'Inverter 5kW', description: null, category: 'INVERTER', costRappen: 95_000, powerWp: null },
  { id: 'pv_inv_10', name: 'Inverter 10kW', description: null, category: 'INVERTER', costRappen: 145_000, powerWp: null },
  { id: 'pv_inv_15', name: 'Inverter 15kW', description: null, category: 'INVERTER', costRappen: 180_000, powerWp: null },
  { id: 'pv_bat_5', name: 'Battery 5kWh', description: null, category: 'BATTERY', costRappen: 600_000, powerWp: null },
  { id: 'pv_bat_10', name: 'Battery 10kWh', description: null, category: 'BATTERY', costRappen: 1_000_000, powerWp: null },
  { id: 'pv_evc', name: 'EV Charger 11kW', description: null, category: 'EV_CHARGER', costRappen: 200_000, powerWp: null },
  { id: 'pv_mount_tile', name: 'Mounting Tuile', description: null, category: 'MOUNTING', costRappen: 5_000, powerWp: null },
]

const PAC_CATALOG: CatalogProduct[] = [
  { id: 'pac_buderus_6', name: 'BUDERUS WLW176i 6kW', description: null, category: 'PAC_MACHINE', costRappen: 1_500_000, powerWp: null },
  { id: 'pac_vaillant_8', name: 'VAILLANT 8kW', description: null, category: 'PAC_MACHINE', costRappen: 1_800_000, powerWp: null },
  { id: 'pac_acc_vase', name: "Vase d'expansion", description: null, category: 'PAC_ACCESSORY', costRappen: 50_000, powerWp: null },
  { id: 'pac_elec_resistance', name: 'Résistance électrique', description: null, category: 'PAC_ELECTRICITE', costRappen: 30_000, powerWp: null },
  { id: 'pac_montage', name: 'Montage et mise en service', description: null, category: 'PAC_MONTAGE', costRappen: 250_000, powerWp: null },
  { id: 'pac_admin', name: 'Démarche administrative', description: null, category: 'PAC_ADMIN', costRappen: 80_000, powerWp: null },
]

// ─── Golden-set cases ─────────────────────────────────────────────────────────

interface EvalCase {
  description: string
  scenarioType: 'PV' | 'PAC'
  catalog: CatalogProduct[]
  mockedToolInput: unknown
  /** Hand-asserted invariants the result must satisfy. */
  expect: (result: ReturnType<typeof validateAndShape>) => void
}

const cases: EvalCase[] = [
  // ─── Case 1: Standard 10 kWp residential PV with battery ─────────────────
  {
    description: 'Famille Müller à Yverdon, toit en tuile, 10 kWp avec batterie',
    scenarioType: 'PV',
    catalog: PV_CATALOG,
    mockedToolInput: {
      proposals: [
        {
          tier: 'essentiel',
          label: 'Essentiel',
          rationale: 'Système le plus abordable pour 8 kWp',
          items: [
            { productId: 'pv_panel_basic', quantity: 20 },
            { productId: 'pv_inv_10', quantity: 1 },
          ],
          warnings: [],
        },
        {
          tier: 'recommande',
          label: 'Recommandé',
          rationale: 'Système équilibré 10 kWp avec batterie',
          items: [
            { productId: 'pv_panel_mid', quantity: 22 },
            { productId: 'pv_inv_10', quantity: 1 },
            { productId: 'pv_bat_5', quantity: 1 },
          ],
          warnings: [],
        },
        {
          tier: 'premium',
          label: 'Premium',
          rationale: 'Maximisation autoconsommation + grosse batterie',
          items: [
            { productId: 'pv_panel_premium', quantity: 24 },
            { productId: 'pv_inv_15', quantity: 1 },
            { productId: 'pv_bat_10', quantity: 1 },
            { productId: 'pv_evc', quantity: 1 },
          ],
          warnings: [],
        },
      ],
      customerInfo: { name: 'Famille Müller', siteAddress: 'Yverdon' },
      roofType: 'tuile',
    },
    expect: (r) => {
      expect(r.proposals).toHaveLength(3)
      expect(r.proposals.map((p) => p.tier)).toEqual(['essentiel', 'recommande', 'premium'])
      expect(r.customerInfo.name).toBe('Famille Müller')
      expect(r.roofType).toBe('tuile')
      // Premium should be the only tier with EV charger
      const tiersWithEvc = r.proposals.filter((p) =>
        p.items.some((i) => i.category === 'EV_CHARGER')
      )
      expect(tiersWithEvc.map((p) => p.tier)).toEqual(['premium'])
      // Recommandé should include a battery
      const reco = r.proposals.find((p) => p.tier === 'recommande')!
      expect(reco.items.some((i) => i.category === 'BATTERY')).toBe(true)
      // No warnings — the AI used valid catalog IDs
      expect(r.globalWarnings).toEqual([])
    },
  },

  // ─── Case 2: PAC heat pump replacement ───────────────────────────────────
  {
    description: 'Remplacer chaudière mazout par PAC à Genève, maison 180 m²',
    scenarioType: 'PAC',
    catalog: PAC_CATALOG,
    mockedToolInput: {
      proposals: [
        {
          tier: 'essentiel',
          label: 'Essentiel',
          rationale: 'PAC abordable BUDERUS 6kW',
          items: [
            { productId: 'pac_buderus_6', quantity: 1 },
            { productId: 'pac_montage', quantity: 1 },
            { productId: 'pac_admin', quantity: 1 },
          ],
          warnings: [],
        },
        {
          tier: 'recommande',
          label: 'Recommandé',
          rationale: 'Installation complète VAILLANT 8kW',
          items: [
            { productId: 'pac_vaillant_8', quantity: 1 },
            { productId: 'pac_acc_vase', quantity: 1 },
            { productId: 'pac_elec_resistance', quantity: 1 },
            { productId: 'pac_montage', quantity: 1 },
            { productId: 'pac_admin', quantity: 1 },
          ],
          warnings: [],
        },
      ],
      customerInfo: { siteAddress: 'Genève' },
    },
    expect: (r) => {
      expect(r.proposals.length).toBeGreaterThanOrEqual(1)
      // All proposals should have exactly ONE PAC_MACHINE
      for (const p of r.proposals) {
        const machines = p.items.filter((i) => i.category === 'PAC_MACHINE')
        expect(machines).toHaveLength(1)
      }
      // No PV roofType on PAC scenarios
      expect(r.roofType).toBeUndefined()
    },
  },

  // ─── Case 3: AI hallucinates a SKU not in catalog ────────────────────────
  {
    description: 'PV 8 kWp standard',
    scenarioType: 'PV',
    catalog: PV_CATALOG,
    mockedToolInput: {
      proposals: [
        {
          tier: 'recommande',
          label: 'Recommandé',
          rationale: 'Système 8 kWp standard',
          items: [
            { productId: 'pv_panel_mid', quantity: 18 },
            { productId: 'GHOST_SKU_DOES_NOT_EXIST', quantity: 1 }, // hallucinated
            { productId: 'pv_inv_10', quantity: 1 },
          ],
          warnings: [],
        },
      ],
    },
    expect: (r) => {
      expect(r.proposals).toHaveLength(1)
      // Bad SKU dropped, good ones kept
      expect(r.proposals[0].items.map((i) => i.productId)).toEqual([
        'pv_panel_mid',
        'pv_inv_10',
      ])
      // Warning surfaced
      expect(r.proposals[0].warnings.some((w) => w.includes('Produit inconnu'))).toBe(true)
    },
  },

  // ─── Case 4: AI mixes PAC product into a PV scenario ─────────────────────
  {
    description: 'PV avec batterie',
    scenarioType: 'PV',
    catalog: [...PV_CATALOG, ...PAC_CATALOG],
    mockedToolInput: {
      proposals: [
        {
          tier: 'recommande',
          label: 'Recommandé',
          rationale: 'PV 10 kWp',
          items: [
            { productId: 'pv_panel_mid', quantity: 22 },
            { productId: 'pv_inv_10', quantity: 1 },
            { productId: 'pac_buderus_6', quantity: 1 }, // wrong category!
          ],
          warnings: [],
        },
      ],
    },
    expect: (r) => {
      // PAC machine dropped from PV scenario
      const productIds = r.proposals[0].items.map((i) => i.productId)
      expect(productIds).not.toContain('pac_buderus_6')
      expect(r.proposals[0].warnings.some((w) => w.includes('Produit PAC'))).toBe(true)
    },
  },

  // ─── Case 5: Single-tier output (rep over-specified the request) ─────────
  {
    description: 'Donnez-moi exactement 5 kWp sans batterie',
    scenarioType: 'PV',
    catalog: PV_CATALOG,
    mockedToolInput: {
      proposals: [
        {
          tier: 'recommande',
          label: 'Recommandé',
          rationale: 'Exactement 5 kWp, pas de batterie comme demandé',
          items: [
            { productId: 'pv_panel_mid', quantity: 11 },
            { productId: 'pv_inv_5', quantity: 1 },
          ],
          warnings: [],
        },
      ],
    },
    expect: (r) => {
      expect(r.proposals).toHaveLength(1)
      expect(r.proposals[0].tier).toBe('recommande')
      // No battery as requested
      expect(r.proposals[0].items.some((i) => i.category === 'BATTERY')).toBe(false)
    },
  },

  // ─── Case 6: Empty proposals (AI gave up) ────────────────────────────────
  {
    description: 'aaa', // useless input
    scenarioType: 'PV',
    catalog: PV_CATALOG,
    mockedToolInput: {
      proposals: [],
      globalWarnings: ['Description trop courte pour générer une proposition.'],
    },
    expect: (r) => {
      expect(r.proposals).toHaveLength(0)
      expect(r.globalWarnings.length).toBeGreaterThanOrEqual(1)
      expect(
        r.globalWarnings.some((w) => w.includes('réessayez') || w.includes('Description'))
      ).toBe(true)
    },
  },

  // ─── Case 7: Malformed tool input (model drift) ──────────────────────────
  {
    description: '10 kWp standard',
    scenarioType: 'PV',
    catalog: PV_CATALOG,
    mockedToolInput: {
      // Missing required fields, wrong types — simulates a future model going off-script
      proposals: [
        { tier: 'GOLD', label: 'Gold', items: 'not-an-array' },
      ],
    },
    expect: (r) => {
      expect(r.proposals).toHaveLength(0)
      expect(r.globalWarnings[0]).toMatch(/Format inattendu/i)
    },
  },
]

// ─── Run all cases ────────────────────────────────────────────────────────────

describe('AI evaluation suite — golden-set descriptions', () => {
  for (const c of cases) {
    it(c.description, () => {
      const result = validateAndShape(c.mockedToolInput, c.catalog, c.scenarioType)
      c.expect(result)
    })
  }

  it('all cases together cover the documented invariants', () => {
    // Meta-test: ensures the case set covers the surface area we care about.
    const tiers = new Set<string>()
    const scenarios = new Set<string>()
    for (const c of cases) {
      scenarios.add(c.scenarioType)
      const input = c.mockedToolInput as { proposals?: { tier: string }[] }
      for (const p of input.proposals ?? []) tiers.add(p.tier)
    }
    expect(scenarios).toContain('PV')
    expect(scenarios).toContain('PAC')
    expect(tiers.size).toBeGreaterThanOrEqual(3) // essentiel + recommande + premium
  })
})

/**
 * ─── Live eval extension (TODO) ──────────────────────────────────────────────
 *
 * To extend this suite with REAL Anthropic API calls (catches model
 * regressions, not just validator regressions):
 *
 *   1. Add a `runLiveEval` flag (e.g. process.env.AI_EVAL_LIVE === '1').
 *   2. For each case, instead of using mockedToolInput, call
 *      parseProjectDescription({ scenarioType, description }) directly.
 *   3. Apply the same `expect(...)` invariants to the real result.
 *   4. Run with `AI_EVAL_LIVE=1 npx vitest run __tests__/ai-evals.test.ts`
 *      before each Anthropic model upgrade.
 *
 * Cost note: ~$0.01 per case × 7 cases × N runs = small but measurable.
 * Don't run on every CI build — gate behind the env flag.
 */
