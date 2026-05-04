/**
 * Tests for validateAndShape — the pure validation layer between Anthropic's
 * tool_use output and the AiParseResult contract used by the form.
 *
 * Critical safety net: prevents hallucinated SKUs and wrong-category products
 * from reaching the calculator without a warning to the rep. Also verifies
 * the zod schema catches model drift cleanly rather than crashing.
 */

import { describe, it, expect } from 'vitest'
import { validateAndShape, type CatalogProduct } from '@/lib/ai/parse-project'

// ─── Catalog fixtures ─────────────────────────────────────────────────────────

const PANEL_A: CatalogProduct = {
  id: 'cmpan_a',
  name: 'Panel A 460Wp',
  description: null,
  category: 'PANEL',
  costRappen: 25_000,
  powerWp: 460,
}
const INVERTER_A: CatalogProduct = {
  id: 'cminv_a',
  name: 'Inverter A 5kW',
  description: null,
  category: 'INVERTER',
  costRappen: 120_000,
  powerWp: null,
}
const BATTERY_A: CatalogProduct = {
  id: 'cmbat_a',
  name: 'Battery A 5kWh',
  description: null,
  category: 'BATTERY',
  costRappen: 800_000,
  powerWp: null,
}
const PAC_MACHINE_A: CatalogProduct = {
  id: 'cmpac_a',
  name: 'BUDERUS WLW176i 6kW',
  description: null,
  category: 'PAC_MACHINE',
  costRappen: 1_500_000,
  powerWp: null,
}

const PV_CATALOG: CatalogProduct[] = [PANEL_A, INVERTER_A, BATTERY_A]
const PAC_CATALOG: CatalogProduct[] = [PAC_MACHINE_A]
const ALL_CATALOG: CatalogProduct[] = [PANEL_A, INVERTER_A, BATTERY_A, PAC_MACHINE_A]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validProposal(tier: 'essentiel' | 'recommande' | 'premium', items: { productId: string; quantity: number }[]) {
  return {
    tier,
    label: tier === 'essentiel' ? 'Essentiel' : tier === 'recommande' ? 'Recommandé' : 'Premium',
    rationale: 'Test',
    items,
    warnings: [],
  }
}

// ─── zod schema parsing (model-drift safety net) ──────────────────────────────

describe('validateAndShape — zod schema parsing', () => {
  it('returns clean error result when raw input is null', () => {
    const result = validateAndShape(null, PV_CATALOG, 'PV')
    expect(result.proposals).toEqual([])
    expect(result.globalWarnings[0]).toMatch(/Format inattendu/i)
  })

  it('returns clean error result when proposals is wrong type', () => {
    const result = validateAndShape({ proposals: 'not an array' }, PV_CATALOG, 'PV')
    expect(result.proposals).toEqual([])
    expect(result.globalWarnings[0]).toMatch(/Format inattendu/i)
  })

  it('returns clean error result when a proposal has invalid tier', () => {
    const result = validateAndShape(
      { proposals: [{ ...validProposal('recommande', []), tier: 'GOLD' }] },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals).toEqual([])
    expect(result.globalWarnings[0]).toMatch(/Format inattendu/i)
  })

  it('passes through completely empty input as a valid (but empty) result', () => {
    const result = validateAndShape({}, PV_CATALOG, 'PV')
    expect(result.proposals).toEqual([])
    expect(result.globalWarnings).toContain(
      "Aucune proposition n'a pu être générée — réessayez avec plus de détails."
    )
  })
})

// ─── Catalog validation (drop unknown SKU) ────────────────────────────────────

describe('validateAndShape — catalog validation', () => {
  it('drops items with unknown productId and adds a warning', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('recommande', [
            { productId: PANEL_A.id, quantity: 20 },
            { productId: 'GHOST_SKU_DOES_NOT_EXIST', quantity: 1 },
          ]),
        ],
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].items).toHaveLength(1)
    expect(result.proposals[0].items[0].productId).toBe(PANEL_A.id)
    expect(result.proposals[0].warnings.some((w) => w.includes('Produit inconnu'))).toBe(true)
  })

  it('keeps all items when all productIds are valid', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('recommande', [
            { productId: PANEL_A.id, quantity: 20 },
            { productId: INVERTER_A.id, quantity: 1 },
            { productId: BATTERY_A.id, quantity: 1 },
          ]),
        ],
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals[0].items).toHaveLength(3)
    expect(result.proposals[0].warnings.length).toBe(0)
  })

  it('coerces quantity to integer and floors to >= 1', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('recommande', [
            { productId: PANEL_A.id, quantity: 20.7 }, // floored to 20
            { productId: INVERTER_A.id, quantity: 0 }, // bumped to 1
          ]),
        ],
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals[0].items[0].quantity).toBe(20)
    expect(result.proposals[0].items[1].quantity).toBe(1)
  })
})

// ─── Cross-category filter (PV/PAC) ───────────────────────────────────────────

describe('validateAndShape — cross-category filter', () => {
  it('drops PAC products on a PV scenario with a warning', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('recommande', [
            { productId: PANEL_A.id, quantity: 10 },
            { productId: PAC_MACHINE_A.id, quantity: 1 }, // wrong category
          ]),
        ],
      },
      ALL_CATALOG,
      'PV'
    )
    expect(result.proposals[0].items.map((i) => i.productId)).toEqual([PANEL_A.id])
    expect(
      result.proposals[0].warnings.some((w) => w.includes('Produit PAC') && w.includes('PV'))
    ).toBe(true)
  })

  it('drops PV products on a PAC scenario with a warning', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('recommande', [
            { productId: PAC_MACHINE_A.id, quantity: 1 },
            { productId: PANEL_A.id, quantity: 10 }, // wrong category
            { productId: BATTERY_A.id, quantity: 1 }, // wrong category
          ]),
        ],
      },
      ALL_CATALOG,
      'PAC'
    )
    expect(result.proposals[0].items.map((i) => i.productId)).toEqual([PAC_MACHINE_A.id])
    expect(result.proposals[0].warnings.filter((w) => w.includes('Produit PV'))).toHaveLength(2)
  })
})

// ─── Tier sorting ─────────────────────────────────────────────────────────────

describe('validateAndShape — tier sorting', () => {
  it('sorts proposals as essentiel → recommande → premium regardless of input order', () => {
    const result = validateAndShape(
      {
        proposals: [
          validProposal('premium', [{ productId: PANEL_A.id, quantity: 25 }]),
          validProposal('essentiel', [{ productId: PANEL_A.id, quantity: 15 }]),
          validProposal('recommande', [{ productId: PANEL_A.id, quantity: 20 }]),
        ],
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals.map((p) => p.tier)).toEqual([
      'essentiel',
      'recommande',
      'premium',
    ])
  })

  it('sorts a 1-proposal result without crashing', () => {
    const result = validateAndShape(
      {
        proposals: [validProposal('recommande', [{ productId: PANEL_A.id, quantity: 20 }])],
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.proposals).toHaveLength(1)
    expect(result.proposals[0].tier).toBe('recommande')
  })
})

// ─── Customer info + roof attributes ──────────────────────────────────────────

describe('validateAndShape — customer info pass-through', () => {
  it('passes through customerInfo when present', () => {
    const result = validateAndShape(
      {
        proposals: [validProposal('recommande', [])],
        customerInfo: {
          name: 'Famille Müller',
          siteAddress: 'Rue du Lac 1, Yverdon',
          annualConsumptionKwh: 4500,
        },
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.customerInfo.name).toBe('Famille Müller')
    expect(result.customerInfo.siteAddress).toBe('Rue du Lac 1, Yverdon')
    expect(result.customerInfo.annualConsumptionKwh).toBe(4500)
  })

  it('strips roofType/roofSlope on PAC scenarios (irrelevant)', () => {
    const result = validateAndShape(
      {
        proposals: [validProposal('recommande', [])],
        roofType: 'tuile',
        roofSlope: 'simple',
      },
      PAC_CATALOG,
      'PAC'
    )
    expect(result.roofType).toBeUndefined()
    expect(result.roofSlope).toBeUndefined()
  })

  it('keeps roofType/roofSlope on PV scenarios', () => {
    const result = validateAndShape(
      {
        proposals: [validProposal('recommande', [])],
        roofType: 'tuile',
        roofSlope: 'moyen',
      },
      PV_CATALOG,
      'PV'
    )
    expect(result.roofType).toBe('tuile')
    expect(result.roofSlope).toBe('moyen')
  })

  it('passes tokensUsed through', () => {
    const result = validateAndShape({}, PV_CATALOG, 'PV', 1234)
    expect(result.tokensUsed).toBe(1234)
  })
})
