'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Download, FileText, FileJson, Check } from 'lucide-react'

interface ExportButtonProps {
  onExportCsv: () => void
  onExportJson: () => void
  label?: string
  className?: string
}

export function ExportButton({
  onExportCsv,
  onExportJson,
  label = 'Export',
  className = '',
}: ExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [exported, setExported] = useState<'csv' | 'json' | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleExport = (format: 'csv' | 'json') => {
    if (format === 'csv') onExportCsv()
    else onExportJson()

    setExported(format)
    setTimeout(() => {
      setExported(null)
      setIsOpen(false)
    }, 1200)
  }

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="
          inline-flex items-center gap-2 px-3 py-2 text-sm font-medium
          text-ink-300 hover:text-ink-100 bg-ink-700/50 hover:bg-ink-700
          border border-ink-600/50 rounded-xl transition-all duration-200
        "
      >
        <Download className="w-4 h-4" />
        {label}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="
              absolute right-0 mt-2 w-44 z-50
              bg-ink-800 border border-ink-600/50 rounded-xl shadow-xl
              overflow-hidden
            "
          >
            <button
              onClick={() => handleExport('csv')}
              className="
                w-full flex items-center gap-3 px-4 py-2.5 text-sm
                text-ink-200 hover:text-ink-50 hover:bg-ink-700/50 transition-colors
              "
            >
              {exported === 'csv' ? (
                <Check className="w-4 h-4 text-mint" />
              ) : (
                <FileText className="w-4 h-4 text-ink-400" />
              )}
              Export as CSV
            </button>
            <button
              onClick={() => handleExport('json')}
              className="
                w-full flex items-center gap-3 px-4 py-2.5 text-sm
                text-ink-200 hover:text-ink-50 hover:bg-ink-700/50 transition-colors
              "
            >
              {exported === 'json' ? (
                <Check className="w-4 h-4 text-mint" />
              ) : (
                <FileJson className="w-4 h-4 text-ink-400" />
              )}
              Export as JSON
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
