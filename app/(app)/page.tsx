/**
 * Dashboard — sales rep landing page.
 *
 * Replaces the old "redirect to /calculator" stub. Shows:
 *   - 4 KPI tiles (this month / pipeline / expiring / won YTD)
 *   - Follow-ups due (quotes sent > 7 days ago, still SENT)
 *   - Recent activity (last 8 quote events)
 *   - Quick actions (PV / PAC / quotes)
 *
 * Visible to both REP and ADMIN roles. Admin sees team-wide aggregates;
 * reps see their own only (same role gate as /quotes).
 */
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import {
  PageHeader,
  KpiCard,
  Card,
  StatusPill,
  ActivityTimeline,
  EmptyState,
  type ActivityItem,
  type QuoteStatusValue,
} from '@/components/ui'
import { formatChf } from '@/lib/pricing'

export const metadata = { title: 'Tableau de bord' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const session = await auth()
  if (!session) redirect('/login')

  const isAdmin = session.user.role === 'ADMIN'
  const userName = session.user.name ?? session.user.email ?? 'Utilisateur'
  const firstName = userName.split(/[\s@]/)[0]

  const quotes = await prisma.quote.findMany({
    where: isAdmin ? undefined : { repId: session.user.id },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      customerName: true,
      sentAt: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
      viewCount: true,
      firstViewedAt: true,
      rep: { select: { name: true } },
      scenarios: {
        select: { sellingPriceIncVatRappen: true },
        orderBy: { sortOrder: 'asc' },
        take: 1,
      },
    },
  })

  // ── KPIs ──
  const now = Date.now()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)
  const startOfYear = new Date()
  startOfYear.setMonth(0, 1)
  startOfYear.setHours(0, 0, 0, 0)
  const sevenDays = 7 * 24 * 60 * 60 * 1000

  let sentThisMonth = 0
  let pipelineRappen = 0
  let pipelineCount = 0
  let expiringSoonCount = 0
  let wonYtdRappen = 0
  let wonYtdCount = 0

  for (const q of quotes) {
    const total = q.scenarios[0]?.sellingPriceIncVatRappen ?? 0
    if (q.sentAt && q.sentAt.getTime() >= startOfMonth.getTime()) sentThisMonth++
    if (q.status === 'SENT') {
      pipelineCount++
      pipelineRappen += total
      if (q.expiresAt) {
        const ms = q.expiresAt.getTime() - now
        if (ms > 0 && ms <= sevenDays) expiringSoonCount++
      }
    }
    if (q.status === 'ACCEPTED' && q.createdAt.getTime() >= startOfYear.getTime()) {
      wonYtdCount++
      wonYtdRappen += total
    }
  }

  // ── Hot leads: SENT, customer came back (≥2 views), still no response ──
  // The first view triggers a rep email (notify-rep); a RETURN visit is the
  // strongest buy signal we track — surface it above the stale follow-ups.
  const hotLeads = quotes
    .filter((q) => q.status === 'SENT' && q.viewCount >= 2)
    .sort((a, b) => b.viewCount - a.viewCount)
    .slice(0, 5)
  const hotLeadIds = new Set(hotLeads.map((q) => q.id))

  // ── Follow-ups: SENT > 7 days ago, no acceptance ──
  const followUps = quotes
    .filter(
      (q) =>
        q.status === 'SENT' &&
        q.sentAt &&
        now - q.sentAt.getTime() > 7 * 24 * 60 * 60 * 1000 &&
        !hotLeadIds.has(q.id) // already shown above
    )
    .slice(0, 6)

  // ── Recent activity (last 8 events across quotes) ──
  const activityItems: ActivityItem[] = quotes
    .slice(0, 12)
    .flatMap((q) => {
      const items: ActivityItem[] = []
      const customerLabel =
        q.customerName?.trim() || `${q.quoteNumber}`
      items.push({
        kind: 'created',
        title: (
          <span>
            <span className="font-medium">{customerLabel}</span>{' '}
            <span className="text-gray-500">— créée</span>
          </span>
        ),
        timestamp: q.createdAt,
      })
      if (q.sentAt) {
        items.push({
          kind: 'sent',
          title: (
            <span>
              <span className="font-medium">{customerLabel}</span>{' '}
              <span className="text-gray-500">— envoyée</span>
            </span>
          ),
          timestamp: q.sentAt,
        })
      }
      if (q.status === 'ACCEPTED') {
        items.push({
          kind: 'accepted',
          title: (
            <span>
              <span className="font-medium">{customerLabel}</span>{' '}
              <span className="text-green-700">— acceptée</span>
            </span>
          ),
          timestamp: q.updatedAt,
        })
      }
      if (q.status === 'DECLINED') {
        items.push({
          kind: 'declined',
          title: (
            <span>
              <span className="font-medium">{customerLabel}</span>{' '}
              <span className="text-red-700">— refusée</span>
            </span>
          ),
          timestamp: q.updatedAt,
        })
      }
      return items
    })
    .sort(
      (a, b) =>
        new Date(b.timestamp as Date).getTime() -
        new Date(a.timestamp as Date).getTime()
    )
    .slice(0, 8)

  return (
    <div className="p-6 max-w-6xl">
      <PageHeader
        title={`Bonjour ${firstName}`}
        subtitle="Aperçu de vos offres et activité récente"
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Envoyées ce mois"
          value={sentThisMonth.toString()}
          context={sentThisMonth === 0 ? 'Aucune offre envoyée' : 'Depuis le 1er du mois'}
        />
        <KpiCard
          label="En pipeline"
          value={formatChf(pipelineRappen)}
          context={`${pipelineCount} offre${pipelineCount !== 1 ? 's' : ''} en attente`}
        />
        <KpiCard
          label="Expire ≤ 7 jours"
          value={expiringSoonCount.toString()}
          context={
            expiringSoonCount > 0 ? 'À relancer rapidement' : 'Aucune offre urgente'
          }
          emphasis={expiringSoonCount > 0 ? 'primary' : 'muted'}
        />
        <KpiCard
          label="Gagnées YTD"
          value={formatChf(wonYtdRappen)}
          context={`${wonYtdCount} offre${wonYtdCount !== 1 ? 's' : ''} acceptée${wonYtdCount !== 1 ? 's' : ''}`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left column: hot leads + follow-ups + quick actions */}
        <div className="lg:col-span-2 space-y-4">
          {hotLeads.length > 0 && (
            <Card>
              <div className="flex items-baseline justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-900">
                  🔥 Leads chauds
                </h2>
                <span className="text-xs text-gray-400">
                  Le client est revenu sur l&apos;offre — appelez maintenant
                </span>
              </div>
              <div className="-mx-2">
                {hotLeads.map((q) => {
                  const total = q.scenarios[0]?.sellingPriceIncVatRappen ?? null
                  return (
                    <Link
                      key={q.id}
                      href={`/quotes/${q.id}`}
                      className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <span className="font-mono text-xs text-red-600 font-semibold tabular-nums w-24 truncate">
                        {q.quoteNumber}
                      </span>
                      <span className="font-medium text-sm text-gray-900 flex-1 truncate">
                        {q.customerName?.trim() || (
                          <span className="text-gray-400 italic">Sans nom</span>
                        )}
                      </span>
                      {total != null && (
                        <span className="font-mono tabular-nums text-sm text-gray-700 hidden md:inline">
                          {formatChf(total)}
                        </span>
                      )}
                      <span className="text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 tabular-nums">
                        👁 {q.viewCount}×
                      </span>
                    </Link>
                  )
                })}
              </div>
            </Card>
          )}

          <Card>
            <div className="flex items-baseline justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">
                Relances à faire
              </h2>
              <Link
                href="/quotes"
                className="text-xs text-red-600 hover:text-red-700 font-medium"
              >
                Voir toutes les offres →
              </Link>
            </div>

            {followUps.length === 0 ? (
              <EmptyState
                compact
                title="Aucune relance en retard"
                description="Vos offres envoyées sont à jour. Bon travail !"
              />
            ) : (
              <div className="-mx-2">
                {followUps.map((q) => {
                  const total = q.scenarios[0]?.sellingPriceIncVatRappen ?? null
                  const daysSinceSent = q.sentAt
                    ? Math.floor((now - q.sentAt.getTime()) / 86400000)
                    : null
                  return (
                    <Link
                      key={q.id}
                      href={`/quotes/${q.id}`}
                      className="flex items-center gap-3 px-2 py-2 hover:bg-gray-50 rounded transition-colors"
                    >
                      <span className="font-mono text-xs text-red-600 font-semibold tabular-nums w-24 truncate">
                        {q.quoteNumber}
                      </span>
                      <span className="font-medium text-sm text-gray-900 flex-1 truncate">
                        {q.customerName?.trim() || (
                          <span className="text-gray-400 italic">Sans nom</span>
                        )}
                      </span>
                      <StatusPill status={q.status as QuoteStatusValue} />
                      {total != null && (
                        <span className="font-mono tabular-nums text-sm text-gray-700 hidden md:inline">
                          {formatChf(total)}
                        </span>
                      )}
                      {daysSinceSent != null && (
                        <span className="text-[10px] text-amber-700 font-medium tabular-nums w-20 text-right">
                          il y a {daysSinceSent}j
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </Card>

          {/* Quick actions */}
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Démarrer une nouvelle offre
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickActionTile
                href="/calculator"
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m9-9H3" />
                  </svg>
                }
                title="Photovoltaïque"
                description="Panneaux, onduleurs, batterie"
                accent="red"
              />
              <QuickActionTile
                href="/calculator/pac"
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                  </svg>
                }
                title="Pompe à chaleur"
                description="9 catégories de postes"
                accent="orange"
              />
            </div>
          </Card>
        </div>

        {/* Right column: activity */}
        <div>
          <Card>
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Activité récente
            </h2>
            {activityItems.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Aucune activité enregistrée.
              </p>
            ) : (
              <ActivityTimeline items={activityItems} compact />
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

function QuickActionTile({
  href,
  icon,
  title,
  description,
  accent,
}: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  accent: 'red' | 'orange'
}) {
  const accentClass =
    accent === 'red'
      ? 'border-red-200 bg-red-50 group-hover:border-red-400 text-red-600'
      : 'border-orange-200 bg-orange-50 group-hover:border-orange-400 text-orange-600'
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 rounded-lg border border-gray-200 hover:border-gray-300 hover:shadow-sm transition-all group"
    >
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border transition-colors ${accentClass}`}
      >
        <span className="w-5 h-5">{icon}</span>
      </div>
      <div className="min-w-0 flex-1">
        <div className="font-semibold text-sm text-gray-900">{title}</div>
        <div className="text-xs text-gray-500">{description}</div>
      </div>
      <span className="text-gray-300 group-hover:text-gray-500 transition-colors">→</span>
    </Link>
  )
}
