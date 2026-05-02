/**
 * StatusPill — quote lifecycle status badge.
 *
 * Maps QuoteStatus to a badge class per DESIGN.md:
 *   DRAFT     → gray
 *   SENT      → blue
 *   ACCEPTED  → green
 *   DECLINED  → red
 *   EXPIRED   → amber
 *
 * Replaces the older QuoteStatusBadge component (which is still used in places —
 * we'll migrate call sites in R2).
 */
import { cn } from '@/lib/cn'

export type QuoteStatusValue = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED'

const STATUS_CLASS: Record<QuoteStatusValue, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-50 text-blue-700',
  ACCEPTED: 'bg-green-50 text-green-700',
  DECLINED: 'bg-red-50 text-red-600',
  EXPIRED: 'bg-amber-50 text-amber-700',
}

const STATUS_LABEL_FR: Record<QuoteStatusValue, string> = {
  DRAFT: 'Brouillon',
  SENT: 'Envoyé',
  ACCEPTED: 'Accepté',
  DECLINED: 'Refusé',
  EXPIRED: 'Expiré',
}

const STATUS_LABEL_DE: Record<QuoteStatusValue, string> = {
  DRAFT: 'Entwurf',
  SENT: 'Gesendet',
  ACCEPTED: 'Akzeptiert',
  DECLINED: 'Abgelehnt',
  EXPIRED: 'Abgelaufen',
}

export interface StatusPillProps {
  status: QuoteStatusValue
  /** Override the auto-generated French/German label */
  label?: string
  lang?: 'fr' | 'de'
  size?: 'sm' | 'md'
  className?: string
}

export function StatusPill({
  status,
  label,
  lang = 'fr',
  size = 'sm',
  className,
}: StatusPillProps) {
  const text =
    label ?? (lang === 'de' ? STATUS_LABEL_DE[status] : STATUS_LABEL_FR[status])
  const sizeClass = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-xs'
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded',
        sizeClass,
        STATUS_CLASS[status],
        className
      )}
    >
      {text}
    </span>
  )
}
