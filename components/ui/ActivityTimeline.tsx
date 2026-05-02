/**
 * ActivityTimeline — vertical timeline of events.
 *
 * Each event has a kind (created | sent | viewed | accepted | declined |
 * expired | edited | reminder), a timestamp, and an optional description.
 * The timeline renders a colored dot per event and a connecting rail.
 *
 * Used on the quote detail "Activité" tab and the dashboard's recent
 * activity feed.
 */
import { cn } from '@/lib/cn'

export type ActivityKind =
  | 'created'
  | 'sent'
  | 'viewed'
  | 'accepted'
  | 'declined'
  | 'expired'
  | 'edited'
  | 'reminder'

export interface ActivityItem {
  kind: ActivityKind
  /** Short headline (e.g. "Offre créée par Admin") */
  title: React.ReactNode
  /** Optional secondary line */
  description?: React.ReactNode
  /** ISO date string or Date — formatted for fr-CH */
  timestamp: Date | string
}

const KIND_DOT: Record<ActivityKind, string> = {
  created: 'bg-gray-300',
  sent: 'bg-blue-500',
  viewed: 'bg-blue-300',
  accepted: 'bg-green-500',
  declined: 'bg-red-500',
  expired: 'bg-amber-500',
  edited: 'bg-gray-400',
  reminder: 'bg-amber-400',
}

function formatTimestamp(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d
  const time = date.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  const day = date.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${day} · ${time}`
}

export interface ActivityTimelineProps {
  items: ActivityItem[]
  /** When true, renders each row with a denser layout (for tight surfaces) */
  compact?: boolean
  className?: string
}

export function ActivityTimeline({ items, compact = false, className }: ActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-gray-500 italic py-2">Aucune activité enregistrée.</p>
    )
  }
  return (
    <ol className={cn('relative space-y-0', className)}>
      {/* Connecting rail */}
      <div className="absolute left-1.5 top-1.5 bottom-1.5 w-px bg-gray-200" aria-hidden />

      {items.map((item, i) => (
        <li
          key={i}
          className={cn('relative pl-6', compact ? 'py-1.5' : 'py-2.5')}
        >
          <span
            className={cn(
              'absolute left-0 top-2 w-3 h-3 rounded-full ring-2 ring-white',
              KIND_DOT[item.kind]
            )}
            aria-hidden
          />
          <div className={cn('text-gray-900', compact ? 'text-xs' : 'text-sm')}>
            {item.title}
          </div>
          {item.description ? (
            <div className={cn('text-gray-500 mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>
              {item.description}
            </div>
          ) : null}
          <div className={cn('text-gray-400 tabular-nums mt-0.5', compact ? 'text-[10px]' : 'text-xs')}>
            {formatTimestamp(item.timestamp)}
          </div>
        </li>
      ))}
    </ol>
  )
}
