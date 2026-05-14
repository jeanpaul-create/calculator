/**
 * Generator efficiency table from suissetec V6.6 (Calcul puissance sheet
 * rows 122-129). Indexed by (generator type, ECS source). 'Séparé' means
 * DHW from a separate source (PAC, solar, electric); 'Avec chauffage'
 * means DHW is produced by the same boiler.
 *
 * Note on "Radiateur électrique direct": only 'Séparé' has a value
 * because direct electric resistance heating doesn't produce DHW by
 * itself — so the 'with-heating' case is undefined (null).
 */

export type Generator = {
  /** Stable identifier. */
  key: string
  /** Display label (matches xlsx, displayed on cantonal forms). */
  label: string
  /** Generator efficiency [-] when DHW is produced separately. */
  efficiencySepare: number
  /** Generator efficiency [-] when DHW is produced by the same generator.
   *  null means "not applicable" (e.g. direct electric heating). */
  efficiencyWithHeating: number | null
}

export const GENERATORS: readonly Generator[] = [
  {
    "key": "chaudiere_mazout_ou_gaz_ancien_modele",
    "label": "Chaudière mazout ou gaz, ancien modèle",
    "efficiencySepare": 0.85,
    "efficiencyWithHeating": 0.8
  },
  {
    "key": "chaudiere_mazout_ou_gaz_nouveau_modele_a_condensation",
    "label": "Chaudière mazout ou gaz, nouveau modèle à condensation",
    "efficiencySepare": 0.95,
    "efficiencyWithHeating": 0.9
  },
  {
    "key": "chaudiere_a_bois_ancien_modele",
    "label": "Chaudière à bois, ancien modèle",
    "efficiencySepare": 0.65,
    "efficiencyWithHeating": 0.6
  },
  {
    "key": "chaudiere_a_bois_nouveau_modele",
    "label": "Chaudière à bois, nouveau modèle",
    "efficiencySepare": 0.75,
    "efficiencyWithHeating": 0.7
  },
  {
    "key": "copeaux_de_bois",
    "label": "Copeaux de bois",
    "efficiencySepare": 0.75,
    "efficiencyWithHeating": 0.7
  },
  {
    "key": "chaudiere_a_pellets",
    "label": "Chaudière à pellets",
    "efficiencySepare": 0.75,
    "efficiencyWithHeating": 0.7
  },
  {
    "key": "chaudiere_electrique",
    "label": "Chaudière électrique",
    "efficiencySepare": 0.9,
    "efficiencyWithHeating": 0.85
  },
  {
    "key": "radiateur_electrique_direct",
    "label": "Radiateur électrique direct",
    "efficiencySepare": 0.95,
    "efficiencyWithHeating": null
  }
] as const

export const GENERATOR_KEYS = [
  'chaudiere_mazout_ou_gaz_ancien_modele',
  'chaudiere_mazout_ou_gaz_nouveau_modele_a_condensation',
  'chaudiere_a_bois_ancien_modele',
  'chaudiere_a_bois_nouveau_modele',
  'copeaux_de_bois',
  'chaudiere_a_pellets',
  'chaudiere_electrique',
  'radiateur_electrique_direct',
] as const

export type GeneratorKey = (typeof GENERATOR_KEYS)[number]

export function getGenerator(key: string): Generator {
  const found = GENERATORS.find((g) => g.key === key)
  if (!found) throw new Error(`Unknown generator: ${key}`)
  return found
}
