/**
 * FormField — label + control + hint/error in one consistent block.
 *
 *   <FormField label="Email" hint="Optional" error={errors.email}>
 *     <input className="input" type="email" />
 *   </FormField>
 *
 * Wraps any control. Renders error if provided (replaces hint), with the
 * input bordered red via the .input-error class — caller is responsible for
 * applying that to the inner input. (Kept simple — no input introspection.)
 */
import { cn } from '@/lib/cn'

export interface FormFieldProps {
  label?: React.ReactNode
  /** Optional helper text shown below the input */
  hint?: React.ReactNode
  /** When set, replaces hint and styles the wrapper for error state */
  error?: React.ReactNode
  /** Mark the field required (adds a red asterisk to the label) */
  required?: boolean
  /** When true, removes the bottom margin (useful in tight grids) */
  inline?: boolean
  className?: string
  children: React.ReactNode
}

export function FormField({
  label,
  hint,
  error,
  required = false,
  inline = false,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn(!inline && 'mb-4', className)}>
      {label ? (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
          {required ? <span className="text-red-500 ml-0.5">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? (
        <p className="text-xs text-red-600 mt-1">{error}</p>
      ) : hint ? (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      ) : null}
    </div>
  )
}
