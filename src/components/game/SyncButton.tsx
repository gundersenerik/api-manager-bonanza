'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface SyncButtonProps {
  state: SyncState
  onClick: () => void
  disabled?: boolean
}

export function SyncButton({ state, onClick, disabled }: SyncButtonProps) {
  const isIdle = state === 'idle'
  const isSyncing = state === 'syncing'
  const isSuccess = state === 'success'
  const isError = state === 'error'

  return (
    <div className="relative">
      {/* Glow behind button */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute inset-0 bg-ocean/20 rounded-xl blur-xl"
            style={{ transform: 'scale(1.3)' }}
          />
        )}
        {isSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0, 0.6, 0] }}
            transition={{ duration: 1.5 }}
            className="absolute inset-0 bg-mint/20 rounded-xl blur-xl"
            style={{ transform: 'scale(1.5)' }}
          />
        )}
      </AnimatePresence>

      <motion.button
        onClick={onClick}
        disabled={disabled || isSyncing}
        className={`relative inline-flex items-center gap-2.5 px-6 py-3 rounded-xl font-medium text-white transition-all duration-300 disabled:cursor-not-allowed overflow-hidden ${
          isIdle
            ? 'bg-gradient-sync hover:shadow-lg hover:shadow-ocean/20'
            : isSyncing
            ? 'bg-gradient-sync'
            : isSuccess
            ? 'bg-gradient-to-r from-mint to-cyan-400'
            : 'bg-gradient-to-r from-punch to-red-600'
        }`}
        animate={
          isError
            ? { x: [0, -6, 6, -4, 4, 0] }
            : isSyncing
            ? { scale: [1, 0.97, 1] }
            : {}
        }
        transition={
          isError
            ? { duration: 0.4, ease: 'easeInOut' }
            : isSyncing
            ? { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
            : {}
        }
        whileHover={isIdle ? { scale: 1.03 } : {}}
        whileTap={isIdle ? { scale: 0.97 } : {}}
      >
        {/* Progress ring overlay when syncing */}
        {isSyncing && (
          <motion.div
            className="absolute inset-0 rounded-xl"
            style={{
              background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.1) 50%, transparent 100%)',
              backgroundSize: '200% 100%',
            }}
            animate={{ backgroundPosition: ['200% 0', '-200% 0'] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}

        <AnimatePresence mode="wait" initial={false}>
          {isIdle && (
            <motion.div
              key="idle"
              initial={{ scale: 0, rotate: -90 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0, rotate: 90 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
              className="relative"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-5 h-5" />
              </motion.div>
            </motion.div>
          )}
          {isSyncing && (
            <motion.div
              key="syncing"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
              >
                <RefreshCw className="w-5 h-5" />
              </motion.div>
            </motion.div>
          )}
          {isSuccess && (
            <motion.div
              key="success"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 12 }}
            >
              <CheckCircle className="w-5 h-5" />
            </motion.div>
          )}
          {isError && (
            <motion.div
              key="error"
              initial={{ scale: 0 }}
              animate={{ scale: [0, 1.2, 1] }}
              exit={{ scale: 0 }}
              transition={{ duration: 0.3 }}
            >
              <XCircle className="w-5 h-5" />
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={state}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="relative"
          >
            {isIdle && 'Sync Now'}
            {isSyncing && 'Syncing...'}
            {isSuccess && 'Synced!'}
            {isError && 'Failed'}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </div>
  )
}
