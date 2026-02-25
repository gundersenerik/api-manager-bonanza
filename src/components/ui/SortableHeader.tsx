'use client'

import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react'

export type SortDirection = 'asc' | 'desc' | null

interface SortableHeaderProps {
  label: string
  sortKey: string
  currentSort: string | null
  currentDirection: SortDirection
  onSort: (key: string) => void
}

export function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDirection,
  onSort,
}: SortableHeaderProps) {
  const isActive = currentSort === sortKey

  return (
    <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
      <button
        onClick={() => onSort(sortKey)}
        className={`
          inline-flex items-center gap-1 hover:text-ink-200 transition-colors
          ${isActive ? 'text-ink-200' : ''}
        `}
      >
        {label}
        {isActive && currentDirection === 'asc' ? (
          <ArrowUp className="w-3 h-3" />
        ) : isActive && currentDirection === 'desc' ? (
          <ArrowDown className="w-3 h-3" />
        ) : (
          <ArrowUpDown className="w-3 h-3 opacity-40" />
        )}
      </button>
    </th>
  )
}
