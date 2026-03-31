/**
 * QuotePdf — react-pdf template for I.ON Energy quotes.
 * Design: Variant D — Bold Proposal × Swiss Precision
 *
 * IMPORTANT: This component must only be imported in server-side code
 * (API routes, Server Components). Never import in Client Components —
 * @react-pdf/renderer is a Node.js library and will break in the browser.
 */

import React from 'react'
import path from 'path'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'

const LOGO_PATH = path.join(process.cwd(), 'public', 'logo.png')
import { formatChf, formatPct } from '@/lib/pricing'
import type { FullQuote, PricedScenario } from '@/lib/quote-pdf'

// ─── Palette ──────────────────────────────────────────────────────────────────

const RED        = '#d92127'
const DARK       = '#1c1917'
const MID        = '#6b7280'
const WARM_MID   = '#78716c'
const LIGHT_BG   = '#fafaf9'
const BORDER     = '#e7e5e4'
const BORDER_MID = '#d6d3d1'
const WHITE      = '#ffffff'
const GREEN      = '#16a34a'
const GREEN_BG   = '#f0fdf4'
const GREEN_BDR  = '#d1fae5'
const GREEN_LINE = '#bbf7d0'
const BLUE       = '#1d4ed8'
const BLUE_BG    = '#eff6ff'
const BLUE_BDR   = '#dbeafe'

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: DARK,
    backgroundColor: WHITE,
    paddingBottom: 48,
    paddingHorizontal: 0,
  },

  // ── White header ──
  header: {
    backgroundColor: WHITE,
    paddingHorizontal: 40,
    paddingTop: 26,
    paddingBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headerLogo: {
    height: 34,
    width: 130,
    objectFit: 'contain',
  },
  headerRight: { alignItems: 'flex-end' },
  headerTag: {
    fontSize: 7.5,
    color: '#9ca3af',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 3,
  },
  headerQuoteNum: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: RED,
  },
  headerDate: { fontSize: 9, color: '#9ca3af', marginTop: 2 },
  redRule: { height: 2, backgroundColor: RED },

  // ── Price hero ──
  priceHero: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 18,
    backgroundColor: LIGHT_BG,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  priceMain: {
    fontSize: 34,
    fontFamily: 'Helvetica-Bold',
    color: RED,
  },
  priceMeta: { fontSize: 9, color: WARM_MID, marginTop: 4 },
  priceDivider: {
    width: 1,
    height: 44,
    backgroundColor: BORDER,
    marginHorizontal: 28,
  },
  priceDescTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: DARK },
  priceDescSub: { fontSize: 9, color: '#9ca3af', marginTop: 3 },

  // ── Body ──
  body: { paddingHorizontal: 40 },

  // ── KPI cards ──
  kpiRow: {
    flexDirection: 'row',
    marginTop: 18,
    marginBottom: 16,
    gap: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: WHITE,
    borderWidth: 1,
    borderColor: BORDER,
    borderTopWidth: 3,
    borderTopColor: RED,
    paddingHorizontal: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  kpiValue: { fontSize: 15, fontFamily: 'Helvetica-Bold', color: DARK },
  kpiLabel: {
    fontSize: 7,
    color: WARM_MID,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    textAlign: 'center',
  },

  // ── Customer + validity ──
  customerRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 18,
  },
  customerBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: RED,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  validityBox: {
    width: 148,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: WARM_MID,
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
  validityLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: RED,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  validityValue: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: DARK, textAlign: 'center' },
  validityNote: { fontSize: 8, color: '#9ca3af', marginTop: 3, textAlign: 'center' },

  // ── Scenario ──
  scenarioWrap: { marginBottom: 20 },
  scenarioBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#292524',
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 12,
  },
  scenarioBadge: {
    backgroundColor: RED,
    color: WHITE,
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginRight: 10,
  },
  scenarioName: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },

  // ── Equipment table ──
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: BORDER_MID,
  },
  tableHeaderText: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: WARM_MID,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: BORDER,
  },
  tableRowAlt: { backgroundColor: LIGHT_BG },
  tableQty: {
    width: 32,
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: RED,
  },
  tableName: { flex: 1, fontSize: 9, color: DARK },
  tableCategory: { width: 80, fontSize: 8, color: WARM_MID, textAlign: 'right' },

  // ── Financial + ROI ──
  finWrap: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 14,
  },
  finBox: {
    flex: 1,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
  },
  finRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 },
  finLabel: { fontSize: 9, color: MID },
  finValue: { fontSize: 9, color: DARK },
  finDivider: { borderTopWidth: 0.5, borderTopColor: BORDER, marginVertical: 8 },
  finTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: RED,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 6,
  },
  finTotalLabel: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },
  finTotalValue: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: WHITE },

  // ── ROI box ──
  roiBox: {
    flex: 1,
    backgroundColor: GREEN_BG,
    borderWidth: 1,
    borderColor: GREEN_BDR,
    borderLeftWidth: 3,
    borderLeftColor: GREEN,
    padding: 14,
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

  // ── Subsidy strip ──
  subsidyStrip: {
    flexDirection: 'row',
    marginTop: 12,
    borderWidth: 1,
    borderColor: BLUE_BDR,
  },
  subsidyItem: {
    flex: 1,
    backgroundColor: BLUE_BG,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRightWidth: 1,
    borderRightColor: BLUE_BDR,
  },
  subsidyItemLast: {
    borderRightWidth: 0,
  },
  subsidyLabel: {
    fontSize: 7,
    color: MID,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 3,
  },
  subsidyValue: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: BLUE },
  subsidyValueNeutral: { fontSize: 10, fontFamily: 'Helvetica-Bold', color: DARK },
  subsidyNote: { fontSize: 7, color: '#93c5fd', marginTop: 2 },

  // ── Notes ──
  notesBox: {
    marginTop: 16,
    backgroundColor: LIGHT_BG,
    borderWidth: 1,
    borderColor: BORDER,
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
  footerText: { fontSize: 8, color: '#9ca3af' },
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
  const firstScenario = scenarios[0] ?? null

  return (
    <Document
      title={`Offre ${quote.quoteNumber}`}
      author="I.ON Energy Services"
      subject="Offre commerciale installation photovoltaïque"
    >
      <Page size="A4" style={s.page}>

        {/* ── White header ── */}
        <View style={s.header} fixed>
          <Image src={LOGO_PATH} style={s.headerLogo} />
          <View style={s.headerRight}>
            <Text style={s.headerTag}>Offre commerciale</Text>
            <Text style={s.headerQuoteNum}>{quote.quoteNumber}</Text>
            <Text style={s.headerDate}>{formatDate(quote.createdAt)}</Text>
          </View>
        </View>
        <View style={s.redRule} fixed />

        {/* ── Price hero ── */}
        {firstScenario ? (
          <View style={s.priceHero}>
            <View>
              <Text style={s.priceMain}>{formatChf(firstScenario.sellingPriceIncVatRappen)}</Text>
              <Text style={s.priceMeta}>
                Total TTC — TVA {formatPct(firstScenario.vatPctBasisPts)} incluse
              </Text>
            </View>
            <View style={s.priceDivider} />
            <View>
              <Text style={s.priceDescTitle}>{firstScenario.name}</Text>
              <Text style={s.priceDescSub}>
                Offre valable jusqu&apos;au {validUntil} · 30 jours dès émission
              </Text>
            </View>
          </View>
        ) : null}

        <View style={s.body}>

          {/* ── KPI cards (first / only scenario summary) ── */}
          {firstScenario ? (
            <View style={s.kpiRow}>
              {firstScenario.installedKwp != null ? (
                <View style={s.kpiCard}>
                  <Text style={s.kpiValue}>{fmtKwp(firstScenario.installedKwp)} kWp</Text>
                  <Text style={s.kpiLabel}>Puissance installée</Text>
                </View>
              ) : null}
              {firstScenario.annualKwhYield != null ? (
                <View style={s.kpiCard}>
                  <Text style={s.kpiValue}>
                    {Math.round(firstScenario.annualKwhYield).toLocaleString('fr-CH')} kWh
                  </Text>
                  <Text style={s.kpiLabel}>Production annuelle</Text>
                </View>
              ) : null}
              <View style={s.kpiCard}>
                <Text style={s.kpiValue}>
                  {firstScenario.paybackYears != null
                    ? `${firstScenario.paybackYears.toFixed(1)} ans`
                    : '—'}
                </Text>
                <Text style={s.kpiLabel}>Retour investissement</Text>
              </View>
              {firstScenario.paybackYearsWithSubsidy != null ? (
                <View style={s.kpiCard}>
                  <Text style={s.kpiValue}>
                    {firstScenario.paybackYearsWithSubsidy.toFixed(1)} ans
                  </Text>
                  <Text style={s.kpiLabel}>Avec aides &amp; Pronovo</Text>
                </View>
              ) : null}
            </View>
          ) : null}

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
              <Text style={[s.sectionLabel, { marginBottom: 6 }]}>
                Vue aérienne du site d&apos;installation
              </Text>
              <Image
                src={mapImageDataUrl}
                style={{ width: '100%', height: 220, objectFit: 'cover' }}
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
          <Text style={s.footerText}>Offre commerciale — Installation photovoltaïque</Text>
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

      {/* Scenario bar */}
      <View style={s.scenarioBar}>
        {total > 1 ? (
          <Text style={s.scenarioBadge}>Option {index + 1}</Text>
        ) : null}
        <Text style={s.scenarioName}>{scenario.name}</Text>
      </View>

      {/* Equipment table */}
      <View style={s.tableHeader}>
        <View style={{ width: 40 }} />
        <Text style={[s.tableHeaderText, { flex: 1 }]}>Désignation</Text>
        <Text style={[s.tableHeaderText, { width: 80, textAlign: 'right' }]}>Catégorie</Text>
      </View>
      {scenario.items.map((item, i) => (
        <View key={i} style={[s.tableRow, i % 2 === 1 ? s.tableRowAlt : {}]}>
          <Text style={s.tableQty}>{item.quantity}×</Text>
          <Text style={s.tableName}>{item.name}</Text>
          <Text style={s.tableCategory}>{CATEGORY_FR[item.category] ?? item.category}</Text>
        </View>
      ))}
      {scenario.options.map((opt, i) => (
        <View
          key={i}
          style={[s.tableRow, (scenario.items.length + i) % 2 === 1 ? s.tableRowAlt : {}]}
        >
          <Text style={s.tableQty}>1×</Text>
          <Text style={s.tableName}>{opt.name}</Text>
          <Text style={s.tableCategory}>Service</Text>
        </View>
      ))}

      {/* Financial + ROI side by side */}
      <View style={s.finWrap}>

        {/* Pricing box */}
        <View style={s.finBox}>
          <Text style={s.sectionLabel}>Récapitulatif financier</Text>
          <View style={s.finRow}>
            <Text style={s.finLabel}>Prix HT</Text>
            <Text style={s.finValue}>{formatChf(scenario.sellingPriceExVatRappen)}</Text>
          </View>
          <View style={s.finRow}>
            <Text style={s.finLabel}>TVA ({vatPct})</Text>
            <Text style={s.finValue}>{formatChf(scenario.vatRappen)}</Text>
          </View>
          <View style={s.finDivider} />
          <View style={s.finTotalRow}>
            <Text style={s.finTotalLabel}>Total TTC</Text>
            <Text style={s.finTotalValue}>{formatChf(scenario.sellingPriceIncVatRappen)}</Text>
          </View>
        </View>

        {/* ROI box */}
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

          {scenario.selfConsumedKwh != null && scenario.selfConsumptionRatePct != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>
                Autoconsommation ({scenario.selfConsumptionRatePct}%)
              </Text>
              <Text style={s.roiValue}>
                {scenario.selfConsumedKwh.toLocaleString('fr-CH')} kWh
                {scenario.selfConsumptionSavingsRappen != null
                  ? `  ·  ${formatChf(scenario.selfConsumptionSavingsRappen)}`
                  : ''}
              </Text>
            </View>
          ) : null}

          {scenario.exportedKwh != null && scenario.selfConsumptionRatePct != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>
                Injection réseau ({100 - scenario.selfConsumptionRatePct}%)
                {scenario.feedInRateRappenPerKwh != null
                  ? `  @  ${scenario.feedInRateRappenPerKwh} ct/kWh`
                  : ''}
              </Text>
              <Text style={s.roiValue}>
                {scenario.exportedKwh.toLocaleString('fr-CH')} kWh
                {scenario.exportRevenueRappen != null
                  ? `  ·  ${formatChf(scenario.exportRevenueRappen)}`
                  : ''}
              </Text>
            </View>
          ) : null}

          {scenario.annualSavingsRappen != null ? (
            <View style={[s.roiRow, {
              borderTopWidth: 0.5, borderTopColor: GREEN_LINE,
              marginTop: 3, paddingTop: 4,
            }]}>
              <Text style={[s.roiLabel, { fontFamily: 'Helvetica-Bold' }]}>Valeur annuelle totale</Text>
              <Text style={[s.roiValue, { fontFamily: 'Helvetica-Bold' }]}>
                {formatChf(scenario.annualSavingsRappen)}
              </Text>
            </View>
          ) : null}

          {scenario.paybackYears != null ? (
            <View style={s.roiRow}>
              <Text style={s.roiLabel}>Amortissement brut</Text>
              <Text style={s.roiValue}>{scenario.paybackYears.toFixed(1)} ans</Text>
            </View>
          ) : null}

          {scenario.rateRappenPerKwh != null ? (
            <View style={[s.roiRow, {
              marginTop: 4, paddingTop: 4,
              borderTopWidth: 0.5, borderTopColor: GREEN_LINE,
            }]}>
              <Text style={[s.roiLabel, { color: WARM_MID }]}>Tarif consommation (ElCom)</Text>
              <Text style={[s.roiValue, { color: WARM_MID }]}>
                {scenario.rateRappenPerKwh.toFixed(2)} ct/kWh
              </Text>
            </View>
          ) : null}

          {scenario.annualSavingsRappen == null ? (
            <Text style={s.roiUnavailable}>
              {scenario.annualKwhYield != null
                ? "Saisissez l'adresse du site pour calculer les économies."
                : 'Aucun panneau — données insuffisantes.'}
            </Text>
          ) : null}
        </View>

      </View>

      {/* Subsidy strip — shown when Pronovo or tax data is available */}
      {(scenario.pronovoSubsidyRappen != null ||
        scenario.taxSavingsRappen != null ||
        scenario.effectiveInvestmentRappen != null ||
        scenario.rateRappenPerKwh != null) ? (
        <View style={s.subsidyStrip}>
          {scenario.pronovoSubsidyRappen != null ? (
            <View style={s.subsidyItem}>
              <Text style={s.subsidyLabel}>Subvention Pronovo</Text>
              <Text style={s.subsidyValue}>−{formatChf(scenario.pronovoSubsidyRappen)}</Text>
              <Text style={s.subsidyNote}>Indicatif — validation OFEN</Text>
            </View>
          ) : null}
          {scenario.taxSavingsRappen != null ? (
            <View style={s.subsidyItem}>
              <Text style={s.subsidyLabel}>Déduction fiscale (est.)</Text>
              <Text style={s.subsidyValue}>−{formatChf(scenario.taxSavingsRappen)}</Text>
              <Text style={s.subsidyNote}>~20% du prix HT</Text>
            </View>
          ) : null}
          {scenario.effectiveInvestmentRappen != null ? (
            <View style={s.subsidyItem}>
              <Text style={s.subsidyLabel}>Investissement net</Text>
              <Text style={s.subsidyValueNeutral}>
                {formatChf(scenario.effectiveInvestmentRappen)}
              </Text>
              <Text style={s.subsidyNote}>Après aides &amp; déductions</Text>
            </View>
          ) : null}
          {scenario.paybackYearsWithSubsidy != null ? (
            <View style={[s.subsidyItem, s.subsidyItemLast]}>
              <Text style={s.subsidyLabel}>Amortissement avec aides</Text>
              <Text style={[s.subsidyValue, { color: GREEN }]}>
                {scenario.paybackYearsWithSubsidy.toFixed(1)} ans
              </Text>
              <Text style={s.subsidyNote}>Pronovo + déduction fiscale</Text>
            </View>
          ) : scenario.rateRappenPerKwh != null ? (
            <View style={[s.subsidyItem, s.subsidyItemLast]}>
              <Text style={s.subsidyLabel}>Tarif élec. (ElCom)</Text>
              <Text style={s.subsidyValueNeutral}>
                {scenario.rateRappenPerKwh.toFixed(2)} ct/kWh
              </Text>
              <Text style={s.subsidyNote}>Tarif réseau local</Text>
            </View>
          ) : null}
        </View>
      ) : null}

    </View>
  )
}
