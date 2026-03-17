import { PrismaClient, ProductCategory, Role } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

// ─── Swiss electricity rates by canton (ElCom averages, Rappen/kWh) ──────────
// Source: ElCom Erhebung 2024 (standard household H4)
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

async function main() {
  console.log('🌱 Seeding database...')

  // ─── Settings ──────────────────────────────────────────────────────────────
  // CRITICAL: These must exist before any pricing calculation runs.
  await prisma.setting.upsert({
    where: { key: 'vat_pct_basis_pts' },
    update: {},
    create: { key: 'vat_pct_basis_pts', value: '810' }, // 8.10% Swiss VAT
  })
  await prisma.setting.upsert({
    where: { key: 'min_margin_basis_pts' },
    update: {},
    create: { key: 'min_margin_basis_pts', value: '2000' }, // 20.00% minimum
  })
  console.log('  ✓ Settings seeded (VAT=8.10%, min margin=20%)')

  // ─── Swiss rates ───────────────────────────────────────────────────────────
  for (const rate of SWISS_RATES) {
    await prisma.swissRate.upsert({
      where: { canton_zipPrefix: { canton: rate.canton, zipPrefix: rate.zipPrefix } },
      update: { rateRappenPerKwh: rate.rateRappenPerKwh },
      create: rate,
    })
  }
  console.log(`  ✓ ${SWISS_RATES.length} Swiss electricity rates seeded`)

  // ─── Sample products ───────────────────────────────────────────────────────
  const panels = [
    {
      name: 'Jinko Solar Tiger Neo 415 Wp',
      category: ProductCategory.PANEL,
      costRappen: 22000, // CHF 220.00
      powerWp: 415,
      description: 'Monokristallin, schwarzer Rahmen, 25 Jahre Leistungsgarantie',
    },
    {
      name: 'Jinko Solar Tiger Neo 440 Wp',
      category: ProductCategory.PANEL,
      costRappen: 24500, // CHF 245.00
      powerWp: 440,
      description: 'Monokristallin, schwarzer Rahmen, Top-Effizienz',
    },
    {
      name: 'REC Alpha Pure 405 Wp',
      category: ProductCategory.PANEL,
      costRappen: 28000, // CHF 280.00
      powerWp: 405,
      description: 'HJT-Technologie, all-black, Premium-Qualität',
    },
    {
      name: 'Meyer Burger White 395 Wp',
      category: ProductCategory.PANEL,
      costRappen: 35000, // CHF 350.00
      powerWp: 395,
      description: 'Swiss Made, HJT heterojunction, 30 Jahre Garantie',
    },
  ]

  const inverters = [
    {
      name: 'Fronius Primo 5.0-1',
      category: ProductCategory.INVERTER,
      costRappen: 145000, // CHF 1,450.00
      powerWp: 5000,
      description: 'Einphasig, 5 kVA, mit WLAN-Monitor',
    },
    {
      name: 'Fronius Primo 8.2-1',
      category: ProductCategory.INVERTER,
      costRappen: 185000, // CHF 1,850.00
      powerWp: 8200,
      description: 'Einphasig, 8.2 kVA',
    },
    {
      name: 'Fronius Symo 10.0-3-M',
      category: ProductCategory.INVERTER,
      costRappen: 235000, // CHF 2,350.00
      powerWp: 10000,
      description: 'Dreiphasig, 10 kVA',
    },
    {
      name: 'SMA Sunny Boy 5.0',
      category: ProductCategory.INVERTER,
      costRappen: 138000, // CHF 1,380.00
      powerWp: 5000,
      description: 'Einphasig, 5 kW',
    },
    {
      name: 'Huawei SUN2000-10KTL',
      category: ProductCategory.INVERTER,
      costRappen: 168000, // CHF 1,680.00
      powerWp: 10000,
      description: 'Dreiphasig, 10 kW, Smart Dongle inkl.',
    },
  ]

  const batteries = [
    {
      name: 'BYD Battery-Box Premium HVS 7.7',
      category: ProductCategory.BATTERY,
      costRappen: 480000, // CHF 4,800.00
      powerWp: null,
      description: '7.7 kWh Hochvolt-Speicher',
    },
    {
      name: 'Fronius Solar Battery 10.0',
      category: ProductCategory.BATTERY,
      costRappen: 650000, // CHF 6,500.00
      powerWp: null,
      description: '10 kWh, dreiphasig kompatibel',
    },
  ]

  const accessories = [
    {
      name: 'Wechselrichter-Schutzbox',
      category: ProductCategory.ACCESSORY,
      costRappen: 8500, // CHF 85.00
      powerWp: null,
      description: 'IP65-Schutzgehäuse für Wandmontage',
    },
    {
      name: 'Monitoring-Gateway',
      category: ProductCategory.ACCESSORY,
      costRappen: 12000, // CHF 120.00
      powerWp: null,
      description: 'LAN/WLAN-Datenlogger für Anlagenüberwachung',
    },
  ]

  const allProducts = [...panels, ...inverters, ...batteries, ...accessories]

  for (const product of allProducts) {
    await prisma.product.upsert({
      where: { id: `seed-${product.name}` },
      update: {},
      create: { id: `seed-${product.name}`, ...product, active: true },
    })
  }
  console.log(`  ✓ ${allProducts.length} products seeded`)

  // ─── Cost options ──────────────────────────────────────────────────────────
  const costOptions = [
    {
      id: 'seed-scaffolding-simple',
      name: 'Gerüst einfach',
      description: 'Einfaches Gerüst, ein Arbeitsgang',
      costRappen: 85000, // CHF 850.00
      sortOrder: 10,
    },
    {
      id: 'seed-scaffolding-complex',
      name: 'Gerüst komplex',
      description: 'Mehrere Seiten oder schwieriger Zugang',
      costRappen: 160000, // CHF 1,600.00
      sortOrder: 20,
    },
    {
      id: 'seed-cable-run-10m',
      name: 'Kabelweg 10 m',
      description: 'Kabelverlegung bis 10 m Zusatzweg',
      costRappen: 18000, // CHF 180.00
      sortOrder: 30,
    },
    {
      id: 'seed-cable-run-25m',
      name: 'Kabelweg 25 m',
      description: 'Kabelverlegung 11–25 m Zusatzweg',
      costRappen: 38000, // CHF 380.00
      sortOrder: 40,
    },
    {
      id: 'seed-cable-run-50m',
      name: 'Kabelweg 50 m',
      description: 'Kabelverlegung 26–50 m Zusatzweg',
      costRappen: 72000, // CHF 720.00
      sortOrder: 50,
    },
    {
      id: 'seed-complexity-medium',
      name: 'Erschwernis mittel',
      description: 'Ungünstiger Dachwinkel, mehrere Ausrichtungen',
      costRappen: 45000, // CHF 450.00
      sortOrder: 60,
    },
    {
      id: 'seed-complexity-high',
      name: 'Erschwernis hoch',
      description: 'Steiles Dach, Denkmalschutz, oder schwieriger Untergrund',
      costRappen: 95000, // CHF 950.00
      sortOrder: 70,
    },
    {
      id: 'seed-anmeldung',
      name: 'Netzanmeldung',
      description: 'Anmeldung beim lokalen Netzbetreiber inkl. Unterlagen',
      costRappen: 22000, // CHF 220.00
      sortOrder: 80,
    },
    {
      id: 'seed-installation-flat',
      name: 'Flachdach-Unterkonstruktion',
      description: 'Aufständerung für Flach- oder Flachdachanlage',
      costRappen: 55000, // CHF 550.00 per kWp, here as flat fee example
      sortOrder: 90,
    },
  ]

  for (const option of costOptions) {
    await prisma.costOption.upsert({
      where: { id: option.id },
      update: {},
      create: { ...option, active: true },
    })
  }
  console.log(`  ✓ ${costOptions.length} cost options seeded`)

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

  // ─── Demo rep ──────────────────────────────────────────────────────────────
  const repPassword = await bcrypt.hash('rep123', 12)
  await prisma.user.upsert({
    where: { email: 'rep@solar.local' },
    update: {},
    create: {
      email: 'rep@solar.local',
      name: 'Demo Verkäufer',
      role: Role.REP,
      passwordHash: repPassword,
    },
  })
  console.log('  ✓ Admin + demo rep created')
  console.log('    admin@solar.local / admin123')
  console.log('    rep@solar.local   / rep123')

  console.log('\n✅ Seed complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
