/**
 * Card — surface primitive. Three variants:
 *
 *  - default   white bg, gray-200 border, shadow-sm  (the existing .card)
 *  - outlined  white bg, gray-200 border, no shadow  (flatter, for nested cards)
 *  - accent    default + 2px red top stroke         (used for hero / KPI surfaces)
 *
 * Three padding sizes:
 *
 *  - tight   p-3
 *  - default p-5  (matches the existing .card-padded)
 *  - none    no padding (caller controls — useful for cards that wrap tables)
 */
import { HTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'default' | 'outlined' | 'accent'
type Padding = 'tight' | 'default' | 'none'

const VARIANT_CLASS: Record<Variant, string> = {
  default: 'bg-white rounded-lg border border-gray-200 shadow-sm',
  outlined: 'bg-white rounded-lg border border-gray-200',
  accent: 'bg-white rounded-lg border border-gray-200 shadow-sm border-t-2 border-t-red-500',
}

const PADDING_CLASS: Record<Padding, string> = {
  tight: 'p-3',
  default: 'p-5',
  none: '',
}

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant
  padding?: Padding
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { variant = 'default', padding = 'default', className, children, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={cn(VARIANT_CLASS[variant], PADDING_CLASS[padding], className)}
      {...rest}
    >
      {children}
    </div>
  )
})
