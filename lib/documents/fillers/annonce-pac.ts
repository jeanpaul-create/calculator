/**
 * Vaud — Formulaire d'annonce pour pompe à chaleur (v10, Feb 2025).
 *
 * Source: https://www.vd.ch/environnement/energie/formulaires-energie
 * Template: lib/documents/templates/annonce-pac-v10.pdf (vendored)
 * Form analysis: 63 AcroForm fields (33 text + 30 checkbox), all with
 * semantic French names — pdf-lib parses + fills cleanly with no
 * preprocessing.
 *
 * Field mapping strategy: direct quote → form-field by name. Checkboxes
 * that depend on data we don't yet have (installation type, building
 * zone, acoustic compliance) are left blank — rep hand-fills in the
 * downloaded PDF until Phase 1 adds the missing data fields.
 *
 *   Mapped fields (Phase 0, ~14 of 63):
 *     Requérant 1                           ← quote.customerName
 *     Adresse 1                             ← quote.siteAddress
 *     Adresse parcelle                      ← quote.siteAddress
 *     NP Commune                            ← quote.customerZip + commune
 *     Téléphone                             ← quote.customerPhone
 *     E-Mail                                ← quote.customerEmail
 *     Installateur professionnel prénom, nom ← quote.rep.name
 *     Installateur professionnel E-mail     ← quote.rep.email
 *     RequérantsLieu date                   ← derived (today + commune)
 *     Entreprise installateurLieu date      ← derived
 *     Entreprise installateurNoms et ...    ← I.ON Energy hardcoded
 *
 *   NOT YET MAPPED (need new data fields — added in Phase 1+):
 *     No ECA                                ← needs Quote.noEca
 *     Affectation bâtiment                  ← needs Quote.buildingAssignment
 *     Pompe à chaleur intérieure/extérieure ← needs Product.installType
 *     Acoustic compliance checkboxes        ← needs noise math + neighbors
 *     Zone à bâtir / hors zone              ← needs cadastre call
 *     Fluides frigorigènes                  ← needs Product.refrigerantType
 */

import { PDFDocument, StandardFonts } from 'pdf-lib'
import { readFile } from 'fs/promises'
import path from 'path'
import type { DocumentTemplate } from '../types'
import type { FullQuote } from '@/lib/quote-pdf'

// I.ON Energy installer block — hardcoded for v1 (single-tenant)
const ION_INSTALLER_BLOCK = 'I.ON Energy SA\n[Adresse de I.ON Energy à compléter]'

/** Format today's date in French Swiss format: "Lausanne, le 7 mai 2026" */
function formatLieuDate(commune: string | null): string {
  const today = new Date()
  const months = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
  ]
  const dateStr = `${today.getDate()} ${months[today.getMonth()]} ${today.getFullYear()}`
  return commune ? `${commune}, le ${dateStr}` : `le ${dateStr}`
}

/** Extract commune from siteAddress (best-effort: last comma-separated part) */
function extractCommune(siteAddress: string | null): string | null {
  if (!siteAddress) return null
  const parts = siteAddress.split(',').map((p) => p.trim())
  // "Avenue de Montoie 26, 1007 Lausanne" → "1007 Lausanne"
  return parts[parts.length - 1] || null
}

/** Format "NP Commune" — Swiss postal format: "1007 Lausanne" */
function formatNpCommune(zip: string | null, commune: string | null): string {
  if (zip && commune) return `${zip} ${commune}`
  return commune ?? zip ?? ''
}

export const annoncePacV10: DocumentTemplate = {
  slug: 'annonce-pac',
  title: 'Annonce PAC (Vaud)',
  description: "Formulaire d'annonce d'installation pour pompe à chaleur (v10)",
  icon: '📋',

  appliesTo: (quote) => {
    // Show only when at least one scenario contains a PAC machine.
    // This matches the existing PAC scenarioType convention used elsewhere
    // in the codebase (see /present/ Screen2 and PacCalculatorForm).
    return quote.scenarios.some(
      (s) => s.scenarioType === 'PAC' ||
        s.items?.some((it) => String(it.product.category).startsWith('PAC_'))
    )
  },

  fill: async (quote) => {
    const templatePath = path.join(process.cwd(), 'lib/documents/templates/annonce-pac-v10.pdf')
    const templateBuf = await readFile(templatePath)
    const doc = await PDFDocument.load(templateBuf, { ignoreEncryption: true })

    // Embed Helvetica for regenerated appearance streams. Covers Latin-1
    // (é à ô ç) via WinAnsiEncoding — sufficient for French names + Swiss
    // street addresses. If we hit a name with characters outside Latin-1
    // (extended-extended Latin, e.g. ł, š, đ), we'd need to embed a more
    // complete font like Noto Sans.
    const helvetica = await doc.embedFont(StandardFonts.Helvetica)

    const form = doc.getForm()

    const commune = extractCommune(quote.siteAddress)
    const npCommune = formatNpCommune(quote.customerZip, commune)
    const lieuDate = formatLieuDate(commune)

    // Quote-derivable fields. Wrap in a try/skip per-field so a missing
    // field name in the template doesn't blow up the whole fill — log
    // and continue (template versions may rename fields).
    const trySetText = (name: string, value: string | null | undefined) => {
      if (!value) return
      try {
        form.getTextField(name).setText(value)
      } catch (err) {
        console.warn(`[annonce-pac] field "${name}" not found in template:`, err)
      }
    }

    // Customer block
    trySetText('Requérant 1', quote.customerName)
    trySetText('Adresse 1', quote.siteAddress)
    trySetText('Adresse parcelle', quote.siteAddress)
    trySetText('NP Commune', npCommune)
    trySetText('Téléphone', quote.customerPhone)
    trySetText('E-Mail', quote.customerEmail)

    // Rep / installer block
    trySetText('Installateur professionnel prénom, nom', quote.rep?.name ?? null)
    trySetText('Installateur professionnel E-mail', quote.rep?.email ?? null)
    trySetText(
      'Entreprise installateurNoms et adresse ou tampon de lentreprise',
      ION_INSTALLER_BLOCK
    )
    trySetText(
      'RequérantsNoms et adresse ou tampon de lentreprise',
      quote.customerName ? `${quote.customerName}\n${quote.siteAddress ?? ''}` : null
    )

    // Lieu / date blocks (auto-filled with today's date + commune)
    trySetText('RequérantsLieu date', lieuDate)
    trySetText('Entreprise installateurLieu date', lieuDate)

    // CRITICAL — pdf-lib gotcha: setText writes the value to the data
    // stream but does NOT regenerate the visual appearance. Without this
    // call, many viewers (Chrome's built-in renderer, mobile Safari) show
    // the original empty template even though the values are stored. The
    // explicit font argument also ensures accented French chars render.
    // The PDF remains fillable — rep can still hand-edit unmapped fields
    // like "No ECA" and the acoustic checkboxes in Acrobat.
    form.updateFieldAppearances(helvetica)

    const buffer = await doc.save()
    const filename = `annonce-pac-${quote.quoteNumber}.pdf`
    return { buffer, filename, contentType: 'application/pdf' }
  },
}
