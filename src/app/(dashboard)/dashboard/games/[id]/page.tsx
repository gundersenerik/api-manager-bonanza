'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Bell,
  Plus,
  Trash2,
} from 'lucide-react'
import { Game, SyncLog, GameTrigger } from '@/types'

// Extended Game type with additional API response data
interface GameWithDetails extends Game {
  stats?: {
    user_count: number
    element_count: number
  }
  sync_logs?: SyncLog[]
  triggers?: GameTrigger[]
}

export default function GameDetailPage() {
  const params = useParams()
  const [game, setGame] = useState<GameWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showTriggerForm, setShowTriggerForm] = useState(false)
  const [triggerForm, setTriggerForm] = useState({
    trigger_type: 'deadline_reminder_24h',
    braze_campaign_id: '',
  })

  const fetchGame = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/games/${params.id}`)
      const data = await res.json()
      if (data.success) {
        setGame(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch game:', error)
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    if (params.id) {
      fetchGame()
    }
  }, [params.id, fetchGame])

  const handleSync = async () => {
    setSyncing(true)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/sync`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        await fetchGame()
      }
    } catch (error) {
      console.error('Sync failed:', error)
    } finally {
      setSyncing(false)
    }
  }

  const handleAddTrigger = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch(`/api/admin/games/${params.id}/triggers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(triggerForm),
      })
      const data = await res.json()
      if (data.success) {
        setShowTriggerForm(false)
        setTriggerForm({ trigger_type: 'deadline_reminder_24h', braze_campaign_id: '' })
        fetchGame()
      }
    } catch (error) {
      console.error('Failed to add trigger:', error)
    }
  }

  const handleDeleteTrigger = async (triggerId: string) => {
    if (!confirm('Are you sure you want to delete this trigger?')) return
    try {
      await fetch(`/api/admin/games/${params.id}/triggers?trigger_id=${triggerId}`, {
        method: 'DELETE',
      })
      fetchGame()
    } catch (error) {
      console.error('Failed to delete trigger:', error)
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never'
    return new Date(dateString).toLocaleString('sv-SE')
  }

  const getTriggerTypeName = (type: string) => {
    switch (type) {
      case 'deadline_reminder_24h': return '24h Deadline Reminder'
      case 'round_started': return 'Round Started'
      case 'round_ended': return 'Round Ended'
      default: return type
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!game) {
    return <div>Game not found</div>
  }

  return (
    <div>
      <div className="mb-8">
        <Link
          href="/dashboard/games"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Link>

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{game.name}</h1>
            <p className="mt-1 text-gray-500">{game.game_key}</p>
          </div>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Sync Now
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Status</div>
          <div className="flex items-center gap-2">
            {game.is_active ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="font-medium text-green-700">Active</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-gray-400" />
                <span className="font-medium text-gray-500">Inactive</span>
              </>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Round</div>
          <div className="text-xl font-bold text-gray-900">
            {game.current_round} / {game.total_rounds || '?'}
          </div>
          <div className="text-sm text-gray-500">{game.round_state}</div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Users</div>
          <div className="text-xl font-bold text-gray-900">
            {(game.stats?.user_count || game.users_total || 0).toLocaleString()}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="text-sm text-gray-500 mb-1">Elements</div>
          <div className="text-xl font-bold text-gray-900">
            {(game.stats?.element_count || 0).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Deadline Info */}
      {game.next_trade_deadline && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-orange-500" />
            <div>
              <div className="font-medium text-orange-800">Next Trade Deadline</div>
              <div className="text-orange-600">{formatDate(game.next_trade_deadline)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Triggers */}
      <div className="bg-white rounded-xl border border-gray-200 mb-8">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900">Braze Triggers</h2>
          </div>
          <button
            onClick={() => setShowTriggerForm(!showTriggerForm)}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add Trigger
          </button>
        </div>

        {showTriggerForm && (
          <form onSubmit={handleAddTrigger} className="p-6 border-b border-gray-200 bg-gray-50">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trigger Type
                </label>
                <select
                  value={triggerForm.trigger_type}
                  onChange={(e) => setTriggerForm({ ...triggerForm, trigger_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="deadline_reminder_24h">24h Deadline Reminder</option>
                  <option value="round_started">Round Started</option>
                  <option value="round_ended">Round Ended</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Braze Campaign ID
                </label>
                <input
                  type="text"
                  required
                  placeholder="campaign_id_here"
                  value={triggerForm.braze_campaign_id}
                  onChange={(e) => setTriggerForm({ ...triggerForm, braze_campaign_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700"
              >
                Add Trigger
              </button>
              <button
                type="button"
                onClick={() => setShowTriggerForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="divide-y divide-gray-200">
          {(game.triggers || []).length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No triggers configured. Add a trigger to automate Braze campaigns.
            </div>
          ) : (
            (game.triggers || []).map((trigger) => (
              <div key={trigger.id} className="p-6 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">
                    {getTriggerTypeName(trigger.trigger_type)}
                  </div>
                  <div className="text-sm text-gray-500">
                    Campaign: {trigger.braze_campaign_id}
                  </div>
                  {trigger.last_triggered_at && (
                    <div className="text-xs text-gray-400 mt-1">
                      Last triggered: {formatDate(trigger.last_triggered_at)} (Round {trigger.last_triggered_round})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    trigger.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                  }`}>
                    {trigger.is_active ? 'Active' : 'Inactive'}
                  </span>
                  <button
                    onClick={() => handleDeleteTrigger(trigger.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Sync Logs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Sync Logs</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {(game.sync_logs || []).length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              No sync logs yet. Trigger a sync to see logs here.
            </div>
          ) : (
            (game.sync_logs || []).map((log) => (
              <div key={log.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {log.status === 'completed' ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : log.status === 'failed' ? (
                    <XCircle className="w-5 h-5 text-red-500" />
                  ) : (
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                  )}
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {log.sync_type === 'manual' ? 'Manual Sync' : 'Scheduled Sync'}
                    </div>
                    <div className="text-xs text-gray-500">
                      {formatDate(log.started_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-900">
                    {log.users_synced} users, {log.elements_synced} elements
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-red-500">{log.error_message}</div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
