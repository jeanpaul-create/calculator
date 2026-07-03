/**
 * Cantonal heat-pump replacement subsidies (Programme Bâtiments / HFM model).
 *
 * Each canton publishes its own base + per-kW formula, revised yearly (January).
 * Only VERIFIED entries are returned to callers — the UI must never show an
 * unverified CHF amount to a customer. Cantons without an entry return null,
 * which the UI renders as "subventions cantonales possibles — à vérifier".
 *
 * ANNUAL UPDATE PROCEDURE (each January):
 *   1. Check the canton's Programme Bâtiments conditions PDF (see source URLs).
 *   2. Update base/perKw amounts + year + source.
 *   3. Run __tests__/subsidies.test.ts (update expected values).
 *
 * The federal Pronovo PRU for PV lives in lib/pricing.ts (calculatePronovoSubsidy).
 */

export type PacSubsidyType = 'air-eau' | 'sol-eau'

export interface HeatPumpSubsidyRule {
  canton: string
  /** Base amount in Rappen — PAC air-eau replacing oil/gas/fixed-electric */
  airWaterBaseRappen: number
  /** Per-kW component in Rappen/kW (thermal), air-eau */
  airWaterPerKwRappen: number
  /** Base amount in Rappen — PAC sol-eau (geothermal) / eau-eau */
  groundWaterBaseRappen: number
  /** Per-kW component in Rappen/kW (thermal), sol-eau */
  groundWaterPerKwRappen: number
  /** Max thermal power the formula covers, kW (null = no known cap) */
  maxKw: number | null
  /** Subsidy year the amounts were verified for */
  year: number
  /** Official conditions document / page */
  source: string
}

/**
 * Verified cantonal rules. Add cantons here ONLY with amounts checked against
 * the official conditions document — reps quote these numbers to customers.
 */
const RULES: Record<string, HeatPumpSubsidyRule> = {
  VD: {
    canton: 'VD',
    // Programme Bâtiments VD 2026: M air-eau CHF 3'500 + 150/kW (≤70 kW);
    // sol-eau CHF 5'000 + 300/kW. Replacement of mazout/gaz/électrique fixe;
    // application must be filed BEFORE signing the works contract.
    airWaterBaseRappen: 350_000,
    airWaterPerKwRappen: 15_000,
    groundWaterBaseRappen: 500_000,
    groundWaterPerKwRappen: 30_000,
    maxKw: 70,
    year: 2026,
    source:
      'https://www.vd.ch/environnement/energie/subventions-programme-batiments (conditions PB 2026)',
  },
}

export interface HeatPumpSubsidyResult {
  subsidyRappen: number
  rule: HeatPumpSubsidyRule
}

/**
 * Compute the cantonal subsidy for a heat-pump replacement.
 *
 * @param canton - Two-letter canton code (e.g. 'VD'); case-insensitive
 * @param pacType - 'air-eau' (aerothermal) or 'sol-eau' (geothermal)
 * @param thermalKw - Design heat load in kW (from the heat-load calculation);
 *                    clamped to the canton's formula cap when one exists
 * @returns Subsidy + the rule used, or null when the canton has no verified
 *          entry (UI should show a "check locally" hint, never CHF 0)
 */
export function calculateHeatPumpSubsidy(
  canton: string,
  pacType: PacSubsidyType,
  thermalKw: number
): HeatPumpSubsidyResult | null {
  const rule = RULES[canton.trim().toUpperCase()]
  if (!rule) return null
  if (!Number.isFinite(thermalKw) || thermalKw <= 0) return null

  const kw = rule.maxKw != null ? Math.min(thermalKw, rule.maxKw) : thermalKw
  const subsidyRappen =
    pacType === 'sol-eau'
      ? Math.round(rule.groundWaterBaseRappen + kw * rule.groundWaterPerKwRappen)
      : Math.round(rule.airWaterBaseRappen + kw * rule.airWaterPerKwRappen)

  return { subsidyRappen, rule }
}

/** Cantons with a verified subsidy entry (for UI availability checks). */
export function subsidyCantons(): string[] {
  return Object.keys(RULES)
}
