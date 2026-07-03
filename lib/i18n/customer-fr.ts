/**
 * Customer-facing French strings for /present/[quoteId] (customer meeting mode).
 *
 * Centralized so:
 *   - Rep team lead can edit copy without touching component files
 *   - Future DE pass becomes a sibling file (lib/i18n/customer-de.ts) + a 1-line
 *     locale switch — not a component refactor
 *
 * Tone (per DESIGN.md customer-mode rules):
 *   - Warm but precise
 *   - Customer-relevant terms (benefits), not internal jargon
 *   - No margin %, no cost basis, no scenario IDs, no rep email
 *
 * Keys are kebab-case, grouped by screen + chrome.
 */

export const customerFr = {
  // ─── Top chrome ─────────────────────────────────────────────
  greeting: (firstName: string) => `Bonjour ${firstName}`,
  greetingFallback: 'Bonjour',
  backLink: '← Retour à l’offre',

  // ─── Screen 1: Votre toit ───────────────────────────────────
  screen1: {
    title: 'Votre toit',
    label: {
      surface: 'Surface',
      irradiation: 'Irradiation',
      classe: 'Classe',
    },
    fallback: {
      // Shown when no mapLat/mapLon on the quote
      noMapPosition: 'Demandez à votre conseiller de localiser votre toit',
      // Shown when satellite image fails AND parcel cadastre fallback renders
      // Per design review issue 2.2: framed as feature, not failure
      cadastreCaption: 'Vue cadastrale de votre parcelle',
      cadastreRetry: 'Recharger l’image satellite',
      // Last-resort: no image AND no cadastre
      imageUnavailable: 'Image en cours de chargement',
    },
  },

  // ─── Screen 2: Vos options ──────────────────────────────────
  screen2: {
    title: 'Vos options',
    eyebrow: {
      essentiel: 'ESSENTIEL',
      recommande: 'RECOMMANDÉ',
      premium: 'PREMIUM',
    },
    // Fallback for legacy quotes with only one scenario (non-AI)
    fallbackToRecommande: 'Configuration recommandée pour votre projet',
  },

  // ─── Screen 3: Vos chiffres ─────────────────────────────────
  screen3: {
    title: 'Vos chiffres',
    label: {
      paybackPrefix: 'Rentabilisé en',
      paybackSuffix: 'ans',
      lifetimeSavings: (chf: string) => `Économies cumulées sur 25 ans : ${chf}`,
    },
    axis: {
      year1: 'An 1',
      payback: (year: number) => `An ${year} (rentabilisé)`,
      year25: 'An 25',
    },
    fallback: {
      // Shown when annualSavingsRappen is null (pre-Phase-2 quote)
      noRoiData: 'Données ROI indisponibles, contactez votre conseiller',
    },
  },

  // ─── Screen 4: Et si vous ne faites rien ? ─────────────────
  screen4: {
    title: 'Et si vous ne faites rien ?',
    legend: {
      without: 'Sans installation',
      with: 'Avec installation',
    },
    // Suffix under the hero advantage number (the number itself is rendered
    // big, Screen-3 style).
    advantageSuffix: 'CHF d’avantage sur 25 ans',
    subCaption:
      'Coût cumulé de votre électricité — au tarif actuel de votre commune, avec la hausse des prix.',
    axis: {
      year1: 'An 1',
      year25: 'An 25',
    },
  },

  // ─── Bottom chrome (screen indicator) ──────────────────────
  screenIndicator: {
    label: (current: number, total: number) => `Écran ${current} sur ${total}`,
    jumpAria: (n: number) => `Aller à l’écran ${n}`,
    // For screen-reader announcement on screen change (aria-live region).
    // Format: "Écran 2 sur 3 : Vos options"
    announce: (current: number, total: number, title: string) =>
      `Écran ${current} sur ${total} : ${title}`,
  },

  // ─── Skip-link (a11y) ──────────────────────────────────────
  skipLink: 'Passer au contenu principal',
} as const

export type CustomerFr = typeof customerFr
