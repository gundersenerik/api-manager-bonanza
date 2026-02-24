'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  Gamepad2,
  Users,
  RefreshCw,
  Bell,
  ArrowRight,
  Clock,
  Plus,
} from 'lucide-react'
import { Game } from '@/types'
import { PageHeader } from '@/components/layout/PageHeader'
import { StatCard } from '@/components/ui/StatCard'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { SportBadge } from '@/components/ui/Badge'

interface DashboardStats {
  totalGames: number
  activeGames: number
  totalUsers: number
  recentSyncs: number
}

export default function DashboardPage() {
  const [games, setGames] = useState<Game[]>([])
  const [stats, setStats] = useState<DashboardStats>({
    totalGames: 0,
    activeGames: 0,
    totalUsers: 0,
    recentSyncs: 0,
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const res = await fetch('/api/admin/games')
      const data = await res.json()

      if (data.success) {
        const gamesList = data.data || []
        setGames(gamesList)

        setStats({
          totalGames: gamesList.length,
          activeGames: gamesList.filter((g: Game) => g.is_active).length,
          totalUsers: gamesList.reduce((sum: number, g: Game) => sum + (g.users_total || 0), 0),
          recentSyncs: gamesList.filter((g: Game) => g.last_synced_at).length,
        })
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const getTimeUntilDeadline = (deadline: string | null) => {
    if (!deadline) return null
    const now = new Date()
    const deadlineDate = new Date(deadline)
    const diff = deadlineDate.getTime() - now.getTime()
    if (diff < 0) return 'Passed'
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    return `${hours}h`
  }

  if (loading) {
    return <LoadingScreen message="Loading dashboard..." />
  }

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your SWUSH fantasy game integrations"
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Active Games"
          value={stats.activeGames}
          icon={Gamepad2}
          color="electric"
          delay={0}
        />
        <StatCard
          label="Total Users"
          value={stats.totalUsers}
          icon={Users}
          color="mint"
          delay={0.1}
        />
        <StatCard
          label="Synced Games"
          value={stats.recentSyncs}
          icon={RefreshCw}
          color="ocean"
          delay={0.2}
        />
        <StatCard
          label="Pending Triggers"
          value={0}
          icon={Bell}
          color="solar"
          delay={0.3}
        />
      </div>

      {/* Games List */}
      <Card>
        <div className="px-6 py-4 border-b border-ink-600/30 flex items-center justify-between">
          <h2 className="text-lg font-heading font-semibold text-ink-50">Games</h2>
          <Link href="/dashboard/games/new">
            <Button icon={Plus} size="sm">
              Add Game
            </Button>
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={Gamepad2}
              title="No games yet"
              description="Get started by adding your first game"
              action={
                <Link href="/dashboard/games/new">
                  <Button icon={ArrowRight}>Add Game</Button>
                </Link>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-ink-600/20">
            {games.map((game, index) => (
              <motion.div
                key={game.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                <Link
                  href={`/dashboard/games/${game.id}`}
                  className="group flex items-center justify-between p-6 hover:bg-ink-700/20 transition-all duration-200"
                >
                  <div className="flex items-center gap-4">
                    <StatusDot active={game.is_active} />
                    <div>
                      <div className="font-medium text-ink-50 group-hover:text-electric-300 transition-colors">
                        {game.name}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-ink-400 font-mono">
                          {game.game_key}
                        </span>
                        <span className="text-ink-600">·</span>
                        <span className="text-sm text-ink-400">
                          Round {game.current_round}/{game.total_rounds || '?'}
                        </span>
                        {game.sport_type && (
                          <>
                            <span className="text-ink-600">·</span>
                            <SportBadge sport={game.sport_type} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-8">
                    <div className="text-right">
                      <div className="text-sm font-medium text-ink-200">
                        {(game.users_total || 0).toLocaleString()} users
                      </div>
                      <div className="text-xs text-ink-500">
                        Synced: {formatDate(game.last_synced_at)}
                      </div>
                    </div>

                    {game.next_trade_deadline && (
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="w-4 h-4 text-solar" />
                        <span className="text-solar font-medium">
                          {getTimeUntilDeadline(game.next_trade_deadline)}
                        </span>
                      </div>
                    )}

                    <ArrowRight className="w-5 h-5 text-ink-600 group-hover:text-electric-400 group-hover:translate-x-1 transition-all" />
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
