/**
 * Tiny class-name joiner. Drops falsy values, joins with spaces.
 * Standalone — no clsx / tailwind-merge dependency.
 *
 * Usage:
 *   <div className={cn('px-4', isActive && 'bg-red-50', className)} />
 */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}
