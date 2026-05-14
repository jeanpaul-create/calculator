/**
 * Fuel calorific values from suissetec V6.6 (Calcul puissance sheet rows
 * 83-98). Used in the heat-load formula's numerator:
 *   heat_kW = avg_consumption × caloric_value × efficiency / hours
 * where caloric_value is in kWh/{unit-of-consumption}.
 *
 * 'kind' groups variants of the same physical fuel (e.g. "Mazout en l"
 * and "Mazout en kg" are both kind="Mazout") — UI can group by kind for
 * the dropdown.
 */

export type Fuel = {
  /** Stable identifier (used in DB, API, calc lookups). */
  key: string
  /** Display label (matches xlsx; appears on cantonal forms). */
  label: string
  /** Caloric value in kWh per {unit}. */
  caloric: number
  /** Unit of caloric measurement (e.g. "[kWh/Litre]"). */
  caloricUnit: string
  /** Unit of fuel consumption (e.g. "[Litre/a]"). */
  unit: string
  /** Logical kind: 'Mazout' | 'Gaz' | 'Pellets' | 'Bois ...' | 'Electricité'. */
  kind: string
}

export const FUELS: readonly Fuel[] = [
  {
    "key": "mazout_en_l",
    "label": "Mazout en l",
    "caloric": 9.91,
    "caloricUnit": "[kWh/Litre]",
    "unit": "[Litre/a]",
    "kind": "Mazout"
  },
  {
    "key": "mazout_en_kg",
    "label": "Mazout en kg",
    "caloric": 11.86,
    "caloricUnit": "[kWh/kg]",
    "unit": "[kg/a]",
    "kind": "Mazout"
  },
  {
    "key": "gaz_en_m3",
    "label": "Gaz en m3",
    "caloric": 10.04,
    "caloricUnit": "[kWh/m3]",
    "unit": "[m3/a]",
    "kind": "Gaz"
  },
  {
    "key": "gaz_en_kwh",
    "label": "Gaz en kWh",
    "caloric": 1,
    "caloricUnit": "[kWh/kWh]",
    "unit": "[kWh/a]",
    "kind": "Gaz"
  },
  {
    "key": "bois_resineux_en_stere",
    "label": "Bois (résineux) en stère",
    "caloric": 1538.4615384615386,
    "caloricUnit": "[kWh/Stère]",
    "unit": "[Stère/a]",
    "kind": "Bois (résineux)"
  },
  {
    "key": "bois_hetre_chene_en_stere",
    "label": "Bois (hêtre/chêne) en stère",
    "caloric": 2000,
    "caloricUnit": "[kWh/Stère]",
    "unit": "[Stère/a]",
    "kind": "Bois (hêtre/chêne)"
  },
  {
    "key": "bois_bois_dur_70_resineux_30_en_stere",
    "label": "Bois (bois dur 70%, résineux 30%) en stère",
    "caloric": 1861.5384615384614,
    "caloricUnit": "[kWh/Stère]",
    "unit": "[Stère/a]",
    "kind": "Bois (bois dur 70%, résineux 30%) en stère"
  },
  {
    "key": "bois_bois_dur_50_resineux_50_en_stere",
    "label": "Bois (bois dur 50%, résineux 50%) en stère",
    "caloric": 1769.2307692307693,
    "caloricUnit": "[kWh/Stère]",
    "unit": "[Stère/a]",
    "kind": "Bois (bois dur 50%, résineux 50%) en stère"
  },
  {
    "key": "bois_bois_dur_30_resineux_70_en_stere",
    "label": "Bois (bois dur 30%, résineux 70%) en stère",
    "caloric": 1676.923076923077,
    "caloricUnit": "[kWh/Stère]",
    "unit": "[Stère/a]",
    "kind": "Bois (bois dur 30%, résineux 70%) en stère"
  },
  {
    "key": "plaquettes_forestieres_resineux_en_kg",
    "label": "Plaquettes forestières (résineux) en kg",
    "caloric": 5.38,
    "caloricUnit": "[kWh/kg]",
    "unit": "[kg/a]",
    "kind": "Plaquettes forestières (résineux) "
  },
  {
    "key": "plaquettes_forestieres_resineux_en_m3",
    "label": "Plaquettes forestières (résineux) en m3",
    "caloric": 885.955752212389,
    "caloricUnit": "[kWh/m3]",
    "unit": "[m3/a]",
    "kind": "Plaquettes forestières (résineux) "
  },
  {
    "key": "plaquettes_forestieres_hetre_chene_en_kg",
    "label": "Plaquettes forestières (hêtre/chêne) en kg",
    "caloric": 5.03,
    "caloricUnit": "[kWh/kg]",
    "unit": "[kg/a]",
    "kind": "Plaquettes forestières (hêtre/chêne)"
  },
  {
    "key": "plaquettes_forestieres_hetre_chene_en_m3",
    "label": "Plaquettes forestières (hêtre/chêne) en m3",
    "caloric": 1149.4252873563219,
    "caloricUnit": "[kWh/m3]",
    "unit": "[m3/a]",
    "kind": "Plaquettes forestières (hêtre/chêne)"
  },
  {
    "key": "pellets_en_kg",
    "label": "Pellets en kg",
    "caloric": 5,
    "caloricUnit": "[kWh/kg]",
    "unit": "[kg/a]",
    "kind": "Pellets"
  },
  {
    "key": "pellets_en_m3",
    "label": "Pellets en m3",
    "caloric": 3250,
    "caloricUnit": "[kWh/m3]",
    "unit": "[m3/a]",
    "kind": "Pellets"
  },
  {
    "key": "besoins_electriques_en_kwh",
    "label": "Besoins électriques en kWh",
    "caloric": 1,
    "caloricUnit": "[kWh/kWh]",
    "unit": "[kWh/a]",
    "kind": "Electricité"
  }
] as const

export const FUEL_KEYS = [
  'mazout_en_l',
  'mazout_en_kg',
  'gaz_en_m3',
  'gaz_en_kwh',
  'bois_resineux_en_stere',
  'bois_hetre_chene_en_stere',
  'bois_bois_dur_70_resineux_30_en_stere',
  'bois_bois_dur_50_resineux_50_en_stere',
  'bois_bois_dur_30_resineux_70_en_stere',
  'plaquettes_forestieres_resineux_en_kg',
  'plaquettes_forestieres_resineux_en_m3',
  'plaquettes_forestieres_hetre_chene_en_kg',
  'plaquettes_forestieres_hetre_chene_en_m3',
  'pellets_en_kg',
  'pellets_en_m3',
  'besoins_electriques_en_kwh',
] as const

export type FuelKey = (typeof FUEL_KEYS)[number]

export function getFuel(key: string): Fuel {
  const found = FUELS.find((f) => f.key === key)
  if (!found) throw new Error(`Unknown fuel: ${key}`)
  return found
}
