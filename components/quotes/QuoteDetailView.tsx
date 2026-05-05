/**
 * QuoteDetailView — tabbed quote detail page.
 *
 * Hero band: customer name + total CHF + status pill + actions
 * Tabs: Aperçu / Scénarios / Documents / Activité
 *
 * The server page does all the data fetching and passes a flattened,
 * JSON-safe view-model to this client component.
 */
'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  StatusPill,
  Tabs,
  Card,
  EmptyState,
  ActivityTimeline,
  type QuoteStatusValue,
  type ActivityItem,
  type TabItem,
} from '@/components/ui'
import { formatChf, formatPct } from '@/lib/pricing'
import EmailButton from '@/app/(app)/quotes/[id]/EmailButton'
import QuoteStatusActions from '@/app/(app)/quotes/[id]/QuoteStatusActions'

type ScenarioCategory =
  | 'PANEL' | 'INVERTER' | 'BATTERY' | 'MOUNTING' | 'ACCESSORY' | 'EV_CHARGER'
  | 'PAC_MACHINE' | 'PAC_ACCESSORY' | 'PAC_ELECTRICITE' | 'PAC_MACONNERIE'
  | 'PAC_ISOLATION' | 'PAC_CITERNE' | 'PAC_CONDUITE' | 'PAC_MONTAGE' | 'PAC_ADMIN'

export interface ScenarioVM {
  id: string
  name: string
  scenarioType: string
  roofType: string | null
  roofSlope: string | null
  sellingPriceExVatRappen: number | null
  sellingPriceIncVatRappen: number | null
  vatPctBasisPts: number
  marginBasisPts: number
  discountBasisPts: number
  discountReason: string | null
  requiresApproval: boolean
  rateRappenPerKwh: number | null
  yieldKwhPerKwp: number | null
  feedInRateRappenPerKwh: number | null
  selfConsumptionRatePct: number | null
  // Computed ROI (server-priced)
  annualSavingsRappen: number | null
  selfConsumedKwh: number | null
  exportedKwh: number | null
  paybackYears: number | null
  installedKwp: number | null
  annualKwhYield: number | null
  items: { name: string; quantity: number; category: ScenarioCategory }[]
  options: { name: string }[]
}

export interface QuoteDetailVM {
  id: string
  quoteNumber: string
  status: QuoteStatusValue
  customerName: string | null
  customerEmail: string | null
  customerPhone: string | null
  customerZip: string | null
  customerCanton: string | null
  siteAddress: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  sentAt: string | null
  expiresAt: string | null
  followUpAt: string | null
  repName: string | null
  repEmail: string | null
  /**
   * Public share token. Null on DRAFT quotes (no public URL until SENT).
   * Used to build the "Lien client" copy-to-clipboard URL.
   */
  shareToken: string | null
  /**
   * Customer-engagement signals from the public URL (TODO1):
   *   firstViewedAt — when the customer first opened /q/{shareToken}
   *   viewCount     — total number of times the public link has been loaded
   * Both null/0 until the customer opens the link at least once.
   */
  firstViewedAt: string | null
  viewCount: number
  scenarios: ScenarioVM[]
}

interface QuoteDetailViewProps {
  quote: QuoteDetailVM
  isAdmin: boolean
}

type TabValue = 'overview' | 'scenarios' | 'documents' | 'activity'

const ROOF_TYPE_LABEL: Record<string, string> = {
  tuile: 'Tuile',
  ardoise: 'Ardoise',
  bac_acier: 'Bac acier',
  plat: 'Plat',
}

const ROOF_SLOPE_LABEL: Record<string, string> = {
  simple: 'Simple',
  moyen: 'Moyenne',
  complexe: 'Complexe',
}

const CATEGORY_LABEL: Record<ScenarioCategory, string> = {
  PANEL: 'Panneau',
  INVERTER: 'Onduleur',
  BATTERY: 'Batterie',
  MOUNTING: 'Fixation',
  ACCESSORY: 'Accessoire',
  EV_CHARGER: 'Borne EV',
  PAC_MACHINE: 'Machine',
  PAC_ACCESSORY: 'Accessoire',
  PAC_ELECTRICITE: 'Électricité',
  PAC_MACONNERIE: 'Maçonnerie',
  PAC_ISOLATION: 'Isolation',
  PAC_CITERNE: 'Citerne',
  PAC_CONDUITE: 'Conduite',
  PAC_MONTAGE: 'Montage',
  PAC_ADMIN: 'Administratif',
}

export default function QuoteDetailView({ quote, isAdmin }: QuoteDetailViewProps) {
  const [tab, setTab] = useState<TabValue>('overview')

  const totalIncVat = quote.scenarios[0]?.sellingPriceIncVatRappen ?? null

  const items: TabItem<TabValue>[] = [
    { value: 'overview', label: 'Aperçu' },
    { value: 'scenarios', label: 'Scénarios', count: quote.scenarios.length },
    { value: 'documents', label: 'Documents' },
    { value: 'activity', label: 'Activité' },
  ]

  const activityItems: ActivityItem[] = buildActivityFeed(quote)

  return (
    <div>
      {/* Back link */}
      <Link
        href="/quotes"
        className="text-sm text-gray-500 hover:text-gray-700 inline-flex items-center gap-1 mb-3"
      >
        ← Toutes les offres
      </Link>

      {/* Hero band */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-red-600 font-semibold tracking-tight">
                {quote.quoteNumber}
              </span>
              <StatusPill status={quote.status} />
              {quote.scenarios.some((s) => s.requiresApproval) && (
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-50 ring-1 ring-amber-200 rounded px-1.5 py-0.5">
                  Approbation
                </span>
              )}
            </div>
            <h1 className="text-2xl font-semibold text-gray-900 tracking-tight truncate">
              {quote.customerName?.trim() || (
                <span className="text-gray-400 italic">Sans nom</span>
              )}
            </h1>
            {(quote.customerZip || quote.siteAddress) && (
              <p className="text-sm text-gray-500 mt-0.5">
                {[quote.siteAddress, quote.customerZip, quote.customerCanton]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            )}
          </div>

          {totalIncVat != null && (
            <div className="text-right shrink-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
                Total TTC
              </div>
              <div className="text-3xl font-semibold text-red-600 tabular-nums font-mono leading-none">
                {formatChf(totalIncVat)}
              </div>
              {quote.scenarios[0] && (
                <div className="text-xs text-gray-500 mt-1">
                  TVA {formatPct(quote.scenarios[0].vatPctBasisPts)} ·{' '}
                  {quote.scenarios[0].discountBasisPts > 0 ? (
                    <span className="text-amber-700">
                      Rabais {(quote.scenarios[0].discountBasisPts / 100).toFixed(1)}%
                    </span>
                  ) : (
                    <span>marge {formatPct(quote.scenarios[0].marginBasisPts)}</span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Action row */}
        <div className="mt-5 pt-4 border-t border-gray-100 flex items-center gap-2 flex-wrap">
          <a
            href={`/api/quotes/${quote.id}/pdf`}
            download={`${quote.quoteNumber}.pdf`}
            className="btn-primary text-xs px-3 py-1.5"
          >
            ↓ PDF
          </a>
          <EmailButton quoteId={quote.id} hasEmail={!!quote.customerEmail} />
          <ShareLinkButton shareToken={quote.shareToken} disabled={quote.status === 'DRAFT'} />
          {/* Démo client — launches the customer-facing meeting mode at
              /present/[id]. Disabled on DRAFT (the route 404s pre-send so
              reps can't accidentally demo unfinished pricing). */}
          {quote.status === 'DRAFT' ? (
            <button
              type="button"
              disabled
              className="btn-secondary text-xs px-3 py-1.5 opacity-50 cursor-not-allowed"
              title="Disponible après l'envoi de l'offre"
            >
              ▸ Démo client
            </button>
          ) : (
            <Link
              href={`/present/${quote.id}`}
              className="btn-secondary text-xs px-3 py-1.5"
            >
              ▸ Démo client
            </Link>
          )}
          {quote.firstViewedAt && (
            <ViewedIndicator firstViewedAt={quote.firstViewedAt} viewCount={quote.viewCount} />
          )}
          <Link
            href={`/calculator${quote.scenarios[0]?.scenarioType === 'PAC' ? '/pac' : ''}?quoteId=${quote.id}`}
            className="btn-secondary text-xs px-3 py-1.5"
          >
            Modifier
          </Link>
          <div className="ml-auto">
            <QuoteStatusActions
              quoteId={quote.id}
              currentStatus={quote.status as 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'}
            />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs<TabValue> items={items} value={tab} onChange={setTab} className="mb-4" />

      {/* Tab content */}
      {tab === 'overview' && (
        <OverviewTab quote={quote} isAdmin={isAdmin} activityItems={activityItems} />
      )}
      {tab === 'scenarios' && <ScenariosTab quote={quote} />}
      {tab === 'documents' && <DocumentsTab quote={quote} />}
      {tab === 'activity' && (
        <Card>
          <ActivityTimeline items={activityItems} />
        </Card>
      )}
    </div>
  )
}

function OverviewTab({
  quote,
  isAdmin,
  activityItems,
}: {
  quote: QuoteDetailVM
  isAdmin: boolean
  activityItems: ActivityItem[]
}) {
  const firstScenario = quote.scenarios[0]
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Left: customer + scenario summary */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Client
          </h3>
          {quote.customerName ? (
            <p className="font-semibold text-gray-900 text-lg">{quote.customerName}</p>
          ) : (
            <p className="text-gray-400 italic">Sans nom</p>
          )}
          <div className="mt-2 space-y-1 text-sm">
            {quote.customerEmail && (
              <div className="text-gray-700">
                <span className="text-gray-400 inline-block w-16">E-mail</span>
                <a
                  href={`mailto:${quote.customerEmail}`}
                  className="text-red-600 hover:underline"
                >
                  {quote.customerEmail}
                </a>
              </div>
            )}
            {quote.customerPhone && (
              <div className="text-gray-700">
                <span className="text-gray-400 inline-block w-16">Tél.</span>
                {quote.customerPhone}
              </div>
            )}
            {quote.siteAddress && (
              <div className="text-gray-700">
                <span className="text-gray-400 inline-block w-16">Site</span>
                {quote.siteAddress}
              </div>
            )}
            {(quote.customerZip || quote.customerCanton) && (
              <div className="text-gray-700">
                <span className="text-gray-400 inline-block w-16">NPA</span>
                {[quote.customerZip, quote.customerCanton].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>
        </Card>

        {firstScenario && (
          <Card>
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {quote.scenarios.length === 1
                ? 'Scénario'
                : `${quote.scenarios.length} scénarios — premier`}
            </h3>
            <div className="flex items-baseline gap-3 mb-3">
              <span className="font-semibold text-gray-900 text-base">{firstScenario.name}</span>
              <span className="text-xs text-gray-500">
                {firstScenario.scenarioType === 'PAC' ? 'Pompe à chaleur' : 'Photovoltaïque'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-sm">
              {firstScenario.installedKwp != null && (
                <Stat label="Puissance" value={`${firstScenario.installedKwp.toFixed(2)} kWp`} />
              )}
              {firstScenario.annualKwhYield != null && (
                <Stat
                  label="Production"
                  value={`${Math.round(firstScenario.annualKwhYield).toLocaleString('fr-CH')} kWh`}
                />
              )}
              {firstScenario.paybackYears != null && (
                <Stat
                  label="Amortissement"
                  value={`${firstScenario.paybackYears.toFixed(1)} ans`}
                />
              )}
              {firstScenario.annualSavingsRappen != null && (
                <Stat label="Valeur annuelle" value={formatChf(firstScenario.annualSavingsRappen)} />
              )}
              {firstScenario.rateRappenPerKwh != null && (
                <Stat
                  label="Tarif ElCom"
                  value={`${firstScenario.rateRappenPerKwh.toFixed(2)} ct/kWh`}
                />
              )}
              {firstScenario.discountBasisPts > 0 && (
                <Stat
                  label="Rabais"
                  value={`${(firstScenario.discountBasisPts / 100).toFixed(1)}%`}
                />
              )}
            </div>
            {firstScenario.discountReason && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">
                  Raison du rabais
                </span>
                <p className="text-sm text-gray-700 mt-1">{firstScenario.discountReason}</p>
              </div>
            )}
          </Card>
        )}

        {quote.notes && (
          <Card>
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Notes
            </h3>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{quote.notes}</p>
          </Card>
        )}
      </div>

      {/* Right: rep info + activity preview */}
      <div className="space-y-4">
        {isAdmin && (quote.repName || quote.repEmail) && (
          <Card>
            <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
              Conseiller
            </h3>
            <p className="text-sm font-medium text-gray-900">
              {quote.repName ?? quote.repEmail ?? '—'}
            </p>
          </Card>
        )}
        <Card>
          <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Dernière activité
          </h3>
          <ActivityTimeline items={activityItems.slice(0, 3)} compact />
        </Card>
      </div>
    </div>
  )
}

function ScenariosTab({ quote }: { quote: QuoteDetailVM }) {
  if (quote.scenarios.length === 0) {
    return (
      <Card>
        <EmptyState
          title="Aucun scénario enregistré"
          description="Ouvrez le calculateur pour configurer ce devis."
          action={
            <Link
              href={`/calculator?quoteId=${quote.id}`}
              className="btn-primary text-xs px-3 py-1.5"
            >
              Saisir un scénario
            </Link>
          }
        />
      </Card>
    )
  }
  return (
    <div className="space-y-3">
      {quote.scenarios.map((s, idx) => (
        <Card key={s.id}>
          <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
            <div className="flex items-center gap-2">
              {quote.scenarios.length > 1 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded">
                  Option {idx + 1}
                </span>
              )}
              <span className="font-semibold text-gray-900">{s.name}</span>
              <span className="text-xs text-gray-500">
                {s.scenarioType === 'PAC' ? 'PAC' : 'PV'}
              </span>
            </div>
            {s.sellingPriceIncVatRappen != null && (
              <div className="text-right">
                <div className="font-mono font-semibold text-gray-900 tabular-nums">
                  {formatChf(s.sellingPriceIncVatRappen)}
                </div>
                <div className="text-[10px] text-gray-500 uppercase tracking-wider">TTC</div>
              </div>
            )}
          </div>

          {(s.roofType || s.roofSlope) && (
            <div className="text-xs text-gray-500 mb-3">
              Toiture : {ROOF_TYPE_LABEL[s.roofType ?? ''] ?? s.roofType ?? '—'}
              {' · '}
              {ROOF_SLOPE_LABEL[s.roofSlope ?? ''] ?? s.roofSlope ?? '—'}
            </div>
          )}

          {/* Items */}
          <div className="space-y-1 mb-3">
            {s.items.map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-red-600 font-mono font-semibold tabular-nums w-8 text-right">
                  {item.quantity}×
                </span>
                <span className="text-gray-800 flex-1">{item.name}</span>
                <span className="text-xs text-gray-400">
                  {CATEGORY_LABEL[item.category] ?? item.category}
                </span>
              </div>
            ))}
            {s.options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="text-red-600 font-mono font-semibold tabular-nums w-8 text-right">
                  1×
                </span>
                <span className="text-gray-800 flex-1">{opt.name}</span>
                <span className="text-xs text-gray-400">Service</span>
              </div>
            ))}
          </div>

          {/* ROI summary */}
          {(s.annualSavingsRappen != null || s.paybackYears != null) && (
            <div className="border-t border-gray-100 pt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {s.installedKwp != null && (
                <Stat label="Puissance" value={`${s.installedKwp.toFixed(2)} kWp`} />
              )}
              {s.annualKwhYield != null && (
                <Stat
                  label="Production"
                  value={`${Math.round(s.annualKwhYield).toLocaleString('fr-CH')} kWh`}
                />
              )}
              {s.annualSavingsRappen != null && (
                <Stat label="Valeur annuelle" value={formatChf(s.annualSavingsRappen)} />
              )}
              {s.paybackYears != null && (
                <Stat label="Amortissement" value={`${s.paybackYears.toFixed(1)} ans`} />
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}

function DocumentsTab({ quote }: { quote: QuoteDetailVM }) {
  return (
    <Card>
      <h3 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-4">
        Documents disponibles
      </h3>
      <div className="space-y-2">
        <DocRow
          icon="📄"
          title={`${quote.quoteNumber}.pdf`}
          description="Offre commerciale complète"
          href={`/api/quotes/${quote.id}/pdf`}
          download={`${quote.quoteNumber}.pdf`}
        />
      </div>
    </Card>
  )
}

function DocRow({
  icon,
  title,
  description,
  href,
  download,
}: {
  icon: string
  title: string
  description: string
  href: string
  download: string
}) {
  return (
    <a
      href={href}
      download={download}
      className="flex items-center gap-3 p-3 rounded border border-gray-200 hover:border-red-300 hover:bg-red-50 transition-colors"
    >
      <span className="text-xl">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 text-sm truncate">{title}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <span className="text-xs text-red-600 font-semibold">Télécharger</span>
    </a>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
        {label}
      </div>
      <div className="text-sm font-semibold text-gray-900 font-mono tabular-nums mt-0.5">
        {value}
      </div>
    </div>
  )
}

// ─── Activity feed builder ────────────────────────────────────────────────────

function buildActivityFeed(quote: QuoteDetailVM): ActivityItem[] {
  const items: ActivityItem[] = []

  items.push({
    kind: 'created',
    title: (
      <>
        <span className="font-medium">Offre créée</span>
        {quote.repName && (
          <span className="text-gray-500"> par {quote.repName}</span>
        )}
      </>
    ),
    timestamp: quote.createdAt,
  })

  if (
    quote.updatedAt &&
    new Date(quote.updatedAt).getTime() - new Date(quote.createdAt).getTime() > 60_000
  ) {
    items.push({
      kind: 'edited',
      title: <span className="font-medium">Modifiée</span>,
      timestamp: quote.updatedAt,
    })
  }

  if (quote.sentAt) {
    items.push({
      kind: 'sent',
      title: <span className="font-medium">Envoyée au client</span>,
      description: quote.customerEmail ?? undefined,
      timestamp: quote.sentAt,
    })
  }

  if (quote.expiresAt) {
    const expiryDate = new Date(quote.expiresAt)
    const isPast = expiryDate.getTime() < Date.now()
    items.push({
      kind: isPast ? 'expired' : 'reminder',
      title: (
        <span className="font-medium">
          {isPast ? 'Offre expirée' : 'Expire prochainement'}
        </span>
      ),
      description: isPast
        ? '30 jours après envoi'
        : `Encore ${Math.max(0, Math.ceil((expiryDate.getTime() - Date.now()) / 86400000))} jours`,
      timestamp: quote.expiresAt,
    })
  }

  if (quote.status === 'ACCEPTED') {
    items.push({
      kind: 'accepted',
      title: <span className="font-medium text-green-700">Offre acceptée</span>,
      timestamp: quote.updatedAt,
    })
  }
  if (quote.status === 'DECLINED') {
    items.push({
      kind: 'declined',
      title: <span className="font-medium text-red-700">Offre refusée</span>,
      timestamp: quote.updatedAt,
    })
  }

  // Most recent first
  return items.sort(
    (a, b) =>
      new Date(b.timestamp as string).getTime() - new Date(a.timestamp as string).getTime()
  )
}

// ─── ShareLinkButton ──────────────────────────────────────────────────────────

function ShareLinkButton({
  shareToken,
  disabled,
}: {
  shareToken: string | null
  disabled?: boolean
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!shareToken) return
    try {
      const url = `${window.location.origin}/q/${shareToken}`
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    } catch {
      // Fallback: select+show URL in a prompt for manual copy
      window.prompt('Copiez ce lien :', `${window.location.origin}/q/${shareToken}`)
    }
  }

  // Disabled: no shareToken yet (DRAFT) OR explicitly disabled by caller
  if (disabled || !shareToken) {
    return (
      <button
        disabled
        title="Disponible une fois l'offre envoyée"
        className="btn-secondary text-xs px-3 py-1.5 opacity-50 cursor-not-allowed"
      >
        🔗 Lien client
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`btn-secondary text-xs px-3 py-1.5 ${
        copied ? 'text-green-700 border-green-300 bg-green-50' : ''
      }`}
    >
      {copied ? '✓ Lien copié' : '🔗 Lien client'}
    </button>
  )
}

// ─── ViewedIndicator ──────────────────────────────────────────────────────────

/**
 * Small chip showing that the customer has opened the public quote URL,
 * with a relative timestamp ("vu il y a 3h"). Hidden when the customer has
 * never opened the link.
 */
function ViewedIndicator({
  firstViewedAt,
  viewCount,
}: {
  firstViewedAt: string
  viewCount: number
}) {
  const ago = relativeTime(firstViewedAt)
  const tooltip =
    viewCount > 1
      ? `Première ouverture : ${new Date(firstViewedAt).toLocaleString('fr-CH')} (${viewCount} ouvertures)`
      : `Ouvert le ${new Date(firstViewedAt).toLocaleString('fr-CH')}`

  return (
    <span
      title={tooltip}
      className="inline-flex items-center gap-1 text-[11px] text-emerald-700 bg-emerald-50 ring-1 ring-emerald-200 rounded px-1.5 py-0.5 font-medium"
    >
      👁 Vu {ago}
      {viewCount > 1 && (
        <span className="text-emerald-600 tabular-nums">· {viewCount}×</span>
      )}
    </span>
  )
}

/**
 * Compact relative time formatter ("il y a 3h", "hier", "il y a 4j").
 * For older-than-7-days dates falls back to a short date.
 */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - then)
  const min = Math.floor(diffMs / 60_000)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `il y a ${h} h`
  const d = Math.floor(h / 24)
  if (d === 1) return 'hier'
  if (d < 7) return `il y a ${d} j`
  return new Date(iso).toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' })
}
