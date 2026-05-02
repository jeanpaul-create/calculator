/**
 * EmptyState — orientation surface for "no data yet".
 *
 *   <EmptyState
 *     icon={<DocumentIcon />}
 *     title="Aucune offre pour le moment"
 *     description="Créez votre première offre depuis le calculateur."
 *     action={<Button>+ Nouvelle offre</Button>}
 *   />
 *
 * Replaces ad-hoc "Sélectionner des produits…" text-only placeholders.
 */
import { cn } from '@/lib/cn'

export interface EmptyStateProps {
  /** Optional decorative icon (typically a 5x5 SVG; rendered at 32x32) */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  /** When true, renders as a smaller inline empty state (for use inside cards) */
  compact?: boolean
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        compact ? 'py-8 px-4' : 'py-16 px-6',
        className
      )}
    >
      {icon ? (
        <div
          className={cn(
            'flex items-center justify-center rounded-full bg-gray-100 text-gray-400 mb-4',
            compact ? 'w-10 h-10' : 'w-12 h-12'
          )}
        >
          <span className={compact ? 'w-5 h-5' : 'w-6 h-6'}>{icon}</span>
        </div>
      ) : null}
      <h3
        className={cn(
          'font-semibold text-gray-900',
          compact ? 'text-sm' : 'text-base'
        )}
      >
        {title}
      </h3>
      {description ? (
        <p
          className={cn(
            'text-gray-500 mt-1 max-w-sm',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}
