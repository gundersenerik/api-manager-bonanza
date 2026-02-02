'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Gamepad2,
  Users,
  RefreshCw,
  Bell,
  ArrowRight,
  CheckCircle,
  XCircle,
  Clock,
} from 'lucide-react'
import { Game } from '@/types'

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
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-gray-500">
          Overview of your SWUSH fantasy game integrations
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Gamepad2 className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.activeGames}</div>
              <div className="text-sm text-gray-500">Active Games</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Users className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {stats.totalUsers.toLocaleString()}
              </div>
              <div className="text-sm text-gray-500">Total Users</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <RefreshCw className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{stats.recentSyncs}</div>
              <div className="text-sm text-gray-500">Synced Games</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Bell className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">0</div>
              <div className="text-sm text-gray-500">Pending Triggers</div>
            </div>
          </div>
        </div>
      </div>

      {/* Games List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Games</h2>
          <Link
            href="/dashboard/games/new"
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            Add Game
          </Link>
        </div>

        {games.length === 0 ? (
          <div className="p-12 text-center">
            <Gamepad2 className="w-12 h-12 mx-auto text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No games yet</h3>
            <p className="text-gray-500 mb-4">Get started by adding your first game</p>
            <Link
              href="/dashboard/games/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
            >
              Add Game
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {games.map((game) => (
              <Link
                key={game.id}
                href={`/dashboard/games/${game.id}`}
                className="flex items-center justify-between p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    game.is_active ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    {game.is_active ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{game.name}</div>
                    <div className="text-sm text-gray-500">
                      {game.game_key} • Round {game.current_round}/{game.total_rounds || '?'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">
                      {(game.users_total || 0).toLocaleString()} users
                    </div>
                    <div className="text-xs text-gray-500">
                      Synced: {formatDate(game.last_synced_at)}
                    </div>
                  </div>

                  {game.next_trade_deadline && (
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-orange-500" />
                      <span className="text-orange-600 font-medium">
                        {getTimeUntilDeadline(game.next_trade_deadline)}
                      </span>
                    </div>
                  )}

                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
