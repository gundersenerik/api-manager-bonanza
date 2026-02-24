'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import { Home } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-ink-950 flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
        >
          <motion.h1
            className="text-8xl font-heading font-bold text-gradient-primary mb-4 select-none"
            animate={{
              textShadow: [
                '0 0 20px rgba(108, 58, 237, 0.3)',
                '0 0 40px rgba(108, 58, 237, 0.5)',
                '0 0 20px rgba(108, 58, 237, 0.3)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          >
            404
          </motion.h1>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <h2 className="text-xl font-heading font-semibold text-ink-200 mb-2">
            Page not found
          </h2>
          <p className="text-ink-400 mb-8">
            The page you are looking for does not exist or has been moved.
          </p>
          <Link href="/">
            <Button icon={Home}>Go to homepage</Button>
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
