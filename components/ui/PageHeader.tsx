/**
 * PageHeader — consistent top of every page.
 *
 *   <PageHeader
 *     title="Offres"
 *     subtitle="Toutes vos offres et leur statut"
 *     actions={<Button>+ Nouvelle offre</Button>}
 *   />
 *
 * Renders title (text-2xl semibold tight), optional subtitle, optional
 * breadcrumb above, optional actions on the right, then a 2px red rule below
 * — matching the PDF Variant D's hero divider.
 */
import { cn } from '@/lib/cn'

export interface PageHeaderProps {
  title: React.ReactNode
  subtitle?: React.ReactNode
  /** Optional breadcrumb shown above the title */
  breadcrumb?: React.ReactNode
  /** Right-side action slot (typically a primary button or button group) */
  actions?: React.ReactNode
  /** When true, omits the 2px red rule below (use for nested headers) */
  noRule?: boolean
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  noRule = false,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumb ? (
        <div className="text-xs text-gray-500 mb-2">{breadcrumb}</div>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold text-gray-900 tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>
        ) : null}
      </div>
      {/*
        Red rule: 1px hairline at full content width, not the previous
        12px×2px stub which read as residue. Subtle, professional, always
        delimits the header from content below.
      */}
      {!noRule ? <div className="mt-4 h-px bg-gray-200" /> : null}
    </div>
  )
}
