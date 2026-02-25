'use client'

import { motion } from 'framer-motion'

interface FilterOption<T extends string> {
  value: T
  label: string
  count?: number
}

interface FilterPillsProps<T extends string> {
  options: FilterOption<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: FilterPillsProps<T>) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      {options.map((option) => {
        const isActive = value === option.value
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className={`
              relative px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200
              ${isActive
                ? 'text-ink-50'
                : 'text-ink-400 hover:text-ink-200 hover:bg-ink-700/30'
              }
            `}
          >
            {isActive && (
              <motion.div
                layoutId="filter-pill-bg"
                className="absolute inset-0 bg-ink-600/50 rounded-lg ring-1 ring-ink-500/30"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5">
              {option.label}
              {option.count !== undefined && (
                <span className={`text-xs ${isActive ? 'text-ink-300' : 'text-ink-500'}`}>
                  {option.count}
                </span>
              )}
            </span>
          </button>
        )
      })}
    </div>
  )
}
