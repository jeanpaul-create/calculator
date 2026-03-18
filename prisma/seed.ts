import { PrismaClient, ProductCategory, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Swiss electricity rates by canton (ElCom averages, Rappen/kWh) ──────────
const SWISS_RATES: Array<{ canton: string; zipPrefix: string; rateRappenPerKwh: number }> = [
  // Zürich
  { canton: 'ZH', zipPrefix: '80', rateRappenPerKwh: 26 },
  { canton: 'ZH', zipPrefix: '81', rateRappenPerKwh: 26 },
  { canton: 'ZH', zipPrefix: '82', rateRappenPerKwh: 27 },
  { canton: 'ZH', zipPrefix: '83', rateRappenPerKwh: 26 },
  { canton: 'ZH', zipPrefix: '84', rateRappenPerKwh: 25 },
  { canton: 'ZH', zipPrefix: '85', rateRappenPerKwh: 26 },
  { canton: 'ZH', zipPrefix: '86', rateRappenPerKwh: 27 },
  // Bern
  { canton: 'BE', zipPrefix: '30', rateRappenPerKwh: 25 },
  { canton: 'BE', zipPrefix: '31', rateRappenPerKwh: 24 },
  { canton: 'BE', zipPrefix: '32', rateRappenPerKwh: 25 },
  { canton: 'BE', zipPrefix: '33', rateRappenPerKwh: 26 },
  { canton: 'BE', zipPrefix: '34', rateRappenPerKwh: 25 },
  { canton: 'BE', zipPrefix: '35', rateRappenPerKwh: 24 },
  // Luzern
  { canton: 'LU', zipPrefix: '60', rateRappenPerKwh: 23 },
  { canton: 'LU', zipPrefix: '61', rateRappenPerKwh: 22 },
  // Uri
  { canton: 'UR', zipPrefix: '68', rateRappenPerKwh: 21 },
  // Schwyz
  { canton: 'SZ', zipPrefix: '64', rateRappenPerKwh: 22 },
  // Obwalden
  { canton: 'OW', zipPrefix: '60', rateRappenPerKwh: 20 },
  // Nidwalden
  { canton: 'NW', zipPrefix: '63', rateRappenPerKwh: 21 },
  // Glarus
  { canton: 'GL', zipPrefix: '87', rateRappenPerKwh: 20 },
  // Zug
  { canton: 'ZG', zipPrefix: '63', rateRappenPerKwh: 22 },
  // Fribourg
  { canton: 'FR', zipPrefix: '17', rateRappenPerKwh: 24 },
  { canton: 'FR', zipPrefix: '16', rateRappenPerKwh: 23 },
  // Solothurn
  { canton: 'SO', zipPrefix: '45', rateRappenPerKwh: 25 },
  { canton: 'SO', zipPrefix: '46', rateRappenPerKwh: 25 },
  // Basel-Stadt
  { canton: 'BS', zipPrefix: '40', rateRappenPerKwh: 27 },
  // Basel-Landschaft
  { canton: 'BL', zipPrefix: '41', rateRappenPerKwh: 26 },
  { canton: 'BL', zipPrefix: '42', rateRappenPerKwh: 26 },
  // Schaffhausen
  { canton: 'SH', zipPrefix: '82', rateRappenPerKwh: 26 },
  // Appenzell Ausserrhoden
  { canton: 'AR', zipPrefix: '91', rateRappenPerKwh: 24 },
  // Appenzell Innerrhoden
  { canton: 'AI', zipPrefix: '91', rateRappenPerKwh: 23 },
  // St. Gallen
  { canton: 'SG', zipPrefix: '90', rateRappenPerKwh: 25 },
  { canton: 'SG', zipPrefix: '92', rateRappenPerKwh: 24 },
  { canton: 'SG', zipPrefix: '93', rateRappenPerKwh: 25 },
  // Graubünden
  { canton: 'GR', zipPrefix: '70', rateRappenPerKwh: 22 },
  { canton: 'GR', zipPrefix: '71', rateRappenPerKwh: 21 },
  { canton: 'GR', zipPrefix: '72', rateRappenPerKwh: 22 },
  // Aargau
  { canton: 'AG', zipPrefix: '50', rateRappenPerKwh: 24 },
  { canton: 'AG', zipPrefix: '53', rateRappenPerKwh: 24 },
  { canton: 'AG', zipPrefix: '54', rateRappenPerKwh: 23 },
  // Thurgau
  { canton: 'TG', zipPrefix: '85', rateRappenPerKwh: 25 },
  { canton: 'TG', zipPrefix: '88', rateRappenPerKwh: 24 },
  // Ticino
  { canton: 'TI', zipPrefix: '65', rateRappenPerKwh: 20 },
  { canton: 'TI', zipPrefix: '66', rateRappenPerKwh: 21 },
  // Vaud
  { canton: 'VD', zipPrefix: '10', rateRappenPerKwh: 22 },
  { canton: 'VD', zipPrefix: '11', rateRappenPerKwh: 22 },
  { canton: 'VD', zipPrefix: '18', rateRappenPerKwh: 23 },
  // Valais
  { canton: 'VS', zipPrefix: '19', rateRappenPerKwh: 18 },
  { canton: 'VS', zipPrefix: '39', rateRappenPerKwh: 18 },
  // Neuchâtel
  { canton: 'NE', zipPrefix: '20', rateRappenPerKwh: 24 },
  // Genève
  { canton: 'GE', zipPrefix: '12', rateRappenPerKwh: 24 },
  // Jura
  { canton: 'JU', zipPrefix: '28', rateRappenPerKwh: 26 },
]

// ─── Products from I.ON Energy Services catalog (Sales List-PV-2026 v2.1) ────
// All prices in Rappen (CHF × 100), procurement cost excl. VAT
type ProductSeed = {
  id: string
  name: string
  description?: string
  category: ProductCategory
  costRappen: number
  powerWp?: number | null
}

const PRODUCTS: ProductSeed[] = [
  // ── Panneaux solaires ─────────────────────────────────────────────────────
  {
    id: 'seed-jinko-455',
    name: 'Jinko JKM455N-54HL4R 455 Wp',
    description: 'Module monocristallin N-type, cadre noir',
    category: ProductCategory.PANEL,
    costRappen: 5240,
    powerWp: 455,
  },
  {
    id: 'seed-jinko-465',
    name: 'Jinko JKM465N-48QL6-DB 465 Wp',
    description: 'Module monocristallin N-type double verre, cadre noir',
    category: ProductCategory.PANEL,
    costRappen: 6245,
    powerWp: 465,
  },
  {
    id: 'seed-longi-485-explorer',
    name: 'LONGi Hi-MO X10 Explorer LR7-54HVH-485M 485 Wp',
    description: 'Module HPBC 2.0, top performance, cadre noir',
    category: ProductCategory.PANEL,
    costRappen: 7535,
    powerWp: 485,
  },
  {
    id: 'seed-longi-485-artist',
    name: 'LONGi Hi-MO X10 Artist LR7-54HVB-485M 485 Wp',
    description: 'Module full black HPBC 2.0, esthétique premium',
    category: ProductCategory.PANEL,
    costRappen: 10555,
    powerWp: 485,
  },
  {
    id: 'seed-aiko-480',
    name: 'Aiko Neostar G3 A480-MCE54Mw 480 Wp',
    description: 'Module ABC full black, technologie avancée',
    category: ProductCategory.PANEL,
    costRappen: 7430,
    powerWp: 480,
  },
  {
    id: 'seed-aiko-485',
    name: 'Aiko Neostar G3 A485-MCE54Mb 485 Wp',
    description: 'Module ABC full black premium, haute efficacité',
    category: ProductCategory.PANEL,
    costRappen: 10295,
    powerWp: 485,
  },

  // ── Onduleurs Huawei ──────────────────────────────────────────────────────
  {
    id: 'seed-hw-6k',
    name: 'Huawei SUN2000-6K-MAP0',
    description: 'Onduleur hybride triphasé 6 kW, Smart Dongle inclus',
    category: ProductCategory.INVERTER,
    costRappen: 90085,
    powerWp: 6000,
  },
  {
    id: 'seed-hw-8k',
    name: 'Huawei SUN2000-8K-MAP0',
    description: 'Onduleur hybride triphasé 8 kW, Smart Dongle inclus',
    category: ProductCategory.INVERTER,
    costRappen: 106805,
    powerWp: 8000,
  },
  {
    id: 'seed-hw-10k',
    name: 'Huawei SUN2000-10K-MAP0',
    description: 'Onduleur hybride triphasé 10 kW, Smart Dongle inclus',
    category: ProductCategory.INVERTER,
    costRappen: 119990,
    powerWp: 10000,
  },
  {
    id: 'seed-hw-12k',
    name: 'Huawei SUN2000-12K-MAP0',
    description: 'Onduleur hybride triphasé 12 kW, Smart Dongle inclus',
    category: ProductCategory.INVERTER,
    costRappen: 129635,
    powerWp: 12000,
  },
  {
    id: 'seed-hw-15k',
    name: 'Huawei SUN2000-15K-MB0',
    description: 'Onduleur hybride triphasé 15 kW',
    category: ProductCategory.INVERTER,
    costRappen: 173105,
    powerWp: 15000,
  },
  {
    id: 'seed-hw-17k',
    name: 'Huawei SUN2000-17K-MB0',
    description: 'Onduleur hybride triphasé 17 kW',
    category: ProductCategory.INVERTER,
    costRappen: 176640,
    powerWp: 17000,
  },
  {
    id: 'seed-hw-20k',
    name: 'Huawei SUN2000-20K-MB0',
    description: 'Onduleur hybride triphasé 20 kW',
    category: ProductCategory.INVERTER,
    costRappen: 186580,
    powerWp: 20000,
  },

  // ── Onduleurs Fronius (SC) ────────────────────────────────────────────────
  {
    id: 'seed-fr-symo-6-sc',
    name: 'Fronius Symo GEN24 6.0 SC',
    description: 'Onduleur hybride triphasé 6 kW, Storage Controller',
    category: ProductCategory.INVERTER,
    costRappen: 133385,
    powerWp: 6000,
  },
  {
    id: 'seed-fr-symo-8-sc',
    name: 'Fronius Symo GEN24 8.0 SC',
    description: 'Onduleur hybride triphasé 8 kW, Storage Controller',
    category: ProductCategory.INVERTER,
    costRappen: 161270,
    powerWp: 8000,
  },
  {
    id: 'seed-fr-symo-10-sc',
    name: 'Fronius Symo GEN24 10.0 SC',
    description: 'Onduleur hybride triphasé 10 kW, Storage Controller',
    category: ProductCategory.INVERTER,
    costRappen: 171195,
    powerWp: 10000,
  },
  {
    id: 'seed-fr-symo-12-sc',
    name: 'Fronius Symo GEN24 12.0 SC',
    description: 'Onduleur hybride triphasé 12 kW, Storage Controller',
    category: ProductCategory.INVERTER,
    costRappen: 181770,
    powerWp: 12000,
  },

  // ── Onduleurs Fronius (Plus SC) ───────────────────────────────────────────
  {
    id: 'seed-fr-symo-6-plus',
    name: 'Fronius Symo GEN24 6.0 Plus SC',
    description: 'Onduleur hybride 6 kW avec backup intégré',
    category: ProductCategory.INVERTER,
    costRappen: 180975,
    powerWp: 6000,
  },
  {
    id: 'seed-fr-symo-8-plus',
    name: 'Fronius Symo GEN24 8.0 Plus SC',
    description: 'Onduleur hybride 8 kW avec backup intégré',
    category: ProductCategory.INVERTER,
    costRappen: 208385,
    powerWp: 8000,
  },
  {
    id: 'seed-fr-symo-10-plus',
    name: 'Fronius Symo GEN24 10.0 Plus SC',
    description: 'Onduleur hybride 10 kW avec backup intégré',
    category: ProductCategory.INVERTER,
    costRappen: 217690,
    powerWp: 10000,
  },
  {
    id: 'seed-fr-symo-12-plus',
    name: 'Fronius Symo GEN24 12.0 Plus SC',
    description: 'Onduleur hybride 12 kW avec backup intégré',
    category: ProductCategory.INVERTER,
    costRappen: 228640,
    powerWp: 12000,
  },
  {
    id: 'seed-fr-verto-15-plus',
    name: 'Fronius Verto 15.0 Plus SPD 1+2',
    description: 'Onduleur string triphasé 15 kW avec parafoudre',
    category: ProductCategory.INVERTER,
    costRappen: 271475,
    powerWp: 15000,
  },
  {
    id: 'seed-fr-verto-175-plus',
    name: 'Fronius Verto 17.5 Plus SPD 1+2',
    description: 'Onduleur string triphasé 17.5 kW avec parafoudre',
    category: ProductCategory.INVERTER,
    costRappen: 290415,
    powerWp: 17500,
  },
  {
    id: 'seed-fr-verto-20-plus',
    name: 'Fronius Verto 20.0 Plus SPD 1+2',
    description: 'Onduleur string triphasé 20 kW avec parafoudre',
    category: ProductCategory.INVERTER,
    costRappen: 309355,
    powerWp: 20000,
  },
  {
    id: 'seed-fr-verto-15',
    name: 'Fronius Verto 15.0 SPD 1+2',
    description: 'Onduleur string triphasé 15 kW',
    category: ProductCategory.INVERTER,
    costRappen: 211745,
    powerWp: 15000,
  },
  {
    id: 'seed-fr-verto-175',
    name: 'Fronius Verto 17.5 SPD 1+2',
    description: 'Onduleur string triphasé 17.5 kW',
    category: ProductCategory.INVERTER,
    costRappen: 214985,
    powerWp: 17500,
  },
  {
    id: 'seed-fr-verto-20',
    name: 'Fronius Verto 20.0 SPD 1+2',
    description: 'Onduleur string triphasé 20 kW',
    category: ProductCategory.INVERTER,
    costRappen: 218160,
    powerWp: 20000,
  },

  // ── Batteries Huawei ─────────────────────────────────────────────────────
  {
    id: 'seed-hw-luna-7',
    name: 'Huawei LUNA2000-7-S1 (7 kWh)',
    description: 'Module batterie 7 kWh haute tension',
    category: ProductCategory.BATTERY,
    costRappen: 302090,
    powerWp: 7000,
  },
  {
    id: 'seed-hw-luna-14',
    name: 'Huawei LUNA2000-14-S1 (14 kWh)',
    description: 'Module batterie 14 kWh haute tension',
    category: ProductCategory.BATTERY,
    costRappen: 524940,
    powerWp: 14000,
  },
  {
    id: 'seed-hw-luna-21',
    name: 'Huawei LUNA2000-21-S1 (21 kWh)',
    description: 'Module batterie 21 kWh haute tension',
    category: ProductCategory.BATTERY,
    costRappen: 747790,
    powerWp: 21000,
  },

  // ── Batteries Fronius Reserva ─────────────────────────────────────────────
  {
    id: 'seed-fr-reserva-63',
    name: 'Fronius Reserva 6.3 kWh',
    description: 'Batterie de stockage 6.3 kWh',
    category: ProductCategory.BATTERY,
    costRappen: 230385,
    powerWp: 6300,
  },
  {
    id: 'seed-fr-reserva-95',
    name: 'Fronius Reserva 9.5 kWh',
    description: 'Batterie de stockage 9.5 kWh',
    category: ProductCategory.BATTERY,
    costRappen: 309040,
    powerWp: 9500,
  },
  {
    id: 'seed-fr-reserva-126',
    name: 'Fronius Reserva 12.6 kWh',
    description: 'Batterie de stockage 12.6 kWh',
    category: ProductCategory.BATTERY,
    costRappen: 387690,
    powerWp: 12600,
  },
  {
    id: 'seed-fr-reserva-158',
    name: 'Fronius Reserva 15.8 kWh',
    description: 'Batterie de stockage 15.8 kWh',
    category: ProductCategory.BATTERY,
    costRappen: 466345,
    powerWp: 15800,
  },

  // ── Batteries Fronius Reserva Pro ─────────────────────────────────────────
  {
    id: 'seed-fr-reserva-pro-12',
    name: 'Fronius Reserva Pro 12 kWh',
    description: 'Batterie professionnelle 12 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 445910,
    powerWp: 12000,
  },
  {
    id: 'seed-fr-reserva-pro-16',
    name: 'Fronius Reserva Pro 16 kWh',
    description: 'Batterie professionnelle 16 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 566675,
    powerWp: 16000,
  },
  {
    id: 'seed-fr-reserva-pro-20',
    name: 'Fronius Reserva Pro 20 kWh',
    description: 'Batterie professionnelle 20 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 687440,
    powerWp: 20000,
  },
  {
    id: 'seed-fr-reserva-pro-24',
    name: 'Fronius Reserva Pro 24 kWh',
    description: 'Batterie professionnelle 24 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 808205,
    powerWp: 24000,
  },
  {
    id: 'seed-fr-reserva-pro-28',
    name: 'Fronius Reserva Pro 28 kWh',
    description: 'Batterie professionnelle 28 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 928975,
    powerWp: 28000,
  },
  {
    id: 'seed-fr-reserva-pro-32',
    name: 'Fronius Reserva Pro 32 kWh',
    description: 'Batterie professionnelle 32 kWh avec onduleur intégré',
    category: ProductCategory.BATTERY,
    costRappen: 1049740,
    powerWp: 32000,
  },

  // ── Accessoires ───────────────────────────────────────────────────────────
  {
    id: 'seed-hw-emma',
    name: 'Huawei EMMA-A02',
    description: 'Energy Management Machine Assistant (passerelle)',
    category: ProductCategory.ACCESSORY,
    costRappen: 25100,
    powerWp: null,
  },
  {
    id: 'seed-hw-optimizer',
    name: 'Huawei Optimizer (par panneau)',
    description: 'Optimiseur de puissance par module',
    category: ProductCategory.ACCESSORY,
    costRappen: 2700,
    powerWp: null,
  },
  {
    id: 'seed-fr-parafoudre-dc',
    name: 'Fronius Parafoudre DC Type I+II',
    description: 'Protection surtension DC Type I+II',
    category: ProductCategory.ACCESSORY,
    costRappen: 14740,
    powerWp: null,
  },
  {
    id: 'seed-hager-spd-ac',
    name: 'Hager SPD 4P AC',
    description: 'Parafoudre AC 4 pôles',
    category: ProductCategory.ACCESSORY,
    costRappen: 13500,
    powerWp: null,
  },
  {
    id: 'seed-fr-smart-meter',
    name: 'Fronius Smart Meter TS 65A-3',
    description: 'Compteur intelligent triphasé 65A',
    category: ProductCategory.ACCESSORY,
    costRappen: 16685,
    powerWp: null,
  },

  // ── Bornes de recharge VE ─────────────────────────────────────────────────
  {
    id: 'seed-hw-ev-charger',
    name: 'Huawei Smart Charger 22 kW / 32A',
    description: 'Borne de recharge VE 22 kW, monophasé/triphasé, connectée',
    category: ProductCategory.EV_CHARGER,
    costRappen: 34170,
    powerWp: null,
  },
  {
    id: 'seed-fr-wattpilot',
    name: 'Fronius Wattpilot Flex Home 22 C6',
    description: 'Borne de recharge VE 22 kW, gestion solaire intelligente',
    category: ProductCategory.EV_CHARGER,
    costRappen: 67740,
    powerWp: null,
  },
]

// ─── Cost options (prestations & suppléments) ─────────────────────────────────
const COST_OPTIONS = [
  {
    id: 'seed-opt-echafaudage-simple',
    name: 'Échafaudage simple',
    description: 'Montage/démontage, accès standard une façade',
    costRappen: 80000,
    sortOrder: 10,
  },
  {
    id: 'seed-opt-echafaudage-complexe',
    name: 'Échafaudage complexe',
    description: 'Plusieurs façades ou accès difficile',
    costRappen: 160000,
    sortOrder: 20,
  },
  {
    id: 'seed-opt-montage-tuiles',
    name: 'Système de fixation ardoise/tuile',
    description: 'Sous-construction pour toiture en ardoise ou tuile',
    costRappen: 85000,
    sortOrder: 30,
  },
  {
    id: 'seed-opt-montage-plat',
    name: 'Fixation toiture plate',
    description: "Structure d'inclinaison pour toiture plate",
    costRappen: 120000,
    sortOrder: 40,
  },
  {
    id: 'seed-opt-cable-10m',
    name: 'Câblage supplémentaire 10 m',
    description: "Passage de câbles jusqu'à 10 m",
    costRappen: 20000,
    sortOrder: 50,
  },
  {
    id: 'seed-opt-cable-25m',
    name: 'Câblage supplémentaire 25 m',
    description: 'Passage de câbles 10–25 m',
    costRappen: 45000,
    sortOrder: 60,
  },
  {
    id: 'seed-opt-inspection',
    name: 'Inspection électrique',
    description: "Contrôle et rapport d'inspection NIBT",
    costRappen: 50000,
    sortOrder: 70,
  },
  {
    id: 'seed-opt-pronovo',
    name: 'Pronovo / mise en service',
    description: 'Formulaire mise en service + annonce réseau Pronovo',
    costRappen: 20000,
    sortOrder: 80,
  },
  {
    id: 'seed-opt-complexity',
    name: 'Supplément complexité',
    description: 'Toit complexe, multi-pans, obstacles',
    costRappen: 95000,
    sortOrder: 90,
  },
]

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Settings ──────────────────────────────────────────────────────────────
  await prisma.setting.upsert({
    where: { key: 'vat_pct_basis_pts' },
    update: {},
    create: { key: 'vat_pct_basis_pts', value: '810' }, // 8.10% TVA suisse
  })
  await prisma.setting.upsert({
    where: { key: 'min_margin_basis_pts' },
    update: {},
    create: { key: 'min_margin_basis_pts', value: '2000' }, // 20.00% marge minimum
  })

  // ─── I.ON Energy Excel Pricing Coefficients ────────────────────────────────
  const ionSettings: Array<{ key: string; value: string }> = [
    { key: 'pv_accessories_bps', value: '300' },       // 3% accessoires matériel
    { key: 'pv_frais_supp_bps', value: '200' },        // 2% frais supplémentaires
    { key: 'pv_transport_bps', value: '500' },         // 5% transport
    { key: 'pv_labor_panel_rappen', value: '6500' },   // 65 CHF/panneau
    { key: 'pv_labor_inverter_rappen', value: '18000' }, // 180 CHF/onduleur
    { key: 'pv_raccordement_mat_rappen', value: '50000' }, // 500 CHF matériel raccordement AC
    { key: 'pv_raccordement_labor_rappen', value: '155000' }, // 1550 CHF MO raccordement AC
    { key: 'pv_pm_fixed_rappen', value: '120000' },    // 1200 CHF project management
    { key: 'pv_admin_fixed_rappen', value: '90000' },  // 900 CHF frais administratifs
    { key: 'pv_sales_overhead_bps', value: '1500' },   // 15% frais généraux sales
    { key: 'pv_profit_appro_bps', value: '2500' },     // 25% profit approvision
    { key: 'pv_profit_constr_bps', value: '2500' },    // 25% profit construction
    { key: 'bat_pm_bps', value: '700' },               // 7% PM batteries
    { key: 'bat_admin_bps', value: '600' },            // 6% admin batteries
    { key: 'bat_profit_bps', value: '1925' },          // 19.25% profit batteries/VE
  ]
  for (const s of ionSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }
  console.log('  ✓ Paramètres: TVA=8.10%, marge min=20%')
  console.log(`  ✓ ${ionSettings.length} coefficients I.ON Energy (PV + batteries)`)

  // ─── Swiss rates ───────────────────────────────────────────────────────────
  for (const rate of SWISS_RATES) {
    await prisma.swissRate.upsert({
      where: { canton_zipPrefix: { canton: rate.canton, zipPrefix: rate.zipPrefix } },
      update: { rateRappenPerKwh: rate.rateRappenPerKwh },
      create: rate,
    })
  }
  console.log(`  ✓ ${SWISS_RATES.length} tarifs électricité suisses`)

  // ─── Products ──────────────────────────────────────────────────────────────
  for (const product of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        name: product.name,
        description: product.description,
        category: product.category,
        costRappen: product.costRappen,
        powerWp: product.powerWp ?? null,
      },
      create: { ...product, active: true },
    })
  }
  console.log(`  ✓ ${PRODUCTS.length} produits`)

  // ─── Cost options ──────────────────────────────────────────────────────────
  for (const option of COST_OPTIONS) {
    await prisma.costOption.upsert({
      where: { id: option.id },
      update: { name: option.name, description: option.description, costRappen: option.costRappen },
      create: { ...option, active: true },
    })
  }
  console.log(`  ✓ ${COST_OPTIONS.length} options de coût`)

  // ─── Admin user ────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12)
  await prisma.user.upsert({
    where: { email: 'admin@solar.local' },
    update: {},
    create: {
      email: 'admin@solar.local',
      name: 'Admin',
      role: Role.ADMIN,
      passwordHash: adminPassword,
    },
  })

  const repPassword = await bcrypt.hash('rep123', 12)
  await prisma.user.upsert({
    where: { email: 'rep@solar.local' },
    update: {},
    create: {
      email: 'rep@solar.local',
      name: 'Demo Conseiller',
      role: Role.REP,
      passwordHash: repPassword,
    },
  })
  console.log('  ✓ Utilisateurs: admin@solar.local / admin123 · rep@solar.local / rep123')

  console.log('\n✅ Seed terminé.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
