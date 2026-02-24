'use client'

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'

interface ErrorProps {
  error: Error & { digest?: string }
  reset: () => void
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[App] Global error:', error)
  }, [error])

  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="mx-auto w-20 h-20 bg-punch/10 rounded-full flex items-center justify-center mb-6 ring-1 ring-punch/20"
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            <AlertTriangle className="w-10 h-10 text-punch" />
          </motion.div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-2xl font-heading font-bold text-ink-50 mb-2">
            Something went wrong
          </h1>
          <p className="text-ink-400 mb-6">
            An unexpected error occurred. Please try again or return to the homepage.
          </p>
          {error.digest && (
            <p className="text-xs text-ink-600 font-mono mb-6">
              Error ID: {error.digest}
            </p>
          )}
          <div className="flex items-center justify-center gap-4">
            <Button onClick={reset} icon={RefreshCw}>
              Try again
            </Button>
            <Link href="/">
              <Button variant="ghost" icon={Home}>
                Go home
              </Button>
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
