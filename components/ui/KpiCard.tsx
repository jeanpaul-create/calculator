/**
 * KpiCard — the universal stat tile, ported from the PDF Variant D.
 *
 * Layout:
 *   ┌──────────────────────┐  ← 2px red top stroke
 *   │ 28'450 CHF           │  ← value (mono, large, bold)
 *   │ Total TTC            │  ← label (uppercase, small, muted)
 *   │ ↑ 12% vs avg         │  ← optional context
 *   └──────────────────────┘
 *
 * Used everywhere a number-with-label appears: quote-list KPIs, price summary,
 * scenario stats, dashboard tiles. One look, one rhythm.
 */
import { cn } from '@/lib/cn'

export interface KpiCardProps {
  /** The headline value (already formatted — e.g. "CHF 28'450", "7.76 kWp") */
  value: React.ReactNode
  /** Short label (uppercase) — e.g. "Total TTC", "Production annuelle" */
  label: React.ReactNode
  /** Optional supporting note shown below the value */
  context?: React.ReactNode
  /** Visual emphasis level. "primary" uses a thicker red stroke. */
  emphasis?: 'primary' | 'default' | 'muted'
  /** Optional click handler — turns the card into an interactive surface */
  onClick?: () => void
  className?: string
}

// Red is reserved for the ONE most important element on the page (per DESIGN.md).
// KPI cards default to a quiet gray top stroke. `primary` is reserved for the
// hero stat (e.g. "Total TTC" on the price card) — caller opts in explicitly.
const STROKE_CLASS: Record<NonNullable<KpiCardProps['emphasis']>, string> = {
  primary: 'border-t-2 border-t-red-500',
  default: 'border-t border-t-gray-200',
  muted: 'border-t border-t-gray-200',
}

export function KpiCard({
  value,
  label,
  context,
  emphasis = 'default',
  onClick,
  className,
}: KpiCardProps) {
  const interactive = !!onClick
  const Component = interactive ? 'button' : 'div'

  return (
    <Component
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border border-gray-200',
        STROKE_CLASS[emphasis],
        'px-4 py-3 flex flex-col items-start text-left',
        interactive && 'hover:border-gray-300 hover:shadow-sm transition-all',
        className
      )}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">
        {label}
      </span>
      <span className="text-base sm:text-xl font-semibold text-gray-900 tabular-nums font-mono leading-tight w-full truncate">
        {value}
      </span>
      {context ? (
        <span className="text-xs text-gray-500 mt-1">{context}</span>
      ) : null}
    </Component>
  )
}
