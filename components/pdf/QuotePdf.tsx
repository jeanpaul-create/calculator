/**
 * QuotePdf — react-pdf template for I.ON Energy quotes.
 *
 * IMPORTANT: This component must only be imported in server-side code
 * (API routes, Server Components). Never import in Client Components —
 * @react-pdf/renderer is a Node.js library and will break in the browser.
 */

import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import { formatChf, formatPct } from '@/lib/pricing'
import type { FullQuote, PricedScenario } from '@/lib/quote-pdf'

// ─── Palette ──────────────────────────────────────────────────────────────────

const RED       = '#d92127'
const RED_LIGHT = '#fef2f2'
const DARK      = '#111827'
const MID       = '#6b7280'
const LIGHT_BG  = '#f9fafb'
const BORDER    = '#e5e7eb'
const WHITE     = '#ffffff'
const GREEN     = '#15803d'
const GREEN_BG  = '#f0fdf4'

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    paddingTop: 0,
    paddingBottom: 48,
    paddingHorizontal: 0,
  },

  // ── Header band ──
  headerBand: {
    backgroundColor: DARK,
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 0,
  },
  headerAccent: {
    height: 4,
    backgroundColor: RED,
    marginBottom: 20,
  },
  headerCompany: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: WHITE,
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  headerSubtitle: {
    fontSize: 9,
    color: '#9ca3af',
    letterSpacing: 0.3,
  },
  headerRight: { alignItems: 'flex-end' },
  headerQuoteNum: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: RED,
    marginBottom: 3,
  },
  headerDate: { fontSize: 9, color: '#9ca3af' },

  // ── Page body padding ──
  body: { paddingHorizontal: 40 },

  // ── Customer box ──
  customerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 20,
    marginBottom: 20,
  },
  customerBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: RED,
    padding: 12,
    marginRight: 10,
  },
  validityBox: {
    width: 140,
    backgroundColor: RED_LIGHT,
    borderRadius: 4,
    padding: 12,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: MID,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  customerName: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    marginBottom: 3,
  },
  customerDetail: { fontSize: 9, color: MID, marginBottom: 2 },
  validityLabel: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: RED, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  validityValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'center' },
  validityNote: { fontSize: 8, color: MID, marginTop: 2, textAlign: 'center' },

  // ── Scenario ──
  scenarioWrap: { marginBottom: 24 },
  scenarioHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: DARK,
    borderRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  scenarioBadge: {
    backgroundColor: RED,
    color: WHITE,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    marginRight: 10,
  },
  scenarioName: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: WHITE },

  // ── KPI cards ──
  kpiRow: {
    flexDirection: 'row',
    marginBottom: 14,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    borderTopWidth: 3,
    borderTopColor: RED,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
  },
  kpiValue: {
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    color: DARK,
    marginBottom: 2,
  },
  kpiLabel: { fontSize: 7, color: MID, textAlign: 'center' },

  // ── System size line ──
  systemLine: {
    fontSize: 9,
    color: MID,
    marginBottom: 10,
  },
  systemBold: { fontFamily: 'Helvetica-Bold', color: DARK },

  // ── Roof line ──
  roofLine: { fontSize: 8, color: MID, marginBottom: 10 },

  // ── Equipment table ──
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    marginBottom: 2,
  },
  tableHeaderText: { fontSize: 7, fontFamily: 'Helvetica-Bold', color: MID, textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: LIGHT_BG },
  tableQty: { width: 28, fontSize: 9, fontFamily: 'Helvetica-Bold', color: RED, textAlign: 'right', marginRight: 8 },
  tableName: { flex: 1, fontSize: 9, color: DARK },
  tableCategory: { width: 68, fontSize: 8, color: MID, textAlign: 'right' },

  // ── Pricing ──
  pricingWrap: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  pricingBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 12,
  },
  pricingRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  pricingLabel: { fontSize: 9, color: MID },
  pricingValue: { fontSize: 9, color: DARK },
  pricingDivider: { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 6 },
  pricingTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: RED,
    borderRadius: 3,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 4,
  },
  pricingTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },
  pricingTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },

  // ── ROI box ──
  roiBox: {
    flex: 1,
    backgroundColor: GREEN_BG,
    borderRadius: 4,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
    padding: 12,
  },
  roiTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: GREEN,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  roiRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  roiLabel: { fontSize: 9, color: MID },
  roiValue: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: DARK },
  roiUnavailable: { fontSize: 8, color: MID, fontFamily: 'Helvetica-Oblique', marginTop: 4 },

  // ── Notes ──
  notesBox: {
    marginTop: 16,
    backgroundColor: LIGHT_BG,
    borderRadius: 4,
    padding: 12,
  },
  notesText: { fontSize: 9, color: MID },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 16,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 6,
  },
  footerText: { fontSize: 8, color: MID },
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
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function addDays(d: Date | string, days: number) {
  const dt = new Date(d)
  dt.setDate(dt.getDate() + days)
  return formatDate(dt)
}

function fmtKwp(kwp: number) {
  return kwp.toLocaleString('fr-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  quote: FullQuote
  scenarios: PricedScenario[]
  mapImageDataUrl?: string | null
}

export default function QuotePdf({ quote, scenarios, mapImageDataUrl }: Props) {
  const generatedDate = formatDate(new Date())
  const validUntil = addDays(new Date(), 30)

  return (
    <Document
      title={`Offre ${quote.quoteNumber}`}
      author="I.ON Energy Services"
      subject="Offre commerciale installation photovoltaïque"
    >
      <Page size="A4" style={s.page}>
        {/* ── Header band ── */}
        <View style={s.headerBand} fixed>
          <View>
            <Text style={s.headerCompany}>I.ON ENERGY SERVICES</Text>
            <Text style={s.headerSubtitle}>Offre commerciale — Installation photovoltaïque</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerQuoteNum}>{quote.quoteNumber}</Text>
            <Text style={s.headerDate}>{formatDate(quote.createdAt)}</Text>
          </View>
        </View>

        <View style={s.body}>
          {/* ── Customer + validity ── */}
          <View style={s.customerRow}>
            <View style={s.customerBox}>
              <Text style={s.sectionLabel}>Client</Text>
              {quote.customerName ? (
                <Text style={s.customerName}>{quote.customerName}</Text>
              ) : null}
              {quote.siteAddress ? (
                <Text style={s.customerDetail}>{quote.siteAddress}</Text>
              ) : null}
              {quote.customerZip || quote.customerCanton ? (
                <Text style={s.customerDetail}>
                  {[quote.customerZip, quote.customerCanton].filter(Boolean).join(' ')}
                </Text>
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

            <View style={s.validityBox}>
              <Text style={s.validityLabel}>Offre valable jusqu&apos;au</Text>
              <Text style={s.validityValue}>{validUntil}</Text>
              <Text style={s.validityNote}>30 jours dès émission</Text>
            </View>
          </View>

          {/* ── Scenarios ── */}
          {scenarios.length === 0 ? (
            <View style={s.roiBox}>
              <Text style={s.customerDetail}>Aucun scénario enregistré pour cette offre.</Text>
            </View>
          ) : (
            scenarios.map((scenario, idx) => (
              <ScenarioSection
                key={scenario.id}
                scenario={scenario}
                index={idx}
                total={scenarios.length}
              />
            ))
          )}

          {/* ── Aerial site map ── */}
          {mapImageDataUrl ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[s.sectionLabel, { marginBottom: 6 }]}>Vue aérienne du site d&apos;installation</Text>
              <Image
                src={mapImageDataUrl}
                style={{ width: '100%', height: 220, objectFit: 'cover', borderRadius: 4 }}
              />
              <Text style={{ fontSize: 7, color: MID, marginTop: 3 }}>
                © swisstopo — Image aérienne à titre indicatif
              </Text>
            </View>
          ) : null}

          {/* ── Notes ── */}
          {quote.notes ? (
            <View style={s.notesBox}>
              <Text style={s.sectionLabel}>Notes</Text>
              <Text style={s.notesText}>{quote.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* ── Footer ── */}
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
    <View style={s.scenarioWrap} break={index > 0}>
      {/* Header */}
      <View style={s.scenarioHeader}>
        {total > 1 ? (
          <Text style={s.scenarioBadge}>Option {index + 1}</Text>
        ) : null}
        <Text style={s.scenarioName}>{scenario.name}</Text>
      </View>

      {/* KPI cards */}
      <View style={s.kpiRow}>
        {scenario.installedKwp != null ? (
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{fmtKwp(scenario.installedKwp)} kWp</Text>
            <Text style={s.kpiLabel}>
              {scenario.panelCount > 0 && scenario.panelPowerWp
                ? `${scenario.panelCount} × ${scenario.panelPowerWp} Wp`
                : `${scenario.panelCount} panneau${scenario.panelCount > 1 ? 'x' : ''}`}
            </Text>
          </View>
        ) : null}
        {scenario.annualKwhYield != null ? (
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>
              {Math.round(scenario.annualKwhYield).toLocaleString('fr-CH')} kWh
            </Text>
            <Text style={s.kpiLabel}>Production annuelle estimée</Text>
          </View>
        ) : null}
        {scenario.paybackYears != null ? (
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>{scenario.paybackYears.toFixed(1)} ans</Text>
            <Text style={s.kpiLabel}>Retour sur investissement</Text>
          </View>
        ) : (
          <View style={s.kpiCard}>
            <Text style={s.kpiValue}>—</Text>
            <Text style={s.kpiLabel}>Retour sur investissement{'\n'}(NPA requis)</Text>
          </View>
        )}
      </View>

      {/* Roof info */}
      <Text style={s.roofLine}>
        Toiture : {ROOF_TYPE_FR[scenario.roofType] ?? scenario.roofType}
        {'  ·  '}
        {ROOF_SLOPE_FR[scenario.roofSlope] ?? scenario.roofSlope}
      </Text>

      {/* Equipment table */}
      <View style={s.tableHeader}>
        <View style={{ width: 36 }} />
        <Text style={[s.tableHeaderText, { flex: 1 }]}>Désignation</Text>
        <Text style={[s.tableHeaderText, { width: 68, textAlign: 'right' }]}>Catégorie</Text>
      </View>
      {scenario.items.map((item, i) => (
        <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={s.tableQty}>{item.quantity}×</Text>
          <Text style={s.tableName}>{item.name}</Text>
          <Text style={s.tableCategory}>{CATEGORY_FR[item.category] ?? item.category}</Text>
        </View>
      ))}
      {scenario.options.map((opt, i) => (
        <View key={i} style={[s.tableRow, (scenario.items.length + i) % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={s.tableQty}>1×</Text>
          <Text style={s.tableName}>{opt.name}</Text>
          <Text style={s.tableCategory}>Service</Text>
        </View>
      ))}

      {/* Pricing + ROI side by side */}
      <View style={s.pricingWrap}>
        {/* Pricing */}
        <View style={s.pricingBox}>
          <Text style={s.sectionLabel}>Récapitulatif financier</Text>
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>Prix HT</Text>
            <Text style={s.pricingValue}>{formatChf(scenario.sellingPriceExVatRappen)}</Text>
          </View>
          <View style={s.pricingRow}>
            <Text style={s.pricingLabel}>TVA ({vatPct})</Text>
            <Text style={s.pricingValue}>{formatChf(scenario.vatRappen)}</Text>
          </View>
          <View style={s.pricingDivider} />
          <View style={s.pricingTotalRow}>
            <Text style={s.pricingTotalLabel}>Total TTC</Text>
            <Text style={s.pricingTotalValue}>{formatChf(scenario.sellingPriceIncVatRappen)}</Text>
          </View>
        </View>

        {/* ROI */}
        <View style={s.roiBox}>
          <Text style={s.roiTitle}>Rentabilité estimée</Text>
          {scenario.annualKwhYield != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>Production annuelle</Text>
              <Text style={s.roiValue}>
                {Math.round(scenario.annualKwhYield).toLocaleString('fr-CH')} kWh
              </Text>
            </View>
          ) : null}

          {/* Self-consumption split */}
          {scenario.selfConsumedKwh != null && scenario.selfConsumptionRatePct != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>
                Autoconsommation ({scenario.selfConsumptionRatePct}%)
              </Text>
              <Text style={s.roiValue}>
                {scenario.selfConsumedKwh.toLocaleString('fr-CH')} kWh
                {scenario.selfConsumptionSavingsRappen != null ? `  ·  ${formatChf(scenario.selfConsumptionSavingsRappen)}` : ''}
              </Text>
            </View>
          ) : null}
          {scenario.exportedKwh != null && scenario.selfConsumptionRatePct != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>
                Injection réseau ({100 - scenario.selfConsumptionRatePct}%)
                {scenario.feedInRateRappenPerKwh != null ? `  @  ${scenario.feedInRateRappenPerKwh} ct/kWh` : ''}
              </Text>
              <Text style={s.roiValue}>
                {scenario.exportedKwh.toLocaleString('fr-CH')} kWh
                {scenario.exportRevenueRappen != null ? `  ·  ${formatChf(scenario.exportRevenueRappen)}` : ''}
              </Text>
            </View>
          ) : null}

          {scenario.annualSavingsRappen != null ? (
            <View style={[s.roiRow, { borderTopWidth: 0.5, borderTopColor: '#bbf7d0', marginTop: 3, paddingTop: 3 }]}>
              <Text style={[s.roiLabel, { fontFamily: 'Helvetica-Bold' }]}>Valeur annuelle totale</Text>
              <Text style={[s.roiValue, { fontFamily: 'Helvetica-Bold' }]}>{formatChf(scenario.annualSavingsRappen)}</Text>
            </View>
          ) : null}
          {scenario.paybackYears != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>Amortissement brut</Text>
              <Text style={s.roiValue}>{scenario.paybackYears.toFixed(1)} ans</Text>
            </View>
          ) : null}

          {/* Rate context */}
          {(scenario.rateRappenPerKwh != null || scenario.feedInRateRappenPerKwh != null) ? (
            <View style={{ marginTop: 4, paddingTop: 4, borderTopWidth: 0.5, borderTopColor: '#bbf7d0' }}>
              {scenario.rateRappenPerKwh != null ? (
                <View style={s.roiRow}>
                  <Text style={[s.roiLabel, { color: '#6b7280' }]}>Tarif consommation (ElCom)</Text>
                  <Text style={[s.roiValue, { color: '#6b7280' }]}>{scenario.rateRappenPerKwh.toFixed(2)} ct/kWh</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {/* Subsidies */}
          {(scenario.pronovoSubsidyRappen != null || scenario.taxSavingsRappen != null) ? (
            <View style={{ marginTop: 6, paddingTop: 6, borderTopWidth: 0.5, borderTopColor: '#bbf7d0' }}>
              <Text style={[s.roiTitle, { color: '#1d4ed8', marginBottom: 4 }]}>Aides &amp; déductions</Text>
              {scenario.pronovoSubsidyRappen != null ? (
                <View style={s.roiRow}>
                  <Text style={s.roiLabel}>Subvention Pronovo (PRU)</Text>
                  <Text style={[s.roiValue, { color: '#1d4ed8' }]}>−{formatChf(scenario.pronovoSubsidyRappen)}</Text>
                </View>
              ) : null}
              {scenario.taxSavingsRappen != null ? (
                <View style={s.roiRow}>
                  <Text style={s.roiLabel}>Déduction fiscale (est. 20%)</Text>
                  <Text style={[s.roiValue, { color: '#1d4ed8' }]}>−{formatChf(scenario.taxSavingsRappen)}</Text>
                </View>
              ) : null}
              {scenario.effectiveInvestmentRappen != null ? (
                <View style={s.roiRow}>
                  <Text style={[s.roiLabel, { fontFamily: 'Helvetica-Bold' }]}>Investissement net</Text>
                  <Text style={[s.roiValue, { fontFamily: 'Helvetica-Bold' }]}>{formatChf(scenario.effectiveInvestmentRappen)}</Text>
                </View>
              ) : null}
              {scenario.paybackYearsWithSubsidy != null ? (
                <View style={s.roiRow}>
                  <Text style={[s.roiLabel, { fontFamily: 'Helvetica-Bold' }]}>Amortissement avec aides</Text>
                  <Text style={[s.roiValue, { fontFamily: 'Helvetica-Bold', color: GREEN }]}>{scenario.paybackYearsWithSubsidy.toFixed(1)} ans</Text>
                </View>
              ) : null}
              <Text style={[s.roiUnavailable, { marginTop: 3 }]}>
                Subvention Pronovo indicative · Déduction fiscale estimée à 20% du HT
              </Text>
            </View>
          ) : null}

          {scenario.annualSavingsRappen == null ? (
            <Text style={s.roiUnavailable}>
              {scenario.annualKwhYield != null
                ? 'Saisissez l\'adresse du site pour calculer les économies.'
                : 'Aucun panneau — données insuffisantes.'}
            </Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
