'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  Bell,
  Plus,
  Trash2,
  Code,
  ChevronDown,
  ChevronUp,
  Users,
  Trophy,
  Layers,
  Sparkles,
  FileText,
  RotateCw,
} from 'lucide-react'
import { Game, SyncLog, GameTrigger, RoundIntro } from '@/types'
import { useAuth } from '@/contexts/AuthContext'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusDot, SyncStatusDot } from '@/components/ui/StatusDot'
import { CodeBlock, InlineCode } from '@/components/ui/CodeBlock'
import { CopyButton } from '@/components/ui/CopyButton'
import { Input, SelectInput } from '@/components/ui/Input'
import { LoadingScreen } from '@/components/ui/LoadingDots'
import { SyncButton } from '@/components/game/SyncButton'
import { SyncCelebration } from '@/components/game/SyncCelebration'

type SyncState = 'idle' | 'syncing' | 'success' | 'error'

interface GameWithDetails extends Game {
  stats?: {
    user_count: number
    element_count: number
  }
  sync_logs?: SyncLog[]
  triggers?: GameTrigger[]
}

const liquidTags = [
  { category: 'User Stats', tag: '{{response.data.user.team_name}}', description: 'User\'s team name' },
  { category: 'User Stats', tag: '{{response.data.user.rank}}', description: 'Current overall rank' },
  { category: 'User Stats', tag: '{{response.data.user.score}}', description: 'Total score' },
  { category: 'User Stats', tag: '{{response.data.user.round_score}}', description: 'Score for current round' },
  { category: 'User Stats', tag: '{{response.data.user.round_rank}}', description: 'Rank for current round' },
  { category: 'User Stats', tag: '{{response.data.user.position_change}}', description: 'Positions gained/lost this round' },
  { category: 'User Stats', tag: '{{response.data.user.percentile}}', description: 'User\'s percentile (0-100)' },
  { category: 'User Stats', tag: '{{response.data.user.injured_count}}', description: 'Number of injured players in lineup' },
  { category: 'User Stats', tag: '{{response.data.user.suspended_count}}', description: 'Number of suspended players in lineup' },
  { category: 'Game Info', tag: '{{response.data.game.name}}', description: 'Game display name' },
  { category: 'Game Info', tag: '{{response.data.game.current_round}}', description: 'Current round number' },
  { category: 'Game Info', tag: '{{response.data.game.total_rounds}}', description: 'Total number of rounds' },
  { category: 'Game Info', tag: '{{response.data.game.round_state}}', description: 'Current state (CurrentOpen, Ended, etc.)' },
  { category: 'Game Info', tag: '{{response.data.game.trade_deadline}}', description: 'Next trade deadline (ISO date)' },
  { category: 'Game Info', tag: '{{response.data.game.days_until_deadline}}', description: 'Days until next deadline' },
  { category: 'Alerts', tag: '{{response.data.alerts.injured_players}}', description: 'Array of injured player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.suspended_players}}', description: 'Array of suspended player names' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.name}}', description: 'Best performing player in lineup' },
  { category: 'Alerts', tag: '{{response.data.alerts.top_performer.trend}}', description: 'Trend value of top performer' },
  { category: 'Alerts', tag: '{{response.data.alerts.worst_performer.name}}', description: 'Worst performing player in lineup' },
  { category: 'Trending', tag: '{{response.data.trending.hot}}', description: 'Array of top 5 trending players (name, team, trend)' },
  { category: 'Trending', tag: '{{response.data.trending.falling}}', description: 'Array of 5 falling players (name, team, trend)' },
  { category: 'Lineup', tag: '{{response.data.lineup}}', description: 'Array of lineup players with name, team, trend, value, growth, is_injured, is_suspended' },
  { category: 'AI Content', tag: '{{response.data.round_intro}}', description: 'AI-generated round intro text (Swedish, Aftonbladet style)' },
]

export default function GameDetailPage() {
  const { isAdmin } = useAuth()
  const params = useParams()
  const [game, setGame] = useState<GameWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [syncState, setSyncState] = useState<SyncState>('idle')
  const [syncResult, setSyncResult] = useState<{ users: number; elements: number } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [showTriggerForm, setShowTriggerForm] = useState(false)
  const [showAllLogs, setShowAllLogs] = useState(false)
  const [debugData, setDebugData] = useState<Record<string, unknown> | null>(null)
  const [debugging, setDebugging] = useState(false)
  const [triggerForm, setTriggerForm] = useState({
    trigger_type: 'deadline_reminder_24h',
    braze_campaign_id: '',
  })

  // Round intro state
  const [roundIntro, setRoundIntro] = useState<RoundIntro | null>(null)
  const [introLoading, setIntroLoading] = useState(false)
  const [introGenerating, setIntroGenerating] = useState(false)
  const [introError, setIntroError] = useState<string | null>(null)
  const [showArticleSources, setShowArticleSources] = useState(false)

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

  const fetchRoundIntro = useCallback(async () => {
    setIntroLoading(true)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/round-intro`)
      const data = await res.json()
      if (data.success && data.data) {
        setRoundIntro(data.data)
      }
    } catch (error) {
      console.error('Failed to fetch round intro:', error)
    } finally {
      setIntroLoading(false)
    }
  }, [params.id])

  const handleGenerateIntro = async () => {
    setIntroGenerating(true)
    setIntroError(null)
    try {
      const res = await fetch(`/api/admin/games/${params.id}/round-intro`, {
        method: 'POST',
      })
      const data = await res.json()
      if (data.success && data.data) {
        setRoundIntro(data.data)
      } else {
        setIntroError(data.error || 'Failed to generate intro')
      }
    } catch (error) {
      console.error('Failed to generate round intro:', error)
      setIntroError(error instanceof Error ? error.message : 'Network error')
    } finally {
      setIntroGenerating(false)
    }
  }

  useEffect(() => {
    if (params.id) {
      fetchGame()
      fetchRoundIntro()
    }
  }, [params.id, fetchGame, fetchRoundIntro])

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
    return <LoadingScreen message="Loading game..." />
  }

  if (!game) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-ink-400">Game not found</p>
      </div>
    )
  }

  const apiBaseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const brazeToken = process.env.NEXT_PUBLIC_BRAZE_API_TOKEN || 'TOKEN_NOT_CONFIGURED'
  const connectedContentUrl = `${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key}`
  const connectedContentString = `{% connected_content ${connectedContentUrl}?token=${brazeToken} :save response %}`

  const syncLogs = game.sync_logs || []
  const visibleLogs = showAllLogs ? syncLogs : syncLogs.slice(0, 3)

  const tagsByCategory = liquidTags.reduce<Record<string, typeof liquidTags>>((acc, tag) => {
    const category = tag.category
    if (!acc[category]) {
      acc[category] = []
    }
    acc[category]!.push(tag)
    return acc
  }, {})

  const exampleTemplate = `{% connected_content ${apiBaseUrl}/api/v1/users/{{$\{user_id}}}/games/${game.game_key}?token=${brazeToken} :save response %}

{% if response.success %}
  Hi! Your team "{{response.data.user.team_name}}" is ranked #{{response.data.user.rank}}!

  Current round: {{response.data.game.current_round}} of {{response.data.game.total_rounds}}
  Your score: {{response.data.user.score}} points

  {% if response.data.alerts.injured_players.size > 0 %}
    Warning: You have injured players: {{response.data.alerts.injured_players | join: ", "}}
  {% endif %}
{% endif %}`

  return (
    <div>
      <SyncCelebration trigger={syncState === 'success'} />

      {/* Header */}
      <div className="mb-8">
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
              <StatusDot active={game.is_active} />
              <span className={`text-sm ${game.is_active ? 'text-mint' : 'text-ink-500'}`}>
                {game.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Button
                variant="ghost"
                icon={Code}
                onClick={handleDebug}
                disabled={debugging}
                size="sm"
              >
                {debugging ? 'Debugging...' : 'Debug Sync'}
              </Button>
            )}
            <SyncButton state={syncState} onClick={handleSync} />
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
                      onClick={() => setDebugData(null)}
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        {[
          {
            label: 'Status',
            value: game.is_active ? 'Active' : 'Inactive',
            icon: game.is_active ? CheckCircle : XCircle,
            color: game.is_active ? 'text-mint' : 'text-ink-500',
            iconBg: game.is_active ? 'bg-mint/15' : 'bg-ink-700/50',
            iconColor: game.is_active ? 'text-mint' : 'text-ink-500',
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
          },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-ink-400 mb-1">{stat.label}</p>
                  <p className={`text-xl font-heading font-bold ${stat.color}`}>{stat.value}</p>
                  {stat.sub && <p className="text-xs text-ink-500 mt-0.5">{stat.sub}</p>}
                </div>
                <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                  <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Deadline Banner */}
      {game.next_trade_deadline && (
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
      )}

      {/* Round Intro Section */}
      <Card className="mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-600/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-solar" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Omgångsintro</h2>
            {roundIntro && (
              <Badge color="ocean">Omgång {roundIntro.round_number}</Badge>
            )}
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              icon={roundIntro ? RotateCw : Sparkles}
              onClick={handleGenerateIntro}
              disabled={introGenerating}
            >
              {introGenerating ? 'Genererar...' : roundIntro ? 'Regenerera' : 'Generera intro'}
            </Button>
          )}
        </div>

        <div className="p-6">
          {/* Loading state */}
          {introLoading && !roundIntro && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-ink-600 border-t-ocean" />
            </div>
          )}

          {/* Generating skeleton */}
          <AnimatePresence>
            {introGenerating && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3 mb-4"
              >
                <div className="flex items-center gap-2 text-sm text-solar">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    <Sparkles className="w-4 h-4" />
                  </motion.div>
                  <span>AI genererar omgångsintro...</span>
                </div>
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-4 bg-ink-700/40 rounded animate-pulse" style={{ width: `${100 - i * 15}%` }} />
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error state */}
          {introError && (
            <div className="p-4 bg-punch/10 border border-punch/20 rounded-xl mb-4">
              <div className="flex items-start gap-2">
                <XCircle className="w-4 h-4 text-punch mt-0.5 flex-shrink-0" />
                <p className="text-sm text-punch">{introError}</p>
              </div>
            </div>
          )}

          {/* Intro content */}
          {roundIntro && !introGenerating ? (
            <div className="space-y-4">
              <div className="prose prose-invert prose-sm max-w-none">
                {roundIntro.intro_text.split('\n').map((paragraph, i) => (
                  paragraph.trim() ? <p key={i} className="text-ink-200 leading-relaxed">{paragraph}</p> : null
                ))}
              </div>

              {/* Meta info */}
              <div className="flex items-center gap-4 text-xs text-ink-500 pt-2 border-t border-ink-600/20">
                <span>Genererad: {new Date(roundIntro.generated_at).toLocaleString('sv-SE')}</span>
                {roundIntro.model_used && <span>{roundIntro.model_used}</span>}
              </div>

              {/* Article sources */}
              {roundIntro.articles_used && roundIntro.articles_used.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowArticleSources(!showArticleSources)}
                    className="inline-flex items-center gap-1.5 text-xs text-ink-400 hover:text-ink-200 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    {showArticleSources ? 'Dölj' : 'Visa'} artikelkällor ({roundIntro.articles_used.length})
                    {showArticleSources ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                  <AnimatePresence>
                    {showArticleSources && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 space-y-1.5">
                          {roundIntro.articles_used.map((article, i) => (
                            <div
                              key={article.article_id || i}
                              className="flex items-start gap-2 text-xs py-1.5 px-3 bg-ink-700/20 rounded-lg"
                            >
                              <span className="text-ink-500 font-mono mt-0.5">{(article.relevance ?? 0).toFixed(2)}</span>
                              <span className="text-ink-300">{article.title}</span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          ) : !introLoading && !introGenerating && (
            <div className="text-center py-8 text-ink-500">
              <Sparkles className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p>Ingen omgångsintro genererad för denna omgång.</p>
              {isAdmin && (
                <p className="text-sm mt-1">Klicka &quot;Generera intro&quot; för att skapa en AI-genererad omgångspreview.</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Braze Integration Section */}
      <Card className="mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-600/20">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-ocean" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Braze Integration</h2>
          </div>
          <p className="text-sm text-ink-400 mt-1">
            Use Connected Content in your Braze campaigns to personalize emails with game data.
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* API Endpoint */}
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              API Endpoint
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-ink-700/30 px-4 py-2.5 rounded-xl ring-1 ring-ink-600/30 overflow-x-auto">
                <code className="text-sm font-mono text-ocean-300">{connectedContentUrl}</code>
              </div>
              <CopyButton text={connectedContentUrl} />
            </div>
            <p className="text-xs text-ink-500 mt-1.5">
              Replace <InlineCode>{'{{$'}{'{user_id}}}'}</InlineCode> with your Braze user identifier attribute
            </p>
          </div>

          {/* Connected Content String */}
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Connected Content String
            </label>
            <CodeBlock code={connectedContentString} />
            <p className="text-xs text-ink-500 mt-1.5">
              Paste this at the top of your Braze email template. The API token is included automatically.
            </p>
          </div>

          {/* Liquid Tags Table */}
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Available Liquid Tags
            </label>
            <div className="rounded-xl ring-1 ring-ink-600/30 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-ink-800/80 border-b border-ink-600/30">
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Category</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Liquid Tag</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-400 uppercase tracking-wider">Description</th>
                    <th className="px-4 py-2.5 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-600/20">
                  {Object.entries(tagsByCategory).map(([category, tags]) =>
                    tags.map((item, idx) => (
                      <tr key={item.tag} className="hover:bg-ink-700/20 transition-colors">
                        {idx === 0 && (
                          <td
                            className="px-4 py-2 font-medium text-ink-200 bg-ink-800/40 align-top"
                            rowSpan={tags.length}
                          >
                            {category}
                          </td>
                        )}
                        <td className="px-4 py-2">
                          <InlineCode>{item.tag}</InlineCode>
                        </td>
                        <td className="px-4 py-2 text-ink-400">{item.description}</td>
                        <td className="px-4 py-2">
                          <CopyButton text={item.tag} size="sm" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Example Template */}
          <div>
            <label className="block text-sm font-medium text-ink-200 mb-2">
              Example Email Template
            </label>
            <CodeBlock code={exampleTemplate} />
          </div>
        </div>
      </Card>

      {/* Triggers */}
      <Card className="mb-8 overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-600/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-solar" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Braze Triggers</h2>
          </div>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              icon={Plus}
              onClick={() => setShowTriggerForm(!showTriggerForm)}
            >
              Add Trigger
            </Button>
          )}
        </div>

        <AnimatePresence>
          {showTriggerForm && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <form onSubmit={handleAddTrigger} className="p-6 border-b border-ink-600/20 bg-ink-800/40">
                <div className="grid grid-cols-2 gap-4">
                  <SelectInput
                    label="Trigger Type"
                    value={triggerForm.trigger_type}
                    onChange={(e) => setTriggerForm({ ...triggerForm, trigger_type: e.target.value })}
                  >
                    <option value="deadline_reminder_24h">24h Deadline Reminder</option>
                    <option value="round_started">Round Started</option>
                    <option value="round_ended">Round Ended</option>
                  </SelectInput>
                  <Input
                    label="Braze Campaign ID"
                    required
                    placeholder="campaign_id_here"
                    value={triggerForm.braze_campaign_id}
                    onChange={(e) => setTriggerForm({ ...triggerForm, braze_campaign_id: e.target.value })}
                  />
                </div>
                <div className="mt-4 flex gap-2">
                  <Button type="submit" size="sm">Add Trigger</Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowTriggerForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="divide-y divide-ink-600/20">
          {(game.triggers || []).length === 0 ? (
            <div className="p-6 text-center text-ink-500">
              No triggers configured. Add a trigger to automate Braze campaigns.
            </div>
          ) : (
            (game.triggers || []).map((trigger, index) => (
              <motion.div
                key={trigger.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-5 flex items-center justify-between hover:bg-ink-700/10 transition-colors"
              >
                <div>
                  <div className="font-medium text-ink-50">
                    {getTriggerTypeName(trigger.trigger_type)}
                  </div>
                  <div className="text-sm text-ink-400 font-mono">
                    {trigger.braze_campaign_id}
                  </div>
                  {trigger.last_triggered_at && (
                    <div className="text-xs text-ink-500 mt-1">
                      Last triggered: {formatDate(trigger.last_triggered_at)} (Round {trigger.last_triggered_round})
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  <Badge color={trigger.is_active ? 'mint' : 'ink'}>
                    {trigger.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                  {isAdmin && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleDeleteTrigger(trigger.id)}
                      className="p-2 text-ink-500 hover:text-punch transition-colors rounded-lg hover:bg-punch/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </motion.button>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>

      {/* Recent Sync Logs */}
      <Card className="overflow-hidden">
        <div className="px-6 py-4 border-b border-ink-600/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-electric" />
            <h2 className="text-lg font-heading font-semibold text-ink-50">Recent Sync Logs</h2>
          </div>
          {syncLogs.length > 3 && (
            <button
              onClick={() => setShowAllLogs(!showAllLogs)}
              className="inline-flex items-center gap-1 text-sm text-ink-400 hover:text-ink-200 transition-colors"
            >
              {showAllLogs ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Show less
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show all ({syncLogs.length})
                </>
              )}
            </button>
          )}
        </div>
        <div className="divide-y divide-ink-600/20">
          {visibleLogs.length === 0 ? (
            <div className="p-6 text-center text-ink-500">
              No sync logs yet. Trigger a sync to see logs here.
            </div>
          ) : (
            visibleLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.03 }}
                className={`p-4 flex items-center justify-between ${
                  log.status === 'failed' ? 'bg-punch/5' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <SyncStatusDot status={log.status as 'completed' | 'failed' | 'running'} />
                  <div>
                    <div className="text-sm font-medium text-ink-200">
                      {log.sync_type === 'manual' ? 'Manual Sync' : 'Scheduled Sync'}
                    </div>
                    <div className="text-xs text-ink-500">
                      {formatDate(log.started_at)}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-ink-200">
                    {log.users_synced} users, {log.elements_synced} elements
                  </div>
                  {log.error_message && (
                    <div className="text-xs text-punch mt-0.5">{log.error_message}</div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
