/**
 * SectionHeader — narrow header for sections within a form or page.
 *
 *   <SectionHeader
 *     step={1}
 *     title="Client"
 *     description="Coordonnées et adresse du site"
 *   />
 *
 * Visual: optional step pill (red), tight uppercase label, optional one-line
 * description, optional right-side actions. Quieter than PageHeader — no rule.
 */
import { cn } from '@/lib/cn'

export interface SectionHeaderProps {
  /** Optional step number rendered as a small red pill (1, 2, 3...) */
  step?: number | string
  /** Optional icon shown before the title (e.g. small SVG) */
  icon?: React.ReactNode
  title: React.ReactNode
  description?: React.ReactNode
  /** Optional right-aligned actions */
  actions?: React.ReactNode
  /** Render as <h3> instead of the default <h2> */
  as?: 'h2' | 'h3'
  className?: string
}

export function SectionHeader({
  step,
  icon,
  title,
  description,
  actions,
  as = 'h2',
  className,
}: SectionHeaderProps) {
  const Heading = as
  return (
    <div className={cn('flex items-start justify-between gap-3 mb-4', className)}>
      <div className="flex items-start gap-3 min-w-0 flex-1">
        {step != null && (
          <span className="flex-shrink-0 w-6 h-6 rounded bg-red-50 text-red-600 text-xs font-semibold flex items-center justify-center mt-0.5 tabular-nums">
            {step}
          </span>
        )}
        {icon && (
          <span className="flex-shrink-0 w-5 h-5 text-gray-500 mt-0.5">{icon}</span>
        )}
        <div className="min-w-0 flex-1">
          <Heading className="text-sm font-semibold text-gray-900 leading-tight">
            {title}
          </Heading>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  )
}
