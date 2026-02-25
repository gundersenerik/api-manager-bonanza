'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { Game, SyncLog, GameTrigger } from '@/types'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import {
  GameHeader,
  GameStatsGrid,
  SeasonEndedBanner,
  DeadlineBanner,
  RoundIntroSection,
  BrazeIntegrationSection,
  BrazeTriggersSection,
  SyncLogsSection,
} from '@/components/game-detail'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

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
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncResult, setSyncResult] = useState<{ users: number; elements: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null)
  const [debugging, setDebugging] = useState(false)

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
    setSyncState('syncing')
    setSyncResult(null)
    setSyncError(null)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/sync`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success) {
        setSyncResult({
          users: data.data?.users_synced ?? 0,
          elements: data.data?.elements_synced ?? 0,
        })
        setSyncState('success')
        await fetchGame()
        setTimeout(() => setSyncState('idle'), 3000)
      } else {
        setSyncError(data.error || 'Sync failed - check Vercel logs for details')
        setSyncState('error')
        setTimeout(() => setSyncState('idle'), 3000)
      }
    } catch (error) {
      console.error('Sync failed:', error)
      setSyncError(error instanceof Error ? error.message : 'Network error - sync request failed')
      setSyncState('error')
      setTimeout(() => setSyncState('idle'), 3000)
    }
  }

  const handleDebug = async () => {
    setDebugging(true)
    setDebugData(null)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/debug-sync`)
      const data = await res.json()
      setDebugData(data)
    } catch (error) {
      console.error('Debug failed:', error)
      setDebugData({ error: error instanceof Error ? error.message : 'Debug request failed' })
    } finally {
      setDebugging(false)
    }
  }

  if (loading) {
    return <LoadingScreen message="Loading game..." />
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ink-400">Game not found</p>
      </div>
    )
  }

  return (
    <div>
      <GameHeader
        game={game}
        syncState={syncState}
        syncResult={syncResult}
        syncError={syncError}
        debugData={debugData}
        debugging={debugging}
        onSync={handleSync}
        onDebug={handleDebug}
        onCloseDebug={() => setDebugData(null)}
      />

      <GameStatsGrid game={game} />

      <SeasonEndedBanner game={game} />
      <DeadlineBanner game={game} />

      <RoundIntroSection gameId={game.id} currentRound={game.current_round} totalRounds={game.total_rounds} />

      <BrazeIntegrationSection game={game} />

      <BrazeTriggersSection
        gameId={game.id}
        triggers={game.triggers || []}
        onTriggerChange={fetchGame}
      />

      <SyncLogsSection syncLogs={game.sync_logs || []} />
    </div>
  )
}
