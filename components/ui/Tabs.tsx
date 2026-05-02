/**
 * Tabs — controlled tab strip with red underline on active.
 *
 *   const [tab, setTab] = useState('overview')
 *   <Tabs
 *     value={tab}
 *     onChange={setTab}
 *     items={[
 *       { value: 'overview', label: 'Aperçu' },
 *       { value: 'scenarios', label: 'Scénarios', count: 3 },
 *       { value: 'activity', label: 'Activité' },
 *     ]}
 *   />
 *
 * Render the corresponding panel below — no built-in panel slots, callers
 * keep full control. Works for 2-7 tabs; collapses to scroll on mobile.
 */
'use client'

import { cn } from '@/lib/cn'

export interface TabItem<T extends string = string> {
  value: T
  label: React.ReactNode
  /** Optional count badge (e.g. "Scénarios 3") */
  count?: number | null
  /** Optional disabled flag */
  disabled?: boolean
}

export interface TabsProps<T extends string = string> {
  items: TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function Tabs<T extends string = string>({
  items,
  value,
  onChange,
  className,
}: TabsProps<T>) {
  return (
    <div className={cn('border-b border-gray-200 overflow-x-auto', className)}>
      <div className="flex items-center gap-1 min-w-max">
        {items.map((item) => {
          const active = value === item.value
          return (
            <button
              key={item.value}
              type="button"
              disabled={item.disabled}
              onClick={() => onChange(item.value)}
              className={cn(
                'px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-2',
                active
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300',
                item.disabled && 'opacity-40 cursor-not-allowed'
              )}
            >
              {item.label}
              {item.count != null && (
                <span
                  className={cn(
                    'text-xs rounded-full px-1.5 py-0.5 tabular-nums',
                    active ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
