'use client'

import { motion } from 'framer-motion'
import { type LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description: string
  action?: React.ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex items-center justify-center w-16 h-16 rounded-2xl bg-ink-700/50 ring-1 ring-ink-600/30 mb-4"
      >
        <Icon className="w-8 h-8 text-ink-400" />
      </motion.div>
      <h3 className="text-lg font-heading font-semibold text-ink-200 mb-1">{title}</h3>
      <p className="text-sm text-ink-400 text-center max-w-sm mb-6">{description}</p>
      {action}
    </div>
  )
}
