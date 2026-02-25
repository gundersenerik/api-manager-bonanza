'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Gamepad2,
  Plus,
  AlertCircle,
  RefreshCw,
  Flag,
} from 'lucide-react'
import { Game } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { isGameSeasonEnded } from '@/lib/game-utils'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { Badge, SportBadge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'

export default function GamesPage() {
  const { isAdmin } = useAuth()
  const [games, setGames] = useState<Game[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchGames()
  }, [])

  const fetchGames = async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()
      if (data.success) {
        setGames(data.data || [])
        setError(null)
      } else {
        setError(data.error || `Request failed with status ${res.status}`)
      }
    } catch (error) {
      console.error('Failed to fetch games:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch games')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  if (loading) {
    return <LoadingScreen message="Loading games..." />
  }

  return (
    <div>
      <PageHeader
        title="Games"
        description="Manage your SWUSH fantasy game integrations"
        actions={
          isAdmin ? (
            <Link href="/dashboard/games/new">
              <Button icon={Plus} size="sm">Add Game</Button>
            </Link>
          ) : undefined
        }
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 bg-punch/10 border border-punch/20 rounded-xl flex items-center gap-3"
        >
          <AlertCircle className="w-5 h-5 text-punch flex-shrink-0" />
          <div>
            <p className="text-punch font-medium">Failed to load games</p>
            <p className="text-punch/70 text-sm">{error}</p>
          </div>
          <button
            onClick={fetchGames}
            className="ml-auto px-3 py-1.5 text-sm bg-punch/20 hover:bg-punch/30 text-punch rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5 inline mr-1" />
            Retry
          </button>
        </motion.div>
      )}

      {!error && games.length === 0 && (
        <Card>
          <div className="p-8">
            <EmptyState
              icon={Gamepad2}
              title="No games yet"
              description="Get started by adding your first game"
              action={
                isAdmin ? (
                  <Link href="/dashboard/games/new">
                    <Button icon={Plus}>Add Game</Button>
                  </Link>
                ) : undefined
              }
            />
          </div>
        </Card>
      )}

      {games.length > 0 && (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-ink-600/30 bg-ink-800/80">
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Game
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Sport
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Round
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Sync Interval
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Last Synced
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-600/20">
                {games.map((game, index) => (
                  <motion.tr
                    key={game.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04, duration: 0.3 }}
                    className="group hover:bg-ink-700/20 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-ink-50">{game.name}</div>
                      <div className="text-sm text-ink-500 font-mono">{game.game_key}</div>
                    </td>
                    <td className="px-6 py-4">
                      <SportBadge sport={game.sport_type} />
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-200">
                      {game.current_round}/{game.total_rounds || '?'}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-200">
                      {(game.users_total || 0).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-400">
                      {game.sync_interval_minutes} min
                    </td>
                    <td className="px-6 py-4 text-sm text-ink-400">
                      {formatDate(game.last_synced_at)}
                    </td>
                    <td className="px-6 py-4">
                      {isGameSeasonEnded(game) ? (
                        <Badge color="solar" icon={Flag}>Season Ended</Badge>
                      ) : (
                        <div className="flex items-center gap-2">
                          <StatusDot active={game.is_active} />
                          <span className={`text-sm ${game.is_active ? 'text-mint' : 'text-ink-500'}`}>
                            {game.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={`/dashboard/games/${game.id}`}
                        className="text-electric-400 hover:text-electric-300 text-sm font-medium transition-colors"
                      >
                        View →
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}
