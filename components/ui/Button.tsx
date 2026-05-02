/**
 * Button — typed wrapper around the .btn-* utility classes in globals.css.
 *
 * Composes existing tokens (.btn-primary, .btn-secondary, .btn-ghost, .btn-danger)
 * with size variants and a built-in loading state. Use this for new code; old
 * call sites that still write `<button className="btn-primary">` keep working.
 */
import { ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
}

const SIZE_CLASS: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5',
  md: '', // .btn already has px-4 py-2 text-sm
  lg: 'text-base px-5 py-2.5',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  /** Icon shown before the children */
  leadingIcon?: React.ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled,
    leadingIcon,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      type={rest.type ?? 'button'}
      disabled={disabled || loading}
      className={cn(VARIANT_CLASS[variant], SIZE_CLASS[size], className)}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"
        />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  )
})
