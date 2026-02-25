'use client'

import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  CheckCircle,
  XCircle,
  Users,
  Trophy,
  Layers,
  Flag,
  ArrowRight,
} from 'lucide-react'
import { Game } from '@/types'
import { isGameSeasonEnded } from '@/lib/game-utils'
import { Card } from '@/components/ui/Card'

interface GameWithStats extends Game {
  stats?: {
    user_count: number
    element_count: number
  }
}

interface GameStatsGridProps {
  game: GameWithStats
}

export function GameStatsGrid({ game }: GameStatsGridProps) {
  const stats = [
    {
      label: 'Status',
      value: isGameSeasonEnded(game) ? 'Season Ended' : game.is_active ? 'Active' : 'Inactive',
      icon: isGameSeasonEnded(game) ? Flag : game.is_active ? CheckCircle : XCircle,
      color: isGameSeasonEnded(game) ? 'text-solar' : game.is_active ? 'text-mint' : 'text-ink-500',
      iconBg: isGameSeasonEnded(game) ? 'bg-solar/15' : game.is_active ? 'bg-mint/15' : 'bg-ink-700/50',
      iconColor: isGameSeasonEnded(game) ? 'text-solar' : game.is_active ? 'text-mint' : 'text-ink-500',
    },
    {
      label: 'Round',
      value: `${game.current_round} / ${game.total_rounds || '?'}`,
      sub: game.round_state,
      icon: Trophy,
      color: 'text-ink-50',
      iconBg: 'bg-electric/15',
      iconColor: 'text-electric',
    },
    {
      label: 'Users',
      value: (game.stats?.user_count || game.users_total || 0).toLocaleString(),
      icon: Users,
      color: 'text-ink-50',
      iconBg: 'bg-ocean/15',
      iconColor: 'text-ocean',
    },
    {
      label: 'Elements',
      value: (game.stats?.element_count || 0).toLocaleString(),
      icon: Layers,
      color: 'text-ink-50',
      iconBg: 'bg-solar/15',
      iconColor: 'text-solar',
      href: `/dashboard/games/${game.id}/elements`,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, i) => {
        const content = (
          <Card className={`p-5 ${stat.href ? 'hover:ring-1 hover:ring-ink-500/40 transition-all cursor-pointer' : ''}`}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-ink-400 mb-1">{stat.label}</p>
                <p className={`text-xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
                {stat.sub && <p className="text-xs text-ink-500 mt-0.5">{stat.sub}</p>}
                {stat.href && (
                  <p className="text-xs text-ocean-400 mt-1.5 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    Browse players <ArrowRight className="w-3 h-3" />
                  </p>
                )}
              </div>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
            </div>
          </Card>
        )

        return (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="group"
          >
            {stat.href ? (
              <Link href={stat.href}>{content}</Link>
            ) : (
              content
            )}
          </motion.div>
        )
      })}
    </div>
  )
}
