/**
 * QuotePdf — react-pdf template for I.ON Energy quotes.
 *
 * IMPORTANT: This component must only be imported in server-side code
 * (API routes, Server Components). Never import in Client Components —
 * @react-pdf/renderer is a Node.js library and will break in the browser.
 *
 * Usage:
 *   import { renderToBuffer } from '@react-pdf/renderer'
 *   const buffer = await renderToBuffer(<QuotePdf quote={quote} scenarios={pricedScenarios} />)
 *
 * Layout (A4, sequential scenarios):
 *
 *   ┌─────────────────────────────────────┐
 *   │ I.ON ENERGY SERVICES    QUO-2026-001 │  ← Header
 *   │ Offre commerciale       19.03.2026   │
 *   ├─────────────────────────────────────┤
 *   │ Client: Jean Dupont                  │  ← Customer info
 *   │ Adresse: Rue de la Paix 1, Genève   │
 *   ├─────────────────────────────────────┤
 *   │ OPTION 1 — Système Standard          │  ← Scenario (repeated)
 *   │ Toiture: Ardoise · Pente: Moyenne    │
 *   │  10× Jinko Tiger Neo 440W            │
 *   │   1× Huawei SUN2000-5KTL-M1         │
 *   │ ─────────────────────────────────── │
 *   │ Prix HT      CHF 14'850.00           │
 *   │ TVA (8.10%)  CHF  1'202.85           │
 *   │ Prix TTC     CHF 16'052.85           │
 *   │ ─────────────────────────────────── │
 *   │ Rentabilité estimée: 9.2 ans         │
 *   │ Économies annuelles: CHF 1'740       │
 *   ├─────────────────────────────────────┤
 *   │ Notes: ...                           │
 *   ├─────────────────────────────────────┤
 *   │ I.ON Energy Services · Généré le... │  ← Footer
 *   └─────────────────────────────────────┘
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'
import { formatChf, formatPct } from '@/lib/pricing'
import type { FullQuote, PricedScenario } from '@/lib/quote-pdf'

// ─── Styles ───────────────────────────────────────────────────────────────────

const RED = '#d92127'
const GRAY_DARK = '#1a1a1a'
const GRAY_MID = '#555555'
const GRAY_LIGHT = '#f5f5f5'
const GRAY_BORDER = '#e0e0e0'

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: GRAY_DARK,
    paddingTop: 40,
    paddingBottom: 50,
    paddingHorizontal: 45,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: RED,
  },
  headerLeft: { flexDirection: 'column' },
  headerCompany: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: RED, marginBottom: 2 },
  headerSubtitle: { fontSize: 9, color: GRAY_MID },
  headerRight: { flexDirection: 'column', alignItems: 'flex-end' },
  headerQuoteNum: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: GRAY_DARK },
  headerDate: { fontSize: 9, color: GRAY_MID, marginTop: 2 },

  // ── Customer section ──
  sectionBox: {
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    padding: 12,
    marginBottom: 16,
  },
  sectionLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_MID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  customerName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GRAY_DARK, marginBottom: 3 },
  customerDetail: { fontSize: 9, color: GRAY_MID, marginBottom: 2 },

  // ── Scenario section ──
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: RED,
  },
  scenarioBadge: {
    backgroundColor: RED,
    color: '#ffffff',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 8,
  },
  scenarioName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: GRAY_DARK },
  roofLine: { fontSize: 8, color: GRAY_MID, marginBottom: 8 },

  // ── Product table ──
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: GRAY_BORDER,
  },
  tableQty: { width: 30, fontSize: 9, color: GRAY_MID, textAlign: 'right', marginRight: 8 },
  tableName: { flex: 1, fontSize: 9, color: GRAY_DARK },
  tableCategory: { width: 70, fontSize: 8, color: GRAY_MID, textAlign: 'right' },

  // ── Pricing summary ──
  pricingBox: {
    backgroundColor: GRAY_LIGHT,
    borderRadius: 4,
    padding: 12,
    marginTop: 10,
  },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  pricingLabel: { fontSize: 9, color: GRAY_MID },
  pricingValue: { fontSize: 9, color: GRAY_DARK },
  pricingDivider: { borderTopWidth: 0.5, borderTopColor: GRAY_BORDER, marginVertical: 6 },
  pricingTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: GRAY_DARK },
  pricingTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: RED },

  // ── ROI section ──
  roiBox: {
    borderLeftWidth: 3,
    borderLeftColor: RED,
    paddingLeft: 10,
    marginTop: 10,
  },
  roiTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_MID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  roiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
  roiLabel: { fontSize: 9, color: GRAY_MID },
  roiValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: GRAY_DARK },
  roiUnavailable: { fontSize: 9, color: GRAY_MID, fontFamily: 'Helvetica-Oblique' },

  // ── Notes ──
  notesBox: {
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 0.5,
    borderTopColor: GRAY_BORDER,
  },
  notesLabel: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: GRAY_MID, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  notesText: { fontSize: 9, color: GRAY_MID },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 45,
    right: 45,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: GRAY_BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: GRAY_MID },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_FR: Record<string, string> = {
  PANEL: 'Panneau',
  INVERTER: 'Onduleur',
  BATTERY: 'Batterie',
  MOUNTING: 'Fixation',
  ACCESSORY: 'Accessoire',
  EV_CHARGER: 'Borne EV',
}

const ROOF_TYPE_FR: Record<string, string> = {
  tuile: 'Tuile',
  ardoise: 'Ardoise',
  bac_acier: 'Bac acier',
  plat: 'Plat',
}

const ROOF_SLOPE_FR: Record<string, string> = {
  simple: 'Pente simple',
  moyen: 'Pente moyenne',
  complexe: 'Pente complexe',
}

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  quote: FullQuote
  scenarios: PricedScenario[]
}

export default function QuotePdf({ quote, scenarios }: Props) {
  const generatedDate = formatDate(new Date())

  return (
    <Document
      title={`Offre ${quote.quoteNumber}`}
      author="I.ON Energy Services"
      subject="Offre commerciale installation photovoltaïque"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header ── */}
        <View style={s.header} fixed>
          <View style={s.headerLeft}>
            <Text style={s.headerCompany}>I.ON Energy Services</Text>
            <Text style={s.headerSubtitle}>Offre commerciale — Installation photovoltaïque</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerQuoteNum}>{quote.quoteNumber}</Text>
            <Text style={s.headerDate}>{formatDate(quote.createdAt)}</Text>
          </View>
        </View>

        {/* ── Customer info ── */}
        <View style={s.sectionBox}>
          <Text style={s.sectionLabel}>Client</Text>
          {quote.customerName ? (
            <Text style={s.customerName}>{quote.customerName}</Text>
          ) : null}
          {quote.siteAddress ? (
            <Text style={s.customerDetail}>{quote.siteAddress}</Text>
          ) : null}
          {quote.customerEmail ? (
            <Text style={s.customerDetail}>{quote.customerEmail}</Text>
          ) : null}
          {quote.customerPhone ? (
            <Text style={s.customerDetail}>{quote.customerPhone}</Text>
          ) : null}
          {!quote.customerName && !quote.siteAddress && !quote.customerEmail && !quote.customerPhone ? (
            <Text style={s.customerDetail}>—</Text>
          ) : null}
        </View>

        {/* ── Scenarios ── */}
        {scenarios.length === 0 ? (
          <View style={s.sectionBox}>
            <Text style={s.customerDetail}>Aucun scénario enregistré pour cette offre.</Text>
          </View>
        ) : (
          scenarios.map((scenario, idx) => (
            <ScenarioSection key={scenario.id} scenario={scenario} index={idx} total={scenarios.length} />
          ))
        )}

        {/* ── Notes ── */}
        {quote.notes ? (
          <View style={s.notesBox}>
            <Text style={s.notesLabel}>Notes</Text>
            <Text style={s.notesText}>{quote.notes}</Text>
          </View>
        ) : null}

        {/* ── Footer (fixed, appears on every page) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>I.ON Energy Services</Text>
          <Text style={s.footerText}>Généré le {generatedDate}</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`}
          />
        </View>
      </Page>
    </Document>
  )
}

// ─── Scenario section ─────────────────────────────────────────────────────────

function ScenarioSection({
  scenario,
  index,
  total,
}: {
  scenario: PricedScenario
  index: number
  total: number
}) {
  const vatPct = formatPct(scenario.vatPctBasisPts)

  return (
    <View break={index > 0}>
      {/* Scenario header */}
      <View style={s.scenarioHeader}>
        {total > 1 ? (
          <Text style={s.scenarioBadge}>Option {index + 1}</Text>
        ) : null}
        <Text style={s.scenarioName}>{scenario.name}</Text>
      </View>

      {/* Roof info */}
      <Text style={s.roofLine}>
        Toiture : {ROOF_TYPE_FR[scenario.roofType] ?? scenario.roofType}
        {'  ·  '}
        {ROOF_SLOPE_FR[scenario.roofSlope] ?? scenario.roofSlope}
      </Text>

      {/* Product list */}
      {scenario.items.map((item, i) => (
        <View key={i} style={s.tableRow}>
          <Text style={s.tableQty}>{item.quantity}×</Text>
          <Text style={s.tableName}>{item.name}</Text>
          <Text style={s.tableCategory}>{CATEGORY_FR[item.category] ?? item.category}</Text>
        </View>
      ))}

      {/* Cost options */}
      {scenario.options.map((opt, i) => (
        <View key={i} style={s.tableRow}>
          <Text style={s.tableQty}>1×</Text>
          <Text style={s.tableName}>{opt.name}</Text>
          <Text style={s.tableCategory}>Service</Text>
        </View>
      ))}

      {/* Pricing summary */}
      <View style={s.pricingBox}>
        <View style={s.pricingRow}>
          <Text style={s.pricingLabel}>Prix HT</Text>
          <Text style={s.pricingValue}>{formatChf(scenario.sellingPriceExVatRappen)}</Text>
        </View>
        <View style={s.pricingRow}>
          <Text style={s.pricingLabel}>TVA ({vatPct})</Text>
          <Text style={s.pricingValue}>{formatChf(scenario.vatRappen)}</Text>
        </View>
        <View style={s.pricingDivider} />
        <View style={s.pricingRow}>
          <Text style={s.pricingTotalLabel}>Prix TTC</Text>
          <Text style={s.pricingTotalValue}>{formatChf(scenario.sellingPriceIncVatRappen)}</Text>
        </View>
      </View>

      {/* ROI section */}
      <View style={s.roiBox}>
        <Text style={s.roiTitle}>Rentabilité estimée</Text>
        {scenario.paybackYears != null && scenario.annualSavingsRappen != null ? (
          <>
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>Économies annuelles estimées</Text>
              <Text style={s.roiValue}>{formatChf(scenario.annualSavingsRappen)}</Text>
            </View>
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>Retour sur investissement</Text>
              <Text style={s.roiValue}>
                {scenario.paybackYears.toFixed(1)} ans
              </Text>
            </View>
            {scenario.annualKwhYield ? (
              <View style={s.roiRow}>
                <Text style={s.roiLabel}>Production annuelle estimée</Text>
                <Text style={s.roiValue}>
                  {Math.round(scenario.annualKwhYield).toLocaleString('fr-CH')} kWh
                </Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={s.roiUnavailable}>
            Données insuffisantes pour le calcul (adresse ZIP requise).
          </Text>
        )}
      </View>
    </View>
  )
}
