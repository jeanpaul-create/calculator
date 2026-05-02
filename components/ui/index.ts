/**
 * UI primitives barrel — `import { Button, Card, ... } from '@/components/ui'`
 *
 * R1 set (foundation):
 *  - Button       — typed btn-* wrapper with loading + size variants
 *  - Card         — surface (default | outlined | accent) + padding presets
 *  - StatusPill   — quote lifecycle badge (DRAFT/SENT/ACCEPTED/DECLINED/EXPIRED)
 *  - KpiCard      — universal stat tile from the PDF Variant D
 *  - PageHeader   — title + breadcrumb + actions + 2px red rule
 *  - EmptyState   — orientation surface for "no data yet"
 *  - FormField    — label + control + hint/error wrapper
 */
export { Button } from './Button'
export type { ButtonProps } from './Button'

export { Card } from './Card'
export type { CardProps } from './Card'

export { StatusPill } from './StatusPill'
export type { StatusPillProps, QuoteStatusValue } from './StatusPill'

export { KpiCard } from './KpiCard'
export type { KpiCardProps } from './KpiCard'

export { PageHeader } from './PageHeader'
export type { PageHeaderProps } from './PageHeader'

export { EmptyState } from './EmptyState'
export type { EmptyStateProps } from './EmptyState'

export { FormField } from './FormField'
export type { FormFieldProps } from './FormField'

export { Tabs } from './Tabs'
export type { TabsProps, TabItem } from './Tabs'

export { ActivityTimeline } from './ActivityTimeline'
export type { ActivityTimelineProps, ActivityItem, ActivityKind } from './ActivityTimeline'
