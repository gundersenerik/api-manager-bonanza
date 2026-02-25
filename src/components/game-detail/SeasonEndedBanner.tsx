'use client'

import { motion } from 'framer-motion'
import { Clock, Flag } from 'lucide-react'
import { Game } from '@/types'
import { isGameSeasonEnded } from '@/lib/game-utils'

interface SeasonEndedBannerProps {
  game: Game
}

export function SeasonEndedBanner({ game }: SeasonEndedBannerProps) {
  if (!isGameSeasonEnded(game)) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="bg-gradient-to-r from-solar/15 to-solar/5 border border-solar/20 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-solar/15 rounded-lg">
            <Flag className="w-5 h-5 text-solar" />
          </div>
          <div>
            <p className="font-heading font-semibold text-solar">Season Ended</p>
            <p className="text-sm text-ink-400 mt-0.5">
              All {game.total_rounds} rounds have been played. No more upcoming rounds or trade deadlines.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

interface DeadlineBannerProps {
  game: Game
}

export function DeadlineBanner({ game }: DeadlineBannerProps) {
  if (isGameSeasonEnded(game) || !game.next_trade_deadline) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('sv-SE')
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <div className="bg-gradient-to-r from-solar/15 to-punch/10 border border-solar/20 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <Clock className="w-6 h-6 text-solar" />
          </motion.div>
          <div>
            <div className="font-medium text-solar">Next Trade Deadline</div>
            <div className="text-solar/70">{formatDate(game.next_trade_deadline)}</div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
