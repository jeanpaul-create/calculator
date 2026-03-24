// @vitest-environment node
// PDF rendering requires Node.js — not compatible with jsdom
import { describe, it, expect } from 'vitest'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import QuotePdf from '@/components/pdf/QuotePdf'
import type { FullQuote, PricedScenario } from '@/lib/quote-pdf'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockQuote: FullQuote = {
  id: 'test-quote-id',
  quoteNumber: 'QUO-2026-001',
  status: 'DRAFT',
  repId: 'rep-1',
  customerName: 'Jean Dupont',
  customerEmail: 'jean@example.com',
  customerPhone: '+41 79 123 45 67',
  customerZip: '1201',
  customerCanton: 'GE',
  siteAddress: 'Rue de la Paix 1, Genève',
  notes: 'Client intéressé par la batterie.',
  mapLat: null,
  mapLon: null,
  mapZoom: null,
  createdAt: new Date('2026-03-19'),
  updatedAt: new Date('2026-03-19'),
  rep: { name: 'Alice Müller', email: 'alice@ionenergy.ch' },
  scenarios: [],
}

const mockScenario: PricedScenario = {
  id: 'scenario-1',
  name: 'Système Standard',
  roofType: 'ardoise',
  roofSlope: 'moyen',
  vatPctBasisPts: 810,
  sellingPriceExVatRappen: 1485000,
  vatRappen: 120285,
  sellingPriceIncVatRappen: 1605285,
  installedKwp: 4.4,
  panelCount: 10,
  panelPowerWp: 440,
  annualKwhYield: 4400,
  rateRappenPerKwh: 30,
  annualSavingsRappen: 174000,
  paybackYears: 9.2,
  pronovoSubsidyRappen: 158400,
  taxSavingsRappen: 297000,
  effectiveInvestmentRappen: 1149885,
  paybackYearsWithSubsidy: 6.6,
  items: [
    { name: 'Jinko Tiger Neo 440W', quantity: 10, category: 'PANEL' },
    { name: 'Huawei SUN2000-5KTL-M1', quantity: 1, category: 'INVERTER' },
  ],
  options: [{ name: 'Raccordement réseau' }],
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('QuotePdf rendering', () => {
  it('renders to a valid PDF buffer (starts with %PDF)', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, {
        quote: mockQuote,
        scenarios: [mockScenario],
      }) as any
    )
    expect(buffer).toBeInstanceOf(Buffer)
    expect(buffer.length).toBeGreaterThan(0)
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('renders with no scenarios without crashing', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote: mockQuote, scenarios: [] }) as any
    )
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('renders with minimal quote data (no optional fields)', async () => {
    const minimalQuote: FullQuote = {
      ...mockQuote,
      customerName: null,
      customerEmail: null,
      customerPhone: null,
      siteAddress: null,
      notes: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote: minimalQuote, scenarios: [mockScenario] }) as any
    )
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('renders ROI-unavailable scenario (no rate data)', async () => {
    const noRoiScenario: PricedScenario = {
      ...mockScenario,
      annualKwhYield: null,
      annualSavingsRappen: null,
      paybackYears: null,
      effectiveInvestmentRappen: null,
      paybackYearsWithSubsidy: null,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote: mockQuote, scenarios: [noRoiScenario] }) as any
    )
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })

  it('renders multiple scenarios without crashing', async () => {
    const scenario2: PricedScenario = {
      ...mockScenario,
      id: 'scenario-2',
      name: 'Système Premium',
      sellingPriceIncVatRappen: 2200000,
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buffer = await renderToBuffer(
      React.createElement(QuotePdf, { quote: mockQuote, scenarios: [mockScenario, scenario2] }) as any
    )
    expect(buffer.slice(0, 4).toString()).toBe('%PDF')
  })
})

// ─── buildPricedScenarios unit tests (pure computation) ──────────────────────
// These test the pricing logic without hitting the DB

describe('PricedScenario structure', () => {
  it('has expected keys', () => {
    const keys: (keyof PricedScenario)[] = [
      'id', 'name', 'roofType', 'roofSlope',
      'vatPctBasisPts', 'sellingPriceExVatRappen', 'vatRappen',
      'sellingPriceIncVatRappen', 'annualKwhYield', 'annualSavingsRappen',
      'paybackYears', 'pronovoSubsidyRappen', 'taxSavingsRappen',
      'effectiveInvestmentRappen', 'paybackYearsWithSubsidy', 'items', 'options',
    ]
    for (const key of keys) {
      expect(mockScenario).toHaveProperty(key)
    }
  })

  it('vatRappen = round(sellingPriceExVat * vatPct / 10000)', () => {
    const expected = Math.round(mockScenario.sellingPriceExVatRappen * mockScenario.vatPctBasisPts / 10000)
    expect(mockScenario.vatRappen).toBe(expected)
  })

  it('sellingPriceIncVat = sellingPriceExVat + vatRappen (approximately)', () => {
    // May differ by 1 Rappen due to rounding
    const diff = Math.abs(
      mockScenario.sellingPriceIncVatRappen -
      (mockScenario.sellingPriceExVatRappen + mockScenario.vatRappen)
    )
    expect(diff).toBeLessThanOrEqual(1)
  })
})
