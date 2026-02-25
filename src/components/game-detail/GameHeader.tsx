'use client'

import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Code,
  Flag,
} from 'lucide-react'
import { Game } from '@/types'
import { isGameSeasonEnded } from '@/lib/game-utils'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { InlineCode, CodeBlock } from '@/components/ui/CodeBlock'
import { SyncButton } from '@/components/game/SyncButton'
import { SyncCelebration } from '@/components/game/SyncCelebration'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface GameHeaderProps {
  game: Game
  syncState: SyncState
  syncResult: { users: number; elements: number } | null
  syncError: string | null
  debugData: Record<string, unknown> | null
  debugging: boolean
  onSync: () => void
  onDebug: () => void
  onCloseDebug: () => void
}

export function GameHeader({
  game,
  syncState,
  syncResult,
  syncError,
  debugData,
  debugging,
  onSync,
  onDebug,
  onCloseDebug,
}: GameHeaderProps) {
  const { isAdmin } = useAuth()

  return (
    <div className="mb-8">
      <SyncCelebration trigger={syncState === 'success'} />

      <Link
        href="/dashboard/games"
        className="inline-flex items-center gap-2 text-ink-400 hover:text-ink-200 mb-4 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        Back to Games
      </Link>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold text-ink-50">{game.name}</h1>
          <div className="mt-1 flex items-center gap-3">
            <InlineCode>{game.game_key}</InlineCode>
            {isGameSeasonEnded(game) ? (
              <Badge color="solar" icon={Flag}>Season Ended</Badge>
            ) : (
              <>
                <StatusDot active={game.is_active} />
                <span className={`text-sm ${game.is_active ? 'text-mint' : 'text-ink-500'}`}>
                  {game.is_active ? 'Active' : 'Inactive'}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Button
              variant="ghost"
              icon={Code}
              onClick={onDebug}
              disabled={debugging}
              size="sm"
            >
              {debugging ? 'Debugging...' : 'Debug Sync'}
            </Button>
          )}
          <SyncButton state={syncState} onClick={onSync} />
        </div>
      </div>

      {/* Sync feedback */}
      <AnimatePresence>
        {syncState === 'error' && syncError && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mt-4"
          >
            <div className="p-4 bg-punch/10 border border-punch/20 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-punch mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-punch">Sync Failed</p>
                <p className="text-sm text-punch/70 mt-1">{syncError}</p>
              </div>
            </div>
          </motion.div>
        )}
        {syncState === 'success' && syncResult && (
          <motion.div
            initial={{ opacity: 0, y: -8, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -8, height: 0 }}
            className="mt-4"
          >
            <div className="p-4 bg-mint/10 border border-mint/20 rounded-xl flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-mint mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-mint">Sync Completed</p>
                <p className="text-sm text-mint/70 mt-1">
                  Synced {syncResult.elements} elements and {syncResult.users} users
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debug Output */}
      <AnimatePresence>
        {debugData && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4"
          >
            <Card className="overflow-hidden">
              <div className="p-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-sm font-medium text-ink-200">Debug Output</span>
                  <button
                    onClick={onCloseDebug}
                    className="text-ink-400 hover:text-ink-200 text-sm transition-colors"
                  >
                    Close
                  </button>
                </div>
                <CodeBlock code={JSON.stringify(debugData, null, 2)} />
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
