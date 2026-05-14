/**
 * Attestation de respect des exigences de protection contre le bruit
 * (OPB, SR 814.41 Annexe 6) for outdoor PAC installations.
 *
 * v1 is intentionally minimal:
 *   - PAC machine specs (brand, model, acoustic power)
 *   - Distance to each neighboring building
 *   - Predicted noise level at each neighbor using the simplified model
 *   - Compliance flags vs. OPB Class II thresholds (day + night)
 *   - Rep signature block
 *
 * v1.x will add: noise-class picker (Class I-IV), night-only vs. all-hours
 * operation flag, directivity correction, custom receiver point picker.
 */

import React from 'react'
import {
  Document,
  Page,
  View,
  Text as PdfText,
  StyleSheet,
} from '@react-pdf/renderer'
import {
  OPB_CLASS_II_DAY_DBA,
  OPB_CLASS_II_NIGHT_DBA,
  type NoiseAtReceiver,
} from '@/lib/noise'

export interface AttestationBruitProps {
  customerName: string | null
  quoteNumber: string
  siteAddress: string | null
  /** PAC machine description — brand + model name */
  pacMachineLabel: string | null
  /** PAC acoustic power Lw at 2°C in dB(A). null = catalog data missing */
  acousticPowerDbA: number | null
  /** Distance + noise level at each detected neighbor */
  receivers: Array<{
    label: string
    distanceM: number
    noise: NoiseAtReceiver
  }>
  /** Rep name for the signature block */
  repName: string | null
  generatedAt: Date
}

const RED = '#d92127'
const GREEN = '#16a34a'
const GRAY_DARK = '#1c1917'
const GRAY_MID = '#6b7280'
const GRAY_LIGHT = '#d6d3d1'

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: GRAY_DARK, fontFamily: 'Helvetica' },
  header: { marginBottom: 18 },
  title: { fontSize: 16, fontWeight: 700, marginBottom: 4 },
  subtitle: { fontSize: 9, color: GRAY_MID },
  meta: { fontSize: 9, color: GRAY_MID, marginTop: 4 },

  sectionTitle: { fontSize: 11, fontWeight: 700, marginTop: 14, marginBottom: 6 },
  row: { flexDirection: 'row', marginBottom: 2 },
  rowLabel: { width: 160, color: GRAY_MID },
  rowValue: { flex: 1 },

  warning: {
    backgroundColor: '#fef3c7',
    padding: 8,
    border: `0.5pt solid #f59e0b`,
    fontSize: 9,
    marginBottom: 10,
  },

  // Table
  table: { marginTop: 6, border: `0.5pt solid ${GRAY_LIGHT}` },
  th: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f4',
    padding: 6,
    fontSize: 8,
    fontWeight: 700,
    borderBottom: `0.5pt solid ${GRAY_LIGHT}`,
  },
  td: {
    flexDirection: 'row',
    padding: 6,
    fontSize: 9,
    borderBottom: `0.25pt solid ${GRAY_LIGHT}`,
  },
  colReceiver: { flex: 2 },
  colDist: { flex: 1, textAlign: 'right' },
  colLevel: { flex: 1, textAlign: 'right' },
  colDay: { flex: 1, textAlign: 'center' },
  colNight: { flex: 1, textAlign: 'center' },

  badgeOk: { color: GREEN, fontWeight: 700 },
  badgeFail: { color: RED, fontWeight: 700 },

  formula: {
    backgroundColor: '#fafaf9',
    padding: 8,
    fontFamily: 'Courier',
    fontSize: 9,
    marginTop: 6,
  },

  signature: {
    marginTop: 28,
    paddingTop: 12,
    borderTop: `0.5pt solid ${GRAY_LIGHT}`,
  },
  signLine: {
    marginTop: 30,
    borderTop: `0.5pt solid ${GRAY_DARK}`,
    paddingTop: 4,
    fontSize: 9,
    width: 240,
  },

  footer: {
    marginTop: 20,
    paddingTop: 8,
    borderTop: `0.5pt solid ${GRAY_LIGHT}`,
    fontSize: 8,
    color: GRAY_MID,
  },
})

export function AttestationBruitPdf(props: AttestationBruitProps) {
  const {
    customerName,
    quoteNumber,
    siteAddress,
    pacMachineLabel,
    acousticPowerDbA,
    receivers,
    repName,
    generatedAt,
  } = props

  const dataIncomplete = acousticPowerDbA == null || receivers.length === 0

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <PdfText style={styles.title}>
            Attestation de protection contre le bruit
          </PdfText>
          <PdfText style={styles.subtitle}>
            OPB · SR 814.41 Annexe 6 · Installation de pompe à chaleur extérieure
          </PdfText>
          <PdfText style={styles.meta}>
            {customerName ?? '(client non renseigné)'} · Offre {quoteNumber} ·{' '}
            Établi le {generatedAt.toLocaleDateString('fr-CH')}
          </PdfText>
        </View>

        {dataIncomplete && (
          <View style={styles.warning}>
            <PdfText>
              ⚠ Données incomplètes — cette attestation est un brouillon. Veuillez
              compléter manuellement les champs marqués «—» avant signature.
            </PdfText>
          </View>
        )}

        <PdfText style={styles.sectionTitle}>1. Site d'installation</PdfText>
        <View style={styles.row}>
          <PdfText style={styles.rowLabel}>Adresse</PdfText>
          <PdfText style={styles.rowValue}>{siteAddress ?? '—'}</PdfText>
        </View>
        <View style={styles.row}>
          <PdfText style={styles.rowLabel}>Client</PdfText>
          <PdfText style={styles.rowValue}>{customerName ?? '—'}</PdfText>
        </View>

        <PdfText style={styles.sectionTitle}>2. Source acoustique</PdfText>
        <View style={styles.row}>
          <PdfText style={styles.rowLabel}>Machine</PdfText>
          <PdfText style={styles.rowValue}>{pacMachineLabel ?? '—'}</PdfText>
        </View>
        <View style={styles.row}>
          <PdfText style={styles.rowLabel}>
            Puissance acoustique Lw (à 2°C)
          </PdfText>
          <PdfText style={styles.rowValue}>
            {acousticPowerDbA != null ? `${acousticPowerDbA.toFixed(1)} dB(A)` : '—'}
          </PdfText>
        </View>

        <PdfText style={styles.sectionTitle}>
          3. Évaluation aux récepteurs voisins
        </PdfText>
        {receivers.length === 0 ? (
          <PdfText style={{ color: GRAY_MID, fontSize: 9 }}>
            Aucun bâtiment voisin détecté dans un rayon de 80 m. L'évaluation
            doit être effectuée manuellement contre le récepteur le plus proche.
          </PdfText>
        ) : (
          <View style={styles.table}>
            <View style={styles.th}>
              <PdfText style={styles.colReceiver}>Récepteur</PdfText>
              <PdfText style={styles.colDist}>Distance</PdfText>
              <PdfText style={styles.colLevel}>Niveau prévu</PdfText>
              <PdfText style={styles.colDay}>
                Jour ≤{OPB_CLASS_II_DAY_DBA}
              </PdfText>
              <PdfText style={styles.colNight}>
                Nuit ≤{OPB_CLASS_II_NIGHT_DBA}
              </PdfText>
            </View>
            {receivers.map((r, i) => (
              <View key={i} style={styles.td}>
                <PdfText style={styles.colReceiver}>{r.label}</PdfText>
                <PdfText style={styles.colDist}>
                  {r.distanceM.toFixed(1)} m
                </PdfText>
                <PdfText style={styles.colLevel}>
                  {r.noise.levelDbA.toFixed(1)} dB(A)
                </PdfText>
                <PdfText
                  style={[
                    styles.colDay,
                    r.noise.compliesDayClassII ? styles.badgeOk : styles.badgeFail,
                  ]}
                >
                  {r.noise.compliesDayClassII ? '✓' : '✗'}
                </PdfText>
                <PdfText
                  style={[
                    styles.colNight,
                    r.noise.compliesNightClassII
                      ? styles.badgeOk
                      : styles.badgeFail,
                  ]}
                >
                  {r.noise.compliesNightClassII ? '✓' : '✗'}
                </PdfText>
              </View>
            ))}
          </View>
        )}

        <View style={styles.formula}>
          <PdfText>
            Modèle simplifié: L_récepteur = Lw − 20·log10(d) − 8 dB
          </PdfText>
          <PdfText>
            Seuils par défaut (zone de degré de sensibilité II): jour ≤
            {OPB_CLASS_II_DAY_DBA} dB(A), nuit ≤{OPB_CLASS_II_NIGHT_DBA} dB(A).
          </PdfText>
        </View>

        <View style={styles.signature}>
          <PdfText style={{ fontSize: 9 }}>
            Le soussigné atteste que l'installation respecte les exigences de
            l'OPB pour la classe de sensibilité au bruit applicable au site.
          </PdfText>
          <PdfText style={styles.signLine}>
            {repName ?? '(installateur)'}, lieu et date, signature
          </PdfText>
        </View>

        <View style={styles.footer}>
          <PdfText>
            Calcul indicatif. La conformité finale doit être vérifiée par un
            acousticien si le niveau aux récepteurs approche les seuils OPB ou
            si la zone de sensibilité diffère de la classe II par défaut.
          </PdfText>
        </View>
      </Page>
    </Document>
  )
}
